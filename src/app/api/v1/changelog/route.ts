import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, getPagination } from '@/lib/response';
import { getCache, setCache } from '@/lib/cache';

// GET /api/v1/changelog - 获取已发布的版本更新记录（公开）
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    // 缓存版本记录，3600秒（1小时）TTL — 版本更新很不频繁
    const cacheKey = `changelog:public:${limit}`;
    const cached = await getCache<unknown[]>(cacheKey);
    if (cached) {
      return success(cached, 'ok', requestId);
    }

    const logs = await db.versionLog.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: 'desc' }, { publishedAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        version: true,
        title: true,
        content: true,
        type: true,
        publishedAt: true,
        createdAt: true,
      },
    });

    // Cache for 3600 seconds (1 hour)
    await setCache(cacheKey, logs, 3600);

    return success(logs, 'ok', requestId);
  } catch (err) {
    console.error('Public changelog list error:', err);
    return error(50001, '获取版本记录失败', requestId);
  }
}
