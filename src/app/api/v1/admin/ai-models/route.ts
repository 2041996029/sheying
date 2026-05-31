import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const models = await db.aiModel.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    // 内置AI模型（z-ai-web-dev-sdk），优先级最低（兜底）
    const builtinModel = {
      id: 'builtin-z-ai-sdk',
      name: '平台内置 AI',
      apiUrl: 'z-ai-web-dev-sdk（平台托管）',
      apiKey: '由平台自动管理',
      modelType: 'chat',
      modelName: 'GLM',
      sortOrder: 9999,
      isEnabled: true,
      isBuiltin: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 脱敏API Key：只显示后4位
    const sanitized = models.map((m: any) => ({
      ...m,
      apiKey: m.apiKey ? `****${m.apiKey.slice(-4)}` : '',
      isBuiltin: false,
    }));

    return success([...sanitized, builtinModel], 'ok', requestId);
  } catch (err) {
    console.error('AI models list error:', err);
    return error(50001, '获取AI模型列表失败', requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;
  const admin = adminResult;

  try {
    const body = await request.json();
    const { name, api_url, api_key, model_type, model_name, sort_order, is_enabled } = body;

    if (!name || !api_url || !api_key) {
      return error(40001, 'name、api_url和api_key不能为空', requestId);
    }

    const model = await db.aiModel.create({
      data: {
        name,
        apiUrl: api_url,
        apiKey: api_key,
        modelType: model_type || 'chat',
        modelName: model_name || null,
        sortOrder: sort_order || 0,
        isEnabled: is_enabled !== undefined ? is_enabled : true,
      },
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'create_ai_model',
        targetType: 'ai_model',
        targetId: model.id,
        detail: JSON.stringify({ name }),
      },
    });

    return success(model, 'AI模型已创建', requestId);
  } catch (err) {
    console.error('AI model create error:', err);
    return error(50001, '创建AI模型失败', requestId);
  }
}
