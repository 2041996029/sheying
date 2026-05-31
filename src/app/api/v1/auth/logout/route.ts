import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, getAuthUser } from '@/lib/response';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return error(40101, '未登录或Token无效', requestId);
    }

    // Revoke all refresh tokens for the user
    await db.refreshToken.updateMany({
      where: { userId: auth.userId, revoked: false },
      data: { revoked: true },
    });

    return success(null, '退出成功', requestId);
  } catch (err) {
    console.error('Logout error:', err);
    return error(50001, '退出失败', requestId);
  }
}
