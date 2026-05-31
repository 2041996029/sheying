'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useConfigStore } from '@/stores/config-store';
import { DEFAULT_THEME_PRESET, type ThemePresetId } from '@/lib/theme-presets';

const PRESET_STORAGE_KEY = 'theme-preset';

/**
 * 主题初始化组件
 *
 * 逻辑：
 * 1. 后台配置 display_dark_mode (auto/light/dark) 控制全站默认明暗模式
 * 2. 后台配置 display_theme_preset 控制全站默认主题预设
 * 3. 用户手动切换后，选择保存在 localStorage，优先级高于管理员默认值
 * 4. 如果用户从未手动选择过，则使用管理员配置的默认值
 */
export function ThemeInit() {
  const { setTheme } = useTheme();
  const { configs, isLoaded, fetchConfigs } = useConfigStore();

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  useEffect(() => {
    if (!isLoaded) return;

    // === 主题预设 ===
    const userPreset = localStorage.getItem(PRESET_STORAGE_KEY) as ThemePresetId | null;
    const targetPreset = userPreset || (configs.display_theme_preset as ThemePresetId) || DEFAULT_THEME_PRESET;

    const html = document.documentElement;
    if (targetPreset === DEFAULT_THEME_PRESET) {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', targetPreset);
    }

    // === 明暗模式 ===
    const userTheme = localStorage.getItem('theme');
    if (!userTheme) {
      // 用户从未手动选择，使用管理员配置
      const adminDefault = configs.display_dark_mode || 'auto';
      if (adminDefault === 'auto') {
        setTheme('system');
      } else {
        setTheme(adminDefault);
      }
    }
  }, [isLoaded, configs.display_dark_mode, configs.display_theme_preset, setTheme]);

  return null;
}
