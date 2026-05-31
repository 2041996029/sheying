import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId } from '@/lib/response';
import { getCache, setCache } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const cacheKey = 'works:featured';
    const cached = await getCache<unknown[]>(cacheKey);
    if (cached) {
      return success(cached, 'ok', requestId);
    }

    const works = await db.work.findMany({
      where: {
        deletedAt: null,
        status: 'published',
        isFeatured: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    const list = works.map((w) => ({
      id: w.id,
      title: w.title,
      description: w.description,
      coverUrl: w.coverUrl,
      images: w.images,
      categoryId: w.categoryId,
      category: w.category,
      tags: w.tags ? JSON.parse(w.tags) : [],
      likeCount: w.likeCount,
      favoriteCount: w.favoriteCount,
      viewCount: w.viewCount,
      createdAt: w.createdAt,
    }));

    // Cache for 300 seconds (5 minutes)
    await setCache(cacheKey, list, 300);

    return success(list, 'ok', requestId);
  } catch (err) {
    console.error('Featured works error:', err);
    return error(50001, '获取精选作品失败', requestId);
  }
}
