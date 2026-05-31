'use client';

import { motion } from 'framer-motion';
import { Camera } from 'lucide-react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { APERTURE_ROTATION_PERIOD, PULSE_SCALE, PULSE_PERIOD } from '@/lib/constants';

export function AnimatedApertureIcon() {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div className="relative flex items-center justify-center">
        <div className="absolute w-16 h-16 rounded-full border-2 border-primary/30" />
        <Camera className="w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="absolute w-16 h-16 rounded-full border-2 border-primary/30"
        animate={{ rotate: 360 }}
        transition={{ duration: APERTURE_ROTATION_PERIOD, repeat: Infinity, ease: 'linear' }}
        style={{ willChange: 'transform' }}
      />
      <motion.div
        className="absolute w-20 h-20 rounded-full border border-primary/10"
        animate={{ scale: [1, PULSE_SCALE, 1] }}
        transition={{ duration: PULSE_PERIOD, repeat: Infinity, ease: 'easeInOut' }}
        style={{ willChange: 'transform' }}
      />
      <Camera className="w-8 h-8 text-primary" />
    </div>
  );
}
