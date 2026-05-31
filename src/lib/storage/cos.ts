// 腾讯云COS存储实现

import path from 'path';
import { UploadResult, type StorageConfig, type StorageMode } from './index';

// 缓存COS客户端实例
// eslint-disable-next-line @typescript-eslint/no-require-imports
const COS = require('cos-nodejs-sdk-v5');
let cosClient: InstanceType<typeof COS> | null = null;
let lastConfigKey = '';

async function getCosClient(config: StorageConfig) {
  // cos-nodejs-sdk-v5 在 serverExternalPackages 中，不经过 Turbopack 打包

  const configKey = `${config.cosSecretId}_${config.cosSecretKey}`;
  if (cosClient && configKey === lastConfigKey) {
    return cosClient;
  }

  cosClient = new COS({
    SecretId: config.cosSecretId!,
    SecretKey: config.cosSecretKey!,
  });
  lastConfigKey = configKey;
  return cosClient;
}

/**
 * 将文件上传到腾讯云COS
 * 返回CDN或直接访问URL
 */
export async function uploadToCos(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  config: StorageConfig,
  subDir = 'works'
): Promise<UploadResult> {
  // 安全过滤文件名：只取basename，防止路径穿越攻击（与 local.ts 保持一致）
  const safeFilename = path.basename(filename);
  if (!safeFilename || safeFilename.startsWith('.')) {
    throw new Error('Invalid filename');
  }

  const cos = await getCosClient(config);
  const key = `${subDir}/${safeFilename}`;

  await new Promise<void>((resolve, reject) => {
    cos.putObject(
      {
        Bucket: config.cosBucket!,
        Region: config.cosRegion!,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        ContentLength: fileBuffer.length,
      },
      (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  // 优先使用CDN域名，否则使用COS默认域名
  let url: string;
  if (config.cosCdnUrl) {
    const cdnBase = config.cosCdnUrl.replace(/\/+$/, '');
    url = `${cdnBase}/${key}`;
  } else {
    if (!config.cosAppid) {
      throw new Error('缺少腾讯云COS AppId配置，请在后台配置cos_appid');
    }
    url = `https://${config.cosBucket}-${config.cosAppid}.cos.${config.cosRegion}.myqcloud.com/${key}`;
  }

  return {
    url,
    filename: safeFilename,
    size: fileBuffer.length,
    type: mimeType,
    storageMode: 'cos' as StorageMode,
  };
}
