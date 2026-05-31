import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { clearCacheByPrefix } from '@/lib/cache';
import { tryParseDate } from '@/lib/exif-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { id } = await params;

    const work = await db.work.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    if (!work) {
      return error(40401, '作品不存在', requestId);
    }

    return success(work, '获取成功', requestId);
  } catch (err) {
    console.error('Get work error:', err);
    return error(50001, '获取作品失败', requestId);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;
  const admin = adminResult;

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, images, category_id, tags, params: workParams, is_featured, status, location, latitude, longitude } = body;

    const work = await db.work.findFirst({ where: { id, deletedAt: null } });
    if (!work) {
      return error(40401, '作品不存在', requestId);
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (images !== undefined) {
      data.images = typeof images === 'string' ? images : JSON.stringify(images);
      const imagesArray = JSON.parse(data.images as string);
      data.coverUrl = imagesArray[0] || work.coverUrl;
    }
    if (category_id !== undefined) {
      if (category_id) {
        // Validate category exists before connecting
        const categoryExists = await db.category.findFirst({ where: { id: category_id, deletedAt: null } });
        if (!categoryExists) {
          return error(40004, '分类不存在，请重新选择分类', requestId);
        }
        data.category = { connect: { id: category_id } };
      } else {
        data.category = { disconnect: true };
      }
    }
    if (tags !== undefined) {
      data.tags = typeof tags === 'string' ? tags : JSON.stringify(tags);
    }
    // 解析经纬度
    let parsedLat: number | null | undefined;
    let parsedLng: number | null | undefined;
    if (latitude !== undefined) {
      const lat = latitude != null ? parseFloat(latitude) : null;
      parsedLat = (lat != null && !isNaN(lat)) ? lat : null;
      data.latitude = parsedLat;
    }
    if (longitude !== undefined) {
      const lng = longitude != null ? parseFloat(longitude) : null;
      parsedLng = (lng != null && !isNaN(lng)) ? lng : null;
      data.longitude = parsedLng;
    }
    if (location !== undefined) data.location = location || null;
    if (is_featured !== undefined) data.isFeatured = is_featured;
    if (status !== undefined) data.status = status;

    // 当经纬度或地点被更新时，同步写回 params JSON，保持数据一致性
    // 策略：在原有 params 上追加 GPS 字段，绝不覆盖/重建，避免丢失 EXIF 拍摄参数
    const shouldSyncToParams = (parsedLat !== undefined && parsedLat != null)
      || (parsedLng !== undefined && parsedLng != null)
      || (location !== undefined && location);

    if (shouldSyncToParams) {
      try {
        // 取当前 params 数据（优先用前端传的，否则用数据库已有的）
        let currentParams: unknown = null;
        if (workParams !== undefined) {
          currentParams = typeof workParams === 'string' ? JSON.parse(workParams) : workParams;
        } else if (work.params) {
          currentParams = typeof work.params === 'string' ? JSON.parse(work.params) : work.params;
        }

        // 要追加的 GPS 字段
        const gpsFields: Record<string, unknown> = {};
        if (parsedLat !== undefined && parsedLat != null) {
          gpsFields.latitude = parsedLat;
          gpsFields.lat = parsedLat;
        }
        if (parsedLng !== undefined && parsedLng != null) {
          gpsFields.longitude = parsedLng;
          gpsFields.lng = parsedLng;
        }
        if (location !== undefined && location) {
          gpsFields.location = location;
        }

        if (Array.isArray(currentParams)) {
          // 多图 EXIF 数组：追加 GPS 到所有元素（同一作品集共享同一位置）
          const updatedArray = currentParams.map((item: unknown) => {
            if (typeof item === 'object' && item !== null) {
              return { ...item, ...gpsFields };
            }
            // null 元素也填入 GPS
            return { ...gpsFields };
          });
          data.params = JSON.stringify(updatedArray);
        } else if (typeof currentParams === 'object' && currentParams !== null) {
          // 单对象 params：追加 GPS 字段
          data.params = JSON.stringify({ ...currentParams, ...gpsFields });
        } else {
          // params 为空/null，创建只含 GPS 的新对象
          data.params = JSON.stringify(gpsFields);
        }
      } catch {
        // params 解析失败时不影响主流程
      }
    } else if (workParams !== undefined) {
      // 仅更新 params，不涉及经纬度同步
      data.params = typeof workParams === 'string' ? workParams : JSON.stringify(workParams);
    }

    // 当 params 被更新时，同步提取 takenAt 到独立字段
    if (data.params !== undefined) {
      try {
        const paramsObj = typeof data.params === 'string' ? JSON.parse(data.params) : data.params;
        if (paramsObj && typeof paramsObj === 'object' && !Array.isArray(paramsObj)) {
          const takenAtStr = paramsObj.takenAt || paramsObj.DateTimeOriginal || paramsObj.CreateDate || null;
          if (takenAtStr) {
            const parsed = tryParseDate(takenAtStr);
            if (parsed) data.takenAt = new Date(parsed);
          }
        } else if (Array.isArray(paramsObj)) {
          // 多图 EXIF 数组：遍历找第一个有 takenAt 的元素
          for (const item of paramsObj) {
            if (item && typeof item === 'object') {
              const takenAtStr = item.takenAt || item.DateTimeOriginal || item.CreateDate || null;
              if (takenAtStr) {
                const parsed = tryParseDate(takenAtStr);
                if (parsed) data.takenAt = new Date(parsed);
                break;
              }
            }
          }
        }
      } catch {
        // params 解析失败时不影响主流程
      }
    }

    const updated = await db.work.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'update_work',
        targetType: 'work',
        targetId: id,
        detail: JSON.stringify({ updates: Object.keys(data) }),
      },
    });

    await clearCacheByPrefix('works:');
    await clearCacheByPrefix('footprint:');
    await clearCacheByPrefix('stats:');

    return success(updated, '更新成功', requestId);
  } catch (err) {
    console.error('Update work error:', err);
    const msg = err instanceof Error ? err.message : '更新作品失败';
    return error(50001, msg, requestId);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;
  const admin = adminResult;

  try {
    const { id } = await params;

    const work = await db.work.findFirst({ where: { id, deletedAt: null } });
    if (!work) {
      return error(40401, '作品不存在', requestId);
    }

    // Soft delete
    await db.work.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // 同步清理关联数据：收藏、点赞、浏览历史
    await Promise.all([
      db.favorite.deleteMany({ where: { workId: id } }),
      db.like.deleteMany({ where: { workId: id } }),
      db.browseHistory.deleteMany({ where: { workId: id } }),
    ]);

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'delete_work',
        targetType: 'work',
        targetId: id,
        detail: JSON.stringify({ title: work.title }),
      },
    });

    await clearCacheByPrefix('works:');
    await clearCacheByPrefix('categories:');
    await clearCacheByPrefix('footprint:');
    await clearCacheByPrefix('stats:');

    return success(null, '删除成功', requestId);
  } catch (err) {
    console.error('Delete work error:', err);
    return error(50001, '删除作品失败', requestId);
  }
}
