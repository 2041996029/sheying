import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { deleteCache, ensureRedisConfigLoaded } from '@/lib/cache';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;
  const admin = adminResult;

  try {
    await ensureRedisConfigLoaded();

    const { key: encodedKey } = await params;
    const key = decodeURIComponent(encodedKey);

    const deleted = await deleteCache(key);

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'delete_cache_key',
        targetType: 'cache',
        detail: JSON.stringify({ key, deleted }),
      },
    });

    return success({ key, deleted }, deleted ? '缓存键已删除' : '缓存键不存在', requestId);
  } catch (err) {
    console.error('Delete cache key error:', err);
    return error(50001, '删除缓存键失败', requestId);
  }
}
