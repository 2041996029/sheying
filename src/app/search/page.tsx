'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search as SearchIcon, Loader2, Camera, X, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Header } from '@/components/pc/header';
import { Footer } from '@/components/pc/footer';
import { WorkGrid, type WorkCardData } from '@/components/pc/work-grid';
import { apiClient } from '@/lib/api-client';
import { SORT_OPTIONS, CATEGORY_EMOJI_MAP, SEARCH_HOT_SUGGESTIONS } from '@/lib/constants';
import { highlightMatch } from '@/lib/highlight-match';
import type { SortValue } from '@/lib/types/search';

interface CategoryItem {
  id: string;
  name: string;
  workCount?: number;
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialCategoryId = searchParams.get('category_id') || '';

  const [query, setQuery] = useState(initialQuery);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialCategoryId || null);
  const [sort, setSort] = useState<SortValue>('latest');
  const [works, setWorks] = useState<WorkCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  useEffect(() => {
    apiClient.get<CategoryItem[]>('/categories').then((res) => {
      if (res.code === 0 && res.data) setCategories(res.data);
    }).catch(() => {});
  }, []);

  const doSearch = useCallback(async (q?: string, catId?: string | null, sortVal?: SortValue) => {
    const searchQuery = (q ?? query).trim();
    if (!searchQuery) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q: searchQuery });
      const cid = catId ?? selectedCategoryId;
      const sv = sortVal ?? sort;
      if (cid) params.set('category_id', cid);
      if (sv && sv !== 'latest') params.set('sort', sv);
      const res = await apiClient.get<{ list: WorkCardData[]; total: number }>(
        `/works/search?${params.toString()}`
      );
      if (res.code === 0 && res.data) {
        setWorks(res.data.list || []);
        setTotal(res.data.total || 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [query, selectedCategoryId, sort]);

  useEffect(() => {
    if (!initialQuery) return;
    let cancelled = false;
    setLoading(true);
    setSearched(true);
    const params = new URLSearchParams({ q: initialQuery.trim() });
    if (initialCategoryId) params.set('category_id', initialCategoryId);
    apiClient.get<{ list: WorkCardData[]; total: number }>(`/works/search?${params.toString()}`)
      .then((res) => {
        if (!cancelled && res.code === 0 && res.data) {
          setWorks(res.data.list || []);
          setTotal(res.data.total || 0);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [initialQuery, initialCategoryId]);

  const handleSortChange = (val: string) => {
    const newSort = val as SortValue;
    setSort(newSort);
    doSearch(undefined, undefined, newSort);
  };

  const handleCategoryChange = (id: string | null) => {
    setSelectedCategoryId(id);
    doSearch(undefined, id, undefined);
  };

  const clearFilters = () => {
    setSelectedCategoryId(null);
    setSort('latest');
    doSearch(undefined, null, 'latest');
  };

  const hasActiveFilters = !!selectedCategoryId || sort !== 'latest';

  const FilterControls = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col gap-3 ${mobile ? '' : 'sm:flex-row sm:items-center sm:gap-4'}`}>
      {/* 分类标签 */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => handleCategoryChange(null)}
          className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            !selectedCategoryId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          全部
        </button>
        {categories.slice(0, 10).map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(selectedCategoryId === cat.id ? null : cat.id)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedCategoryId === cat.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {CATEGORY_EMOJI_MAP[cat.name] || ''} {cat.name}
          </button>
        ))}
      </div>
      {/* 排序下拉 */}
      <Select value={sort} onValueChange={handleSortChange}>
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <main className="flex-1 pt-20 pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 搜索输入 */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h1 className="text-xl font-bold mb-4">搜索作品</h1>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入关键词搜索摄影作品..."
                className="pl-9 h-10"
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                autoFocus
              />
            </div>
            <Button onClick={() => doSearch()} disabled={loading} className="rounded-full px-6">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <SearchIcon className="h-4 w-4 mr-2" />}
              搜索
            </Button>
          </div>
        </div>

        {/* 筛选区 - 桌面 */}
        {searched && (
          <div className="mb-4 hidden sm:block">
            <FilterControls />
          </div>
        )}

        {/* 筛选区 - 移动端 Sheet */}
        {searched && (
          <div className="mb-4 sm:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  筛选
                  {hasActiveFilters && <Badge className="ml-1 h-4 w-4 p-0 text-[10px] justify-center">!</Badge>}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-xl">
                <SheetHeader>
                  <SheetTitle>筛选条件</SheetTitle>
                </SheetHeader>
                <div className="py-4">
                  <FilterControls mobile />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        )}

        {/* 活跃筛选标记 */}
        {searched && hasActiveFilters && (
          <div className="flex items-center gap-2 mb-4">
            {selectedCategoryId && (
              <Badge variant="secondary" className="gap-1">
                {categories.find(c => c.id === selectedCategoryId)?.name || '分类'}
                <button onClick={() => handleCategoryChange(null)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {sort !== 'latest' && (
              <Badge variant="secondary" className="gap-1">
                {SORT_OPTIONS.find(o => o.value === sort)?.label}
                <button onClick={() => handleSortChange('latest')} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              清除全部
            </button>
          </div>
        )}

        {/* 结果 */}
        <AnimatePresence mode="wait">
          {searched && (
            <motion.div
              key={`${query}-${selectedCategoryId}-${sort}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-sm text-muted-foreground mb-4">
                {loading ? '搜索中...' : `找到 ${total} 个结果`}
              </p>
              {works.length > 0 ? (
                <WorkGrid works={works} loading={loading} />
              ) : !loading && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Camera className="w-16 h-16 text-muted-foreground/30 mb-4" />
                  <h2 className="text-lg font-medium text-muted-foreground">未找到相关作品</h2>
                  <p className="text-sm text-muted-foreground mt-1">试试其他关键词或清除筛选条件</p>
                  <div className="flex flex-wrap gap-2 mt-4 justify-center">
                    {SEARCH_HOT_SUGGESTIONS.slice(0, 4).map((term) => (
                      <button
                        key={term}
                        onClick={() => { setQuery(term); doSearch(term); }}
                        className="px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground hover:bg-accent transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                      清除筛选
                    </Button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 空搜索引导 */}
        {!searched && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium text-muted-foreground">搜索摄影作品</h2>
            <p className="text-sm text-muted-foreground mt-1">输入关键词开始搜索</p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {SEARCH_HOT_SUGGESTIONS.slice(0, 6).map((term) => (
                <button
                  key={term}
                  onClick={() => { setQuery(term); doSearch(term); }}
                  className="px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground hover:bg-accent transition-colors"
                >
                  {CATEGORY_EMOJI_MAP[term] || ''} {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Suspense fallback={
        <main className="flex-1 pt-20 pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="glass rounded-2xl p-6 mb-8">
              <div className="h-8 bg-muted rounded w-32 mb-4" />
              <div className="h-10 bg-muted rounded" />
            </div>
          </div>
        </main>
      }>
        <SearchContent />
      </Suspense>
      <Footer />
    </div>
  );
}
