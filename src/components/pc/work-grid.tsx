'use client';

import { WorkCard, type WorkCardData } from './work-card';
export type { WorkCardData } from './work-card';
import { Skeleton } from '@/components/ui/skeleton';

interface WorkGridProps {
  works: WorkCardData[];
  loading?: boolean;
  skeletonCount?: number;
}

export function WorkGrid({ works, loading, skeletonCount = 8 }: WorkGridProps) {
  const skeletonHeights = [180, 220, 260, 200, 240, 190, 230, 210];

  if (loading) {
    return (
      <div className="masonry-grid">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="masonry-item">
            <div className="rounded-xl overflow-hidden bg-card">
              <Skeleton className="w-full" style={{ height: `${skeletonHeights[i % skeletonHeights.length]}px` }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (works.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-muted-foreground mb-1">暂无作品</h3>
        <p className="text-xs text-muted-foreground">还没有相关的摄影作品</p>
      </div>
    );
  }

  return (
    <div className="masonry-grid">
      {works.map((work) => (
        <WorkCard key={work.id} work={work} />
      ))}
    </div>
  );
}
