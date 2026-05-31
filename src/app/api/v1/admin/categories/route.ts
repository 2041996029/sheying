import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { clearCacheByPrefix } from '@/lib/cache';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;
  const admin = adminResult;

  try {
    const body = await request.json();
    const { name, parent_id, cover_url, sort_order } = body;

    if (!name) {
      return error(40001, '分类名称不能为空', requestId);
    }

    let level = 1;
    if (parent_id) {
      const parent = await db.category.findFirst({ where: { id: parent_id, deletedAt: null } });
      if (!parent) {
        return error(40401, '父分类不存在', requestId);
      }
      level = parent.level + 1;
    }

    const category = await db.category.create({
      data: {
        name,
        parent: parent_id ? { connect: { id: parent_id } } : undefined,
        coverUrl: cover_url || null,
        sortOrder: sort_order || 0,
        level,
      },
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'create_category',
        targetType: 'category',
        targetId: category.id,
        detail: JSON.stringify({ name }),
      },
    });

    await clearCacheByPrefix('categories:');

    return success(category, '创建成功', requestId);
  } catch (err) {
    console.error('Create category error:', err);
    return error(50001, '创建分类失败', requestId);
  }
}
