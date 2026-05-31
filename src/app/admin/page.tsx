'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dashboardApi } from '@/lib/admin-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Eye,
  Heart,
  Users,
  Image as ImageIcon,
  ArrowUpRight,
  TrendingUp,
  ImagePlus,
  MessageSquare,
  Settings,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface OverviewData {
  totalWorks: number;
  publishedWorks: number;
  totalUsers: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  latestVersion?: string | null;
  today: {
    views: number;
    likes: number;
    favorites: number;
    comments: number;
    newWorks: number;
    newUsers: number;
  };
}

interface TrendItem {
  date: string;
  views: number;
  likes: number;
  favorites: number;
  comments: number;
}

interface TopWork {
  id: string;
  title: string;
  coverUrl: string | null;
  category: { id: string; name: string } | null;
  likeCount: number;
  favoriteCount: number;
  viewCount: number;
  commentCount: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [topWorks, setTopWorks] = useState<TopWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendDays, setTrendDays] = useState(7);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewData, trendData, topWorksData] = await Promise.all([
        dashboardApi.overview(),
        dashboardApi.trend(7),
        dashboardApi.topWorks(10, 'views'),
      ]);
      setOverview(overviewData);
      setTrend(trendData);
      setTopWorks(topWorksData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTrend = async (days: number) => {
    setTrendDays(days);
    try {
      const data = await dashboardApi.trend(days);
      setTrend(data);
    } catch {
      // ignore
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const formatNumber = (n: number) => {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">仪表盘</h1>
          <p className="text-sm text-muted-foreground">欢迎回来，这是您站点的运营概况</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>v{overview?.latestVersion || '—'}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">总作品数</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">
                      {formatNumber(overview?.totalWorks || 0)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      已发布 {overview?.publishedWorks || 0}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <ImageIcon className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">总用户数</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">
                      {formatNumber(overview?.totalUsers || 0)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      今日新增 {overview?.today.newUsers || 0}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Users className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">总浏览量</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">
                      {formatNumber(overview?.totalViews || 0)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      今日 {overview?.today.views || 0}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-500/10">
                    <Eye className="h-6 w-6 text-sky-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">总点赞数</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">
                      {formatNumber(overview?.totalLikes || 0)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      今日 {overview?.today.likes || 0}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-rose-500/10">
                    <Heart className="h-6 w-6 text-rose-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base text-foreground">趋势统计</CardTitle>
              <CardDescription>浏览、点赞、收藏趋势</CardDescription>
            </div>
            <div className="flex gap-1">
              {[7, 14, 30].map((d) => (
                <Button
                  key={d}
                  variant={trendDays === d ? 'default' : 'ghost'}
                  size="sm"
                  className={trendDays === d ? 'h-8 text-xs' : 'h-8 text-xs'}
                  onClick={() => loadTrend(d)}
                >
                  {d}天
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : trend.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              暂无趋势数据
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  className="text-muted-foreground"
                  fontSize={12}
                />
                <YAxis className="text-muted-foreground" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    background: 'var(--popover)',
                    color: 'var(--popover-foreground)',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="views"
                  name="浏览"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="likes"
                  name="点赞"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="favorites"
                  name="收藏"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Works */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground">热门作品</CardTitle>
            <CardDescription>按浏览量排序</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : topWorks.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">暂无作品数据</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>作品</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead className="text-right">浏览</TableHead>
                    <TableHead className="text-right">点赞</TableHead>
                    <TableHead className="text-right">评论</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topWorks.map((work) => (
                    <TableRow key={work.id}>
                      <TableCell className="font-medium text-foreground max-w-[200px] truncate">
                        {work.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {work.category?.name || '未分类'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatNumber(work.viewCount)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatNumber(work.likeCount)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatNumber(work.commentCount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground">快捷操作</CardTitle>
            <CardDescription>常用管理功能</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 hover:bg-primary/5 hover:text-primary hover:border-primary/20"
              onClick={() => router.push('/admin/works')}
            >
              <ImagePlus className="h-4 w-4" />
              管理作品
              <ArrowUpRight className="ml-auto h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 hover:bg-primary/5 hover:text-primary hover:border-primary/20"
              onClick={() => router.push('/admin/comments')}
            >
              <MessageSquare className="h-4 w-4" />
              管理评论
              <ArrowUpRight className="ml-auto h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 hover:bg-primary/5 hover:text-primary hover:border-primary/20"
              onClick={() => router.push('/admin/configs')}
            >
              <Settings className="h-4 w-4" />
              站点配置
              <ArrowUpRight className="ml-auto h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 hover:bg-primary/5 hover:text-primary hover:border-primary/20"
              onClick={() => router.push('/admin/ai-tags')}
            >
              <TrendingUp className="h-4 w-4" />
              AI标签审核
              <ArrowUpRight className="ml-auto h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
