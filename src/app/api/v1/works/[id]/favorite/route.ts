import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, getAuthUser } from '@/lib/response';
import { clearCacheByPrefix, deleteCache } from '@/lib/cache';
import { incrementDailyStat } from '@/lib/daily-stats';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return error(40101, '未登录或Token无效', requestId);
    }

    const { id } = await params;

    // Check work exists
    const work = await db.work.findFirst({ where: { id, deletedAt: null } });
    if (!work) {
      return error(40401, '作品不存在', requestId);
    }

    // Upsert favorite (idempotent)
    const existing = await db.favorite.findUnique({
      where: { workId_userId: { workId: id, userId: auth.userId } },
    });

    if (existing) {
      return success({ favorited: true }, '已收藏', requestId);
    }

    await db.$transaction([
      db.favorite.create({
        data: {
          workId: id,
          userId: auth.userId,
        },
      }),
      db.work.update({
        where: { id },
        data: { favoriteCount: { increment: 1 } },
      }),
    ]);

    // 读取真实计数返回给前端
    const updatedWork = await db.work.findUnique({ where: { id }, select: { favoriteCount: true } });

    // 精确失效：仅删除该作品详情缓存和统计缓存，不清空整个works命名空间
    await deleteCache(`works:detail:${id}`);
    await clearCacheByPrefix('stats:');

    // 同步更新每日统计
    incrementDailyStat('favoriteCount');

    return success({ favorited: true, favoriteCount: updatedWork?.favoriteCount ?? 1 }, '收藏成功', requestId);
  } catch (err) {
    console.error('Favorite error:', err);
    return error(50001, '收藏失败', requestId);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return error(40101, '未登录或Token无效', requestId);
    }

    const { id } = await params;

    const existing = await db.favorite.findUnique({
      where: { workId_userId: { workId: id, userId: auth.userId } },
    });

    if (!existing) {
      return success({ favorited: false }, '未收藏', requestId);
    }

    await db.$transaction([
      db.favorite.delete({
        where: { workId_userId: { workId: id, userId: auth.userId } },
      }),
      db.work.update({
        where: { id },
        data: { favoriteCount: { decrement: 1 } },
      }),
    ]);

    // 读取真实计数，确保不会出现负数
    const updatedWork = await db.work.findUnique({ where: { id }, select: { favoriteCount: true } });
    if (updatedWork && updatedWork.favoriteCount < 0) {
      await db.work.update({ where: { id }, data: { favoriteCount: 0 } });
    }
    const realCount = Math.max(0, updatedWork?.favoriteCount ?? 0);

    // 精确失效：仅删除该作品详情缓存和统计缓存
    await deleteCache(`works:detail:${id}`);
    await clearCacheByPrefix('stats:');

    // 同步更新每日统计
    incrementDailyStat('favoriteCount', -1);

    return success({ favorited: false, favoriteCount: realCount }, '已取消收藏', requestId);
  } catch (err) {
    console.error('Unfavorite error:', err);
    return error(50001, '取消收藏失败', requestId);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return success({ favorited: false }, 'ok', requestId);
    }

    const { id } = await params;
    const existing = await db.favorite.findUnique({
      where: { workId_userId: { workId: id, userId: auth.userId } },
    });

    return success({ favorited: !!existing }, 'ok', requestId);
  } catch (err) {
    console.error('Check favorite error:', err);
    return error(50001, '查询失败', requestId);
  }
}
