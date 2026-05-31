'use client';

import { useRef, useEffect } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CategoryItem {
  id: string;
  name: string;
  workCount?: number;
}

interface CategoryFilterProps {
  categories: CategoryItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryFilter({ categories, selectedId, onSelect }: CategoryFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to selected category
    if (selectedId && scrollRef.current) {
      const btn = scrollRef.current.querySelector(`[data-category-id="${selectedId}"]`);
      if (btn) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedId]);

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div ref={scrollRef} className="flex gap-2 pb-2">
        <Button
          variant={selectedId === null ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'rounded-full text-xs h-8 shrink-0 transition-all',
            selectedId === null && 'bg-primary text-primary-foreground shadow-sm'
          )}
          onClick={() => onSelect(null)}
        >
          全部
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={selectedId === cat.id ? 'default' : 'outline'}
            size="sm"
            data-category-id={cat.id}
            className={cn(
              'rounded-full text-xs h-8 shrink-0 transition-all',
              selectedId === cat.id && 'bg-primary text-primary-foreground shadow-sm'
            )}
            onClick={() => onSelect(cat.id)}
          >
            {cat.name}
            {cat.workCount !== undefined && (
              <span className="ml-1 text-[10px] opacity-60">{cat.workCount}</span>
            )}
          </Button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
