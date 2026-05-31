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

    // Upsert like (idempotent)
    const existing = await db.like.findUnique({
      where: { workId_userId: { workId: id, userId: auth.userId } },
    });

    if (existing) {
      return success({ liked: true }, '已点赞', requestId);
    }

    await db.$transaction([
      db.like.create({
        data: {
          workId: id,
          userId: auth.userId,
          source: 'pc',
        },
      }),
      db.work.update({
        where: { id },
        data: { likeCount: { increment: 1 } },
      }),
    ]);

    // 读取真实计数返回给前端
    const updatedWork = await db.work.findUnique({ where: { id }, select: { likeCount: true } });

    // 精确失效：仅删除该作品详情缓存和统计缓存，不清空整个works命名空间
    await deleteCache(`works:detail:${id}`);
    await clearCacheByPrefix('stats:');

    // 同步更新每日统计
    incrementDailyStat('likeCount');

    return success({ liked: true, likeCount: updatedWork?.likeCount ?? 1 }, '点赞成功', requestId);
  } catch (err) {
    console.error('Like error:', err);
    return error(50001, '点赞失败', requestId);
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

    const existing = await db.like.findUnique({
      where: { workId_userId: { workId: id, userId: auth.userId } },
    });

    if (!existing) {
      return success({ liked: false }, '未点赞', requestId);
    }

    await db.$transaction([
      db.like.delete({
        where: { workId_userId: { workId: id, userId: auth.userId } },
      }),
      db.work.update({
        where: { id },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);

    // 读取真实计数，确保不会出现负数
    const updatedWork = await db.work.findUnique({ where: { id }, select: { likeCount: true } });
    if (updatedWork && updatedWork.likeCount < 0) {
      await db.work.update({ where: { id }, data: { likeCount: 0 } });
    }
    const realCount = Math.max(0, updatedWork?.likeCount ?? 0);

    // 精确失效：仅删除该作品详情缓存和统计缓存
    await deleteCache(`works:detail:${id}`);
    await clearCacheByPrefix('stats:');

    // 同步更新每日统计
    incrementDailyStat('likeCount', -1);

    return success({ liked: false, likeCount: realCount }, '已取消点赞', requestId);
  } catch (err) {
    console.error('Unlike error:', err);
    return error(50001, '取消点赞失败', requestId);
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
      return success({ liked: false }, 'ok', requestId);
    }

    const { id } = await params;
    const existing = await db.like.findUnique({
      where: { workId_userId: { workId: id, userId: auth.userId } },
    });

    return success({ liked: !!existing }, 'ok', requestId);
  } catch (err) {
    console.error('Check like error:', err);
    return error(50001, '查询失败', requestId);
  }
}
