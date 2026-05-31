import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        nickname: true,
        avatarUrl: true,
        role: true,
        status: true,
        bio: true,
        openid: true,
        unionid: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            likes: true,
            favorites: true,
            comments: true,
            viewLogs: true,
            browseHistory: true,
            contacts: true,
          },
        },
      },
    });

    if (!user) {
      return error(40401, '用户不存在', requestId);
    }

    // 脱敏处理 openid/unionid
    const maskedUser = {
      ...user,
      openid: user.openid ? user.openid.substring(0, 4) + '****' : null,
      unionid: user.unionid ? user.unionid.substring(0, 4) + '****' : null,
    };

    return success(maskedUser, 'ok', requestId);
  } catch (err) {
    console.error('User detail error:', err);
    return error(50001, '获取用户详情失败', requestId);
  }
}
