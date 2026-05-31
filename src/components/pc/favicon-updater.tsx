'use client';

import { useEffect } from 'react';
import { useConfigStore } from '@/stores/config-store';

const FAVICON_CACHE_KEY = 'site_favicon_cache';

function setFavicon(url: string) {
  if (!url) return;

  // 移除已有的动态 favicon link 标签
  const existingLinks = document.querySelectorAll('link[data-dynamic-favicon]');
  existingLinks.forEach((link) => link.remove());

  // 创建新的 favicon link
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png'; // 默认 png，浏览器会自动适应
  link.href = url;
  link.setAttribute('data-dynamic-favicon', 'true');
  document.head.appendChild(link);

  // 也设置 shortcut icon
  const shortcutLink = document.createElement('link');
  shortcutLink.rel = 'shortcut icon';
  shortcutLink.type = 'image/png';
  shortcutLink.href = url;
  shortcutLink.setAttribute('data-dynamic-favicon', 'true');
  document.head.appendChild(shortcutLink);

  // 缓存到 localStorage
  try {
    localStorage.setItem(FAVICON_CACHE_KEY, url);
  } catch {
    // Ignore localStorage errors
  }
}

function clearDynamicFavicons() {
  const existingLinks = document.querySelectorAll('link[data-dynamic-favicon]');
  existingLinks.forEach((link) => link.remove());
}

export function FaviconUpdater() {
  const { configs, isLoaded } = useConfigStore();
  // fetchConfigs 已在 ThemeInit 中统一调用（store 有 isLoaded 守卫），此处无需重复调用

  useEffect(() => {
    // 优先使用 site_favicon，其次使用 site_logo
    const faviconUrl = configs.site_favicon || configs.site_logo;

    if (faviconUrl) {
      setFavicon(faviconUrl);
    } else if (isLoaded) {
      // 配置已加载但没有设置 favicon/logo，清除动态 favicon
      clearDynamicFavicons();
    } else {
      // 配置还未加载，尝试从缓存恢复
      try {
        const cached = localStorage.getItem(FAVICON_CACHE_KEY);
        if (cached) {
          setFavicon(cached);
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [configs.site_favicon, configs.site_logo, isLoaded]);

  return null;
}
