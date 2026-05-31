// 文件上传存储抽象层
// 支持本地存储(local)和腾讯云COS(cos)两种模式

import path from 'path';
import { db } from '@/lib/db';

export type StorageMode = 'local' | 'cos';

export interface UploadResult {
  url: string;        // 访问URL
  filename: string;   // 文件名
  size: number;       // 文件大小(bytes)
  type: string;       // MIME类型
  storageMode: StorageMode; // 存储模式
}

export interface StorageConfig {
  mode: StorageMode;
  uploadDir: string;  // 上传子目录
  // COS 配置
  cosBucket?: string;
  cosRegion?: string;
  cosAppid?: string;
  cosCdnUrl?: string;
  cosSecretId?: string;
  cosSecretKey?: string;
}

// 从数据库读取存储配置
export async function getStorageConfig(): Promise<StorageConfig> {
  try {
    const keys = ['cos_storage_mode', 'cos_bucket', 'cos_region', 'cos_appid', 'cos_cdn_url', 'cos_secret_id', 'cos_secret_key', 'cos_upload_dir'];
    const configs = await db.config.findMany({
      where: { key: { in: keys } },
    });

    const getConfig = (key: string) => configs.find((c) => c.key === key)?.value || '';

    const storageMode = getConfig('cos_storage_mode'); // 'local' or 'cos'
    const cosBucket = getConfig('cos_bucket');
    const cosRegion = getConfig('cos_region');
    const cosAppid = getConfig('cos_appid');
    const cosCdnUrl = getConfig('cos_cdn_url');
    const cosSecretId = getConfig('cos_secret_id');
    const cosSecretKey = getConfig('cos_secret_key');
    const uploadDir = getConfig('cos_upload_dir') || 'works';

    // 判断存储模式：优先使用用户手动配置的模式
    // 如果用户选了COS但配置不完整，则回退到local
    let mode: StorageMode = 'local';
    if (storageMode === 'cos') {
      const cosConfigured = !!(cosBucket && cosRegion && cosSecretId && cosSecretKey);
      if (cosConfigured) {
        mode = 'cos';
      }
    }

    return {
      mode,
      uploadDir,
      cosBucket,
      cosRegion,
      cosAppid,
      cosCdnUrl,
      cosSecretId,
      cosSecretKey,
    };
  } catch {
    // 数据库读取失败时回退到本地存储
    return { mode: 'local', uploadDir: 'works' };
  }
}

// 生成唯一文件名
export function generateFilename(originalName: string): string {
  // 使用path.extname获取扩展名，避免无扩展名时取到文件名本身
  const ext = path.extname(originalName).slice(1) || 'jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}_${random}.${ext}`;
}

// 验证文件类型
export function isValidImageType(mimeType: string): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    'image/avif',
  ];
  return allowedTypes.includes(mimeType);
}

// 验证文件大小（默认最大20MB）
export function isValidFileSize(size: number, maxSizeMB = 20): boolean {
  return size > 0 && size <= maxSizeMB * 1024 * 1024;
}
