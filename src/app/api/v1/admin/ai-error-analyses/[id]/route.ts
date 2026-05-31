import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { id } = await params;
    const item = await db.aiErrorAnalysis.findUnique({ where: { id } });
    if (!item) return error(40401, '记录不存在', requestId);
    return success(item, 'ok', requestId);
  } catch (err) {
    console.error('AI error analysis detail error:', err);
    return error(50001, '获取AI错误分析详情失败', requestId);
  }
}
