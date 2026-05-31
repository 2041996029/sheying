'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Heart, Star, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

export interface WorkCardData {
  id: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  category?: { id: string; name: string } | null;
  tags?: string[];
  likeCount: number;
  favoriteCount: number;
  viewCount: number;
  isFeatured?: boolean;
}

interface WorkCardProps {
  work: WorkCardData;
}

function useHoverCount(target: number, isHovered: boolean, duration = 600) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!isHovered) {
      cancelAnimationFrame(rafRef.current);
      setValue(0);
      doneRef.current = false;
      return;
    }
    if (target === 0 || doneRef.current) {
      setValue(target);
      return;
    }
    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        doneRef.current = true;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isHovered, target, duration]);

  return value;
}

export function WorkCard({ work }: WorkCardProps) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  const animLike = useHoverCount(work.likeCount, hovered);
  const animFav = useHoverCount(work.favoriteCount, hovered);
  const animView = useHoverCount(work.viewCount, hovered);

  return (
    <motion.div
      layout
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="masonry-item"
    >
      <div
        className="group relative rounded-xl overflow-hidden cursor-pointer bg-card shadow-sm hover:shadow-2xl transition-shadow duration-500"
        onClick={() => router.push(`/work/${work.id}`)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/work/${work.id}`); } }}
      >
        {/* Image - 自然比例展示，不做裁剪 */}
        <div className="relative overflow-hidden">
          {work.coverUrl ? (
            <Image
              src={work.coverUrl}
              alt={work.title}
              width={400}
              height={300}
              className="w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              loading="lazy"
              unoptimized
            />
          ) : (
            <div className="w-full h-48 image-loading flex items-center justify-center">
              <span className="text-muted-foreground text-xs">暂无图片</span>
            </div>
          )}

          {/* 悬停渐变蒙层 - 从底部向上渐显 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* 悬停信息浮层 - 从底部上浮渐显 */}
          <div className="absolute inset-x-0 bottom-0 p-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 ease-out">
            {/* 标题 */}
            <h3 className="text-white text-sm font-semibold truncate mb-1.5 drop-shadow-lg">
              {work.title}
            </h3>

            {/* 描述 */}
            {work.description && (
              <p className="text-white/70 text-xs line-clamp-2 mb-2 leading-relaxed">
                {work.description}
              </p>
            )}

            {/* 分类与标签 */}
            <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
              {work.category && (
                <Badge className="bg-white/20 text-white border-white/10 text-[10px] px-1.5 py-0 h-4 backdrop-blur-sm">
                  {work.category.name}
                </Badge>
              )}
              {work.tags && work.tags.length > 0 && (
                <span className="text-white/60 text-[10px]">
                  {work.tags.slice(0, 2).join(' · ')}
                </span>
              )}
            </div>

            {/* 互动数据 */}
            <div className="flex items-center gap-3 text-white/80 text-xs">
              <span className="flex items-center gap-1 hover:text-white transition-colors">
                <Heart className="h-3 w-3" />
                {animLike}
              </span>
              <span className="flex items-center gap-1 hover:text-white transition-colors">
                <Star className="h-3 w-3" />
                {animFav}
              </span>
              <span className="flex items-center gap-1 hover:text-white transition-colors">
                <Eye className="h-3 w-3" />
                {animView}
              </span>
            </div>
          </div>

          {/* 精选徽章 - 始终显示 */}
          {work.isFeatured && (
            <div className="absolute top-3 left-3 z-10">
              <Badge className="bg-primary/90 text-primary-foreground text-[10px] px-2 py-0.5 backdrop-blur-sm shadow-md border-0">
                精选
              </Badge>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
