'use client';

import { useState, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Trash2, Loader2, Mail, User as UserIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  userId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  status: string;
  authorName: string;
  authorEmail: string | null;
  authorAvatar: string | null;
  user: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
  } | null;
}

interface CommentListProps {
  workId: string;
}

export function CommentList({ workId }: CommentListProps) {
  const { user, isAuthenticated } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState('');
  // 游客信息
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  const fetchComments = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ list: Comment[]; total: number; page: number; page_size: number }>(
        `/comments?work_id=${workId}&page=${p}&page_size=20`
      );
      if (res.code === 0 && res.data) {
        if (p === 1) {
          setComments(res.data.list);
        } else {
          setComments((prev) => [...prev, ...res.data.list]);
        }
        setTotal(res.data.total);
        setPage(p);
      }
    } catch {
      // Ignore
    }
    setLoading(false);
  }, [workId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<{ list: Comment[]; total: number; page: number; page_size: number }>(
          `/comments?work_id=${workId}&page=1&page_size=20`
        );
        if (!cancelled && res.code === 0 && res.data) {
          setComments(res.data.list);
          setTotal(res.data.total);
          setPage(1);
        }
      } catch {
        // Ignore
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [workId]);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error('请输入评论内容');
      return;
    }
    // 未登录用户必须填写昵称和邮箱
    if (!isAuthenticated && (!guestName.trim() || !guestEmail.trim())) {
      toast.error('请填写昵称和邮箱');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, string> = {
        work_id: workId,
        content: content.trim(),
      };
      if (!isAuthenticated) {
        payload.guest_name = guestName.trim();
        payload.guest_email = guestEmail.trim();
      }
      const res = await apiClient.post('/comments', payload);
      if (res.code === 0) {
        toast.success(res.message || '评论成功');
        setContent('');
        fetchComments(1);
      } else {
        toast.error(res.message || '评论失败');
      }
    } catch {
      toast.error('评论失败');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    try {
      let url = `/comments/${id}`;
      // 游客删除评论需要带上邮箱验证
      if (!isAuthenticated) {
        const comment = comments.find(c => c.id === id);
        if (comment?.guestEmail) {
          url += `?guest_email=${encodeURIComponent(comment.guestEmail)}`;
        }
      }
      const res = await apiClient.delete(url);
      if (res.code === 0) {
        toast.success('删除成功');
        setComments((prev) => prev.filter((c) => c.id !== id));
        setTotal((prev) => prev - 1);
      } else {
        toast.error(res.message || '删除失败');
      }
    } catch {
      toast.error('删除失败');
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: zhCN });
    } catch {
      return dateStr;
    }
  };

  // 判断当前用户是否可以删除该评论
  const canDelete = (comment: Comment) => {
    if (isAuthenticated && user) {
      // 管理员可删除任何评论，普通用户只能删自己的
      return user.role === 'admin' || user.role === 'super_admin' || (comment.userId && comment.userId === user.id);
    }
    // 游客只能删除自己通过邮箱验证的评论
    return !comment.userId && comment.guestEmail !== null;
  };

  return (
    <div className="space-y-4">
      {/* Comment Input */}
      <div className="glass-subtle rounded-xl p-4">
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={isAuthenticated ? (user?.avatarUrl || undefined) : undefined} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {isAuthenticated ? (user?.nickname || '用')?.charAt(0) : (guestName?.charAt(0) || '?')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            {/* 游客输入昵称和邮箱 */}
            {!isAuthenticated && (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <UserIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="昵称"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <div className="relative flex-[2]">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="邮箱（不会公开显示）"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>
            )}
            <Textarea
              placeholder={isAuthenticated ? '写下你的评论...' : '写下你的评论（请先填写昵称和邮箱）'}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[60px] resize-none text-sm"
              rows={2}
            />
            <div className="flex justify-between items-center">
              {!isAuthenticated && (
                <span className="text-[10px] text-muted-foreground">评论需审核后才会显示</span>
              )}
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || !content.trim() || (!isAuthenticated && (!guestName.trim() || !guestEmail.trim()))}
                className="h-8 text-xs"
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                发送
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Comment List */}
      <div className="space-y-3">
        {loading && comments.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 group">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={comment.authorAvatar || undefined} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {(comment.authorName || '匿')?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{comment.authorName || '匿名用户'}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTime(comment.createdAt)}</span>
                  {comment.status === 'pending' && (
                    <span className="text-[10px] text-warm bg-warm/15 px-1.5 py-0.5 rounded">待审核</span>
                  )}
                </div>
                <p className="text-sm text-foreground/90 mt-0.5 break-words">{comment.content}</p>
                {canDelete(comment) && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-[10px] text-muted-foreground hover:text-destructive mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="删除评论"
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {comments.length < total && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchComments(page + 1)}
            disabled={loading}
            className="text-xs"
          >
            {loading ? '加载中...' : '加载更多评论'}
          </Button>
        </div>
      )}

      {!loading && comments.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          还没有评论，来说两句吧~
        </div>
      )}
    </div>
  );
}
