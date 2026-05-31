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
    const status = searchParams.get('status');

    const where = status ? { analysisStatus: status } : {};

    const [list, total] = await Promise.all([
      db.aiErrorAnalysis.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      db.aiErrorAnalysis.count({ where }),
    ]);

    return paginated(list, total, page, pageSize, requestId);
  } catch (err) {
    console.error('AI error analyses list error:', err);
    return error(50001, '获取AI错误分析列表失败', requestId);
  }
}
