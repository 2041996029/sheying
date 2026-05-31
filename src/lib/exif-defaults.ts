/**
 * 获取后台配置的默认 EXIF 字段（作者、相机等）
 * 用于上传/刷新 EXIF 时自动合并
 */
import { db } from '@/lib/db';
import { getCache, setCache } from '@/lib/cache';

const CACHE_TTL = 300; // 5分钟缓存

export interface DefaultExifConfig {
  author: string | null;
  camera: string | null;
}

export async function getDefaultExifConfig(): Promise<DefaultExifConfig> {
  const cacheKey = 'configs:default_exif';
  const cached = await getCache<DefaultExifConfig>(cacheKey);
  if (cached) return cached;

  try {
    const keys = ['default_exif_author', 'default_exif_camera'];
    const configs = await db.config.findMany({
      where: { key: { in: keys } },
    });

    const getVal = (key: string) => configs.find((c) => c.key === key)?.value || null;

    const result: DefaultExifConfig = {
      author: getVal('default_exif_author'),
      camera: getVal('default_exif_camera'),
    };

    await setCache(cacheKey, result, CACHE_TTL);
    return result;
  } catch {
    return { author: null, camera: null };
  }
}

/**
 * 将默认 EXIF 配置合并到单张图片的 EXIF 数据中
 * 原则：不覆盖已有值，只在字段为空时补充默认值
 */
export function mergeDefaultExif(
  exif: Record<string, string | number | null> | null,
  defaults: DefaultExifConfig
): Record<string, string | number | null> | null {
  if (!defaults.author && !defaults.camera) return exif;

  const result = exif ? { ...exif } : {};

  if (defaults.author && !result.author) {
    result.author = defaults.author;
  }
  if (defaults.camera && !result.camera) {
    result.camera = defaults.camera;
  }

  return result;
}

/**
 * 将 GPS 信息同步到 params 数组的所有元素
 * 同一作品集共享同一位置信息
 */
export function syncGpsToAllParams(
  paramsData: unknown,
  gpsFields: Record<string, unknown>
): unknown {
  if (!gpsFields || Object.keys(gpsFields).length === 0) return paramsData;

  if (Array.isArray(paramsData)) {
    return paramsData.map((item: unknown) => {
      if (typeof item === 'object' && item !== null) {
        return { ...item, ...gpsFields };
      }
      // 如果元素是 null，用 gpsFields 替代
      return { ...gpsFields };
    });
  } else if (typeof paramsData === 'object' && paramsData !== null) {
    return { ...paramsData, ...gpsFields };
  }

  return paramsData;
}
