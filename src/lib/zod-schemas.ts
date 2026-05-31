import { z } from 'zod';
import { EMAIL_REGEX, LIMITS } from './validators';

export const loginSchema = z.object({
  email: z.string().regex(EMAIL_REGEX, '邮箱格式不正确'),
  password: z.string().min(6, '密码长度不能少于6位').max(128, '密码长度不能超过128位'),
});

export const registerSchema = z.object({
  email: z.string().regex(EMAIL_REGEX, '邮箱格式不正确'),
  password: z.string().min(8, '密码长度不能少于8位').max(128, '密码长度不能超过128位'),
  nickname: z.string().min(1, '昵称不能为空').max(LIMITS.NICKNAME_MAX, `昵称长度不能超过${LIMITS.NICKNAME_MAX}位`).optional(),
  code: z.string().min(1, '验证码不能为空'),
});

export const changePasswordSchema = z.object({
  old_password: z.string().min(1, '旧密码不能为空'),
  new_password: z.string().min(8, '新密码长度不能少于8位').max(128, '密码长度不能超过128位'),
});

export const changeRoleSchema = z.object({
  role: z.enum(['user', 'admin', 'super_admin'], { message: 'role必须为user、admin或super_admin' }),
});

export function validateInput<T>(schema: z.ZodType<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodErrors(result.error) };
}

export function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((e) => {
    const field = e.path.join('.');
    return field ? `${field}: ${e.message}` : e.message;
  });
}
