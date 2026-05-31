'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, setTokens } from '@/lib/admin-api';
import { useAdminStore } from '@/stores/admin-store';
import { useConfigStore } from '@/stores/config-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAdminStore();
  const { configs, fetchConfigs } = useConfigStore();
  const siteName = configs.site_name || '光影集';

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  // Admin 登录页强制 classic 主题
  useEffect(() => {
    document.documentElement.removeAttribute('data-theme');
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('请填写邮箱和密码');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      setTokens(res.access_token, res.refresh_token);
      login(res.user, res.access_token, res.refresh_token);
      toast.success('登录成功');
      router.push('/admin');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '登录失败';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Camera className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{siteName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">管理后台登录</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">
                邮箱
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="请输入邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                密码
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              登录
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
