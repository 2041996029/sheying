import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, getAuthUser } from '@/lib/response';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { changePasswordSchema, validateInput } from '@/lib/zod-schemas';

export async function PUT(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return error(40101, '未登录或Token无效', requestId);
    }

    // 速率限制
    const rateLimitMsg = checkRateLimit(`password:${auth.userId}`, 5, 900000);
    if (rateLimitMsg) {
      return error(42901, rateLimitMsg, requestId);
    }

    const body = await request.json();
    const validation = validateInput(changePasswordSchema, body);
    if (!validation.success) {
      return error(40001, validation.errors.join('; '), requestId);
    }
    const { old_password, new_password } = validation.data;

    const user = await db.user.findUnique({ where: { id: auth.userId } });
    if (!user || !user.password) {
      return error(40401, '用户不存在', requestId);
    }

    const valid = await verifyPassword(old_password, user.password);
    if (!valid) {
      return error(40102, '旧密码错误', requestId);
    }

    const hashedPassword = await hashPassword(new_password);
    await db.user.update({
      where: { id: auth.userId },
      data: { password: hashedPassword },
    });

    return success(null, '密码修改成功', requestId);
  } catch (err) {
    console.error('Change password error:', err);
    return error(50001, '密码修改失败', requestId);
  }
}
