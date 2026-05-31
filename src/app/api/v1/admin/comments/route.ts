import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { paginated, error, getRequestId, requireAdmin, getPagination, recordApiError } from '@/lib/response';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = getPagination(searchParams);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { content: { contains: search } },
        { guestName: { contains: search } },
        { guestEmail: { contains: search } },
      ];
    }

    const [comments, total] = await Promise.all([
      db.comment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: { select: { id: true, nickname: true, avatarUrl: true } },
          work: { select: { id: true, title: true } },
        },
      }),
      db.comment.count({ where }),
    ]);

    return paginated(comments, total, page, pageSize, requestId);
  } catch (err) {
    console.error('Admin comments list error:', err);
    recordApiError({ request, statusCode: 500, errorMessage: String(err), startTime });
    return error(50001, '获取评论列表失败', requestId);
  }
}
