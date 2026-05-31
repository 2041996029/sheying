'use client';

import { useEffect, useState, useCallback } from 'react';
import { commentsApi, type CommentItem } from '@/lib/admin-api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'bg-amber-100 text-amber-700' },
  approved: { label: '已通过', color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-700' },
};

export default function CommentsPage() {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await commentsApi.list({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setComments(data.list);
      setTotal(data.total);
    } catch {
      toast.error('获取评论列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, search]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const totalPages = Math.ceil(total / pageSize);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === comments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(comments.map((c) => c.id)));
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await commentsApi.updateStatus(id, status);
      toast.success('更新成功');
      loadComments();
    } catch {
      toast.error('操作失败');
    }
  };

  const handleToggleVisibility = async (id: string, isVisible: boolean) => {
    try {
      await commentsApi.updateStatus(id, undefined as unknown as string, !isVisible);
      toast.success(isVisible ? '已隐藏' : '已显示');
      loadComments();
    } catch {
      toast.error('操作失败');
    }
  };

  const handleBatchAction = async (action: 'approved' | 'rejected') => {
    if (selectedIds.size === 0) {
      toast.error('请选择评论');
      return;
    }
    try {
      for (const id of selectedIds) {
        await commentsApi.updateStatus(id, action);
      }
      toast.success(`批量${action === 'approved' ? '通过' : '拒绝'}成功`);
      setSelectedIds(new Set());
      loadComments();
    } catch {
      toast.error('批量操作失败');
    }
  };

  const handleDeleteComment = async () => {
    if (!deleteId) return;
    try {
      await commentsApi.delete(deleteId);
      toast.success('删除成功');
      setDeleteId(null);
      loadComments();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('请选择评论');
      return;
    }
    try {
      for (const id of selectedIds) {
        await commentsApi.delete(id);
      }
      toast.success(`批量删除 ${selectedIds.size} 条评论成功`);
      setSelectedIds(new Set());
      loadComments();
    } catch {
      toast.error('批量删除失败');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">评论管理</h1>
        <p className="text-sm text-stone-500">审核和管理用户评论</p>
      </div>

      {/* Filters */}
      <Card className="border-stone-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                placeholder="搜索评论内容..."
                className="pl-9 border-stone-200"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[130px] border-stone-200">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待审核</SelectItem>
                <SelectItem value="approved">已通过</SelectItem>
                <SelectItem value="rejected">已拒绝</SelectItem>
              </SelectContent>
            </Select>
            {selectedIds.size > 0 && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => handleBatchAction('approved')}
                >
                  <CheckCircle className="mr-1 h-3.5 w-3.5" />
                  批量通过 ({selectedIds.size})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => handleBatchAction('rejected')}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  批量拒绝 ({selectedIds.size})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  onClick={handleBatchDelete}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  批量删除 ({selectedIds.size})
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-stone-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="py-12 text-center text-sm text-stone-400">暂无评论数据</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={selectedIds.size === comments.length && comments.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>作品</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead className="max-w-[300px]">内容</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>可见</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comments.map((comment) => (
                    <TableRow key={comment.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(comment.id)}
                          onCheckedChange={() => toggleSelect(comment.id)}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-stone-600 max-w-[120px] truncate">
                        {comment.work?.title || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-stone-800">
                        <div>
                          {comment.user?.nickname || comment.guestName || '匿名'}
                          {comment.guestEmail && (
                            <div className="text-xs text-stone-400">{comment.guestEmail}</div>
                          )}
                          {!comment.userId && comment.guestName && (
                            <Badge className="text-[10px] bg-blue-50 text-blue-600 ml-1 px-1 py-0">游客</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm text-stone-600">
                        {comment.content}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${statusMap[comment.status]?.color || 'bg-stone-100'}`}>
                          {statusMap[comment.status]?.label || comment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {comment.isVisible ? (
                          <Eye className="h-4 w-4 text-stone-500" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-stone-300" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-stone-400 whitespace-nowrap">
                        {formatDate(comment.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {comment.status !== 'approved' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-600"
                              onClick={() => handleStatusUpdate(comment.id, 'approved')}
                              title="通过"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {comment.status !== 'rejected' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500"
                              onClick={() => handleStatusUpdate(comment.id, 'rejected')}
                              title="拒绝"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleToggleVisibility(comment.id, comment.isVisible)}
                            title={comment.isVisible ? '隐藏' : '显示'}
                          >
                            {comment.isVisible ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600"
                            onClick={() => setDeleteId(comment.id)}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-stone-500">
            共 {total} 条，第 {page}/{totalPages} 页
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="border-stone-200"
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="border-stone-200"
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条评论吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteComment} className="bg-red-500 hover:bg-red-600">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
