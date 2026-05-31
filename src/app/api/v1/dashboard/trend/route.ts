import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { getCache, setCache } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '7')));

    // 缓存趋势数据，300秒TTL — 历史数据不变，当天数据可能有延迟
    const cacheKey = `dashboard:trend:${days}`;
    const cached = await getCache<unknown>(cacheKey);
    if (cached) {
      return success(cached, 'ok', requestId);
    }

    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const stats = await db.dailyStat.findMany({
      where: { statDate: { in: dates } },
      orderBy: { statDate: 'asc' },
    });

    const statsMap = new Map(stats.map((s) => [s.statDate, s]));
    const trend = dates.map((date) => {
      const stat = statsMap.get(date);
      return {
        date,
        views: stat?.viewCount || 0,
        likes: stat?.likeCount || 0,
        favorites: stat?.favoriteCount || 0,
        comments: stat?.commentCount || 0,
        newWorks: stat?.newWorkCount || 0,
        newUsers: stat?.newUserCount || 0,
      };
    });

    // Cache for 300 seconds (5 minutes)
    await setCache(cacheKey, trend, 300);

    return success(trend, 'ok', requestId);
  } catch (err) {
    console.error('Dashboard trend error:', err);
    return error(50001, '获取趋势数据失败', requestId);
  }
}
