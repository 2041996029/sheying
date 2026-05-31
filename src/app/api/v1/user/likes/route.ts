import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { paginated, error, getRequestId, getAuthUser, getPagination } from '@/lib/response';

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

    const [likes, total] = await Promise.all([
      db.like.findMany({
        where: { userId: auth.userId, work: workFilter },
        orderBy: { createdAt: 'desc' },
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
      db.like.count({ where: { userId: auth.userId, work: workFilter } }),
    ]);

    const list = likes.map((l) => {
      const work = l.work as Record<string, unknown>;
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
        id: l.id,
        workId: l.workId,
        work: {
          ...work,
          coverUrl,
        },
        createdAt: l.createdAt,
      };
    });

    return paginated(list, total, page, pageSize, requestId);
  } catch (err) {
    console.error('Likes list error:', err);
    return error(50001, '获取点赞列表失败', requestId);
  }
}
