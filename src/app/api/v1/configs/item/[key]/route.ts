import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { clearCacheByPrefix, setRedisConfig, setRedisUrl, setCacheEnabled, setDefaultCacheTtl } from '@/lib/cache';
import { setAccessTokenTtl, setRefreshTokenTtl } from '@/lib/auth';
import { CONFIG_DEFAULTS } from '@/lib/config-defaults';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;
  const admin = adminResult;

  try {
    const { key } = await params;
    const body = await request.json();
    const { value } = body;

    if (value === undefined || value === null) {
      return error(40001, 'value不能为空', requestId);
    }

    // Check if config exists, if not try to create from defaults
    let config = await db.config.findUnique({ where: { key } });
    if (!config) {
      // Try to create from CONFIG_DEFAULTS
      const defaultConfig = CONFIG_DEFAULTS[key];
      if (defaultConfig) {
        try {
          config = await db.config.create({
            data: {
              key,
              value: defaultConfig.value,
              group: defaultConfig.group,
              description: defaultConfig.description,
              isEncrypted: defaultConfig.isEncrypted || false,
            },
          });
        } catch (createErr) {
          console.error(`Failed to create config "${key}":`, createErr);
          return error(40401, '配置项不存在且创建失败', requestId);
        }
      } else {
        return error(40401, '配置项不存在', requestId);
      }
    }

    const updated = await db.config.update({
      where: { key },
      data: { value: String(value) },
    });

    // Audit log - non-blocking
    db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'update_config',
        targetType: 'config',
        targetId: key,
        detail: JSON.stringify({ key, oldValue: config.value, newValue: value }),
      },
    }).catch(() => {});

    // If Redis config changed, update the cache module
    if (key === 'redis_host' || key === 'redis_port' || key === 'redis_password' || key === 'redis_db') {
      try {
        const [hostConfig, portConfig, passwordConfig, dbConfig] = await Promise.all([
          db.config.findUnique({ where: { key: 'redis_host' } }),
          db.config.findUnique({ where: { key: 'redis_port' } }),
          db.config.findUnique({ where: { key: 'redis_password' } }),
          db.config.findUnique({ where: { key: 'redis_db' } }),
        ]);
        setRedisConfig(
          hostConfig?.value || '',
          portConfig?.value || '6379',
          passwordConfig?.value || undefined,
          dbConfig?.value || '0',
        );
      } catch (redisErr) {
        console.error('Failed to update Redis config:', redisErr);
      }
    }
    // If cache_type changed, update the cache module
    if (key === 'cache_type') {
      try {
        const { setCacheType } = await import('@/lib/cache');
        setCacheType(String(value));
      } catch (cacheErr) {
        console.error('Failed to update cache type:', cacheErr);
      }
    }
    // If cache_enabled changed, update the cache module
    if (key === 'cache_enabled') {
      setCacheEnabled(String(value) === 'true');
    }
    // If cache_ttl changed, update the default TTL
    if (key === 'cache_ttl') {
      const ttl = parseInt(String(value), 10);
      if (!isNaN(ttl) && ttl > 0) {
        setDefaultCacheTtl(ttl);
      }
    }
    // Legacy: if redis_url still exists and is changed
    if (key === 'redis_url') {
      setRedisUrl(String(value));
    }
    // If auth token TTL changed, update the auth module
    if (key === 'auth_access_token_ttl') {
      const ttl = parseInt(String(value), 10);
      if (!isNaN(ttl) && ttl > 0) {
        setAccessTokenTtl(ttl);
      }
    }
    if (key === 'auth_refresh_token_ttl') {
      const ttl = parseInt(String(value), 10);
      if (!isNaN(ttl) && ttl > 0) {
        setRefreshTokenTtl(ttl);
      }
    }

    // Clear configs cache
    await clearCacheByPrefix('configs:');

    // If security config changed, invalidate guard in-memory cache
    // proxy.ts reads directly from DB, no need to repopulate Redis
    if (key.startsWith('security_')) {
      try {
        const { invalidateGuardCache } = await import('@/lib/api-guard');
        invalidateGuardCache();
      } catch (err) {
        console.error('Failed to invalidate guard cache:', err);
      }
    }

    return success(updated, '更新成功', requestId);
  } catch (err) {
    console.error('Update config error:', err);
    const message = err instanceof Error ? err.message : '更新配置失败';
    return error(50001, `更新配置失败: ${message}`, requestId);
  }
}
