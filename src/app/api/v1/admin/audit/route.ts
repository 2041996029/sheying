import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { paginated, error, getRequestId, requireAdmin, getPagination } from '@/lib/response';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = getPagination(searchParams);
    const action = searchParams.get('action');

    const where: Record<string, unknown> = {};
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          admin: { select: { id: true, nickname: true, email: true } },
        },
      }),
      db.auditLog.count({ where }),
    ]);

    return paginated(logs, total, page, pageSize, requestId);
  } catch (err) {
    console.error('Audit logs list error:', err);
    return error(50001, '获取审计日志失败', requestId);
  }
}
