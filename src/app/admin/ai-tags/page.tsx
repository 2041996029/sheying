'use client';

import { useEffect, useState, useCallback } from 'react';
import { aiTagsApi, worksApi, type AiTagItem, type WorkItem } from '@/lib/admin-api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle,
  XCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
  Zap,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

const auditStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'bg-amber-100 text-amber-700' },
  approved: { label: '已通过', color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-700' },
};

function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  let color = 'text-red-500';
  let bgColor = 'bg-red-100';
  if (pct >= 80) {
    color = 'text-emerald-600';
    bgColor = 'bg-emerald-100';
  } else if (pct >= 60) {
    color = 'text-amber-600';
    bgColor = 'bg-amber-100';
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${bgColor} ${color}`}>
      {pct}%
    </span>
  );
}

// 详情弹窗
function TagDetailDialog({ tag, open, onOpenChange }: { tag: AiTagItem | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  if (!tag) return null;
  const modelName = tag.aiModel
    ? (tag.aiModel.modelName ? `${tag.aiModel.name} (${tag.aiModel.modelName})` : tag.aiModel.name)
    : tag.rawResponse?.startsWith('[Mock]')
      ? 'Mock（未调用AI）'
      : tag.rawResponse
        ? '内置 AI（SDK兜底）'
        : '-';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>AI 标签识别详情</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-stone-400">作品</span>
              <p className="font-medium text-stone-800 mt-0.5">{tag.work?.title || '-'}</p>
            </div>
            <div>
              <span className="text-stone-400">标签名</span>
              <p className="mt-0.5"><Badge variant="secondary">{tag.tagName}</Badge></p>
            </div>
            <div>
              <span className="text-stone-400">置信度</span>
              <p className="mt-0.5"><ConfidenceIndicator confidence={tag.confidence} /></p>
            </div>
            <div>
              <span className="text-stone-400">识别时间</span>
              <p className="font-medium text-stone-800 mt-0.5">
                {new Date(tag.createdAt).toLocaleString('zh-CN')}
              </p>
            </div>
          </div>

          {/* 调用模型 */}
          <div className="rounded-lg border border-stone-200 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-stone-700">调用模型</span>
            </div>
            <p className="text-sm text-stone-600 bg-stone-50 rounded px-2 py-1.5 font-mono">{modelName}</p>
          </div>

          {/* 使用的提示词 */}
          {tag.usedPrompt ? (
            <div className="rounded-lg border border-stone-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-stone-700">使用的提示词</span>
              </div>
              <pre className="text-xs text-stone-600 bg-blue-50/50 rounded px-2 py-1.5 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">{tag.usedPrompt}</pre>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-stone-300 p-3 text-center">
              <span className="text-xs text-stone-400">该标签识别于功能升级前，未记录提示词</span>
            </div>
          )}

          {/* AI 原始返回 */}
          {tag.rawResponse ? (
            <div className="rounded-lg border border-stone-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <span className="text-sm font-medium text-stone-700">AI 原始返回</span>
              </div>
              <pre className="text-xs text-stone-600 bg-violet-50/50 rounded px-2 py-1.5 whitespace-pre-wrap break-all max-h-60 overflow-y-auto">{tag.rawResponse}</pre>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-stone-300 p-3 text-center">
              <span className="text-xs text-stone-400">该标签识别于功能升级前，未记录AI原始返回</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AiTagsPage() {
  const [tags, setTags] = useState<AiTagItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // 展开行
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 详情弹窗
  const [detailTag, setDetailTag] = useState<AiTagItem | null>(null);

  // Works for batch recognize
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(new Set());
  const [worksLoading, setWorksLoading] = useState(false);

  const loadTags = useCallback(async () => {
    setLoading(true);
    try {
      const auditStatus = activeTab === 'all' ? undefined : activeTab;
      const data = await aiTagsApi.list({
        page,
        page_size: pageSize,
        audit_status: auditStatus,
      });
      setTags(data.list);
      setTotal(data.total);
    } catch {
      toast.error('获取AI标签列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, activeTab]);

  const loadWorks = async () => {
    setWorksLoading(true);
    try {
      const data = await worksApi.list({ page: 1, page_size: 50 });
      setWorks(data.list);
    } catch {
      // ignore
    } finally {
      setWorksLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    loadWorks();
  }, []);

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
    if (selectedIds.size === tags.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tags.map((t) => t.id)));
    }
  };

  const handleBatchReview = async (action: 'approve' | 'reject') => {
    if (selectedIds.size === 0) {
      toast.error('请选择标签');
      return;
    }
    setBatchLoading(true);
    try {
      await aiTagsApi.batchReview(Array.from(selectedIds), action);
      toast.success(`批量${action === 'approve' ? '通过' : '拒绝'}成功`);
      setSelectedIds(new Set());
      loadTags();
    } catch {
      toast.error('批量审核失败');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('请选择标签');
      return;
    }
    setBatchLoading(true);
    try {
      const result = await aiTagsApi.batchDelete(Array.from(selectedIds));
      toast.success(`批量删除成功，共删除${result.count}条标签`);
      setSelectedIds(new Set());
      loadTags();
    } catch {
      toast.error('批量删除失败');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    setDeleteLoading(tagId);
    try {
      await aiTagsApi.delete(tagId);
      toast.success('标签删除成功');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(tagId);
        return next;
      });
      loadTags();
    } catch {
      toast.error('删除标签失败');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleBatchRecognize = async () => {
    if (selectedWorkIds.size === 0) {
      toast.error('请选择作品进行识别');
      return;
    }
    setBatchLoading(true);
    try {
      const res = await aiTagsApi.batchRecognize(Array.from(selectedWorkIds));
      const imgInfo = res.totalImages ? `，共${res.totalImages}张图片` : '';
      toast.success(`批量识别完成${imgInfo}: 成功 ${res.completedCount}, 失败 ${res.failedCount}`);
      setSelectedWorkIds(new Set());
      loadTags();
    } catch {
      toast.error('批量识别失败');
    } finally {
      setBatchLoading(false);
    }
  };

  const toggleWorkSelect = (id: string) => {
    setSelectedWorkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 获取模型显示名
  const getModelLabel = (tag: AiTagItem) => {
    if (tag.aiModel) {
      return tag.aiModel.modelName
        ? `${tag.aiModel.name} (${tag.aiModel.modelName})`
        : tag.aiModel.name;
    }
    // 无关联模型记录：检查 rawResponse 判断来源
    if (tag.rawResponse?.startsWith('[Mock]')) return 'Mock（未调用AI）';
    // modelId 为空但 rawResponse 有内容 → 内置SDK兜底
    if (!tag.modelId && tag.rawResponse) return '内置 AI（SDK兜底）';
    if (tag.modelId) return '已删除的模型';
    return '-';
  };

  // 兼容旧数据：查找同作品同时间兄弟标签的 rawResponse（旧数据只在第一个标签保存）
  const getRawResponseForTag = (tag: AiTagItem) => {
    if (tag.rawResponse) return tag.rawResponse;
    const tagTime = new Date(tag.createdAt).getTime();
    const sibling = tags.find(t =>
      t.id !== tag.id &&
      t.workId === tag.workId &&
      t.rawResponse &&
      Math.abs(new Date(t.createdAt).getTime() - tagTime) < 2000
    );
    return sibling?.rawResponse || null;
  };

  const getUsedPromptForTag = (tag: AiTagItem) => {
    if (tag.usedPrompt) return tag.usedPrompt;
    const tagTime = new Date(tag.createdAt).getTime();
    const sibling = tags.find(t =>
      t.id !== tag.id &&
      t.workId === tag.workId &&
      t.usedPrompt &&
      Math.abs(new Date(t.createdAt).getTime() - tagTime) < 2000
    );
    return sibling?.usedPrompt || null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">AI标签管理</h1>
          <p className="text-sm text-stone-500">管理和审核AI识别的标签</p>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={() => handleBatchReview('approve')}
              disabled={batchLoading}
            >
              {batchLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1 h-3.5 w-3.5" />}
              批量通过 ({selectedIds.size})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => handleBatchReview('reject')}
              disabled={batchLoading}
            >
              {batchLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
              批量拒绝 ({selectedIds.size})
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-stone-300 text-stone-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                  disabled={batchLoading}
                >
                  {batchLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                  批量删除 ({selectedIds.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认批量删除</AlertDialogTitle>
                  <AlertDialogDescription>
                    您确定要删除选中的 {selectedIds.size} 条标签吗？此操作不可撤销。
                    已通过审核的标签删除后，将同时从关联作品的标签列表中移除。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBatchDelete}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    确认删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); setSelectedIds(new Set()); }}>
        <TabsList className="bg-stone-100">
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="pending">待审核</TabsTrigger>
          <TabsTrigger value="approved">已通过</TabsTrigger>
          <TabsTrigger value="rejected">已拒绝</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          {/* Tags Table */}
          <Card className="border-stone-200">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : tags.length === 0 ? (
                <div className="py-12 text-center text-sm text-stone-400">暂无AI标签数据</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedIds.size === tags.length && tags.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>作品</TableHead>
                        <TableHead>标签名</TableHead>
                        <TableHead>调用模型</TableHead>
                        <TableHead>置信度</TableHead>
                        <TableHead>审核状态</TableHead>
                        <TableHead>时间</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tags.map((tag) => {
                        const isExpanded = expandedId === tag.id;
                        const rawResp = getRawResponseForTag(tag);
                        const usedPmt = getUsedPromptForTag(tag);

                        return (
                        <TableRow key={tag.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(tag.id)}
                              onCheckedChange={() => toggleSelect(tag.id)}
                            />
                          </TableCell>
                          <TableCell className="text-sm text-stone-600 max-w-[120px] truncate">
                            {tag.work?.title || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {tag.tagName}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-stone-500 font-mono max-w-[120px] inline-block truncate">
                              {getModelLabel(tag)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <ConfidenceIndicator confidence={tag.confidence} />
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${auditStatusMap[tag.auditStatus]?.color || 'bg-stone-100'}`}>
                              {auditStatusMap[tag.auditStatus]?.label || tag.auditStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-stone-400 whitespace-nowrap">
                            {new Date(tag.createdAt).toLocaleDateString('zh-CN')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-stone-400 hover:text-blue-600"
                                onClick={() => setExpandedId(isExpanded ? null : tag.id)}
                                title="展开详情"
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-stone-400 hover:text-blue-600"
                                onClick={() => setDetailTag(tag)}
                                title="查看完整详情"
                              >
                                <Sparkles className="h-4 w-4" />
                              </Button>
                              {tag.auditStatus !== 'approved' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-emerald-600"
                                  onClick={async () => {
                                    try {
                                      await aiTagsApi.batchReview([tag.id], 'approve');
                                      toast.success('已通过');
                                      loadTags();
                                    } catch { toast.error('操作失败'); }
                                  }}
                                  title="通过"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              {tag.auditStatus !== 'rejected' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500"
                                  onClick={async () => {
                                    try {
                                      await aiTagsApi.batchReview([tag.id], 'reject');
                                      toast.success('已拒绝');
                                      loadTags();
                                    } catch { toast.error('操作失败'); }
                                  }}
                                  title="拒绝"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-stone-400 hover:text-red-600 hover:bg-red-50"
                                    disabled={deleteLoading === tag.id}
                                    title="删除"
                                  >
                                    {deleteLoading === tag.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>确认删除标签</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      您确定要删除标签「{tag.tagName}」吗？此操作不可撤销。
                                      {tag.auditStatus === 'approved' && '该标签已通过审核，删除后将同时从关联作品的标签列表中移除。'}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteTag(tag.id)}
                                      className="bg-red-600 hover:bg-red-700 text-white"
                                    >
                                      确认删除
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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

          {/* Expanded detail rows */}
          {tags.filter(t => expandedId === t.id).map((tag) => {
            const rawResp = getRawResponseForTag(tag);
            const usedPmt = getUsedPromptForTag(tag);
            return (
              <Card key={`detail-${tag.id}`} className="border-blue-200 bg-blue-50/30">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-stone-700">
                      「{tag.tagName}」识别详情
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setExpandedId(null)} className="h-6 text-xs">
                      收起
                    </Button>
                  </div>

                  {/* 模型 */}
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-stone-500">模型：</span>
                    <span className="font-mono text-stone-700">{getModelLabel(tag)}</span>
                  </div>

                  {/* 提示词 */}
                  {usedPmt ? (
                    <div>
                      <div className="flex items-center gap-2 text-sm mb-1">
                        <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-stone-500">提示词：</span>
                      </div>
                      <pre className="text-xs text-stone-600 bg-white/60 rounded px-3 py-2 whitespace-pre-wrap break-all max-h-24 overflow-y-auto border border-stone-100">{usedPmt}</pre>
                    </div>
                  ) : (
                    <div className="text-xs text-stone-400 italic">未记录提示词（旧数据）</div>
                  )}

                  {/* AI 原始返回 */}
                  {rawResp ? (
                    <div>
                      <div className="flex items-center gap-2 text-sm mb-1">
                        <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                        <span className="text-stone-500">AI 原始返回：</span>
                      </div>
                      <pre className="text-xs text-stone-600 bg-white/60 rounded px-3 py-2 whitespace-pre-wrap break-all max-h-40 overflow-y-auto border border-stone-100">{rawResp}</pre>
                    </div>
                  ) : (
                    <div className="text-xs text-stone-400 italic">未记录AI原始返回（旧数据）</div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-stone-500">
                共 {total} 条，第 {page}/{totalPages} 页
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="border-stone-200">
                  <ChevronLeft className="h-4 w-4" /> 上一页
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="border-stone-200">
                  下一页 <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Batch Recognize Section */}
      <Card className="border-stone-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-stone-800">批量AI识别</h3>
              <p className="text-sm text-stone-500">选择作品触发AI标签识别（将上传作品所有图片进行识别）</p>
            </div>
            <Button
              onClick={handleBatchRecognize}
              disabled={batchLoading || selectedWorkIds.size === 0}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {batchLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              识别选中 ({selectedWorkIds.size})
            </Button>
          </div>

          {worksLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1">
              {works.map((work) => (
                <label
                  key={work.id}
                  className="flex items-center gap-3 rounded px-3 py-2 hover:bg-stone-50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedWorkIds.has(work.id)}
                    onCheckedChange={() => toggleWorkSelect(work.id)}
                  />
                  <span className="text-sm text-stone-700">{work.title}</span>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {work.category?.name || '未分类'}
                  </Badge>
                  {work.images && (() => {
                    try {
                      const imgs = JSON.parse(work.images);
                      const count = Array.isArray(imgs) ? imgs.length : 0;
                      if (count > 0) {
                        return <Badge variant="outline" className="text-xs text-stone-400">{count}张图片</Badge>;
                      }
                    } catch { /* ignore */ }
                    return null;
                  })()}
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <TagDetailDialog tag={detailTag} open={!!detailTag} onOpenChange={(v) => !v && setDetailTag(null)} />
    </div>
  );
}
