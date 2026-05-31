'use client';

import { ScrollReveal } from '@/components/pc/scroll-reveal';

interface TimelineItem {
  date: string;
  title: string;
  description: string;
  icon?: string;
}

interface CreativeTimelineProps {
  items: TimelineItem[];
}

export function CreativeTimeline({ items }: CreativeTimelineProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="relative">
      {/* 水平时间轴线 — 桌面端显示 */}
      <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-border -translate-y-px" />

      {/* 移动端：垂直时间轴 */}
      <div className="md:hidden relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-6">
          {items.map((item, index) => (
            <ScrollReveal key={index} direction="left" delay={index * 0.08}>
              <div className="relative flex items-start gap-4 pl-10">
                <div className="absolute left-4 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background z-10 mt-1.5 shadow-sm" />
                <div className="flex-1 glass-subtle rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {item.icon && <span className="text-base">{item.icon}</span>}
                    <span className="text-[10px] font-mono text-primary tracking-wider uppercase font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                      {item.date}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground mb-1">{item.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>

      {/* 桌面端：水平时间线 + 上下交错 */}
      <div className="hidden md:flex md:justify-between md:gap-6">
        {items.map((item, index) => {
          const isTop = index % 2 === 0;

          const card = (
            <div className="group glass-subtle rounded-xl px-4 py-3 hover:shadow-md transition-all duration-300 w-full">
              <div className="flex items-center gap-2 mb-1.5">
                {item.icon && (
                  <span className="text-sm opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all">
                    {item.icon}
                  </span>
                )}
                <span className="text-[10px] font-mono text-primary tracking-wider uppercase font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                  {item.date}
                </span>
              </div>
              <h4 className="text-sm font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                {item.title}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          );

          const dot = (
            <div className={`w-4 h-4 rounded-full border-3 z-10 shrink-0 ${
              index === items.length - 1
                ? 'bg-primary border-primary shadow-md shadow-primary/30'
                : 'bg-background border-primary/60'
            }`} />
          );

          return (
            <ScrollReveal
              key={index}
              direction={isTop ? 'up' : 'down'}
              delay={index * 0.1}
            >
              <div className="relative flex flex-col items-center flex-1 min-w-0">
                {isTop ? (
                  <>
                    {card}
                    <div className="w-px h-3 bg-primary/40" />
                    {dot}
                    <div className="w-full mt-3 h-[80px]" />
                  </>
                ) : (
                  <>
                    <div className="w-full mb-3 h-[80px]" />
                    {dot}
                    <div className="w-px h-3 bg-primary/40" />
                    <div className="mt-3 w-full">{card}</div>
                  </>
                )}
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </div>
  );
}
