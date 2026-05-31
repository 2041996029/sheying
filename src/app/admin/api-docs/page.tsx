'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  BookOpen,
  Search,
  Shield,
  Globe,
  Lock,
  Copy,
  Check,
  Zap,
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  Loader2,
  Mail,
  ChevronDown,
  RefreshCw,
  BarChart3,
  Server,
  FileText,
  Bell,
} from 'lucide-react';
import { toast } from 'sonner';

// ==================== Types ====================

interface ScanParam {
  type: string;
  required: boolean;
  description: string;
}

interface ScanEndpoint {
  method: string;
  path: string;
  category: 'public' | 'authenticated' | 'admin';
  description: string;
  params: Record<string, ScanParam>;
  requestBody?: Record<string, ScanParam>;
  responseFields: Record<string, string>;
  statusCodes: { code: number; description: string }[];
  authType: string;
  curlExample: string;
}

interface ScanCategory {
  name: string;
  icon: string;
  color: string;
  endpoints: ScanEndpoint[];
}

interface ApiScanStats {
  totalEndpoints: number;
  publicCount: number;
  authCount: number;
  adminCount: number;
}

interface ScanResultItem {
  method: string;
  path: string;
  status: 'online' | 'offline' | 'error' | 'timeout';
  statusCode: number | null;
  responseTime: number | null;
  error: string | null;
}

interface ScanSummary {
  total: number;
  online: number;
  offline: number;
  errored: number;
  timedOut: number;
  avgResponseTime: number;
  scannedAt: string;
}

interface ScanPostData {
  results: ScanResultItem[];
  summary: ScanSummary;
  hasErrors: boolean;
  errorEndpoints: ScanResultItem[];
}

// ==================== Color Helpers ====================

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  DELETE: '#ef4444',
  PATCH: '#a855f7',
};

const CATEGORY_LABELS: Record<string, { label: string; color: string; icon: typeof Globe }> = {
  public: { label: '公开', color: 'bg-green-100 text-green-700 border-green-200', icon: Globe },
  authenticated: { label: '鉴权', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Lock },
  admin: { label: '管理员', color: 'bg-red-100 text-red-700 border-red-200', icon: Shield },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string; icon: typeof CheckCircle2 }> = {
  online: { label: '在线', color: 'text-green-600', dotColor: 'bg-green-500', icon: CheckCircle2 },
  offline: { label: '离线', color: 'text-red-600', dotColor: 'bg-red-500', icon: XCircle },
  error: { label: '错误', color: 'text-amber-600', dotColor: 'bg-amber-500', icon: AlertTriangle },
  timeout: { label: '超时', color: 'text-gray-500', dotColor: 'bg-gray-400', icon: Clock },
};

function getResponseTimeColor(ms: number | null): string {
  if (ms === null) return 'text-gray-400';
  if (ms < 200) return 'text-green-600';
  if (ms < 1000) return 'text-amber-600';
  return 'text-red-600';
}

function getResponseTimeBg(ms: number | null): string {
  if (ms === null) return 'bg-gray-100';
  if (ms < 200) return 'bg-green-50 border-green-200';
  if (ms < 1000) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

// ==================== Copy Button Component ====================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={handleCopy}
    >
      {copied ? (
        <><Check className="h-3 w-3 mr-1 text-green-500" />已复制</>
      ) : (
        <><Copy className="h-3 w-3 mr-1" />复制</>
      )}
    </Button>
  );
}

// ==================== Endpoint Card Component ====================

function EndpointCard({
  endpoint,
  scanResult,
}: {
  endpoint: ScanEndpoint;
  scanResult: ScanResultItem | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasParams = Object.keys(endpoint.params).length > 0;
  const hasBody = endpoint.requestBody && Object.keys(endpoint.requestBody).length > 0;
  const hasResponse = Object.keys(endpoint.responseFields).length > 0;
  const hasStatusCodes = endpoint.statusCodes.length > 0;
  const hasDetails = hasParams || hasBody || hasResponse || hasStatusCodes || endpoint.curlExample;

  const catConfig = CATEGORY_LABELS[endpoint.category] || CATEGORY_LABELS.public;
  const CatIcon = catConfig.icon;

  const statusKey = scanResult?.status || '';
  const statusCfg = STATUS_CONFIG[statusKey];

  return (
    <Card className="mb-3 border border-border/60 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Method badge */}
            <span
              className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wider text-white shrink-0"
              style={{ backgroundColor: METHOD_COLORS[endpoint.method] || '#6b7280' }}
            >
              {endpoint.method}
            </span>

            {/* Path */}
            <code className="text-sm font-mono text-foreground/90 truncate">
              {endpoint.path}
            </code>

            {/* Auth badge */}
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 ${catConfig.color}`}>
              <CatIcon className="h-2.5 w-2.5" />
              {catConfig.label}
            </span>
          </div>

          {/* Scan result status */}
          {scanResult && statusCfg && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1">
                <span className={`inline-block h-2 w-2 rounded-full ${statusCfg.dotColor}`} />
                <span className={`text-xs font-medium ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>
              </div>
              {scanResult.statusCode !== null && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                  HTTP {scanResult.statusCode}
                </Badge>
              )}
              {scanResult.responseTime !== null && (
                <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded border ${getResponseTimeBg(scanResult.responseTime)} ${getResponseTimeColor(scanResult.responseTime)}`}>
                  {scanResult.responseTime}ms
                </span>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {endpoint.description}
        </p>

        {/* Auth type */}
        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>{endpoint.authType}</span>
        </div>

        {/* Error message */}
        {scanResult?.error && (
          <div className="mt-2 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            {scanResult.error}
          </div>
        )}

        {/* Expandable details */}
        {hasDetails && (
          <Collapsible open={expanded} onOpenChange={setExpanded} className="mt-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                {expanded ? '收起详情' : '查看详情'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-3">
                {/* Request Params */}
                {hasParams && (
                  <div>
                    <h5 className="text-xs font-semibold text-foreground/80 mb-1.5 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      请求参数
                    </h5>
                    <div className="rounded border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8 text-xs">参数名</TableHead>
                            <TableHead className="h-8 text-xs">类型</TableHead>
                            <TableHead className="h-8 text-xs">必填</TableHead>
                            <TableHead className="h-8 text-xs">说明</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(endpoint.params).map(([key, val]) => (
                            <TableRow key={key}>
                              <TableCell className="text-xs font-mono py-1.5">{key}</TableCell>
                              <TableCell className="text-xs py-1.5 text-muted-foreground">{val.type}</TableCell>
                              <TableCell className="text-xs py-1.5">
                                {val.required ? (
                                  <Badge variant="destructive" className="text-[10px] h-4 px-1">必填</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1">可选</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs py-1.5 text-muted-foreground">{val.description}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Request Body */}
                {hasBody && (
                  <div>
                    <h5 className="text-xs font-semibold text-foreground/80 mb-1.5 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      请求体
                    </h5>
                    <div className="rounded border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8 text-xs">字段名</TableHead>
                            <TableHead className="h-8 text-xs">类型</TableHead>
                            <TableHead className="h-8 text-xs">必填</TableHead>
                            <TableHead className="h-8 text-xs">说明</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(endpoint.requestBody!).map(([key, val]) => (
                            <TableRow key={key}>
                              <TableCell className="text-xs font-mono py-1.5">{key}</TableCell>
                              <TableCell className="text-xs py-1.5 text-muted-foreground">{val.type}</TableCell>
                              <TableCell className="text-xs py-1.5">
                                {val.required ? (
                                  <Badge variant="destructive" className="text-[10px] h-4 px-1">必填</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1">可选</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs py-1.5 text-muted-foreground">{val.description}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Response Fields */}
                {hasResponse && (
                  <div>
                    <h5 className="text-xs font-semibold text-foreground/80 mb-1.5 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      响应字段
                    </h5>
                    <div className="rounded border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8 text-xs">字段</TableHead>
                            <TableHead className="h-8 text-xs">类型/说明</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(endpoint.responseFields).map(([key, val]) => (
                            <TableRow key={key}>
                              <TableCell className="text-xs font-mono py-1.5">{key}</TableCell>
                              <TableCell className="text-xs py-1.5 text-muted-foreground">{val}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Status Codes */}
                {hasStatusCodes && (
                  <div>
                    <h5 className="text-xs font-semibold text-foreground/80 mb-1.5 flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      状态码
                    </h5>
                    <div className="rounded border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8 text-xs">状态码</TableHead>
                            <TableHead className="h-8 text-xs">说明</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {endpoint.statusCodes.map((sc, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs py-1.5">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] h-5 px-1.5 ${
                                    sc.code >= 200 && sc.code < 300
                                      ? 'border-green-300 text-green-700'
                                      : sc.code >= 400 && sc.code < 500
                                      ? 'border-amber-300 text-amber-700'
                                      : 'border-red-300 text-red-700'
                                  }`}
                                >
                                  {sc.code}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs py-1.5 text-muted-foreground">{sc.description}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* cURL Example */}
                {endpoint.curlExample && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h5 className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        cURL 示例
                      </h5>
                      <CopyButton text={endpoint.curlExample} />
                    </div>
                    <pre className="rounded bg-gray-900 text-green-400 p-3 text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                      {endpoint.curlExample}
                    </pre>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== Main Page Component ====================

export default function ApiDocsPage() {
  const [categories, setCategories] = useState<ScanCategory[]>([]);
  const [stats, setStats] = useState<ApiScanStats | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scan state
  const [scanData, setScanData] = useState<ScanPostData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [authFilter, setAuthFilter] = useState<'all' | 'public' | 'authenticated' | 'admin'>('all');

  // Email notification config
  const [emailConfigOpen, setEmailConfigOpen] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailOnlyErrors, setEmailOnlyErrors] = useState(true);

  // Fetch API data
  const fetchApiData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('admin_access_token');
      const res = await fetch('/api/v1/admin/api-scan', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setCategories(json.data.categories || []);
        setStats(json.data.stats || null);
        setScannedAt(json.data.scannedAt || null);
      } else {
        throw new Error(json.message || '数据格式错误');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      toast.error('API数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApiData();
  }, [fetchApiData]);

  // Run scan
  const runScan = useCallback(async () => {
    if (scanning) return;
    try {
      setScanning(true);
      setScanProgress(0);
      setScanData(null);
      const token = localStorage.getItem('admin_access_token');

      // Simulate progress
      const progressInterval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 15;
        });
      }, 500);

      const res = await fetch('/api/v1/admin/api-scan', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      clearInterval(progressInterval);
      setScanProgress(100);

      if (!res.ok) throw new Error(`扫描请求失败: ${res.status}`);
      const json = await res.json();

      if (json.code === 0 && json.data) {
        setScanData(json.data);
        toast.success(
          `扫描完成！在线 ${json.data.summary.online}/${json.data.summary.total}`,
          {
            description: json.data.hasErrors
              ? `发现 ${json.data.errorEndpoints?.length || 0} 个异常端点`
              : '所有端点运行正常',
          }
        );
      } else {
        throw new Error(json.message || '扫描数据格式错误');
      }
    } catch (err) {
      toast.error('API扫描失败', {
        description: err instanceof Error ? err.message : '未知错误',
      });
    } finally {
      setScanning(false);
      setTimeout(() => setScanProgress(0), 1000);
    }
  }, [scanning]);

  // Build scan result map for quick lookup
  const scanResultMap = useMemo(() => {
    const map = new Map<string, ScanResultItem>();
    if (scanData?.results) {
      scanData.results.forEach((r) => {
        map.set(`${r.method} ${r.path}`, r);
      });
    }
    return map;
  }, [scanData]);

  // Filtered categories and endpoints
  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return categories
      .map((cat) => {
        const filtered = cat.endpoints.filter((ep) => {
          // Auth filter
          if (authFilter !== 'all' && ep.category !== authFilter) return false;

          // Search filter
          if (query) {
            const searchable = `${ep.method} ${ep.path} ${ep.description} ${ep.authType}`.toLowerCase();
            if (!searchable.includes(query)) return false;
          }

          return true;
        });

        return { ...cat, endpoints: filtered };
      })
      .filter((cat) => cat.endpoints.length > 0);
  }, [categories, authFilter, searchQuery]);

  // Total filtered count
  const filteredCount = useMemo(
    () => filteredData.reduce((sum, cat) => sum + cat.endpoints.length, 0),
    [filteredData]
  );

  // Save email config
  const handleSaveEmailConfig = useCallback(() => {
    toast.success('邮件通知配置已保存', {
      description: emailEnabled
        ? `将向 ${emailAddress || '(未设置)'} 发送通知`
        : '邮件通知已关闭',
    });
  }, [emailEnabled, emailAddress]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">加载API文档...</p>
        </div>
      </div>
    );
  }

  // Error state (still allow scan functionality)
  if (error && categories.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchApiData}>
            <RefreshCw className="h-3 w-3 mr-1" />重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            API 管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            接口文档 · 实时扫描 · 健康监控
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchApiData}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            刷新文档
          </Button>
          <Button
            size="sm"
            onClick={runScan}
            disabled={scanning}
          >
            {scanning ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />扫描中...</>
            ) : (
              <><Zap className="h-3.5 w-3.5 mr-1.5" />开始扫描</>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-primary/10">
                <Server className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">总接口</p>
                <p className="text-xl font-bold text-foreground">
                  {stats?.totalEndpoints ?? categories.reduce((s, c) => s + c.endpoints.length, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-green-100">
                <Globe className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">公开</p>
                <p className="text-xl font-bold text-green-600">{stats?.publicCount ?? '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-blue-100">
                <Lock className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">鉴权</p>
                <p className="text-xl font-bold text-blue-600">{stats?.authCount ?? '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-red-100">
                <Shield className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">管理员</p>
                <p className="text-xl font-bold text-red-600">{stats?.adminCount ?? '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-purple-100">
                <Activity className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">在线率</p>
                <p className="text-xl font-bold text-purple-600">
                  {scanData?.summary
                    ? `${Math.round((scanData.summary.online / scanData.summary.total) * 100)}%`
                    : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-amber-100">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">平均响应</p>
                <p className="text-xl font-bold text-amber-600">
                  {scanData?.summary ? `${Math.round(scanData.summary.avgResponseTime)}ms` : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last scan time & scan progress */}
      {(scannedAt || scanning) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {scannedAt && !scanning && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              文档生成于 {new Date(scannedAt).toLocaleString('zh-CN')}
            </span>
          )}
          {scanData?.summary.scannedAt && !scanning && (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              最近扫描 {new Date(scanData.summary.scannedAt).toLocaleString('zh-CN')}
            </span>
          )}
          {scanning && (
            <div className="flex items-center gap-2 flex-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>正在扫描端点...</span>
              <Progress value={scanProgress} className="flex-1 max-w-48 h-1.5" />
              <span>{Math.round(scanProgress)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Scan Results Panel */}
      {scanData && !scanning && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              扫描结果
              {scanData.hasErrors && (
                <Badge variant="destructive" className="text-[10px] ml-1">
                  发现异常
                </Badge>
              )}
              {!scanData.hasErrors && (
                <Badge className="text-[10px] ml-1 bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                  全部正常
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <div className="flex items-center gap-2 p-2 rounded bg-green-50 border border-green-100">
                <Wifi className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-xs text-green-600">在线</p>
                  <p className="text-lg font-bold text-green-700">{scanData.summary.online}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-red-50 border border-red-100">
                <WifiOff className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-xs text-red-600">离线</p>
                  <p className="text-lg font-bold text-red-700">{scanData.summary.offline}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-amber-50 border border-amber-100">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-xs text-amber-600">错误</p>
                  <p className="text-lg font-bold text-amber-700">{scanData.summary.errored}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-gray-50 border border-gray-200">
                <Clock className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">超时</p>
                  <p className="text-lg font-bold text-gray-700">{scanData.summary.timedOut}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-purple-50 border border-purple-100">
                <Activity className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-xs text-purple-600">平均耗时</p>
                  <p className="text-lg font-bold text-purple-700">
                    {Math.round(scanData.summary.avgResponseTime)}ms
                  </p>
                </div>
              </div>
            </div>

            {/* Error endpoints list */}
            {scanData.hasErrors && scanData.errorEndpoints && scanData.errorEndpoints.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  异常端点 ({scanData.errorEndpoints.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                  {scanData.errorEndpoints.map((ep, i) => {
                    const cfg = STATUS_CONFIG[ep.status];
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 rounded border bg-red-50/50 border-red-100 text-xs"
                      >
                        <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${cfg?.dotColor || 'bg-gray-400'}`} />
                        <span
                          className="font-bold text-white px-1.5 py-0.5 rounded text-[10px] shrink-0"
                          style={{ backgroundColor: METHOD_COLORS[ep.method] || '#6b7280' }}
                        >
                          {ep.method}
                        </span>
                        <code className="font-mono text-foreground/80 truncate flex-1">{ep.path}</code>
                        {ep.statusCode !== null && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
                            {ep.statusCode}
                          </Badge>
                        )}
                        {ep.responseTime !== null && (
                          <span className={`font-mono shrink-0 ${getResponseTimeColor(ep.responseTime)}`}>
                            {ep.responseTime}ms
                          </span>
                        )}
                        {ep.error && (
                          <span className="text-red-600 truncate max-w-48" title={ep.error}>
                            {ep.error}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full results table (collapsible) */}
            <Collapsible className="mt-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                  <ChevronDown className="h-3 w-3 mr-1" />
                  查看全部扫描结果 ({scanData.summary.total})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 rounded border overflow-hidden max-h-80 overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-8 text-xs">方法</TableHead>
                        <TableHead className="h-8 text-xs">路径</TableHead>
                        <TableHead className="h-8 text-xs">状态</TableHead>
                        <TableHead className="h-8 text-xs">HTTP状态</TableHead>
                        <TableHead className="h-8 text-xs">响应时间</TableHead>
                        <TableHead className="h-8 text-xs">错误</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scanData.results.map((r, i) => {
                        const cfg = STATUS_CONFIG[r.status];
                        return (
                          <TableRow key={i}>
                            <TableCell className="py-1.5">
                              <span
                                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                                style={{ backgroundColor: METHOD_COLORS[r.method] || '#6b7280' }}
                              >
                                {r.method}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs font-mono py-1.5 max-w-48 truncate">{r.path}</TableCell>
                            <TableCell className="py-1.5">
                              <span className="flex items-center gap-1">
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg?.dotColor || 'bg-gray-400'}`} />
                                <span className={`text-xs ${cfg?.color || 'text-gray-500'}`}>{cfg?.label || r.status}</span>
                              </span>
                            </TableCell>
                            <TableCell className="text-xs py-1.5">{r.statusCode ?? '-'}</TableCell>
                            <TableCell className={`text-xs font-mono py-1.5 ${getResponseTimeColor(r.responseTime)}`}>
                              {r.responseTime !== null ? `${r.responseTime}ms` : '-'}
                            </TableCell>
                            <TableCell className="text-xs py-1.5 text-muted-foreground max-w-32 truncate" title={r.error || ''}>
                              {r.error || '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索接口路径或描述..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Tabs value={authFilter} onValueChange={(v) => setAuthFilter(v as typeof authFilter)}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs px-3">
              全部
            </TabsTrigger>
            <TabsTrigger value="public" className="text-xs px-3">
              <Globe className="h-3 w-3 mr-1 text-green-600" />
              公开
            </TabsTrigger>
            <TabsTrigger value="authenticated" className="text-xs px-3">
              <Lock className="h-3 w-3 mr-1 text-blue-600" />
              鉴权
            </TabsTrigger>
            <TabsTrigger value="admin" className="text-xs px-3">
              <Shield className="h-3 w-3 mr-1 text-red-600" />
              管理员
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        显示 {filteredCount} 个接口
        {searchQuery && ` · 搜索: "${searchQuery}"`}
        {authFilter !== 'all' && ` · 筛选: ${CATEGORY_LABELS[authFilter]?.label || authFilter}`}
      </div>

      {/* API Categories Accordion */}
      {filteredData.length > 0 ? (
        <Accordion type="multiple" defaultValue={filteredData.map((c) => c.name)} className="space-y-2">
          {filteredData.map((category) => (
            <AccordionItem
              key={category.name}
              value={category.name}
              className="border rounded-lg border-border/60 bg-card px-4"
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 text-left">
                  <span className="text-lg">{category.icon}</span>
                  <span className="font-semibold text-sm text-foreground">{category.name}</span>
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 ml-1">
                    {category.endpoints.length}
                  </Badge>

                  {/* Mini scan summary for this category */}
                  {scanData && (
                    <div className="flex items-center gap-1 ml-2">
                      {category.endpoints.some((ep) => {
                        const r = scanResultMap.get(`${ep.method} ${ep.path}`);
                        return r && r.status === 'online';
                      }) && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" title="在线" />
                      )}
                      {category.endpoints.some((ep) => {
                        const r = scanResultMap.get(`${ep.method} ${ep.path}`);
                        return r && (r.status === 'error' || r.status === 'offline');
                      }) && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" title="异常" />
                      )}
                    </div>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pb-2">
                  {category.endpoints.map((endpoint, idx) => {
                    const scanResult = scanResultMap.get(`${endpoint.method} ${endpoint.path}`);
                    return (
                      <EndpointCard
                        key={`${endpoint.method}-${endpoint.path}-${idx}`}
                        endpoint={endpoint}
                        scanResult={scanResult}
                      />
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {searchQuery || authFilter !== 'all'
                ? '没有找到匹配的接口'
                : '暂无API数据'}
            </p>
            {(searchQuery || authFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setSearchQuery('');
                  setAuthFilter('all');
                }}
              >
                清除筛选条件
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Email Notification Config */}
      <Card className="border-border/60">
        <Collapsible open={emailConfigOpen} onOpenChange={setEmailConfigOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-0 cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  邮件通知配置
                  <Badge variant="outline" className="text-[10px] h-5">
                    未来功能
                  </Badge>
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${emailConfigOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-4">
                配置API异常时的邮件通知规则。当端点扫描发现错误或离线时，自动发送邮件提醒。
              </p>
              <div className="space-y-4 max-w-lg">
                {/* Enable switch */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">启用邮件通知</p>
                      <p className="text-xs text-muted-foreground">扫描发现异常时发送邮件</p>
                    </div>
                  </div>
                  <Switch
                    checked={emailEnabled}
                    onCheckedChange={setEmailEnabled}
                  />
                </div>

                {/* Email address */}
                {emailEnabled && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">
                        通知邮箱地址
                      </label>
                      <Input
                        type="email"
                        placeholder="admin@example.com"
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        className="h-9"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        多个邮箱用逗号分隔
                      </p>
                    </div>

                    {/* Only errors toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">仅通知错误</p>
                        <p className="text-xs text-muted-foreground">关闭后将同时通知警告（如响应慢）</p>
                      </div>
                      <Switch
                        checked={emailOnlyErrors}
                        onCheckedChange={setEmailOnlyErrors}
                      />
                    </div>

                    <Button
                      size="sm"
                      onClick={handleSaveEmailConfig}
                      className="w-full"
                    >
                      保存配置
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
