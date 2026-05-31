'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

interface HitokotoData {
  text: string;
  from: string;
  from_who: string | null;
}

export function Hitokoto() {
  const [data, setData] = useState<HitokotoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fade, setFade] = useState(true);

  const fetchHitokoto = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const url = force ? '/api/v1/hitokoto?no_cache=1' : '/api/v1/hitokoto';
      const res = await fetch(url);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setFade(false);
        setTimeout(() => {
          setData(json.data);
          setFade(true);
        }, 300);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHitokoto();
    // 配合 visibilityState 暂停轮询，避免后台tab持续请求
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchHitokoto();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchHitokoto]);

  if (!data) return null;

  return (
    <div className="flex justify-center py-8 px-4">
      <div
        className={`glass rounded-xl px-6 py-4 max-w-xl w-full text-center cursor-pointer group transition-all duration-300 hover:shadow-md ${fade ? 'opacity-100' : 'opacity-0'}`}
        onClick={() => !loading && fetchHitokoto(true)}
      >
        <p className="text-sm text-muted-foreground leading-relaxed italic">
          &ldquo;{data.text}&rdquo;
        </p>
        <div className="flex items-center justify-center gap-2 mt-2">
          {data.from && (
            <span className="text-xs text-muted-foreground/60">
              —— {data.from}
              {data.from_who ? ` · ${data.from_who}` : ''}
            </span>
          )}
          <RefreshCw
            className={`h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors ${loading ? 'animate-spin' : ''}`}
          />
        </div>
      </div>
    </div>
  );
}
