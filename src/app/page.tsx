'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Camera, Heart, Star, Eye, ChevronRight, Sparkles } from 'lucide-react';
import { Header } from '@/components/pc/header';
import { Footer } from '@/components/pc/footer';
import { WorkCard } from '@/components/pc/work-card';
import { CategoryFilter } from '@/components/pc/category-filter';
import { Hitokoto } from '@/components/pc/hitokoto';
import { ScrollReveal } from '@/components/pc/scroll-reveal';
import { AnimatedApertureIcon } from '@/components/pc/animated-aperture-icon';
import { ScrollIndicator } from '@/components/pc/scroll-indicator';
import { DualCTAButtons } from '@/components/pc/dual-cta-buttons';
import { GlassStatCard } from '@/components/pc/glass-stat-card';
import { apiClient } from '@/lib/api-client';
import { useConfigStore } from '@/stores/config-store';

interface Work {
  id: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  images?: string;
  categoryId?: string;
  tags?: string[];
  isFeatured?: boolean;
  likeCount: number;
  favoriteCount: number;
  viewCount: number;
  commentCount: number;
  category?: { id: string; name: string } | null;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  workCount?: number;
}

export default function HomePage() {
  const router = useRouter();
  const { configs, fetchConfigs } = useConfigStore();
  const [featuredWorks, setFeaturedWorks] = useState<Work[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // 全站统计
  const [siteStats, setSiteStats] = useState({ workCount: 0, totalViews: 0, totalLikes: 0, totalFavorites: 0 });

  // 加载配置
  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // 加载全站统计、精选作品、分类 — 并行请求
  useEffect(() => {
    let cancelled = false;

    apiClient.get<{ workCount: number; totalViews: number; totalLikes: number; totalFavorites: number }>('/stats/public')
      .then(res => {
        if (!cancelled && res.code === 0 && res.data) {
          setSiteStats(res.data);
        }
      })
      .catch(() => {});

    apiClient.get<Work[]>('/works/featured')
      .then(res => {
        if (!cancelled && res.code === 0 && res.data) {
          setFeaturedWorks(Array.isArray(res.data) ? res.data.slice(0, 6) : []);
        }
      })
      .catch(() => {});

    apiClient.get<Category[]>('/categories')
      .then(res => {
        if (!cancelled && res.code === 0 && res.data) {
          setCategories(res.data);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  // 加载作品列表
  const loadWorks = useCallback(async (pageNum: number, categoryId: string | null, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), page_size: '20', sort: 'latest' });
      if (categoryId) params.set('category_id', categoryId);
      const res = await apiClient.get<{ list: Work[]; total: number }>(`/works?${params}`);
      if (res.code === 0 && res.data) {
        const newWorks = res.data.list || [];
        if (append) {
          setWorks(prev => [...prev, ...newWorks]);
        } else {
          setWorks(newWorks);
        }
        setTotal(res.data.total || 0);
      }
    } catch {
      // handle error
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    loadWorks(1, selectedCategory);
  }, [selectedCategory, loadWorks]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadWorks(nextPage, selectedCategory, true);
  };

  const hasMore = works.length < total;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative h-[70vh] min-h-[500px] overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={configs.site_hero_image || featuredWorks[0]?.coverUrl || 'https://picsum.photos/seed/hero-photo/1920/1080'}
            alt="Hero"
            fill
            className="object-cover"
            priority
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-background" />
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="glass-strong rounded-3xl px-8 py-10 md:px-16 md:py-14 max-w-2xl"
          >
            <div className="flex flex-col items-center gap-4 mb-4">
              <AnimatedApertureIcon />
              <h1 className="text-4xl md:text-6xl font-serif font-bold text-foreground tracking-tight">
                {configs.site_hero_title || configs.site_name || '光影集'}
              </h1>
            </div>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 font-serif font-light tracking-wide">
              {configs.site_hero_subtitle || configs.site_description || '发现精美摄影作品，记录光影之美'}
            </p>
            <DualCTAButtons />
          </motion.div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <ScrollIndicator />
          </div>
        </div>
      </section>

      {/* Stats */}
      <ScrollReveal>
        <section className="py-8">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6 max-w-3xl mx-auto">
              <GlassStatCard
                icon={<Camera className="w-5 h-5 text-primary" />}
                value={siteStats.workCount}
                label="作品"
                delay={0}
              />
              <GlassStatCard
                icon={<Eye className="w-5 h-5 text-primary" />}
                value={siteStats.totalViews}
                label="浏览"
                delay={0.1}
              />
              <GlassStatCard
                icon={<Heart className="w-5 h-5 text-primary" />}
                value={siteStats.totalLikes}
                label="点赞"
                delay={0.2}
              />
              <GlassStatCard
                icon={<Star className="w-5 h-5 text-primary" />}
                value={siteStats.totalFavorites}
                label="收藏"
                delay={0.3}
              />
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* 随机一言 */}
      <Hitokoto />

      {/* Featured Works */}
      <section className="py-16 min-h-[400px]">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-primary" />
                精选作品
              </h2>
            {featuredWorks.length > 0 && (
              <button
                onClick={() => document.getElementById('works-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
              >
                  查看更多 <ChevronRight className="w-4 h-4" />
                </button>
            )}
            </div>
          </ScrollReveal>
          {featuredWorks.length > 0 ? (
            <ScrollReveal delay={0.1}>
              <div className="masonry-grid">
                {featuredWorks.map((work) => (
                  <WorkCard key={work.id} work={work} />
                ))}
              </div>
            </ScrollReveal>
          ) : (
            <div className="masonry-grid">
              {Array.from({ length: 6 }).map((_, i) => {
                const heights = [220, 260, 200, 240, 190, 230];
                return (
                  <div key={i} className="masonry-item">
                    <div className="rounded-xl overflow-hidden">
                      <div className="image-loading w-full" style={{ height: `${heights[i % heights.length]}px` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Works Section */}
      <section id="works-section" className="py-16 bg-muted/30 min-h-[600px]">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground mb-8">
              全部作品
            </h2>
          </ScrollReveal>
          <CategoryFilter
            categories={categories}
            selectedId={selectedCategory}
            onSelect={setSelectedCategory}
          />

          {loading ? (
            <div className="masonry-grid mt-8">
              {Array.from({ length: 8 }).map((_, i) => {
                const heights = [180, 220, 260, 200, 240, 190, 230, 210];
                return (
                  <div key={i} className="masonry-item">
                    <div className="rounded-xl overflow-hidden">
                      <div className="image-loading w-full" style={{ height: `${heights[i % heights.length]}px` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : works.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Camera className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <p className="text-lg text-muted-foreground">暂无作品</p>
              <p className="text-sm text-muted-foreground/60 mt-1">请稍后再来查看</p>
            </div>
          ) : (
            <div className="masonry-grid mt-8">
              {works.map((work) => (
                <WorkCard key={work.id} work={work} />
              ))}
            </div>
          )}

          {hasMore && !loading && (
            <div className="flex justify-center mt-10">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-8 py-3 rounded-full glass font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-all disabled:opacity-50"
              >
                {loadingMore ? '加载中...' : '加载更多'}
              </button>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
