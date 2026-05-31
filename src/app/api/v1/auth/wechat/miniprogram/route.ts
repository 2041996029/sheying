import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId } from '@/lib/response';
import { generateTokenPair } from '@/lib/auth';
import { storeRefreshToken } from '@/lib/refresh-token';
import { getMiniProgramConfig } from '@/lib/wechat';
import { issueMiniprogramSignKey, loadGuardConfig } from '@/lib/api-guard';

// 微信小程序 code2session 接口
const WX_CODE2SESSION_URL = 'https://api.weixin.qq.com/sns/jscode2session';

interface WxCode2SessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

// 调用微信 code2session 接口
async function code2Session(
  appid: string,
  appsecret: string,
  code: string
): Promise<WxCode2SessionResponse> {
  const url = `${WX_CODE2SESSION_URL}?appid=${appid}&secret=${appsecret}&js_code=${code}&grant_type=authorization_code`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`微信接口请求失败: HTTP ${response.status}`);
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const body = await request.json();
    const { code, nickName, avatarUrl } = body;

    // 验证 code
    if (!code) {
      return error(40001, '微信登录code不能为空', requestId);
    }

    // 获取小程序配置
    const { appid, appsecret } = await getMiniProgramConfig();
    if (!appid || !appsecret) {
      return error(50002, '小程序未配置AppID或AppSecret，请在后台配置中心填写', requestId);
    }

    // 调用微信接口获取 openid 和 session_key
    const wxResult = await code2Session(appid, appsecret, code);

    if (wxResult.errcode) {
      console.error('微信code2session失败:', wxResult.errcode, wxResult.errmsg);
      return error(50003, `微信登录失败: ${wxResult.errmsg || '未知错误'}`, requestId);
    }

    const { openid, unionid } = wxResult;
    if (!openid) {
      return error(50004, '获取微信openid失败', requestId);
    }

    // 查找或创建用户
    let user = await db.user.findUnique({ where: { openid } });

    if (!user) {
      // 新用户，自动注册
      const userData: {
        openid: string;
        unionid?: string;
        nickname?: string;
        avatarUrl?: string;
        role: string;
        status: string;
      } = {
        openid,
        role: 'user',
        status: 'active',
      };

      if (unionid) {
        userData.unionid = unionid;
      }
      if (nickName) {
        userData.nickname = nickName;
      }
      if (avatarUrl) {
        userData.avatarUrl = avatarUrl;
      }

      user = await db.user.create({ data: userData });

      // 更新每日统计 - 新用户数
      const today = new Date().toISOString().split('T')[0];
      await db.dailyStat.upsert({
        where: { statDate: today },
        create: { statDate: today, newUserCount: 1 },
        update: { newUserCount: { increment: 1 } },
      });
    } else {
      // 已有用户，检查账号状态
      if (user.status === 'banned') {
        return error(40301, '账号已被封禁', requestId);
      }
      if (user.deletedAt) {
        return error(40102, '账号已删除', requestId);
      }

      // 如果传入了新的昵称或头像，更新用户信息
      const updateData: { nickname?: string; avatarUrl?: string; unionid?: string } = {};
      let needUpdate = false;

      if (nickName && nickName !== user.nickname) {
        updateData.nickname = nickName;
        needUpdate = true;
      }
      if (avatarUrl && avatarUrl !== user.avatarUrl) {
        updateData.avatarUrl = avatarUrl;
        needUpdate = true;
      }
      if (unionid && unionid !== user.unionid) {
        updateData.unionid = unionid;
        needUpdate = true;
      }

      if (needUpdate) {
        user = await db.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

    // 生成 JWT Token
    const tokens = generateTokenPair(user.id, user.role);

    // 存储 refresh token
    await storeRefreshToken(user.id, tokens.refresh_token);

    // 签发动态签名密钥（如果 API Guard 已启用且配置了小程序客户端）
    let signKeyData = null;
    try {
      const guardConfig = await loadGuardConfig();
      if (guardConfig.enabled) {
        const mpClient = guardConfig.clients.find(c => c.clientType === 'miniprogram' && c.enabled);
        if (mpClient) {
          signKeyData = await issueMiniprogramSignKey(user.id, mpClient.appId);
        }
      }
    } catch (signKeyErr) {
      // 签发签名密钥失败不应阻止登录
      console.warn('签发小程序签名密钥失败:', signKeyErr);
    }

    return success(
      {
        ...tokens,
        ...(signKeyData ? {
          sign_key: signKeyData.signKey,
          sign_key_ref: signKeyData.signKeyRef,
          sign_key_expires_at: signKeyData.expiresAt,
        } : {}),
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          role: user.role,
          avatarUrl: user.avatarUrl,
          bio: user.bio,

        },
      },
      '登录成功',
      requestId
    );
  } catch (err) {
    console.error('WeChat miniprogram login error:', err);
    return error(50001, '微信登录失败', requestId);
  }
}
