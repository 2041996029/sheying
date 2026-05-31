import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, getAuthUser } from '@/lib/response';
import { generateTokenPair } from '@/lib/auth';
import { EMAIL_REGEX } from '@/lib/validators';
import { storeRefreshToken } from '@/lib/refresh-token';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    // 1. 验证身份
    const auth = getAuthUser(request);
    if (!auth) {
      return error(40101, '未登录或Token无效', requestId);
    }

    // 2. 解析请求体
    const body = await request.json();
    const { email, code } = body;

    if (!email || !code) {
      return error(40001, '邮箱和验证码不能为空', requestId);
    }

    // 3. 验证邮箱格式
    if (!EMAIL_REGEX.test(email)) {
      return error(40002, '邮箱格式不正确', requestId);
    }

    // 4. 查找当前用户
    const currentUser = await db.user.findUnique({ where: { id: auth.userId } });
    if (!currentUser) {
      return error(40401, '用户不存在', requestId);
    }

    if (currentUser.status === 'banned') {
      return error(40301, '账号已被封禁', requestId);
    }

    if (currentUser.deletedAt) {
      return error(40102, '账号已删除', requestId);
    }

    // 5. 验证验证码是否正确（先查出来再判断过期，避免数据库与应用时区不一致）
    const verificationCode = await db.verificationCode.findFirst({
      where: {
        target: email,
        type: 'bind_email',
        channel: 'email',
        code,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationCode) {
      return error(40003, '验证码错误', requestId);
    }

    // 在应用层判断是否过期，避免数据库时区问题
    const now = new Date();
    if (verificationCode.expiresAt <= now) {
      return error(40004, '验证码已过期，请重新获取', requestId);
    }

    // 6. 检查该邮箱是否已绑定到其他用户
    const existingEmailUser = await db.user.findUnique({ where: { email } });

    if (existingEmailUser && existingEmailUser.id !== auth.userId) {
      // ===== 邮箱已绑定到其他用户 — 执行账号合并 =====
      // 将当前微信用户的 openid 合并到已有邮箱账号，使已有账号同时支持邮箱密码登录和微信登录

      const existingIsAdmin = existingEmailUser.role === 'admin' || existingEmailUser.role === 'super_admin';
      const currentIsAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';

      // 如果两边都是管理员，保留更高权限的角色
      let mergedRole = existingEmailUser.role;
      if (currentIsAdmin && currentUser.role === 'super_admin') {
        mergedRole = 'super_admin';
      } else if (currentIsAdmin && !existingIsAdmin) {
        mergedRole = currentUser.role;
      }

      // 检查已有账号是否已有openid（两个微信账号绑定同一个邮箱）
      // 不再硬性拒绝，而是允许合并并替换为当前微信的openid
      // 场景：用户之前用微信A绑定了邮箱，现在用微信B登录想重新绑定
      const needReplaceOpenid = !!(
        existingEmailUser.openid && existingEmailUser.openid !== currentUser.openid
      );

      // 合并账号：将当前微信用户的数据迁移到已有邮箱账号
      // 使用事务确保数据一致性
      const result = await db.$transaction(async (tx) => {
        const targetUserId = existingEmailUser.id;
        const sourceUserId = currentUser.id;

        // 1. 迁移收藏（需要去重：跳过目标账号已收藏的作品）
        const existingFavorites = await tx.favorite.findMany({
          where: { userId: targetUserId },
          select: { workId: true },
        });
        const existingFavWorkIds = new Set(existingFavorites.map(f => f.workId));

        const duplicateFavIds = await tx.favorite.findMany({
          where: {
            userId: sourceUserId,
            workId: { in: Array.from(existingFavWorkIds) },
          },
          select: { id: true },
        });
        if (duplicateFavIds.length > 0) {
          await tx.favorite.deleteMany({
            where: { id: { in: duplicateFavIds.map(f => f.id) } },
          });
        }
        await tx.favorite.updateMany({
          where: { userId: sourceUserId },
          data: { userId: targetUserId },
        });

        // 2. 迁移点赞（需要去重：跳过目标账号已点赞的作品）
        const existingLikes = await tx.like.findMany({
          where: { userId: targetUserId },
          select: { workId: true },
        });
        const existingLikeWorkIds = new Set(existingLikes.map(l => l.workId));

        const duplicateLikeIds = await tx.like.findMany({
          where: {
            userId: sourceUserId,
            workId: { in: Array.from(existingLikeWorkIds) },
          },
          select: { id: true },
        });
        if (duplicateLikeIds.length > 0) {
          await tx.like.deleteMany({
            where: { id: { in: duplicateLikeIds.map(l => l.id) } },
          });
        }
        await tx.like.updateMany({
          where: { userId: sourceUserId },
          data: { userId: targetUserId },
        });

        // 3. 迁移评论
        await tx.comment.updateMany({
          where: { userId: sourceUserId },
          data: { userId: targetUserId },
        });

        // 4. 迁移浏览历史
        await tx.browseHistory.updateMany({
          where: { userId: sourceUserId },
          data: { userId: targetUserId },
        });

        // 5. 迁移浏览日志
        await tx.viewLog.updateMany({
          where: { userId: sourceUserId },
          data: { userId: targetUserId },
        });

        // 6. 迁移联系记录
        await tx.contact.updateMany({
          where: { userId: sourceUserId },
          data: { userId: targetUserId },
        });

        // 7. 迁移审计日志（管理员账号）
        await tx.auditLog.updateMany({
          where: { adminId: sourceUserId },
          data: { adminId: targetUserId },
        });

        // 8. 删除源用户的所有 refresh token（必须删除，否则外键约束阻止删除用户）
        await tx.refreshToken.deleteMany({
          where: { userId: sourceUserId },
        });

        // 9. 先清除源用户的openid（避免唯一约束冲突：源用户的openid尚未释放）
        //    如果不清除，下一步更新目标用户openid时会因为源用户仍持有该openid而触发P2002错误
        await tx.user.update({
          where: { id: sourceUserId },
          data: { openid: null, unionid: null },
        });

        // 10. 如果目标账号的旧openid需要被替换，先清除它（避免唯一约束冲突）
        if (needReplaceOpenid) {
          await tx.user.update({
            where: { id: targetUserId },
            data: { openid: null, unionid: null },
          });
        }

        // 11. 更新目标邮箱账号：添加微信openid，合并角色
        const updatedUser = await tx.user.update({
          where: { id: targetUserId },
          data: {
            openid: currentUser.openid || existingEmailUser.openid,
            unionid: currentUser.unionid || existingEmailUser.unionid,
            role: mergedRole,
            // 如果已有账号没有头像/昵称，使用微信账号的
            avatarUrl: existingEmailUser.avatarUrl || currentUser.avatarUrl,
            nickname: existingEmailUser.nickname || currentUser.nickname,
          },
        });

        // 12. 删除源微信账号
        await tx.user.delete({ where: { id: sourceUserId } });

        return updatedUser;
      });

      // 生成新 token（使用合并后的账号）
      const tokens = generateTokenPair(result.id, result.role);

      // 存储新的 refresh token
      await storeRefreshToken(result.id, tokens.refresh_token);

      // 删除已使用的验证码
      await db.verificationCode.delete({ where: { id: verificationCode.id } });

      // 构造合并提示消息
      let message = '邮箱绑定成功，已与已有账号合并';
      if (existingIsAdmin || currentIsAdmin) {
        message = '邮箱绑定成功，已继承管理员权限';
      }

      return success(
        {
          ...tokens,
          user: {
            id: result.id,
            email: result.email,
            nickname: result.nickname,
            role: result.role,
            avatarUrl: result.avatarUrl,
            bio: result.bio,

          },
          merged: true,
        },
        message,
        requestId
      );
    }

    // 7. 邮箱未绑定到其他用户，或已绑定到当前用户自身 — 直接绑定
    // 再次检查邮箱是否已被其他用户抢先绑定（防竞态）
    const doubleCheck = await db.user.findUnique({ where: { email } });
    if (doubleCheck && doubleCheck.id !== auth.userId) {
      // 邮箱已被他人抢先绑定，走合并逻辑
      return error(40901, '该邮箱已被其他账号绑定，请重新发送验证码后重试', requestId);
    }

    const updatedUser = await db.user.update({
      where: { id: auth.userId },
      data: { email },
    });

    // 生成新 token
    const tokens = generateTokenPair(updatedUser.id, updatedUser.role);

    // 存储新的 refresh token
    await storeRefreshToken(updatedUser.id, tokens.refresh_token);

    // 删除已使用的验证码
    await db.verificationCode.delete({ where: { id: verificationCode.id } });

    return success(
      {
        ...tokens,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          nickname: updatedUser.nickname,
          role: updatedUser.role,
          avatarUrl: updatedUser.avatarUrl,
          bio: updatedUser.bio,

        },
        merged: false,
      },
      '邮箱绑定成功',
      requestId
    );
  } catch (err: unknown) {
    console.error('Bind email error:', err);

    const prismaErr = err && typeof err === 'object' && 'code' in err ? err as { code?: string; meta?: { target?: string[] } } : null;
    // Prisma P2002: 唯一约束冲突
    if (prismaErr?.code === 'P2002') {
      const target = prismaErr.meta?.target;
      if (target?.includes('email')) {
        return error(40901, '该邮箱已被其他账号绑定，请更换邮箱或联系管理员', requestId);
      }
      if (target?.includes('openid')) {
        return error(40902, '该邮箱关联的账号已绑定其他微信，无法重复绑定', requestId);
      }
      return error(40903, '数据冲突，绑定失败，请联系管理员', requestId);
    }

    // Prisma P2025: 记录不存在
    if (prismaErr?.code === 'P2025') {
      return error(40401, '用户数据异常，请重新登录后重试', requestId);
    }

    return error(50001, '绑定邮箱失败，请稍后重试', requestId);
  }
}
