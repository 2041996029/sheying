// Next.js Instrumentation - 服务器启动时执行
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // 仅在 Node.js 环境执行（不在 Edge 运行时）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { db } = await import('@/lib/db');
      const { setRedisConfig, setCacheEnabled, setDefaultCacheTtl } = await import('@/lib/cache');
      const { setAccessTokenTtl, setRefreshTokenTtl } = await import('@/lib/auth');

      // 从数据库加载 Redis 配置
      const [hostConfig, portConfig, passwordConfig, dbConfig, enabledConfig, ttlConfig, accessTtlConfig, refreshTtlConfig] = await Promise.all([
        db.config.findUnique({ where: { key: 'redis_host' } }),
        db.config.findUnique({ where: { key: 'redis_port' } }),
        db.config.findUnique({ where: { key: 'redis_password' } }),
        db.config.findUnique({ where: { key: 'redis_db' } }),
        db.config.findUnique({ where: { key: 'cache_enabled' } }),
        db.config.findUnique({ where: { key: 'cache_ttl' } }),
        db.config.findUnique({ where: { key: 'auth_access_token_ttl' } }),
        db.config.findUnique({ where: { key: 'auth_refresh_token_ttl' } }),
      ]);

      const host = hostConfig?.value || '';
      if (host) {
        setRedisConfig(
          host,
          portConfig?.value || '6379',
          passwordConfig?.value || undefined,
          dbConfig?.value || '0',
        );
        console.log(`[Instrumentation] Redis配置已从数据库加载: host=${host}, db=${dbConfig?.value || '0'}`);
      } else {
        console.log('[Instrumentation] 未配置Redis主机，缓存功能暂不可用');
      }

      // 加载缓存开关和默认TTL
      setCacheEnabled(enabledConfig?.value !== 'false');
      const ttl = parseInt(ttlConfig?.value || '300', 10);
      if (!isNaN(ttl) && ttl > 0) {
        setDefaultCacheTtl(ttl);
      }

      // 加载JWT Token有效期配置
      const accessTtl = parseInt(accessTtlConfig?.value || '7200', 10);
      if (!isNaN(accessTtl) && accessTtl > 0) {
        setAccessTokenTtl(accessTtl);
      }
      const refreshTtl = parseInt(refreshTtlConfig?.value || '604800', 10);
      if (!isNaN(refreshTtl) && refreshTtl > 0) {
        setRefreshTokenTtl(refreshTtl);
      }

      console.log(`[Instrumentation] 缓存配置已加载: enabled=${enabledConfig?.value !== 'false'}, ttl=${ttlConfig?.value || '300'}s`);
      console.log(`[Instrumentation] 认证配置已加载: accessTTL=${accessTtlConfig?.value || '7200'}s, refreshTTL=${refreshTtlConfig?.value || '604800'}s`);

      // 启动时自动修正数据库中 likeCount/favoriteCount 为负数的作品
      try {
        const negativeLikes = await db.work.updateMany({
          where: { likeCount: { lt: 0 } },
          data: { likeCount: 0 },
        });
        const negativeFavorites = await db.work.updateMany({
          where: { favoriteCount: { lt: 0 } },
          data: { favoriteCount: 0 },
        });
        if (negativeLikes.count > 0 || negativeFavorites.count > 0) {
          console.log(`[Instrumentation] 数据修正: 修正 likeCount<0 的作品 ${negativeLikes.count} 条, favoriteCount<0 的作品 ${negativeFavorites.count} 条`);
        }
      } catch (fixErr) {
        console.warn('[Instrumentation] 数据修正失败:', fixErr instanceof Error ? fixErr.message : fixErr);
      }
    } catch (err) {
      // 数据库可能尚未就绪，静默忽略
      console.warn('[Instrumentation] 加载配置失败（数据库可能尚未就绪）:', err instanceof Error ? err.message : err);
    }
  }
}
