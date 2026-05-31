import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { clearCacheByPrefix } from '@/lib/cache';

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

    const work = await db.work.findFirst({ where: { id, deletedAt: null } });
    if (!work) {
      return error(40401, '作品不存在', requestId);
    }

    const updated = await db.work.update({
      where: { id },
      data: { isFeatured: !work.isFeatured },
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'toggle_featured',
        targetType: 'work',
        targetId: id,
        detail: JSON.stringify({ isFeatured: updated.isFeatured }),
      },
    });

    await clearCacheByPrefix('works:');

    return success({ isFeatured: updated.isFeatured }, updated.isFeatured ? '已设为精选' : '已取消精选', requestId);
  } catch (err) {
    console.error('Toggle featured error:', err);
    return error(50001, '操作失败', requestId);
  }
}
