#!/usr/bin/env node
/**
 * 光影集 - 配置修复脚本
 * 用途：确保数据库中所有默认配置项存在且正确
 * 运行：node fix-configs.js
 *
 * 注意：此文件的 CONFIG_DEFAULTS 必须与 src/lib/config-defaults.ts 保持同步
 */

const fs = require('fs');
const path = require('path');

// ==================== 加载环境变量 ====================
function loadEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('[错误] 未找到 .env 文件:', envPath);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();
      // 去除引号
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

loadEnv();

// ==================== 默认配置项 ====================
// 与 src/lib/config-defaults.ts 保持同步
const CONFIG_DEFAULTS = {
  // 站点配置
  site_name: { value: '光影集', group: 'site', description: '站点名称' },
  site_description: { value: '摄影作品展示平台', group: 'site', description: '站点描述' },
  site_logo: { value: '', group: 'site', description: '站点Logo' },
  site_keywords: { value: '摄影,作品,展示', group: 'site', description: 'SEO关键词' },
  site_hero_image: { value: '', group: 'site', description: '首页背景图URL，留空则使用精选作品封面' },
  site_hero_title: { value: '光影集', group: 'site', description: '首页主标题' },
  site_hero_subtitle: { value: '发现精美摄影作品，记录光影之美', group: 'site', description: '首页副标题' },

  // 关于页面配置
  about_content: { value: '', group: 'about', description: '关于页面内容(Markdown)' },
  about_eyebrow: { value: 'TO: EVERY PHOTOGRAPHER', group: 'about', description: '关于页面标签文字' },
  about_title: { value: '致每一位*追光者*', group: 'about', description: '关于页面标题(用*包裹的文字显示为斜体)' },
  about_milestones: { value: '[{"phase":"PHASE 01","title":"灵感萌发","desc":"一个关于光影的梦想开始发芽，希望为摄影爱好者搭建专属的展示空间。"},{"phase":"PHASE 02","title":"精心打造","desc":"从界面到交互，从功能到体验，每一个细节都反复打磨，追求极致。"},{"phase":"PHASE 03","title":"社区成长","desc":"越来越多的摄影师加入，作品库不断丰富，社区氛围日渐浓厚。"},{"phase":"PHASE 04","title":"持续进化","desc":"AI 辅助、约拍功能、小程序生态……我们一直在路上，永不停歇。","active":true}]', group: 'about', description: '历程时间线(JSON数组，每项: phase/title/desc/active)' },

  // 社交配置
  social_wechat: { value: '', group: 'social', description: '微信号' },
  social_qr_wechat: { value: '', group: 'social', description: '微信二维码图片URL' },
  social_qq: { value: '', group: 'social', description: 'QQ号' },
  social_qr_qq: { value: '', group: 'social', description: 'QQ二维码图片URL' },
  social_email: { value: '', group: 'social', description: '邮箱' },

  // 显示配置
  display_dark_mode: { value: 'auto', group: 'display', description: '暗黑模式: auto/light/dark' },
  display_theme_preset: { value: 'classic', group: 'display', description: '主题预设: classic/warm-sunrise/cream-latte/morning-mist/sakura' },
  display_comment_enabled: { value: 'true', group: 'display', description: '评论开关' },
  display_exif_panel_position: { value: 'right', group: 'display', description: 'EXIF面板位置' },

  // AI配置
  ai_enabled: { value: 'true', group: 'ai', description: 'AI开关' },
  ai_tag_prompt: { value: '请识别这张照片的内容和风格，返回标签', group: 'ai', description: '识别提示词' },
  ai_timeout: { value: '30', group: 'ai', description: '超时时间(秒)' },
  ai_retry_count: { value: '2', group: 'ai', description: '重试次数' },

  // 约拍配置
  booking_enabled: { value: 'true', group: 'booking', description: '约拍功能开关' },
  booking_cover_image: { value: '', group: 'booking', description: '约拍页面封面图URL' },
  booking_title: { value: '预约约拍', group: 'booking', description: '约拍页面标题' },
  booking_subtitle: { value: '让我们记录你的美好瞬间', group: 'booking', description: '约拍页面副标题' },
  booking_intro: { value: '欢迎约拍', group: 'booking', description: '约拍介绍' },
  booking_price: { value: '详情请咨询', group: 'booking', description: '收费标准' },
  booking_notice: { value: '', group: 'booking', description: '约拍须知' },
  booking_content: { value: '', group: 'booking', description: '约拍页面内容(Markdown)' },

  // 存储配置
  cos_storage_mode: { value: 'local', group: 'cos', description: '存储模式: local(本地)/cos(腾讯云COS)' },
  cos_bucket: { value: '', group: 'cos', description: '存储桶名称' },
  cos_region: { value: '', group: 'cos', description: '区域(如: ap-guangzhou)' },
  cos_cdn_url: { value: '', group: 'cos', description: 'CDN域名(如: https://cdn.example.com)' },
  cos_secret_id: { value: '', group: 'cos', description: 'COS SecretId', isEncrypted: true },
  cos_secret_key: { value: '', group: 'cos', description: 'COS SecretKey', isEncrypted: true },
  cos_upload_dir: { value: 'works', group: 'cos', description: 'COS上传目录' },

  // 认证配置
  auth_access_token_ttl: { value: '7200', group: 'auth', description: 'access_token有效期(秒)' },
  auth_refresh_token_ttl: { value: '604800', group: 'auth', description: 'refresh_token有效期(秒)' },

  // 安全配置
  security_rate_limit_ip: { value: '100', group: 'security', description: 'IP限流阈值(次/分钟)' },
  security_rate_limit_user: { value: '60', group: 'security', description: '用户限流阈值(次/分钟)' },

  // 邮件配置
  email_host: { value: '', group: 'email', description: 'SMTP服务器地址' },
  email_port: { value: '465', group: 'email', description: 'SMTP端口' },
  email_user: { value: '', group: 'email', description: 'SMTP用户名' },
  email_password: { value: '', group: 'email', description: 'SMTP密码', isEncrypted: true },
  email_from: { value: '', group: 'email', description: '发件人地址' },
  email_enabled: { value: 'false', group: 'email', description: '邮件开关' },

  // 缓存配置
  cache_enabled: { value: 'true', group: 'cache', description: '缓存开关' },
  cache_ttl: { value: '300', group: 'cache', description: '缓存默认TTL(秒)' },
  cache_type: { value: 'redis', group: 'cache', description: '缓存类型: redis' },
  redis_host: { value: '', group: 'cache', description: 'Redis地址' },
  redis_port: { value: '6379', group: 'cache', description: 'Redis端口' },
  redis_password: { value: '', group: 'cache', description: 'Redis密码', isEncrypted: true },
  redis_db: { value: '0', group: 'cache', description: 'Redis数据库编号(0-15)' },

  // 小程序配置
  miniprogram_appid: { value: '', group: 'miniprogram', description: '小程序AppID' },
  miniprogram_appsecret: { value: '', group: 'miniprogram', description: '小程序AppSecret', isEncrypted: true },
  miniprogram_env_version: { value: 'trial', group: 'miniprogram', description: '小程序码版本: release(正式)/trial(体验)/develop(开发)' },
  miniprogram_qrcode_page: { value: 'pages/detail/detail', group: 'miniprogram', description: '小程序码跳转页面路径(不含前导/)，如: pages/detail/detail' },

  // 高德地图配置
  amap_api_key: { value: '', group: 'amap', description: '高德地图API Key(Web服务)', isEncrypted: true },
  amap_js_key: { value: '', group: 'amap', description: '高德地图JS API Key(前端)' },
  amap_security_key: { value: '', group: 'amap', description: '高德地图安全密钥(JS API安全密钥)', isEncrypted: true },

  // 监控配置
  monitor_enabled: { value: 'true', group: 'monitor', description: 'API监控开关' },

  // EXIF默认配置
  default_exif_author: { value: '', group: 'exif', description: '默认作者/摄影师名称，上传时自动填充到EXIF' },
  default_exif_camera: { value: '', group: 'exif', description: '默认相机型号，上传时自动填充到EXIF（如：NIKON Z6II）' },
};

// 需要删除的旧配置键（已废弃的）
const DEPRECATED_KEYS = ['redis_url', 'booking_contact'];

// ==================== 主逻辑 ====================
async function main() {
  console.log('========================================');
  console.log('  光影集 - 配置修复工具');
  console.log('========================================\n');

  // 1. 检查数据库连接
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[错误] .env 中缺少 DATABASE_URL 配置！');
    process.exit(1);
  }
  if (!dbUrl.startsWith('mysql://')) {
    console.error('[错误] DATABASE_URL 必须是 MySQL 格式！');
    process.exit(1);
  }
  console.log('[1/4] 数据库连接:', dbUrl.split('@')[0].replace(/:([^@]+)@/, ':***@'), '@***');

  // 2. 连接数据库
  let PrismaClient;
  try {
    const prismaModule = require('@prisma/client');
    PrismaClient = prismaModule.PrismaClient;
  } catch (e) {
    console.error('[错误] 无法加载 Prisma Client，请先运行: npx prisma generate');
    console.error('  详情:', e.message);
    process.exit(1);
  }

  const db = new PrismaClient({
    log: ['error'],
  });

  try {
    // 测试数据库连接
    console.log('[2/4] 测试数据库连接...');
    await db.$queryRaw`SELECT 1`;
    console.log('  数据库连接成功');

    // 3. 删除废弃的配置键
    console.log('\n[3/4] 清理废弃配置...');
    let deleted = 0;
    for (const key of DEPRECATED_KEYS) {
      try {
        const existing = await db.config.findUnique({ where: { key } });
        if (existing) {
          await db.config.delete({ where: { key } });
          console.log(`  已删除废弃配置: ${key}`);
          deleted++;
        }
      } catch (e) {
        console.log(`  清理 ${key} 时出错: ${e.message}`);
      }
    }
    if (deleted === 0) {
      console.log('  无需清理');
    }

    // 4. 同步默认配置
    console.log('\n[4/4] 同步默认配置项...');
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const [key, config] of Object.entries(CONFIG_DEFAULTS)) {
      try {
        const existing = await db.config.findUnique({ where: { key } });
        if (existing) {
          // 更新 group 和 description（不覆盖用户已设置的 value）
          const needsUpdate =
            existing.group !== config.group ||
            existing.description !== config.description ||
            existing.isEncrypted !== (config.isEncrypted || false);

          if (needsUpdate) {
            await db.config.update({
              where: { key },
              data: {
                group: config.group,
                description: config.description,
                isEncrypted: config.isEncrypted || false,
              },
            });
            updated++;
            const changes = [];
            if (existing.group !== config.group) changes.push(`group: ${existing.group} -> ${config.group}`);
            if (existing.description !== config.description) changes.push('description 已更新');
            if (existing.isEncrypted !== (config.isEncrypted || false)) changes.push('isEncrypted 已更新');
            console.log(`  更新: ${key} (${changes.join(', ')})`);
          } else {
            skipped++;
          }
        } else {
          // 创建新配置
          await db.config.create({
            data: {
              key,
              value: config.value,
              group: config.group,
              description: config.description,
              isEncrypted: config.isEncrypted || false,
            },
          });
          created++;
          console.log(`  创建: ${key} = "${config.value.substring(0, 50)}${config.value.length > 50 ? '...' : ''}" (group: ${config.group})`);
        }
      } catch (e) {
        failed++;
        console.error(`  失败: ${key} - ${e.message}`);
      }
    }

    // 统计
    console.log('\n========================================');
    console.log('  修复结果:');
    console.log(`  新建: ${created} 项`);
    console.log(`  更新: ${updated} 项`);
    console.log(`  跳过: ${skipped} 项 (无需修改)`);
    console.log(`  删除: ${deleted} 项 (废弃配置)`);
    console.log(`  失败: ${failed} 项`);
    console.log(`  总计: ${Object.keys(CONFIG_DEFAULTS).length} 项默认配置`);

    // 验证：按组统计
    const allConfigs = await db.config.findMany();
    const groups = {};
    for (const c of allConfigs) {
      if (!groups[c.group]) groups[c.group] = [];
      groups[c.group].push(c.key);
    }
    console.log('\n  各组配置数量:');
    for (const [group, keys] of Object.entries(groups).sort()) {
      console.log(`    ${group}: ${keys.length} 项`);
    }
    console.log('========================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('\n[错误] 数据库操作失败:', err.message);
    if (err.message.includes('connect')) {
      console.error('\n  可能的原因:');
      console.error('  1. MySQL 服务未启动');
      console.error('  2. DATABASE_URL 配置错误');
      console.error('  3. 数据库用户权限不足');
      console.error('  4. configs 表不存在 (请运行: npx prisma db push)');
    }
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error('脚本执行失败:', e);
  process.exit(1);
});
