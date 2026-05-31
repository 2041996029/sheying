import { NextRequest } from 'next/server';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { isRedisConnected, getRedisInfo, getRedisMemoryInfo, getRedisClientList, getRedisKeySpaceInfo, getRedisCommandStats, ensureRedisConfigLoaded } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    await ensureRedisConfigLoaded();

    const connected = await isRedisConnected();

    if (!connected) {
      return success({
        connected: false,
        serverInfo: null,
        memoryInfo: null,
        clientInfo: null,
        keyspaceInfo: null,
        commandStats: null,
      }, 'Redis未连接', requestId);
    }

    const [serverInfo, memoryInfo, clientInfo, keyspaceInfo, commandStats] = await Promise.all([
      getRedisInfo().catch(() => null),
      getRedisMemoryInfo().catch(() => null),
      getRedisClientList().catch(() => null),
      getRedisKeySpaceInfo().catch(() => null),
      getRedisCommandStats().catch(() => null),
    ]);

    return success({
      connected: true,
      serverInfo: serverInfo ? {
        version: serverInfo.redis_version || null,
        uptimeInSeconds: serverInfo.uptime_in_seconds || null,
        uptimeInDays: serverInfo.uptime_in_days || null,
        redisMode: serverInfo.redis_mode || null,
        os: serverInfo.os || null,
        processId: serverInfo.process_id || null,
        tcpPort: serverInfo.tcp_port || null,
        executable: serverInfo.executable || null,
        config_file: serverInfo.config_file || null,
      } : null,
      memoryInfo,
      clientInfo,
      keyspaceInfo,
      commandStats,
    }, 'ok', requestId);
  } catch (err) {
    console.error('Redis info error:', err);
    return error(50001, '获取Redis信息失败', requestId);
  }
}
