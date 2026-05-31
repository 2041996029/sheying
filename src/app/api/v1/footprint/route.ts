import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId } from '@/lib/response';
import { getCache, setCache } from '@/lib/cache';

interface FootprintItem {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  latitude: number;
  longitude: number;
  location: string | null;
  takenAt: string | null;
  createdAt: string;
  sortTime: string; // 用于排序的实际时间（takenAt 优先，否则 createdAt）
  category: { id: string; name: string } | null;
}

const FOOTPRINT_CACHE_KEY = 'footprint:all';
const FOOTPRINT_CACHE_TTL = 600; // 10分钟，单位秒

/**
 * 从 params 中提取指定字段
 * params 可能是对象 {takenAt:...} 或数组 [{takenAt:...}, ...]
 * 数组时取第一个非空元素
 */
function extractFromParams(params: unknown, key: string): unknown | null {
  if (!params) return null;
  const obj = typeof params === 'string' ? JSON.parse(params) : params;
  if (!obj) return null;
  // 对象格式
  if (!Array.isArray(obj) && typeof obj === 'object') {
    return (obj as Record<string, unknown>)[key] ?? null;
  }
  // 数组格式：取第一个非空元素
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item && typeof item === 'object') {
        const val = (item as Record<string, unknown>)[key];
        if (val != null) return val;
      }
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    // 优先从 Redis 缓存获取
    const cachedData = await getCache<FootprintItem[]>(FOOTPRINT_CACHE_KEY);
    if (cachedData) {
      return success(cachedData, 'ok', requestId);
    }

    // 查询所有已发布作品：优先读取 latitude/longitude 独立列，其次从 params JSON 中提取
    // 排序策略：优先按拍摄时间 takenAt，无 takenAt 时降级为发布时间 createdAt
    // 由于 MySQL 不支持 COALESCE 于 Prisma orderBy，先按 createdAt 排序取出数据，再在内存中按 sortTime 重排
    // 限制最多500条记录，避免数据量过大导致OOM
    const works = await db.work.findMany({
      where: {
        status: 'published',
        deletedAt: null,
        OR: [
          { latitude: { not: null }, longitude: { not: null } },
          { params: { not: null } },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        coverUrl: true,
        params: true,
        latitude: true,
        longitude: true,
        location: true,
        takenAt: true,
        createdAt: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // 提取含 GPS 坐标的作品（去重：同一作品优先用独立列的值）
    const footprints: FootprintItem[] = [];
    const seen = new Set<string>();

    for (const work of works) {
      try {
        // 优先使用独立列的 latitude/longitude
        let lat: number | null = work.latitude;
        let lng: number | null = work.longitude;
        // 优先使用独立列的 takenAt，其次从 params JSON 提取
        let takenAt: string | null = work.takenAt ? work.takenAt.toISOString() : null;

        // 如果独立列没有值，尝试从 params JSON 中提取
        if ((lat == null || lng == null || !takenAt) && work.params) {
          if (lat == null) lat = Number(extractFromParams(work.params, 'latitude') ?? extractFromParams(work.params, 'lat')) || null;
          if (lng == null) lng = Number(extractFromParams(work.params, 'longitude') ?? extractFromParams(work.params, 'lng')) || null;
          if (!takenAt) {
            const rawTakenAt = extractFromParams(work.params, 'takenAt') || extractFromParams(work.params, 'DateTimeOriginal');
            takenAt = rawTakenAt ? String(rawTakenAt) : null;
          }
        }

        if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
          if (seen.has(work.id)) continue; // 去重
          seen.add(work.id);
          // 计算排序时间：takenAt 优先，否则降级为 createdAt
          const sortTime = takenAt || work.createdAt.toISOString();
          footprints.push({
            id: work.id,
            title: work.title,
            description: work.description,
            coverUrl: work.coverUrl,
            latitude: lat,
            longitude: lng,
            location: work.location,
            takenAt,
            createdAt: work.createdAt.toISOString(),
            sortTime,
            category: work.category,
          });
        }
      } catch {
        // params 解析失败，跳过
      }
    }

    // 按拍摄时间排序：takenAt 优先，无 takenAt 时用 createdAt
    // 降序排列（最新的在前）
    footprints.sort((a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime());

    // 写入 Redis 缓存
    await setCache(FOOTPRINT_CACHE_KEY, footprints, FOOTPRINT_CACHE_TTL);

    return success(footprints, 'ok', requestId);
  } catch (err) {
    console.error('Footprint API error:', err);
    return error(50001, '获取足迹数据失败', requestId);
  }
}
