import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { analysis_status } = body;

    if (!analysis_status || !['pending', 'analyzed', 'resolved'].includes(analysis_status)) {
      return error(40001, '无效的分析状态', requestId);
    }

    const item = await db.aiErrorAnalysis.findUnique({ where: { id } });
    if (!item) return error(40401, '记录不存在', requestId);

    const updated = await db.aiErrorAnalysis.update({
      where: { id },
      data: { analysisStatus: analysis_status },
    });

    return success(updated, 'ok', requestId);
  } catch (err) {
    console.error('AI error analysis status update error:', err);
    return error(50001, '更新状态失败', requestId);
  }
}
