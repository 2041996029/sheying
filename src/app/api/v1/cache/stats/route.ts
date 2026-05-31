import { NextRequest } from 'next/server';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { getCacheStats, isRedisConnected, getRedisMemoryInfo, getRedisClientList, getRedisKeySpaceInfo, ensureRedisConfigLoaded } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    await ensureRedisConfigLoaded();

    const [stats, redisConnected, memoryInfo, clientInfo, keyspaceInfo] = await Promise.all([
      getCacheStats(),
      isRedisConnected(),
      getRedisMemoryInfo().catch(() => null),
      getRedisClientList().catch(() => null),
      getRedisKeySpaceInfo().catch(() => null),
    ]);

    return success({
      ...stats,
      redisConnected,
      redisInfo: redisConnected ? {
        version: stats.redisVersion || null,
        uptime: stats.redisUptime || null,
        uptimeDays: null,
      } : null,
      memoryInfo,
      clientInfo,
      keyspaceInfo,
    }, 'ok', requestId);
  } catch (err) {
    console.error('Cache stats error:', err);
    return error(50001, '获取缓存统计失败', requestId);
  }
}
