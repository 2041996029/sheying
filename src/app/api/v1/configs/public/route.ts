import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId } from '@/lib/response';
import { getCache, setCache } from '@/lib/cache';
import { PUBLIC_CONFIG_GROUPS, CONFIG_DEFAULTS } from '@/lib/config-defaults';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const cacheKey = 'configs:public';
    const cached = await getCache<Record<string, string>>(cacheKey);
    if (cached) {
      return success(cached, 'ok', requestId);
    }

    const configs = await db.config.findMany({
      where: {
        group: { in: PUBLIC_CONFIG_GROUPS },
      },
    });

    // 如果数据库中没有配置，返回默认值而不是报错
    const result: Record<string, string> = {};
    if (configs.length === 0) {
      for (const [key, config] of Object.entries(CONFIG_DEFAULTS)) {
        if (PUBLIC_CONFIG_GROUPS.includes(config.group) && !config.isEncrypted) {
          result[key] = config.value;
        }
      }
    } else {
      for (const config of configs) {
        if (!config.isEncrypted) {
          result[config.key] = config.value;
        }
      }
    }

    await setCache(cacheKey, result, 300);

    return success(result, 'ok', requestId);
  } catch (err) {
    console.error('Public configs error:', err);
    // 即使出错也尝试返回默认配置
    try {
      const fallback: Record<string, string> = {};
      for (const [key, config] of Object.entries(CONFIG_DEFAULTS)) {
        if (PUBLIC_CONFIG_GROUPS.includes(config.group) && !config.isEncrypted) {
          fallback[key] = config.value;
        }
      }
      return success(fallback, 'ok', requestId);
    } catch {
      return error(50001, '获取公开配置失败', requestId);
    }
  }
}
