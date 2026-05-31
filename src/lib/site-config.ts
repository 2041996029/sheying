// 服务端站点配置获取 — 用于 generateMetadata 和服务器组件
// 与客户端 config-store 不同，此模块直接从数据库读取，适用于 SSR/SSG 场景

import { db } from '@/lib/db';
import { getCache, setCache } from '@/lib/cache';

export interface SiteConfigForMeta {
  siteName: string;
  siteDescription: string;
  siteKeywords: string;
  siteUrl: string;
  ogImage: string;
  ogType: string;
  twitterCard: string;
}

const SITE_CONFIG_CACHE_KEY = 'metadata:site_config';
const SITE_CONFIG_CACHE_TTL = 300; // 5分钟缓存，平衡实时性和性能

// 默认兜底值（数据库未配置时使用）
const DEFAULT_CONFIG: SiteConfigForMeta = {
  siteName: '光影集',
  siteDescription: '发现精美摄影作品，记录光影之美。专业的摄影作品展示与管理平台。',
  siteKeywords: '摄影,作品集,光影集,photography,gallery',
  siteUrl: '',
  ogImage: '',
  ogType: 'website',
  twitterCard: 'summary_large_image',
};

/**
 * 从数据库获取站点配置（服务端专用）
 * 优先从 Redis 缓存读取，未命中则查库并缓存
 */
export async function getSiteConfig(): Promise<SiteConfigForMeta> {
  // 1. 尝试从缓存获取
  try {
    const cached = await getCache<SiteConfigForMeta>(SITE_CONFIG_CACHE_KEY);
    if (cached && cached.siteName) return cached;
  } catch {
    // 缓存不可用时继续查库
  }

  // 2. 从数据库批量读取站点配置
  try {
    const configs = await db.config.findMany({
      where: {
        key: { in: ['site_name', 'site_description', 'site_keywords', 'seo_site_url', 'seo_og_image', 'seo_og_type', 'seo_twitter_card'] },
      },
      select: { key: true, value: true },
    });

    const get = (key: string) => configs.find((c) => c.key === key)?.value || '';

    const result: SiteConfigForMeta = {
      siteName: get('site_name') || DEFAULT_CONFIG.siteName,
      siteDescription: get('site_description') || DEFAULT_CONFIG.siteDescription,
      siteKeywords: get('site_keywords') || DEFAULT_CONFIG.siteKeywords,
      siteUrl: get('seo_site_url') || process.env.NEXT_PUBLIC_SITE_URL || '',
      ogImage: get('seo_og_image') || DEFAULT_CONFIG.ogImage,
      ogType: get('seo_og_type') || DEFAULT_CONFIG.ogType,
      twitterCard: get('seo_twitter_card') || DEFAULT_CONFIG.twitterCard,
    };

    // 3. 写入缓存
    try {
      await setCache(SITE_CONFIG_CACHE_KEY, result, SITE_CONFIG_CACHE_TTL);
    } catch {
      // 缓存写入失败不影响返回
    }

    return result;
  } catch {
    // 数据库不可用时使用默认值
    return DEFAULT_CONFIG;
  }
}

/**
 * 生成带站点名称后缀的标题
 * 格式："{页面名} - {站点名}"
 */
export function formatTitle(pageName: string, siteName: string): string {
  return `${pageName} - ${siteName}`;
}
