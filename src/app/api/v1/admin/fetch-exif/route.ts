import { NextRequest } from 'next/server';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import exifr from 'exifr';
import { pickExif } from '@/lib/exif-utils';
import { getDefaultExifConfig, mergeDefaultExif } from '@/lib/exif-defaults';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return error(40001, '请提供图片URL', requestId);
    }

    // 下载远程图片
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000), // 15秒超时
    });

    if (!response.ok) {
      return error(40002, `无法获取图片: HTTP ${response.status}`, requestId);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return error(40003, 'URL指向的不是图片文件', requestId);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 限制远程图片大小（50MB）
    if (buffer.length > 50 * 1024 * 1024) {
      return error(40004, '远程图片文件过大', requestId);
    }

    // 提取 EXIF 信息
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

    // 合并默认 EXIF（作者、相机）
    const defaults = await getDefaultExifConfig();
    exif = mergeDefaultExif(exif, defaults);

    return success({ exif }, '获取EXIF成功', requestId);
  } catch (err) {
    console.error('Fetch EXIF error:', err);
    const msg = err instanceof Error ? err.message : '获取EXIF失败';
    return error(50001, msg, requestId);
  }
}
