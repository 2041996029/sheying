import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, recordApiError } from '@/lib/response';
import { generateTokenPair } from '@/lib/auth';
import { storeRefreshToken } from '@/lib/refresh-token';
import { incrementDailyStat } from '@/lib/daily-stats';
import { getSocialLoginConfig } from '../providers/route';

/**
 * GET /api/v1/auth/social/callback?type=qq&code=xxx
 * 第三方登录回调处理
 * 1. 用 code 向华年聚合登录换取用户信息
 * 2. 根据 social_uid 查找或创建用户
 * 3. 返回 JWT token
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const code = searchParams.get('code');

    if (!type || !code) {
      return error(40001, '缺少type或code参数', requestId);
    }

    const config = await getSocialLoginConfig();

    if (!config.enabled) {
      return error(40002, '聚合登录未启用', requestId);
    }

    if (!config.appid || !config.appkey) {
      return error(40003, '聚合登录未配置', requestId);
    }

    // Step1: 用 code 向华年聚合登录换取用户信息
    const callbackUrl = `https://login.cxwa.net/connect.php?act=callback&appid=${encodeURIComponent(config.appid)}&appkey=${encodeURIComponent(config.appkey)}&type=${encodeURIComponent(type)}&code=${encodeURIComponent(code)}`;

    const socialRes = await fetch(callbackUrl);
    const socialData = await socialRes.json();

    if (socialData.code !== 0) {
      console.error('Social login callback error:', socialData);
      return error(50002, socialData.msg || '第三方登录失败', requestId);
    }

    const { social_uid, access_token, faceimg, nickname } = socialData;

    if (!social_uid) {
      return error(50003, '第三方登录返回数据异常', requestId);
    }

    // Step2: 根据 provider + social_uid 查找已绑定的社交账号
    let socialAccount = await db.socialAccount.findUnique({
      where: { provider_socialUid: { provider: type, socialUid: social_uid } },
      include: { user: true },
    });

    let user;

    if (socialAccount && socialAccount.user) {
      // 已绑定用户，直接登录
      user = socialAccount.user;

      // 更新社交账号信息（头像、昵称可能变化）
      await db.socialAccount.update({
        where: { id: socialAccount.id },
        data: {
          accessToken: access_token || socialAccount.accessToken,
          nickname: nickname || socialAccount.nickname,
          avatarUrl: faceimg || socialAccount.avatarUrl,
        },
      });
    } else {
      // 新用户，自动注册
      const defaultNickname = nickname || `${type}_${social_uid.substring(0, 8)}`;

      user = await db.user.create({
        data: {
          nickname: defaultNickname,
          avatarUrl: faceimg || null,
          role: 'user',
          status: 'active',
        },
      });

      // 创建社交账号绑定
      await db.socialAccount.create({
        data: {
          userId: user.id,
          provider: type,
          socialUid: social_uid,
          accessToken: access_token || null,
          nickname: nickname || null,
          avatarUrl: faceimg || null,
        },
      });

      // 同步更新每日统计
      incrementDailyStat('newUserCount');
    }

    // 检查用户状态
    if (user.status === 'banned') {
      return error(40301, '账号已被封禁', requestId);
    }
    if (user.deletedAt) {
      return error(40102, '账号已删除', requestId);
    }

    // Step3: 生成 JWT token
    const tokens = generateTokenPair(user.id, user.role);

    // 存储 refresh token
    await storeRefreshToken(user.id, tokens.refresh_token);

    return success({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      provider: type,
      isNewUser: !socialAccount,
    }, '登录成功', requestId);
  } catch (err) {
    console.error('Social login callback error:', err);
    recordApiError({ request, statusCode: 500, errorMessage: String(err), startTime });
    return error(50001, '第三方登录失败', requestId);
  }
}
