import { NextRequest } from 'next/server';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { getStorageConfig, generateFilename, isValidImageType, isValidFileSize } from '@/lib/storage/index';
import { uploadToLocal } from '@/lib/storage/local';
import { uploadToCos } from '@/lib/storage/cos';
import exifr from 'exifr';
import { pickExif } from '@/lib/exif-utils';
import { getDefaultExifConfig, mergeDefaultExif } from '@/lib/exif-defaults';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return error(40001, '请选择要上传的文件', requestId);
    }

    // 验证文件类型
    if (!isValidImageType(file.type)) {
      return error(40002, `不支持的文件类型: ${file.type}，仅支持 JPEG/PNG/GIF/WebP/BMP/SVG/AVIF`, requestId);
    }

    // 验证文件大小
    if (!isValidFileSize(file.size)) {
      return error(40003, `文件大小超过限制 (最大20MB)`, requestId);
    }

    // 读取文件 buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 生成唯一文件名
    const filename = generateFilename(file.name);

    // 获取存储配置
    const config = await getStorageConfig();

    // 根据配置选择存储方式
    let uploadResult;
    if (config.mode === 'cos') {
      uploadResult = await uploadToCos(buffer, filename, file.type, config, config.uploadDir);
    } else {
      uploadResult = await uploadToLocal(buffer, filename, file.type, config.uploadDir);
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
        // 如果 EXIF 为空对象则返回 null
        if (Object.keys(exif).length === 0) exif = null;
      }
    } catch {
      // EXIF 解析失败不影响上传，返回 null
      exif = null;
    }

    // 合并默认 EXIF（作者、相机）
    const defaults = await getDefaultExifConfig();
    exif = mergeDefaultExif(exif, defaults);

    return success({
      url: uploadResult.url,
      filename: uploadResult.filename,
      size: uploadResult.size,
      type: uploadResult.type,
      exif,
    }, '上传成功', requestId);
  } catch (err) {
    console.error('Upload error:', err);
    const msg = err instanceof Error ? err.message : '上传失败';
    return error(50001, msg, requestId);
  }
}
