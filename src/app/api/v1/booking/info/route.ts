import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId } from '@/lib/response';
import { getCache, setCache } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const cacheKey = 'booking:info';
    const cached = await getCache<Record<string, string>>(cacheKey);
    if (cached) {
      return success(cached, 'ok', requestId);
    }

    const configs = await db.config.findMany({
      where: { group: 'booking' },
    });

    const result: Record<string, string> = {};
    for (const config of configs) {
      if (!config.isEncrypted) {
        result[config.key] = config.value;
      }
    }

    await setCache(cacheKey, result, 300);

    return success(result, 'ok', requestId);
  } catch (err) {
    console.error('Booking info error:', err);
    return error(50001, '获取约拍信息失败', requestId);
  }
}
