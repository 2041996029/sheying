'use client';

import { useEffect, useState, useCallback } from 'react';
import { auditApi, type AuditLogItem } from '@/lib/admin-api';
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
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { toast } from 'sonner';

const actionLabels: Record<string, string> = {
  create_work: '创建作品',
  update_work: '更新作品',
  delete_work: '删除作品',
  toggle_featured: '切换精选',
  ai_tag_trigger: '触发AI识别',
  create_category: '创建分类',
  update_category: '更新分类',
  delete_category: '删除分类',
  sort_categories: '排序分类',
  update_comment_status: '更新评论状态',
  update_config: '更新配置',
  clear_cache: '清空缓存',
  batch_recognize: '批量识别',
  batch_review_approve: '批量通过',
  batch_review_reject: '批量拒绝',
  update_booking_status: '更新留言状态',
};

const actionColors: Record<string, string> = {
  create_work: 'bg-emerald-100 text-emerald-700',
  update_work: 'bg-sky-100 text-sky-700',
  delete_work: 'bg-red-100 text-red-700',
  toggle_featured: 'bg-amber-100 text-amber-700',
  ai_tag_trigger: 'bg-violet-100 text-violet-700',
  create_category: 'bg-emerald-100 text-emerald-700',
  update_category: 'bg-sky-100 text-sky-700',
  delete_category: 'bg-red-100 text-red-700',
  sort_categories: 'bg-stone-100 text-stone-700',
  update_comment_status: 'bg-sky-100 text-sky-700',
  update_config: 'bg-amber-100 text-amber-700',
  clear_cache: 'bg-red-100 text-red-700',
  batch_recognize: 'bg-violet-100 text-violet-700',
  batch_review_approve: 'bg-emerald-100 text-emerald-700',
  batch_review_reject: 'bg-red-100 text-red-700',
  update_booking_status: 'bg-sky-100 text-sky-700',
};

const allActions = Object.keys(actionLabels);

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [detailLog, setDetailLog] = useState<AuditLogItem | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditApi.list({
        page,
        page_size: pageSize,
        action: actionFilter || undefined,
      });
      setLogs(data.list);
      setTotal(data.total);
    } catch {
      toast.error('获取审计日志失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const totalPages = Math.ceil(total / pageSize);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const parseDetail = (detail: string | null) => {
    if (!detail) return null;
    try {
      return JSON.parse(detail);
    } catch {
      return detail;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">审计日志</h1>
        <p className="text-sm text-stone-500">查看管理员操作记录</p>
      </div>

      {/* Filters */}
      <Card className="border-stone-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[180px] border-stone-200">
                <SelectValue placeholder="操作类型筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部操作</SelectItem>
                {allActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {actionLabels[action] || action}
                  </SelectItem>
                ))}
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
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-stone-400">暂无审计日志</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>管理员</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>目标类型</TableHead>
                    <TableHead>目标ID</TableHead>
                    <TableHead className="text-right">详情</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-stone-500 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-stone-700">
                        {log.admin?.nickname || log.admin?.email || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${actionColors[log.action] || 'bg-stone-100 text-stone-600'}`}>
                          {actionLabels[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-stone-500">
                        {log.targetType || '-'}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-stone-400 max-w-[120px] truncate">
                        {log.targetId || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {log.detail ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setDetailLog(log)}
                          >
                            <FileText className="mr-1 h-3.5 w-3.5" />
                            查看
                          </Button>
                        ) : (
                          <span className="text-xs text-stone-400">-</span>
                        )}
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
      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>操作详情</DialogTitle>
            <DialogDescription className="sr-only">查看操作审计日志详情</DialogDescription>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-3 py-4">
              <div>
                <p className="text-sm font-medium text-stone-500">操作</p>
                <p className="text-sm text-stone-800">
                  {actionLabels[detailLog.action] || detailLog.action}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-500">目标</p>
                <p className="text-sm text-stone-800">
                  {detailLog.targetType} / {detailLog.targetId}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-500">详情</p>
                <pre className="mt-1 rounded-lg bg-stone-50 p-3 text-xs font-mono text-stone-700 overflow-x-auto max-h-60 overflow-y-auto">
                  {JSON.stringify(parseDetail(detailLog.detail), null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-500">时间</p>
                <p className="text-sm text-stone-800">{formatDate(detailLog.createdAt)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
