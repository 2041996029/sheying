import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId } from '@/lib/response';
import { getCache, setCache, clearCacheByPrefix } from '@/lib/cache';

// 强制动态渲染，不使用 Next.js 静态缓存
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    // 缓存60秒，避免频繁聚合查询
    const cacheKey = 'stats:public';
    const cached = await getCache<{
      workCount: number;
      categoryCount: number;
      totalViews: number;
      totalLikes: number;
      totalFavorites: number;
    }>(cacheKey);
    if (cached && typeof cached.workCount === 'number') {
      return success(cached, 'ok', requestId);
    }

    // 使用更健壮的查询方式，逐个查询并在部分失败时仍能返回结果
    const where = { deletedAt: null, status: 'published' as const };

    let workCount = 0;
    let categoryCount = 0;
    let totalViews = 0;
    let totalLikes = 0;
    let totalFavorites = 0;

    try {
      workCount = await db.work.count({ where });
    } catch (e) {
      console.error('[Stats] workCount查询失败:', e);
    }

    try {
      categoryCount = await db.category.count({ where: { deletedAt: null } });
    } catch (e) {
      console.error('[Stats] categoryCount查询失败:', e);
    }

    try {
      const viewsResult = await db.work.aggregate({ _sum: { viewCount: true }, where });
      totalViews = viewsResult._sum.viewCount || 0;
    } catch (e) {
      console.error('[Stats] totalViews查询失败:', e);
    }

    try {
      const likesResult = await db.work.aggregate({ _sum: { likeCount: true }, where });
      const rawLikes = likesResult._sum.likeCount || 0;
      // 自愈：如果聚合结果为负，说明数据库有脏数据，自动修正
      if (rawLikes < 0) {
        console.warn('[Stats] 检测到总喜欢数为负数:', rawLikes, '，正在修正数据库...');
        db.work.updateMany({ where: { likeCount: { lt: 0 } }, data: { likeCount: 0 } })
          .then(r => console.log('[Stats] 已修正 likeCount<0 的作品:', r.count, '条'))
          .catch(() => {});
      }
      totalLikes = Math.max(0, rawLikes);
    } catch (e) {
      console.error('[Stats] totalLikes查询失败:', e);
    }

    try {
      const favoritesResult = await db.work.aggregate({ _sum: { favoriteCount: true }, where });
      const rawFavorites = favoritesResult._sum.favoriteCount || 0;
      // 自愈：如果聚合结果为负，说明数据库有脏数据，自动修正
      if (rawFavorites < 0) {
        console.warn('[Stats] 检测到总收藏数为负数:', rawFavorites, '，正在修正数据库...');
        db.work.updateMany({ where: { favoriteCount: { lt: 0 } }, data: { favoriteCount: 0 } })
          .then(r => console.log('[Stats] 已修正 favoriteCount<0 的作品:', r.count, '条'))
          .catch(() => {});
      }
      totalFavorites = Math.max(0, rawFavorites);
    } catch (e) {
      console.error('[Stats] totalFavorites查询失败:', e);
    }

    const result = {
      workCount,
      categoryCount,
      totalViews,
      totalLikes,
      totalFavorites,
    };

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Stats] 统计结果:', JSON.stringify(result));
    }

    await setCache(cacheKey, result, 120);

    return success(result, 'ok', requestId);
  } catch (err) {
    console.error('[Stats] Public stats error:', err);
    // 清除可能损坏的缓存
    await clearCacheByPrefix('stats:').catch(() => {});
    return error(50001, '获取统计数据失败', requestId);
  }
}
