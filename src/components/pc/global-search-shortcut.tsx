'use client';

import { useEffect } from 'react';
import { useSearchStore } from '@/stores/search-store';

export function GlobalSearchShortcut() {
  const { setDialogOpen } = useSearchStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setDialogOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setDialogOpen]);

  return null;
}
