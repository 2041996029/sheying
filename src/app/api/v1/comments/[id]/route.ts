import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, getAuthUser } from '@/lib/response';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  try {
    const auth = getAuthUser(request);
    const { id } = await params;

    const comment = await db.comment.findUnique({ where: { id } });
    if (!comment) {
      return error(40401, '评论不存在', requestId);
    }

    // 管理员可以删除任何评论
    if (auth && (auth.role === 'admin' || auth.role === 'super_admin')) {
      // pass
    }
    // 已登录用户可以删除自己的评论
    else if (auth && comment.userId === auth.userId) {
      // pass
    }
    // 游客通过邮箱验证删除自己的评论
    else if (!auth && comment.guestEmail) {
      const { searchParams } = new URL(request.url);
      const guestEmail = searchParams.get('guest_email');
      if (!guestEmail || guestEmail !== comment.guestEmail) {
        return error(40301, '无权删除此评论', requestId);
      }
    }
    else {
      return error(40301, '无权删除此评论', requestId);
    }

    await db.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await db.work.update({
      where: { id: comment.workId },
      data: { commentCount: { decrement: 1 } },
    }).catch(() => null);

    return success(null, '删除成功', requestId);
  } catch (err) {
    console.error('Delete comment error:', err);
    return error(50001, '删除评论失败', requestId);
  }
}
