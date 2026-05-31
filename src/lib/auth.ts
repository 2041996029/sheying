// JWT认证工具
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// JWT密钥 - 生产环境必须通过环境变量设置，否则启动时警告
const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn('[安全警告] JWT_SECRET 未设置！请在 .env 中配置一个强随机密钥。当前使用临时密钥，重启后所有Token将失效。');
    // 开发环境使用临时密钥（每次启动不同），生产环境务必配置
    return crypto.randomBytes(32).toString('hex');
  }
  return secret;
})();
// 运行时可配置的Token有效期（通过配置中心修改）
let accessTokenTtl = 7200; // 默认2小时
let refreshTokenTtl = 7 * 24 * 3600; // 默认7天

// 设置 Access Token 有效期（秒）
export function setAccessTokenTtl(ttl: number): void {
  if (ttl > 0) {
    const old = accessTokenTtl;
    accessTokenTtl = ttl;
    if (old !== ttl) {
      console.debug(`[Auth] Access Token TTL已更新: ${ttl}秒`);
    }
  }
}

// 设置 Refresh Token 有效期（秒）
export function setRefreshTokenTtl(ttl: number): void {
  if (ttl > 0) {
    const old = refreshTokenTtl;
    refreshTokenTtl = ttl;
    if (old !== ttl) {
      console.debug(`[Auth] Refresh Token TTL已更新: ${ttl}秒`);
    }
  }
}

// 获取当前 Access Token 有效期
export function getAccessTokenTtl(): number {
  return accessTokenTtl;
}

// 获取当前 Refresh Token 有效期
export function getRefreshTokenTtl(): number {
  return refreshTokenTtl;
}

interface TokenPayload {
  sub: string;
  role: string;
  type: 'access' | 'refresh';
  jti?: string;
  iat?: number;
  exp?: number;
}

// Simple JWT implementation for Edge Runtime compatibility
function base64UrlEncode(data: string): string {
  return Buffer.from(data).toString('base64url');
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString();
}

function sign(payload: TokenPayload, ttl: number): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + ttl, jti: payload.jti || uuidv4() };
  const payloadStr = base64UrlEncode(JSON.stringify(fullPayload));
  
  // Simple HMAC using crypto
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payloadStr}`)
    .digest('base64url');
  
  return `${header}.${payloadStr}.${signature}`;
}

function verify(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${parts[0]}.${parts[1]}`)
      .digest('base64url');
    
    // 使用恒定时间比较防止时序攻击
    const sigBuf = Buffer.from(signature, 'base64url');
    const expectedBuf = Buffer.from(parts[2], 'base64url');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
    
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

// 生成双Token
export function generateTokenPair(userId: string, role: string) {
  const accessToken = sign({ sub: userId, role, type: 'access' }, accessTokenTtl);
  const refreshToken = sign({ sub: userId, role, type: 'refresh' }, refreshTokenTtl);
  
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: accessTokenTtl,
  };
}

// 验证Access Token
export function verifyAccessToken(token: string): TokenPayload | null {
  const payload = verify(token);
  if (!payload || payload.type !== 'access') return null;
  return payload;
}

// 验证Refresh Token
export function verifyRefreshToken(token: string): TokenPayload | null {
  const payload = verify(token);
  if (!payload || payload.type !== 'refresh') return null;
  return payload;
}

// 密码哈希 — 使用异步pbkdf2避免阻塞事件循环
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await new Promise<string>((resolve, reject) => {
    crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex'));
    });
  });
  return `${salt}:${hash}`;
}

// 验证密码 — 使用异步pbkdf2 + timingSafeEqual防止时序攻击
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = await new Promise<string>((resolve, reject) => {
    crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex'));
    });
  });
  // 使用恒定时间比较防止时序攻击
  const hashBuf = Buffer.from(hash, 'hex');
  const verifyBuf = Buffer.from(verifyHash, 'hex');
  if (hashBuf.length !== verifyBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, verifyBuf);
}
