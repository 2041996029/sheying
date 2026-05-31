import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { paginated, error, getRequestId, requireAdmin, getPagination } from '@/lib/response';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;
  const admin = adminResult;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = getPagination(searchParams);

    const [errors, total] = await Promise.all([
      db.frontendError.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      db.frontendError.count(),
    ]);

    return paginated(errors, total, page, pageSize, requestId);
  } catch (err) {
    console.error('Monitor errors error:', err);
    return error(50001, '获取错误列表失败', requestId);
  }
}
