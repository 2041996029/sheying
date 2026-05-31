import type { Metadata } from 'next';
import { getSiteConfig, formatTitle } from '@/lib/site-config';

// 为分类详情页生成动态SEO元数据 — 站点名从数据库获取
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { siteName, siteDescription } = await getSiteConfig();

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    const res = await fetch(`${baseUrl}/api/v1/categories`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.code === 0 && json.data) {
        const category = json.data.find((c: { id: string; name: string }) => c.id === id);
        if (category) {
          const title = formatTitle(`${category.name} - 作品分类`, siteName);
          return {
            title,
            description: `浏览${category.name}分类下的摄影作品 - ${siteDescription}`,
            openGraph: {
              title: formatTitle(category.name, siteName),
              description: `浏览${category.name}分类下的摄影作品`,
              type: 'website',
            },
          };
        }
      }
    }
  } catch {
    // 获取失败时使用默认元数据
  }

  return {
    title: formatTitle('分类作品', siteName),
    description: `浏览不同类别的摄影作品 - ${siteDescription}`,
  };
}

export default function CategoryDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
