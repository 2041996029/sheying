'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ArrowRight, Clock, Trash2, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { useSearchHistory } from '@/hooks/use-search-history';
import { highlightMatch } from '@/lib/highlight-match';
import { SEARCH_HOT_SUGGESTIONS, CATEGORY_EMOJI_MAP } from '@/lib/constants';
import { apiClient } from '@/lib/api-client';

interface WorkItem {
  id: string;
  title: string;
  coverUrl: string | null;
  category: { id: string; name: string } | null;
}

interface CategoryItem {
  id: string;
  name: string;
  workCount?: number;
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { results, loading, search } = useDebouncedSearch();
  const { history, addHistory, removeHistory, clearHistory } = useSearchHistory();

  const workResults = results as WorkItem[];
  const allItems = workResults;
  const hasResults = workResults.length > 0;

  useEffect(() => {
    if (open) {
      apiClient.get<CategoryItem[]>('/categories').then((res) => {
        if (res.code === 0 && res.data) setCategories(res.data);
      }).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    search(query, selectedCategoryId || undefined);
  }, [query, selectedCategoryId, search]);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [query, results]);

  const handleSelect = (id: string) => {
    if (query.trim()) addHistory(query.trim());
    onOpenChange(false);
    setQuery('');
    setSelectedCategoryId(null);
    router.push(`/work/${id}`);
  };

  const handleSubmit = () => {
    if (query.trim()) {
      addHistory(query.trim());
      onOpenChange(false);
      const params = new URLSearchParams({ q: query.trim() });
      if (selectedCategoryId) params.set('category_id', selectedCategoryId);
      router.push(`/search?${params.toString()}`);
      setQuery('');
      setSelectedCategoryId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < allItems.length) {
        handleSelect(allItems[focusedIndex].id);
      } else {
        handleSubmit();
      }
    } else if (e.key === 'Escape') {
      onOpenChange(false);
    }
  };

  const handleHistoryClick = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  const showHistory = !query && history.length > 0;
  const showHotSuggestions = !query && history.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">搜索作品</DialogTitle>
        <div className="flex items-center border-b border-border/50 px-4">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索摄影作品..."
            className="border-0 focus-visible:ring-0 h-12 text-base"
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setSelectedCategoryId(null); inputRef.current?.focus(); }}
              className="shrink-0 p-1 hover:bg-accent rounded-full transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* 分类筛选标签 */}
        {categories.length > 0 && (
          <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-border/30 scrollbar-none">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                !selectedCategoryId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              全部
            </button>
            {categories.slice(0, 8).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCategoryId === cat.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {CATEGORY_EMOJI_MAP[cat.name] || ''} {cat.name}
              </button>
            ))}
          </div>
        )}

        <div ref={listRef} className="max-h-80 overflow-y-auto custom-scrollbar">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              搜索中...
            </div>
          )}

          {!loading && query && !hasResults && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              未找到相关作品
            </div>
          )}

          {!loading && hasResults && (
            <div className="py-2">
              {workResults.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                    focusedIndex === idx ? 'bg-accent/70' : 'hover:bg-accent/50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-md bg-muted overflow-hidden shrink-0">
                    {item.coverUrl && (
                      <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{highlightMatch(item.title, query)}</p>
                    {item.category && (
                      <p className="text-xs text-muted-foreground">{item.category.name}</p>
                    )}
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* 搜索历史 */}
          {showHistory && (
            <div className="py-2">
              <div className="flex items-center justify-between px-4 py-1.5">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> 搜索历史
                </span>
                <button onClick={clearHistory} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                  清空
                </button>
              </div>
              {history.map((term) => (
                <div key={term} className="flex items-center px-4 group">
                  <button
                    onClick={() => handleHistoryClick(term)}
                    className="flex-1 text-sm py-2 text-left hover:text-primary transition-colors"
                  >
                    {term}
                  </button>
                  <button
                    onClick={() => removeHistory(term)}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 热门搜索建议 */}
          {showHotSuggestions && (
            <div className="py-2">
              <div className="px-4 py-1.5">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> 热门搜索
                </span>
              </div>
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {SEARCH_HOT_SUGGESTIONS.map((term) => (
                  <button
                    key={term}
                    onClick={() => handleHistoryClick(term)}
                    className="px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    {CATEGORY_EMOJI_MAP[term] || ''} {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="border-t border-border/50 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground hidden sm:inline-block">
            ↑↓ 导航 · Enter 确认 · Esc 关闭
          </span>
          {query && (
            <button
              onClick={handleSubmit}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              查看全部结果
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
