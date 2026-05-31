'use client';

import { useEffect, useState, useCallback } from 'react';
import { categoriesApi, type CategoryNode } from '@/lib/admin-api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  FolderTree,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

export default function CategoriesPage() {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Dialog states
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formParentId, setFormParentId] = useState('');
  const [formCoverUrl, setFormCoverUrl] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [uploading, setUploading] = useState(false);

  const loadTree = useCallback(async () => {
    try {
      const data = await categoriesApi.tree();
      setTree(data);
      // Auto-expand all
      const ids = new Set<string>();
      const collect = (nodes: CategoryNode[]) => {
        for (const n of nodes) {
          ids.add(n.id);
          if (n.children?.length) collect(n.children);
        }
      };
      collect(data);
      setExpandedIds(ids);
    } catch {
      toast.error('获取分类失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreate = (parentId = '') => {
    setEditId(null);
    setFormName('');
    setFormParentId(parentId);
    setFormCoverUrl('');
    setFormSortOrder(0);
    setEditOpen(true);
  };

  const openEdit = (cat: CategoryNode) => {
    setEditId(cat.id);
    setFormName(cat.name);
    setFormParentId(cat.parentId || '');
    setFormCoverUrl(cat.coverUrl || '');
    setFormSortOrder(cat.sortOrder);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('请填写分类名称');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await categoriesApi.update(editId, {
          name: formName,
          parent_id: formParentId || undefined,
          cover_url: formCoverUrl || undefined,
          sort_order: formSortOrder,
        });
        toast.success('更新成功');
      } else {
        await categoriesApi.create({
          name: formName,
          parent_id: formParentId || undefined,
          cover_url: formCoverUrl || undefined,
          sort_order: formSortOrder,
        });
        toast.success('创建成功');
      }
      setEditOpen(false);
      setLoading(true);
      loadTree();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await categoriesApi.delete(deleteId);
      toast.success('删除成功');
      setDeleteId(null);
      setLoading(true);
      loadTree();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('admin_access_token');
      const res = await fetch('/api/v1/admin/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await res.json();
      if (json.code === 0) {
        setFormCoverUrl(json.data.url);
      } else {
        toast.error('上传失败');
      }
    } catch {
      toast.error('上传失败');
    } finally {
      setUploading(false);
    }
  };

  // Flatten for parent select
  const flatForSelect: { id: string; name: string; level: number }[] = [];
  const flatten = (nodes: CategoryNode[], level = 0) => {
    for (const n of nodes) {
      flatForSelect.push({ id: n.id, name: n.name, level });
      if (n.children?.length) flatten(n.children, level + 1);
    }
  };
  flatten(tree);

  const renderTree = (nodes: CategoryNode[], level = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children?.length > 0;
      const isExpanded = expandedIds.has(node.id);

      return (
        <div key={node.id}>
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 hover:bg-stone-50 transition-colors"
            style={{ paddingLeft: `${level * 24 + 12}px` }}
          >
            {/* Expand toggle */}
            <button
              onClick={() => hasChildren && toggleExpand(node.id)}
              className="flex h-5 w-5 items-center justify-center"
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-stone-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-stone-500" />
                )
              ) : (
                <span className="h-4 w-4" />
              )}
            </button>

            {/* Cover */}
            {node.coverUrl ? (
              <img src={node.coverUrl} alt="" className="h-8 w-8 rounded object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-50">
                <FolderTree className="h-4 w-4 text-amber-600" />
              </div>
            )}

            {/* Name */}
            <span className="flex-1 font-medium text-stone-800">{node.name}</span>

            {/* Meta */}
            <span className="text-xs text-stone-400">
              {node.workCount} 作品
            </span>
            <span className="text-xs text-stone-400">排序: {node.sortOrder}</span>

            {/* Actions */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => openCreate(node.id)}
              title="添加子分类"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => openEdit(node)}
              title="编辑"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-500"
              onClick={() => setDeleteId(node.id)}
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Children */}
          {hasChildren && isExpanded && renderTree(node.children, level + 1)}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">分类管理</h1>
          <p className="text-sm text-stone-500">管理作品分类结构</p>
        </div>
        <Button onClick={() => openCreate()} className="bg-amber-600 hover:bg-amber-700">
          <Plus className="mr-2 h-4 w-4" />
          新建分类
        </Button>
      </div>

      <Card className="border-stone-200">
        <CardContent className="p-2">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : tree.length === 0 ? (
            <div className="py-12 text-center text-sm text-stone-400">暂无分类数据</div>
          ) : (
            <div className="divide-y divide-stone-100">{renderTree(tree)}</div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? '编辑分类' : '新建分类'}</DialogTitle>
            <DialogDescription className="sr-only">创建或编辑作品分类</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>分类名称 *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="分类名称"
                className="border-stone-200"
              />
            </div>

            <div className="space-y-2">
              <Label>父分类</Label>
              <Select value={formParentId || 'none'} onValueChange={(v) => setFormParentId(v === 'none' ? '' : v)}>
                <SelectTrigger className="border-stone-200">
                  <SelectValue placeholder="无父分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无（顶级分类）</SelectItem>
                  {flatForSelect
                    .filter((c) => c.id !== editId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {'　'.repeat(c.level)}{c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>封面图</Label>
              <div className="flex items-center gap-3">
                {formCoverUrl ? (
                  <div className="relative h-16 w-16 group">
                    <img src={formCoverUrl} alt="" className="h-16 w-16 rounded object-cover" />
                    <button
                      onClick={() => setFormCoverUrl('')}
                      className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : null}
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded border-2 border-dashed border-stone-300 hover:border-amber-400">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
                  ) : (
                    <Upload className="h-4 w-4 text-stone-400" />
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>排序</Label>
              <Input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(Number(e.target.value))}
                className="border-stone-200"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="border-stone-200">
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editId ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个分类吗？子分类不会一起删除。
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
