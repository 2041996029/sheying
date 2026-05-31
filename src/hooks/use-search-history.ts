'use client';

import { useState, useCallback, useEffect } from 'react';
import { SEARCH_HISTORY_KEY, SEARCH_HISTORY_MAX_ITEMS } from '@/lib/constants';
import type { SearchHistoryStorage } from '@/lib/types/search';

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (raw) {
        const data: SearchHistoryStorage = JSON.parse(raw);
        setHistory(data.items || []);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const persist = useCallback((items: string[]) => {
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify({ items, updatedAt: Date.now() }));
    } catch {
      // quota exceeded
    }
  }, []);

  const addHistory = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const filtered = prev.filter((h) => h !== trimmed);
      const next = [trimmed, ...filtered].slice(0, SEARCH_HISTORY_MAX_ITEMS);
      persist(next);
      return next;
    });
  }, [persist]);

  const removeHistory = useCallback((query: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h !== query);
      persist(next);
      return next;
    });
  }, [persist]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try { localStorage.removeItem(SEARCH_HISTORY_KEY); } catch { /* ignore */ }
  }, []);

  return { history, addHistory, removeHistory, clearHistory };
}
