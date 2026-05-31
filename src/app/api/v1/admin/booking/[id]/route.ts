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
    const { status } = body;

    if (!status || !['pending', 'read', 'replied'].includes(status)) {
      return error(40001, '状态值无效', requestId);
    }

    const contact = await db.contact.findUnique({ where: { id } });
    if (!contact) {
      return error(40401, '留言不存在', requestId);
    }

    const updated = await db.contact.update({
      where: { id },
      data: { status },
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'update_booking_status',
        targetType: 'contact',
        targetId: id,
        detail: JSON.stringify({ status }),
      },
    });

    return success(updated, '更新成功', requestId);
  } catch (err) {
    console.error('Update booking status error:', err);
    return error(50001, '更新留言状态失败', requestId);
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

    const contact = await db.contact.findUnique({ where: { id } });
    if (!contact) {
      return error(40401, '留言不存在', requestId);
    }

    await db.contact.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'delete_booking',
        targetType: 'contact',
        targetId: id,
        detail: JSON.stringify({ name: contact.name, message: contact.message?.substring(0, 100) }),
      },
    });

    return success(null, '删除成功', requestId);
  } catch (err) {
    console.error('Delete booking error:', err);
    return error(50001, '删除留言失败', requestId);
  }
}
