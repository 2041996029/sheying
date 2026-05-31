import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, getAuthUser, recordApiError } from '@/lib/response';
import { EMAIL_REGEX } from '@/lib/validators';

// 获取邮件配置
async function getEmailConfig(): Promise<{
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  enabled: boolean;
}> {
  const keys = ['email_host', 'email_port', 'email_user', 'email_password', 'email_from', 'email_enabled'];
  const configs = await db.config.findMany({
    where: { key: { in: keys } },
  });

  const get = (key: string) => configs.find((c) => c.key === key)?.value || '';

  return {
    host: get('email_host'),
    port: parseInt(get('email_port') || '465', 10),
    user: get('email_user'),
    password: get('email_password'),
    from: get('email_from'),
    enabled: get('email_enabled') === 'true',
  };
}

// 通过 SMTP 发送验证码邮件
async function sendVerificationEmail(
  emailConfig: { host: string; port: number; user: string; password: string; from: string },
  to: string,
  code: string,
  type: string
): Promise<boolean> {
  try {
    // 使用 require 加载 nodemailer（serverExternalPackages 中的模块不经过 Turbopack 打包）
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.port === 465,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.password,
      },
    });

    // 根据类型生成不同的邮件内容
    let subject = '验证码';
    let title = '验证码';
    let description = '您正在执行以下操作，验证码为：';

    if (type === 'register') {
      subject = '注册验证码';
      title = '注册验证';
      description = '您正在注册账号，验证码为：';
    } else if (type === 'bind_email') {
      subject = '邮箱绑定验证码';
      title = '邮箱绑定验证';
      description = '您正在绑定邮箱地址，验证码为：';
    } else if (type === 'reset_password') {
      subject = '重置密码验证码';
      title = '重置密码验证';
      description = '您正在重置密码，验证码为：';
    }

    await transporter.sendMail({
      from: emailConfig.from || `"光影集" <${emailConfig.user}>`,
      to,
      subject,
      html: `
        <div style="max-width:480px;margin:0 auto;padding:32px;font-family:system-ui,-apple-system,sans-serif;">
          <h2 style="color:#1a1a1a;font-size:20px;margin-bottom:16px;">${title}</h2>
          <p style="color:#555;font-size:14px;line-height:1.6;">${description}</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:16px;text-align:center;margin:20px 0;">
            <span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1a1a1a;">${code}</span>
          </div>
          <p style="color:#999;font-size:12px;line-height:1.6;">验证码10分钟内有效，请勿泄露给他人。如非本人操作，请忽略此邮件。</p>
        </div>
      `,
    });

    return true;
  } catch (err) {
    console.error('Send email error:', err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. 解析请求体
    const body = await request.json();
    const { email, type = 'bind_email' } = body;

    // 支持的验证码类型
    const validTypes = ['register', 'bind_email', 'reset_password'];
    if (!validTypes.includes(type)) {
      return error(40001, '无效的验证码类型', requestId);
    }

    // 2. 验证身份：注册类型不需要登录，绑定邮箱需要登录
    const auth = getAuthUser(request);
    if (type === 'bind_email' && !auth) {
      return error(40101, '未登录或Token无效', requestId);
    }

    if (!email) {
      return error(40001, '邮箱不能为空', requestId);
    }

    // 3. 验证邮箱格式
    if (!EMAIL_REGEX.test(email)) {
      return error(40002, '邮箱格式不正确', requestId);
    }

    // 4. 类型特定校验
    if (type === 'register') {
      // 注册时检查邮箱是否已被注册
      const existingUser = await db.user.findUnique({ where: { email } });
      if (existingUser) {
        return error(40901, '该邮箱已被注册', requestId);
      }
    } else if (type === 'bind_email') {
      // 绑定邮箱时检查是否已绑定到当前用户自身
      const existingUser = await db.user.findUnique({ where: { email } });
      if (existingUser && existingUser.id === auth!.userId) {
        return error(40004, '该邮箱已绑定到当前账号', requestId);
      }
    }

    // 5. 频率限制：检查是否有60秒内未过期的验证码
    const recentCode = await db.verificationCode.findFirst({
      where: {
        target: email,
        type,
        channel: 'email',
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentCode) {
      const waitSeconds = Math.ceil(
        (recentCode.createdAt.getTime() + 60 * 1000 - Date.now()) / 1000
      );
      return error(42901, `操作过于频繁，请${waitSeconds}秒后再试`, requestId);
    }

    // 6. 生成6位数字验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期

    // 7. 保存验证码到数据库
    await db.verificationCode.create({
      data: {
        target: email,
        code,
        type,
        channel: 'email',
        expiresAt,
      },
    });

    // 8. 获取邮件配置并发送
    const emailConfig = await getEmailConfig();

    if (emailConfig.enabled) {
      const sent = await sendVerificationEmail(emailConfig, email, code, type);
      if (!sent) {
        return error(50002, '验证码邮件发送失败，请稍后重试', requestId);
      }

      return success(
        { email, sent: true },
        '验证码已发送至您的邮箱，请查收',
        requestId
      );
    } else {
      // 生产环境禁止明文返回验证码
      if (process.env.NODE_ENV === 'production') {
        return error(50302, '邮件服务未启用，无法发送验证码', requestId);
      }
      // 仅开发/测试环境直接返回
      return success(
        { email, code, sent: false, note: '邮件服务未启用，验证码已直接返回（仅限开发环境）' },
        '验证码已生成（邮件服务未启用）',
        requestId
      );
    }
  } catch (err) {
    console.error('Send verification code error:', err);
    recordApiError({ request, statusCode: 500, errorMessage: String(err), startTime });
    return error(50001, '发送验证码失败', requestId);
  }
}
