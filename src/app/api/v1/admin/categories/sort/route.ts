import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { clearCacheByPrefix } from '@/lib/cache';

export async function PUT(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;
  const admin = adminResult;

  try {
    const body = await request.json();
    const { items } = body as { items: { id: string; sort_order: number }[] };

    if (!items || !Array.isArray(items)) {
      return error(40001, 'items格式不正确', requestId);
    }

    // Update sort orders in a transaction
    await db.$transaction(
      items.map((item) =>
        db.category.update({
          where: { id: item.id },
          data: { sortOrder: item.sort_order },
        })
      )
    );

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'sort_categories',
        targetType: 'category',
        detail: JSON.stringify({ count: items.length }),
      },
    });

    await clearCacheByPrefix('categories:');

    return success(null, '排序已更新', requestId);
  } catch (err) {
    console.error('Sort categories error:', err);
    return error(50001, '更新排序失败', requestId);
  }
}
