'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeProvider } from 'next-themes';
import { useAdminStore } from '@/stores/admin-store';
import { useConfigStore } from '@/stores/config-store';
import {
  LayoutDashboard,
  Image,
  FolderTree,
  MessageSquare,
  Tag,
  Settings,
  Activity,
  FileText,
  Mail,
  ExternalLink,
  LogOut,
  Menu,
  X,
  Camera,
  Users,
  Zap,
  Database,
  Rocket,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navItems = [
  { href: '/admin', label: '仪表盘', icon: LayoutDashboard },
  { href: '/admin/works', label: '作品管理', icon: Image },
  { href: '/admin/categories', label: '分类管理', icon: FolderTree },
  { href: '/admin/comments', label: '评论管理', icon: MessageSquare },
  { href: '/admin/users', label: '用户管理', icon: Users },
  { href: '/admin/ai-tags', label: 'AI标签', icon: Tag },
  { href: '/admin/ai-models', label: 'AI模型', icon: Zap },
  { href: '/admin/configs', label: '配置中心', icon: Settings },
  { href: '/admin/monitor', label: '系统监控', icon: Activity },
  { href: '/admin/cache', label: '缓存管理', icon: Database },
  { href: '/admin/audit', label: '审计日志', icon: FileText },
  { href: '/admin/booking', label: '约拍留言', icon: Mail },
  { href: '/admin/changelog', label: '更新日志', icon: Rocket },
  { href: '/admin/api-docs', label: 'API管理', icon: BookOpen },
];

function getStoredAuth() {
  if (typeof window === 'undefined') return { token: null, user: null };
  const token = localStorage.getItem('admin_access_token');
  const userStr = localStorage.getItem('admin_user');
  let user = null;
  if (userStr) {
    try { user = JSON.parse(userStr); } catch { /* ignore */ }
  }
  return { token, user };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrate, logout } = useAdminStore();
  const storeToken = useAdminStore((s) => s.token);
  const storeUser = useAdminStore((s) => s.user);
  const { configs, fetchConfigs } = useConfigStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [storedAuth, setStoredAuth] = useState<{ token: string | null; user: { nickname?: string; email?: string; role?: string; [key: string]: unknown } | null }>({ token: null, user: null });

  const siteName = configs.site_name || '光影集';

  // 当前有效的认证状态：优先使用 zustand store（登录时实时更新），否则用本地 state
  const effectiveToken = storeToken || storedAuth.token;
  const effectiveUser = storeUser || storedAuth.user;

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // Initialize from localStorage in useEffect to avoid SSR mismatch
  useEffect(() => {
    setStoredAuth(getStoredAuth());
    hydrate();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate hydration pattern
    setAuthChecked(true);
  }, [hydrate]);

  // Admin 强制亮色 + classic主题，移除 data-theme 以保证配色一致
  useEffect(() => {
    // 确保 admin 不受前端主题预设影响
    document.documentElement.removeAttribute('data-theme');
  }, []);

  // Don't apply layout to login page
  if (pathname === '/admin/login') {
    return (
      <ThemeProvider forcedTheme="light">
        {children}
      </ThemeProvider>
    );
  }

  // Wait for auth check
  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">加载中...</div>
      </div>
    );
  }

  // Auth guard
  if (!effectiveToken) {
    router.push('/admin/login');
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">跳转登录...</div>
      </div>
    );
  }

  const user = effectiveUser as { nickname?: string; email?: string; role?: string; [key: string]: unknown } | null;

  const handleLogout = () => {
    logout();
    router.push('/admin/login');
  };

  return (
    <ThemeProvider forcedTheme="light">
    <div className="flex h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <Camera className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold text-foreground">{siteName}</span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
            Admin
          </span>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href);
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    router.push(item.href);
                    setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <Separator className="my-4" />

          <button
            onClick={() => window.open('/', '_blank')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            返回前台
          </button>
        </ScrollArea>

        {/* User info at bottom */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {user?.nickname?.charAt(0) || 'A'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {user?.nickname || '管理员'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.email || ''}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="退出登录">
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {user?.nickname?.charAt(0) || 'A'}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline-block">
                  {user?.nickname || '管理员'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
    </ThemeProvider>
  );
}
