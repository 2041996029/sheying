'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { SlideDirection } from '@/lib/types/work-detail';

interface ImageLightboxProps {
  images: string[];
  currentIndex: number;
  direction?: SlideDirection;
  open: boolean;
  onClose: (currentIndex: number) => void;
}

export function ImageLightbox({ images, currentIndex, direction = 'right', open, onClose }: ImageLightboxProps) {
  const [index, setIndex] = useState(currentIndex);
  const [dir, setDir] = useState<SlideDirection>(direction);

  useEffect(() => {
    if (open) setIndex(currentIndex);
  }, [open, currentIndex]);

  const goNext = useCallback(() => {
    setDir('right');
    setIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setDir('left');
    setIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose(index);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, index, goNext, goPrev, onClose]);

  useEffect(() => {
    if (!open) return;
    let startX = 0;
    const handleTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
    const handleTouchEnd = (e: TouchEvent) => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) goNext();
        else goPrev();
      }
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [open, goNext, goPrev]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(index); }}
        >
          <button
            onClick={() => onClose(index)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>

          <button
            onClick={goPrev}
            className="absolute left-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            onClick={goNext}
            className="absolute right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <AnimatePresence initial={false} custom={dir}>
            <motion.div
              key={index}
              custom={dir}
              initial={{ x: dir === 'right' ? 300 : -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: dir === 'right' ? -300 : 300, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="max-w-[90vw] max-h-[85vh]"
            >
              <img
                src={images[index]}
                alt={`图片 ${index + 1}`}
                className="max-w-[90vw] max-h-[85vh] object-contain"
              />
            </motion.div>
          </AnimatePresence>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm tabular-nums">
            {index + 1} / {images.length}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
