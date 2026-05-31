import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { paginated, success, error, getRequestId, requireAdmin, getPagination } from '@/lib/response';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = getPagination(searchParams);

    // Filters
    const statusCode = searchParams.get('status_code');
    const apiPath = searchParams.get('api_path');
    const method = searchParams.get('method');

    const where: Record<string, unknown> = {};

    if (statusCode) {
      where.statusCode = parseInt(statusCode);
    }
    if (apiPath) {
      where.apiPath = { contains: apiPath };
    }
    if (method) {
      where.method = method.toUpperCase();
    }

    const [errors, total] = await Promise.all([
      db.apiError.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      db.apiError.count({ where }),
    ]);

    return paginated(errors, total, page, pageSize, requestId);
  } catch (err) {
    console.error('Monitor API errors error:', err);
    return error(50001, '获取接口错误列表失败', requestId);
  }
}

// Delete old errors (cleanup)
export async function DELETE(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await db.apiError.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });

    return success(result, `已清理 ${result.count} 条 ${days} 天前的错误记录`, requestId);
  } catch (err) {
    console.error('Delete API errors error:', err);
    return error(50001, '清理错误记录失败', requestId);
  }
}
