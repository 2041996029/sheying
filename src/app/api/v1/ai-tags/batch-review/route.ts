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
    const { tag_ids, action } = body as { tag_ids: string[]; action: 'approve' | 'reject' | 'delete' };

    if (!tag_ids || !Array.isArray(tag_ids) || tag_ids.length === 0) {
      return error(40001, 'tag_ids不能为空', requestId);
    }

    if (!action || !['approve', 'reject', 'delete'].includes(action)) {
      return error(40002, 'action必须是approve、reject或delete', requestId);
    }

    // 批量删除
    if (action === 'delete') {
      // 先查找要删除的标签，用于后续处理已通过标签的清理
      const tagsToDelete = await db.aiTag.findMany({
        where: { id: { in: tag_ids } },
      });

      // 批量删除标签
      const result = await db.aiTag.deleteMany({
        where: { id: { in: tag_ids } },
      });

      // 对于已通过状态的标签，需要从作品的tags字段中移除
      const approvedTags = tagsToDelete.filter((t) => t.auditStatus === 'approved');
      if (approvedTags.length > 0) {
        const workTagsMap = new Map<string, Set<string>>();
        for (const tag of approvedTags) {
          if (!workTagsMap.has(tag.workId)) {
            workTagsMap.set(tag.workId, new Set());
          }
          workTagsMap.get(tag.workId)!.add(tag.tagName);
        }

        for (const [workId, tagNames] of workTagsMap) {
          const work = await db.work.findUnique({ where: { id: workId } });
          if (work && work.tags) {
            const existingTags: string[] = JSON.parse(work.tags);
            const updatedTags = existingTags.filter((t) => !tagNames.has(t));
            await db.work.update({
              where: { id: workId },
              data: { tags: JSON.stringify(updatedTags) },
            });
          }
        }
      }

      await db.auditLog.create({
        data: {
          adminId: admin.userId,
          action: 'batch_delete_ai_tag',
          targetType: 'ai_tag',
          detail: JSON.stringify({ tag_ids, action: 'delete', count: result.count }),
        },
      });

      await clearCacheByPrefix('works:');

      return success({ count: result.count }, `批量删除成功，共删除${result.count}条标签`, requestId);
    }

    // 批量审核（通过/拒绝）
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const result = await db.aiTag.updateMany({
      where: { id: { in: tag_ids } },
      data: { auditStatus: newStatus },
    });

    // If approved, add tags to work's tags field
    if (action === 'approve') {
      const approvedTags = await db.aiTag.findMany({
        where: { id: { in: tag_ids }, auditStatus: 'approved' },
      });

      // Group by workId
      const workTagsMap = new Map<string, Set<string>>();
      for (const tag of approvedTags) {
        if (!workTagsMap.has(tag.workId)) {
          workTagsMap.set(tag.workId, new Set());
        }
        workTagsMap.get(tag.workId)!.add(tag.tagName);
      }

      // Update each work's tags
      for (const [workId, newTags] of workTagsMap) {
        const work = await db.work.findUnique({ where: { id: workId } });
        if (work) {
          const existingTags: string[] = work.tags ? JSON.parse(work.tags) : [];
          const mergedTags = [...new Set([...existingTags, ...newTags])];
          await db.work.update({
            where: { id: workId },
            data: { tags: JSON.stringify(mergedTags) },
          });
        }
      }
    }

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: `batch_review_${action}`,
        targetType: 'ai_tag',
        detail: JSON.stringify({ tag_ids, action, count: result.count }),
      },
    });

    await clearCacheByPrefix('works:');

    return success({ count: result.count }, `批量${action === 'approve' ? '通过' : '拒绝'}成功`, requestId);
  } catch (err) {
    console.error('Batch review error:', err);
    return error(50001, '批量操作失败', requestId);
  }
}
