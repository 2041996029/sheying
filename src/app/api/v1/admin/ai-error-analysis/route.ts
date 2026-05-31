import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin, getPagination, paginated } from '@/lib/response';
import { callAiChat } from '@/lib/ai-tags';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = getPagination(searchParams);
    const status = searchParams.get('status');
    const errorType = searchParams.get('error_type');

    const where: Record<string, unknown> = {};
    if (status) where.analysisStatus = status;
    if (errorType) where.errorType = errorType;

    const [analyses, total] = await Promise.all([
      db.aiErrorAnalysis.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      db.aiErrorAnalysis.count({ where }),
    ]);

    return paginated(analyses, total, page, pageSize, requestId);
  } catch (err) {
    console.error('AI error analysis list error:', err);
    return error(50001, '获取AI错误分析列表失败', requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const body = await request.json();
    const { error_message, error_stack, request_url, error_type, context } = body;

    if (!error_message) {
      return error(40001, 'error_message不能为空', requestId);
    }

    // Create the analysis record as pending
    const analysis = await db.aiErrorAnalysis.create({
      data: {
        errorType: error_type || 'unknown',
        errorMessage: error_message,
        errorStack: error_stack || null,
        requestUrl: request_url || null,
        context: context ? JSON.stringify(context) : null,
        analysisStatus: 'pending',
        aiAnalysis: null,
      },
    });

    // Try to perform AI analysis
    try {
      const prompt = `分析以下错误，给出可能的原因和解决方案：

错误类型: ${error_type || 'unknown'}
错误消息: ${error_message}
${error_stack ? `错误堆栈:\n${error_stack}` : ''}
${request_url ? `请求URL: ${request_url}` : ''}
${context ? `上下文: ${JSON.stringify(context)}` : ''}

请给出：
1. 错误原因分析
2. 可能的解决方案
3. 预防建议`;

      const analysisText = await callAiChat([
        { role: 'system', content: '你是一个专业的错误分析助手，擅长分析前端和后端错误，给出详细的原因分析和解决方案。' },
        { role: 'user', content: prompt },
      ]);

      if (analysisText) {
        await db.aiErrorAnalysis.update({
          where: { id: analysis.id },
          data: {
            aiAnalysis: analysisText,
            analysisStatus: 'analyzed',
          },
        });

        return success({
          id: analysis.id,
          analysisStatus: 'analyzed',
          aiAnalysis: analysisText,
        }, 'AI分析完成', requestId);
      } else {
        await db.aiErrorAnalysis.update({
          where: { id: analysis.id },
          data: {
            aiAnalysis: 'AI分析未返回有效内容',
            analysisStatus: 'pending',
          },
        });

        return success({
          id: analysis.id,
          analysisStatus: 'pending',
          message: 'AI分析未返回有效内容，可稍后重试',
        }, 'AI分析未返回有效内容', requestId);
      }
    } catch (aiErr) {
      console.error('AI analysis error:', aiErr);

      await db.aiErrorAnalysis.update({
        where: { id: analysis.id },
        data: {
          aiAnalysis: `AI分析失败: ${aiErr instanceof Error ? aiErr.message : '未知错误'}`,
          analysisStatus: 'pending',
        },
      });

      return success({
        id: analysis.id,
        analysisStatus: 'pending',
        message: 'AI分析失败，记录已保存，可稍后重试',
      }, 'AI分析失败，记录已保存', requestId);
    }
  } catch (err) {
    console.error('AI error analysis create error:', err);
    return error(50001, '创建AI错误分析失败', requestId);
  }
}
