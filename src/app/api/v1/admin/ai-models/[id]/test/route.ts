import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { id } = await params;

    // 内置模型测试
    if (id === 'builtin-z-ai-sdk') {
      const startTime = Date.now();
      try {
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const ai = await ZAI.create();
        const result = await ai.chat.completions.create({
          messages: [
            { role: 'user', content: 'Hi, reply with just "OK".' },
          ],
        });
        const latency = Date.now() - startTime;
        const content = result.choices?.[0]?.message?.content || '';
        return success({
          success: true,
          latency,
          response: content.substring(0, 100),
          model: result.model || 'GLM',
        }, `连接成功，耗时 ${latency}ms`, requestId);
      } catch (err) {
        const latency = Date.now() - startTime;
        return success({
          success: false,
          latency,
          error: err instanceof Error ? err.message : '连接失败',
        }, '内置AI连接失败', requestId);
      }
    }

    // 用户自定义模型测试
    const model = await db.aiModel.findUnique({ where: { id } });
    if (!model) {
      return error(40401, 'AI模型不存在', requestId);
    }

    const startTime = Date.now();
    try {
      // 构造测试请求体
      const testBody: Record<string, unknown> = {
        messages: [
          { role: 'user', content: 'Hi, reply with just "OK".' },
        ],
        max_tokens: 10,
      };

      // 如果指定了模型名称，添加 model 参数
      if (model.modelName) {
        testBody.model = model.modelName;
      }

      // 自动补全路径：如果URL不含 /chat/completions 等已知路径，则追加
      let fetchUrl = model.apiUrl.replace(/\/+$/, '');
      if (!fetchUrl.includes('/chat/completions') && !fetchUrl.includes('/completions')) {
        fetchUrl += '/chat/completions';
      }

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${model.apiKey}`,
        },
        body: JSON.stringify(testBody),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '未知错误');
        return success({
          success: false,
          latency,
          status: response.status,
          error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
        }, `连接失败，HTTP ${response.status}`, requestId);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return success({
        success: true,
        latency,
        response: content.substring(0, 100),
        model: data.model || model.modelName || 'unknown',
      }, `连接成功，耗时 ${latency}ms`, requestId);
    } catch (err) {
      const latency = Date.now() - startTime;
      return success({
        success: false,
        latency,
        error: err instanceof Error ? err.message : '连接失败',
      }, '连接测试失败', requestId);
    }
  } catch (err) {
    console.error('AI model test error:', err);
    return error(50001, '测试AI模型失败', requestId);
  }
}
