'use client';

import { useEffect, useState, useCallback, useRef, useMemo, memo, startTransition } from 'react';
import { worksApi, categoriesApi, type WorkItem, type CategoryNode } from '@/lib/admin-api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Search,
  Pencil,
  Trash2,
  Star,
  Sparkles,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Link,
  Camera,
  Map,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

// Leaflet 不支持 SSR，需要动态导入
const LocationPicker = dynamic(
  () => import('@/components/admin/location-picker'),
  { ssr: false, loading: () => <div className="h-[280px] rounded-lg border border-stone-200 bg-stone-50 flex items-center justify-center text-sm text-stone-400">地图加载中...</div> }
);

// EXIF编辑器动态导入，避免首屏加载过多代码
const ExifEditor = dynamic(
  () => import('@/components/admin/exif-editor').then(mod => ({ default: mod.ExifEditor })),
  { ssr: false }
);

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-stone-100 text-stone-600' },
  published: { label: '已发布', color: 'bg-emerald-100 text-emerald-700' },
  archived: { label: '已归档', color: 'bg-amber-100 text-amber-700' },
};

export default function WorksPage() {
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<CategoryNode[]>([]);

  // Dialog states
  const [editOpen, setEditOpen] = useState(false);
  const [editWork, setEditWork] = useState<WorkItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formParams, setFormParams] = useState<(Record<string, string | number | null> | null)[]>([]);
  const [formStatus, setFormStatus] = useState('draft');
  const [formFeatured, setFormFeatured] = useState(false);
  const [formLocation, setFormLocation] = useState('');
  const [formLatitude, setFormLatitude] = useState<string>('');
  const [formLongitude, setFormLongitude] = useState<string>('');
  const [locating, setLocating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageMode, setImageMode] = useState<'upload' | 'link'>('upload');
  const [linkInput, setLinkInput] = useState('');
  const [fetchingExif, setFetchingExif] = useState<number | null>(null);
  const [refreshingExif, setRefreshingExif] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [exifEditorIndex, setExifEditorIndex] = useState<number | null>(null);
  const [dialogMounted, setDialogMounted] = useState(false); // 控制Dialog内容是否渲染
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWorks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await worksApi.list({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
        category_id: categoryFilter || undefined,
        search: search || undefined,
      });
      setWorks(data.list);
      setTotal(data.total);
    } catch {
      toast.error('获取作品列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, categoryFilter, search]);

  const loadCategories = useCallback(async () => {
    try {
      const data = await categoriesApi.tree();
      setCategories(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadWorks();
  }, [loadWorks]);

  const totalPages = Math.ceil(total / pageSize);

  const openCreate = () => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    setEditWork(null);
    setFormTitle('');
    setFormDescription('');
    setFormCategoryId('');
    setFormTags('');
    setFormImages([]);
    setFormParams([]);
    setFormStatus('draft');
    setFormFeatured(false);
    setFormLocation('');
    setFormLatitude('');
    setFormLongitude('');
    setShowMap(false);
    setEditOpen(true);
    // 延迟挂载Dialog内容，让浏览器先渲染打开动画
    requestAnimationFrame(() => setDialogMounted(true));
  };

  const openEdit = (work: WorkItem) => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    // 预解析JSON，避免在渲染中多次解析
    let parsedTags = '';
    let parsedImages: string[] = [];
    let parsedParams: (Record<string, string | number | null> | null)[] = [];
    try { parsedTags = work.tags ? JSON.parse(work.tags).join(', ') : ''; } catch { parsedTags = ''; }
    try {
      if (work.images) parsedImages = JSON.parse(work.images);
    } catch { parsedImages = []; }
    try {
      if (work.params) {
        const p = JSON.parse(work.params);
        parsedParams = Array.isArray(p) ? p : [p];
      }
    } catch { parsedParams = []; }

    setEditWork(work);
    setFormTitle(work.title);
    setFormDescription(work.description || '');
    setFormCategoryId(work.categoryId || '');
    setFormTags(parsedTags);
    setFormImages(parsedImages);
    setFormParams(parsedParams);
    setFormStatus(work.status);
    setFormFeatured(work.isFeatured);
    setFormLocation(work.location || '');
    setFormLatitude(work.latitude != null ? String(work.latitude) : '');
    setFormLongitude(work.longitude != null ? String(work.longitude) : '');
    setShowMap(false);
    setEditOpen(true);
    // 延迟挂载Dialog内容，让浏览器先渲染打开动画
    requestAnimationFrame(() => startTransition(() => setDialogMounted(true)));
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast.error('请填写标题');
      return;
    }
    if (formImages.length === 0) {
      toast.error('请至少上传一张图片');
      return;
    }

    setSaving(true);
    try {
      const tagsArr = formTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        title: formTitle,
        description: formDescription || undefined,
        images: JSON.stringify(formImages),
        category_id: formCategoryId && formCategoryId !== 'none' ? formCategoryId : undefined,
        tags: tagsArr.length > 0 ? JSON.stringify(tagsArr) : undefined,
        params: formParams.length > 0 ? JSON.stringify(formParams) : undefined,
        status: formStatus,
        is_featured: formFeatured,
        location: formLocation || undefined,
        latitude: formLatitude || undefined,
        longitude: formLongitude || undefined,
      };

      if (editWork) {
        await worksApi.update(editWork.id, payload);
        toast.success('更新成功');
      } else {
        await worksApi.create(payload);
        toast.success('创建成功');
      }
      setEditOpen(false);
      // 延迟卸载Dialog内容，让关闭动画播放
      closeTimerRef.current = setTimeout(() => setDialogMounted(false), 150);
      loadWorks();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await worksApi.delete(deleteId);
      toast.success('删除成功');
      setDeleteId(null);
      loadWorks();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleToggleFeatured = async (id: string) => {
    try {
      const res = await worksApi.toggleFeatured(id);
      toast.success(res.isFeatured ? '已设为精选' : '已取消精选');
      loadWorks();
    } catch {
      toast.error('操作失败');
    }
  };

  const handleAiTag = async (id: string) => {
    try {
      const res: any = await worksApi.triggerAiTag(id);
      const imgCount = res?.imageCount ? `（共${res.imageCount}张图片）` : '';
      toast.success(`AI识别已触发${imgCount}`);
    } catch {
      toast.error('AI识别触发失败');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const res = await worksApi.upload(file);
        setFormImages((prev) => [...prev, res.url]);
        // 每张图的 EXIF 按顺序存入数组
        setFormParams((prev) => [...prev, res.exif]);
      }
    } catch {
      toast.error('上传失败');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('浏览器不支持定位功能');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setFormLatitude(lat.toFixed(6));
        setFormLongitude(lng.toFixed(6));

        // 尝试通过后端高德反向地理编码获取地名
        try {
          const token = localStorage.getItem('admin_access_token');
          const res = await fetch(
            `/api/v1/amap/reverse-geocode?lat=${lat}&lng=${lng}`,
            {
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            }
          );
          const data = await res.json();
          if (data.code === 0 && data.data?.location) {
            if (!formLocation) {
              setFormLocation(data.data.location);
            }
            toast.success('已获取定位信息');
          } else {
            // 高德API未配置或失败，仅设置坐标
            toast.success('已获取GPS坐标（城市识别需配置高德地图API）');
          }
        } catch {
          // 反向地理编码失败不影响主流程，仅设置坐标
          toast.success('已获取GPS坐标');
        }

        setLocating(false);
      },
      (err) => {
        setLocating(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            toast.error('定位权限被拒绝，请在浏览器设置中允许定位');
            break;
          case err.POSITION_UNAVAILABLE:
            toast.error('无法获取位置信息');
            break;
          case err.TIMEOUT:
            toast.error('定位请求超时');
            break;
          default:
            toast.error('获取定位失败');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const removeImage = (index: number) => {
    setFormImages((prev) => prev.filter((_, i) => i !== index));
    setFormParams((prev) => prev.filter((_, i) => i !== index));
  };

  // 链接输入：解析一行一个URL
  const handleLinkAdd = () => {
    const urls = linkInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (urls.length === 0) {
      toast.error('请输入至少一个图片链接');
      return;
    }

    // 简单验证URL格式
    const validUrls = urls.filter((url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });

    if (validUrls.length === 0) {
      toast.error('请输入有效的图片链接（需以 http:// 或 https:// 开头）');
      return;
    }

    if (validUrls.length < urls.length) {
      toast.warning(`${urls.length - validUrls.length} 个链接格式无效，已跳过`);
    }

    setFormImages((prev) => [...prev, ...validUrls]);
    // 链接模式暂不获取EXIF，后面可以手动点击获取
    setFormParams((prev) => [...prev, ...validUrls.map(() => null)]);
    setLinkInput('');
    toast.success(`已添加 ${validUrls.length} 张图片`);
  };

  // 地图选点回调
  const handleMapPick = async (lat: string, lng: string) => {
    setFormLatitude(lat);
    setFormLongitude(lng);

    // 自动通过后端高德反向地理编码获取地名
    try {
      const token = localStorage.getItem('admin_access_token');
      const res = await fetch(
        `/api/v1/amap/reverse-geocode?lat=${lat}&lng=${lng}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      const data = await res.json();
      if (data.code === 0 && data.data?.location) {
        setFormLocation(data.data.location);
        toast.success('已从地图获取位置信息');
      } else {
        toast.success('已获取GPS坐标（城市识别需配置高德地图API）');
      }
    } catch {
      toast.success('已获取GPS坐标');
    }
  };

  // 一键重新获取整个作品的 EXIF
  const handleRefreshExif = async (workId: string) => {
    setRefreshingExif(workId);
    try {
      const res = await worksApi.refreshExif(workId);
      toast.success(`EXIF重新获取完成：${res.result.successCount}张成功，${res.result.failCount}张无EXIF`);
      loadWorks();
    } catch {
      toast.error('重新获取EXIF失败');
    } finally {
      setRefreshingExif(null);
    }
  };

  // 编辑对话框内一键重新获取 EXIF
  const handleRefreshExifInDialog = async () => {
    if (!editWork) return;
    setRefreshingExif(editWork.id);
    try {
      const res = await worksApi.refreshExif(editWork.id);
      // 用返回的新 params 更新表单状态
      if (res.work.params) {
        const newParams = Array.isArray(JSON.parse(res.work.params))
          ? JSON.parse(res.work.params)
          : [JSON.parse(res.work.params)];
        setFormParams(newParams);
      }
      toast.success(`EXIF重新获取完成：${res.result.successCount}张成功，${res.result.failCount}张无EXIF`);
    } catch {
      toast.error('重新获取EXIF失败');
    } finally {
      setRefreshingExif(null);
    }
  };

  // 手动获取单张图片的EXIF
  const handleFetchExif = async (index: number) => {
    const url = formImages[index];
    if (!url) return;

    setFetchingExif(index);
    try {
      const res = await worksApi.fetchExif(url);
      setFormParams((prev) => {
        const next = [...prev];
        next[index] = res.exif;
        return next;
      });
      if (res.exif) {
        toast.success('EXIF信息获取成功');
      } else {
        toast.info('该图片没有EXIF信息');
      }
    } catch {
      toast.error('获取EXIF失败');
    } finally {
      setFetchingExif(null);
    }
  };

  // Flatten categories for select - useMemo避免每次渲染重算
  const flatCategories = useMemo<{ id: string; name: string; level: number }[]>(() => {
    const result: { id: string; name: string; level: number }[] = [];
    const flattenCat = (nodes: CategoryNode[], level = 0) => {
      for (const node of nodes) {
        result.push({ id: node.id, name: node.name, level });
        if (node.children?.length) flattenCat(node.children, level + 1);
      }
    };
    flattenCat(categories);
    return result;
  }, [categories]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">作品管理</h1>
          <p className="text-sm text-stone-500">管理所有摄影作品</p>
        </div>
        <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-700">
          <Plus className="mr-2 h-4 w-4" />
          新建作品
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-stone-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                placeholder="搜索标题..."
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
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="published">已发布</SelectItem>
                <SelectItem value="archived">已归档</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[130px] border-stone-200">
                <SelectValue placeholder="分类筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {flatCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {'　'.repeat(c.level)}{c.name}
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
          ) : works.length === 0 ? (
            <div className="py-12 text-center text-sm text-stone-400">暂无作品数据</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">封面</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>精选</TableHead>
                    <TableHead className="text-right">浏览</TableHead>
                    <TableHead className="text-right">点赞</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {works.map((work) => (
                    <TableRow key={work.id}>
                      <TableCell>
                        {work.coverUrl ? (
                          <img
                            src={work.coverUrl}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-stone-100">
                            <span className="text-xs text-stone-400">无</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-stone-800 max-w-[200px] truncate">
                        {work.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {work.category?.name || '未分类'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${statusMap[work.status]?.color || 'bg-stone-100'}`}>
                          {statusMap[work.status]?.label || work.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {work.isFeatured ? (
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        ) : (
                          <Star className="h-4 w-4 text-stone-300" />
                        )}
                      </TableCell>
                      <TableCell className="text-right text-stone-600">{work.viewCount}</TableCell>
                      <TableCell className="text-right text-stone-600">{work.likeCount}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleFeatured(work.id)}
                            title={work.isFeatured ? '取消精选' : '设为精选'}
                          >
                            <Star className={`h-4 w-4 ${work.isFeatured ? 'text-amber-500 fill-amber-500' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRefreshExif(work.id)}
                            disabled={refreshingExif === work.id}
                            title="重新获取EXIF"
                          >
                            {refreshingExif === work.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                            ) : (
                              <RefreshCw className="h-4 w-4 text-amber-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleAiTag(work.id)}
                            title="AI识别"
                          >
                            <Sparkles className="h-4 w-4 text-violet-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(work)}
                            title="编辑"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => setDeleteId(work.id)}
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

      {/* Create/Edit Dialog - 只在需要时挂载内容 */}
      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (!open) {
          // 关闭时延迟卸载，让关闭动画播放
          closeTimerRef.current = setTimeout(() => setDialogMounted(false), 150);
        }
      }}>
        {dialogMounted && (
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editWork ? '编辑作品' : '新建作品'}</DialogTitle>
            <DialogDescription className="sr-only">编辑或新建摄影作品</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>标题 *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="作品标题"
                className="border-stone-200"
              />
            </div>

            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="作品描述"
                className="border-stone-200 min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label>分类</Label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger className="border-stone-200">
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无分类</SelectItem>
                  {flatCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {'　'.repeat(c.level)}{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>标签（逗号分隔）</Label>
              <Input
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="风景, 日出, 山脉"
                className="border-stone-200"
              />
            </div>

            <div className="space-y-2">
              <Label>拍摄地点</Label>
              <div className="flex gap-2">
                <Input
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="城市或地点，如：杭州·西湖"
                  className="border-stone-200 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="border-stone-200 shrink-0"
                  onClick={handleGetLocation}
                  disabled={locating}
                  title="GPS定位"
                >
                  {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4 text-emerald-500" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={`border-stone-200 shrink-0 ${showMap ? 'bg-blue-50 border-blue-300' : ''}`}
                  onClick={() => setShowMap(!showMap)}
                  title="地图选点"
                >
                  <Map className={`h-4 w-4 ${showMap ? 'text-blue-500' : 'text-blue-400'}`} />
                </Button>
              </div>
              {formLatitude && formLongitude && (
                <p className="text-xs text-stone-400">
                  GPS坐标：
                  <span className="text-emerald-600 ml-1 font-mono">
                    {formLatitude}, {formLongitude}
                  </span>
                </p>
              )}
              <p className="text-xs text-stone-400">
                <MapPin className="h-3 w-3 inline text-emerald-500" /> GPS定位
                <span className="mx-1.5 text-stone-300">|</span>
                <Map className="h-3 w-3 inline text-blue-400" /> 地图选点
                <span className="mx-1.5 text-stone-300">|</span>
                手动输入
              </p>
              {/* 地图选点 */}
              {showMap && (
                <LocationPicker
                  latitude={formLatitude}
                  longitude={formLongitude}
                  onPick={handleMapPick}
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>图片 *</Label>
                <div className="flex items-center gap-2">
                  {editWork && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-amber-200 text-amber-700 hover:bg-amber-50 h-7 text-xs"
                      onClick={handleRefreshExifInDialog}
                      disabled={refreshingExif === editWork.id}
                    >
                      {refreshingExif === editWork.id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1 h-3 w-3" />
                      )}
                      重新获取EXIF
                    </Button>
                  )}
                  <div className="flex items-center gap-1 bg-stone-100 rounded-md p-0.5">
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        imageMode === 'upload'
                          ? 'bg-white text-stone-800 shadow-sm'
                          : 'text-stone-500 hover:text-stone-700'
                      }`}
                      onClick={() => setImageMode('upload')}
                    >
                      <Upload className="h-3 w-3 inline mr-1" />
                      上传文件
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        imageMode === 'link'
                          ? 'bg-white text-stone-800 shadow-sm'
                          : 'text-stone-500 hover:text-stone-700'
                      }`}
                      onClick={() => setImageMode('link')}
                    >
                      <Link className="h-3 w-3 inline mr-1" />
                      链接输入
                    </button>
                  </div>
                </div>
              </div>

              {/* 已添加的图片列表 */}
              <div className="flex flex-wrap gap-3">
                {formImages.map((url, i) => (
                  <div key={i} className="relative h-20 w-20 group">
                    <img
                      src={url}
                      alt=""
                      className={`h-20 w-20 rounded-lg object-cover border-2 cursor-pointer transition-colors ${
                        exifEditorIndex === i ? 'border-amber-400 ring-2 ring-amber-100' : 'border-stone-200 hover:border-amber-300'
                      }`}
                      onClick={() => setExifEditorIndex(i)}
                      title="点击编辑EXIF"
                    />
                    {/* 删除按钮 */}
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {/* 无EXIF - 获取按钮 */}
                    {!formParams[i] && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleFetchExif(i); }}
                        disabled={fetchingExif === i}
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="获取EXIF"
                      >
                        {fetchingExif === i ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Camera className="h-3 w-3" />
                        )}
                      </button>
                    )}
                    {/* 已有EXIF - 可点击编辑 */}
                    {formParams[i] && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setExifEditorIndex(i); }}
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                        title="编辑EXIF"
                      >
                        <Camera className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* 上传模式 */}
              {imageMode === 'upload' && (
                <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-stone-300 hover:border-amber-400 hover:bg-amber-50 transition-colors">
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
                  ) : (
                    <Upload className="h-5 w-5 text-stone-400" />
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleUpload}
                    disabled={uploading}
                  />
                </label>
              )}

              {/* 链接输入模式 */}
              {imageMode === 'link' && (
                <div className="space-y-2">
                  <Textarea
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="输入图片链接，一行一个&#10;https://example.com/photo1.jpg&#10;https://example.com/photo2.jpg"
                    className="border-stone-200 min-h-[100px] text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-stone-400">
                      支持 HTTP/HTTPS 链接，一行一个；添加后可点击相机图标获取EXIF
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleLinkAdd}
                      disabled={!linkInput.trim()}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      添加链接
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Label>状态</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger className="border-stone-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="published">已发布</SelectItem>
                    <SelectItem value="archived">已归档</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 pt-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formFeatured}
                    onCheckedChange={setFormFeatured}
                  />
                  <Label>精选</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="border-stone-200">
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editWork ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
        )}
      </Dialog>

      {/* EXIF 编辑器 */}
      {exifEditorIndex !== null && (
        <ExifEditor
          open={exifEditorIndex !== null}
          onOpenChange={(open) => { if (!open) setExifEditorIndex(null); }}
          imageIndex={exifEditorIndex}
          imageTotal={formImages.length}
          imageUrl={formImages[exifEditorIndex] || ''}
          exif={formParams[exifEditorIndex] || null}
          onSave={(index, exif) => {
            setFormParams((prev) => {
              const next = [...prev];
              next[index] = exif;
              return next;
            });
            toast.success('EXIF信息已更新');
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个作品吗？此操作不可恢复。
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
