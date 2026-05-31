'use client';

import { useState, useCallback, useEffect } from 'react';
import { changelogApi, ChangelogItem } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  Bug,
  Wrench,
  Palette,
  FileText,
  RefreshCw,
  Rocket,
} from 'lucide-react';
import { toast } from 'sonner';

const typeMap: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  feature: { label: '新功能', color: 'bg-blue-100 text-blue-700', icon: Sparkles },
  fix: { label: '修复', color: 'bg-red-100 text-red-700', icon: Bug },
  optimize: { label: '优化', color: 'bg-green-100 text-green-700', icon: Wrench },
  style: { label: '样式', color: 'bg-purple-100 text-purple-700', icon: Palette },
  docs: { label: '文档', color: 'bg-amber-100 text-amber-700', icon: FileText },
  refactor: { label: '重构', color: 'bg-teal-100 text-teal-700', icon: RefreshCw },
};

const typeOptions = [
  { value: 'all', label: '全部类型' },
  { value: 'feature', label: '新功能' },
  { value: 'fix', label: '修复' },
  { value: 'optimize', label: '优化' },
  { value: 'style', label: '样式' },
  { value: 'docs', label: '文档' },
  { value: 'refactor', label: '重构' },
];

const publishedOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'true', label: '已发布' },
  { value: 'false', label: '未发布' },
];

export default function ChangelogPage() {
  const [logs, setLogs] = useState<ChangelogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [publishedFilter, setPublishedFilter] = useState('all');
  const [searchVersion, setSearchVersion] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState('feature');
  const [formPublished, setFormPublished] = useState(false);
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<ChangelogItem | null>(null);

  const totalPages = Math.ceil(total / pageSize);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await changelogApi.list({
        page,
        page_size: pageSize,
        type: typeFilter === 'all' ? undefined : typeFilter,
        is_published: publishedFilter === 'all' ? undefined : publishedFilter,
      });
      // 客户端搜索过滤版本号
      let filtered = res.list;
      if (searchVersion.trim()) {
        const keyword = searchVersion.trim().toLowerCase();
        filtered = filtered.filter(l => l.version.toLowerCase().includes(keyword) || l.title.toLowerCase().includes(keyword));
      }
      setLogs(filtered);
      setTotal(searchVersion.trim() ? filtered.length : res.total);
    } catch (err) {
      toast.error('加载版本记录失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, publishedFilter, searchVersion]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateDialog = () => {
    setEditingId(null);
    setFormVersion('');
    setFormTitle('');
    setFormContent('');
    setFormType('feature');
    setFormPublished(false);
    setFormSortOrder(0);
    setDialogOpen(true);
  };

  const openEditDialog = (item: ChangelogItem) => {
    setEditingId(item.id);
    setFormVersion(item.version);
    setFormTitle(item.title);
    setFormContent(item.content);
    setFormType(item.type);
    setFormPublished(item.isPublished);
    setFormSortOrder(item.sortOrder);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formVersion.trim() || !formTitle.trim() || !formContent.trim()) {
      toast.error('版本号、标题和内容不能为空');
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await changelogApi.update(editingId, {
          version: formVersion.trim(),
          title: formTitle.trim(),
          content: formContent.trim(),
          type: formType,
          is_published: formPublished,
          sort_order: formSortOrder,
        });
        toast.success('更新成功');
      } else {
        await changelogApi.create({
          version: formVersion.trim(),
          title: formTitle.trim(),
          content: formContent.trim(),
          type: formType,
          is_published: formPublished,
          sort_order: formSortOrder,
        });
        toast.success('创建成功');
      }
      setDialogOpen(false);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (item: ChangelogItem) => {
    try {
      await changelogApi.togglePublish(item.id, !item.isPublished);
      toast.success(item.isPublished ? '已取消发布' : '已发布');
      loadData();
    } catch {
      toast.error('操作失败');
    }
  };

  const handleDelete = async (item: ChangelogItem) => {
    if (!confirm(`确定要删除版本 ${item.version} 的记录吗？`)) return;
    try {
      await changelogApi.delete(item.id);
      toast.success('删除成功');
      loadData();
    } catch {
      toast.error('删除失败');
    }
  };

  const showDetail = (item: ChangelogItem) => {
    setDetailItem(item);
    setDetailOpen(true);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">更新日志</h1>
          <p className="text-sm text-stone-500 mt-1">管理版本更新记录，记录每次优化与更新内容</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          新增版本记录
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="类型筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="feature">新功能</SelectItem>
              <SelectItem value="fix">修复</SelectItem>
              <SelectItem value="optimize">优化</SelectItem>
              <SelectItem value="style">样式</SelectItem>
              <SelectItem value="docs">文档</SelectItem>
              <SelectItem value="refactor">重构</SelectItem>
            </SelectContent>
          </Select>

          <Select value={publishedFilter} onValueChange={(v) => { setPublishedFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="发布状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="true">已发布</SelectItem>
              <SelectItem value="false">未发布</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              placeholder="搜索版本号或标题..."
              value={searchVersion}
              onChange={(e) => { setSearchVersion(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">版本号</TableHead>
                <TableHead>标题</TableHead>
                <TableHead className="w-[90px]">类型</TableHead>
                <TableHead className="w-[90px]">状态</TableHead>
                <TableHead className="w-[90px]">排序</TableHead>
                <TableHead className="w-[160px]">创建时间</TableHead>
                <TableHead className="w-[160px]">发布时间</TableHead>
                <TableHead className="w-[160px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-stone-400">
                    暂无版本记录，点击右上角新增
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((item) => {
                  const typeInfo = typeMap[item.type] || typeMap.feature;
                  const TypeIcon = typeInfo.icon;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-mono font-semibold text-stone-800">v{item.version}</span>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => showDetail(item)}
                          className="text-left hover:text-primary transition-colors text-stone-700 line-clamp-1"
                        >
                          {item.title}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`${typeInfo.color} gap-1`}>
                          <TypeIcon className="h-3 w-3" />
                          {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.isPublished ? 'default' : 'outline'}>
                          {item.isPublished ? '已发布' : '未发布'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-stone-500">{item.sortOrder}</TableCell>
                      <TableCell className="text-stone-500 text-xs">{formatDate(item.createdAt)}</TableCell>
                      <TableCell className="text-stone-500 text-xs">{formatDate(item.publishedAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleTogglePublish(item)}
                            title={item.isPublished ? '取消发布' : '发布'}
                          >
                            {item.isPublished ? (
                              <EyeOff className="h-4 w-4 text-amber-500" />
                            ) : (
                              <Eye className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(item)}
                            title="编辑"
                          >
                            <Pencil className="h-4 w-4 text-stone-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item)}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3">
            <span className="text-sm text-stone-500">
              共 {total} 条，第 {page}/{totalPages || 1} 页
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              {editingId ? '编辑版本记录' : '新增版本记录'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700">版本号 *</label>
                <Input
                  placeholder="例如：1.2.0"
                  value={formVersion}
                  onChange={(e) => setFormVersion(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700">更新类型</label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.filter(o => o.value).map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">更新标题 *</label>
              <Input
                placeholder="一句话概括本次更新"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">更新内容 * <span className="text-stone-400 font-normal">（支持 Markdown 格式）</span></label>
              <Textarea
                placeholder={`## 新增\n- 新功能说明\n\n## 修复\n- 修复问题描述\n\n## 优化\n- 优化项说明`}
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700">排序权重</label>
                <Input
                  type="number"
                  placeholder="越大越靠前，默认0"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-end gap-3 pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formPublished}
                    onChange={(e) => setFormPublished(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-stone-700">立即发布</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : editingId ? '更新' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Badge variant="secondary" className={typeMap[detailItem?.type || 'feature']?.color || 'bg-blue-100 text-blue-700'}>
                {typeMap[detailItem?.type || 'feature']?.label || '新功能'}
              </Badge>
              <span className="font-mono">v{detailItem?.version}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-stone-800">{detailItem?.title}</h3>
            <div className="prose prose-sm max-w-none text-stone-600">
              <div className="whitespace-pre-wrap font-mono text-sm bg-stone-50 rounded-lg p-4 border border-stone-200">
                {detailItem?.content}
              </div>
            </div>
            <div className="flex gap-4 text-xs text-stone-400">
              <span>创建: {formatDate(detailItem?.createdAt || null)}</span>
              <span>发布: {formatDate(detailItem?.publishedAt || null)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
