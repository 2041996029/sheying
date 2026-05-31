'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/pc/header';
import { Clock, Camera, Loader2, Map, X } from 'lucide-react';

const FootprintMap = dynamic(() => import('@/components/pc/footprint-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-muted flex items-center justify-center">
      <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
    </div>
  ),
});

const FootprintTimeline = dynamic(() => import('@/components/pc/footprint-timeline'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
    </div>
  ),
});

interface FootprintItem {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  latitude: number;
  longitude: number;
  location: string | null;
  takenAt: string | null;
  createdAt: string;
  sortTime: string; // 用于排序的实际时间（takenAt 优先，否则 createdAt）
  category: { id: string; name: string } | null;
}

type ViewMode = 'map' | 'timeline';

export default function MapPage() {
  const [footprints, setFootprints] = useState<FootprintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  useEffect(() => {
    fetch('/api/v1/footprint')
      .then((res) => res.json())
      .then((json) => {
        if (json.code === 0 && json.data) {
          setFootprints(json.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 pt-20">
        {/* 视图切换栏 */}
        <div className="flex justify-center py-3">
          <div className="flex items-center bg-muted/50 rounded-xl p-1 border border-border/30">
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'timeline'
                  ? 'bg-background text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>时间轴</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'map'
                  ? 'bg-background text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Map className="w-4 h-4" />
              <span>地图</span>
            </button>
          </div>
        </div>

        {/* 内容区 */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
          </div>
        ) : footprints.length > 0 ? (
          <>
            {/* 时间轴视图 */}
            {viewMode === 'timeline' && <FootprintTimeline footprints={footprints} />}

            {/* 地图视图 - 全屏（仅保留导航栏） */}
            {viewMode === 'map' && (
              <div className="relative z-0 h-[calc(100vh-5rem-3.5rem)] mx-3 md:mx-6 mb-3 md:mb-6 rounded-2xl overflow-hidden shadow-lg shadow-black/5 border border-border/30">
                <FootprintMap footprints={footprints} />
                {/* 主题色叠加层 - 用真实主题背景色染地图 */}
                <div className="absolute inset-0 pointer-events-none z-[1] map-theme-tint" />
                {/* 边缘渐变遮罩 - 让地图自然融入背景 */}
                <div className="absolute inset-0 pointer-events-none z-[2] map-vignette" />
                {/* 右上角收起按钮 */}
                <button
                  onClick={() => setViewMode('timeline')}
                  className="absolute top-4 right-4 z-[3] flex items-center gap-2 bg-background/90 backdrop-blur-md border border-border/50 rounded-xl px-4 py-2.5 shadow-lg hover:bg-background hover:border-primary/30 transition-all"
                >
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">返回时光轴</span>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="container mx-auto px-4 py-32 flex flex-col items-center">
            <Camera className="w-20 h-20 text-muted-foreground/20 mb-6" />
            <p className="text-xl text-muted-foreground mb-2">暂无足迹数据</p>
            <p className="text-sm text-muted-foreground/60">
              上传带有 GPS 信息的照片后，足迹将自动点亮
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
