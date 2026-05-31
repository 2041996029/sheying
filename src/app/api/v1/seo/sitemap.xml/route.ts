import { db } from '@/lib/db';
import { getCache, setCache } from '@/lib/cache';
import { getSiteConfig } from '@/lib/site-config';

export async function GET() {
  try {
    // 缓存sitemap，3600秒（1小时）TTL — 内容变化不频繁
    const cacheKey = 'seo:sitemap';
    const cached = await getCache<string>(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // 优先从数据库配置读取，环境变量作为兜底
    const siteConfig = await getSiteConfig();
    const baseUrl = siteConfig.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://photography.example.com';

    const [works, categories] = await Promise.all([
      db.work.findMany({
        where: { deletedAt: null, status: 'published' },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      db.category.findMany({
        where: { deletedAt: null },
        select: { id: true, updatedAt: true },
      }),
    ]);

    const now = new Date().toISOString();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Homepage
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>1.0</priority>\n';
    xml += '  </url>\n';

    // Works
    for (const work of works) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/works/${work.id}</loc>\n`;
      xml += `    <lastmod>${work.updatedAt.toISOString()}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    }

    // Categories
    for (const cat of categories) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/categories/${cat.id}</loc>\n`;
      xml += `    <lastmod>${cat.updatedAt.toISOString()}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.6</priority>\n';
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    // Cache for 3600 seconds (1 hour)
    await setCache(cacheKey, xml, 3600);

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('Sitemap error:', err);
    return new Response('Error generating sitemap', { status: 500 });
  }
}
