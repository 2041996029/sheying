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

    const existing = await db.aiModel.findUnique({ where: { id } });
    if (!existing) {
      return error(40401, 'AI模型不存在', requestId);
    }

    const updated = await db.aiModel.update({
      where: { id },
      data: { isEnabled: !existing.isEnabled },
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'toggle_ai_model',
        targetType: 'ai_model',
        targetId: id,
        detail: JSON.stringify({ name: updated.name, isEnabled: updated.isEnabled }),
      },
    });

    return success({ id: updated.id, isEnabled: updated.isEnabled }, updated.isEnabled ? 'AI模型已启用' : 'AI模型已禁用', requestId);
  } catch (err) {
    console.error('AI model toggle error:', err);
    return error(50001, '切换AI模型状态失败', requestId);
  }
}
