'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import 'yet-another-react-lightbox/styles.css';

interface ImageGalleryProps {
  images: string[];
  title: string;
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
}

export function ImageGallery({ images, title, activeIndex: externalIndex, onActiveIndexChange }: ImageGalleryProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const activeIndex = externalIndex ?? internalIndex;

  const setActiveIndex = useCallback((index: number) => {
    setInternalIndex(index);
    onActiveIndexChange?.(index);
  }, [onActiveIndexChange]);

  const [lightboxOpen, setLightboxOpen] = useState(false);

  // —— DOM refs ——
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // —— 拖拽状态（全用 ref，拖拽过程零 re-render） ——
  const drag = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    baseTranslate: 0,     // 拖拽开始时 track 的 translateX
    currentDelta: 0,       // 拖拽过程中的水平偏移
    locked: null as 'h' | 'v' | null,
    didSwipe: false,
  });

  // 计算 track 应该的 translateX（基于 activeIndex）
  const getTargetTranslate = useCallback(() => {
    return -activeIndex * 100;
  }, [activeIndex]);

  // 直接设置 track transform
  const setTrackStyle = useCallback((translatePercent: number, animated: boolean) => {
    if (!trackRef.current) return;
    const el = trackRef.current;
    el.style.transition = animated ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
    el.style.transform = `translateX(${translatePercent}%)`;
  }, []);

  // 同步 track 位置到当前 activeIndex
  useEffect(() => {
    setTrackStyle(getTargetTranslate(), true);
  }, [activeIndex, setTrackStyle, getTargetTranslate]);

  // —— 切换方法 ——
  const handlePrev = useCallback(() => {
    setActiveIndex(activeIndex === 0 ? images.length - 1 : activeIndex - 1);
  }, [activeIndex, images.length, setActiveIndex]);

  const handleNext = useCallback(() => {
    setActiveIndex(activeIndex === images.length - 1 ? 0 : activeIndex + 1);
  }, [activeIndex, images.length, setActiveIndex]);

  // 用 ref 防止闭包过期
  const handlePrevRef = useRef(handlePrev);
  const handleNextRef = useRef(handleNext);
  handlePrevRef.current = handlePrev;
  handleNextRef.current = handleNext;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  // —— 结束拖拽逻辑 ——
  const finishDrag = useCallback(() => {
    const d = drag.current;
    if (!d.active) {
      setTrackStyle(getTargetTranslate(), true);
      return;
    }

    // 用容器宽度把 px 偏移转为百分比
    const containerW = containerRef.current?.offsetWidth || 1;
    const deltaPercent = (d.currentDelta / containerW) * 100;
    const elapsed = Date.now() - d.startTime;
    const velocity = elapsed > 0 ? Math.abs(d.currentDelta) / elapsed : 0;

    const threshold = 15; // 滑动 15% 即切换
    const isQuickSwipe = velocity > 0.4 && Math.abs(d.currentDelta) > 20;

    let switched = false;
    if (deltaPercent < -threshold || (isQuickSwipe && d.currentDelta < -20)) {
      handleNextRef.current();
      switched = true;
    } else if (deltaPercent > threshold || (isQuickSwipe && d.currentDelta > 20)) {
      handlePrevRef.current();
      switched = true;
    }

    // 如果没切换，回弹到当前位置
    if (!switched) {
      setTrackStyle(getTargetTranslate(), true);
    }

    d.active = false;
    d.locked = null;
    d.currentDelta = 0;
    if (d.didSwipe) {
      setTimeout(() => { d.didSwipe = false; }, 50);
    }
  }, [setTrackStyle, getTargetTranslate]);

  // —— 触摸事件 ——
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    const d = drag.current;
    d.active = true;
    d.startX = t.clientX;
    d.startY = t.clientY;
    d.startTime = Date.now();
    d.baseTranslate = getTargetTranslate();
    d.currentDelta = 0;
    d.locked = null;
    d.didSwipe = false;
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
    if (d.locked === 'v') {
      d.active = false;
      setTrackStyle(d.baseTranslate, false);
      return;
    }

    e.preventDefault();
    d.didSwipe = true;

    // 首尾阻尼
    let offset = dx;
    const idx = activeIndexRef.current;
    if ((idx === 0 && dx > 0) || (idx === images.length - 1 && dx < 0)) {
      offset = dx * 0.25;
    }
    d.currentDelta = offset;

    // px → percent
    const containerW = containerRef.current?.offsetWidth || 1;
    const percent = d.baseTranslate + (offset / containerW) * 100;
    setTrackStyle(percent, false);
  }, [images.length, setTrackStyle]);

  const onTouchEnd = useCallback(() => {
    finishDrag();
  }, [finishDrag]);

  // 鼠标按下开始拖拽
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const d = drag.current;
    d.active = true;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.startTime = Date.now();
    d.baseTranslate = getTargetTranslate();
    d.currentDelta = 0;
    d.locked = null;
    d.didSwipe = false;
  }, [getTargetTranslate]);

  // —— 鼠标事件（挂 document，防止拖出丢失） ——
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
      if (d.locked === 'v') {
        d.active = false;
        setTrackStyle(d.baseTranslate, false);
        return;
      }

      d.didSwipe = true;

      let offset = dx;
      const idx = activeIndexRef.current;
      if ((idx === 0 && dx > 0) || (idx === images.length - 1 && dx < 0)) {
        offset = dx * 0.25;
      }
      d.currentDelta = offset;

      const containerW = containerRef.current?.offsetWidth || 1;
      const percent = d.baseTranslate + (offset / containerW) * 100;
      setTrackStyle(percent, false);
    };

    const onUp = () => {
      finishDrag();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [images.length, setTrackStyle, finishDrag]);

  // —— 键盘 ——
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
  }, [handlePrev, handleNext]);

  // —— Lightbox slides ——
  const slides = useMemo(() => images.map((src) => ({ src })), [images]);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-video rounded-xl bg-muted flex items-center justify-center">
        <span className="text-muted-foreground text-sm">暂无图片</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main Image Carousel */}
      <div
        ref={containerRef}
        className="relative group rounded-xl overflow-hidden bg-black/5 select-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        role="img"
        aria-label={`${title} - 第${activeIndex + 1}张，共${images.length}张`}
        style={{ touchAction: 'pan-y' }}
      >
        {/* Track: 所有图片并排 */}
        <div
          ref={trackRef}
          className="flex will-change-transform"
          style={{ transform: `translateX(${-activeIndex * 100}%)` }}
        >
          {images.map((src, i) => (
            <div
              key={i}
              className="w-full shrink-0 flex items-center justify-center"
              style={{ cursor: 'zoom-in' }}
              onClick={() => {
                if (drag.current.didSwipe) return;
                setLightboxOpen(true);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${title} - ${i + 1}`}
                className="w-full max-h-[70vh] object-contain pointer-events-none"
                draggable={false}
                loading={i < 2 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full glass opacity-0 group-hover:opacity-100 transition-opacity z-10"
              onClick={handlePrev}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full glass opacity-0 group-hover:opacity-100 transition-opacity z-10"
              onClick={handleNext}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}

        {/* Zoom Hint */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full glass"
            onClick={() => setLightboxOpen(true)}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        {/* Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-3 right-3 glass rounded-full px-2.5 py-0.5 text-xs z-10">
            {activeIndex + 1} / {images.length}
          </div>
        )}

        {/* Swipe Hint */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-3 glass rounded-full px-2.5 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10">
            ← 滑动切换 →
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                i === activeIndex
                  ? 'border-primary ring-1 ring-primary/30'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt={`${title} 缩略图 ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={activeIndex}
        slides={slides}
        plugins={[Zoom, Counter]}
        on={{ view: ({ index }) => setActiveIndex(index) }}
        zoom={{
          maxZoomPixelRatio: 3,
          scrollToZoom: true,
        }}
        styles={{
          container: { backgroundColor: 'rgba(0, 0, 0, 0.95)' },
        }}
      />
    </div>
  );
}
