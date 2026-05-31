import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId } from '@/lib/response';

// 华年聚合登录支持的登录方式
export const SOCIAL_PROVIDERS: Record<string, { name: string; icon: string }> = {
  qq: { name: 'QQ', icon: 'qq' },
  wx: { name: '微信', icon: 'wechat' },
  alipay: { name: '支付宝', icon: 'alipay' },
  sina: { name: '微博', icon: 'weibo' },
  baidu: { name: '百度', icon: 'baidu' },
  douyin: { name: '抖音', icon: 'douyin' },
  huawei: { name: '华为', icon: 'huawei' },
  xiaomi: { name: '小米', icon: 'xiaomi' },
  google: { name: 'Google', icon: 'google' },
  microsoft: { name: 'Microsoft', icon: 'microsoft' },
  facebook: { name: 'Facebook', icon: 'facebook' },
  twitter: { name: 'Twitter', icon: 'twitter' },
  feishu: { name: '飞书', icon: 'feishu' },
  wework: { name: '企业微信', icon: 'wework' },
  dingtalk: { name: '钉钉', icon: 'dingtalk' },
  gitee: { name: 'Gitee', icon: 'gitee' },
  github: { name: 'GitHub', icon: 'github' },
};

// 获取聚合登录配置
export async function getSocialLoginConfig() {
  const keys = ['social_login_enabled', 'social_login_appid', 'social_login_appkey', 'social_login_providers', 'social_login_redirect_uri'];
  const configs = await db.config.findMany({
    where: { key: { in: keys } },
  });
  const get = (key: string) => configs.find((c) => c.key === key)?.value || '';
  return {
    enabled: get('social_login_enabled') === 'true',
    appid: get('social_login_appid'),
    appkey: get('social_login_appkey'),
    providers: JSON.parse(get('social_login_providers') || '[]') as string[],
    redirectUri: get('social_login_redirect_uri'),
  };
}

/**
 * GET /api/v1/auth/social/providers
 * 获取前端可用的第三方登录方式列表（公开接口）
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const config = await getSocialLoginConfig();

    if (!config.enabled) {
      return success({ enabled: false, providers: [] }, 'ok', requestId);
    }

    // 只返回已启用的登录方式
    const providers = config.providers
      .filter((p) => SOCIAL_PROVIDERS[p])
      .map((p) => ({
        type: p,
        name: SOCIAL_PROVIDERS[p].name,
        icon: SOCIAL_PROVIDERS[p].icon,
      }));

    return success({ enabled: true, providers }, 'ok', requestId);
  } catch (err) {
    console.error('Get social providers error:', err);
    return error(50001, '获取登录方式失败', requestId);
  }
}
