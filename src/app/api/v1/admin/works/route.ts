import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, paginated, error, getRequestId, requireAdmin, getPagination, recordApiError } from '@/lib/response';
import { clearCacheByPrefix } from '@/lib/cache';
import { tryParseDate } from '@/lib/exif-utils';
import { incrementDailyStat } from '@/lib/daily-stats';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = getPagination(searchParams);
    const status = searchParams.get('status');
    const categoryId = searchParams.get('category_id');
    const search = searchParams.get('search');
    const featured = searchParams.get('featured');

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (featured === 'true') where.isFeatured = true;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [works, total] = await Promise.all([
      db.work.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true } },
        },
      }),
      db.work.count({ where }),
    ]);

    return paginated(works, total, page, pageSize, requestId);
  } catch (err) {
    console.error('Admin works list error:', err);
    recordApiError({ request, statusCode: 500, errorMessage: String(err), startTime });
    return error(50001, '获取作品列表失败', requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response; // error response
  const admin = adminResult;

  try {
    const body = await request.json();
    const { title, description, images, category_id, tags, params, is_featured, status, location, latitude, longitude } = body;

    if (!title || !images) {
      return error(40001, '标题和图片不能为空', requestId);
    }

    const parsedImages = typeof images === 'string' ? images : JSON.stringify(images);
    const parsedTags = tags ? (typeof tags === 'string' ? tags : JSON.stringify(tags)) : null;
    const parsedParams = params ? (typeof params === 'string' ? params : JSON.stringify(params)) : null;
    const parsedCategoryId = category_id || null;

    // 从 params JSON 中提取拍摄时间 takenAt
    // params 可能是对象 {takenAt:...} 或数组 [{takenAt:...}, ...]
    let parsedTakenAt: Date | null = null;
    if (parsedParams) {
      try {
        const paramsObj = typeof params === 'string' ? JSON.parse(params) : params;
        // 提取 takenAt：数组取第一个非空元素，对象直接取
        let takenAtStr: string | null = null;
        if (Array.isArray(paramsObj)) {
          for (const item of paramsObj) {
            if (item && typeof item === 'object') {
              takenAtStr = item.takenAt || item.DateTimeOriginal || item.CreateDate || null;
              if (takenAtStr) break;
            }
          }
        } else if (paramsObj && typeof paramsObj === 'object') {
          takenAtStr = paramsObj.takenAt || paramsObj.DateTimeOriginal || paramsObj.CreateDate || null;
        }
        if (takenAtStr) {
          const parsed = tryParseDate(takenAtStr);
          if (parsed) parsedTakenAt = new Date(parsed);
        }
      } catch {
        // params 解析失败不影响主流程
      }
    }

    // Validate category_id exists before connecting
    if (parsedCategoryId) {
      const categoryExists = await db.category.findFirst({
        where: { id: parsedCategoryId, deletedAt: null },
      });
      if (!categoryExists) {
        return error(40004, '分类不存在，请重新选择分类', requestId);
      }
    }

    // Get first image as cover
    const imagesArray = JSON.parse(parsedImages);
    const coverUrl = imagesArray[0] || null;

    // Safely parse latitude/longitude with NaN guard
    const parsedLat = latitude != null ? parseFloat(latitude) : null;
    const parsedLng = longitude != null ? parseFloat(longitude) : null;
    const safeLat = (parsedLat != null && !isNaN(parsedLat)) ? parsedLat : null;
    const safeLng = (parsedLng != null && !isNaN(parsedLng)) ? parsedLng : null;

    // 同步经纬度/地点到 params JSON，保持数据一致性
    // 策略：在原有 params 上追加 GPS 字段，绝不覆盖/重建
    const gpsFields: Record<string, unknown> = {};
    if (safeLat != null) { gpsFields.latitude = safeLat; gpsFields.lat = safeLat; }
    if (safeLng != null) { gpsFields.longitude = safeLng; gpsFields.lng = safeLng; }
    if (location) gpsFields.location = location;

    let finalParams = parsedParams;
    const hasGps = Object.keys(gpsFields).length > 0;

    if (hasGps && parsedParams) {
      try {
        const paramsData = JSON.parse(parsedParams);
        if (Array.isArray(paramsData)) {
          // 多图 EXIF 数组：追加 GPS 到所有元素（同一作品集共享同一位置）
          const updatedArray = paramsData.map((item: unknown) => {
            if (typeof item === 'object' && item !== null) {
              return { ...item, ...gpsFields };
            }
            // null 元素也填入 GPS
            return { ...gpsFields };
          });
          finalParams = JSON.stringify(updatedArray);
        } else if (typeof paramsData === 'object' && paramsData !== null) {
          finalParams = JSON.stringify({ ...paramsData, ...gpsFields });
        }
      } catch {
        // params 解析失败不影响主流程
      }
    } else if (hasGps && !parsedParams) {
      // 没有 params 但有 GPS，创建只含 GPS 的对象
      finalParams = JSON.stringify(gpsFields);
    }

    const work = await db.work.create({
      data: {
        title,
        description: description || null,
        images: parsedImages,
        coverUrl,
        category: parsedCategoryId ? { connect: { id: parsedCategoryId } } : undefined,
        tags: parsedTags,
        params: finalParams,
        isFeatured: is_featured ?? false,
        status: status || 'draft',
        location: location || null,
        latitude: safeLat,
        longitude: safeLng,
        takenAt: parsedTakenAt,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'create_work',
        targetType: 'work',
        targetId: work.id,
        detail: JSON.stringify({ title }),
      },
    });

    await clearCacheByPrefix('works:');
    await clearCacheByPrefix('categories:');
    await clearCacheByPrefix('footprint:');
    await clearCacheByPrefix('stats:');

    // 同步更新每日统计
    incrementDailyStat('newWorkCount');

    return success(work, '创建成功', requestId);
  } catch (err) {
    console.error('Create work error:', err);
    recordApiError({ request, statusCode: 500, errorMessage: String(err), startTime });
    const msg = err instanceof Error ? err.message : '创建作品失败';
    return error(50001, msg, requestId);
  }
}
