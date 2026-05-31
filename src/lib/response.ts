// 统一API响应工具
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { verifyAccessToken } from '@/lib/auth';

// 角色缓存：避免每次requireAdmin都查询数据库
const roleCache = new Map<string, { role: string; cachedAt: number }>();
const ROLE_CACHE_TTL = 5000; // 5秒缓存

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
  request_id: string;
  timestamp: number;
}

export function success<T>(data: T, message = 'ok', requestId?: string): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    code: 0,
    message,
    data,
    request_id: requestId || uuidv4(),
    timestamp: Math.floor(Date.now() / 1000),
  });
}

export function paginated<T>(
  list: T[],
  total: number,
  page: number,
  pageSize: number,
  requestId?: string
): NextResponse<ApiResponse<{ list: T[]; total: number; page: number; page_size: number }>> {
  return NextResponse.json({
    code: 0,
    message: 'ok',
    data: { list, total, page, page_size: pageSize },
    request_id: requestId || uuidv4(),
    timestamp: Math.floor(Date.now() / 1000),
  });
}

export function error(code: number, message: string, requestId?: string, data: unknown = null): NextResponse<ApiResponse> {
  const statusMap: Record<number, number> = {
    0: 200,
    40001: 400, 40002: 400, 40003: 400, 40004: 400,
    40101: 401, 40102: 401, 40103: 401,
    40301: 403,
    40401: 404,
    40901: 409, 40902: 409,
    42201: 422,
    42901: 429,
    50001: 500, 50002: 500,
    50201: 502,
    50301: 503, 50302: 503,
  };
  const httpStatus = statusMap[code] || 500;
  return NextResponse.json(
    {
      code,
      message,
      data,
      request_id: requestId || uuidv4(),
      timestamp: Math.floor(Date.now() / 1000),
    },
    { status: httpStatus }
  );
}

// Record an API error for monitoring (call from route handlers on error)
export function recordApiError(params: {
  request: Request;
  statusCode: number;
  errorMessage?: string;
  requestBody?: string;
  startTime?: number;
}) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { recordApiError: doRecord } = require('@/lib/api-monitor');
    const url = new URL(params.request.url);
    doRecord({
      apiPath: url.pathname,
      method: params.request.method,
      statusCode: params.statusCode,
      errorMessage: params.errorMessage,
      requestBody: params.requestBody?.substring(0, 2000),
      queryParams: url.search?.substring(0, 1000) || undefined,
      userAgent: params.request.headers.get('user-agent')?.substring(0, 500) || undefined,
      clientIp: params.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()?.substring(0, 50) ||
                params.request.headers.get('x-real-ip')?.substring(0, 50) || undefined,
      userId: (() => {
        const user = getAuthUser(params.request);
        return user?.userId;
      })(),
      responseTime: params.startTime ? Date.now() - params.startTime : 0,
    });
  } catch {
    // Silently fail - monitoring should never break the app
  }
}

// 获取请求ID
export function getRequestId(request: Request): string {
  return request.headers.get('x-request-id') || uuidv4();
}

// 获取分页参数
export function getPagination(searchParams: URLSearchParams): { page: number; pageSize: number; skip: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20')));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

// 获取认证用户ID — 使用完整的JWT签名验证
export function getAuthUser(request: Request): { userId: string; role: string } | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.substring(7);
    // 使用顶层import的verifyAccessToken进行完整的HMAC签名验证，防止伪造Token
    const payload = verifyAccessToken(token);
    if (!payload) return null;
    return { userId: payload.sub, role: payload.role || 'user' };
  } catch {
    return null;
  }
}

// 检查管理员权限（异步版本，从数据库查询最新角色）
export type AdminResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; response: NextResponse<ApiResponse> };

export async function requireAdmin(request: Request): Promise<AdminResult> {
  const user = getAuthUser(request);
  if (!user) return { ok: false, response: error(40101, '未登录或Token无效') };

  // 从数据库查询最新角色，防止JWT中角色已过时
  let currentRole = user.role;
  try {
    const now = Date.now();
    const cached = roleCache.get(user.userId);
    if (cached && now - cached.cachedAt < ROLE_CACHE_TTL) {
      currentRole = cached.role;
    } else {
      const { db } = await import('@/lib/db');
      const dbUser = await db.user.findUnique({
        where: { id: user.userId },
        select: { role: true },
      });
      if (dbUser) {
        currentRole = dbUser.role;
        roleCache.set(user.userId, { role: dbUser.role, cachedAt: now });
      }
    }
  } catch (err) {
    // 数据库查询失败时降级使用JWT中的角色
    console.warn('[Auth] 角色查询失败，降级使用JWT角色:', err);
  }

  if (currentRole !== 'admin' && currentRole !== 'super_admin') {
    return { ok: false, response: error(40301, '权限不足') };
  }
  return { ok: true, userId: user.userId, role: currentRole };
}
