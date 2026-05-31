'use client';

import { useConfigStore } from '@/stores/config-store';

export function Footer() {
  const { configs } = useConfigStore();
  // fetchConfigs 已在 Header 中统一调用（store 有 isLoaded 守卫），此处无需重复调用

  const siteName = configs.site_name || '光影集';

  return (
    <footer className="py-6 text-center">
      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} <span className="font-serif font-medium">{siteName}</span>
      </p>
    </footer>
  );
}
