import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { clearCacheByPrefix } from '@/lib/cache';
import { pickExif, tryParseDate } from '@/lib/exif-utils';
import { getDefaultExifConfig, mergeDefaultExif } from '@/lib/exif-defaults';
import exifr from 'exifr';

export async function POST(
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

    // 解析图片URL列表
    let imageUrls: string[] = [];
    try {
      imageUrls = typeof work.images === 'string' ? JSON.parse(work.images) : [];
    } catch {
      return error(50001, '作品图片数据解析失败', requestId);
    }

    if (imageUrls.length === 0) {
      return error(40001, '该作品没有图片', requestId);
    }

    // 解析旧的 params，用于保留手动编辑的 GPS 数据
    let oldParams: unknown = null;
    try {
      oldParams = work.params ? (typeof work.params === 'string' ? JSON.parse(work.params) : work.params) : null;
    } catch {
      // 旧 params 解析失败也无所谓，重新获取即可
    }

    // 逐张图片重新获取 EXIF
    const newParams: (Record<string, string | number | null> | null)[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const url of imageUrls) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          newParams.push(null);
          failCount++;
          continue;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) {
          newParams.push(null);
          failCount++;
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length > 50 * 1024 * 1024) {
          newParams.push(null);
          failCount++;
          continue;
        }

        // 提取 EXIF
        let exif: Record<string, string | number | null> | null = null;
        try {
          const rawExif = await exifr.parse(buffer, {
            tiff: true,
            exif: true,
            gps: true,
            icc: false,
            iptc: false,
            xmp: false,
            interop: false,
            translateKeys: true,
            translateValues: true,
            reviveValues: true,
          });
          if (rawExif && typeof rawExif === 'object') {
            exif = pickExif(rawExif);
            if (Object.keys(exif).length === 0) exif = null;
          }
        } catch {
          exif = null;
        }

        newParams.push(exif);
        if (exif) successCount++;
        else failCount++;
      } catch {
        newParams.push(null);
        failCount++;
      }
    }

    // 合并默认 EXIF（作者、相机）
    const defaults = await getDefaultExifConfig();

    // 合并策略：用新 EXIF 覆盖旧的拍摄参数，但保留手动编辑的 GPS/位置信息
    // GPS 同步到所有图片（同一作品集共享同一位置）
    // 默认作者/相机补充到每张图
    const mergedParams = newParams.map((newExif, i) => {
      // 先合并默认值
      let result = mergeDefaultExif(newExif, defaults);

      if (!result) return result;

      let oldExif: Record<string, unknown> | null = null;
      if (Array.isArray(oldParams) && oldParams[i] && typeof oldParams[i] === 'object') {
        oldExif = oldParams[i] as Record<string, unknown>;
      } else if (!Array.isArray(oldParams) && i === 0 && typeof oldParams === 'object' && oldParams !== null) {
        oldExif = oldParams as Record<string, unknown>;
      }

      // 如果新 EXIF 没有 GPS，但旧 params 有，保留旧的 GPS（同步到所有图片）
      if (oldExif && result.latitude == null && result.longitude == null) {
        if (oldExif.latitude != null) {
          result.latitude = oldExif.latitude as number;
          result.lat = oldExif.latitude as number;
        }
        if (oldExif.longitude != null) {
          result.longitude = oldExif.longitude as number;
          result.lng = oldExif.longitude as number;
        }
        if (oldExif.location != null && !result.location) {
          result.location = String(oldExif.location);
        }
      }

      // 如果作品本身有 GPS 坐标（Work.latitude/longitude），同步到所有图片的 params
      if (result.latitude == null && result.longitude == null) {
        if (work.latitude != null) {
          result.latitude = work.latitude;
          result.lat = work.latitude;
        }
        if (work.longitude != null) {
          result.longitude = work.longitude;
          result.lng = work.longitude;
        }
        if (work.location && !result.location) {
          result.location = work.location;
        }
      }

      return result;
    });

    const paramsJson = JSON.stringify(mergedParams);

    // 从新的 params 中提取 takenAt
    let takenAt: Date | null = null;
    try {
      for (const item of mergedParams) {
        if (item && typeof item === 'object') {
          const takenAtStr = item.takenAt || item.DateTimeOriginal || item.CreateDate || null;
          if (takenAtStr) {
            const parsed = tryParseDate(takenAtStr);
            if (parsed) {
              takenAt = new Date(parsed);
              break;
            }
          }
        }
      }
    } catch {
      // takenAt 解析失败不影响主流程
    }

    // 更新作品
    const updateData: Record<string, unknown> = {
      params: paramsJson,
    };
    if (takenAt) {
      updateData.takenAt = takenAt;
    }

    const updated = await db.work.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    await db.auditLog.create({
      data: {
        adminId: admin.userId,
        action: 'refresh_exif',
        targetType: 'work',
        targetId: id,
        detail: JSON.stringify({ successCount, failCount, totalImages: imageUrls.length }),
      },
    });

    await clearCacheByPrefix('works:');
    await clearCacheByPrefix('footprint:');

    return success({
      work: updated,
      result: {
        totalImages: imageUrls.length,
        successCount,
        failCount,
      },
    }, 'EXIF重新获取完成', requestId);
  } catch (err) {
    console.error('Refresh EXIF error:', err);
    const msg = err instanceof Error ? err.message : '重新获取EXIF失败';
    return error(50001, msg, requestId);
  }
}
