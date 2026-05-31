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
    const body = await request.json();
    const { name, parent_id, cover_url, sort_order } = body;

    const category = await db.category.findFirst({ where: { id, deletedAt: null } });
    if (!category) {
      return error(40401, '分类不存在', requestId);
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (parent_id !== undefined) {
      data.parent = parent_id ? { connect: { id: parent_id } } : { disconnect: true };
      // Recalculate level
      if (parent_id) {
        const parent = await db.category.findFirst({ where: { id: parent_id } });
        data.level = parent ? parent.level + 1 : 1;
      } else {
        data.level = 1;
      }
    }
    if (cover_url !== undefined) data.coverUrl = cover_url;
    if (sort_order !== undefined) data.sortOrder = sort_order;

    const updated = await db.category.update({
      where: { id },
      data,
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'update_category',
        targetType: 'category',
        targetId: id,
        detail: JSON.stringify({ updates: Object.keys(data) }),
      },
    });

    await clearCacheByPrefix('categories:');
    await clearCacheByPrefix('works:');

    return success(updated, '更新成功', requestId);
  } catch (err) {
    console.error('Update category error:', err);
    return error(50001, '更新分类失败', requestId);
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

    const category = await db.category.findFirst({ where: { id, deletedAt: null } });
    if (!category) {
      return error(40401, '分类不存在', requestId);
    }

    // Soft delete
    await db.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'delete_category',
        targetType: 'category',
        targetId: id,
        detail: JSON.stringify({ name: category.name }),
      },
    });

    await clearCacheByPrefix('categories:');
    await clearCacheByPrefix('works:');

    return success(null, '删除成功', requestId);
  } catch (err) {
    console.error('Delete category error:', err);
    return error(50001, '删除分类失败', requestId);
  }
}
