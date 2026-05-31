import { db } from '@/lib/db';
import { getCache, setCache } from '@/lib/cache';

// 简单的内存速率限制器

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * 从配置中获取IP限流阈值（次/分钟）
 */
export async function getIpRateLimit(): Promise<number> {
  const cacheKey = 'configs:security_rate_limit_ip';
  const cached = await getCache<string>(cacheKey);
  if (cached !== null) return parseInt(cached, 10) || 100;
  try {
    const config = await db.config.findUnique({ where: { key: 'security_rate_limit_ip' } });
    const value = parseInt(config?.value || '100', 10) || 100;
    await setCache(cacheKey, String(value), 300);
    return value;
  } catch {
    return 100;
  }
}

/**
 * 从配置中获取用户限流阈值（次/分钟）
 */
export async function getUserRateLimit(): Promise<number> {
  const cacheKey = 'configs:security_rate_limit_user';
  const cached = await getCache<string>(cacheKey);
  if (cached !== null) return parseInt(cached, 10) || 60;
  try {
    const config = await db.config.findUnique({ where: { key: 'security_rate_limit_user' } });
    const value = parseInt(config?.value || '60', 10) || 60;
    await setCache(cacheKey, String(value), 300);
    return value;
  } catch {
    return 60;
  }
}

/**
 * 检查速率限制
 * @param key 限制键（如 IP + 路由）
 * @param maxAttempts 最大请求次数
 * @param windowMs 时间窗口（毫秒）
 * @returns 受限时返回错误消息，否则返回null
 */
export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): string | null {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;
  if (entry.count > maxAttempts) {
    const remainingSec = Math.ceil((entry.resetAt - now) / 1000);
    return `操作过于频繁，请${remainingSec}秒后再试`;
  }

  return null;
}

/**
 * 便捷方法：IP限流（从配置读取阈值，默认100次/分钟）
 */
export async function checkIpRateLimit(ip: string, route: string): Promise<string | null> {
  const maxAttempts = await getIpRateLimit();
  return checkRateLimit(`ip:${ip}:${route}`, maxAttempts, 60000);
}

/**
 * 便捷方法：用户限流（从配置读取阈值，默认60次/分钟）
 */
export async function checkUserRateLimit(userId: string, route: string): Promise<string | null> {
  const maxAttempts = await getUserRateLimit();
  return checkRateLimit(`user:${userId}:${route}`, maxAttempts, 60000);
}

// 定期清理过期条目（每5分钟），使用globalThis防止热重载时创建多个定时器
if (typeof setInterval !== 'undefined') {
  if (typeof globalThis.__rateLimitCleanupTimer !== 'undefined') {
    clearInterval(globalThis.__rateLimitCleanupTimer);
  }
  globalThis.__rateLimitCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (now >= entry.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (typeof globalThis.__rateLimitCleanupTimer === 'object' && 'unref' in globalThis.__rateLimitCleanupTimer) {
    globalThis.__rateLimitCleanupTimer.unref();
  }
}
