'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({ value, duration = 2000, className = '' }: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    // 已经做过滚动动画了，后续值变化直接更新显示
    if (hasAnimated.current) {
      setDisplay(value);
      return;
    }

    // 值还是0时不启动动画（等API返回真实数据再动画）
    if (value === 0) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          animateNumber(value, duration, setDisplay);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {formatNumber(display)}
    </span>
  );
}

function animateNumber(target: number, duration: number, setter: (v: number) => void) {
  const start = performance.now();
  const from = 0;

  function tick(now: number) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + (target - from) * eased);
    setter(current);

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

function formatNumber(n: number): string {
  if (n >= 10000) {
    const val = n / 10000;
    return val % 1 === 0 ? `${val}万` : `${val.toFixed(1)}万`;
  }
  if (n >= 1000) {
    const val = n / 1000;
    return val % 1 === 0 ? `${val}k` : `${val.toFixed(1)}k`;
  }
  return String(n);
}
