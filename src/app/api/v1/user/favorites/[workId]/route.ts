import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, getAuthUser } from '@/lib/response';
import { clearCacheByPrefix } from '@/lib/cache';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workId: string }> }
) {
  const requestId = getRequestId(request);
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return error(40101, '未登录或Token无效', requestId);
    }

    const { workId } = await params;

    const favorite = await db.favorite.findUnique({
      where: { workId_userId: { workId, userId: auth.userId } },
    });

    if (!favorite) {
      return error(40401, '收藏记录不存在', requestId);
    }

    await db.favorite.delete({
      where: { id: favorite.id },
    });

    await db.work.update({
      where: { id: workId },
      data: { favoriteCount: { decrement: 1 } },
    }).catch(() => null);

    await clearCacheByPrefix('works:');

    return success(null, '取消收藏成功', requestId);
  } catch (err) {
    console.error('Remove favorite error:', err);
    return error(50001, '取消收藏失败', requestId);
  }
}
