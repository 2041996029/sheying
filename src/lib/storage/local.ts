// 本地文件存储实现

import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { UploadResult, type StorageMode } from './index';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

/**
 * 将文件保存到本地 uploads 目录
 * 返回可访问的 URL 路径
 */
export async function uploadToLocal(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  subDir = 'works'
): Promise<UploadResult> {
  // 安全过滤文件名：只取basename，防止路径穿越攻击（如 ../../../etc/passwd）
  const safeFilename = path.basename(filename);
  if (!safeFilename || safeFilename.startsWith('.')) {
    throw new Error('Invalid filename');
  }

  // 确保目录存在
  const targetDir = path.resolve(path.join(UPLOAD_DIR, subDir));
  await mkdir(targetDir, { recursive: true });

  // 写入文件 + 额外校验：确保解析后的路径仍在目标目录内
  const filePath = path.resolve(path.join(targetDir, safeFilename));
  if (!filePath.startsWith(targetDir + path.sep)) {
    throw new Error('Invalid file path: path traversal detected');
  }
  await writeFile(filePath, fileBuffer);

  // 返回本地访问 URL
  const url = `/uploads/${subDir}/${safeFilename}`;

  return {
    url,
    filename: safeFilename,
    size: fileBuffer.length,
    type: mimeType,
    storageMode: 'local' as StorageMode,
  };
}
