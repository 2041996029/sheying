import type { Metadata } from 'next';
import { getSiteConfig, formatTitle } from '@/lib/site-config';

// 分类列表页 SEO 元数据 — 从数据库动态获取站点名称
export async function generateMetadata(): Promise<Metadata> {
  const { siteName, siteDescription } = await getSiteConfig();
  const title = formatTitle('作品分类', siteName);
  return {
    title,
    description: `浏览不同类别的摄影作品——风光、人像、街拍、建筑、微距、黑白等多种分类。${siteDescription}`,
    keywords: ['摄影分类', '风光摄影', '人像摄影', '街拍', siteName],
    openGraph: {
      title,
      description: `浏览不同类别的摄影作品，${siteDescription}`,
      type: 'website',
    },
  };
}

export default function CategoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
