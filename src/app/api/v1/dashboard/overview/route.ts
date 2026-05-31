import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { getCache, setCache } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    // 缓存概览数据，30秒TTL — 8个并行查询比较重，短TTL保证数据接近实时
    const cacheKey = 'dashboard:overview';
    const cached = await getCache<unknown>(cacheKey);
    if (cached) {
      return success(cached, 'ok', requestId);
    }

    const today = new Date().toISOString().split('T')[0];

    const [
      totalWorks,
      totalUsers,
      totalViews,
      totalLikes,
      totalComments,
      todayStat,
      publishedWorks,
      latestVersion,
    ] = await Promise.all([
      db.work.count({ where: { deletedAt: null } }),
      db.user.count({ where: { deletedAt: null, status: 'active' } }),
      db.work.aggregate({ _sum: { viewCount: true }, where: { deletedAt: null } }),
      db.work.aggregate({ _sum: { likeCount: true }, where: { deletedAt: null } }),
      db.comment.count({ where: { deletedAt: null } }),
      db.dailyStat.findUnique({ where: { statDate: today } }),
      db.work.count({ where: { deletedAt: null, status: 'published' } }),
      db.versionLog.findFirst({
        where: { isPublished: true },
        orderBy: [{ sortOrder: 'desc' }, { publishedAt: 'desc' }],
        select: { version: true },
      }),
    ]);

    const result = {
      totalWorks,
      publishedWorks,
      totalUsers,
      totalViews: totalViews._sum.viewCount || 0,
      totalLikes: totalLikes._sum.likeCount || 0,
      totalComments,
      latestVersion: latestVersion?.version || null,
      today: {
        views: todayStat?.viewCount || 0,
        likes: todayStat?.likeCount || 0,
        favorites: todayStat?.favoriteCount || 0,
        comments: todayStat?.commentCount || 0,
        newWorks: todayStat?.newWorkCount || 0,
        newUsers: todayStat?.newUserCount || 0,
      },
    };

    // Cache for 30 seconds
    await setCache(cacheKey, result, 30);

    return success(result, 'ok', requestId);
  } catch (err) {
    console.error('Dashboard overview error:', err);
    return error(50001, '获取概览数据失败', requestId);
  }
}
