import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId } from '@/lib/response';
import { generateTokenPair, verifyRefreshToken } from '@/lib/auth';
import { storeRefreshToken } from '@/lib/refresh-token';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const body = await request.json();
    const { refresh_token } = body;

    if (!refresh_token) {
      return error(40001, 'refresh_token不能为空', requestId);
    }

    const payload = verifyRefreshToken(refresh_token);
    if (!payload) {
      return error(40101, '无效的refresh_token', requestId);
    }

    // Check if token is revoked in DB
    const storedToken = await db.refreshToken.findUnique({
      where: { token: refresh_token },
    });
    if (!storedToken || storedToken.revoked) {
      return error(40102, 'refresh_token已失效', requestId);
    }

    // Revoke old refresh token
    await db.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    // Get user
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.deletedAt || user.status === 'banned') {
      return error(40103, '用户不存在或已禁用', requestId);
    }

    const tokens = generateTokenPair(user.id, user.role);

    // Store new refresh token
    await storeRefreshToken(user.id, tokens.refresh_token);

    return success(tokens, '刷新成功', requestId);
  } catch (err) {
    console.error('Token refresh error:', err);
    return error(50001, '刷新Token失败', requestId);
  }
}
