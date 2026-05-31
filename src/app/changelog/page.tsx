'use client';

import { useEffect, useState } from 'react';
import { FileText, Wrench, Paintbrush, Rocket, Cog, RefreshCw, ChevronDown } from 'lucide-react';
import { Header } from '@/components/pc/header';
import { Footer } from '@/components/pc/footer';
import { ScrollReveal } from '@/components/pc/scroll-reveal';
import { MarkdownContent } from '@/components/pc/markdown-content';
import { apiClient } from '@/lib/api-client';

interface ChangelogItem {
  id: string;
  version: string;
  title: string;
  content: string;
  type: string;
  publishedAt: string;
}

const TYPE_CONFIG: Record<string, { icon: typeof Rocket; color: string; bgColor: string; label: string }> = {
  feature: { icon: Rocket, color: 'text-primary', bgColor: 'bg-primary/10 border-primary/20', label: '新功能' },
  fix: { icon: Wrench, color: 'text-destructive', bgColor: 'bg-destructive/10 border-destructive/20', label: '修复' },
  optimize: { icon: Cog, color: 'text-chart-4', bgColor: 'bg-chart-4/10 border-chart-4/20', label: '优化' },
  style: { icon: Paintbrush, color: 'text-chart-3', bgColor: 'bg-chart-3/10 border-chart-3/20', label: '样式' },
  refactor: { icon: RefreshCw, color: 'text-chart-2', bgColor: 'bg-chart-2/10 border-chart-2/20', label: '重构' },
  docs: { icon: FileText, color: 'text-chart-5', bgColor: 'bg-chart-5/10 border-chart-5/20', label: '文档' },
};

export default function ChangelogPage() {
  const [changelogs, setChangelogs] = useState<ChangelogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiClient.get<ChangelogItem[]>('/changelog?limit=50').then(res => {
      if (res.code === 0 && res.data) {
        setChangelogs(res.data);
        // 默认展开最新一条
        if (res.data.length > 0) {
          setExpandedIds(new Set([res.data[0].id]));
        }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 pt-20 pb-16">
        {/* 页头 */}
        <section className="relative py-16 md:py-24 px-4 overflow-hidden">
          {/* 背景装饰 */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-[600px] h-[300px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="pointer-events-none select-none absolute -bottom-8 md:-bottom-16 left-1/2 -translate-x-1/2 text-[6rem] sm:text-[10rem] md:text-[16rem] leading-none font-serif italic font-bold text-foreground/[0.02] tracking-tighter whitespace-nowrap">
            Changelog
          </div>

          <div className="max-w-4xl mx-auto relative z-10 text-center">
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-border/50 bg-background/50 backdrop-blur-sm mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/90 animate-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground tracking-[0.25em] uppercase">Changelog</span>
              <span className="w-px h-3 bg-border/50 hidden sm:inline-block" />
              <span className="text-[11px] font-medium text-muted-foreground/70 hidden sm:inline">更新日志</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">更新日志</h1>
            <p className="text-muted-foreground text-base md:text-lg font-light max-w-xl mx-auto leading-relaxed">
              每一次迭代，都是对光影之美的更好追求。在这里查看所有版本的更新记录。
            </p>
          </div>
        </section>

        {/* 更新列表 */}
        <section className="max-w-4xl mx-auto px-4">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-border/30 p-6 animate-pulse">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-20 h-5 bg-muted rounded" />
                    <div className="w-12 h-5 bg-muted rounded" />
                    <div className="flex-1 h-5 bg-muted rounded max-w-[200px]" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : changelogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="w-16 h-16 text-muted-foreground/20 mb-4" />
              <p className="text-lg text-muted-foreground">暂无更新记录</p>
              <p className="text-sm text-muted-foreground/50 mt-1">请稍后再来查看</p>
            </div>
          ) : (
            <div className="relative">
              {/* 时间线竖线 */}
              <div className="absolute left-[23px] top-4 bottom-4 w-px bg-border/40 hidden sm:block" />

              <div className="space-y-4">
                {changelogs.map((log, index) => {
                  const typeConf = TYPE_CONFIG[log.type] || TYPE_CONFIG.feature;
                  const TypeIcon = typeConf.icon;
                  const isExpanded = expandedIds.has(log.id);
                  const isLatest = index === 0;

                  return (
                    <ScrollReveal key={log.id} delay={index * 0.03}>
                      <div
                        className={`relative group rounded-2xl border transition-all duration-300 overflow-hidden ${
                          isLatest
                            ? 'border-primary/20 ring-1 ring-primary/10 bg-primary/[0.02]'
                            : 'border-border/30 hover:border-border/60 bg-background/50'
                        }`}
                      >
                        {/* 最新版本高光线 */}
                        {isLatest && (
                          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                        )}

                        <div className="p-5 md:p-6">
                          <div className="flex gap-4 md:gap-5">
                            {/* 左侧时间线 */}
                            <div className="hidden sm:flex flex-col items-center gap-2 pt-0.5 shrink-0 w-[48px]">
                              <div className={`w-[30px] h-[30px] rounded-full border-2 flex items-center justify-center ${typeConf.bgColor} ${isLatest ? 'shadow-lg' : ''}`}>
                                <TypeIcon className={`w-3.5 h-3.5 ${typeConf.color}`} />
                              </div>
                              <span className="text-[10px] text-muted-foreground/50 font-mono whitespace-nowrap">
                                {formatDate(log.publishedAt)}
                              </span>
                            </div>

                            {/* 右侧内容 */}
                            <div className="flex-1 min-w-0">
                              {/* 标题行 */}
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-bold tracking-wide ${
                                  isLatest ? 'bg-primary/15 text-primary' : 'bg-primary/8 text-primary/70'
                                }`}>
                                  v{log.version}
                                </span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${typeConf.bgColor} ${typeConf.color}`}>
                                  {typeConf.label}
                                </span>
                              </div>

                              {/* 标题 + 展开/收起按钮 */}
                              <button
                                onClick={() => toggleExpand(log.id)}
                                className="w-full text-left flex items-center gap-2 group/title mb-2"
                              >
                                <h3 className={`font-semibold ${isLatest ? 'text-base text-foreground' : 'text-sm text-foreground/90'} flex-1`}>
                                  {log.title}
                                </h3>
                                <ChevronDown
                                  className={`w-4 h-4 text-muted-foreground/40 shrink-0 transition-transform duration-200 ${
                                    isExpanded ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>

                              {/* 移动端日期 */}
                              <p className="sm:hidden text-[10px] text-muted-foreground/40 font-mono mb-3">
                                {formatDate(log.publishedAt)}
                              </p>

                              {/* 展开内容：Markdown 渲染 */}
                              {isExpanded && (
                                <div className="mt-3 pt-3 border-t border-border/20">
                                  <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground prose-headings:text-foreground prose-h2:text-sm prose-h2:font-semibold prose-h2:mt-4 prose-h2:mb-2 prose-li:text-xs prose-li:leading-relaxed prose-ul:space-y-1">
                                    <MarkdownContent content={log.content} />
                                  </div>
                                </div>
                              )}

                              {/* 收起时显示摘要 */}
                              {!isExpanded && (
                                <div className="mt-1 space-y-0.5">
                                  {log.content.split('\n').filter(l => l.trim().startsWith('- ')).slice(0, 3).map((line, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground/60">
                                      <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/20 shrink-0" />
                                      <span className="leading-relaxed">{line.trim().slice(2)}</span>
                                    </div>
                                  ))}
                                  {log.content.split('\n').filter(l => l.trim().startsWith('- ')).length > 3 && (
                                    <span className="text-[10px] text-muted-foreground/30 ml-3">
                                      还有 {log.content.split('\n').filter(l => l.trim().startsWith('- ')).length - 3} 项更新...
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </ScrollReveal>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
