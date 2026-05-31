import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { paginated, success, error, getRequestId, getPagination, requireAdmin } from '@/lib/response';
import { clearCacheByPrefix } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = getPagination(searchParams);
    const workId = searchParams.get('work_id');
    const auditStatus = searchParams.get('audit_status');

    // 鉴权：非管理员只能查看已通过的标签
    const adminResult = await requireAdmin(request);
    const isAdmin = adminResult.ok;

    const where: Record<string, unknown> = {};
    if (workId) where.workId = workId;
    if (auditStatus && isAdmin) {
      where.auditStatus = auditStatus;
    } else {
      // 非管理员强制只看已通过的标签
      where.auditStatus = 'approved';
    }

    const [tags, total] = await Promise.all([
      db.aiTag.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          work: { select: { id: true, title: true, coverUrl: true } },
          aiModel: { select: { id: true, name: true, modelName: true } },
        },
      }),
      db.aiTag.count({ where }),
    ]);

    return paginated(tags, total, page, pageSize, requestId);
  } catch (err) {
    console.error('AI tags list error:', err);
    return error(50001, '获取AI标签列表失败', requestId);
  }
}

export async function DELETE(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;
  const admin = adminResult;

  try {
    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get('id');

    if (!tagId) {
      return error(40001, '缺少标签ID', requestId);
    }

    // 查找标签，确认存在
    const tag = await db.aiTag.findUnique({ where: { id: tagId } });
    if (!tag) {
      return error(40401, '标签不存在', requestId);
    }

    // 删除标签
    await db.aiTag.delete({ where: { id: tagId } });

    // 如果标签是已通过状态，需要从作品的tags字段中移除该标签
    if (tag.auditStatus === 'approved') {
      const work = await db.work.findUnique({ where: { id: tag.workId } });
      if (work && work.tags) {
        const existingTags: string[] = JSON.parse(work.tags);
        const updatedTags = existingTags.filter((t) => t !== tag.tagName);
        await db.work.update({
          where: { id: tag.workId },
          data: { tags: JSON.stringify(updatedTags) },
        });
      }
    }

    // 记录审计日志
    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'delete_ai_tag',
        targetType: 'ai_tag',
        targetId: tagId,
        detail: JSON.stringify({ tagId, tagName: tag.tagName, workId: tag.workId }),
      },
    });

    await clearCacheByPrefix('works:');

    return success(null, '标签删除成功', requestId);
  } catch (err) {
    console.error('AI tag delete error:', err);
    return error(50001, '删除标签失败', requestId);
  }
}
