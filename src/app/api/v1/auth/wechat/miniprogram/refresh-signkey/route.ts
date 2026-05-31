import { NextRequest } from 'next/server';
import { success, error, getRequestId, getAuthUser } from '@/lib/response';
import { issueMiniprogramSignKey, loadGuardConfig } from '@/lib/api-guard';

/**
 * POST /api/v1/auth/wechat/miniprogram/refresh-signkey
 * 刷新小程序动态签名密钥。
 *
 * 当小程序的 signKey 过期时，使用有效的 JWT Token 调用此接口获取新的 signKey。
 * 此接口在 api-guard 的 SKIP_AUTH_PATHS 中，不需要签名验证，但需要有效的 JWT。
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    // 验证 JWT Token（必须已登录）
    const authUser = getAuthUser(request);
    if (!authUser) {
      return error(40101, '未登录或Token无效', requestId);
    }

    // 加载 Guard 配置获取小程序客户端 AppId
    const guardConfig = await loadGuardConfig();
    if (!guardConfig.enabled) {
      return error(40001, 'API访问控制未启用', requestId);
    }

    const mpClient = guardConfig.clients.find(c => c.clientType === 'miniprogram' && c.enabled);
    if (!mpClient) {
      return error(40002, '未配置小程序客户端凭证', requestId);
    }

    // 签发新的动态签名密钥
    const signKeyData = await issueMiniprogramSignKey(authUser.userId, mpClient.appId);

    return success(
      {
        sign_key: signKeyData.signKey,
        sign_key_ref: signKeyData.signKeyRef,
        sign_key_expires_at: signKeyData.expiresAt,
      },
      '签名密钥已刷新',
      requestId
    );
  } catch (err) {
    console.error('Refresh signKey error:', err);
    return error(50001, '刷新签名密钥失败', requestId);
  }
}
