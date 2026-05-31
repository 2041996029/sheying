// 分类辅助工具 — 提取公共的 batchGetHotWorkCovers 函数
// 解决 categories/route.ts 和 categories/tree/route.ts 中的代码重复

import { db } from '@/lib/db';

/**
 * 批量查询分类下热门作品封面（解决N+1问题）
 * 一次查询获取所有需要自动封面的分类的热门作品
 */
export async function batchGetHotWorkCovers(categoryIds: string[]): Promise<Map<string, string>> {
  const coverMap = new Map<string, string>();

  if (categoryIds.length === 0) return coverMap;

  // 一次查询获取所有分类的 Top 5 热门作品
  const topWorks = await db.work.findMany({
    where: {
      categoryId: { in: categoryIds },
      status: 'published',
      deletedAt: null,
      coverUrl: { not: null },
    },
    select: {
      id: true,
      categoryId: true,
      coverUrl: true,
      viewCount: true,
      likeCount: true,
      favoriteCount: true,
    },
    orderBy: [
      { favoriteCount: 'desc' },
      { likeCount: 'desc' },
      { viewCount: 'desc' },
    ],
    take: categoryIds.length * 5, // 每个分类取5个候选
  });

  // 按 categoryId 分组
  const worksByCategory = new Map<string, typeof topWorks>();
  for (const work of topWorks) {
    if (!work.categoryId) continue;
    const list = worksByCategory.get(work.categoryId) || [];
    list.push(work);
    worksByCategory.set(work.categoryId, list);
  }

  // 为每个分类选择封面
  for (const categoryId of categoryIds) {
    const candidates = worksByCategory.get(categoryId) || [];
    if (candidates.length === 0) continue;

    // 加权排序
    const scored = candidates.map((w) => ({
      coverUrl: w.coverUrl!,
      score: (w.viewCount || 0) * 1 + (w.likeCount || 0) * 5 + (w.favoriteCount || 0) * 10,
    }));
    scored.sort((a, b) => b.score - a.score);

    // 随机选一张：前 60% 概率选 Top1，剩余随机
    const rand = Math.random();
    if (rand < 0.6 || scored.length === 1) {
      coverMap.set(categoryId, scored[0].coverUrl);
    } else {
      const idx = Math.floor(Math.random() * scored.length);
      coverMap.set(categoryId, scored[idx].coverUrl);
    }
  }

  return coverMap;
}
