import { NextRequest } from 'next/server';
import { success, error, getRequestId } from '@/lib/response';
import { generateWorkQrCode } from '@/lib/wechat';

/**
 * GET /api/v1/works/[id]/qrcode
 * 获取作品分享小程序码
 * 公开接口，任何人都可获取已发布作品的小程序码
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);

  try {
    const { id } = await params;

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const envVersion = searchParams.get('env_version') as 'release' | 'trial' | 'develop' | null;
    const width = searchParams.get('width');
    const force = searchParams.get('force') === 'true'; // 强制重新生成

    const result = await generateWorkQrCode({
      workId: id,
      envVersion: envVersion || undefined,
      width: width ? parseInt(width) : undefined,
      isHyaline: false,
    }, force);

    return success(result, '获取小程序码成功', requestId);
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成小程序码失败';
    console.error('Generate QR code error:', err);

    // 区分不同的错误类型
    if (message.includes('未配置') || message.includes('AppID')) {
      return error(50002, message, requestId);
    }
    if (message.includes('不存在')) {
      return error(40401, message, requestId);
    }
    if (message.includes('微信') || message.includes('access_token') || message.includes('errcode')) {
      return error(50301, message, requestId);
    }

    return error(50001, message, requestId);
  }
}
