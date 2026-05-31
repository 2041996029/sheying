import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, paginated, error, getRequestId, getPagination, recordApiError } from '@/lib/response';
import { getCache, setCache } from '@/lib/cache';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = getPagination(searchParams);
    const categoryId = searchParams.get('category_id');
    const tag = searchParams.get('tag');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'latest';

    // Build cache key — 搜索词不作为列表缓存键，避免Redis内存膨胀
    // 搜索请求使用独立短TTL缓存
    let cacheKey: string;
    let cacheTtl: number;
    if (search) {
      const normalizedSearch = search.trim().toLowerCase();
      cacheKey = `works:search:${categoryId || ''}:${normalizedSearch}:${sort}:${page}:${pageSize}`;
      cacheTtl = 10; // 搜索缓存10秒
    } else {
      cacheKey = `works:list:${categoryId || ''}:${tag || ''}:${sort}:${page}:${pageSize}`;
      cacheTtl = 60; // 列表缓存60秒
    }
    const cached = await getCache<{ list: unknown[]; total: number }>(cacheKey);
    if (cached) {
      return paginated(cached.list, cached.total, page, pageSize, requestId);
    }

    const where: Prisma.WorkWhereInput = {
      deletedAt: null,
      status: 'published',
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (tag) {
      // 使用 contains 精确匹配 JSON 数组字符串中的标签元素
      // tags 字段存储的是 JSON 数组字符串如 '["风光","日出"]'
      // 通过搜索 '"风光"' 格式避免子串误匹配
      where.tags = { contains: `"${tag}"` };
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const orderBy: Prisma.WorkOrderByWithRelationInput = {};
    if (sort === 'featured') {
      orderBy.isFeatured = 'desc';
      orderBy.createdAt = 'desc';
    } else if (sort === 'popular') {
      orderBy.viewCount = 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [works, total] = await Promise.all([
      db.work.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true } },
          _count: { select: { likes: true, favorites: true } },
        },
      }),
      db.work.count({ where }),
    ]);

    const list = works.map((w) => ({
      id: w.id,
      title: w.title,
      description: w.description,
      images: w.images,
      coverUrl: w.coverUrl,
      categoryId: w.categoryId,
      category: w.category,
      tags: w.tags ? JSON.parse(w.tags) : [],
      isFeatured: w.isFeatured,
      likeCount: w.likeCount,
      favoriteCount: w.favoriteCount,
      viewCount: w.viewCount,
      commentCount: w.commentCount,
      createdAt: w.createdAt,
    }));

    // Cache with appropriate TTL
    await setCache(cacheKey, { list, total }, cacheTtl);

    return paginated(list, total, page, pageSize, requestId);
  } catch (err) {
    console.error('Works list error:', err);
    recordApiError({ request, statusCode: 500, errorMessage: String(err), startTime });
    return error(50001, '获取作品列表失败', requestId);
  }
}
