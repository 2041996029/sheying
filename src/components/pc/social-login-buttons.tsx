'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface SocialProvider {
  type: string;
  name: string;
  icon: string;
}

// 图标映射 - 使用本地图片
const PROVIDER_ICON_MAP: Record<string, string> = {
  qq: '/social/qq.png',
  wx: '/social/wx.png',
  alipay: '/social/alipay.png',
  sina: '/social/sina.png',
  baidu: '/social/baidu.png',
  douyin: '/social/douyin.png',
  huawei: '/social/huawei.png',
  xiaomi: '/social/xiaomi.png',
  google: '/social/google.png',
  microsoft: '/social/microsoft.png',
  facebook: '/social/facebook.png',
  twitter: '/social/twitter.png',
  feishu: '/social/feishu.png',
  wework: '/social/wework.png',
  dingtalk: '/social/dingtalk.png',
  gitee: '/social/gitee.png',
  github: '/social/github.png',
};

export function SocialLoginButtons() {
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await apiClient.get<{ enabled: boolean; providers: SocialProvider[] }>('/auth/social/providers');
        if (res.code === 0 && res.data) {
          setEnabled(res.data.enabled);
          setProviders(res.data.providers || []);
        }
      } catch {
        // Ignore
      }
    };
    fetchProviders();
  }, []);

  if (!enabled || providers.length === 0) return null;

  const handleSocialLogin = async (type: string) => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ type: string; url: string; qrcode?: string }>(`/auth/social/redirect?type=${type}`);
      if (res.code === 0 && res.data?.url) {
        // 跳转到第三方登录页面
        window.location.href = res.data.url;
      }
    } catch {
      // Ignore
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">快捷登录</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        {providers.map((provider) => {
          const iconSrc = PROVIDER_ICON_MAP[provider.type];
          return (
            <Button
              key={provider.type}
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full p-0 overflow-hidden transition-all hover:opacity-80 hover:scale-105"
              onClick={() => handleSocialLogin(provider.type)}
              disabled={loading}
              title={provider.name + '登录'}
            >
              {iconSrc ? (
                <Image
                  src={iconSrc}
                  alt={provider.name}
                  width={28}
                  height={28}
                  className="rounded-full"
                />
              ) : (
                <span className="text-sm font-medium">{provider.name[0]}</span>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
