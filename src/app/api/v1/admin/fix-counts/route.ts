import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, getAuthUser } from '@/lib/response';
import { clearCacheByPrefix, deleteCache } from '@/lib/cache';

/**
 * 修复 likeCount/favoriteCount 为负数的作品记录
 * 根据 Like/Favorite 表的真实行数重新计算
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const auth = getAuthUser(request);
    if (!auth || auth.role !== 'admin') {
      return error(40301, '需要管理员权限', requestId);
    }

    const results: { workId: string; field: string; oldValue: number; newValue: number }[] = [];

    // 查找所有 likeCount < 0 或 favoriteCount < 0 的作品
    const brokenWorks = await db.work.findMany({
      where: {
        OR: [
          { likeCount: { lt: 0 } },
          { favoriteCount: { lt: 0 } },
        ],
      },
      select: { id: true, likeCount: true, favoriteCount: true },
    });

    for (const work of brokenWorks) {
      // 根据 Like 表真实行数重新计算
      const realLikeCount = await db.like.count({ where: { workId: work.id } });
      const realFavCount = await db.favorite.count({ where: { workId: work.id } });

      if (work.likeCount < 0) {
        results.push({ workId: work.id, field: 'likeCount', oldValue: work.likeCount, newValue: realLikeCount });
      }
      if (work.favoriteCount < 0) {
        results.push({ workId: work.id, field: 'favoriteCount', oldValue: work.favoriteCount, newValue: realFavCount });
      }

      await db.work.update({
        where: { id: work.id },
        data: {
          likeCount: realLikeCount,
          favoriteCount: realFavCount,
        },
      });

      // 清除该作品缓存
      await deleteCache(`works:detail:${work.id}`);
    }

    // 同时修复所有作品的 likeCount/favoriteCount 与真实行数不一致的情况（全量校验）
    // 获取所有作品
    const allWorks = await db.work.findMany({
      where: { deletedAt: null },
      select: { id: true, likeCount: true, favoriteCount: true },
    });

    let fixedCount = brokenWorks.length;

    for (const work of allWorks) {
      const realLikeCount = await db.like.count({ where: { workId: work.id } });
      const realFavCount = await db.favorite.count({ where: { workId: work.id } });

      if (work.likeCount !== realLikeCount || work.favoriteCount !== realFavCount) {
        if (!results.find(r => r.workId === work.id)) {
          if (work.likeCount !== realLikeCount) {
            results.push({ workId: work.id, field: 'likeCount', oldValue: work.likeCount, newValue: realLikeCount });
          }
          if (work.favoriteCount !== realFavCount) {
            results.push({ workId: work.id, field: 'favoriteCount', oldValue: work.favoriteCount, newValue: realFavCount });
          }
        }

        await db.work.update({
          where: { id: work.id },
          data: {
            likeCount: realLikeCount,
            favoriteCount: realFavCount,
          },
        });

        await deleteCache(`works:detail:${work.id}`);
        fixedCount++;
      }
    }

    // 清除统计缓存
    await clearCacheByPrefix('stats:');

    return success({
      fixedCount,
      details: results,
    }, `已修复 ${fixedCount} 条作品计数`, requestId);
  } catch (err) {
    console.error('Fix counts error:', err);
    return error(50001, '修复失败', requestId);
  }
}
