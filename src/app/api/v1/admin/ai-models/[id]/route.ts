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
  const admin = adminResult;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, api_url, api_key, model_type, model_name, sort_order, is_enabled } = body;

    const existing = await db.aiModel.findUnique({ where: { id } });
    if (!existing) {
      return error(40401, 'AI模型不存在', requestId);
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (api_url !== undefined) updateData.apiUrl = api_url;
    // 安全保护：如果收到的是掩码值（以****开头），忽略不覆盖原有密钥
    if (api_key !== undefined && api_key !== '' && !api_key.startsWith('****')) {
      updateData.apiKey = api_key;
    }
    if (model_type !== undefined) updateData.modelType = model_type;
    if (model_name !== undefined) updateData.modelName = model_name;
    if (sort_order !== undefined) updateData.sortOrder = sort_order;
    if (is_enabled !== undefined) updateData.isEnabled = is_enabled;

    const updated = await db.aiModel.update({
      where: { id },
      data: updateData,
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'update_ai_model',
        targetType: 'ai_model',
        targetId: id,
        detail: JSON.stringify({ name: updated.name }),
      },
    });

    return success(updated, 'AI模型已更新', requestId);
  } catch (err) {
    console.error('AI model update error:', err);
    return error(50001, '更新AI模型失败', requestId);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;
  const admin = adminResult;

  try {
    const { id } = await params;

    const existing = await db.aiModel.findUnique({ where: { id } });
    if (!existing) {
      return error(40401, 'AI模型不存在', requestId);
    }

    await db.aiModel.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'delete_ai_model',
        targetType: 'ai_model',
        targetId: id,
        detail: JSON.stringify({ name: existing.name }),
      },
    });

    return success(null, 'AI模型已删除', requestId);
  } catch (err) {
    console.error('AI model delete error:', err);
    return error(50001, '删除AI模型失败', requestId);
  }
}
