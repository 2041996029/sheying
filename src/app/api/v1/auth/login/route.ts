import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, recordApiError } from '@/lib/response';
import { generateTokenPair, verifyPassword } from '@/lib/auth';
import { storeRefreshToken } from '@/lib/refresh-token';
import { loginSchema, validateInput } from '@/lib/zod-schemas';

// 简单的内存暴力破解防护：同一邮箱/IP连续失败5次后锁定15分钟
const loginFailMap = new Map<string, { count: number; lockedUntil: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15分钟

function getClientKey(request: Request, email: string): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') || 'unknown';
  return `${ip}:${email}`;
}

function checkLoginRateLimit(request: Request, email: string): string | null {
  const key = getClientKey(request, email);
  const entry = loginFailMap.get(key);
  if (!entry) return null;
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    const remainingMin = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
    return `登录尝试过于频繁，请${remainingMin}分钟后再试`;
  }
  // 锁定已过期，清除
  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    loginFailMap.delete(key);
  }
  return null;
}

function recordLoginFailure(request: Request, email: string): void {
  const key = getClientKey(request, email);
  const entry = loginFailMap.get(key) || { count: 0, lockedUntil: 0 };
  entry.count++;
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION;
  }
  loginFailMap.set(key, entry);
}

function recordLoginSuccess(request: Request, email: string): void {
  const key = getClientKey(request, email);
  loginFailMap.delete(key);
}

// 定期清理过期和陈旧条目（每10分钟），使用globalThis防止热重载时创建多个定时器
if (typeof globalThis.__loginCleanupTimer !== 'undefined') {
  clearInterval(globalThis.__loginCleanupTimer);
}
globalThis.__loginCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginFailMap.entries()) {
    // 清除锁定已过期的条目
    if (entry.lockedUntil && now >= entry.lockedUntil) {
      loginFailMap.delete(key);
    }
    // 清除超过30分钟的陈旧条目（未锁定但很久没活动）
    if (!entry.lockedUntil && entry.count > 0) {
      loginFailMap.delete(key);
    }
  }
}, 10 * 60 * 1000);
if (typeof globalThis.__loginCleanupTimer === 'object' && 'unref' in globalThis.__loginCleanupTimer) {
  globalThis.__loginCleanupTimer.unref();
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();
  try {
    const body = await request.json();
    const validation = validateInput(loginSchema, body);
    if (!validation.success) {
      return error(40001, validation.errors.join('; '), requestId);
    }
    const { email, password } = validation.data;

    // 暴力破解防护：检查登录频率
    const rateLimitMsg = checkLoginRateLimit(request, email);
    if (rateLimitMsg) {
      return error(42901, rateLimitMsg, requestId);
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return error(40101, '邮箱或密码错误', requestId);
    }

    if (user.status === 'banned') {
      return error(40301, '账号已被封禁', requestId);
    }

    if (user.deletedAt) {
      return error(40102, '账号已删除', requestId);
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      recordLoginFailure(request, email);
      return error(40103, '邮箱或密码错误', requestId);
    }

    const tokens = generateTokenPair(user.id, user.role);

    // 登录成功，清除失败计数
    recordLoginSuccess(request, email);

    // Store refresh token
    await storeRefreshToken(user.id, tokens.refresh_token);

    return success({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      },
    }, '登录成功', requestId);
  } catch (err) {
    console.error('Login error:', err);
    recordApiError({ request, statusCode: 500, errorMessage: String(err), startTime });
    return error(50001, '登录失败', requestId);
  }
}
