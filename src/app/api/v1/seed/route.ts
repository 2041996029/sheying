import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { hashPassword } from '@/lib/auth';
import { CONFIG_DEFAULTS } from '@/lib/config-defaults';

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const requestId = getRequestId(request);
  try {
    // Check if already seeded
    const adminCount = await db.user.count({ where: { role: 'super_admin' } });
    if (adminCount > 0) {
      return error(40901, '数据已初始化，请勿重复操作', requestId);
    }

    // 1. Create super_admin
    const hashedPassword = await hashPassword('admin123456');
    const admin = await db.user.create({
      data: {
        email: 'admin@photo.com',
        password: hashedPassword,
        nickname: '管理员',
        role: 'super_admin',
        status: 'active',
      },
    });

    // 2. Create sample categories
    const categories = await Promise.all([
      db.category.create({
        data: { name: '风光', sortOrder: 1, level: 1 },
      }),
      db.category.create({
        data: { name: '人像', sortOrder: 2, level: 1 },
      }),
      db.category.create({
        data: { name: '街拍', sortOrder: 3, level: 1 },
      }),
      db.category.create({
        data: { name: '建筑', sortOrder: 4, level: 1 },
      }),
      db.category.create({
        data: { name: '微距', sortOrder: 5, level: 1 },
      }),
      db.category.create({
        data: { name: '黑白', sortOrder: 6, level: 1 },
      }),
    ]);

    // 3. Create sample works
    const sampleWorks = [
      {
        title: '晨曦中的山峦',
        description: '清晨的第一缕阳光洒在连绵的山脉上，薄雾缭绕，宛如仙境。',
        categoryId: categories[0].id,
        tags: ['风光', '山脉', '日出', '晨曦'],
        isFeatured: true,
      },
      {
        title: '城市黄昏',
        description: '夕阳西下，城市天际线被染成金红色，玻璃幕墙映照着最后的日光。',
        categoryId: categories[3].id,
        tags: ['建筑', '城市', '黄昏', '天际线'],
        isFeatured: true,
      },
      {
        title: '花间少女',
        description: '春日花海中，少女回眸一笑，温暖而明媚。',
        categoryId: categories[1].id,
        tags: ['人像', '花卉', '春天', '户外'],
        isFeatured: true,
      },
      {
        title: '老巷故事',
        description: '斑驳的墙壁、蜿蜒的小巷，记录着岁月的痕迹。',
        categoryId: categories[2].id,
        tags: ['街拍', '老巷', '人文', '岁月'],
        isFeatured: false,
      },
      {
        title: '露珠世界',
        description: '微距镜头下的露珠，折射出整个花园的倒影。',
        categoryId: categories[4].id,
        tags: ['微距', '露珠', '自然', '细节'],
        isFeatured: false,
      },
      {
        title: '光影对话',
        description: '明与暗的交织，黑与白的对比，纯粹的视觉语言。',
        categoryId: categories[5].id,
        tags: ['黑白', '光影', '极简', '对比'],
        isFeatured: true,
      },
      {
        title: '海上日出',
        description: '海平面上的日出，金色的光芒铺满整个海面。',
        categoryId: categories[0].id,
        tags: ['风光', '日出', '海洋', '金色'],
        isFeatured: false,
      },
      {
        title: '雨后街道',
        description: '雨后的街道，积水倒映着霓虹灯，城市有了另一番面孔。',
        categoryId: categories[2].id,
        tags: ['街拍', '雨天', '霓虹', '倒影'],
        isFeatured: false,
      },
    ];

    for (const workData of sampleWorks) {
      // Generate placeholder image URLs using different sizes for variety
      const imageCount = 1 + Math.floor(Math.random() * 3);
      const images: string[] = [];
      for (let i = 0; i < imageCount; i++) {
        const w = 800 + Math.floor(Math.random() * 400);
        const h = 600 + Math.floor(Math.random() * 400);
        images.push(`https://picsum.photos/seed/${workData.title}-${i}/${w}/${h}`);
      }

      await db.work.create({
        data: {
          title: workData.title,
          description: workData.description,
          images: JSON.stringify(images),
          coverUrl: images[0],
          category: { connect: { id: workData.categoryId } },
          tags: JSON.stringify(workData.tags),
          params: JSON.stringify({
            camera: 'Canon EOS R5',
            lens: 'RF 24-105mm f/4L IS USM',
            aperture: 'f/4.0',
            shutter: '1/250s',
            iso: '100',
            focalLength: '50mm',
          }),
          isFeatured: workData.isFeatured,
          status: 'published',
          likeCount: Math.floor(Math.random() * 100),
          favoriteCount: Math.floor(Math.random() * 50),
          viewCount: Math.floor(Math.random() * 500) + 50,
          commentCount: Math.floor(Math.random() * 20),
        },
      });
    }

    // 4. Create default configs
    for (const [key, config] of Object.entries(CONFIG_DEFAULTS)) {
      await db.config.upsert({
        where: { key },
        create: {
          key,
          value: config.value,
          group: config.group,
          description: config.description,
          isEncrypted: config.isEncrypted || false,
        },
        update: {
          value: config.value,
          group: config.group,
          description: config.description,
          isEncrypted: config.isEncrypted || false,
        },
      });
    }

    // 5. Create today's daily stat
    const today = new Date().toISOString().split('T')[0];
    await db.dailyStat.upsert({
      where: { statDate: today },
      create: {
        statDate: today,
        viewCount: 0,
        likeCount: 0,
        favoriteCount: 0,
        commentCount: 0,
        newWorkCount: sampleWorks.length,
        newUserCount: 1,
      },
      update: {},
    });

    return success({
      admin: { id: admin.id, email: admin.email, warning: '请立即修改默认密码！默认密码为 admin123456' },
      categories: categories.length,
      works: sampleWorks.length,
      configs: Object.keys(CONFIG_DEFAULTS).length,
    }, '数据初始化成功 - 请务必修改默认管理员密码！', requestId);
  } catch (err) {
    console.error('Seed error:', err);
    return error(50001, '数据初始化失败', requestId);
  }
}
