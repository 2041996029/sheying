import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { paginated, error, getRequestId, getPagination } from '@/lib/response';
import { getCache, setCache } from '@/lib/cache';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = getPagination(searchParams);
    const tag = searchParams.get('tag') || '';

    if (!tag) {
      return paginated([], 0, page, pageSize, requestId);
    }

    // 缓存标签查询结果，60秒TTL
    const cacheKey = `works:by-tag:${tag}:${page}:${pageSize}`;
    const cached = await getCache<{ list: unknown[]; total: number }>(cacheKey);
    if (cached) {
      return paginated(cached.list, cached.total, page, pageSize, requestId);
    }

    // 使用 Prisma 支持的 contains 过滤器匹配 JSON 数组中的标签
    // Prisma MySQL 对 String? 字段使用 StringNullableFilter，支持 contains 但不支持 string_contains
    const where: Prisma.WorkWhereInput = {
      deletedAt: null,
      status: 'published',
      tags: { contains: `"${tag}"` },
    };

    const [works, total] = await Promise.all([
      db.work.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true } },
        },
      }),
      db.work.count({ where }),
    ]);

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

    // Cache for 60 seconds
    await setCache(cacheKey, { list, total }, 60);

    return paginated(list, total, page, pageSize, requestId);
  } catch (err) {
    console.error('Works by tag error:', err);
    return error(50001, '获取标签作品失败', requestId);
  }
}
