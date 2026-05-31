'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Star, Clock, Trash2, Edit2, LogOut, Loader2, Camera } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Header } from '@/components/pc/header';
import { Footer } from '@/components/pc/footer';
import { WorkGrid, type WorkCardData } from '@/components/pc/work-grid';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

type TabKey = 'favorites' | 'likes' | 'history';

export default function UserPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, fetchProfile, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabKey>('favorites');
  const [works, setWorks] = useState<WorkCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingList, setLoadingList] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const authChecked = useRef(false);

  // 初始化认证：只在页面首次加载时调用一次fetchProfile
  useEffect(() => {
    if (!authChecked.current) {
      authChecked.current = true;
      fetchProfile();
    }
  }, [fetchProfile]);

  // 认证状态检查：只有确认未登录才跳转
  useEffect(() => {
    if (!isLoading && !isAuthenticated && authChecked.current) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // 映射API返回数据为WorkCardData
  const mapWorkData = useCallback((list: Record<string, unknown>[]): WorkCardData[] => {
    return list
      .filter((item) => item.work)
      .map((item) => {
        const work = item.work as Record<string, unknown>;
        return {
          id: (work.id || item.workId) as string,
          title: (work.title || '') as string,
          coverUrl: work.coverUrl as string | null,
          likeCount: (work.likeCount || 0) as number,
          viewCount: (work.viewCount || 0) as number,
        } as WorkCardData;
      });
  }, []);

  const fetchList = useCallback(async (tab: TabKey, p: number) => {
    setLoadingList(true);
    try {
      const endpoints: Record<TabKey, string> = {
        favorites: `/user/favorites?page=${p}&page_size=20`,
        likes: `/user/likes?page=${p}&page_size=20`,
        history: `/user/browse-history?page=${p}&page_size=20`,
      };
      const res = await apiClient.get<{ list: Record<string, unknown>[]; total: number }>(endpoints[tab]);
      if (res.code === 0 && res.data) {
        const mapped = mapWorkData(res.data.list || []);
        setWorks(mapped);
        setTotal(res.data.total);
        setPage(p);
      }
    } catch {
      // Ignore
    }
    setLoadingList(false);
  }, [mapWorkData]);

  useEffect(() => {
    if (isAuthenticated) {
      let cancelled = false;
      const load = async () => {
        setLoadingList(true);
        try {
          const endpoints: Record<TabKey, string> = {
            favorites: '/user/favorites?page=1&page_size=20',
            likes: '/user/likes?page=1&page_size=20',
            history: '/user/browse-history?page=1&page_size=20',
          };
          const res = await apiClient.get<{ list: Record<string, unknown>[]; total: number }>(endpoints[activeTab]);
          if (!cancelled && res.code === 0 && res.data) {
            const mapped = mapWorkData(res.data.list || []);
            setWorks(mapped);
            setTotal(res.data.total);
            setPage(1);
          }
        } catch {
          // Ignore
        }
        if (!cancelled) setLoadingList(false);
      };
      load();
      return () => { cancelled = true; };
    }
  }, [activeTab, isAuthenticated, mapWorkData]);

  const handleEditProfile = () => {
    if (user) {
      setEditNickname(user.nickname || '');
      setEditBio(user.bio || '');
      setEditOpen(true);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await apiClient.put('/user/profile', {
        nickname: editNickname,
        bio: editBio,
      });
      if (res.code === 0) {
        updateUser({ nickname: editNickname, bio: editBio });
        toast.success('更新成功');
        setEditOpen(false);
      } else {
        toast.error(res.message || '更新失败');
      }
    } catch {
      toast.error('更新失败');
    }
    setSaving(false);
  };

  const handleClearHistory = async () => {
    setClearing(true);
    try {
      const res = await apiClient.delete('/user/browse-history');
      if (res.code === 0) {
        toast.success('历史已清除');
        setWorks([]);
        setTotal(0);
        setPage(1);
        setClearConfirmOpen(false);
      } else {
        toast.error(res.message || '清除失败');
      }
    } catch {
      toast.error('清除失败');
    }
    setClearing(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 前端校验类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('仅支持 JPG/PNG/GIF/WebP 格式');
      return;
    }

    // 前端校验大小
    if (file.size > 5 * 1024 * 1024) {
      toast.error('头像文件不能超过 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const res = await apiClient.upload<{ url: string }>('/upload/avatar', file);
      if (res.code === 0 && res.data?.url) {
        updateUser({ avatarUrl: res.data.url });
        toast.success('头像更新成功');
      } else {
        toast.error(res.message || '头像上传失败');
      }
    } catch {
      toast.error('头像上传失败');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-20 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Profile Card */}
          <div className="glass rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user?.avatarUrl || undefined} />
                  <AvatarFallback className="text-lg bg-primary/10 text-primary">
                    {(user?.nickname || user?.email)?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {/* 头像上传遮罩 */}
                <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {uploadingAvatar ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    <Camera className="h-5 w-5 text-white" />
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  />
                </label>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold">{user?.nickname || '用户'}</h1>
                <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                {user?.bio && <p className="text-sm text-muted-foreground mt-1">{user.bio}</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleEditProfile} className="rounded-full">
                  <Edit2 className="h-3.5 w-3.5 mr-1" />
                  编辑
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="rounded-full text-destructive hover:text-destructive">
                  <LogOut className="h-3.5 w-3.5 mr-1" />
                  退出
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
            <div className="flex items-center justify-between mb-6">
              <TabsList>
                <TabsTrigger value="favorites" className="gap-1.5">
                  <Star className="h-3.5 w-3.5" />
                  收藏
                </TabsTrigger>
                <TabsTrigger value="likes" className="gap-1.5">
                  <Heart className="h-3.5 w-3.5" />
                  点赞
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  浏览历史
                </TabsTrigger>
              </TabsList>
              {activeTab === 'history' && total > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setClearConfirmOpen(true)} className="text-destructive text-xs">
                  <Trash2 className="h-3 w-3 mr-1" />
                  清除历史
                </Button>
              )}
            </div>

            <TabsContent value={activeTab} className="mt-0">
              <div className="mb-4 text-sm text-muted-foreground">
                共 {total} 项
              </div>
              <WorkGrid works={works} loading={loadingList} />
              {!loadingList && works.length > 0 && works.length < total && (
                <div className="flex justify-center mt-8">
                  <Button variant="outline" onClick={() => fetchList(activeTab, page + 1)} className="rounded-full">
                    加载更多
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="glass-strong sm:max-w-md">
          <DialogTitle>编辑个人资料</DialogTitle>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-nickname" className="text-xs">昵称</Label>
              <Input
                id="edit-nickname"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                placeholder="请输入昵称"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-bio" className="text-xs">简介</Label>
              <Textarea
                id="edit-bio"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="介绍一下自己吧"
                rows={3}
              />
            </div>
            <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear History Confirmation Dialog */}
      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent className="glass-strong sm:max-w-sm">
          <DialogTitle>确认清除浏览历史</DialogTitle>
          <DialogDescription className="mt-2">
            确定要清除所有浏览历史记录吗？此操作不可撤销。
          </DialogDescription>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setClearConfirmOpen(false)}
              disabled={clearing}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearHistory}
              disabled={clearing}
            >
              {clearing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              确认清除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
