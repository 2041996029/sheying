import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, getAuthUser } from '@/lib/response';
import { checkRateLimit } from '@/lib/rate-limit';
import { EMAIL_REGEX, LIMITS } from '@/lib/validators';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const auth = getAuthUser(request);
    const body = await request.json();
    const { name, email, phone, message } = body;

    if (!message) {
      return error(40001, '留言内容不能为空', requestId);
    }

    // 速率限制
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') || 'unknown';
    const rateLimitMsg = checkRateLimit(`contact:${clientIp}`, 5, 3600000);
    if (rateLimitMsg) {
      return error(42901, rateLimitMsg, requestId);
    }

    // 输入长度验证
    if (name && name.length > 50) {
      return error(40002, '姓名长度不能超过50个字符', requestId);
    }
    if (email && !EMAIL_REGEX.test(email)) {
      return error(40003, '邮箱格式不正确', requestId);
    }
    if (message.length > LIMITS.MESSAGE_MAX) {
      return error(40004, `留言内容不能超过${LIMITS.MESSAGE_MAX}个字符`, requestId);
    }
    if (phone && phone.length > 20) {
      return error(40005, '电话号码格式不正确', requestId);
    }

    const contact = await db.contact.create({
      data: {
        userId: auth?.userId || null,
        name: name || null,
        email: email || null,
        phone: phone || null,
        message,
        status: 'pending',
      },
    });

    return success({ id: contact.id }, '提交成功', requestId);
  } catch (err) {
    console.error('Contact submit error:', err);
    return error(50001, '提交失败', requestId);
  }
}
