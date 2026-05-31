'use client';

import { useEffect, useState, useCallback } from 'react';
import { monitorApi, aiErrorAnalysisApi, type AiErrorAnalysisItem, type ApiErrorOverview } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Sparkles,
  Eye,
  Zap,
  Server,
  Search,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface MonitorOverview {
  apiMonitor: {
    totalAggregates: number;
    recentErrors: number;
    totalErrors: number;
    todayCalls: number;
    todayAvgTime: number;
    todayErrorRate: number;
    top5Slowest: { endpoint: string; maxTime: number; avgTime: number }[];
    top5MostCalled: { endpoint: string; totalCalls: number; avgTime: number }[];
  };
  apiErrors: ApiErrorOverview;
}

interface ErrorItem {
  id: string;
  errorMessage: string;
  errorStack: string | null;
  source: string | null;
  pagePath: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface ApiErrorItem {
  id: string;
  apiPath: string;
  method: string;
  statusCode: number;
  errorMessage: string | null;
  requestBody: string | null;
  queryParams: string | null;
  userAgent: string | null;
  clientIp: string | null;
  userId: string | null;
  responseTime: number;
  createdAt: string;
}

export default function MonitorPage() {
  const [activeTab, setActiveTab] = useState('overview');

  // Overview
  const [overview, setOverview] = useState<MonitorOverview | null>(null);
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [errorTotal, setErrorTotal] = useState(0);
  const [errorPage, setErrorPage] = useState(1);
  const [errorPageSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [errorLoading, setErrorLoading] = useState(true);

  // API Errors
  const [apiErrors, setApiErrors] = useState<ApiErrorItem[]>([]);
  const [apiErrorTotal, setApiErrorTotal] = useState(0);
  const [apiErrorPage, setApiErrorPage] = useState(1);
  const [apiErrorPageSize] = useState(15);
  const [apiErrorLoading, setApiErrorLoading] = useState(false);
  const [apiErrorStatusFilter, setApiErrorStatusFilter] = useState('');
  const [apiErrorPathFilter, setApiErrorPathFilter] = useState('');
  const [apiErrorDetailOpen, setApiErrorDetailOpen] = useState(false);
  const [apiErrorDetailItem, setApiErrorDetailItem] = useState<ApiErrorItem | null>(null);

  // AI Error Analysis
  const [aiErrors, setAiErrors] = useState<AiErrorAnalysisItem[]>([]);
  const [aiErrorTotal, setAiErrorTotal] = useState(0);
  const [aiErrorPage, setAiErrorPage] = useState(1);
  const [aiErrorPageSize] = useState(15);
  const [aiErrorLoading, setAiErrorLoading] = useState(false);
  const [aiErrorStatusFilter, setAiErrorStatusFilter] = useState('');
  const [aiDetailOpen, setAiDetailOpen] = useState(false);
  const [aiDetailItem, setAiDetailItem] = useState<AiErrorAnalysisItem | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await monitorApi.overview();
      setOverview(data);
    } catch {
      toast.error('获取监控数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadErrors = useCallback(async (page: number) => {
    setErrorLoading(true);
    try {
      const data = await monitorApi.errors({ page, page_size: errorPageSize });
      setErrors(data.list || []);
      setErrorTotal(data.total || 0);
    } catch {
      // ignore
    } finally {
      setErrorLoading(false);
    }
  }, [errorPageSize]);

  const loadApiErrors = useCallback(async (page: number, statusCode?: string, apiPath?: string) => {
    setApiErrorLoading(true);
    try {
      const data = await monitorApi.apiErrors({
        page,
        page_size: apiErrorPageSize,
        status_code: statusCode ? parseInt(statusCode) : undefined,
        api_path: apiPath || undefined,
      });
      setApiErrors(data.list || []);
      setApiErrorTotal(data.total || 0);
    } catch {
      setApiErrors([]);
    } finally {
      setApiErrorLoading(false);
    }
  }, [apiErrorPageSize]);

  const loadAiErrors = useCallback(async (page: number, status?: string) => {
    setAiErrorLoading(true);
    try {
      const data = await aiErrorAnalysisApi.list({
        page,
        page_size: aiErrorPageSize,
        status: status || undefined,
      });
      setAiErrors(data.list || []);
      setAiErrorTotal(data.total || 0);
    } catch {
      setAiErrors([]);
    } finally {
      setAiErrorLoading(false);
    }
  }, [aiErrorPageSize]);

  useEffect(() => {
    loadOverview();
    loadErrors(1);
    loadApiErrors(1);
    loadAiErrors(1);
  }, [loadOverview, loadErrors, loadApiErrors, loadAiErrors]);

  const errorTotalPages = Math.max(1, Math.ceil(errorTotal / errorPageSize));
  const apiErrorTotalPages = Math.max(1, Math.ceil(apiErrorTotal / apiErrorPageSize));
  const aiErrorTotalPages = Math.max(1, Math.ceil(aiErrorTotal / aiErrorPageSize));

  const handleAiAnalyze = async (id: string) => {
    setAiAnalyzing(id);
    try {
      await aiErrorAnalysisApi.trigger(id);
      toast.success('AI分析已触发');
      loadAiErrors(aiErrorPage, aiErrorStatusFilter || undefined);
    } catch {
      toast.error('AI分析触发失败');
    } finally {
      setAiAnalyzing(null);
    }
  };

  const handleViewAiDetail = (item: AiErrorAnalysisItem) => {
    setAiDetailItem(item);
    setAiDetailOpen(true);
  };

  const formatDate = (dateStr: string | number | undefined | null) => {
    if (!dateStr) return '-';
    if (typeof dateStr === 'object') return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 500) return 'bg-red-100 text-red-700';
    if (statusCode >= 400) return 'bg-amber-100 text-amber-700';
    return 'bg-stone-100 text-stone-600';
  };

  const getMethodColor = (method: string) => {
    const map: Record<string, string> = {
      GET: 'bg-emerald-100 text-emerald-700',
      POST: 'bg-blue-100 text-blue-700',
      PUT: 'bg-amber-100 text-amber-700',
      PATCH: 'bg-amber-100 text-amber-700',
      DELETE: 'bg-red-100 text-red-700',
    };
    return map[method] || 'bg-stone-100 text-stone-600';
  };

  const analysisStatusMap: Record<string, { label: string; color: string }> = {
    pending: { label: '待分析', color: 'bg-amber-100 text-amber-700' },
    analyzed: { label: '已分析', color: 'bg-emerald-100 text-emerald-700' },
    resolved: { label: '已解决', color: 'bg-sky-100 text-sky-700' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">系统监控</h1>
          <p className="text-sm text-stone-500">查看系统运行状态和错误信息</p>
        </div>
        <Button variant="outline" onClick={() => { loadOverview(); loadErrors(1); loadApiErrors(1); loadAiErrors(1); }} className="border-stone-200">
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-stone-200">
              <CardContent className="p-6">
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="border-stone-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-500">今日接口调用</p>
                    <p className="mt-1 text-3xl font-bold text-stone-800">
                      {overview?.apiMonitor.todayCalls || 0}
                    </p>
                    {overview?.apiMonitor.todayAvgTime ? (
                      <p className="text-xs text-stone-400 mt-1">平均 {overview.apiMonitor.todayAvgTime}ms</p>
                    ) : null}
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-50">
                    <Activity className="h-6 w-6 text-sky-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-stone-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-500">今日接口报错</p>
                    <p className="mt-1 text-3xl font-bold text-red-600">
                      {overview?.apiErrors.today || 0}
                    </p>
                    {overview?.apiMonitor.todayErrorRate ? (
                      <p className="text-xs text-stone-400 mt-1">错误率 {overview.apiMonitor.todayErrorRate}%</p>
                    ) : null}
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-50">
                    <Server className="h-6 w-6 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-stone-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-500">今日前端错误</p>
                    <p className="mt-1 text-3xl font-bold text-amber-600">
                      {overview?.apiMonitor.recentErrors || 0}
                    </p>
                    <p className="text-xs text-stone-400 mt-1">总计 {overview?.apiMonitor.totalErrors || 0}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-stone-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-500">接口报错总数</p>
                    <p className="mt-1 text-3xl font-bold text-stone-800">
                      {overview?.apiErrors.total || 0}
                    </p>
                    {overview?.apiErrors.byStatus && overview.apiErrors.byStatus.length > 0 && (
                      <p className="text-xs text-stone-400 mt-1">
                        {overview.apiErrors.byStatus.slice(0, 3).map(s => `${s.statusCode}: ${s.count}`).join(' | ')}
                      </p>
                    )}
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50">
                    <XCircle className="h-6 w-6 text-orange-500" />
                  </div>
                </div>
              </CardContent>
            </Card>


          </>
        )}
      </div>

      {/* API Stats Cards - Top slowest & most called */}
      {!loading && overview && (
        <div className="grid gap-4 sm:grid-cols-2">
          {overview.apiMonitor.top5Slowest.length > 0 && (
            <Card className="border-stone-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-stone-600 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  最慢接口 TOP5
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overview.apiMonitor.top5Slowest.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-stone-600 truncate max-w-[200px]" title={item.endpoint}>
                        {item.endpoint}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs border-red-200 text-red-600">
                          {item.maxTime}ms
                        </Badge>
                        <span className="text-xs text-stone-400">avg {item.avgTime}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {overview.apiMonitor.top5MostCalled.length > 0 && (
            <Card className="border-stone-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-stone-600 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-sky-500" />
                  调用最多接口 TOP5
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overview.apiMonitor.top5MostCalled.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-stone-600 truncate max-w-[200px]" title={item.endpoint}>
                        {item.endpoint}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs border-sky-200 text-sky-600">
                          {item.totalCalls}次
                        </Badge>
                        <span className="text-xs text-stone-400">avg {item.avgTime}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {overview.apiErrors.topPaths.length > 0 && (
            <Card className="border-stone-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-stone-600 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  报错最多接口 TOP5
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overview.apiErrors.topPaths.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-stone-600 truncate max-w-[200px]" title={`${item.method} ${item.apiPath}`}>
                        {item.method} {item.apiPath}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs border-red-200 text-red-600">
                          {item.count}次
                        </Badge>
                        <span className="text-xs text-stone-400">avg {item.avgTime}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {overview.apiErrors.byStatus.length > 0 && (
            <Card className="border-stone-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-stone-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  错误状态码分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overview.apiErrors.byStatus.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <Badge className={`text-xs ${getStatusColor(item.statusCode)}`}>
                        {item.statusCode}
                      </Badge>
                      <span className="text-stone-600">{item.count} 次</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-stone-100">
          <TabsTrigger value="overview">前端错误</TabsTrigger>
          <TabsTrigger value="api-errors">接口报错</TabsTrigger>

          <TabsTrigger value="ai-analysis">AI错误分析</TabsTrigger>
        </TabsList>

        {/* Error Log Tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card className="border-stone-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-stone-800">前端错误日志</CardTitle>
              <CardDescription>最近的错误记录</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {errorLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : errors.length === 0 ? (
                <div className="py-12 text-center text-sm text-stone-400">暂无错误记录</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>错误信息</TableHead>
                        <TableHead>来源</TableHead>
                        <TableHead>页面</TableHead>
                        <TableHead>时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errors.map((err) => (
                        <TableRow key={err.id}>
                          <TableCell className="max-w-[400px]">
                            <p className="truncate text-sm text-red-600 font-mono">
                              {err.errorMessage}
                            </p>
                            {err.errorStack && (
                              <p className="mt-1 text-xs text-stone-400 truncate font-mono">
                                {err.errorStack.split('\n')[0]}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {err.source || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-stone-500 max-w-[150px] truncate">
                            {err.pagePath || '-'}
                          </TableCell>
                          <TableCell className="text-xs text-stone-400 whitespace-nowrap">
                            {formatDate(err.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {errorTotal > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-stone-500">
                共 {errorTotal} 条，第 {errorPage}/{errorTotalPages} 页
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={errorPage <= 1}
                  onClick={() => { setErrorPage(errorPage - 1); loadErrors(errorPage - 1); }}
                  className="border-stone-200"
                >
                  <ChevronLeft className="h-4 w-4" /> 上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={errorPage >= errorTotalPages}
                  onClick={() => { setErrorPage(errorPage + 1); loadErrors(errorPage + 1); }}
                  className="border-stone-200"
                >
                  下一页 <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* API Errors Tab */}
        <TabsContent value="api-errors" className="mt-4 space-y-4">
          {/* Filters */}
          <Card className="border-stone-200">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-stone-500 whitespace-nowrap">状态码：</Label>
                  <select
                    value={apiErrorStatusFilter}
                    onChange={(e) => {
                      setApiErrorStatusFilter(e.target.value);
                      setApiErrorPage(1);
                      loadApiErrors(1, e.target.value, apiErrorPathFilter);
                    }}
                    className="text-sm border border-stone-200 rounded-md px-2 py-1.5 bg-white"
                  >
                    <option value="">全部</option>
                    <option value="400">400 Bad Request</option>
                    <option value="401">401 Unauthorized</option>
                    <option value="403">403 Forbidden</option>
                    <option value="404">404 Not Found</option>
                    <option value="409">409 Conflict</option>
                    <option value="422">422 Unprocessable</option>
                    <option value="429">429 Too Many</option>
                    <option value="500">500 Server Error</option>
                    <option value="502">502 Bad Gateway</option>
                    <option value="503">503 Unavailable</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-stone-500 whitespace-nowrap">路径：</Label>
                  <Input
                    value={apiErrorPathFilter}
                    onChange={(e) => setApiErrorPathFilter(e.target.value)}
                    placeholder="/api/v1/..."
                    className="w-48 border-stone-200 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setApiErrorPage(1);
                        loadApiErrors(1, apiErrorStatusFilter, apiErrorPathFilter);
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setApiErrorPage(1); loadApiErrors(1, apiErrorStatusFilter, apiErrorPathFilter); }}
                    className="border-stone-200"
                  >
                    <Search className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setApiErrorStatusFilter('');
                    setApiErrorPathFilter('');
                    setApiErrorPage(1);
                    loadApiErrors(1);
                  }}
                  className="border-stone-200"
                >
                  重置
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-stone-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-stone-800">接口报错记录</CardTitle>
              <CardDescription>后端 API 请求错误详情</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {apiErrorLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : apiErrors.length === 0 ? (
                <div className="py-12 text-center text-sm text-stone-400">暂无接口报错记录</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>状态码</TableHead>
                        <TableHead>方法</TableHead>
                        <TableHead>接口路径</TableHead>
                        <TableHead>错误信息</TableHead>
                        <TableHead>耗时</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>时间</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiErrors.map((err) => (
                        <TableRow key={err.id}>
                          <TableCell>
                            <Badge className={`text-xs ${getStatusColor(err.statusCode)}`}>
                              {err.statusCode}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${getMethodColor(err.method)}`}>
                              {err.method}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-stone-700 max-w-[200px] truncate" title={err.apiPath}>
                            {err.apiPath}
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <p className="truncate text-sm text-red-600">
                              {err.errorMessage || '-'}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm text-stone-500 whitespace-nowrap">
                            {err.responseTime}ms
                          </TableCell>
                          <TableCell className="text-xs text-stone-400 whitespace-nowrap">
                            {err.clientIp || '-'}
                          </TableCell>
                          <TableCell className="text-xs text-stone-400 whitespace-nowrap">
                            {formatDate(err.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => { setApiErrorDetailItem(err); setApiErrorDetailOpen(true); }}
                              title="查看详情"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {apiErrorTotal > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-stone-500">
                共 {apiErrorTotal} 条，第 {apiErrorPage}/{apiErrorTotalPages} 页
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={apiErrorPage <= 1}
                  onClick={() => { setApiErrorPage(apiErrorPage - 1); loadApiErrors(apiErrorPage - 1, apiErrorStatusFilter, apiErrorPathFilter); }}
                  className="border-stone-200"
                >
                  <ChevronLeft className="h-4 w-4" /> 上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={apiErrorPage >= apiErrorTotalPages}
                  onClick={() => { setApiErrorPage(apiErrorPage + 1); loadApiErrors(apiErrorPage + 1, apiErrorStatusFilter, apiErrorPathFilter); }}
                  className="border-stone-200"
                >
                  下一页 <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* AI Error Analysis Tab */}
        <TabsContent value="ai-analysis" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div />
            <div className="flex items-center gap-2">
              <Label className="text-sm text-stone-500">状态筛选：</Label>
              <select
                value={aiErrorStatusFilter}
                onChange={(e) => {
                  setAiErrorStatusFilter(e.target.value);
                  setAiErrorPage(1);
                  loadAiErrors(1, e.target.value || undefined);
                }}
                className="text-sm border border-stone-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">全部</option>
                <option value="pending">待分析</option>
                <option value="analyzed">已分析</option>
                <option value="resolved">已解决</option>
              </select>
            </div>
          </div>

          <Card className="border-stone-200">
            <CardContent className="p-0">
              {aiErrorLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : aiErrors.length === 0 ? (
                <div className="py-12 text-center text-sm text-stone-400">暂无AI错误分析数据</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>错误类型</TableHead>
                        <TableHead>请求URL</TableHead>
                        <TableHead>分析摘要</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>时间</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiErrors.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm text-red-600 font-mono max-w-[200px] truncate">
                            {item.errorType}
                          </TableCell>
                          <TableCell className="text-sm text-stone-500 max-w-[200px] truncate">
                            {item.requestUrl || '-'}
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <p className="text-sm text-stone-600 line-clamp-2">
                              {item.aiAnalysis || '-'}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${analysisStatusMap[item.analysisStatus]?.color || 'bg-stone-100'}`}>
                              {analysisStatusMap[item.analysisStatus]?.label || item.analysisStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-stone-400 whitespace-nowrap">
                            {formatDate(item.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleViewAiDetail(item)}
                                title="查看详情"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleAiAnalyze(item.id)}
                                disabled={aiAnalyzing === item.id}
                                title="AI分析"
                              >
                                {aiAnalyzing === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                                ) : (
                                  <Sparkles className="h-4 w-4 text-amber-500" />
                                )}
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

          {aiErrorTotal > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-stone-500">
                共 {aiErrorTotal} 条，第 {aiErrorPage}/{aiErrorTotalPages} 页
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={aiErrorPage <= 1}
                  onClick={() => { setAiErrorPage(aiErrorPage - 1); loadAiErrors(aiErrorPage - 1, aiErrorStatusFilter || undefined); }}
                  className="border-stone-200"
                >
                  <ChevronLeft className="h-4 w-4" /> 上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={aiErrorPage >= aiErrorTotalPages}
                  onClick={() => { setAiErrorPage(aiErrorPage + 1); loadAiErrors(aiErrorPage + 1, aiErrorStatusFilter || undefined); }}
                  className="border-stone-200"
                >
                  下一页 <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* API Error Detail Dialog */}
      <Dialog open={apiErrorDetailOpen} onOpenChange={setApiErrorDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>接口报错详情</DialogTitle>
            <DialogDescription className="sr-only">查看接口报错详细信息</DialogDescription>
          </DialogHeader>
          {apiErrorDetailItem && (
            <div className="space-y-4 py-4">
              <div className="flex gap-3">
                <div>
                  <Label className="text-stone-400 text-xs">状态码</Label>
                  <div className="mt-1">
                    <Badge className={`text-xs ${getStatusColor(apiErrorDetailItem.statusCode)}`}>
                      {apiErrorDetailItem.statusCode}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-stone-400 text-xs">请求方法</Label>
                  <div className="mt-1">
                    <Badge className={`text-xs ${getMethodColor(apiErrorDetailItem.method)}`}>
                      {apiErrorDetailItem.method}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-stone-400 text-xs">响应时间</Label>
                  <p className="text-sm font-mono text-stone-700 mt-1">{apiErrorDetailItem.responseTime}ms</p>
                </div>
              </div>
              <div>
                <Label className="text-stone-400 text-xs">接口路径</Label>
                <p className="text-sm font-mono text-stone-700 mt-1 break-all">{apiErrorDetailItem.apiPath}</p>
              </div>
              {apiErrorDetailItem.errorMessage && (
                <div>
                  <Label className="text-stone-400 text-xs">错误信息</Label>
                  <div className="mt-1 p-3 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700 whitespace-pre-wrap break-all">
                    {apiErrorDetailItem.errorMessage}
                  </div>
                </div>
              )}
              {apiErrorDetailItem.queryParams && (
                <div>
                  <Label className="text-stone-400 text-xs">查询参数</Label>
                  <div className="mt-1 p-3 bg-stone-50 rounded-lg border border-stone-200 text-sm text-stone-600 font-mono break-all">
                    {apiErrorDetailItem.queryParams}
                  </div>
                </div>
              )}
              {apiErrorDetailItem.requestBody && (
                <div>
                  <Label className="text-stone-400 text-xs">请求体</Label>
                  <div className="mt-1 p-3 bg-stone-50 rounded-lg border border-stone-200 text-sm text-stone-600 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                    {apiErrorDetailItem.requestBody}
                  </div>
                </div>
              )}
              <div className="flex gap-4 text-xs text-stone-400">
                {apiErrorDetailItem.clientIp && <span>IP: {apiErrorDetailItem.clientIp}</span>}
                {apiErrorDetailItem.userId && <span>用户: {apiErrorDetailItem.userId}</span>}
                <span>时间: {formatDate(apiErrorDetailItem.createdAt)}</span>
              </div>
              {apiErrorDetailItem.userAgent && (
                <div>
                  <Label className="text-stone-400 text-xs">User-Agent</Label>
                  <p className="text-xs text-stone-400 mt-1 break-all">{apiErrorDetailItem.userAgent}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Error Detail Dialog */}
      <Dialog open={aiDetailOpen} onOpenChange={setAiDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI错误分析详情</DialogTitle>
            <DialogDescription className="sr-only">查看AI错误分析详情</DialogDescription>
          </DialogHeader>
          {aiDetailItem && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-stone-400 text-xs">错误类型</Label>
                <p className="text-sm font-mono text-red-600 mt-1">{aiDetailItem.errorType}</p>
              </div>
              {aiDetailItem.requestUrl && (
                <div>
                  <Label className="text-stone-400 text-xs">请求URL</Label>
                  <p className="text-sm font-mono text-stone-700 mt-1 break-all">{aiDetailItem.requestUrl}</p>
                </div>
              )}
              <div>
                <Label className="text-stone-400 text-xs">分析状态</Label>
                <div className="mt-1">
                  <Badge className={`text-xs ${analysisStatusMap[aiDetailItem.analysisStatus]?.color || 'bg-stone-100'}`}>
                    {analysisStatusMap[aiDetailItem.analysisStatus]?.label || aiDetailItem.analysisStatus}
                  </Badge>
                </div>
              </div>
              {aiDetailItem.aiAnalysis ? (
                <div>
                  <Label className="text-stone-400 text-xs">AI分析结果</Label>
                  <div className="mt-1 p-3 bg-stone-50 rounded-lg border border-stone-200 text-sm text-stone-700 whitespace-pre-wrap max-h-[40vh] overflow-y-auto">
                    {aiDetailItem.aiAnalysis}
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <Sparkles className="h-8 w-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-sm text-stone-400">暂无分析结果</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => handleAiAnalyze(aiDetailItem.id)}
                    disabled={aiAnalyzing === aiDetailItem.id}
                  >
                    {aiAnalyzing === aiDetailItem.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    触发AI分析
                  </Button>
                </div>
              )}
              <div className="flex gap-3 text-xs text-stone-400">
                <span>创建：{formatDate(aiDetailItem.createdAt)}</span>
                <span>更新：{formatDate(aiDetailItem.updatedAt)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
