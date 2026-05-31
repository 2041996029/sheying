import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId } from '@/lib/response';
import { getCache, setCache } from '@/lib/cache';
import { batchGetHotWorkCovers } from '@/lib/category-utils';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const cacheKey = 'categories:list';
    const cached = await getCache<unknown[]>(cacheKey);
    if (cached) {
      return success(cached, 'ok', requestId);
    }

    const categories = await db.category.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { works: { where: { deletedAt: null, status: 'published' } } } },
      },
    });

    // 收集需要自动封面的分类ID
    const needAutoCoverIds = categories
      .filter(c => !c.coverUrl && c._count.works > 0)
      .map(c => c.id);

    // 批量查询所有热门封面（1次查询替代N次查询）
    const coverMap = await batchGetHotWorkCovers(needAutoCoverIds);

    const list = categories.map((c) => {
      const coverUrl = c.coverUrl || coverMap.get(c.id) || null;
      return {
        id: c.id,
        name: c.name,
        parentId: c.parentId,
        coverUrl,
        autoCover: !c.coverUrl && !!coverUrl,
        sortOrder: c.sortOrder,
        level: c.level,
        workCount: c._count.works,
      };
    });

    await setCache(cacheKey, list, 600);

    return success(list, 'ok', requestId);
  } catch (err) {
    console.error('Categories list error:', err);
    return error(50001, '获取分类列表失败', requestId);
  }
}
