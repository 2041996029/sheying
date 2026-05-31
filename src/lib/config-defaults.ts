// 配置默认值
export interface ConfigDefault {
  value: string;
  group: string;
  description: string;
  isEncrypted?: boolean;
}

export const CONFIG_DEFAULTS: Record<string, ConfigDefault> = {
  // 站点配置
  site_name: { value: '光影集', group: 'site', description: '站点名称' },
  site_description: { value: '摄影作品展示平台', group: 'site', description: '站点描述' },
  site_logo: { value: '', group: 'site', description: '站点Logo' },
  site_favicon: { value: '', group: 'site', description: '站点Favicon图标URL，留空则使用site_logo' },
  site_keywords: { value: '摄影,作品,展示', group: 'site', description: 'SEO关键词' },
  site_hero_image: { value: '', group: 'site', description: '首页背景图URL，留空则使用精选作品封面' },
  site_hero_title: { value: '光影集', group: 'site', description: '首页主标题' },
  site_hero_subtitle: { value: '发现精美摄影作品，记录光影之美', group: 'site', description: '首页副标题' },
  // 关于页面配置
  about_content: { value: '', group: 'about', description: '关于页面内容(Markdown)' },
  about_eyebrow: { value: '致每一位摄影者', group: 'about', description: '关于页面标签文字' },
  about_title: { value: '致每一位*追光者*', group: 'about', description: '关于页面标题(用*包裹的文字显示为斜体)' },
  about_milestones: { value: '[{"phase":"阶段 01","title":"灵感萌发","desc":"一个关于光影的梦想开始发芽，希望为摄影爱好者搭建专属的展示空间。"},{"phase":"阶段 02","title":"精心打造","desc":"从界面到交互，从功能到体验，每一个细节都反复打磨，追求极致。"},{"phase":"阶段 03","title":"社区成长","desc":"越来越多的摄影师加入，作品库不断丰富，社区氛围日渐浓厚。"},{"phase":"阶段 04","title":"持续进化","desc":"AI 辅助、约拍功能、小程序生态……我们一直在路上，永不停歇。","active":true}]', group: 'about', description: '历程时间线(JSON数组，每项: phase/title/desc/active)' },
  about_features: { value: '[{"icon":"Camera","color":"amber","title":"精选作品","content":"精心策展的摄影作品集，从风光到人像，从街拍到纪实，每一幅作品都经过严格筛选，只为呈现最动人的光影瞬间。","english":"Curated Gallery"},{"icon":"Heart","color":"rose","title":"互动交流","content":"点赞、收藏、评论，与摄影师零距离互动。每一次真诚的反馈，都是对创作者最好的鼓励与支持。","english":"Community Driven"},{"icon":"Globe","color":"emerald","title":"开放平台","content":"多维分类与智能标签体系，支持作品分类浏览与精准检索。约拍功能连接摄影师与需求方，构建开放的创作生态。","english":"Open Ecosystem"}]', group: 'about', description: '特色功能卡片(JSON数组，每项: icon/color/title/content/english)' },

  // 社交配置
  social_wechat: { value: '', group: 'social', description: '微信号' },
  social_qr_wechat: { value: '', group: 'social', description: '微信二维码图片URL' },
  social_qq: { value: '', group: 'social', description: 'QQ号' },
  social_qr_qq: { value: '', group: 'social', description: 'QQ二维码图片URL' },
  social_email: { value: '', group: 'social', description: '邮箱' },

  // 显示配置
  display_dark_mode: { value: 'auto', group: 'display', description: '暗黑模式' },
  display_theme_preset: { value: 'classic', group: 'display', description: '主题预设' },
  display_comment_enabled: { value: 'true', group: 'display', description: '评论开关' },
  display_exif_panel_position: { value: 'right', group: 'display', description: 'EXIF面板位置' },

  // AI配置
  ai_enabled: { value: 'true', group: 'ai', description: 'AI开关' },
  ai_tag_prompt: { value: '请识别这张照片的内容和风格，返回标签', group: 'ai', description: '识别提示词' },
  ai_image_suffix: { value: '', group: 'ai', description: 'AI识别图片链接后缀(如 ?imageMogr2/format/webp/quality/60，仅影响AI识别)' },
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
  cos_storage_mode: { value: 'local', group: 'cos', description: '存储模式' },
  cos_appid: { value: '', group: 'cos', description: '腾讯云COS AppId(Bucket名称中-后面的数字)' },
  cos_bucket: { value: '', group: 'cos', description: '存储桶名称' },
  cos_region: { value: '', group: 'cos', description: '区域(如: ap-guangzhou)' },
  cos_cdn_url: { value: '', group: 'cos', description: 'CDN域名(如: https://cdn.example.com)' },
  cos_secret_id: { value: '', group: 'cos', description: 'COS SecretId', isEncrypted: true },
  cos_secret_key: { value: '', group: 'cos', description: 'COS SecretKey', isEncrypted: true },
  cos_upload_dir: { value: 'works', group: 'cos', description: 'COS上传目录' },

  // 安全配置
  auth_access_token_ttl: { value: '7200', group: 'auth', description: 'access_token有效期(秒)' },
  auth_refresh_token_ttl: { value: '604800', group: 'auth', description: 'refresh_token有效期(秒)' },
  security_rate_limit_ip: { value: '100', group: 'security', description: 'IP限流阈值(次/分钟)' },
  security_rate_limit_user: { value: '60', group: 'security', description: '用户限流阈值(次/分钟)' },
  security_access_control_enabled: { value: 'false', group: 'security', description: '接口访问控制总开关' },
  security_api_keys: { value: '[]', group: 'security', description: '客户端凭证列表(JSON)', isEncrypted: true },
  security_allowed_origins: { value: '[]', group: 'security', description: '域名白名单(JSON数组)' },
  security_skip_public_get: { value: 'true', group: 'security', description: '公开GET接口免验证(开启则SEO友好)' },
  security_skip_auth_paths: { value: 'true', group: 'security', description: '登录注册接口免验证' },
  security_timestamp_tolerance: { value: '300', group: 'security', description: '时间戳容差(秒,默认5分钟)' },
  security_signkey_ttl: { value: '86400', group: 'security', description: '小程序签名密钥有效期(秒,默认24小时)' },

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
  miniprogram_access_token_ttl: { value: '6900', group: 'miniprogram', description: 'access_token缓存有效期(秒)，微信官方有效期7200秒，建议设为6900(提前5分钟刷新)' },
  miniprogram_env_version: { value: 'trial', group: 'miniprogram', description: '小程序码版本' },
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

  // 聚合登录配置
  social_login_enabled: { value: 'false', group: 'social_login', description: '聚合登录开关' },
  social_login_appid: { value: '', group: 'social_login', description: '华年聚合登录AppID' },
  social_login_appkey: { value: '', group: 'social_login', description: '华年聚合登录AppKey', isEncrypted: true },
  social_login_providers: { value: '[]', group: 'social_login', description: '启用的登录方式(JSON数组，如: ["qq","wx"])' },
  social_login_redirect_uri: { value: '', group: 'social_login', description: '登录回调地址(如: https://yoursite.com/auth/callback)' },

  // SEO配置
  seo_site_url: { value: '', group: 'seo', description: '站点URL(如: https://yoursite.com)，用于sitemap、robots.txt和OG标签' },
  seo_og_image: { value: '', group: 'seo', description: '默认分享封面图URL(1200x630)，用于Open Graph和Twitter Card' },
  seo_og_type: { value: 'website', group: 'seo', description: 'Open Graph类型(如: website/blog/article)' },
  seo_twitter_card: { value: 'summary_large_image', group: 'seo', description: 'Twitter Card类型(summary/summary_large_image)' },
  seo_robots_extra: { value: '', group: 'seo', description: 'robots.txt额外规则(每行一条，如: Disallow: /private/)' },
};

// 获取公开配置的group列表
export const PUBLIC_CONFIG_GROUPS = ['site', 'social', 'display', 'booking', 'about', 'amap', 'social_login', 'seo'];
