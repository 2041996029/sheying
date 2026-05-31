import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { paginated, error, getRequestId, getPagination } from '@/lib/response';
import { getCache, setCache } from '@/lib/cache';
import type { Prisma } from '@prisma/client';
import type { SortValue } from '@/lib/types/search';

const SORT_MAP: Record<SortValue, Prisma.WorkOrderByWithRelationInput> = {
  latest: { createdAt: 'desc' },
  popular: { viewCount: 'desc' },
  most_liked: { likeCount: 'desc' },
};

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = getPagination(searchParams);
    const q = searchParams.get('q') || '';
    const categoryId = searchParams.get('category_id') || undefined;
    const sortParam = searchParams.get('sort') || 'latest';
    const sort: SortValue = sortParam in SORT_MAP ? (sortParam as SortValue) : 'latest';

    if (!q) {
      return paginated([], 0, page, pageSize, requestId);
    }

    const cacheKey = `works:search:${q}:${categoryId || 'all'}:${sort}:${page}:${pageSize}`;
    const cached = await getCache<{ list: unknown[]; total: number }>(cacheKey);
    if (cached) {
      return paginated(cached.list, cached.total, page, pageSize, requestId);
    }

    const where: Prisma.WorkWhereInput = {
      deletedAt: null,
      status: 'published',
      ...(categoryId ? { categoryId } : {}),
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
      ],
    };

    const orderBy = SORT_MAP[sort];

    const [works, total] = await Promise.all([
      db.work.findMany({
        where,
        orderBy,
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

    await setCache(cacheKey, { list, total }, 60);

    return paginated(list, total, page, pageSize, requestId);
  } catch (err) {
    console.error('Search works error:', err);
    return error(50001, '搜索作品失败', requestId);
  }
}
