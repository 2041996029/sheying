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
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const by = searchParams.get('by') || 'views';

    // 缓存热门作品，300秒TTL
    const cacheKey = `dashboard:top-works:${by}:${limit}`;
    const cached = await getCache<unknown[]>(cacheKey);
    if (cached) {
      return success(cached, 'ok', requestId);
    }

    let orderBy: Record<string, string> = {};
    if (by === 'likes') orderBy = { likeCount: 'desc' };
    else if (by === 'favorites') orderBy = { favoriteCount: 'desc' };
    else orderBy = { viewCount: 'desc' };

    const works = await db.work.findMany({
      where: { deletedAt: null, status: 'published' },
      orderBy,
      take: limit,
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    const list = works.map((w) => ({
      id: w.id,
      title: w.title,
      coverUrl: w.coverUrl,
      category: w.category,
      likeCount: w.likeCount,
      favoriteCount: w.favoriteCount,
      viewCount: w.viewCount,
      commentCount: w.commentCount,
    }));

    // Cache for 300 seconds (5 minutes)
    await setCache(cacheKey, list, 300);

    return success(list, 'ok', requestId);
  } catch (err) {
    console.error('Top works error:', err);
    return error(50001, '获取热门作品失败', requestId);
  }
}
