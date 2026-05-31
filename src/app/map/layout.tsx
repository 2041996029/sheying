import type { Metadata } from 'next';
import { getSiteConfig, formatTitle } from '@/lib/site-config';

// 足迹地图页 SEO 元数据 — 从数据库动态获取站点名称
export async function generateMetadata(): Promise<Metadata> {
  const { siteName, siteDescription } = await getSiteConfig();
  const title = formatTitle('足迹地图', siteName);
  return {
    title,
    description: `在地图上探索摄影作品的拍摄足迹——浏览摄影师走过的城市与风景，发现身边的精彩瞬间。${siteDescription}`,
    keywords: ['足迹地图', '摄影地图', '拍摄地点', '旅行摄影', siteName],
    openGraph: {
      title,
      description: `在地图上探索摄影作品的拍摄足迹。${siteDescription}`,
      type: 'website',
    },
  };
}

export default function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
