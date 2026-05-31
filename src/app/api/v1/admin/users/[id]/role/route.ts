import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { changeRoleSchema, validateInput } from '@/lib/zod-schemas';

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
    const validation = validateInput(changeRoleSchema, body);
    if (!validation.success) {
      return error(40001, validation.errors.join('; '), requestId);
    }
    const { role } = validation.data;

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return error(40401, '用户不存在', requestId);
    }

    // Only super_admin can change roles
    if (admin.role !== 'super_admin') {
      return error(40301, '只有超级管理员可以修改用户角色', requestId);
    }

    // Prevent modifying own role
    if (id === admin.userId) {
      return error(40002, '无法修改自己的角色', requestId);
    }

    // Prevent changing another super_admin's role (safety)
    if (user.role === 'super_admin' && role !== 'super_admin') {
      return error(40003, '无法降级超级管理员', requestId);
    }

    const updated = await db.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        nickname: true,
        email: true,
        role: true,
      },
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'update_user_role',
        targetType: 'user',
        targetId: id,
        detail: JSON.stringify({ oldRole: user.role, newRole: role }),
      },
    });

    return success(updated, '用户角色已更新', requestId);
  } catch (err) {
    console.error('User role update error:', err);
    return error(50001, '更新用户角色失败', requestId);
  }
}
