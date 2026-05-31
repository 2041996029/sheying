'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Eye, MessageCircle, Calendar, MapPin, QrCode, Download, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Header } from '@/components/pc/header';
import { Footer } from '@/components/pc/footer';
import { ExifPanel } from '@/components/pc/exif-panel';
import { CommentList } from '@/components/pc/comment-list';
import { FilmThumbnailNav } from '@/components/pc/film-thumbnail-nav';
import { ImageLightbox } from '@/components/pc/image-lightbox';
import { FloatingActionBar } from '@/components/pc/floating-action-bar';
import { BreadcrumbNav } from '@/components/pc/breadcrumb-nav';
import { RelatedWorksCarousel } from '@/components/pc/related-works-carousel';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useConfigStore } from '@/stores/config-store';
import { toast } from 'sonner';
import type { WorkCardData } from '@/components/pc/work-card';
import type { SlideDirection } from '@/lib/types/work-detail';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { motion, useInView } from 'framer-motion';

interface WorkDetail {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  coverUrl: string | null;
  category: { id: string; name: string } | null;
  tags: string[];
  params: Record<string, string | number | null> | Record<string, string | number | null>[] | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  isFeatured: boolean;
  likeCount: number;
  favoriteCount: number;
  viewCount: number;
  commentCount: number;
  createdAt: string;
}

function ScrollReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export default function WorkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { configs, fetchConfigs } = useConfigStore();
  const [work, setWork] = useState<WorkDetail | null>(null);
  const [relatedWorks, setRelatedWorks] = useState<WorkCardData[]>([]);
  const [liked, setLiked] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>('right');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [qrCodeDialogOpen, setQrCodeDialogOpen] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string>('');
  const [qrCodeLoading, setQrCodeLoading] = useState(false);
  const [likeActionLoading, setLikeActionLoading] = useState(false);
  const [favoriteActionLoading, setFavoriteActionLoading] = useState(false);

  const workId = params.id as string;

  // Drag track refs
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    baseTranslate: 0,
    currentDelta: 0,
    locked: null as 'h' | 'v' | null,
    didSwipe: false,
  });
  const activeIndexRef = useRef(activeImageIndex);
  activeIndexRef.current = activeImageIndex;
  const isLoopingRef = useRef(false);
  const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup loop timeout on unmount
  useEffect(() => {
    return () => { if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current); };
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  useEffect(() => {
    const fetchWork = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<WorkDetail>(`/works/${workId}`);
        if (res.code === 0 && res.data) {
          setWork(res.data);
          setLikeCount(res.data.likeCount);
          setFavoriteCount(res.data.favoriteCount);
          if (res.data.category?.id) {
            const relatedRes = await apiClient.get<{ list: WorkCardData[] }>(
              `/works?category_id=${res.data.category.id}&page=1&page_size=8`
            );
            if (relatedRes.code === 0 && relatedRes.data) {
              setRelatedWorks(relatedRes.data.list.filter((w) => w.id !== workId).slice(0, 6));
            }
          }
        } else {
          toast.error('作品不存在');
          router.push('/');
        }
      } catch {
        toast.error('加载失败');
        router.push('/');
      }
      setLoading(false);
    };
    if (workId) fetchWork();
  }, [workId, router]);

  useEffect(() => {
    if (!isAuthenticated || !workId) return;
    const checkStatus = async () => {
      try {
        const [likeRes, favRes] = await Promise.all([
          apiClient.get<{ liked: boolean }>(`/works/${workId}/like`),
          apiClient.get<{ favorited: boolean }>(`/works/${workId}/favorite`),
        ]);
        if (likeRes.code === 0 && likeRes.data) setLiked(likeRes.data.liked);
        if (favRes.code === 0 && favRes.data) setFavorited(favRes.data.favorited);
      } catch {}
    };
    checkStatus();
  }, [workId, isAuthenticated]);

  const handleLike = async () => {
    if (!isAuthenticated) { toast.error('请先登录'); return; }
    if (likeActionLoading) return; // 防抖锁，防止重复点击
    setLikeActionLoading(true);
    try {
      if (liked) {
        const res = await apiClient.delete<{ liked: boolean; likeCount: number }>(`/works/${workId}/like`);
        if (res.code === 0 && res.data) { setLiked(false); setLikeCount(res.data.likeCount); toast.success('已取消点赞'); }
      } else {
        const res = await apiClient.post<{ liked: boolean; likeCount: number }>(`/works/${workId}/like`);
        if (res.code === 0 && res.data) { setLiked(true); setLikeCount(res.data.likeCount); toast.success('点赞成功'); }
      }
    } catch { toast.error('操作失败'); }
    setLikeActionLoading(false);
  };

  const handleFavorite = async () => {
    if (!isAuthenticated) { toast.error('请先登录'); return; }
    if (favoriteActionLoading) return; // 防抖锁，防止重复点击
    setFavoriteActionLoading(true);
    try {
      if (favorited) {
        const res = await apiClient.delete<{ favorited: boolean; favoriteCount: number }>(`/works/${workId}/favorite`);
        if (res.code === 0 && res.data) { setFavorited(false); setFavoriteCount(res.data.favoriteCount); toast.success('已取消收藏'); }
      } else {
        const res = await apiClient.post<{ favorited: boolean; favoriteCount: number }>(`/works/${workId}/favorite`);
        if (res.code === 0 && res.data) { setFavorited(true); setFavoriteCount(res.data.favoriteCount); toast.success('收藏成功'); }
      }
    } catch { toast.error('操作失败'); }
    setFavoriteActionLoading(false);
  };

  const handleShare = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast.success('链接已复制到剪贴板'); }
    catch { toast.error('复制失败'); }
  };

  const handleShowQrCode = async () => {
    setQrCodeDialogOpen(true);
    if (qrCodeBase64) return;
    setQrCodeLoading(true);
    try {
      const res = await apiClient.get<{ base64: string; workId: string }>(`/works/${workId}/qrcode`);
      if (res.code === 0 && res.data?.base64) setQrCodeBase64(res.data.base64);
      else { toast.error(res.message || '获取小程序码失败'); setQrCodeDialogOpen(false); }
    } catch { toast.error('获取小程序码失败'); setQrCodeDialogOpen(false); }
    setQrCodeLoading(false);
  };

  const handleDownloadQrCode = () => {
    if (!qrCodeBase64) return;
    try {
      const link = document.createElement('a');
      link.href = qrCodeBase64;
      link.download = `${work?.title || 'qrcode'}-小程序码.png`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      toast.success('小程序码已下载');
    } catch { toast.error('下载失败'); }
  };

  // Track translate helpers (offset +1 to account for leading clone slide)
  const getTargetTranslate = useCallback(() => -(activeImageIndex + 1) * 100, [activeImageIndex]);
  const setTrackStyle = useCallback((translatePercent: number, animated: boolean) => {
    if (!trackRef.current) return;
    trackRef.current.style.transition = animated ? 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none';
    trackRef.current.style.transform = `translateX(${translatePercent}%)`;
  }, []);

  const handleImageSelect = useCallback((index: number) => {
    if (isLoopingRef.current) return;
    setSlideDirection(index > activeImageIndex ? 'right' : 'left');
    setActiveImageIndex(index);
  }, [activeImageIndex]);

  const imagesLen = work?.images.length || 0;

  const goNext = useCallback(() => {
    if (imagesLen <= 1 || isLoopingRef.current) return;
    if (activeImageIndex === imagesLen - 1) {
      // Loop: animate to clone-first then snap to real first
      isLoopingRef.current = true;
      setSlideDirection('right');
      setTrackStyle(-(imagesLen + 1) * 100, true);
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = setTimeout(() => {
        isLoopingRef.current = false;
        setActiveImageIndex(0);
        if (trackRef.current) {
          trackRef.current.style.transition = 'none';
          trackRef.current.style.transform = 'translateX(-100%)';
        }
      }, 320);
    } else {
      handleImageSelect(activeImageIndex + 1);
    }
  }, [activeImageIndex, imagesLen, handleImageSelect, setTrackStyle]);

  const goPrev = useCallback(() => {
    if (imagesLen <= 1 || isLoopingRef.current) return;
    if (activeImageIndex === 0) {
      // Loop: animate to clone-last then snap to real last
      isLoopingRef.current = true;
      setSlideDirection('left');
      setTrackStyle(0, true);
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = setTimeout(() => {
        isLoopingRef.current = false;
        setActiveImageIndex(imagesLen - 1);
        if (trackRef.current) {
          trackRef.current.style.transition = 'none';
          trackRef.current.style.transform = `translateX(${-imagesLen * 100}%)`;
        }
      }, 320);
    } else {
      handleImageSelect(activeImageIndex - 1);
    }
  }, [activeImageIndex, imagesLen, handleImageSelect, setTrackStyle]);

  const goNextRef = useRef(goNext);
  const goPrevRef = useRef(goPrev);
  goNextRef.current = goNext;
  goPrevRef.current = goPrev;

  const handleLightboxClose = useCallback((currentIndex: number) => {
    setLightboxOpen(false);
    setActiveImageIndex(currentIndex);
  }, []);

  useEffect(() => {
    if (isLoopingRef.current) return;
    setTrackStyle(getTargetTranslate(), true);
  }, [activeImageIndex, setTrackStyle, getTargetTranslate]);

  // Finish drag
  const finishDrag = useCallback(() => {
    const d = drag.current;
    if (!d.active || isLoopingRef.current) { setTrackStyle(getTargetTranslate(), true); return; }
    const containerW = containerRef.current?.offsetWidth || 1;
    const deltaPercent = (d.currentDelta / containerW) * 100;
    const elapsed = Date.now() - d.startTime;
    const velocity = elapsed > 0 ? Math.abs(d.currentDelta) / elapsed : 0;
    const threshold = 15;
    const isQuickSwipe = velocity > 0.4 && Math.abs(d.currentDelta) > 20;
    if (deltaPercent < -threshold || (isQuickSwipe && d.currentDelta < -20)) {
      goNextRef.current();
    } else if (deltaPercent > threshold || (isQuickSwipe && d.currentDelta > 20)) {
      goPrevRef.current();
    } else {
      setTrackStyle(getTargetTranslate(), true);
    }
    d.active = false; d.locked = null; d.currentDelta = 0;
    if (d.didSwipe) setTimeout(() => { d.didSwipe = false; }, 50);
  }, [setTrackStyle, getTargetTranslate]);

  // Touch events
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    const d = drag.current;
    d.active = true; d.startX = t.clientX; d.startY = t.clientY;
    d.startTime = Date.now(); d.baseTranslate = getTargetTranslate();
    d.currentDelta = 0; d.locked = null; d.didSwipe = false;
  }, [getTargetTranslate]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const t = e.touches[0];
    const dx = t.clientX - d.startX;
    const dy = t.clientY - d.startY;
    if (!d.locked) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      d.locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
    if (d.locked === 'v') { d.active = false; setTrackStyle(d.baseTranslate, false); return; }
    e.preventDefault();
    d.didSwipe = true;
    d.currentDelta = dx;
    const containerW = containerRef.current?.offsetWidth || 1;
    const percent = d.baseTranslate + (dx / containerW) * 100;
    setTrackStyle(percent, false);
  }, [setTrackStyle]);

  const onTouchEnd = useCallback(() => { finishDrag(); }, [finishDrag]);

  // Mouse events
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const d = drag.current;
    d.active = true; d.startX = e.clientX; d.startY = e.clientY;
    d.startTime = Date.now(); d.baseTranslate = getTargetTranslate();
    d.currentDelta = 0; d.locked = null; d.didSwipe = false;
  }, [getTargetTranslate]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = drag.current;
      if (!d.active) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.locked) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        d.locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
      if (d.locked === 'v') { d.active = false; setTrackStyle(d.baseTranslate, false); return; }
      d.didSwipe = true;
      d.currentDelta = dx;
      const containerW = containerRef.current?.offsetWidth || 1;
      const percent = d.baseTranslate + (dx / containerW) * 100;
      setTrackStyle(percent, false);
    };
    const onUp = () => { finishDrag(); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [setTrackStyle, finishDrag]);

  // Keyboard
  useEffect(() => {
    if (imagesLen <= 1) return;
    const handler = (e: KeyboardEvent) => {
      if (lightboxOpen) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [imagesLen, lightboxOpen, goNext, goPrev]);

  const formatTime = (dateStr: string) => {
    try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: zhCN }); }
    catch { return dateStr; }
  };

  if (loading) {
    return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
        <Header />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="aspect-video rounded-xl" />
              <Skeleton className="h-8 w-3/4" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!work) return null;

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Header />

      <main className="flex-1 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-4">
            <BreadcrumbNav
              items={[
                ...(work.category ? [{ label: work.category.name, href: `/?category_id=${work.category.id}` }] : []),
                { label: work.title },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 pb-12">
            <div className="lg:col-span-2 space-y-6">
              {/* Draggable Image Carousel */}
              <ScrollReveal>
                <div
                  ref={containerRef}
                  className="relative group rounded-xl overflow-hidden bg-black/5 select-none"
                  style={{ touchAction: 'pan-y' }}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  onMouseDown={onMouseDown}
                  role="img"
                  aria-label={`${work.title} - 第${activeImageIndex + 1}张，共${work.images.length}张`}
                >
                  <div
                    ref={trackRef}
                    className="flex will-change-transform"
                    style={{ transform: `translateX(${-(activeImageIndex + 1) * 100}%)`, position: 'relative' }}
                  >
                    {/* Clone of last image for infinite loop */}
                    {work.images.length > 1 && (
                      <div className="min-w-full shrink-0 flex items-center justify-center">
                        <img
                          src={work.images[work.images.length - 1]}
                          alt=""
                          className="w-full max-h-[70vh] object-contain pointer-events-none"
                          draggable={false}
                          loading="lazy"
                        />
                      </div>
                    )}
                    {work.images.map((src, i) => (
                      <div
                        key={i}
                        className="min-w-full shrink-0 flex items-center justify-center"
                        style={{ cursor: 'zoom-in' }}
                        onClick={() => {
                          if (drag.current.didSwipe) return;
                          setLightboxOpen(true);
                        }}
                      >
                        <img
                          src={src}
                          alt={`${work.title} - ${i + 1}`}
                          className="w-full max-h-[70vh] object-contain pointer-events-none"
                          draggable={false}
                          loading={i < 2 ? 'eager' : 'lazy'}
                        />
                      </div>
                    ))}
                    {/* Clone of first image for infinite loop */}
                    {work.images.length > 1 && (
                      <div className="min-w-full shrink-0 flex items-center justify-center">
                        <img
                          src={work.images[0]}
                          alt=""
                          className="w-full max-h-[70vh] object-contain pointer-events-none"
                          draggable={false}
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>

                  {/* Navigation Arrows */}
                  {work.images.length > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full glass opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        onClick={(e) => { e.stopPropagation(); goPrev(); }}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full glass opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        onClick={(e) => { e.stopPropagation(); goNext(); }}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </>
                  )}

                  {/* Zoom button */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full glass" onClick={() => setLightboxOpen(true)}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Counter */}
                  {work.images.length > 1 && (
                    <div className="absolute bottom-3 right-3 glass rounded-full px-2.5 py-0.5 text-xs z-10">
                      {activeImageIndex + 1} / {work.images.length}
                    </div>
                  )}
                </div>
              </ScrollReveal>

              <FilmThumbnailNav images={work.images} activeIndex={activeImageIndex} onSelect={handleImageSelect} />

              {work.description && (
                <ScrollReveal delay={0.1}>
                  <div className="glass-subtle rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-2">作品描述</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{work.description}</p>
                  </div>
                </ScrollReveal>
              )}

              {work.tags && work.tags.length > 0 && (
                <ScrollReveal delay={0.15}>
                  <div className="flex flex-wrap gap-2">
                    {work.tags.map((tag) => (<Badge key={tag} variant="secondary" className="text-xs rounded-full">{tag}</Badge>))}
                  </div>
                </ScrollReveal>
              )}

              {configs.display_comment_enabled !== 'false' && (
                <ScrollReveal delay={0.2}>
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-primary" /> 评论 ({work.commentCount})
                    </h3>
                    <CommentList workId={work.id} />
                  </div>
                </ScrollReveal>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="space-y-4">
              <ScrollReveal delay={0.05}>
                <div className="glass-subtle rounded-xl p-5 space-y-4">
                  <div>
                    <h1 className="text-lg font-bold">{work.title}</h1>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatTime(work.createdAt)}</span>
                    </div>
                  </div>
                  {work.category && <Badge variant="outline" className="text-xs">{work.category.name}</Badge>}
                  {work.location && (
                    <div className="flex items-center gap-1.5 text-xs text-primary">
                      <MapPin className="h-3 w-3" /><span>{work.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground"><Eye className="h-3.5 w-3.5" /> {work.viewCount}</span>
                    <span className="flex items-center gap-1 text-muted-foreground">点赞 {likeCount}</span>
                    <span className="flex items-center gap-1 text-muted-foreground">收藏 {favoriteCount}</span>
                  </div>
                  <Separator />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={handleShare}>分享链接</Button>
                    <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={handleShowQrCode}>
                      <QrCode className="h-4 w-4 mr-1" />小程序码
                    </Button>
                  </div>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={0.1}>
                <ExifPanel params={work.params} activeIndex={activeImageIndex} />
              </ScrollReveal>
            </div>
          </div>

          {relatedWorks.length > 0 && (
            <ScrollReveal delay={0.15}>
              <RelatedWorksCarousel works={relatedWorks} />
            </ScrollReveal>
          )}
        </div>
      </main>

      <FloatingActionBar liked={liked} favorited={favorited} likeCount={likeCount} favoriteCount={favoriteCount} onLike={handleLike} onFavorite={handleFavorite} onShare={handleShare} />
      <ImageLightbox images={work.images} currentIndex={activeImageIndex} direction={slideDirection} open={lightboxOpen} onClose={handleLightboxClose} />

      <Dialog open={qrCodeDialogOpen} onOpenChange={setQrCodeDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" />分享作品</DialogTitle>
            <DialogDescription>用微信扫描小程序码，在手机上查看作品</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrCodeLoading ? (
              <div className="w-52 h-52 flex items-center justify-center bg-muted rounded-xl">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <div className="h-6 w-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
                  <span className="text-xs">生成中...</span>
                </div>
              </div>
            ) : qrCodeBase64 ? (
              <div className="bg-white rounded-xl p-3 shadow-sm"><img src={qrCodeBase64} alt="小程序码" className="w-52 h-52 object-contain" /></div>
            ) : null}
            {work && <p className="text-sm text-muted-foreground text-center truncate max-w-full">{work.title}</p>}
          </div>
          {qrCodeBase64 && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleShare}>复制链接</Button>
              <Button className="flex-1" onClick={handleDownloadQrCode}><Download className="h-4 w-4 mr-1" />下载小程序码</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
