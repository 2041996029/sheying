'use client';

import { useEffect, useState } from 'react';
import { aiModelsApi, type AiModelItem } from '@/lib/admin-api';

// 扩展类型以支持内置模型标记
interface AiModelDisplay extends AiModelItem {
  isBuiltin?: boolean;
}
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Power,
  Star,
  Zap,
  Shield,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  Eye,
  MessageSquare,
  Cpu,
} from 'lucide-react';
import { toast } from 'sonner';

const MODEL_TYPE_OPTIONS = [
  { value: 'chat', label: '对话', icon: MessageSquare, color: 'bg-blue-100 text-blue-700' },
  { value: 'vision', label: '视觉', icon: Eye, color: 'bg-purple-100 text-purple-700' },
  { value: 'embedding', label: '嵌入', icon: Cpu, color: 'bg-cyan-100 text-cyan-700' },
] as const;

function renderTypeBadges(modelType: string) {
  const types = modelType.split(',').map(t => t.trim()).filter(Boolean);
  return types.map((t) => {
    const opt = MODEL_TYPE_OPTIONS.find(o => o.value === t);
    if (!opt) return null;
    return (
      <Badge key={t} className={`text-xs ${opt.color}`}>
        {opt.label}
      </Badge>
    );
  });
}

interface TestResult {
  id: string;
  success: boolean;
  latency: number;
  response?: string;
  model?: string;
  error?: string;
  testing?: boolean;
}

export default function AiModelsPage() {
  const [models, setModels] = useState<AiModelDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [editOpen, setEditOpen] = useState(false);
  const [editModel, setEditModel] = useState<AiModelItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formApiUrl, setFormApiUrl] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formModelTypes, setFormModelTypes] = useState<string[]>(['chat']);
  const [formModelName, setFormModelName] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formEnabled, setFormEnabled] = useState(true);

  // Test connection state
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const loadModels = async () => {
    setLoading(true);
    try {
      const data = await aiModelsApi.list();
      setModels(Array.isArray(data) ? (data as AiModelDisplay[]) : []);
    } catch {
      toast.error('获取AI模型列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const openCreate = () => {
    setEditModel(null);
    setFormName('');
    setFormApiUrl('');
    setFormApiKey('');
    setFormModelTypes(['chat']);
    setFormModelName('');
    setFormSortOrder(0);
    setFormEnabled(true);
    setEditOpen(true);
  };

  const openEdit = (model: AiModelItem) => {
    setEditModel(model);
    setFormName(model.name);
    setFormApiUrl(model.apiUrl);
    // API Key 不回显掩码值，留空表示不修改
    setFormApiKey('');
    // 解析多选类型
    const types = (model.modelType || 'chat').split(',').map(t => t.trim()).filter(Boolean);
    setFormModelTypes(types.length > 0 ? types : ['chat']);
    setFormModelName(model.modelName || '');
    setFormSortOrder(model.sortOrder);
    setFormEnabled(model.isEnabled);
    setEditOpen(true);
  };

  const toggleFormType = (type: string) => {
    setFormModelTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('请填写模型名称');
      return;
    }
    if (!formApiUrl.trim()) {
      toast.error('请填写API URL');
      return;
    }
    if (!editModel && !formApiKey.trim()) {
      toast.error('请填写API Key');
      return;
    }
    if (formModelTypes.length === 0) {
      toast.error('请至少选择一种模型类型');
      return;
    }

    const modelTypeStr = formModelTypes.join(',');

    setSaving(true);
    try {
      if (editModel) {
        await aiModelsApi.update(editModel.id, {
          name: formName,
          api_url: formApiUrl,
          api_key: formApiKey.trim() || undefined,
          model_type: modelTypeStr,
          model_name: formModelName || undefined,
          sort_order: formSortOrder,
          is_enabled: formEnabled,
        });
        toast.success('更新成功');
      } else {
        await aiModelsApi.create({
          name: formName,
          api_url: formApiUrl,
          api_key: formApiKey,
          model_type: modelTypeStr,
          model_name: formModelName || undefined,
          sort_order: formSortOrder,
          is_enabled: formEnabled,
        });
        toast.success('创建成功');
      }
      setEditOpen(false);
      loadModels();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await aiModelsApi.delete(deleteId);
      toast.success('删除成功');
      setDeleteId(null);
      loadModels();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await aiModelsApi.toggle(id);
      toast.success('状态已切换');
      loadModels();
    } catch {
      toast.error('操作失败');
    }
  };

  const handleTest = async (id: string, name: string) => {
    setTestResults(prev => ({
      ...prev,
      [id]: { id, success: false, latency: 0, testing: true },
    }));
    try {
      const result = await aiModelsApi.test(id);
      setTestResults(prev => ({
        ...prev,
        [id]: { ...result, id, testing: false },
      }));
      if (result.success) {
        toast.success(`${name} 连接成功 (${result.latency}ms)`);
      } else {
        toast.error(`${name} 连接失败: ${result.error || '未知错误'}`);
      }
    } catch (err: unknown) {
      setTestResults(prev => ({
        ...prev,
        [id]: { id, success: false, latency: 0, error: err instanceof Error ? err.message : '测试失败', testing: false },
      }));
      toast.error(`${name} 测试异常`);
    }
  };

  const maskKey = (key: string) => {
    if (!key || key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">AI模型管理</h1>
          <p className="text-sm text-stone-500">管理AI模型配置（含内置平台模型）</p>
        </div>
        <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-700">
          <Plus className="mr-2 h-4 w-4" />
          添加模型
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600">内置模型</p>
                <p className="mt-1 text-3xl font-bold text-amber-700">{models.filter(m => m.isBuiltin).length}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                <Shield className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-stone-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-500">模型总数</p>
                <p className="mt-1 text-3xl font-bold text-stone-800">{models.length}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50">
                <Zap className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-stone-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-500">已启用</p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">{models.filter(m => m.isEnabled).length}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50">
                <Power className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-stone-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-500">已禁用</p>
                <p className="mt-1 text-3xl font-bold text-stone-400">{models.filter(m => !m.isEnabled).length}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-stone-100">
                <Power className="h-6 w-6 text-stone-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-stone-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : models.length === 0 ? (
            <div className="py-12 text-center text-sm text-stone-400">暂无AI模型配置</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>模型类型</TableHead>
                    <TableHead>模型标识</TableHead>
                    <TableHead>API URL</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>排序</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((model) => {
                    const isBuiltin = model.isBuiltin === true;
                    const testResult = testResults[model.id];
                    return (
                    <TableRow key={model.id} className={isBuiltin ? 'bg-amber-50/50' : ''}>
                      <TableCell className="font-medium text-stone-800">
                        <div className="flex items-center gap-2">
                          {isBuiltin ? (
                            <span title="内置模型（兜底）">
                              <Shield className="h-3.5 w-3.5 text-stone-400" />
                            </span>
                          ) : model.sortOrder === 0 && model.isEnabled ? (
                            <span title="默认模型">
                              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                            </span>
                          ) : null}
                          {model.name}
                          {isBuiltin && (
                            <Badge className="text-xs bg-stone-100 text-stone-500 border border-stone-200">内置·兜底</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {renderTypeBadges(model.modelType)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-stone-500 font-mono">
                        {model.modelName || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-stone-500 max-w-[250px] truncate font-mono">
                        {model.apiUrl}
                      </TableCell>
                      <TableCell className="text-sm text-stone-500 font-mono">
                        {isBuiltin ? model.apiKey : maskKey(model.apiKey)}
                      </TableCell>
                      <TableCell className="text-sm text-stone-600">
                        {isBuiltin ? '兜底' : model.sortOrder}
                      </TableCell>
                      <TableCell>
                        {model.isEnabled ? (
                          <Badge className="text-xs bg-emerald-100 text-emerald-700">已启用</Badge>
                        ) : (
                          <Badge className="text-xs bg-stone-100 text-stone-500">已禁用</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isBuiltin ? (
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleTest(model.id, model.name)}
                                    disabled={testResult?.testing}
                                  >
                                    {testResult?.testing ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                    ) : testResult?.success ? (
                                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    ) : testResult && !testResult.testing ? (
                                      <XCircle className="h-4 w-4 text-red-500" />
                                    ) : (
                                      <Wifi className="h-4 w-4 text-stone-400" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {testResult?.testing ? '测试中...' :
                                   testResult?.success ? `成功 ${testResult.latency}ms` :
                                   testResult?.error ? `失败: ${testResult.error}` :
                                   '测试连接'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <span className="text-xs text-stone-400 mr-1">系统内置</span>
                          </div>
                        ) : (
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleTest(model.id, model.name)}
                                  disabled={testResult?.testing}
                                >
                                  {testResult?.testing ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                  ) : testResult?.success ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                  ) : testResult && !testResult.testing ? (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                  ) : (
                                    <Wifi className="h-4 w-4 text-stone-400" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {testResult?.testing ? '测试中...' :
                                 testResult?.success ? `成功 ${testResult.latency}ms · 模型: ${testResult.model || ''}` :
                                 testResult?.error ? `失败: ${testResult.error}` :
                                 '测试连接'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleToggle(model.id)}
                            title={model.isEnabled ? '禁用' : '启用'}
                          >
                            <Power className={`h-4 w-4 ${model.isEnabled ? 'text-emerald-500' : 'text-stone-400'}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(model)}
                            title="编辑"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600"
                            onClick={() => setDeleteId(model.id)}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        )}
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

      {/* Create/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editModel ? '编辑模型' : '添加模型'}</DialogTitle>
            <DialogDescription className="sr-only">配置AI模型参数</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>模型名称 *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="如：GPT-4o"
                className="border-stone-200"
              />
            </div>

            <div className="space-y-2">
              <Label>API URL *</Label>
              <Input
                value={formApiUrl}
                onChange={(e) => setFormApiUrl(e.target.value)}
                placeholder="https://api.example.com/v1/chat/completions"
                className="border-stone-200"
              />
            </div>

            <div className="space-y-2">
              <Label>API Key {editModel ? '(留空不修改)' : '*'}</Label>
              <Input
                type="password"
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder={editModel ? '留空则保留原有密钥' : '输入API Key'}
                className="border-stone-200"
              />
              {editModel && (
                <p className="text-xs text-stone-400">当前密钥已脱敏显示，留空则不修改原有密钥</p>
              )}
            </div>

            <div className="space-y-3">
              <Label>模型类型 *（可多选）</Label>
              <div className="flex flex-wrap gap-3">
                {MODEL_TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                      formModelTypes.includes(opt.value)
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <Checkbox
                      checked={formModelTypes.includes(opt.value)}
                      onCheckedChange={() => toggleFormType(opt.value)}
                    />
                    <opt.icon className="h-4 w-4" />
                    <span className="text-sm">{opt.label}</span>
                    <span className="text-xs text-stone-400">({opt.value})</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-stone-400">可同时选择多种类型，如同时支持对话和视觉</p>
            </div>

            <div className="space-y-2">
              <Label>模型标识</Label>
              <Input
                value={formModelName}
                onChange={(e) => setFormModelName(e.target.value)}
                placeholder="如：gpt-4o、qwen-vl-max"
                className="border-stone-200"
              />
              <p className="text-xs text-stone-400">具体的模型标识符，用于API调用时指定模型</p>
            </div>

            <div className="space-y-2">
              <Label>排序（越小越优先）</Label>
              <Input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(Number(e.target.value))}
                className="border-stone-200"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
              <Label>启用</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="border-stone-200">
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editModel ? '保存' : '创建'}
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
              确定要删除这个AI模型配置吗？此操作不可恢复。
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
