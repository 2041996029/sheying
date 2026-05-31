import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;
  const admin = adminResult;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['active', 'banned', 'deleted'].includes(status)) {
      return error(40001, 'status必须为active、banned或deleted', requestId);
    }

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return error(40401, '用户不存在', requestId);
    }

    // Prevent banning/deleting super_admin unless by another super_admin
    if ((user.role === 'super_admin') && admin.role !== 'super_admin') {
      return error(40301, '无法修改超级管理员状态', requestId);
    }

    // Prevent modifying own status
    if (id === admin.userId) {
      return error(40002, '无法修改自己的状态', requestId);
    }

    const updateData: Record<string, unknown> = { status };
    if (status === 'deleted') {
      updateData.deletedAt = new Date();
    } else {
      updateData.deletedAt = null;
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nickname: true,
        email: true,
        role: true,
        status: true,
      },
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'update_user_status',
        targetType: 'user',
        targetId: id,
        detail: JSON.stringify({ oldStatus: user.status, newStatus: status }),
      },
    });

    return success(updated, '用户状态已更新', requestId);
  } catch (err) {
    console.error('User status update error:', err);
    return error(50001, '更新用户状态失败', requestId);
  }
}
