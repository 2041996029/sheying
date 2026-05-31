// API Guard - Request signature verification for API access control
// Runs in Node.js Runtime (via proxy.ts) - can directly access DB and Redis

import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache, deleteCache } from '@/lib/cache';
import { db } from '@/lib/db';

// Declare global property for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var __nonceCleanupTimer: ReturnType<typeof setInterval> | undefined;
}

// ==================== Types ====================

export interface ClientCredential {
  appId: string;
  appSecret: string;
  name: string;
  clientType: 'web' | 'miniprogram' | 'admin';
  enabled: boolean;
}

export interface GuardConfig {
  enabled: boolean;
  clients: ClientCredential[];
  allowedOrigins: string[];
  skipPublicGet: boolean;
  skipAuthPaths: boolean;
  timestampTolerance: number;
  signKeyTtl: number;
}

export interface GuardSuccessResult {
  valid: true;
  clientType: string;
}

export interface GuardFailResult {
  valid: false;
  response: NextResponse;
}

export type GuardResult = GuardSuccessResult | GuardFailResult;

// ==================== In-memory Config Cache ====================

let cachedConfig: GuardConfig | null = null;
let configLoadTime: number = 0;
const CACHE_TTL = 10 * 1000; // 10 seconds — short TTL to pick up config changes quickly

// ==================== Nonce Tracking (prevent replay) ====================

const nonceSet = new Set<string>();
const NONCE_TTL = 10 * 60 * 1000; // 10 minutes

if (typeof setInterval !== 'undefined') {
  if (globalThis.__nonceCleanupTimer !== undefined) {
    clearInterval(globalThis.__nonceCleanupTimer);
  }
  globalThis.__nonceCleanupTimer = setInterval(() => {
    if (nonceSet.size > 0) {
      nonceSet.clear();
    }
  }, NONCE_TTL);
  if (globalThis.__nonceCleanupTimer && typeof globalThis.__nonceCleanupTimer === 'object' && 'unref' in globalThis.__nonceCleanupTimer) {
    globalThis.__nonceCleanupTimer.unref();
  }
}

// ==================== Config Loading (direct DB access) ====================

const SECURITY_CONFIG_KEYS = [
  'security_access_control_enabled',
  'security_api_keys',
  'security_allowed_origins',
  'security_skip_public_get',
  'security_skip_auth_paths',
  'security_timestamp_tolerance',
  'security_signkey_ttl',
];

/**
 * Load guard configuration directly from database.
 * Runs in Node.js Runtime (proxy.ts) - no need for Edge Runtime workarounds.
 */
export async function loadGuardConfig(): Promise<GuardConfig> {
  const now = Date.now();
  if (cachedConfig && now - configLoadTime < CACHE_TTL) {
    return cachedConfig;
  }

  try {
    const configs = await db.config.findMany({
      where: { key: { in: SECURITY_CONFIG_KEYS } },
      select: { key: true, value: true, updatedAt: true },
    });

    const configMap: Record<string, string> = {};
    let latestUpdate = 0;
    for (const c of configs) {
      configMap[c.key] = c.value;
      if (c.updatedAt) {
        const ts = c.updatedAt.getTime();
        if (ts > latestUpdate) latestUpdate = ts;
      }
    }

    // If config was modified after our cache was loaded, force refresh
    if (cachedConfig && latestUpdate > 0 && latestUpdate > configLoadTime) {
      cachedConfig = null;
    }

    let clients: ClientCredential[] = [];
    try {
      const parsed = JSON.parse(configMap.security_api_keys || '[]');
      if (Array.isArray(parsed)) {
        clients = parsed.filter(
          (c: unknown): c is ClientCredential =>
            typeof c === 'object' && c !== null &&
            typeof (c as ClientCredential).appId === 'string' &&
            typeof (c as ClientCredential).appSecret === 'string'
        );
      }
    } catch { clients = []; }

    let allowedOrigins: string[] = [];
    try {
      const parsed = JSON.parse(configMap.security_allowed_origins || '[]');
      if (Array.isArray(parsed)) {
        allowedOrigins = parsed.filter((o: unknown) => typeof o === 'string');
      }
    } catch { allowedOrigins = []; }

    cachedConfig = {
      enabled: configMap.security_access_control_enabled === 'true',
      clients,
      allowedOrigins,
      skipPublicGet: configMap.security_skip_public_get === 'true',
      skipAuthPaths: configMap.security_skip_auth_paths === 'true',
      timestampTolerance: parseInt(configMap.security_timestamp_tolerance || '300', 10) || 300,
      signKeyTtl: parseInt(configMap.security_signkey_ttl || '86400', 10) || 86400,
    };
    configLoadTime = now;
    return cachedConfig;
  } catch (err) {
    console.error('[api-guard] 加载配置失败:', err);
    return cachedConfig || {
      enabled: false, clients: [], allowedOrigins: [],
      skipPublicGet: false, skipAuthPaths: false,
      timestampTolerance: 300, signKeyTtl: 86400,
    };
  }
}

/**
 * Force invalidate the guard config cache.
 */
export function invalidateGuardCache(): void {
  cachedConfig = null;
  configLoadTime = 0;
}

// ==================== Skip Path Detection ====================

const SKIP_AUTH_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register/email',
  '/api/v1/auth/send-code',
  '/api/v1/auth/social/callback',
  '/api/v1/auth/wechat/miniprogram',
  '/api/v1/auth/wechat/miniprogram/refresh-signkey',
  '/api/v1/auth/social/providers',
  '/api/v1/auth/bind-email',
];

const SKIP_PUBLIC_PREFIXES = [
  '/api/v1/seo/',
  '/api/v1/upload/serve/',
];

const SKIP_PUBLIC_PATHS = [
  '/api/v1/configs/public',
  '/api/v1/stats/public',
  '/api/v1/changelog',
  '/api/v1/hitokoto',
  '/api/v1/booking/info',
  '/api/v1/seo/sitemap.xml',
];

export function isSkipPath(pathname: string): boolean {
  if (SKIP_AUTH_PATHS.includes(pathname)) return true;
  for (const prefix of SKIP_PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  if (SKIP_PUBLIC_PATHS.includes(pathname)) return true;
  return false;
}

// ==================== Signature Computation ====================

async function computeSha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== Main Verification ====================

/**
 * Extract hostname from Origin or Referer header.
 */
function extractOriginHost(request: NextRequest): string {
  const origin = request.headers.get('Origin') || request.headers.get('Referer') || '';
  if (!origin) return '';
  try {
    return new URL(origin).hostname;
  } catch {
    const match = origin.match(/^https?:\/\/([^/]+)/);
    return match ? match[1] : '';
  }
}

/**
 * Check if a hostname is in the allowed origins list.
 */
function isOriginAllowed(hostname: string, allowedOrigins: string[]): boolean {
  if (!hostname) return true; // no origin to check → allow
  if (allowedOrigins.length === 0) return true; // no whitelist configured → allow all
  return allowedOrigins.some(allowedOrigin => {
    try {
      const allowedHost = new URL(allowedOrigin.startsWith('http') ? allowedOrigin : `https://${allowedOrigin}`).hostname;
      return hostname === allowedHost;
    } catch { return hostname === allowedOrigin; }
  });
}

/**
 * Detect if the request comes from an external/mini-program client.
 */
function isExternalClient(request: NextRequest): boolean {
  if (request.headers.get('X-App-Id')) return true;
  const ua = request.headers.get('user-agent') || '';
  if (ua.includes('MicroMessenger') || ua.includes('miniProgram')) return true;
  return false;
}

export async function verifyRequest(request: NextRequest): Promise<GuardResult> {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const config = await loadGuardConfig();

  // Guard disabled → pass through
  if (!config.enabled) {
    return { valid: true, clientType: 'unknown' };
  }

  // ---- Level 1: Always skip (website infrastructure paths) ----
  // Auth endpoints, public data, SEO, uploads — always open.
  if (isSkipPath(pathname)) {
    return { valid: true, clientType: 'unknown' };
  }

  // ---- Level 2: External client (mini program / API client) → signature ----
  if (isExternalClient(request)) {
    if (config.skipPublicGet && method === 'GET') {
      return { valid: true, clientType: 'unknown' };
    }
    return verifySignature(request, config);
  }

  // ---- Level 3: Browser request → check domain whitelist ----
  // If Origin/Referer is present, verify the domain is allowed.
  // Direct navigation (no Origin/Referer) is always allowed.
  const originHost = extractOriginHost(request);
  if (originHost && !isOriginAllowed(originHost, config.allowedOrigins)) {
    return {
      valid: false,
      response: NextResponse.json(
        { code: 40307, message: '来源域名未授权' },
        { status: 403 }
      ),
    };
  }

  return { valid: true, clientType: 'web' };
}

/**
 * Full signature verification for external API clients (mini programs, etc.)
 */
async function verifySignature(request: NextRequest, config: GuardConfig): Promise<GuardResult> {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const appId = request.headers.get('X-App-Id');
  const timestamp = request.headers.get('X-Timestamp');
  const nonce = request.headers.get('X-Nonce');
  const sign = request.headers.get('X-Sign');

  if (!appId || !timestamp || !nonce || !sign) {
    return {
      valid: false,
      response: NextResponse.json(
        { code: 40301, message: '缺少签名参数(X-App-Id, X-Timestamp, X-Nonce, X-Sign)', data: null },
        { status: 403 }
      ),
    };
  }

  const client = config.clients.find(c => c.appId === appId);
  if (!client) {
    return {
      valid: false,
      response: NextResponse.json(
        { code: 40302, message: '无效的AppId' },
        { status: 403 }
      ),
    };
  }

  if (!client.enabled) {
    return {
      valid: false,
      response: NextResponse.json(
        { code: 40303, message: '客户端已被禁用' },
        { status: 403 }
      ),
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const requestTs = parseInt(timestamp, 10);
  if (isNaN(requestTs) || Math.abs(now - requestTs) > config.timestampTolerance) {
    return {
      valid: false,
      response: NextResponse.json(
        { code: 40304, message: '请求时间戳无效或已过期' },
        { status: 403 }
      ),
    };
  }

  if (nonceSet.has(nonce)) {
    return {
      valid: false,
      response: NextResponse.json(
        { code: 40305, message: '重复的请求(Nonce已使用)' },
        { status: 403 }
      ),
    };
  }
  nonceSet.add(nonce);

  let body = '';
  try {
    body = await request.clone().text();
  } catch { body = ''; }

  let signSecret = client.appSecret;

  if (client.clientType === 'miniprogram') {
    const signKeyRef = request.headers.get('X-Sign-Key-Ref');
    if (signKeyRef) {
      // 登录用户：使用动态签名密钥（更安全，与用户绑定）
      const cached = await getCache<{ signKey: string; userId: string; appId: string }>(`mpsign:${signKeyRef}`);
      if (!cached) {
        return {
          valid: false,
          response: NextResponse.json(
            { code: 40309, message: '签名密钥无效或已过期，请重新登录' },
            { status: 403 }
          ),
        };
      }

      if (cached.appId !== client.appId) {
        return {
          valid: false,
          response: NextResponse.json(
            { code: 40310, message: '签名密钥与客户端不匹配' },
            { status: 403 }
          ),
        };
      }

      signSecret = cached.signKey;
    }
    // 未登录用户：回退使用静态 appSecret（无需登录即可鉴权）
  }

  const signStr = signSecret + timestamp + nonce + method + pathname + body;
  const expectedSign = await computeSha256(signStr);

  if (!secureCompare(sign, expectedSign)) {
    return {
      valid: false,
      response: NextResponse.json(
        { code: 40306, message: '签名验证失败' },
        { status: 403 }
      ),
    };
  }

  return { valid: true, clientType: client.clientType };
}

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ==================== Client Type Helper ====================

export function getClientTypeFromRequest(request: NextRequest): string {
  return request.headers.get('x-client-type') || 'unknown';
}

// ==================== Secret Generation ====================

export function generateSecret(length: number = 48): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

function generateSignKeyRef(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return 'sk_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// ==================== Miniprogram Dynamic SignKey ====================

export interface SignKeyResult {
  signKey: string;
  signKeyRef: string;
  expiresAt: number;
  ttl: number;
}

export async function issueMiniprogramSignKey(
  userId: string,
  appId: string,
  ttl?: number
): Promise<SignKeyResult> {
  let keyTtl = ttl;
  if (!keyTtl || keyTtl <= 0) {
    keyTtl = cachedConfig?.signKeyTtl || 86400;
  }

  const signKey = generateSecret(48);
  const signKeyRef = generateSignKeyRef();
  const expiresAt = Math.floor(Date.now() / 1000) + keyTtl;

  await setCache(`mpsign:${signKeyRef}`, { signKey, userId, appId }, keyTtl);

  return { signKey, signKeyRef, expiresAt, ttl: keyTtl };
}

export async function revokeMiniprogramSignKey(signKeyRef: string): Promise<void> {
  await deleteCache(`mpsign:${signKeyRef}`);
}

export async function getSignKeyTtl(): Promise<number> {
  return cachedConfig?.signKeyTtl || 86400;
}
