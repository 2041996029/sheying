import { NextRequest } from 'next/server';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const body = await request.json();
    const { bucket, region, secret_id, secret_key } = body;

    if (!bucket || !region || !secret_id || !secret_key) {
      return error(40001, '请填写完整的COS配置（Bucket、Region、SecretId、SecretKey）', requestId);
    }

    // 动态加载 COS SDK（在 serverExternalPackages 中）
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const COS = require('cos-nodejs-sdk-v5');

    const cos = new COS({
      SecretId: secret_id,
      SecretKey: secret_key,
    });

    // 测试：获取 Bucket 基本信息（headBucket）
    await new Promise<void>((resolve, reject) => {
      cos.headBucket(
        {
          Bucket: bucket,
          Region: region,
        },
        (err: Error | null, data: { statusCode: number }) => {
          if (err) {
            reject(err);
          } else if (data.statusCode >= 400) {
            reject(new Error(`HTTP ${data.statusCode}`));
          } else {
            resolve();
          }
        }
      );
    });

    return success({ connected: true }, 'COS连接成功', requestId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'COS连接失败';
    console.error('COS test error:', msg);
    return error(50001, `COS连接失败: ${msg}`, requestId);
  }
}
