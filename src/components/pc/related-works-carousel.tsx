'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import type { WorkCardData } from './work-card';

interface RelatedWorksCarouselProps {
  works: WorkCardData[];
}

export function RelatedWorksCarousel({ works }: RelatedWorksCarouselProps) {
  const router = useRouter();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    slidesToScroll: 1,
    containScroll: 'trimSnaps',
    dragFree: true,
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (works.length === 0) return null;

  return (
    <section className="mt-12 md:mt-16">
      <h2 className="text-lg font-bold mb-4">相关作品</h2>
      <div className="relative group/carousel">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex gap-4">
            {works.map((work, i) => (
              <motion.div
                key={work.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex-[0_0_calc(50%-0.5rem)] sm:flex-[0_0_calc(33.333%-0.667rem)] lg:flex-[0_0_calc(25%-0.75rem)] min-w-0"
              >
                <div
                  className="relative rounded-xl overflow-hidden cursor-pointer bg-card shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
                  onClick={() => router.push(`/work/${work.id}`)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(`/work/${work.id}`);
                    }
                  }}
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {work.coverUrl ? (
                      <Image
                        src={work.coverUrl}
                        alt={work.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover/carousel:scale-105"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <span className="text-muted-foreground text-xs">暂无图片</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium truncate">{work.title}</h3>
                    {work.category && (
                      <p className="text-xs text-muted-foreground mt-1">{work.category.name}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {canScrollPrev && (
          <button
            onClick={scrollPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 shadow-md opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-background lg:opacity-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {canScrollNext && (
          <button
            onClick={scrollNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 shadow-md opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-background lg:opacity-0"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </section>
  );
}
