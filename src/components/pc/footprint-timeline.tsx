'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin, Calendar, Camera } from 'lucide-react';
import { wgs84ToGcj02 } from '@/lib/coord-transform';

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

interface FootprintTimelineProps {
  footprints: FootprintItem[];
}

// 按年月分组（使用 sortTime：takenAt 优先，无则用 createdAt）
function groupByMonth(items: FootprintItem[]) {
  const groups: { year: number; month: number; label: string; items: FootprintItem[] }[] = [];

  for (const item of items) {
    const date = new Date(item.sortTime);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    let group = groups.find((g) => g.year === year && g.month === month);
    if (!group) {
      group = { year, month, label: `${year}年${month}月`, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  return groups;
}

// 格式化日期
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function FootprintTimeline({ footprints }: FootprintTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const groups = groupByMonth(footprints);

  return (
    <div className="relative px-4 md:px-8 py-8 max-w-4xl mx-auto">
      {/* 时间轴主线 - 始终居中 */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent -translate-x-px" />

      {groups.map((group, groupIdx) => (
        <div key={`${group.year}-${group.month}`} className="relative mb-12">
          {/* 年月节点 - 始终居中 */}
          <div className="relative flex items-center mb-8 justify-center">
            <div className="relative z-10 flex items-center gap-2 md:gap-3 bg-background/90 backdrop-blur-sm px-3 md:px-5 py-2 md:py-2.5 rounded-full border border-primary/20 shadow-sm">
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-primary ring-3 md:ring-4 ring-primary/10" />
              <span className="text-base md:text-lg font-bold text-foreground tracking-wide">{group.label}</span>
              <span className="text-[10px] md:text-xs text-muted-foreground bg-muted rounded-full px-1.5 md:px-2 py-0.5">
                {group.items.length}张
              </span>
            </div>
          </div>

          {/* 该月下的作品卡片 - 始终交替左右 */}
          {group.items.map((fp, idx) => {
            const isLeft = idx % 2 === 0;
            const isExpanded = expandedId === fp.id;
            const [gcjLat, gcjLng] = wgs84ToGcj02(fp.latitude, fp.longitude);
            const mapUrl = `https://uri.amap.com/marker?position=${gcjLng},${gcjLat}&name=${encodeURIComponent(fp.title)}`;

            return (
              <div
                key={fp.id}
                className={`relative mb-6 flex items-start ${
                  isLeft ? 'flex-row' : 'flex-row-reverse'
                }`}
              >
                {/* 时间轴圆点 - 始终居中 */}
                <div className="absolute left-1/2 w-3.5 h-3.5 md:w-4 md:h-4 -translate-x-1/2 mt-6 z-10">
                  <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-background border-[3px] border-primary/60 shadow-sm" />
                </div>

                {/* 卡片内容 - 交替左右 */}
                <div
                  className={`w-[calc(50%-0.75rem)] md:w-[calc(50%-2rem)] ${
                    isLeft ? 'pr-3 md:pr-8 mr-auto' : 'pl-3 md:pl-8 ml-auto'
                  }`}
                >
                  <Link href={`/work/${fp.id}`} className="block group">
                    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 group-hover:-translate-y-0.5">
                      {/* 封面图 */}
                      {fp.coverUrl && (
                        <div className="relative h-36 md:h-56 overflow-hidden">
                          <img
                            src={fp.coverUrl}
                            alt={fp.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {/* 底部渐变遮罩 */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                          {/* 日期标签 */}
                          <div className="absolute bottom-2 md:bottom-3 left-2 md:left-3 flex items-center gap-1 md:gap-1.5 bg-black/40 backdrop-blur-md text-white text-[10px] md:text-xs rounded-full px-2 md:px-2.5 py-0.5 md:py-1">
                            <Calendar className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            <span>{fp.takenAt ? formatDate(fp.takenAt) : formatDate(fp.createdAt)}</span>
                          </div>
                          {/* 分类标签 */}
                          {fp.category && (
                            <div className="absolute top-2 md:top-3 right-2 md:right-3 bg-primary/80 backdrop-blur-md text-primary-foreground text-[10px] md:text-xs rounded-full px-2 md:px-2.5 py-0.5 md:py-1">
                              {fp.category.name}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 文字信息 */}
                      <div className="p-2.5 md:p-4">
                        <h3 className="font-semibold text-foreground text-xs md:text-base mb-1 md:mb-2 group-hover:text-primary transition-colors line-clamp-1">
                          {fp.title}
                        </h3>

                        {/* 地点信息 */}
                        <div className="flex items-center gap-1 md:gap-1.5 text-muted-foreground">
                          <MapPin className="w-3 h-3 md:w-3.5 md:h-3.5 text-primary/70 shrink-0" />
                          <span className="text-[11px] md:text-sm truncate">
                            {fp.location || `${fp.latitude.toFixed(2)}°N, ${fp.longitude.toFixed(2)}°E`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* 展开的迷你地图 */}
                  {isExpanded && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-border/30 shadow-sm">
                      <iframe
                        src={mapUrl}
                        className="w-full h-32 md:h-40 border-0"
                        title={`${fp.title} 地图`}
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* 查看地图按钮 */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setExpandedId(isExpanded ? null : fp.id);
                    }}
                    className="mt-1.5 md:mt-2 text-[10px] md:text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                  >
                    <MapPin className="w-2.5 h-2.5 md:w-3 md:h-3" />
                    <span>{isExpanded ? '收起地图' : '查看地图'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* 时间轴结束标记 */}
      <div className="relative flex items-center justify-center py-4">
        <div className="relative z-10 flex items-center gap-2 text-muted-foreground/50">
          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
          <span className="text-xs">时光的起点</span>
          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
        </div>
      </div>
    </div>
  );
}
