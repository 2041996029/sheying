import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { paginated, error, success, getRequestId, getAuthUser, getPagination } from '@/lib/response';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return error(40101, '未登录或Token无效', requestId);
    }

    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = getPagination(searchParams);

    const workFilter = { deletedAt: null, status: 'published' };

    const [histories, total] = await Promise.all([
      db.browseHistory.findMany({
        where: { userId: auth.userId, work: workFilter },
        orderBy: { viewedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          work: {
            select: {
              id: true,
              title: true,
              coverUrl: true,
              images: true,
              likeCount: true,
              viewCount: true,
            },
          },
        },
      }),
      db.browseHistory.count({ where: { userId: auth.userId, work: workFilter } }),
    ]);

    const list = histories.map((h) => {
      const work = h.work as Record<string, unknown>;
      // 解析images JSON，如果没有coverUrl则使用第一张图片
      let coverUrl = work.coverUrl as string | null;
      if (!coverUrl && work.images) {
        try {
          const images = JSON.parse(work.images as string);
          if (Array.isArray(images) && images.length > 0) {
            coverUrl = images[0] as string;
          }
        } catch { /* ignore */ }
      }
      return {
        id: h.id,
        workId: h.workId,
        work: {
          ...work,
          coverUrl,
        },
        viewedAt: h.viewedAt,
      };
    });

    return paginated(list, total, page, pageSize, requestId);
  } catch (err) {
    console.error('Browse history error:', err);
    return error(50001, '获取浏览历史失败', requestId);
  }
}

export async function DELETE(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return error(40101, '未登录或Token无效', requestId);
    }

    await db.browseHistory.deleteMany({
      where: { userId: auth.userId },
    });

    return success(null, '浏览历史已清空', requestId);
  } catch (err) {
    console.error('Clear browse history error:', err);
    return error(50001, '清空浏览历史失败', requestId);
  }
}
