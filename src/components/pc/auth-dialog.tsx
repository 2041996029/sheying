'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Mail, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/auth-store';
import { useConfigStore } from '@/stores/config-store';
import { SocialLoginButtons } from '@/components/pc/social-login-buttons';
import { toast } from 'sonner';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const router = useRouter();
  const { login, register, sendCode, isLoading } = useAuthStore();
  const { configs } = useConfigStore();
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
      onOpenChange(false);
      resetForm();
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
      onOpenChange(false);
      resetForm();
    } else {
      setError(result.message);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setNickname('');
    setCode('');
    setError('');
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(0);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="glass-strong sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">
          {tab === 'login' ? '登录' : '注册'}
        </DialogTitle>

        {/* Background decoration */}
        <div className="relative h-28 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold">{siteName}</h2>
            <p className="text-xs text-muted-foreground mt-1">记录光影之美</p>
          </div>
        </div>

        <div className="p-6">
          <Tabs value={tab} onValueChange={(v) => { setTab(v as 'login' | 'register'); setError(''); }}>
            <TabsList className="w-full mb-4">
              <TabsTrigger value="login" className="flex-1">登录</TabsTrigger>
              <TabsTrigger value="register" className="flex-1">注册</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-3 mt-0">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs">邮箱</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="请输入邮箱"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-xs">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-password"
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

            <TabsContent value="register" className="space-y-3 mt-0">
              <div className="space-y-1.5">
                <Label htmlFor="reg-nickname" className="text-xs">昵称</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-nickname"
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
      </DialogContent>
    </Dialog>
  );
}
