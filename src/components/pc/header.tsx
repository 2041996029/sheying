'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Camera, Search, User, LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from './theme-toggle';
import { ThemePresetPicker } from './theme-preset-picker';
import { SearchDialog } from './search-dialog';
import { useAuthStore } from '@/stores/auth-store';
import { useConfigStore } from '@/stores/config-store';

const navLinks = [
  { href: '/', label: '首页' },
  { href: '/category', label: '分类' },
  { href: '/booking', label: '约拍' },
  { href: '/map', label: '足迹' },
  { href: '/changelog', label: '更新' },
  { href: '/about', label: '关于' },
];

export function Header() {
  const router = useRouter();
  const { user, isAuthenticated, logout, initAuth } = useAuthStore();
  const { configs, fetchConfigs } = useConfigStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const siteName = configs.site_name || '光影集';

  useEffect(() => {
    initAuth();
    fetchConfigs();
  }, [initAuth, fetchConfigs]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > 10);
          ticking = false;
        });
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 h-16 transition-colors duration-300 ${
          scrolled
            ? 'glass-strong shadow-sm'
            : 'bg-background/85 backdrop-blur-xl border-b border-border/40'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-1.5 group">
              {configs.site_logo ? (
                <Image
                  src={configs.site_logo}
                  alt={siteName}
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain rounded"
                  onError={() => {
                    const el = document.getElementById('site-logo-img');
                    if (el) el.style.display = 'none';
                    const fallback = document.getElementById('site-logo-fallback');
                    if (fallback) fallback.classList.remove('hidden');
                  }}
                  id="site-logo-img"
                  unoptimized
                />
              ) : null}
              <div id="site-logo-fallback" className={`w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors ${configs.site_logo ? 'hidden' : ''}`}>
                <Camera className="h-5 w-5 text-primary" />
              </div>
              <span className="text-lg font-serif font-semibold tracking-tight">
                {siteName}
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent/50 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full hover:bg-accent"
                onClick={() => setSearchOpen(true)}
                aria-label="搜索"
              >
                <Search className="h-4 w-4" />
              </Button>

              <ThemeToggle />

              <ThemePresetPicker />

              {isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-9 w-9 rounded-full p-0 ml-1">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatarUrl || undefined} alt={user.nickname || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {(user.nickname || user.email)?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-strong w-48">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{user.nickname || '用户'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/user')}>
                      <User className="mr-2 h-4 w-4" />
                      个人中心
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      退出登录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full hover:bg-accent ml-1"
                  onClick={() => router.push('/login')}
                  aria-label="登录"
                >
                  <User className="h-4 w-4" />
                </Button>
              )}

              {/* Mobile menu toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full md:hidden hover:bg-accent"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="菜单"
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Mobile Nav */}
          {mobileMenuOpen && (
            <nav className="md:hidden pb-4 border-t border-border/50">
              <div className="flex flex-col gap-1 pt-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent/50 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </nav>
          )}
        </div>
      </header>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
