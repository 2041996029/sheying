import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { callAiChat } from '@/lib/ai-tags';

export async function POST(
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

    // Update status to analyzing
    await db.aiErrorAnalysis.update({
      where: { id },
      data: { analysisStatus: 'pending' },
    });

    // Trigger async AI analysis in background
    triggerAnalysisAsync(id, item.errorType, item.errorMessage, item.errorStack, item.requestUrl).catch(() => {});

    const updated = await db.aiErrorAnalysis.findUnique({ where: { id } });
    return success(updated, 'AI分析已触发', requestId);
  } catch (err) {
    console.error('AI analysis trigger error:', err);
    return error(50001, '触发AI分析失败', requestId);
  }
}

async function triggerAnalysisAsync(
  id: string,
  errorType: string,
  errorMessage: string | null,
  errorStack: string | null,
  requestUrl: string | null
) {
  try {
    const prompt = `分析以下错误，给出可能的原因和解决方案：

错误类型: ${errorType}
错误消息: ${errorMessage || '未知'}
${errorStack ? `错误堆栈:\n${errorStack}` : ''}
${requestUrl ? `请求URL: ${requestUrl}` : ''}

请给出：
1. 错误原因分析
2. 可能的解决方案
3. 预防建议`;

    const analysisText = await callAiChat([
      { role: 'system', content: '你是一个专业的错误分析助手，擅长分析JavaScript/React/Next.js错误，给出详细的原因分析和解决方案。' },
      { role: 'user', content: prompt },
    ]);

    await db.aiErrorAnalysis.update({
      where: { id },
      data: {
        aiAnalysis: analysisText || 'AI分析未返回有效内容',
        analysisStatus: analysisText ? 'analyzed' : 'pending',
      },
    });
  } catch (aiErr) {
    console.error('AI analysis error:', aiErr);
    try {
      await db.aiErrorAnalysis.update({
        where: { id },
        data: {
          aiAnalysis: `AI分析失败: ${aiErr instanceof Error ? aiErr.message : '未知错误'}`,
          analysisStatus: 'pending',
        },
      });
    } catch {
      // ignore
    }
  }
}
