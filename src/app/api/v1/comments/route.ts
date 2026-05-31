import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { paginated, success, error, getRequestId, getPagination, getAuthUser, recordApiError } from '@/lib/response';
import { getCache, setCache, deleteCache, clearCacheByPrefix } from '@/lib/cache';
import { checkRateLimit } from '@/lib/rate-limit';
import { LIMITS } from '@/lib/validators';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = getPagination(searchParams);
    const workId = searchParams.get('work_id');
    const status = searchParams.get('status');

    if (!workId) {
      return error(40001, 'work_id不能为空', requestId);
    }

    const where: Record<string, unknown> = {
      workId,
      deletedAt: null,
      isVisible: true,
    };

    // Admin can filter by status
    if (status) {
      const auth = getAuthUser(request);
      if (auth && (auth.role === 'admin' || auth.role === 'super_admin')) {
        where.status = status;
        delete where.isVisible;
      }
    } else {
      where.status = 'approved';
    }

    // 缓存评论列表，30秒TTL（评论变动较频繁）
    const statusSuffix = status ? `:${status}` : '';
    const cacheKey = `comments:${workId}:${page}:${pageSize}${statusSuffix}`;
    const cached = await getCache<{ list: unknown[]; total: number }>(cacheKey);
    if (cached) {
      return paginated(cached.list, cached.total, page, pageSize, requestId);
    }

    const [comments, total] = await Promise.all([
      db.comment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      }),
      db.comment.count({ where }),
    ]);

    // 规范化评论数据：统一返回 authorName / authorAvatar
    const normalizedComments = comments.map((comment) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { guestEmail, ...rest } = comment;
      return {
        ...rest,
        authorName: comment.user?.nickname || comment.guestName || '匿名用户',
        authorAvatar: comment.user?.avatarUrl || null,
      };
    });

    // Cache for 30 seconds
    await setCache(cacheKey, { list: normalizedComments, total }, 30);

    return paginated(normalizedComments, total, page, pageSize, requestId);
  } catch (err) {
    console.error('Comments list error:', err);
    recordApiError({ request, statusCode: 500, errorMessage: String(err), startTime });
    return error(50001, '获取评论列表失败', requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();
  try {
    const auth = getAuthUser(request);
    const body = await request.json();
    const { work_id, content, guest_name, guest_email } = body;

    if (!work_id || !content) {
      return error(40001, 'work_id和content不能为空', requestId);
    }

    // 评论内容长度限制
    if (content.length > LIMITS.COMMENT_MAX) {
      return error(40003, `评论内容不能超过${LIMITS.COMMENT_MAX}个字符`, requestId);
    }

    // 速率限制
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') || 'unknown';
    const rateLimitMsg = checkRateLimit(`comment:${clientIp}:${auth?.userId || 'guest'}`, 5, 60000);
    if (rateLimitMsg) {
      return error(42901, rateLimitMsg, requestId);
    }

    // 未登录用户必须提供邮箱和昵称
    if (!auth) {
      if (!guest_email || !guest_name) {
        return error(40001, '游客评论请填写昵称和邮箱', requestId);
      }
      // 验证邮箱格式（使用公共验证器）
      const { EMAIL_REGEX } = await import('@/lib/validators');
      if (!EMAIL_REGEX.test(guest_email)) {
        return error(40002, '邮箱格式不正确', requestId);
      }
      if (guest_name.length > 50) {
        return error(40003, '昵称长度不能超过50个字符', requestId);
      }
    }

    const work = await db.work.findFirst({ where: { id: work_id, deletedAt: null } });
    if (!work) {
      return error(40401, '作品不存在', requestId);
    }

    // 管理员评论免审核，直接通过
    const isAdmin = auth && (auth.role === 'admin' || auth.role === 'super_admin');
    const commentStatus = isAdmin ? 'approved' : 'pending';

    const comment = await db.comment.create({
      data: {
        workId: work_id,
        userId: auth?.userId || null,
        guestName: auth ? null : guest_name,
        guestEmail: auth ? null : guest_email,
        content,
        status: commentStatus,
        isVisible: true,
      },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
    });

    await db.work.update({
      where: { id: work_id },
      data: { commentCount: { increment: 1 } },
    });

    // 清除该作品的评论缓存和详情缓存
    await clearCacheByPrefix('comments:');
    await deleteCache(`works:detail:${work_id}`);

    // 规范化返回数据
    const normalizedComment = {
      ...comment,
      authorName: comment.user?.nickname || comment.guestName || '匿名用户',
      authorAvatar: comment.user?.avatarUrl || null,
    };

    const message = isAdmin ? '评论成功' : '评论已提交，等待审核';

    return success(normalizedComment, message, requestId);
  } catch (err) {
    console.error('Post comment error:', err);
    recordApiError({ request, statusCode: 500, errorMessage: String(err), startTime });
    return error(50001, '评论失败', requestId);
  }
}
