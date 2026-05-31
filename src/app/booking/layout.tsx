import type { Metadata } from 'next';
import { getSiteConfig, formatTitle } from '@/lib/site-config';

// 预约约拍页 SEO 元数据 — 从数据库动态获取站点名称
export async function generateMetadata(): Promise<Metadata> {
  const { siteName, siteDescription } = await getSiteConfig();
  const title = formatTitle('预约约拍', siteName);
  return {
    title,
    description: `预约专业摄影服务——风光摄影、人像写真、商业摄影等多种摄影类型，与摄影师零距离对接。${siteDescription}`,
    keywords: ['约拍', '预约摄影', '摄影服务', '写真', siteName],
    openGraph: {
      title,
      description: `预约专业摄影服务，与摄影师零距离对接。${siteDescription}`,
      type: 'website',
    },
  };
}

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
