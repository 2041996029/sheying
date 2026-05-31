import type { Metadata } from 'next';
import { getSiteConfig, formatTitle } from '@/lib/site-config';

// 为作品详情页生成动态SEO元数据 — 站点名从数据库获取
// 由于 page.tsx 是 'use client'，metadata 必须在服务器组件（layout）中导出
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { siteName, siteDescription } = await getSiteConfig();

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    // 在服务器端直接查询API获取作品信息
    const res = await fetch(`${baseUrl}/api/v1/works/${id}`, {
      next: { revalidate: 3600 }, // 缓存1小时
    });
    if (res.ok) {
      const json = await res.json();
      if (json.code === 0 && json.data) {
        const work = json.data;
        const title = work.title || '作品详情';
        const description = work.description || `${title} - ${siteDescription}`;
        const coverUrl = work.coverUrl || '';

        return {
          title: formatTitle(title, siteName),
          description: description.substring(0, 160),
          keywords: work.tags?.length > 0 ? work.tags : ['摄影', '作品'],
          openGraph: {
            title: formatTitle(title, siteName),
            description: description.substring(0, 160),
            type: 'article',
            images: coverUrl ? [{ url: coverUrl, width: 1200, height: 630, alt: title }] : [],
            publishedTime: work.createdAt,
          },
          twitter: {
            card: 'summary_large_image',
            title: formatTitle(title, siteName),
            description: description.substring(0, 160),
            images: coverUrl ? [coverUrl] : [],
          },
        };
      }
    }
  } catch {
    // 获取失败时使用默认元数据
  }

  return {
    title: formatTitle('作品详情', siteName),
    description: siteDescription,
  };
}

export default function WorkDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
