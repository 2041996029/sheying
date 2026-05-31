import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, getAuthUser } from '@/lib/response';
import { getCache, setCache } from '@/lib/cache';
import { callAiChat } from '@/lib/ai-tags';

async function isAiEnabled(): Promise<boolean> {
  const cacheKey = 'configs:ai_enabled';
  const cached = await getCache<string>(cacheKey);
  if (cached !== null) {
    return cached === 'true';
  }
  try {
    const config = await db.config.findUnique({ where: { key: 'ai_enabled' } });
    const enabled = config?.value === 'true';
    await setCache(cacheKey, enabled ? 'true' : 'false', 60);
    return enabled;
  } catch {
    return false;
  }
}

async function triggerAiAnalysis(errorId: string, errorMessage: string, errorStack: string | null, requestUrl: string | null) {
  try {
    // Create pending analysis
    const analysis = await db.aiErrorAnalysis.create({
      data: {
        errorType: 'frontend_error',
        errorMessage: errorMessage,
        errorStack: errorStack,
        requestUrl: requestUrl,
        analysisStatus: 'pending',
        aiAnalysis: null,
      },
    });

    // Build prompt
    const prompt = `分析以下前端错误，给出可能的原因和解决方案：

错误类型: frontend_error
错误消息: ${errorMessage}
${errorStack ? `错误堆栈:\n${errorStack}` : ''}
${requestUrl ? `请求URL: ${requestUrl}` : ''}

请给出：
1. 错误原因分析
2. 可能的解决方案
3. 预防建议`;

    const analysisText = await callAiChat([
      { role: 'system', content: '你是一个专业的前端错误分析助手，擅长分析JavaScript/React/Next.js错误，给出详细的原因分析和解决方案。' },
      { role: 'user', content: prompt },
    ]);

    await db.aiErrorAnalysis.update({
      where: { id: analysis.id },
      data: {
        aiAnalysis: analysisText || 'AI分析未返回有效内容',
        analysisStatus: analysisText ? 'analyzed' : 'pending',
      },
    });
  } catch (aiErr) {
    console.error('Auto AI analysis error:', aiErr);
    // Silent fail - don't block the error reporting
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const auth = getAuthUser(request);
    const body = await request.json();
    const { error_message, error_stack, source, page_path, user_agent } = body;

    if (!error_message) {
      return error(40001, 'error_message不能为空', requestId);
    }

    const errorRecord = await db.frontendError.create({
      data: {
        errorMessage: error_message,
        errorStack: error_stack || null,
        source: source || 'pc',
        pagePath: page_path || null,
        userAgent: user_agent || request.headers.get('user-agent') || null,
        userId: auth?.userId || null,
        requestId,
      },
    });

    // Auto-trigger AI analysis if enabled
    const aiEnabled = await isAiEnabled();
    if (aiEnabled) {
      // Don't await - run in background
      triggerAiAnalysis(errorRecord.id, error_message, error_stack || null, page_path || null).catch(() => {});
    }

    return success({ id: errorRecord.id, aiAnalysisTriggered: aiEnabled }, '已记录', requestId);
  } catch (err) {
    console.error('Frontend error report error:', err);
    return error(50001, '记录错误失败', requestId);
  }
}
