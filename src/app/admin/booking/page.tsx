'use client';

import { useEffect, useState, useCallback } from 'react';
import { bookingApi, type ContactItem } from '@/lib/admin-api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  MailOpen,
  MailCheck,
  Eye,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

const statusMap: Record<string, { label: string; color: string; icon: typeof Mail }> = {
  pending: { label: '待处理', color: 'bg-amber-100 text-amber-700', icon: Mail },
  read: { label: '已读', color: 'bg-sky-100 text-sky-700', icon: MailOpen },
  replied: { label: '已回复', color: 'bg-emerald-100 text-emerald-700', icon: MailCheck },
};

export default function BookingPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [detailContact, setDetailContact] = useState<ContactItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bookingApi.list({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
      });
      setContacts(data.list);
      setTotal(data.total);
    } catch {
      toast.error('获取留言列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const totalPages = Math.ceil(total / pageSize);

  const handleMarkRead = async (id: string) => {
    try {
      await bookingApi.updateStatus(id, 'read');
      toast.success('已标记为已读');
      loadContacts();
    } catch {
      toast.error('操作失败');
    }
  };

  const handleMarkReplied = async (id: string) => {
    try {
      await bookingApi.updateStatus(id, 'replied');
      toast.success('已标记为已回复');
      loadContacts();
    } catch {
      toast.error('操作失败');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await bookingApi.delete(deleteId);
      toast.success('删除成功');
      setDeleteId(null);
      setDetailContact(null);
      loadContacts();
    } catch {
      toast.error('删除失败');
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
        <h1 className="text-2xl font-bold text-stone-800">约拍留言</h1>
        <p className="text-sm text-stone-500">查看和管理约拍咨询留言</p>
      </div>

      {/* Filters */}
      <Card className="border-stone-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[130px] border-stone-200">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待处理</SelectItem>
                <SelectItem value="read">已读</SelectItem>
                <SelectItem value="replied">已回复</SelectItem>
              </SelectContent>
            </Select>
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
          ) : contacts.length === 0 ? (
            <div className="py-12 text-center text-sm text-stone-400">暂无留言数据</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>电话</TableHead>
                    <TableHead className="max-w-[200px]">留言</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => {
                    const statusInfo = statusMap[contact.status] || statusMap.pending;
                    return (
                      <TableRow key={contact.id}>
                        <TableCell className="text-sm font-medium text-stone-800">
                          {contact.name || '匿名'}
                        </TableCell>
                        <TableCell className="text-sm text-stone-600">
                          {contact.email || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-stone-600">
                          {contact.phone || '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-stone-600">
                          {contact.message}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${statusInfo.color}`}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-stone-400 whitespace-nowrap">
                          {formatDate(contact.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDetailContact(contact)}
                              title="查看详情"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {contact.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-sky-600"
                                onClick={() => handleMarkRead(contact.id)}
                                title="标记已读"
                              >
                                <MailOpen className="h-4 w-4" />
                              </Button>
                            )}
                            {contact.status !== 'replied' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600"
                                onClick={() => handleMarkReplied(contact.id)}
                                title="标记已回复"
                              >
                                <MailCheck className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-600"
                              onClick={() => setDeleteId(contact.id)}
                              title="删除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
              <ChevronLeft className="h-4 w-4" /> 上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="border-stone-200"
            >
              下一页 <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailContact} onOpenChange={() => setDetailContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>留言详情</DialogTitle>
            <DialogDescription className="sr-only">查看约拍留言详情</DialogDescription>
          </DialogHeader>
          {detailContact && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-stone-500">姓名</p>
                  <p className="text-sm text-stone-800">{detailContact.name || '匿名'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-500">状态</p>
                  <Badge className={`text-xs ${statusMap[detailContact.status]?.color || 'bg-stone-100'}`}>
                    {statusMap[detailContact.status]?.label || detailContact.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-500">邮箱</p>
                  <p className="text-sm text-stone-800">{detailContact.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-500">电话</p>
                  <p className="text-sm text-stone-800">{detailContact.phone || '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-500">留言内容</p>
                <div className="mt-1 rounded-lg bg-stone-50 p-3 text-sm text-stone-700 whitespace-pre-wrap">
                  {detailContact.message}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-500">提交时间</p>
                <p className="text-sm text-stone-800">
                  {new Date(detailContact.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                {detailContact.status === 'pending' && (
                  <Button
                    onClick={() => {
                      handleMarkRead(detailContact.id);
                      setDetailContact(null);
                    }}
                    className="bg-sky-600 hover:bg-sky-700"
                  >
                    <MailOpen className="mr-2 h-4 w-4" />
                    标记已读
                  </Button>
                )}
                {detailContact.status !== 'replied' && (
                  <Button
                    onClick={() => {
                      handleMarkReplied(detailContact.id);
                      setDetailContact(null);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <MailCheck className="mr-2 h-4 w-4" />
                    标记已回复
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setDeleteId(detailContact.id);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条留言吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
