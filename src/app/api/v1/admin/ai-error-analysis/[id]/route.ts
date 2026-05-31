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

    const analysis = await db.aiErrorAnalysis.findUnique({
      where: { id },
    });

    if (!analysis) {
      return error(40401, '分析记录不存在', requestId);
    }

    return success(analysis, 'ok', requestId);
  } catch (err) {
    console.error('AI error analysis get error:', err);
    return error(50001, '获取AI错误分析详情失败', requestId);
  }
}
