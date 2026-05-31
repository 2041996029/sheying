'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';
import { apiClient } from '@/lib/api-client';

interface UseDebouncedSearchResult {
  results: unknown[];
  total: number;
  loading: boolean;
  search: (query: string, categoryId?: string, sort?: string) => void;
}

export function useDebouncedSearch(): UseDebouncedSearchResult {
  const [results, setResults] = useState<unknown[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback((query: string, categoryId?: string, sort?: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!query.trim()) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const params = new URLSearchParams({ q: query });
        if (categoryId) params.set('category_id', categoryId);
        if (sort) params.set('sort', sort);

        const res = await apiClient.get<{ list: unknown[]; total: number }>(`/works/search?${params.toString()}`);
        if (!controller.signal.aborted && res.code === 0 && res.data) {
          setResults(res.data.list || []);
          setTotal(res.data.total || 0);
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setTotal(0);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { results, total, loading, search };
}
