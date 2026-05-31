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
    const { status, is_visible } = body;

    const comment = await db.comment.findUnique({ where: { id } });
    if (!comment) {
      return error(40401, '评论不存在', requestId);
    }

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (is_visible !== undefined) data.isVisible = is_visible;

    const updated = await db.comment.update({
      where: { id },
      data,
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'update_comment_status',
        targetType: 'comment',
        targetId: id,
        detail: JSON.stringify(data),
      },
    });

    return success(updated, '更新成功', requestId);
  } catch (err) {
    console.error('Update comment status error:', err);
    return error(50001, '更新评论状态失败', requestId);
  }
}
