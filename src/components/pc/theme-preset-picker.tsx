'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { Paintbrush, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { THEME_PRESETS, type ThemePresetId, DEFAULT_THEME_PRESET } from '@/lib/theme-presets';

const STORAGE_KEY = 'theme-preset';

export function ThemePresetPicker() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [open, setOpen] = useState(false);

  // 读取当前主题预设
  const getCurrentPreset = (): ThemePresetId => {
    if (typeof window === 'undefined') return DEFAULT_THEME_PRESET;
    return (localStorage.getItem(STORAGE_KEY) as ThemePresetId) || DEFAULT_THEME_PRESET;
  };

  const [currentPreset, setCurrentPreset] = useState<ThemePresetId>(getCurrentPreset);

  const handleSelect = (presetId: ThemePresetId) => {
    setCurrentPreset(presetId);
    localStorage.setItem(STORAGE_KEY, presetId);
    // 应用主题
    const html = document.documentElement;
    if (presetId === DEFAULT_THEME_PRESET) {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', presetId);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full hover:bg-accent"
          aria-label="选择主题风格"
        >
          <Paintbrush className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3 rounded-xl glass-strong"
        align="end"
        sideOffset={8}
      >
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground px-1 mb-2">选择主题风格</p>
          {THEME_PRESETS.map((preset) => {
            const colors = isDark ? preset.darkColors : preset.lightColors;
            const isActive = currentPreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelect(preset.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                  isActive
                    ? 'bg-primary/10 ring-1 ring-primary/30'
                    : 'hover:bg-accent'
                }`}
              >
                {/* 色板预览 */}
                <div className="flex shrink-0">
                  {colors.map((color, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full border border-border/30 first:rounded-l-lg last:rounded-r-lg"
                      style={{
                        backgroundColor: color,
                        marginLeft: i > 0 ? '-1px' : '0',
                        zIndex: 4 - i,
                        position: 'relative',
                      }}
                    />
                  ))}
                </div>

                {/* 名称与描述 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{preset.name}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                    {preset.description}
                  </p>
                </div>

                {/* 选中标记 */}
                {isActive && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
