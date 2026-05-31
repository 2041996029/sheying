// 微信小程序工具模块
// 提供 access_token 获取/缓存、小程序码生成等功能

import { db } from '@/lib/db';
import { getCache, setCache } from '@/lib/cache';
import { CONFIG_DEFAULTS } from '@/lib/config-defaults';

// ==================== 微信小程序配置 ====================

export async function getMiniProgramConfig(): Promise<{ appid: string; appsecret: string }> {
  const configs = await db.config.findMany({
    where: {
      key: { in: ['miniprogram_appid', 'miniprogram_appsecret'] },
    },
  });

  // 自动创建缺失的配置项
  const missingKeys: string[] = [];
  if (!configs.find((c) => c.key === 'miniprogram_appid')) missingKeys.push('miniprogram_appid');
  if (!configs.find((c) => c.key === 'miniprogram_appsecret')) missingKeys.push('miniprogram_appsecret');

  for (const key of missingKeys) {
    const defaultConfig = CONFIG_DEFAULTS[key];
    if (defaultConfig) {
      try {
        await db.config.upsert({
          where: { key },
          create: {
            key,
            value: defaultConfig.value,
            group: defaultConfig.group,
            description: defaultConfig.description,
            isEncrypted: defaultConfig.isEncrypted || false,
          },
          update: {},
        });
      } catch {
        // ignore race condition
      }
    }
  }

  // 重新查询以包含新创建的配置项
  const updatedConfigs = missingKeys.length > 0
    ? await db.config.findMany({ where: { key: { in: ['miniprogram_appid', 'miniprogram_appsecret'] } } })
    : configs;

  const appid = updatedConfigs.find((c) => c.key === 'miniprogram_appid')?.value || '';
  const appsecret = updatedConfigs.find((c) => c.key === 'miniprogram_appsecret')?.value || '';

  return { appid, appsecret };
}

// ==================== Access Token ====================

const WX_ACCESS_TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token';
const ACCESS_TOKEN_CACHE_KEY = 'wechat:access_token';
// 默认 TTL：微信官方有效期 7200 秒，提前 5 分钟刷新；实际值从数据库配置读取
const DEFAULT_ACCESS_TOKEN_TTL = 6900;

/**
 * 从数据库读取 access_token 缓存有效期
 */
async function getAccessTokenTtl(): Promise<number> {
  try {
    const config = await db.config.findUnique({ where: { key: 'miniprogram_access_token_ttl' } });
    if (config?.value) {
      const ttl = parseInt(config.value, 10);
      if (!isNaN(ttl) && ttl > 0 && ttl <= 7200) {
        return ttl;
      }
    }
  } catch {
    // 读取失败时使用默认值
  }
  return DEFAULT_ACCESS_TOKEN_TTL;
}

interface WxAccessTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

/**
 * 获取微信小程序 access_token
 * 优先从缓存获取，缓存不存在或过期则重新请求
 */
export async function getAccessToken(): Promise<string> {
  // 尝试从缓存获取
  const cached = await getCache<string>(ACCESS_TOKEN_CACHE_KEY);
  if (cached) {
    return cached;
  }

  // 从微信接口获取
  const { appid, appsecret } = await getMiniProgramConfig();
  if (!appid || !appsecret) {
    throw new Error('小程序未配置AppID或AppSecret，请在后台配置中心填写');
  }

  const url = `${WX_ACCESS_TOKEN_URL}?grant_type=client_credential&appid=${appid}&secret=${appsecret}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`微信接口请求失败: HTTP ${response.status}`);
  }

  const result: WxAccessTokenResponse = await response.json();

  if (result.errcode) {
    console.error('微信access_token获取失败:', result.errcode, result.errmsg);
    throw new Error(`获取access_token失败: ${result.errmsg || '未知错误'} (errcode: ${result.errcode})`);
  }

  if (!result.access_token) {
    throw new Error('获取access_token失败: 返回数据为空');
  }

  // 缓存 access_token，TTL 从数据库配置读取
  const ttl = await getAccessTokenTtl();
  await setCache(ACCESS_TOKEN_CACHE_KEY, result.access_token, ttl);

  return result.access_token;
}

// ==================== 小程序码生成 ====================

const WX_WXACODE_URL = 'https://api.weixin.qq.com/wxa/getwxacodeunlimit';

// 小程序码 Redis 缓存前缀，缓存 30 天
// v2: is_hyaline 改为 false（白底），与 v1 透明底码不兼容，需换缓存前缀
const QRCODE_CACHE_PREFIX = 'wechat:qrcode:v2:';
const QRCODE_CACHE_TTL = 30 * 24 * 3600;

interface WxQrCodeOptions {
  /** 作品ID，将作为小程序码的 scene 参数 */
  workId: string;
  /** 小程序页面路径，默认为作品详情页 */
  page?: string;
  /** 小程序版本: release / trial / develop */
  envVersion?: 'release' | 'trial' | 'develop';
  /** 二维码宽度，默认430，最小280，最大1280 */
  width?: number;
  /** 自动配置线条颜色 */
  autoColor?: boolean;
  /** 线条颜色 { "r": 0, "g": 0, "b": 0 } */
  lineColor?: { r: number; g: number; b: number };
  /** 是否需要透明底色 */
  isHyaline?: boolean;
}

export interface WxQrCodeResult {
  /** 小程序码 base64 数据 (data:image/png;base64,...) */
  base64: string;
  /** 作品ID */
  workId: string;
}

/**
 * 从数据库读取小程序码相关配置
 */
async function getQrCodeConfig(): Promise<{
  envVersion: 'release' | 'trial' | 'develop';
  page: string;
}> {
  let envVersion: 'release' | 'trial' | 'develop' = 'trial';
  let page = 'pages/detail/detail';

  try {
    const configs = await db.config.findMany({
      where: {
        key: { in: ['miniprogram_env_version', 'miniprogram_qrcode_page'] },
      },
    });

    // 自动创建缺失的配置项，确保后台配置中心能看到
    const missingKeys: string[] = [];
    if (!configs.find((c) => c.key === 'miniprogram_env_version')) missingKeys.push('miniprogram_env_version');
    if (!configs.find((c) => c.key === 'miniprogram_qrcode_page')) missingKeys.push('miniprogram_qrcode_page');

    for (const key of missingKeys) {
      const defaultConfig = CONFIG_DEFAULTS[key];
      if (defaultConfig) {
        try {
          await db.config.upsert({
            where: { key },
            create: {
              key,
              value: defaultConfig.value,
              group: defaultConfig.group,
              description: defaultConfig.description,
              isEncrypted: defaultConfig.isEncrypted || false,
            },
            update: {},
          });
        } catch {
          // ignore race condition
        }
      }
    }

    const envConfig = configs.find((c) => c.key === 'miniprogram_env_version');
    if (envConfig?.value && ['release', 'trial', 'develop'].includes(envConfig.value)) {
      envVersion = envConfig.value as 'release' | 'trial' | 'develop';
    }

    const pageConfig = configs.find((c) => c.key === 'miniprogram_qrcode_page');
    if (pageConfig?.value && pageConfig.value.trim()) {
      // 去掉前导斜杠，确保格式正确
      page = pageConfig.value.trim().replace(/^\/+/, '');
    }
  } catch {
    // 读取配置失败时使用默认值
  }

  return { envVersion, page };
}

/**
 * 调用微信 getwxacodeunlimit 接口生成小程序码（内部方法）
 * @param page 页面路径，传空字符串则不指定页面（默认跳主页）
 */
async function doFetchWxaCode(
  accessToken: string,
  scene: string,
  page: string,
  envVersion: 'release' | 'trial' | 'develop',
  width: number,
  autoColor: boolean,
  lineColor?: { r: number; g: number; b: number },
  isHyaline?: boolean
): Promise<string> {
  const body: Record<string, unknown> = {
    scene,
    env_version: envVersion,
    width,
    auto_color: autoColor,
    is_hyaline: isHyaline ?? false,
  };

  // page 不为空时才传入，为空则跳主页
  if (page) {
    body.page = page;
  }

  if (lineColor) {
    body.line_color = lineColor;
  }

  const url = `${WX_WXACODE_URL}?access_token=${accessToken}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`微信小程序码接口请求失败: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';

  // 如果返回的是 JSON，说明出错了
  if (contentType.includes('application/json')) {
    const errorResult = await response.json();
    const errcode = errorResult.errcode;
    const errmsg = errorResult.errmsg || '未知错误';

    // 41030: invalid page — 抛出特定错误供上层重试
    if (errcode === 41030) {
      const err = new Error(`INVALID_PAGE:${page}`) as Error & { errcode: number; page: string };
      err.errcode = errcode;
      err.page = page;
      throw err;
    }

    console.error('微信小程序码生成失败:', errorResult);
    throw new Error(`小程序码生成失败: ${errmsg} (errcode: ${errcode})`);
  }

  // 将图片 Buffer 转为 base64
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:image/png;base64,${base64}`;
}

/**
 * 调用微信 getwxacodeunlimit 接口生成小程序码
 * 支持智能降级：当配置的页面路径无效(errcode 41030)时，
 * 自动降级为不指定页面（跳主页），确保小程序码能正常生成
 * 返回 base64 编码的图片数据
 */
async function fetchWxaCodeFromWeChat(options: WxQrCodeOptions): Promise<string> {
  const accessToken = await getAccessToken();
  const config = await getQrCodeConfig();

  const page = options.page || config.page;
  const envVersion = options.envVersion || config.envVersion;
  const width = options.width || 430;
  const autoColor = options.autoColor ?? false;
  const isHyaline = options.isHyaline ?? false;

  // 第一次尝试：使用配置的页面路径
  try {
    return await doFetchWxaCode(accessToken, options.workId, page, envVersion, width, autoColor, options.lineColor, isHyaline);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '';

    // 如果是 41030 (invalid page) 错误，尝试降级
    if (errMsg.startsWith('INVALID_PAGE:')) {
      const invalidPage = errMsg.replace('INVALID_PAGE:', '');
      console.warn(`小程序码页面路径无效: ${invalidPage}，尝试降级为首页...`);

      // 第二次尝试：使用首页 pages/index/index（tabBar 页面一定存在）
      try {
        const result = await doFetchWxaCode(
          accessToken, options.workId, 'pages/index/index', envVersion, width, autoColor, options.lineColor, isHyaline
        );
        console.warn('小程序码降级成功：已使用首页生成，扫码后将进入首页（需在首页处理 scene 参数跳转）');
        return result;
      } catch (fallbackError: unknown) {
        const fallbackErrMsg = fallbackError instanceof Error ? fallbackError.message : '';

        // 如果首页也 41030（极端情况），尝试不指定页面
        if (fallbackErrMsg.startsWith('INVALID_PAGE:')) {
          console.warn('首页路径也无效，尝试不指定页面...');
          try {
            const result = await doFetchWxaCode(
              accessToken, options.workId, '', envVersion, width, autoColor, options.lineColor, isHyaline
            );
            console.warn('小程序码降级成功：已使用无页面参数生成');
            return result;
          } catch (finalError) {
            console.error('小程序码生成最终失败:', finalError);
            throw new Error(
              `小程序码生成失败：所有页面路径均无效。请检查小程序是否已发布，并在后台配置中心修改「小程序码跳转页面路径」。`
            );
          }
        }

        throw fallbackError;
      }
    }

    throw error;
  }
}

/**
 * 生成作品分享小程序码（base64 格式）
 * 优先从 Redis 缓存获取，缓存不存在则调用微信接口生成
 * @param force 强制重新生成，忽略已有缓存
 */
export async function generateWorkQrCode(options: WxQrCodeOptions, force = false): Promise<WxQrCodeResult> {
  const { workId } = options;
  const cacheKey = `${QRCODE_CACHE_PREFIX}${workId}`;

  // 1. 检查作品是否存在
  const work = await db.work.findUnique({
    where: { id: workId },
    select: { id: true },
  });

  if (!work) {
    throw new Error('作品不存在');
  }

  // 2. 尝试从 Redis 缓存获取（非强制刷新时）
  if (!force) {
    const cached = await getCache<string>(cacheKey);
    if (cached) {
      return { base64: cached, workId };
    }
  }

  // 3. 调用微信接口生成小程序码
  const base64 = await fetchWxaCodeFromWeChat(options);

  // 4. 缓存到 Redis（30天）
  await setCache(cacheKey, base64, QRCODE_CACHE_TTL);

  return { base64, workId };
}
