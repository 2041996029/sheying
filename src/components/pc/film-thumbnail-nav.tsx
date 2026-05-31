'use client';

import { useRef, useEffect } from 'react';

interface FilmThumbnailNavProps {
  images: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function FilmThumbnailNav({ images, activeIndex, onSelect }: FilmThumbnailNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeEl = container.children[activeIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeIndex]);

  if (images.length <= 1) return null;

  return (
    <div className="relative mt-3">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto py-2 px-1 scrollbar-none"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`shrink-0 relative rounded-md overflow-hidden transition-all duration-200 ${
              i === activeIndex
                ? 'ring-2 ring-primary scale-105 opacity-100'
                : 'opacity-50 hover:opacity-80'
            }`}
            style={{ width: 64, height: 44 }}
          >
            <img src={img} alt={`缩略图 ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
            {/* 胶片齿孔装饰 */}
            <div className="absolute top-0 left-0 right-0 h-1 flex justify-evenly">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="w-1 h-1 rounded-full bg-white/20" />
              ))}
            </div>
          </button>
        ))}
      </div>
      {/* 进度条 + 计数器 */}
      <div className="flex items-center gap-3 mt-1">
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((activeIndex + 1) / images.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {activeIndex + 1} / {images.length}
        </span>
      </div>
    </div>
  );
}
