import { db } from '@/lib/db';
import { verifyRefreshToken } from '@/lib/auth';

/**
 * 存储Refresh Token到数据库
 * 提取自多个认证路由中的重复代码
 * 
 * 安全：先通过 verifyRefreshToken 验证JWT签名和类型，防止伪造Token被写入数据库
 */
export async function storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
  // 安全：验证JWT签名完整性，防止伪造Token
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    throw new Error('Invalid refresh token: signature verification failed');
  }
  if (payload.sub !== userId) {
    throw new Error('Refresh token userId mismatch');
  }

  await db.refreshToken.create({
    data: {
      userId,
      token: refreshToken,
      expiresAt: new Date((payload.exp || 0) * 1000),
    },
  });
}
