import type { Metadata } from 'next';
import { getSiteConfig, formatTitle } from '@/lib/site-config';

// 关于页面 SEO 元数据 — 从数据库动态获取站点名称
export async function generateMetadata(): Promise<Metadata> {
  const { siteName, siteDescription } = await getSiteConfig();
  const title = formatTitle('关于我们', siteName);
  return {
    title,
    description: `了解${siteName}——${siteDescription}连接摄影师与世界的桥梁。`,
    keywords: ['摄影', '作品集', siteName, '关于', 'photography', 'about'],
    openGraph: {
      title,
      description: siteDescription,
      type: 'website',
    },
  };
}

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
