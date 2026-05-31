import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { clearAllCache, deleteCache, clearCacheByPrefix, ensureRedisConfigLoaded } from '@/lib/cache';

export async function DELETE(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;
  const admin = adminResult;

  try {
    await ensureRedisConfigLoaded();

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const prefix = searchParams.get('prefix');

    if (key) {
      // Single key deletion
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
    }

    if (prefix) {
      // Prefix-based deletion
      const count = await clearCacheByPrefix(prefix);
      await db.auditLog.create({
        data: {
          adminId: admin.userId,
          action: 'clear_cache_prefix',
          targetType: 'cache',
          detail: JSON.stringify({ prefix, clearedCount: count }),
        },
      });
      return success({ prefix, clearedKeys: count }, `已清除前缀为 ${prefix} 的 ${count} 个缓存键`, requestId);
    }

    // Clear all cache
    const cleared = await clearAllCache();

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'clear_cache',
        targetType: 'cache',
        detail: JSON.stringify({ clearedKeys: cleared }),
      },
    });

    return success({ clearedKeys: cleared }, '缓存已清空', requestId);
  } catch (err) {
    console.error('Cache clear error:', err);
    return error(50001, '清空缓存失败', requestId);
  }
}
