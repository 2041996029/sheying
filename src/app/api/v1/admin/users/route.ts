import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin, getPagination, paginated } from '@/lib/response';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = getPagination(searchParams);
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { nickname: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { openid: { contains: search } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          email: true,
          phone: true,
          nickname: true,
          avatarUrl: true,
          openid: true,
          unionid: true,
          role: true,
          status: true,
          bio: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              likes: true,
              favorites: true,
              comments: true,
            },
          },
        },
      }),
      db.user.count({ where }),
    ]);

    return paginated(users, total, page, pageSize, requestId);
  } catch (err) {
    console.error('Users list error:', err);
    return error(50001, '获取用户列表失败', requestId);
  }
}
