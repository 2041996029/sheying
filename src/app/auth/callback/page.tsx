'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchProfile } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('正在处理第三方登录...');

  useEffect(() => {
    const handleCallback = async () => {
      const type = searchParams.get('type');
      const code = searchParams.get('code');

      if (!type || !code) {
        setStatus('error');
        setMessage('缺少登录参数，请重新登录');
        return;
      }

      try {
        const res = await apiClient.get<{
          access_token: string;
          refresh_token: string;
          user: { id: string; email: string; nickname: string; role: string; avatarUrl: string | null };
          provider: string;
          isNewUser: boolean;
        }>(`/auth/social/callback?type=${encodeURIComponent(type)}&code=${encodeURIComponent(code)}`);

        if (res.code === 0 && res.data) {
          // 存储 token
          apiClient.setTokens(res.data.access_token, res.data.refresh_token);

          // 更新用户状态
          await fetchProfile();

          setStatus('success');
          setMessage(res.data.isNewUser ? '注册成功，欢迎加入！' : '登录成功');

          // 延迟跳转首页
          setTimeout(() => {
            router.push('/');
          }, 1500);
        } else {
          setStatus('error');
          setMessage(res.message || '第三方登录失败');
        }
      } catch {
        setStatus('error');
        setMessage('登录过程中出现错误，请重试');
      }
    };

    handleCallback();
  }, [searchParams, router, fetchProfile]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="h-8 w-8 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-foreground">{message}</p>
            <p className="text-xs text-muted-foreground">正在跳转...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="h-8 w-8 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <svg className="h-5 w-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm text-destructive">{message}</p>
            <button
              onClick={() => router.push('/login')}
              className="text-sm text-primary hover:underline"
            >
              返回登录
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">正在处理第三方登录...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
