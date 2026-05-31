import type { Metadata } from 'next';
import { getSiteConfig, formatTitle } from '@/lib/site-config';

// 搜索页 SEO 元数据 — 从数据库动态获取站点名称
export async function generateMetadata(): Promise<Metadata> {
  const { siteName, siteDescription } = await getSiteConfig();
  const title = formatTitle('搜索作品', siteName);
  return {
    title,
    description: `搜索摄影作品——按标题、标签、描述等关键词快速找到您感兴趣的摄影作品。${siteDescription}`,
    keywords: ['搜索', '摄影作品', siteName, '搜索摄影'],
    openGraph: {
      title,
      description: `搜索摄影作品，${siteDescription}`,
      type: 'website',
    },
  };
}

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
