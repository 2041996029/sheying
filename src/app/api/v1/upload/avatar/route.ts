import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, getAuthUser } from '@/lib/response';
import { getStorageConfig, generateFilename, isValidFileSize } from '@/lib/storage/index';
import { uploadToLocal } from '@/lib/storage/local';
import { uploadToCos } from '@/lib/storage/cos';

// 头像允许的 MIME 类型
const AVATAR_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

// 头像最大 5MB
const AVATAR_MAX_SIZE_MB = 5;

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const auth = getAuthUser(request);
  if (!auth) {
    return error(40101, '未登录或Token无效', requestId);
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return error(40001, '请选择要上传的头像文件', requestId);
    }

    // 验证文件类型
    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      return error(40002, `不支持的头像格式: ${file.type}，仅支持 JPG/PNG/GIF/WebP`, requestId);
    }

    // 验证文件大小
    if (!isValidFileSize(file.size, AVATAR_MAX_SIZE_MB)) {
      return error(40003, `头像文件大小超过限制（最大${AVATAR_MAX_SIZE_MB}MB）`, requestId);
    }

    // 读取文件 buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 生成唯一文件名
    const filename = generateFilename(file.name);

    // 获取存储配置
    const config = await getStorageConfig();

    // 头像存入 avatars 子目录
    const subDir = 'avatars';

    // 根据配置选择存储方式
    let uploadResult;
    if (config.mode === 'cos') {
      uploadResult = await uploadToCos(buffer, filename, file.type, config, subDir);
    } else {
      uploadResult = await uploadToLocal(buffer, filename, file.type, subDir);
    }

    // 自动更新用户 avatarUrl
    await db.user.update({
      where: { id: auth.userId },
      data: { avatarUrl: uploadResult.url },
    });

    return success({ url: uploadResult.url }, '头像上传成功', requestId);
  } catch (err) {
    console.error('Avatar upload error:', err);
    const msg = err instanceof Error ? err.message : '头像上传失败';
    return error(50001, msg, requestId);
  }
}
