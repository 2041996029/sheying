// 配置状态管理
import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';

export interface SiteConfig {
  site_name?: string;
  site_description?: string;
  site_keywords?: string;
  site_logo?: string;
  site_favicon?: string;
  site_hero_image?: string;
  site_hero_title?: string;
  site_hero_subtitle?: string;
  about_content?: string;
  about_eyebrow?: string;
  about_title?: string;
  about_milestones?: string;
  social_wechat?: string;
  social_qr_wechat?: string;
  social_qq?: string;
  social_qr_qq?: string;
  social_email?: string;
  display_dark_mode?: string;
  display_theme_preset?: string;
  booking_intro?: string;
  booking_price?: string;
  booking_notice?: string;
  booking_content?: string;
  [key: string]: string | undefined;
}

interface ConfigState {
  configs: SiteConfig;
  isLoaded: boolean;
  fetchConfigs: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  configs: {},
  isLoaded: false,

  fetchConfigs: async () => {
    if (get().isLoaded) return;
    try {
      const result = await apiClient.get<SiteConfig>('/configs/public');
      if (result.code === 0 && result.data) {
        set({ configs: result.data, isLoaded: true });
      }
    } catch {
      // Ignore config errors
    }
  },
}));
