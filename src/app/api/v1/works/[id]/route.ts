import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, getAuthUser } from '@/lib/response';
import { getCache, setCache, deleteCache } from '@/lib/cache';
import { incrementDailyStat } from '@/lib/daily-stats';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  try {
    const { id } = await params;

    const cacheKey = `works:detail:${id}`;
    const cached = await getCache<unknown>(cacheKey);
    if (cached) {
      // Increment view count in background
      incrementViewCount(id, request);
      return success(cached, 'ok', requestId);
    }

    const work = await db.work.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        aiTags: {
          where: { auditStatus: 'approved' },
          select: { id: true, tagName: true, confidence: true },
        },
      },
    });

    if (!work) {
      return error(40401, '作品不存在', requestId);
    }

    const result = {
      id: work.id,
      title: work.title,
      description: work.description,
      images: work.images ? JSON.parse(work.images) : [],
      coverUrl: work.coverUrl,
      categoryId: work.categoryId,
      category: work.category,
      tags: work.tags ? JSON.parse(work.tags) : [],
      params: work.params ? JSON.parse(work.params) : null,
      location: work.location,
      latitude: work.latitude,
      longitude: work.longitude,
      isFeatured: work.isFeatured,
      status: work.status,
      likeCount: work.likeCount,
      favoriteCount: work.favoriteCount,
      viewCount: work.viewCount,
      commentCount: work.commentCount,
      aiTags: work.aiTags,
      createdAt: work.createdAt,
      updatedAt: work.updatedAt,
    };

    // Cache for 60 seconds
    await setCache(cacheKey, result, 60);

    // Increment view count
    incrementViewCount(id, request);

    return success(result, 'ok', requestId);
  } catch (err) {
    console.error('Work detail error:', err);
    return error(50001, '获取作品详情失败', requestId);
  }
}

async function incrementViewCount(workId: string, request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    await db.$transaction([
      db.work.update({
        where: { id: workId },
        data: { viewCount: { increment: 1 } },
      }),
      db.viewLog.create({
        data: {
          workId,
          userId: auth?.userId || null,
          source: 'pc',
        },
      }),
    ]);

    // Also record browse history if user is logged in
    if (auth?.userId) {
      await db.browseHistory.upsert({
        where: {
          userId_workId: {
            userId: auth.userId,
            workId,
          },
        },
        create: {
          userId: auth.userId,
          workId,
        },
        update: {
          viewedAt: new Date(),
        },
      }).catch(() => null);
    }

    // 仅删除当前作品的详情缓存，让自然TTL过期来刷新列表和统计
    // 不再使用 clearCacheByPrefix('works:') 避免浏览量导致全部缓存失效
    await deleteCache(`works:detail:${workId}`);

    // 同步更新每日统计
    incrementDailyStat('viewCount');
  } catch {
    // Non-critical, don't fail the request
  }
}
