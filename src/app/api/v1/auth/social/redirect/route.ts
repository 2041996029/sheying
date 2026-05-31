import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, recordApiError } from '@/lib/response';
import { getSocialLoginConfig } from '../providers/route';

/**
 * GET /api/v1/auth/social/redirect?type=qq
 * 获取第三方登录跳转地址
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type) {
      return error(40001, '请指定登录方式(type)', requestId);
    }

    const config = await getSocialLoginConfig();

    if (!config.enabled) {
      return error(40002, '聚合登录未启用', requestId);
    }

    if (!config.appid || !config.appkey) {
      return error(40003, '聚合登录未配置AppID或AppKey', requestId);
    }

    if (!config.providers.includes(type)) {
      return error(40004, `登录方式 ${type} 未启用`, requestId);
    }

    if (!config.redirectUri) {
      return error(40005, '回调地址未配置', requestId);
    }

    // 调用华年聚合登录接口获取跳转地址
    const loginUrl = `https://login.cxwa.net/connect.php?act=login&appid=${encodeURIComponent(config.appid)}&appkey=${encodeURIComponent(config.appkey)}&type=${encodeURIComponent(type)}&redirect_uri=${encodeURIComponent(config.redirectUri)}`;

    const res = await fetch(loginUrl);
    const data = await res.json();

    if (data.code !== 0) {
      console.error('Social login redirect error:', data);
      return error(50002, data.msg || '获取登录地址失败', requestId);
    }

    return success({
      type: data.type,
      url: data.url,
      qrcode: data.qrcode || null,
    }, 'ok', requestId);
  } catch (err) {
    console.error('Social login redirect error:', err);
    recordApiError({ request, statusCode: 500, errorMessage: String(err), startTime });
    return error(50001, '获取登录地址失败', requestId);
  }
}
