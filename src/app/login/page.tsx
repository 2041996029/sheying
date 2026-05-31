'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User as UserIcon, Loader2, Camera, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/auth-store';
import { useConfigStore } from '@/stores/config-store';
import { SocialLoginButtons } from '@/components/pc/social-login-buttons';
import { toast } from 'sonner';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { login, register, sendCode, isLoading } = useAuthStore();
  const { configs } = useConfigStore();
  // fetchConfigs 已在 ThemeInit 中统一调用，此处无需重复调用
  const siteName = configs.site_name || '光影集';
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  // 验证码倒计时
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // 组件卸载时清理倒计时定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleSendCode = async () => {
    if (!email) {
      setError('请先填写邮箱');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('邮箱格式不正确');
      return;
    }
    setError('');
    const result = await sendCode(email, 'register');
    if (result.success) {
      toast.success(result.message);
      startCountdown();
    } else {
      setError(result.message);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('请填写邮箱和密码');
      return;
    }
    setError('');
    const result = await login(email, password);
    if (result.success) {
      toast.success('登录成功');
      router.push('/');
    } else {
      setError(result.message);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !nickname || !code) {
      setError('请填写所有必填项');
      return;
    }
    if (password.length < 8) {
      setError('密码长度不能少于8位');
      return;
    }
    setError('');
    const result = await register(email, password, nickname, code);
    if (result.success) {
      toast.success('注册成功');
      router.push('/');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80"
          alt=""
          fill
          className="object-cover"
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 text-sm transition-colors">
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Link>

        <div className="glass rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="p-8 pb-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-3">
              <Camera className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">{siteName}</h1>
            <p className="text-white/70 text-sm mt-1">记录光影之美</p>
          </div>

          {/* Form */}
          <div className="glass-strong rounded-t-3xl p-6">
            <Tabs value={tab} onValueChange={(v) => { setTab(v as 'login' | 'register'); setError(''); }}>
              <TabsList className="w-full mb-5">
                <TabsTrigger value="login" className="flex-1">登录</TabsTrigger>
                <TabsTrigger value="register" className="flex-1">注册</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4 mt-0">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">邮箱</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="请输入邮箱"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 h-10"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs">密码</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="请输入密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 h-10"
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                </div>
                <Button
                  className="w-full h-10"
                  onClick={handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  登录
                </Button>
              </TabsContent>

              <TabsContent value="register" className="space-y-4 mt-0">
                <div className="space-y-1.5">
                  <Label htmlFor="nickname" className="text-xs">昵称</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="nickname"
                      placeholder="请输入昵称"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="pl-9 h-10"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email" className="text-xs">邮箱</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="请输入邮箱"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 h-10"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-code" className="text-xs">验证码</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="reg-code"
                        placeholder="请输入邮箱验证码"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="h-10"
                        maxLength={6}
                        onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 px-3 text-xs shrink-0 whitespace-nowrap"
                      onClick={handleSendCode}
                      disabled={countdown > 0 || isLoading}
                    >
                      {countdown > 0 ? `${countdown}s` : '获取验证码'}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password" className="text-xs">密码</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="请输入密码（至少8位）"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 h-10"
                      onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                    />
                  </div>
                </div>
                <Button
                  className="w-full h-10"
                  onClick={handleRegister}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  注册
                </Button>
              </TabsContent>
            </Tabs>

            {error && (
              <div className="mt-3 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs text-center">
                {error}
              </div>
            )}

            {/* 社交登录 */}
            <div className="mt-4">
              <SocialLoginButtons />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
