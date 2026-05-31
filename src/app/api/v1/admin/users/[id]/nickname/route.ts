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
    const { nickname } = body;

    // Validate nickname length
    if (nickname !== null && nickname !== undefined) {
      if (typeof nickname !== 'string') {
        return error(40001, '昵称必须是字符串', requestId);
      }
      if (nickname.length > 50) {
        return error(40001, '昵称长度不能超过50个字符', requestId);
      }
      if (nickname.trim().length === 0) {
        return error(40001, '昵称不能为空白', requestId);
      }
    }

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return error(40401, '用户不存在', requestId);
    }

    const updated = await db.user.update({
      where: { id },
      data: { nickname: nickname || null },
      select: {
        id: true,
        nickname: true,
        email: true,
        avatarUrl: true,
        role: true,
        status: true,
      },
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'update_user_nickname',
        targetType: 'user',
        targetId: id,
        detail: JSON.stringify({ oldNickname: user.nickname, newNickname: nickname || null }),
      },
    });

    return success(updated, '昵称已更新', requestId);
  } catch (err) {
    console.error('User nickname update error:', err);
    return error(50001, '更新昵称失败', requestId);
  }
}
