'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { BREATH_PERIOD, SCROLL_HIDE_THRESHOLD } from '@/lib/constants';

export function ScrollIndicator() {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const hasHidden = useRef(false);

  useEffect(() => {
    const handler = () => {
      if (window.scrollY > SCROLL_HIDE_THRESHOLD && !hasHidden.current) {
        hasHidden.current = true;
        setVisible(false);
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  if (reduced) {
    return visible ? (
      <div className="flex flex-col items-center gap-1 text-white/60">
        <ChevronDown className="h-5 w-5" />
        <span className="text-xs">向下滚动</span>
      </div>
    ) : null;
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center gap-1"
        >
          <motion.div
            animate={{ y: [0, 6, 0], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: BREATH_PERIOD, repeat: Infinity, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-1 text-white/60"
            style={{ willChange: 'transform, opacity' }}
          >
            <ChevronDown className="h-5 w-5" />
            <span className="text-xs">向下滚动</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
