'use client';

import { motion } from 'framer-motion';
import { AnimatedCounter } from '@/components/pc/animated-counter';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

interface GlassStatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  delay?: number;
}

export function GlassStatCard({ icon, value, label, delay = 0 }: GlassStatCardProps) {
  const reduced = useReducedMotion();

  const card = (
    <div className="glass rounded-xl px-5 py-4 flex items-center gap-3 hover:-translate-y-1 transition-transform duration-200 border border-border/30 shadow-[0_0_15px_hsl(var(--primary))/0.08] hover:shadow-[0_0_20px_hsl(var(--primary))/0.15]">
      <div className="shrink-0">{icon}</div>
      <div>
        <AnimatedCounter value={value} className="text-2xl font-bold text-foreground" />
        <span className="text-sm text-muted-foreground ml-1">{label}</span>
      </div>
    </div>
  );

  if (reduced) {
    return card;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
    >
      {card}
    </motion.div>
  );
}
