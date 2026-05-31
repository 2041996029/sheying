// Redis 缓存工具
// 使用 Redis 作为唯一缓存，内存仅做请求级临时缓存

// Redis connection - lazy init
let redis: InstanceType<typeof import('ioredis').default> | null = null;
let redisAvailable = false;
let redisImportFailed = false;

// Cache key prefix for Redis to namespace our app keys
const REDIS_KEY_PREFIX = 'gyj:cache:';

// 轻量级日志工具 — 生产环境仅输出 error/warn，开发环境输出所有级别
const isDev = process.env.NODE_ENV !== 'production';
function cacheLog(msg: string, ...args: unknown[]) {
  if (isDev) console.log(`[Cache] ${msg}`, ...args);
}
function cacheWarn(msg: string, ...args: unknown[]) {
  console.warn(`[Cache] ${msg}`, ...args);
}

// Runtime-configurable Redis settings (set from DB config)
let configuredRedisUrl: string | null = null;
let configuredRedisHost: string | null = null;
let configuredRedisPort: string | null = null;
let configuredRedisPassword: string | null = null;
let configuredRedisDb: number = 0;

// Runtime-configurable cache settings
let cacheEnabled = true;
let defaultCacheTtl = 300;

// Track if we've loaded Redis config from DB
let redisConfigLoaded = false;
let configLoadPromise: Promise<void> | null = null;

/**
 * 从数据库加载 Redis 配置并应用
 * 所有 cache API 路由都应先调用此函数确保连接就绪
 */
export function ensureRedisConfigLoaded(): Promise<void> {
  if (redisConfigLoaded) return Promise.resolve();
  if (!configLoadPromise) {
    configLoadPromise = (async () => {
      try {
        // 动态导入 db 避免循环依赖
        const { db } = await import('@/lib/db');
        const [hostConfig, portConfig, passwordConfig, dbConfig, enabledConfig, ttlConfig] = await Promise.all([
          db.config.findUnique({ where: { key: 'redis_host' } }),
          db.config.findUnique({ where: { key: 'redis_port' } }),
          db.config.findUnique({ where: { key: 'redis_password' } }),
          db.config.findUnique({ where: { key: 'redis_db' } }),
          db.config.findUnique({ where: { key: 'cache_enabled' } }),
          db.config.findUnique({ where: { key: 'cache_ttl' } }),
        ]);
        const host = hostConfig?.value || '';
        if (host) {
          setRedisConfig(host, portConfig?.value || '6379', passwordConfig?.value || undefined, dbConfig?.value || '0');
        }
        setCacheEnabled(enabledConfig?.value !== 'false');
        const ttl = parseInt(ttlConfig?.value || '300', 10);
        if (!isNaN(ttl) && ttl > 0) {
          setDefaultCacheTtl(ttl);
        }
        redisConfigLoaded = true;
      } catch {
        // DB not available yet, skip - allow retry next time
        configLoadPromise = null;
      }
    })();
  }
  return configLoadPromise;
}

function getRedisConfig(): { url: string; db: number } | null {
  // Prefer constructed from host/port/password/db
  if (configuredRedisHost) {
    const host = configuredRedisHost;
    const port = configuredRedisPort || '6379';
    const password = configuredRedisPassword;
    const db = configuredRedisDb;
    // 在URL中也包含数据库编号，确保 ioredis 正确选择数据库
    if (password) {
      return { url: `redis://:${password}@${host}:${port}/${db}`, db };
    }
    return { url: `redis://${host}:${port}/${db}`, db };
  }
  // Fallback to full URL
  const url = configuredRedisUrl || process.env.REDIS_URL || null;
  return url ? { url, db: configuredRedisDb } : null;
}

// Set Redis URL from external config - legacy support
export function setRedisUrl(url: string): void {
  if (url !== configuredRedisUrl) {
    configuredRedisUrl = url || null;
    resetRedisConnection();
  }
}

// Set Redis config from separate host/port/password/db
export function setRedisConfig(host: string, port: string, password?: string, db?: string | number): void {
  configuredRedisHost = host || null;
  configuredRedisPort = port || null;
  configuredRedisPassword = password || null;
  configuredRedisDb = typeof db !== 'undefined' ? Number(db) : 0;
  if (isNaN(configuredRedisDb) || configuredRedisDb < 0 || configuredRedisDb > 15) configuredRedisDb = 0;
  cacheLog(`Redis配置已更新: host=${configuredRedisHost}, port=${configuredRedisPort}, db=${configuredRedisDb}, hasPassword=${!!configuredRedisPassword}`);
  resetRedisConnection();
}

// Set cache enabled/disabled
export function setCacheEnabled(enabled: boolean): void {
  const oldEnabled = cacheEnabled;
  cacheEnabled = enabled;
  if (oldEnabled !== enabled) {
    cacheLog(`缓存开关已更新: ${enabled ? '开启' : '关闭'}`);
  }
}

// Set default cache TTL
export function setDefaultCacheTtl(ttl: number): void {
  const oldTtl = defaultCacheTtl;
  defaultCacheTtl = ttl;
  if (oldTtl !== ttl) {
    cacheLog(`默认TTL已更新: ${ttl}秒`);
  }
}

// Get default cache TTL
export function getDefaultCacheTtl(): number {
  return defaultCacheTtl;
}

// Set cache type - kept for API compatibility, always uses redis now
export function setCacheType(_type: string): void {
  // No-op: always redis
}

// Dynamic import of ioredis
async function loadRedisModule() {
  if (redisImportFailed) return null;
  try {
    const mod = await import('ioredis');
    return mod.default;
  } catch (err) {
    redisImportFailed = true;
    cacheWarn('ioredis模块加载失败，缓存功能不可用:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function getRedis() {
  if (redis && redisAvailable) return redis;
  if (redis && !redisAvailable) return null;
  if (redisImportFailed) return null;

  const config = getRedisConfig();
  if (!config) return null;

  try {
    const RedisClass = await loadRedisModule();
    if (!RedisClass) return null;

    // 使用显式 db 选项，确保数据库编号生效
    redis = new RedisClass(config.url, {
      db: config.db,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
      connectTimeout: 3000,
    });
    await redis.ping();
    redisAvailable = true;
    cacheLog(`Redis连接成功: db=${config.db}`);
    return redis;
  } catch (err) {
    cacheWarn('Redis连接失败:', err instanceof Error ? err.message : err);
    redis = null;
    redisAvailable = false;
    return null;
  }
}

// Reset Redis connection (for when config changes)
export function resetRedisConnection(): void {
  if (redis) {
    try {
      redis.disconnect();
    } catch {
      // ignore
    }
  }
  redis = null;
  redisAvailable = false;
  // 重置导入失败标志，允许重新尝试连接
  redisImportFailed = false;
}

// ==================== Core Cache Operations ====================

export async function setCache<T>(key: string, data: T, ttlSeconds: number = 0): Promise<void> {
  // 检查缓存开关
  if (!cacheEnabled) return;

  const ttl = ttlSeconds > 0 ? ttlSeconds : defaultCacheTtl;
  const now = Date.now();
  try {
    const r = await getRedis();
    if (r) {
      const redisKey = REDIS_KEY_PREFIX + key;
      const serialized = JSON.stringify({
        data,
        createdAt: now,
        ttlSeconds: ttl,
      });
      await r.setex(redisKey, ttl, serialized);
    }
  } catch (err) {
    redisAvailable = false;
    cacheWarn(`setCache失败 key=${key}:`, err instanceof Error ? err.message : err);
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  // 检查缓存开关
  if (!cacheEnabled) return null;

  try {
    const r = await getRedis();
    if (r) {
      const redisKey = REDIS_KEY_PREFIX + key;
      const serialized = await r.get(redisKey);
      if (serialized) {
        const parsed = JSON.parse(serialized) as { data: T; createdAt: number; ttlSeconds: number };
        return parsed.data;
      }
    }
  } catch (err) {
    redisAvailable = false;
    cacheWarn(`getCache失败 key=${key}:`, err instanceof Error ? err.message : err);
  }
  return null;
}

// Synchronous cache get - only checks Redis is not available synchronously, returns null
export function getCacheSync<T>(_key: string): T | null {
  return null;
}

// Synchronous cache set - no-op for Redis-only mode
export function setCacheSync<T>(_key: string, _data: T, _ttlSeconds: number = 300): void {
  // No-op: Redis is async-only
}

export async function deleteCache(key: string): Promise<boolean> {
  // 删除操作不受开关限制，确保管理操作始终有效
  try {
    const r = await getRedis();
    if (r) {
      const redisKey = REDIS_KEY_PREFIX + key;
      const result = await r.del(redisKey);
      return result > 0;
    }
  } catch (err) {
    redisAvailable = false;
    cacheWarn(`deleteCache失败 key=${key}:`, err instanceof Error ? err.message : err);
  }
  return false;
}

export async function clearCacheByPrefix(prefix: string): Promise<number> {
  // 清除操作不受开关限制，确保管理操作始终有效
  let count = 0;
  try {
    const r = await getRedis();
    if (r) {
      const pattern = REDIS_KEY_PREFIX + prefix + '*';
      const keys = await scanKeys(r, pattern);
      if (keys.length > 0) {
        count = await r.del(...keys);
      }
    }
  } catch (err) {
    redisAvailable = false;
    cacheWarn(`clearCacheByPrefix失败 prefix=${prefix}:`, err instanceof Error ? err.message : err);
  }
  return count;
}

export async function clearAllCache(): Promise<number> {
  // 清除操作不受开关限制，确保管理操作始终有效
  let count = 0;
  try {
    const r = await getRedis();
    if (r) {
      const pattern = REDIS_KEY_PREFIX + '*';
      const keys = await scanKeys(r, pattern);
      if (keys.length > 0) {
        await r.del(...keys);
        count = keys.length;
      }
    }
  } catch (err) {
    redisAvailable = false;
    cacheWarn('clearAllCache失败:', err instanceof Error ? err.message : err);
  }
  return count;
}

// ==================== Cache Keys & Stats ====================

interface CacheKeyDetail {
  key: string;
  ttl: number;
  createdAt: number;
  expiresAt: number;
  remainingTtl: number;
  type: 'redis';
  size?: number;
}

export async function getCacheKeys(): Promise<CacheKeyDetail[]> {
  const keys: CacheKeyDetail[] = [];

  try {
    const r = await getRedis();
    if (r) {
      const pattern = REDIS_KEY_PREFIX + '*';
      const redisKeys = await scanKeys(r, pattern);

      if (redisKeys.length === 0) return keys;

      // 使用pipeline批量获取TTL和值，避免逐个调用
      const ttlPipeline = r.pipeline();
      const getPipeline = r.pipeline();
      for (const redisKey of redisKeys) {
        ttlPipeline.ttl(redisKey);
        getPipeline.get(redisKey);
      }

      const [ttlResults, getResults] = await Promise.all([
        ttlPipeline.exec(),
        getPipeline.exec(),
      ]);

      for (let i = 0; i < redisKeys.length; i++) {
        const cacheKey = redisKeys[i].substring(REDIS_KEY_PREFIX.length);

        const ttl = ttlResults?.[i]?.[1] as number | null;
        const serialized = getResults?.[i]?.[1] as string | null;
        let parsed: { data: unknown; createdAt: number; ttlSeconds: number } | null = null;
        let size = 0;
        if (serialized) {
          try {
            parsed = JSON.parse(serialized);
            size = serialized.length;
          } catch {
            size = serialized.length;
          }
        }

        keys.push({
          key: cacheKey,
          ttl: parsed?.ttlSeconds || 0,
          createdAt: parsed?.createdAt || 0,
          expiresAt: parsed?.createdAt ? parsed.createdAt + (parsed.ttlSeconds * 1000) : 0,
          remainingTtl: (ttl !== null && ttl > 0) ? ttl : 0,
          type: 'redis',
          size,
        });
      }
    }
  } catch (err) {
    redisAvailable = false;
    cacheWarn('getCacheKeys失败:', err instanceof Error ? err.message : err);
  }

  return keys;
}

export async function getCacheKeyDetail(key: string): Promise<CacheKeyDetail & { value: unknown } | null> {
  try {
    const r = await getRedis();
    if (!r) return null;

    const redisKey = REDIS_KEY_PREFIX + key;
    const [ttl, serialized] = await Promise.all([
      r.ttl(redisKey),
      r.get(redisKey),
    ]);

    if (!serialized) return null;

    let parsed: { data: unknown; createdAt: number; ttlSeconds: number } | null = null;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      // ignore
    }

    return {
      key,
      ttl: parsed?.ttlSeconds || 0,
      createdAt: parsed?.createdAt || 0,
      expiresAt: parsed?.createdAt ? parsed.createdAt + (parsed.ttlSeconds * 1000) : 0,
      remainingTtl: ttl > 0 ? ttl : 0,
      type: 'redis',
      size: serialized.length,
      value: parsed?.data,
    };
  } catch (err) {
    cacheWarn('getCacheKeyDetail失败:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getCacheByKeyPrefix(prefix: string): Promise<CacheKeyDetail[]> {
  const allKeys = await getCacheKeys();
  return allKeys.filter(k => k.key.startsWith(prefix));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function getCacheStats() {
  let appKeyCount = 0;
  let appMemoryUsage = '0 B';
  let appMemoryUsageBytes = 0;
  let redisTotalKeys = 0;
  let redisUsedMemory = '0 B';
  let redisUsedMemoryBytes = 0;
  let redisPeakMemory = '0 B';
  let redisVersion: string | null = null;
  let redisUptime: string | null = null;

  try {
    const r = await getRedis();
    if (r) {
      // 应用缓存键统计（仅 gyj:cache: 前缀）
      const pattern = REDIS_KEY_PREFIX + '*';
      const redisKeys = await scanKeys(r, pattern);
      appKeyCount = redisKeys.length;

      // 计算应用缓存实际使用的内存：遍历所有 key 的 value 大小
      if (redisKeys.length > 0) {
        try {
          // 使用 pipeline 批量获取各键的值长度
          const pipeline = r.pipeline();
          for (const redisKey of redisKeys) {
            pipeline.strlen(redisKey);
          }
          const pipeResults = await pipeline.exec();
          if (pipeResults) {
            let totalSize = 0;
            for (const result of pipeResults) {
              if (result && result[1] !== null && typeof result[1] === 'number') {
                totalSize += result[1];
              }
            }
            appMemoryUsageBytes = totalSize;
          }
          appMemoryUsage = formatBytes(appMemoryUsageBytes);
        } catch {
          // strlen 批量调用失败时，回退到逐个计算
          let totalSize = 0;
          for (const redisKey of redisKeys) {
            try {
              const len = await r.strlen(redisKey);
              totalSize += len;
            } catch {
              // skip
            }
          }
          appMemoryUsageBytes = totalSize;
          appMemoryUsage = formatBytes(totalSize);
        }
      }

      // Redis 全局统计（从 INFO 和 KEYSPACE 获取）
      try {
        // 获取 keyspace 信息，统计全局键数
        const keyspaceInfo = await r.info('keyspace');
        const dbKey = `db${configuredRedisDb}`;
        const dbLine = keyspaceInfo.split('\n').find(line => line.startsWith(dbKey + ':'));
        if (dbLine) {
          const keysMatch = dbLine.match(/keys=(\d+)/);
          if (keysMatch) redisTotalKeys = parseInt(keysMatch[1]);
        }

        // 获取内存信息
        const memoryInfo = await r.info('memory');
        const parsed = parseRedisInfo(memoryInfo);
        redisUsedMemoryBytes = parseInt(parsed['used_memory'] || '0');
        redisUsedMemory = parsed['used_memory_human'] || formatBytes(redisUsedMemoryBytes);
        redisPeakMemory = parsed['used_memory_peak_human'] || '0B';
      } catch {
        // memory/keyspace info 不可用时，回退到 DBSIZE
        try {
          redisTotalKeys = await r.dbsize();
        } catch {
          // skip
        }
      }

      // 获取 Redis 版本和运行时间
      try {
        const serverInfo = await r.info('server');
        const parsed = parseRedisInfo(serverInfo);
        redisVersion = parsed['redis_version'] || null;
        redisUptime = parsed['uptime_in_seconds'] || null;
      } catch {
        // skip
      }
    }
  } catch (err) {
    redisAvailable = false;
    cacheWarn('getCacheStats失败:', err instanceof Error ? err.message : err);
  }

  return {
    totalKeys: redisTotalKeys,
    validKeys: appKeyCount,
    expiredKeys: 0,
    memoryUsage: redisUsedMemory,
    memoryUsageBytes: redisUsedMemoryBytes,
    appKeyCount,
    appMemoryUsage,
    appMemoryUsageBytes,
    redisTotalKeys,
    redisUsedMemory,
    redisUsedMemoryBytes,
    redisPeakMemory,
    redisVersion,
    redisUptime,
    redisConnected: redisAvailable,
  };
}

// ==================== Redis-specific Functions ====================

export async function isRedisConnected(): Promise<boolean> {
  try {
    const r = await getRedis();
    if (r) {
      await r.ping();
      return true;
    }
  } catch (err) {
    redisAvailable = false;
    cacheWarn('isRedisConnected检测失败:', err instanceof Error ? err.message : err);
  }
  return false;
}

export async function getRedisInfo(): Promise<Record<string, string> | null> {
  try {
    const r = await getRedis();
    if (!r) return null;

    const info = await r.info();
    return parseRedisInfo(info);
  } catch (err) {
    cacheWarn('getRedisInfo失败:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getRedisMemoryInfo(): Promise<{
  usedMemory: string;
  usedMemoryBytes: number;
  peakMemory: string;
  peakMemoryBytes: number;
  fragmentationRatio: string;
  totalSystemMemory: string;
  totalSystemMemoryBytes: number;
} | null> {
  try {
    const r = await getRedis();
    if (!r) return null;

    const info = await r.info('memory');
    const parsed = parseRedisInfo(info);

    return {
      usedMemory: parsed['used_memory_human'] || '0B',
      usedMemoryBytes: parseInt(parsed['used_memory'] || '0'),
      peakMemory: parsed['used_memory_peak_human'] || '0B',
      peakMemoryBytes: parseInt(parsed['used_memory_peak'] || '0'),
      fragmentationRatio: parsed['mem_fragmentation_ratio'] || '0',
      totalSystemMemory: parsed['total_system_memory_human'] || '0B',
      totalSystemMemoryBytes: parseInt(parsed['total_system_memory'] || '0'),
    };
  } catch (err) {
    cacheWarn('getRedisMemoryInfo失败:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getRedisClientList(): Promise<{ connectedClients: number; totalConnectionsReceived: number; rejectedConnections: number } | null> {
  try {
    const r = await getRedis();
    if (!r) return null;

    const info = await r.info('clients');
    const parsed = parseRedisInfo(info);

    return {
      connectedClients: parseInt(parsed['connected_clients'] || '0'),
      totalConnectionsReceived: parseInt(parsed['total_connections_received'] || '0'),
      rejectedConnections: parseInt(parsed['rejected_connections'] || '0'),
    };
  } catch (err) {
    cacheWarn('getRedisClientList失败:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getRedisKeySpaceInfo(): Promise<{ keys: number; expires: number; avgTtl: number } | null> {
  try {
    const r = await getRedis();
    if (!r) return null;

    const info = await r.info('keyspace');
    const parsed = parseRedisInfo(info);

    const dbKey = `db${configuredRedisDb}`;
    const dbInfo = parsed[dbKey];
    if (!dbInfo) {
      return { keys: 0, expires: 0, avgTtl: 0 };
    }

    const keysMatch = dbInfo.match(/keys=(\d+)/);
    const expiresMatch = dbInfo.match(/expires=(\d+)/);
    const avgTtlMatch = dbInfo.match(/avg_ttl=(\d+)/);

    return {
      keys: keysMatch ? parseInt(keysMatch[1]) : 0,
      expires: expiresMatch ? parseInt(expiresMatch[1]) : 0,
      avgTtl: avgTtlMatch ? parseInt(avgTtlMatch[1]) : 0,
    };
  } catch (err) {
    cacheWarn('getRedisKeySpaceInfo失败:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getRedisCommandStats(): Promise<{ command: string; calls: number }[] | null> {
  try {
    const r = await getRedis();
    if (!r) return null;

    const info = await r.info('commandstats');
    const parsed = parseRedisInfo(info);

    const stats: { command: string; calls: number }[] = [];
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('cmdstat_')) {
        const command = key.replace('cmdstat_', '');
        const callsMatch = value.match(/calls=(\d+)/);
        if (callsMatch) {
          stats.push({ command, calls: parseInt(callsMatch[1]) });
        }
      }
    }

    stats.sort((a, b) => b.calls - a.calls);
    return stats.slice(0, 10);
  } catch (err) {
    cacheWarn('getRedisCommandStats失败:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ==================== Helper Functions ====================

function parseRedisInfo(info: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of info.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        result[key] = value;
      }
    }
  }
  return result;
}

async function scanKeys(r: NonNullable<typeof redis>, pattern: string, count: number = 100, maxKeys: number = 10000): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const result = await r.scan(cursor, 'MATCH', pattern, 'COUNT', count);
    cursor = result[0];
    keys.push(...result[1]);
    if (keys.length >= maxKeys) break;
  } while (cursor !== '0');
  return keys.slice(0, maxKeys);
}
