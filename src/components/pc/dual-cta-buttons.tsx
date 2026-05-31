'use client';

import { motion } from 'framer-motion';
import { Sparkles, ChevronRight, Info } from 'lucide-react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

export function DualCTAButtons() {
  const reduced = useReducedMotion();

  const primaryButton = (
    <button
      onClick={() => document.getElementById('works-section')?.scrollIntoView({ behavior: 'smooth' })}
      className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full font-medium hover:opacity-90 transition-opacity"
    >
      <Sparkles className="w-4 h-4" />
      浏览作品
      <ChevronRight className="w-4 h-4" />
    </button>
  );

  const secondaryButton = (
    <button
      onClick={() => window.location.href = '/about'}
        className="inline-flex items-center gap-2 border border-foreground/20 text-foreground px-6 py-3 rounded-full font-medium hover:bg-foreground/5 transition-colors"
    >
      <Info className="w-4 h-4" />
      了解更多
    </button>
  );

  if (reduced) {
    return (
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {primaryButton}
        {secondaryButton}
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      <motion.button
        onClick={() => document.getElementById('works-section')?.scrollIntoView({ behavior: 'smooth' })}
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full font-medium hover:opacity-90 transition-opacity"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
      >
        <Sparkles className="w-4 h-4" />
        浏览作品
        <ChevronRight className="w-4 h-4" />
      </motion.button>
      <motion.button
        onClick={() => window.location.href = '/about'}
      className="inline-flex items-center gap-2 border border-foreground/20 text-foreground px-6 py-3 rounded-full font-medium hover:bg-foreground/5 transition-colors"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Info className="w-4 h-4" />
        了解更多
      </motion.button>
    </div>
  );
}
