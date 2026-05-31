import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { getCacheStats } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Get today's aggregates (all hours)
    const todayAggregates = await db.apiMonitorAggregate.findMany({
      where: {
        dateHour: { startsWith: todayStr },
      },
    });

    // Calculate today's stats
    const totalCallsToday = todayAggregates.reduce((sum, a) => sum + a.callCount, 0);
    const totalErrorCount = todayAggregates.reduce((sum, a) => sum + a.errorCount, 0);
    const weightedAvgTime = todayAggregates.length > 0
      ? todayAggregates.reduce((sum, a) => sum + a.avgTime * a.callCount, 0) / Math.max(1, totalCallsToday)
      : 0;
    const errorRate = totalCallsToday > 0 ? (totalErrorCount / totalCallsToday) * 100 : 0;

    // Top 5 slowest endpoints (by maxTime) — 仅查询近30天的数据，避免全量加载
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoStr = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;
    const allAggregates = await db.apiMonitorAggregate.findMany({
      where: {
        dateHour: { gte: thirtyDaysAgoStr },
      },
    });
    const endpointMap = new Map<string, { apiPath: string; method: string; totalCalls: number; avgTime: number; maxTime: number; totalErrors: number }>();

    for (const a of allAggregates) {
      const key = `${a.method} ${a.apiPath}`;
      const existing = endpointMap.get(key);
      if (existing) {
        existing.totalCalls += a.callCount;
        existing.avgTime = (existing.avgTime * (existing.totalCalls - a.callCount) + a.avgTime * a.callCount) / existing.totalCalls;
        existing.maxTime = Math.max(existing.maxTime, a.maxTime);
        existing.totalErrors += a.errorCount;
      } else {
        endpointMap.set(key, {
          apiPath: a.apiPath,
          method: a.method,
          totalCalls: a.callCount,
          avgTime: a.avgTime,
          maxTime: a.maxTime,
          totalErrors: a.errorCount,
        });
      }
    }

    const allEndpoints = Array.from(endpointMap.values());
    const top5Slowest = allEndpoints
      .sort((a, b) => b.maxTime - a.maxTime)
      .slice(0, 5)
      .map(e => ({ endpoint: `${e.method} ${e.apiPath}`, maxTime: e.maxTime, avgTime: Math.round(e.avgTime * 100) / 100 }));

    const top5MostCalled = allEndpoints
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, 5)
      .map(e => ({ endpoint: `${e.method} ${e.apiPath}`, totalCalls: e.totalCalls, avgTime: Math.round(e.avgTime * 100) / 100 }));

    // Frontend errors stats
    const [frontendTotalErrors, frontendRecentErrors, cacheStats] = await Promise.all([
      db.frontendError.count(),
      db.frontendError.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      getCacheStats(),
    ]);

    // API errors stats
    const [apiErrorsTotal, apiErrorsToday, apiErrorsTopPaths, apiErrorsByStatus] = await Promise.all([
      db.apiError.count(),
      db.apiError.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      // Top 5 error paths
      db.apiError.groupBy({
        by: ['apiPath', 'method'],
        _count: { id: true },
        _avg: { responseTime: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      // Errors by status code
      db.apiError.groupBy({
        by: ['statusCode'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ]);

    return success({
      apiMonitor: {
        totalAggregates: allAggregates.length,
        recentErrors: frontendRecentErrors,
        totalErrors: frontendTotalErrors,
        todayCalls: totalCallsToday,
        todayAvgTime: Math.round(weightedAvgTime * 100) / 100,
        todayErrorRate: Math.round(errorRate * 100) / 100,
        top5Slowest,
        top5MostCalled,
      },
      apiErrors: {
        total: apiErrorsTotal,
        today: apiErrorsToday,
        topPaths: apiErrorsTopPaths.map(p => ({
          apiPath: p.apiPath,
          method: p.method,
          count: p._count.id,
          avgTime: Math.round((p._avg.responseTime || 0) * 100) / 100,
        })),
        byStatus: apiErrorsByStatus.map(s => ({
          statusCode: s.statusCode,
          count: s._count.id,
        })),
      },
      cache: cacheStats,
    }, 'ok', requestId);
  } catch (err) {
    console.error('Monitor overview error:', err);
    return error(50001, '获取监控概览失败', requestId);
  }
}
