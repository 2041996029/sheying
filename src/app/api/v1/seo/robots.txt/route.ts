import { db } from '@/lib/db';
import { getSiteConfig } from '@/lib/site-config';

export async function GET() {
  try {
    // 优先从数据库配置读取，环境变量作为兜底
    const siteConfig = await getSiteConfig();
    const baseUrl = siteConfig.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://photography.example.com';

    // 读取额外 robots.txt 规则
    let extraRules = '';
    try {
      const config = await db.config.findUnique({ where: { key: 'seo_robots_extra' } });
      if (config?.value) {
        extraRules = '\n' + config.value;
      }
    } catch {
      // 数据库不可用时忽略额外规则
    }

    let txt = 'User-agent: *\n';
    txt += 'Allow: /\n';
    txt += 'Disallow: /api/\n';
    txt += 'Disallow: /admin/\n';
    txt += extraRules;
    txt += '\n';
    txt += `Sitemap: ${baseUrl}/api/v1/seo/sitemap.xml\n`;

    return new Response(txt, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('Robots.txt error:', err);
    return new Response('Error generating robots.txt', { status: 500 });
  }
}
