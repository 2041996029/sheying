import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId } from '@/lib/response';
import { getCache, setCache } from '@/lib/cache';
import { batchGetHotWorkCovers } from '@/lib/category-utils';

interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  coverUrl: string | null;
  autoCover: boolean;
  sortOrder: number;
  level: number;
  workCount: number;
  children: CategoryNode[];
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const cacheKey = 'categories:tree';
    const cached = await getCache<CategoryNode[]>(cacheKey);
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

    // 收集需要自动封面的分类ID，批量查询（1次查询替代N次）
    const needAutoCoverIds = categories
      .filter(c => !c.coverUrl && c._count.works > 0)
      .map(c => c.id);
    const coverMap = await batchGetHotWorkCovers(needAutoCoverIds);

    const nodes: Map<string, CategoryNode> = new Map();
    categories.forEach((c) => {
      const autoCoverUrl = coverMap.get(c.id) || null;
      const coverUrl = c.coverUrl || autoCoverUrl;
      nodes.set(c.id, {
        id: c.id,
        name: c.name,
        parentId: c.parentId,
        coverUrl,
        autoCover: !c.coverUrl && !!autoCoverUrl,
        sortOrder: c.sortOrder,
        level: c.level,
        workCount: c._count.works,
        children: [],
      });
    });

    const tree: CategoryNode[] = [];
    nodes.forEach((node) => {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId)!.children.push(node);
      } else {
        tree.push(node);
      }
    });

    await setCache(cacheKey, tree, 600);

    return success(tree, 'ok', requestId);
  } catch (err) {
    console.error('Categories tree error:', err);
    return error(50001, '获取分类树失败', requestId);
  }
}
