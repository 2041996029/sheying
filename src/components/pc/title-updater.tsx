'use client';

import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useConfigStore } from '@/stores/config-store';

const TITLE_CACHE_KEY = 'site_title_cache';

function updateTitle(siteName?: string, siteDescription?: string) {
  if (siteName) {
    const newTitle = siteDescription ? `${siteName} - ${siteDescription}` : siteName;
    document.title = newTitle;
    try {
      localStorage.setItem(TITLE_CACHE_KEY, newTitle);
    } catch {
      // Ignore localStorage errors
    }
  }
}

export function TitleUpdater() {
  const { configs } = useConfigStore();
  // fetchConfigs 已在 ThemeInit 中统一调用（store 有 isLoaded 守卫），此处无需重复调用
  const pathname = usePathname();

  // Apply the custom title whenever configs are loaded or the route changes.
  // Next.js client-side navigation resets document.title to the static metadata
  // value ("光影集"), so we must re-apply the dynamic title after every navigation.
  useLayoutEffect(() => {
    if (configs.site_name) {
      updateTitle(configs.site_name, configs.site_description);
    } else {
      // Config not loaded yet — restore from localStorage cache
      try {
        const cached = localStorage.getItem(TITLE_CACHE_KEY);
        if (cached) {
          document.title = cached;
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [configs.site_name, configs.site_description, pathname]);

  return null;
}
