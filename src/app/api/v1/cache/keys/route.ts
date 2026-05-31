import { NextRequest } from 'next/server';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { getCacheKeys, getCacheByKeyPrefix, ensureRedisConfigLoaded } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    // 确保 Redis 配置已从 DB 加载并建立连接，避免首次请求时返回空数据
    await ensureRedisConfigLoaded();

    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix');

    const keys = prefix
      ? await getCacheByKeyPrefix(prefix)
      : await getCacheKeys();

    return success(keys, 'ok', requestId);
  } catch (err) {
    console.error('Cache keys error:', err);
    return error(50001, '获取缓存键列表失败', requestId);
  }
}
