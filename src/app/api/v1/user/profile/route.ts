import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, getAuthUser } from '@/lib/response';
import { isValidNickname, isValidBio, LIMITS } from '@/lib/validators';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return error(40101, '未登录或Token无效', requestId);
    }

    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        bio: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      return error(40401, '用户不存在', requestId);
    }

    return success(user, 'ok', requestId);
  } catch (err) {
    console.error('Get profile error:', err);
    return error(50001, '获取用户信息失败', requestId);
  }
}

export async function PUT(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return error(40101, '未登录或Token无效', requestId);
    }

    const body = await request.json();
    const { nickname, avatarUrl, bio } = body;

    if (nickname !== undefined && !isValidNickname(nickname)) {
      return error(40002, `昵称长度不能超过${LIMITS.NICKNAME_MAX}个字符`, requestId);
    }
    if (bio !== undefined && !isValidBio(bio)) {
      return error(40003, `简介长度不能超过${LIMITS.BIO_MAX}个字符`, requestId);
    }
    if (avatarUrl !== undefined && avatarUrl !== null && avatarUrl !== '') {
      // 防止 javascript: 协议 XSS
      if (!avatarUrl.startsWith('/') && !avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://')) {
        return error(40004, '头像URL格式不正确', requestId);
      }
    }

    const data: Record<string, unknown> = {};
    if (nickname !== undefined) data.nickname = nickname;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (bio !== undefined) data.bio = bio;

    const user = await db.user.update({
      where: { id: auth.userId },
      data,
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        bio: true,
        role: true,
      },
    });

    return success(user, '更新成功', requestId);
  } catch (err) {
    console.error('Update profile error:', err);
    return error(50001, '更新用户信息失败', requestId);
  }
}
