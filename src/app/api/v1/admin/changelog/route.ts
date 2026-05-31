import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { paginated, success, error, getRequestId, requireAdmin, getPagination } from '@/lib/response';
import { clearCacheByPrefix } from '@/lib/cache';

// GET /api/v1/admin/changelog - 获取版本更新记录列表（管理端）
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = getPagination(searchParams);
    const type = searchParams.get('type');
    const isPublished = searchParams.get('is_published');

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (isPublished !== null && isPublished !== '') where.isPublished = isPublished === 'true';

    const [logs, total] = await Promise.all([
      db.versionLog.findMany({
        where,
        orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      db.versionLog.count({ where }),
    ]);

    return paginated(logs, total, page, pageSize, requestId);
  } catch (err) {
    console.error('Admin changelog list error:', err);
    return error(50001, '获取版本记录列表失败', requestId);
  }
}

// POST /api/v1/admin/changelog - 新增版本记录
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const body = await request.json();
    const { version, title, content, type, is_published, sort_order } = body;

    if (!version || !title || !content) {
      return error(40001, '版本号、标题和内容不能为空', requestId);
    }

    // 检查版本号是否重复
    const existing = await db.versionLog.findFirst({ where: { version } });
    if (existing) {
      return error(40901, `版本号 ${version} 已存在`, requestId);
    }

    const log = await db.versionLog.create({
      data: {
        version,
        title,
        content,
        type: type || 'feature',
        isPublished: is_published ?? false,
        publishedAt: is_published ? new Date() : null,
        sortOrder: sort_order ?? 0,
      },
    });

    // 清除公开版本记录缓存
    await clearCacheByPrefix('changelog:');

    return success(log, '创建成功', requestId);
  } catch (err) {
    console.error('Admin changelog create error:', err);
    return error(50001, '创建版本记录失败', requestId);
  }
}
