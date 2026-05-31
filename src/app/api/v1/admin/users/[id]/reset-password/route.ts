import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { hashPassword } from '@/lib/auth';

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
    const { new_password } = body;

    if (!new_password || new_password.length < 8) {
      return error(40001, '新密码不能为空且至少8位', requestId);
    }

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return error(40401, '用户不存在', requestId);
    }

    // Only super_admin can reset other admins' passwords
    if ((user.role === 'admin' || user.role === 'super_admin') && admin.role !== 'super_admin') {
      return error(40301, '权限不足', requestId);
    }

    const hashedPassword = await hashPassword(new_password);

    await db.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'reset_user_password',
        targetType: 'user',
        targetId: id,
        detail: JSON.stringify({ message: '管理员重置密码' }),
      },
    });

    return success(null, '密码已重置', requestId);
  } catch (err) {
    console.error('User password reset error:', err);
    return error(50001, '重置密码失败', requestId);
  }
}
