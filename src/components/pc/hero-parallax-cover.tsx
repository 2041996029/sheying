'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

interface HeroParallaxCoverProps {
  src: string;
  title: string;
}

export function HeroParallaxCover({ src, title }: HeroParallaxCoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div ref={ref} className="relative h-[50vh] md:h-[70vh] min-h-[300px] overflow-hidden">
      <motion.div className="absolute inset-0" style={{ y: reduced ? undefined : y, willChange: reduced ? undefined : 'transform' }}>
        <Image
          src={src}
          alt={title}
          fill
          className="object-cover"
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/20" />
      </motion.div>
      <motion.div
        className="absolute bottom-0 left-0 right-0 p-6 md:p-10"
        style={{ opacity }}
      >
        <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">{title}</h1>
      </motion.div>
    </div>
  );
}
