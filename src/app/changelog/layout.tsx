import type { Metadata } from 'next';
import { getSiteConfig, formatTitle } from '@/lib/site-config';

// 更新日志页 SEO 元数据 — 从数据库动态获取站点名称
export async function generateMetadata(): Promise<Metadata> {
  const { siteName, siteDescription } = await getSiteConfig();
  const title = formatTitle('更新日志', siteName);
  return {
    title,
    description: `查看${siteName}平台的更新日志——功能更新、性能优化、问题修复等版本迭代记录。`,
    keywords: ['更新日志', '版本更新', 'changelog', siteName],
    openGraph: {
      title,
      description: `查看${siteName}平台的更新日志和版本迭代记录。`,
      type: 'website',
    },
  };
}

export default function ChangelogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
