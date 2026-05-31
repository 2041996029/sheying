import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { EMAIL_REGEX } from '@/lib/validators';

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
    const { email } = body;

    // Validate email format
    if (email && !EMAIL_REGEX.test(email)) {
      return error(40001, '邮箱格式不正确', requestId);
    }

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return error(40401, '用户不存在', requestId);
    }

    // Check email uniqueness (exclude self)
    if (email) {
      const existing = await db.user.findFirst({
        where: { email, NOT: { id } },
      });
      if (existing) {
        return error(40002, '该邮箱已被其他用户使用', requestId);
      }
    }

    const updated = await db.user.update({
      where: { id },
      data: { email: email || null },
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
        action: 'update_user_email',
        targetType: 'user',
        targetId: id,
        detail: JSON.stringify({ oldEmail: user.email, newEmail: email || null }),
      },
    });

    return success(updated, '邮箱已更新', requestId);
  } catch (err) {
    console.error('User email update error:', err);
    return error(50001, '更新邮箱失败', requestId);
  }
}
