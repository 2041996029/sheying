'use client';

import {
  Camera, Heart, Globe, Mail, MessageSquare, User, Sparkles, Quote, Clock, Eye,
  Image, Star, Bookmark, Compass, Layers, Palette, Zap, Sun, Moon, Aperture,
  type LucideIcon,
} from 'lucide-react';
import { Header } from '@/components/pc/header';
import { Footer } from '@/components/pc/footer';
import { MarkdownContent } from '@/components/pc/markdown-content';
import { ContactQRDialog } from '@/components/pc/contact-qr-dialog';
import { CreativeTimeline } from '@/components/pc/creative-timeline';
import { useConfigStore } from '@/stores/config-store';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface SiteStats {
  workCount: number;
  categoryCount: number;
  totalViews: number;
  totalLikes: number;
}

interface Milestone {
  phase: string;
  title: string;
  desc: string;
  active?: boolean;
}

const DEFAULT_MILESTONES: Milestone[] = [
  { phase: 'PHASE 01', title: '灵感萌发', desc: '一个关于光影的梦想开始发芽，希望为摄影爱好者搭建专属的展示空间。' },
  { phase: 'PHASE 02', title: '精心打造', desc: '从界面到交互，从功能到体验，每一个细节都反复打磨，追求极致。' },
  { phase: 'PHASE 03', title: '社区成长', desc: '越来越多的摄影师加入，作品库不断丰富，社区氛围日渐浓厚。' },
  { phase: 'PHASE 04', title: '持续进化', desc: 'AI 辅助、约拍功能、小程序生态……我们一直在路上，永不停歇。', active: true },
];

function parseMilestones(json?: string): Milestone[] {
  if (!json) return DEFAULT_MILESTONES;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_MILESTONES;
  } catch {
    return DEFAULT_MILESTONES;
  }
}

/**
 * 解析标题中 *包裹* 的部分为斜体
 * e.g. "致每一位*追光者*" → ["致每一位", { text: "追光者", italic: true }]
 */
function parseTitle(title: string): { text: string; italic?: boolean }[] {
  const parts: { text: string; italic?: boolean }[] = [];
  const regex = /([^*]*)\*([^*]+)\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(title)) !== null) {
    if (match[1]) {
      parts.push({ text: match[1] });
    }
    parts.push({ text: match[2], italic: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < title.length) {
    parts.push({ text: title.slice(lastIndex) });
  }

  // 如果没有 * 包裹的内容，返回整个文本
  if (parts.length === 0) {
    parts.push({ text: title });
  }

  return parts;
}

export default function AboutPage() {
  const { configs } = useConfigStore();
  // fetchConfigs 已在 Header/ThemeInit 中统一调用，此处无需重复调用
  const [stats, setStats] = useState<SiteStats>({ workCount: 0, categoryCount: 0, totalViews: 0, totalLikes: 0 });
  const [mounted, setMounted] = useState(false);
  const [qrDialog, setQrDialog] = useState<{ open: boolean; type: 'wechat' | 'qq' }>({ open: false, type: 'wechat' });

  useEffect(() => {
    setMounted(true);
    apiClient.get<{ workCount: number; categoryCount: number; totalViews: number; totalLikes: number }>('/stats/public')
      .then(res => {
        if (res.code === 0 && res.data) {
          setStats(res.data);
        }
      })
      .catch(() => {});

  }, []);

  const siteName = configs.site_name || '光影集';
  const siteDescription = configs.site_description || '发现精美摄影作品，记录光影之美。专业的摄影作品展示与管理平台。';
  const siteHeroTitle = configs.site_hero_title || '光影集';
  const siteHeroSubtitle = configs.site_hero_subtitle || '发现精美摄影作品，记录光影之美';
  const socialEmail = configs.social_email;
  const socialWechat = configs.social_wechat;
  const socialQq = configs.social_qq;
  const socialQrWechat = configs.social_qr_wechat;
  const socialQrQq = configs.social_qr_qq;

  // 关于页面可自定义配置
  const aboutEyebrow = configs.about_eyebrow || 'TO: EVERY PHOTOGRAPHER';
  const aboutTitleRaw = configs.about_title || '致每一位*追光者*';
  const aboutTitleParts = parseTitle(aboutTitleRaw);
  const aboutContent = configs.about_content;
  const milestones = parseMilestones(configs.about_milestones);

  // 特色功能卡片配置
  const defaultFeatures = [
    { icon: 'Camera', color: 'amber', title: '精选作品', content: '精心策展的摄影作品集，从风光到人像，从街拍到纪实，每一幅作品都经过严格筛选，只为呈现最动人的光影瞬间。', english: 'Curated Gallery' },
    { icon: 'Heart', color: 'rose', title: '互动交流', content: '点赞、收藏、评论，与摄影师零距离互动。每一次真诚的反馈，都是对创作者最好的鼓励与支持。', english: 'Community Driven' },
    { icon: 'Globe', color: 'emerald', title: '开放平台', content: '多维分类与智能标签体系，支持作品分类浏览与精准检索。约拍功能连接摄影师与需求方，构建开放的创作生态。', english: 'Open Ecosystem' },
  ];
  const aboutFeatures: typeof defaultFeatures = (() => {
    try {
      const raw = configs.about_features;
      if (!raw) return defaultFeatures;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return defaultFeatures;
      return parsed;
    } catch { return defaultFeatures; }
  })();

  // 图标映射表（按需导入，避免全量打包）
  const iconMap: Record<string, LucideIcon> = {
    Camera, Heart, Globe, Mail, MessageSquare, User, Sparkles, Quote, Clock, Eye,
    Image, Star, Bookmark, Compass, Layers, Palette, Zap, Sun, Moon, Aperture,
  };

  function getIcon(iconName: string, fallback: LucideIcon): LucideIcon {
    return iconMap[iconName] || fallback;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-20">
        {/* ===== Hero Section ===== */}
        <section className="relative py-16 md:py-24 px-4 md:px-6 overflow-hidden">
          {/* 背景装饰光晕 */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />


          <div className="max-w-6xl mx-auto relative z-10">
            {/* 标题区 */}
            <div className="text-center mb-12 md:mb-16">
              <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-border/50 bg-background/50 backdrop-blur-sm mb-6 md:mb-8">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/90 animate-pulse" />
                <span className="text-[10px] font-mono text-muted-foreground tracking-[0.25em] uppercase">About Us</span>
                <span className="w-px h-3 bg-border/50 hidden sm:inline-block" />
                <span className="text-[11px] font-medium text-muted-foreground/70 hidden sm:inline">关于我们</span>
              </div>

              <h2 className="font-bold leading-[1.1] tracking-tight mb-5 md:mb-6">
                <span className="block text-2xl sm:text-3xl md:text-5xl font-light text-muted-foreground mb-2 md:mb-3">用镜头书写</span>
                <span className="block text-4xl sm:text-5xl md:text-7xl text-foreground">{siteHeroTitle}</span>
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light">
                {siteHeroSubtitle}
              </p>
            </div>

            {/* ===== Bento Grid ===== */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">

              {/* 1. 主卡片 — 理念/故事 (占满一行) */}
              <div className="md:col-span-12 relative group rounded-2xl md:rounded-3xl overflow-hidden border border-border/30 transition-colors duration-300 hover:border-border/60 min-h-[320px]">
                {/* 背景网格 */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(120,120,120,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,120,120,0.06)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
                {/* 顶部高光线 */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

                <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row justify-between gap-8 h-full">
                  <div className="space-y-8 max-w-3xl flex flex-col justify-center">
                    {/* 顶部元数据 — 后台可自定义 */}
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary">
                        <Quote className="w-3.5 h-3.5" />
                      </span>
                      <div className="px-3 py-1 rounded-full border border-border/30 bg-background/50 text-xs font-mono text-muted-foreground tracking-wide">
                        {aboutEyebrow}
                      </div>
                    </div>

                    {/* 内容区 — 标题后台可自定义 */}
                    <div>
                      <h2 className="text-3xl md:text-4xl font-serif text-foreground leading-[0.95] mb-8">
                        {aboutTitleParts.map((part, i) =>
                          part.italic ? (
                            <span key={i} className="italic text-muted-foreground">{part.text}</span>
                          ) : (
                            <span key={i}>{part.text}</span>
                          )
                        )}
                      </h2>

                      {aboutContent ? (
                        <div className="text-muted-foreground text-base md:text-lg font-light tracking-wide leading-relaxed prose-headings:text-foreground">
                          <MarkdownContent content={aboutContent} />
                        </div>
                      ) : (
                        <div className="space-y-5">
                          <p className="text-muted-foreground text-base md:text-lg font-light tracking-wide leading-relaxed">
                            &ldquo; 每一帧画面，都是时间赠予的礼物。我们相信，光影之间藏着最真实的故事。
                          </p>
                          <p className="text-muted-foreground text-base md:text-lg font-light tracking-wide leading-relaxed">
                            <span className="text-foreground">{siteName}</span> 不只是一个展示平台，更是一座连接摄影师与世界的桥梁。
                            <br className="hidden md:block" />
                            在这里，每一次快门都被珍视，每一束光都值得被铭记。
                          </p>
                          <p className="text-muted-foreground text-base md:text-lg font-light tracking-wide leading-relaxed">
                            愿这片光影的集所，成为你灵感涌动的起点，也成为你作品安放的家。 &rdquo;
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 右侧装饰 */}
                  <div className="hidden md:flex flex-col justify-between items-end py-2 opacity-30 group-hover:opacity-50 transition-opacity">
                    <Camera className="w-24 h-24 text-muted-foreground/30 rotate-12" />
                    <div className="text-right space-y-1">
                      <div className="w-20 h-1 bg-muted-foreground/20 rounded-full ml-auto" />
                      <div className="w-12 h-1 bg-muted-foreground/20 rounded-full ml-auto" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. 统计卡片 (左侧，7列) */}
              <div className="md:col-span-7 bg-background/50 relative group rounded-2xl md:rounded-3xl overflow-hidden border border-border/30 transition-all duration-300 hover:border-border/60 p-6 md:p-7">
                {/* 顶部扫描光带 */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* 顶部：图标 + 状态 */}
                <div className="relative z-10 flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                        </span>
                        <span className="text-[9px] font-mono text-primary/80 tracking-[0.2em] uppercase">Live</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">数据实时更新</span>
                    </div>
                  </div>
                </div>

                {/* 标题 */}
                <h3 className="text-xl font-serif text-foreground group-hover:translate-x-1 transition-transform duration-300 mb-5">
                  平台数据 <span className="text-muted-foreground font-sans font-light text-base">· 实时统计</span>
                </h3>

                {/* 统计数字 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-background/80 border border-border/20 text-center">
                    <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">{mounted ? stats.workCount : '—'}</div>
                    <div className="text-[10px] text-muted-foreground font-mono tracking-wider uppercase">作品</div>
                  </div>
                  <div className="p-4 rounded-xl bg-background/80 border border-border/20 text-center">
                    <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">{mounted ? stats.categoryCount : '—'}</div>
                    <div className="text-[10px] text-muted-foreground font-mono tracking-wider uppercase">分类</div>
                  </div>
                  <div className="p-4 rounded-xl bg-background/80 border border-border/20 text-center">
                    <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">{mounted ? (stats.totalViews > 9999 ? `${(stats.totalViews / 10000).toFixed(1)}w` : stats.totalViews) : '—'}</div>
                    <div className="text-[10px] text-muted-foreground font-mono tracking-wider uppercase">浏览</div>
                  </div>
                  <div className="p-4 rounded-xl bg-background/80 border border-border/20 text-center">
                    <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">{mounted ? (stats.totalLikes > 9999 ? `${(stats.totalLikes / 10000).toFixed(1)}w` : stats.totalLikes) : '—'}</div>
                    <div className="text-[10px] text-muted-foreground font-mono tracking-wider uppercase">喜欢</div>
                  </div>
                </div>
              </div>

              {/* 3. 联系信息卡片 (右侧，5列) */}
              <div className="md:col-span-5 bg-background/50 relative group rounded-2xl md:rounded-3xl overflow-hidden border border-border/30 transition-all duration-300 hover:bg-background/80 hover:border-border/60 p-6 md:p-7 flex flex-col justify-between">
                {/* 顶部状态栏 */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Online</span>
                  </div>
                  <User className="w-5 h-5 text-muted-foreground/40" />
                </div>

                {/* 核心信息 */}
                <div className="mt-auto">
                  <div className="flex items-center gap-4 mb-6">
                    {/* 头像 */}
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-border flex items-center justify-center overflow-hidden">
                        <Camera className="w-6 h-6 text-primary" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-background p-0.5 rounded-full">
                        <div className="bg-primary text-primary-foreground p-0.5 rounded-full">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5"><path d="M20 6 9 17l-5-5" /></svg>
                        </div>
                      </div>
                    </div>

                    {/* 文字信息 */}
                    <div>
                      <div className="text-foreground font-bold text-2xl leading-tight tracking-wide font-serif">
                        {siteName}
                      </div>
                      <div className="text-muted-foreground text-[11px] font-mono mt-0.5">Photography Platform</div>
                    </div>
                  </div>

                  {/* 联系按钮组 */}
                  <div className={`grid gap-2 ${socialEmail && (socialWechat || socialQq) ? 'grid-cols-3' : socialEmail ? 'grid-cols-1' : socialWechat && socialQq ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {socialEmail && (
                      <a
                        href={`mailto:${socialEmail}`}
                        className="relative py-3 bg-background/80 hover:bg-primary/10 border border-border/30 hover:border-primary/30 text-muted-foreground hover:text-primary text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 group/mail"
                      >
                        <Mail className="w-4 h-4 opacity-60 group-hover/mail:opacity-100 group-hover/mail:scale-110 transition-all" />
                        <span>Email</span>
                      </a>
                    )}
                    {socialWechat && (
                      <button
                        type="button"
                        className="relative py-3 bg-background/80 hover:bg-primary/10 border border-border/30 hover:border-primary/30 text-muted-foreground hover:text-primary text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 group/wx"
                        onClick={() => setQrDialog({ open: true, type: 'wechat' })}
                      >
                        <MessageSquare className="w-4 h-4 opacity-60 group-hover/wx:opacity-100 group-hover/wx:scale-110 transition-all" />
                        <span>WeChat</span>
                      </button>
                    )}
                    {socialQq && (
                      <button
                        type="button"
                        className="relative py-3 bg-background/80 hover:bg-primary/10 border border-border/30 hover:border-primary/30 text-muted-foreground hover:text-primary text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 group/qq"
                        onClick={() => setQrDialog({ open: true, type: 'qq' })}
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 opacity-60 group-hover/qq:opacity-100 group-hover/qq:scale-110 transition-all" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 13.24c-.18.53-.5.98-.93 1.33.16.2.26.45.26.73 0 .35-.16.66-.41.87.05.12.08.25.08.39 0 .45-.29.83-.69.97.02.09.03.18.03.28 0 .6-.42 1.1-.98 1.24-.18.63-.76 1.09-1.45 1.09-.37 0-.71-.13-.98-.36-.27.23-.61.36-.98.36-.69 0-1.27-.46-1.45-1.09-.56-.14-.98-.64-.98-1.24 0-.1.01-.19.03-.28-.4-.14-.69-.52-.69-.97 0-.14.03-.27.08-.39-.25-.21-.41-.52-.41-.87 0-.28.1-.53.26-.73-.43-.35-.75-.8-.93-1.33C5.75 14.63 5 12.93 5 11c0-3.87 3.13-7 7-7s7 3.13 7 7c0 1.93-.75 3.63-2.36 4.24z"/>
                        </svg>
                        <span>QQ</span>
                      </button>
                    )}
                    {!socialEmail && !socialWechat && !socialQq && (
                      <div className="col-span-3 py-4 text-center text-sm text-muted-foreground">
                        暂未设置联系方式
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. 特色功能卡片 ×3 (占满一行) - 后台可自定义 */}
              {aboutFeatures.map((feature, idx) => {
                const FeatureIcon = getIcon(feature.icon, Camera);
                const colorClass = feature.color || 'amber';
                const colorMap: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
                  amber: { bg: 'bg-amber/15', border: 'border-amber/20', text: 'text-amber', gradient: 'from-transparent via-amber/30 to-transparent' },
                  rose: { bg: 'bg-destructive/15', border: 'border-destructive/20', text: 'text-destructive', gradient: 'from-transparent via-destructive/30 to-transparent' },
                  emerald: { bg: 'bg-chart-2/15', border: 'border-chart-2/20', text: 'text-chart-2', gradient: 'from-transparent via-chart-2/30 to-transparent' },
                  blue: { bg: 'bg-chart-4/15', border: 'border-chart-4/20', text: 'text-chart-4', gradient: 'from-transparent via-chart-4/30 to-transparent' },
                  violet: { bg: 'bg-chart-3/15', border: 'border-chart-3/20', text: 'text-chart-3', gradient: 'from-transparent via-chart-3/30 to-transparent' },
                  orange: { bg: 'bg-warm/15', border: 'border-warm/20', text: 'text-warm', gradient: 'from-transparent via-warm/30 to-transparent' },
                  cyan: { bg: 'bg-chart-5/15', border: 'border-chart-5/20', text: 'text-chart-5', gradient: 'from-transparent via-chart-5/30 to-transparent' },
                  pink: { bg: 'bg-primary/15', border: 'border-primary/20', text: 'text-primary', gradient: 'from-transparent via-primary/30 to-transparent' },
                };
                const colors = colorMap[colorClass] || colorMap.amber;
                return (
                  <div key={idx} className="md:col-span-4 relative group rounded-2xl md:rounded-3xl overflow-hidden border border-border/30 transition-all duration-300 hover:border-border/60 p-6 md:p-7 bg-background/50">
                    <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r ${colors.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                    <div className={`w-12 h-12 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center mb-5`}>
                      <FeatureIcon className={`w-5 h-5 ${colors.text}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.content}
                    </p>
                    <div className={`mt-4 flex items-center gap-1.5 text-xs ${colors.text}/80 font-mono`}>
                      <FeatureIcon className="w-3 h-3" />
                      <span>{feature.english}</span>
                    </div>
                  </div>
                );
              })}

              {/* 5. 创作时间轴 — 后台可自定义 (占满一行) */}
              <div className="md:col-span-12 relative group rounded-2xl md:rounded-3xl overflow-hidden border border-border/30 transition-all duration-300 hover:border-border/60 p-8 md:p-10 bg-background/50">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">我们的历程</h3>
                    <p className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">Milestones</p>
                  </div>
                </div>

                <CreativeTimeline
                  items={milestones.map((ms) => ({
                    date: ms.phase,
                    title: ms.title,
                    description: ms.desc,
                    icon: ms.active ? '🚀' : '📷',
                  }))}
                />
              </div>

            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* QR Code 弹窗 */}
      <ContactQRDialog
        open={qrDialog.open}
        onOpenChange={(open) => setQrDialog({ ...qrDialog, open })}
        type={qrDialog.type}
        id={qrDialog.type === 'wechat' ? (socialWechat || '') : (socialQq || '')}
        qrUrl={qrDialog.type === 'wechat' ? socialQrWechat : socialQrQq}
      />
    </div>
  );
}
