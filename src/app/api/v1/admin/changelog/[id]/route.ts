import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';

// GET /api/v1/admin/changelog/:id - 获取单条版本记录
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { id } = await params;
    const log = await db.versionLog.findUnique({ where: { id } });
    if (!log) {
      return error(40401, '版本记录不存在', requestId);
    }
    return success(log, 'ok', requestId);
  } catch (err) {
    console.error('Admin changelog get error:', err);
    return error(50001, '获取版本记录失败', requestId);
  }
}

// PUT /api/v1/admin/changelog/:id - 更新版本记录
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { version, title, content, type, is_published, sort_order } = body;

    const existing = await db.versionLog.findUnique({ where: { id } });
    if (!existing) {
      return error(40401, '版本记录不存在', requestId);
    }

    // 如果修改版本号，检查是否重复
    if (version && version !== existing.version) {
      const dup = await db.versionLog.findFirst({ where: { version, NOT: { id } } });
      if (dup) {
        return error(40901, `版本号 ${version} 已存在`, requestId);
      }
    }

    const updateData: Record<string, unknown> = {};
    if (version !== undefined) updateData.version = version;
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;
    if (sort_order !== undefined) updateData.sortOrder = sort_order;

    // 发布/取消发布
    if (is_published !== undefined) {
      updateData.isPublished = is_published;
      if (is_published && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }
      if (!is_published) {
        updateData.publishedAt = null;
      }
    }

    const log = await db.versionLog.update({
      where: { id },
      data: updateData,
    });

    return success(log, '更新成功', requestId);
  } catch (err) {
    console.error('Admin changelog update error:', err);
    return error(50001, '更新版本记录失败', requestId);
  }
}

// DELETE /api/v1/admin/changelog/:id - 删除版本记录
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { id } = await params;
    const existing = await db.versionLog.findUnique({ where: { id } });
    if (!existing) {
      return error(40401, '版本记录不存在', requestId);
    }

    await db.versionLog.delete({ where: { id } });
    return success(null, '删除成功', requestId);
  } catch (err) {
    console.error('Admin changelog delete error:', err);
    return error(50001, '删除版本记录失败', requestId);
  }
}
