'use client';

import { useEffect, useState, useCallback } from 'react';
import { cacheApi, type CacheStatsData, type CacheKeyDetail, type RedisInfoData } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Database,
  Trash2,
  RefreshCw,
  Loader2,
  Server,
  HardDrive,
  Users,
  Key,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Wifi,
  WifiOff,
  Zap,
  ArrowDownUp,
} from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 15;

export default function CacheManagementPage() {
  // Section 1: Engine Status
  const [stats, setStats] = useState<CacheStatsData | null>(null);
  const [redisInfo, setRedisInfo] = useState<RedisInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [redisTesting, setRedisTesting] = useState(false);

  // Section 3: Data Browser
  const [cacheKeys, setCacheKeys] = useState<CacheKeyDetail[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [searchPrefix, setSearchPrefix] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Section 5: Operations
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearPrefixOpen, setClearPrefixOpen] = useState(false);
  const [clearPrefixValue, setClearPrefixValue] = useState('');
  const [clearingPrefix, setClearingPrefix] = useState(false);

  // View value dialog
  const [viewValueOpen, setViewValueOpen] = useState(false);
  const [viewValueKey, setViewValueKey] = useState('');
  const [viewValueData, setViewValueData] = useState<{ key: string; type: string; ttl: number; remainingTtl: number; size?: number } | null>(null);
  const [viewValueLoading, setViewValueLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await cacheApi.stats();
      setStats(data);
    } catch {
      toast.error('获取缓存统计失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRedisInfo = useCallback(async () => {
    try {
      const data = await cacheApi.redisInfo();
      setRedisInfo(data);
    } catch {
      // ignore
    }
  }, []);

  const loadCacheKeys = useCallback(async (prefix?: string) => {
    setKeysLoading(true);
    try {
      const data = await cacheApi.keys({ prefix: prefix || undefined });
      setCacheKeys(Array.isArray(data) ? data : []);
      setCurrentPage(1);
    } catch {
      setCacheKeys([]);
    } finally {
      setKeysLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadCacheKeys();
  }, [loadData, loadCacheKeys]);

  useEffect(() => {
    if (stats?.redisConnected) {
      loadRedisInfo();
    }
  }, [stats?.redisConnected, loadRedisInfo]);

  const handleRefreshAll = () => {
    loadData();
    loadCacheKeys(searchPrefix);
    if (stats?.redisConnected) loadRedisInfo();
  };

  const handleTestRedis = async () => {
    setRedisTesting(true);
    try {
      const data = await cacheApi.stats();
      setStats(data);
      toast.success(data?.redisConnected ? 'Redis连接正常' : 'Redis连接失败');
    } catch {
      toast.error('测试Redis连接失败');
    } finally {
      setRedisTesting(false);
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await cacheApi.clearAll();
      toast.success('缓存已清空');
      setClearAllOpen(false);
      loadData();
      loadCacheKeys(searchPrefix);
    } catch {
      toast.error('清空缓存失败');
    } finally {
      setClearing(false);
    }
  };

  const handleClearByPrefix = async () => {
    if (!clearPrefixValue.trim()) {
      toast.error('请输入前缀');
      return;
    }
    setClearingPrefix(true);
    try {
      const result = await cacheApi.clearByPrefix(clearPrefixValue.trim());
      toast.success(`已清除 ${result.clearedKeys} 个缓存键`);
      setClearPrefixOpen(false);
      setClearPrefixValue('');
      loadData();
      loadCacheKeys(searchPrefix);
    } catch {
      toast.error('清除失败');
    } finally {
      setClearingPrefix(false);
    }
  };

  const handleDeleteKey = async (key: string) => {
    try {
      await cacheApi.deleteKey(key);
      toast.success('缓存键已删除');
      loadCacheKeys(searchPrefix);
      loadData();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleViewValue = async (key: string) => {
    setViewValueKey(key);
    setViewValueOpen(true);
    setViewValueLoading(true);
    setViewValueData(null);
    try {
      // 直接从已加载的 cacheKeys 中查找，避免重新请求所有 keys
      const found = cacheKeys.find((k) => k.key === key);
      if (found) {
        setViewValueData({ key: found.key, type: found.type, ttl: found.ttl, remainingTtl: found.remainingTtl, size: found.size });
      }
    } catch {
      setViewValueData(null);
    } finally {
      setViewValueLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (ts: number) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const formatTtl = (seconds: number) => {
    if (seconds <= 0) return '永不过期';
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`;
    return `${Math.floor(seconds / 86400)}天`;
  };

  const formatUptime = (seconds: string | null) => {
    if (!seconds) return '-';
    const s = parseInt(seconds);
    if (isNaN(s)) return '-';
    if (s < 60) return `${s}秒`;
    if (s < 3600) return `${Math.floor(s / 60)}分${s % 60}秒`;
    if (s < 86400) return `${Math.floor(s / 3600)}小时${Math.floor((s % 3600) / 60)}分`;
    return `${Math.floor(s / 86400)}天${Math.floor((s % 86400) / 3600)}小时`;
  };

  // Pagination
  const totalPages = Math.ceil(cacheKeys.length / PAGE_SIZE);
  const paginatedKeys = cacheKeys.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">缓存管理</h1>
          <p className="text-sm text-stone-500">管理缓存引擎、浏览缓存数据、查看Redis状态</p>
        </div>
        <Button variant="outline" onClick={handleRefreshAll} className="border-stone-200">
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {/* Section 1: Cache Engine Status */}
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-stone-800 flex items-center gap-2">
            <Server className="h-4 w-4" />
            缓存引擎状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-3/4" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${stats?.redisConnected ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                  {stats?.redisConnected ? (
                    <Wifi className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-amber-600" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-stone-500">当前引擎</p>
                  <Badge className={stats?.redisConnected ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-100 text-amber-700 hover:bg-amber-100'}>
                    {stats?.redisConnected ? 'Redis' : '未连接'}
                  </Badge>
                </div>
              </div>
              <div className="p-3 bg-stone-50 rounded-lg">
                <p className="text-xs text-stone-500">Redis总键数</p>
                <p className="text-xl font-bold text-stone-800">{stats?.redisTotalKeys ?? stats?.totalKeys ?? 0}</p>
                {stats?.appKeyCount !== undefined && stats.appKeyCount !== stats?.redisTotalKeys && (
                  <p className="text-xs text-stone-400 mt-0.5">应用缓存 {stats.appKeyCount} 个</p>
                )}
              </div>
              <div className="p-3 bg-stone-50 rounded-lg">
                <p className="text-xs text-stone-500">Redis占用内存</p>
                <p className="text-xl font-bold text-stone-800">{stats?.redisUsedMemory ?? stats?.memoryUsage ?? '-'}</p>
                {stats?.appMemoryUsage && stats.appMemoryUsage !== stats?.redisUsedMemory && (
                  <p className="text-xs text-stone-400 mt-0.5">应用缓存 {stats.appMemoryUsage}</p>
                )}
              </div>
              {stats?.redisConnected && stats.redisInfo && (
                <>
                  <div className="p-3 bg-stone-50 rounded-lg">
                    <p className="text-xs text-stone-500">Redis版本</p>
                    <p className="text-sm font-medium text-stone-700">{stats.redisInfo.version || '-'}</p>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-lg">
                    <p className="text-xs text-stone-500">运行时间</p>
                    <p className="text-sm font-medium text-stone-700">{formatUptime(stats.redisInfo.uptime)}</p>
                  </div>
                  {stats.redisPeakMemory && (
                    <div className="p-3 bg-stone-50 rounded-lg">
                      <p className="text-xs text-stone-500">峰值内存</p>
                      <p className="text-sm font-medium text-stone-700">{stats.redisPeakMemory}</p>
                    </div>
                  )}
                </>
              )}
              <div className="p-3 bg-stone-50 rounded-lg sm:col-span-2 lg:col-span-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-500">Redis连接</p>
                    <p className="text-xs font-mono text-stone-400 truncate max-w-[300px]">
                      {stats?.redisConnected ? '已连接' : '未配置'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestRedis}
                    disabled={redisTesting}
                    className="border-stone-200"
                  >
                    {redisTesting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />}
                    测试连接
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Redis Server Info (only when connected) */}
      {stats?.redisConnected && (
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-stone-800 flex items-center gap-2">
              <Database className="h-4 w-4" />
              Redis服务器信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            {redisInfo?.connected ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Memory */}
                <Card className="border-stone-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <HardDrive className="h-3.5 w-3.5 text-stone-400" />
                      内存统计
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-500">已用内存</span>
                      <span className="font-medium">{redisInfo.memoryInfo?.usedMemory ?? '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">峰值内存</span>
                      <span className="font-medium">{redisInfo.memoryInfo?.peakMemory ?? '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">碎片率</span>
                      <span className="font-medium">{redisInfo.memoryInfo?.fragmentationRatio ?? '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">系统总内存</span>
                      <span className="font-medium">{redisInfo.memoryInfo?.totalSystemMemory ?? '-'}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Clients */}
                <Card className="border-stone-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-stone-400" />
                      客户端统计
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-500">已连接客户端</span>
                      <span className="font-medium">{redisInfo.clientInfo?.connectedClients ?? '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">总连接数</span>
                      <span className="font-medium">{redisInfo.clientInfo?.totalConnectionsReceived ?? '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">拒绝连接</span>
                      <span className="font-medium">{redisInfo.clientInfo?.rejectedConnections ?? '-'}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Keyspace */}
                <Card className="border-stone-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Key className="h-3.5 w-3.5 text-stone-400" />
                      键空间统计
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-500">总键数</span>
                      <span className="font-medium">{redisInfo.keyspaceInfo?.keys ?? '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">设过期键数</span>
                      <span className="font-medium">{redisInfo.keyspaceInfo?.expires ?? '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">平均TTL</span>
                      <span className="font-medium">{redisInfo.keyspaceInfo?.avgTtl ? formatTtl(Math.round(redisInfo.keyspaceInfo.avgTtl / 1000)) : '-'}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Command Stats */}
                {redisInfo.commandStats && redisInfo.commandStats.length > 0 && (
                  <Card className="border-stone-100 sm:col-span-2 lg:col-span-3">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ArrowDownUp className="h-3.5 w-3.5 text-stone-400" />
                        热门命令 (Top 10)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>命令</TableHead>
                              <TableHead className="text-right">调用次数</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {redisInfo.commandStats.map((cmd, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-mono text-sm">{cmd.command}</TableCell>
                                <TableCell className="text-right font-medium">{cmd.calls.toLocaleString()}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-stone-400">Redis未连接</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 3: Cache Data Browser */}
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-stone-800 flex items-center gap-2">
              <Database className="h-4 w-4" />
              缓存数据浏览
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearPrefixOpen(true)}
                className="border-stone-200"
              >
                按前缀清除
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setClearAllOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                清空全部
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
              <Input
                placeholder="按键名前缀筛选..."
                value={searchPrefix}
                onChange={(e) => setSearchPrefix(e.target.value)}
                className="pl-8 border-stone-200"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    loadCacheKeys(searchPrefix);
                  }
                }}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadCacheKeys(searchPrefix)}
              className="border-stone-200"
            >
              筛选
            </Button>
          </div>

          {keysLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : cacheKeys.length === 0 ? (
            <div className="py-8 text-center text-sm text-stone-400">暂无缓存键</div>
          ) : (
            <>
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>键名</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>TTL</TableHead>
                      <TableHead>剩余</TableHead>
                      <TableHead>大小</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedKeys.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell className="font-mono text-sm text-stone-700 max-w-[250px] truncate" title={item.key}>
                          {item.key}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-xs ${item.type === 'redis' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {item.type === 'redis' ? 'Redis' : 'Memory'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-stone-600">
                          {item.ttl > 0 ? formatTtl(item.ttl) : '永不过期'}
                        </TableCell>
                        <TableCell className="text-sm text-stone-600">
                          {item.remainingTtl > 0 ? formatTtl(item.remainingTtl) : (item.ttl > 0 ? '已过期' : '-')}
                        </TableCell>
                        <TableCell className="text-sm text-stone-500">
                          {item.size ? formatBytes(item.size) : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-stone-400 whitespace-nowrap">
                          {formatDate(item.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleViewValue(item.key)}
                              title="查看详情"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500"
                              onClick={() => handleDeleteKey(item.key)}
                              title="删除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-stone-500">
                    共 {cacheKeys.length} 个键，第 {currentPage}/{totalPages} 页
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                      className="border-stone-200"
                    >
                      <ChevronLeft className="h-4 w-4" /> 上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                      className="border-stone-200"
                    >
                      下一页 <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Cache Operations */}
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-stone-800 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            缓存操作
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="destructive"
              onClick={() => setClearAllOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              清空全部缓存
            </Button>
            <Button
              variant="outline"
              onClick={() => setClearPrefixOpen(true)}
              className="border-stone-200"
            >
              按前缀清除
            </Button>
            <Button
              variant="outline"
              onClick={() => { loadData(); loadCacheKeys(searchPrefix); }}
              className="border-stone-200"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新统计
            </Button>
            {stats?.redisConnected && (
              <Button
                variant="outline"
                onClick={loadRedisInfo}
                className="border-stone-200"
              >
                <Server className="mr-2 h-4 w-4" />
                刷新Redis信息
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Clear All Cache Confirmation */}
      <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清空缓存</AlertDialogTitle>
            <AlertDialogDescription>
              清空缓存可能导致短暂的性能下降，确定要继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-red-500 hover:bg-red-600" disabled={clearing}>
              {clearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear By Prefix Dialog */}
      <Dialog open={clearPrefixOpen} onOpenChange={setClearPrefixOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>按前缀清除缓存</DialogTitle>
            <DialogDescription className="sr-only">按前缀清除缓存数据</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>缓存键前缀</Label>
              <Input
                value={clearPrefixValue}
                onChange={(e) => setClearPrefixValue(e.target.value)}
                placeholder="如：works_list"
                className="border-stone-200"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearPrefixOpen(false)} className="border-stone-200">
              取消
            </Button>
            <Button onClick={handleClearByPrefix} disabled={clearingPrefix} className="bg-amber-600 hover:bg-amber-700">
              {clearingPrefix && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认清除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Value Dialog */}
      <Dialog open={viewValueOpen} onOpenChange={setViewValueOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>缓存键详情</DialogTitle>
            <DialogDescription className="sr-only">查看缓存键的值详情</DialogDescription>
          </DialogHeader>
          {viewValueLoading ? (
            <div className="py-8 space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-stone-400 text-xs">键名</Label>
                <p className="text-sm font-mono text-stone-700 mt-1 break-all">{viewValueKey}</p>
              </div>
              {viewValueData && (
                <>
                  <div className="flex gap-4">
                    <div>
                      <Label className="text-stone-400 text-xs">类型</Label>
                      <p className="text-sm mt-1">
                        <Badge variant="secondary" className={`text-xs ${viewValueData.type === 'redis' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {viewValueData.type === 'redis' ? 'Redis' : 'Memory'}
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <Label className="text-stone-400 text-xs">TTL</Label>
                      <p className="text-sm text-stone-700 mt-1">{formatTtl(viewValueData.ttl || 0)}</p>
                    </div>
                    <div>
                      <Label className="text-stone-400 text-xs">剩余</Label>
                      <p className="text-sm text-stone-700 mt-1">{formatTtl(viewValueData.remainingTtl || 0)}</p>
                    </div>
                    {viewValueData.size !== undefined && (
                      <div>
                        <Label className="text-stone-400 text-xs">大小</Label>
                        <p className="text-sm text-stone-700 mt-1">{formatBytes(viewValueData.size)}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
              {!viewValueData && (
                <div className="py-4 text-center text-sm text-stone-400">未找到缓存数据详情</div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewValueOpen(false)} className="border-stone-200">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
