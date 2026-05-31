import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, recordApiError } from '@/lib/response';
import { generateTokenPair, hashPassword } from '@/lib/auth';
import { storeRefreshToken } from '@/lib/refresh-token';
import { registerSchema, validateInput } from '@/lib/zod-schemas';
import { incrementDailyStat } from '@/lib/daily-stats';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();
  try {
    const body = await request.json();
    const validation = validateInput(registerSchema, body);
    if (!validation.success) {
      return error(40001, validation.errors.join('; '), requestId);
    }
    const { email, password, nickname, code } = validation.data;

    // 验证邮箱验证码
    const verificationCode = await db.verificationCode.findFirst({
      where: {
        target: email,
        type: 'register',
        channel: 'email',
        code,
        expiresAt: { gt: new Date() }, // 未过期
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationCode) {
      return error(40004, '验证码无效或已过期', requestId);
    }

    // 删除已使用的验证码
    await db.verificationCode.delete({ where: { id: verificationCode.id } }).catch(() => null);

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return error(40901, '该邮箱已被注册', requestId);
    }

    const hashedPassword = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        nickname: nickname || email.split('@')[0],
        role: 'user',
        status: 'active',
      },
    });

    const tokens = generateTokenPair(user.id, user.role);

    // Store refresh token
    await storeRefreshToken(user.id, tokens.refresh_token);

    // 同步更新每日统计
    incrementDailyStat('newUserCount');

    return success({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    }, '注册成功', requestId);
  } catch (err) {
    console.error('Register error:', err);
    recordApiError({ request, statusCode: 500, errorMessage: String(err), startTime });
    return error(50001, '注册失败', requestId);
  }
}
