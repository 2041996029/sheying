// API Monitor - In-memory buffer for recording API metrics
// Middleware cannot use Prisma (Edge Runtime), so we buffer metrics here
// and periodically flush to the database

interface ApiMetric {
  apiPath: string;
  method: string;
  responseTime: number;
  isError: boolean;
  statusCode?: number;
  timestamp: number;
}

const metricsBuffer: ApiMetric[] = [];
const errorDetailBuffer: ApiErrorDetail[] = [];
let flushInterval: ReturnType<typeof setInterval> | null = null;

export function recordMetric(apiPath: string, method: string, responseTime: number, isError: boolean, statusCode?: number) {
  metricsBuffer.push({
    apiPath,
    method,
    responseTime,
    isError,
    statusCode,
    timestamp: Date.now(),
  });

  // Auto-flush when buffer gets large
  if (metricsBuffer.length >= 100) {
    flushMetrics().catch(() => {});
  }
}

// Error detail for recording from route handlers
interface ApiErrorDetail {
  apiPath: string;
  method: string;
  statusCode: number;
  errorMessage?: string;
  requestBody?: string;
  queryParams?: string;
  userAgent?: string;
  clientIp?: string;
  userId?: string;
  responseTime: number;
}

export function recordApiError(detail: ApiErrorDetail) {
  errorDetailBuffer.push(detail);

  // Auto-flush when buffer gets large
  if (errorDetailBuffer.length >= 50) {
    flushErrors().catch(() => {});
  }
}

export function getBufferSize(): number {
  return metricsBuffer.length + errorDetailBuffer.length;
}

// Format date-hour as YYYY-MM-DD-HH
function formatDateHour(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}`;
}

async function doFlush(): Promise<number> {
  if (metricsBuffer.length === 0) return 0;

  // Take all metrics from the buffer
  const metrics = metricsBuffer.splice(0, metricsBuffer.length);
  if (metrics.length === 0) return 0;

  // Aggregate metrics by (apiPath, method, dateHour)
  const aggregated = new Map<string, {
    apiPath: string;
    method: string;
    dateHour: string;
    callCount: number;
    totalTime: number;
    maxTime: number;
    errorCount: number;
  }>();

  for (const m of metrics) {
    const dateHour = formatDateHour(new Date(m.timestamp));
    const key = `${m.method}:${m.apiPath}:${dateHour}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.callCount += 1;
      existing.totalTime += m.responseTime;
      existing.maxTime = Math.max(existing.maxTime, m.responseTime);
      existing.errorCount += m.isError ? 1 : 0;
    } else {
      aggregated.set(key, {
        apiPath: m.apiPath,
        method: m.method,
        dateHour,
        callCount: 1,
        totalTime: m.responseTime,
        maxTime: m.responseTime,
        errorCount: m.isError ? 1 : 0,
      });
    }
  }

  // Upsert to database — 使用 $transaction 确保原子性
  try {
    const { db } = await import('@/lib/db');
    const aggList = Array.from(aggregated.values());

    await db.$transaction(async (tx) => {
      // 批量查询已存在的聚合记录
      const existingMap = new Map<string, { id: string; callCount: number; avgTime: number; maxTime: number; errorCount: number }>();
      const lookupPromises = aggList.map(async (agg) => {
        try {
          const record = await tx.apiMonitorAggregate.findUnique({
            where: { apiPath_method_dateHour: { apiPath: agg.apiPath, method: agg.method, dateHour: agg.dateHour } },
          });
          if (record) existingMap.set(`${agg.method}:${agg.apiPath}:${agg.dateHour}`, record);
        } catch { /* ignore */ }
      });
      await Promise.all(lookupPromises);

      // 批量更新和创建
      const operations: Promise<unknown>[] = [];
      for (const agg of aggList) {
        const key = `${agg.method}:${agg.apiPath}:${agg.dateHour}`;
        const existing = existingMap.get(key);
        const avgTime = Math.round((agg.totalTime / agg.callCount) * 100) / 100;

        if (existing) {
          const newCallCount = existing.callCount + agg.callCount;
          const newAvgTime = (existing.avgTime * existing.callCount + agg.totalTime) / newCallCount;
          const newMaxTime = Math.max(existing.maxTime, agg.maxTime);
          const newErrorCount = existing.errorCount + agg.errorCount;

          operations.push(
            tx.apiMonitorAggregate.update({
              where: { id: existing.id },
              data: {
                callCount: newCallCount,
                avgTime: Math.round(newAvgTime * 100) / 100,
                maxTime: newMaxTime,
                errorCount: newErrorCount,
              },
            })
          );
        } else {
          operations.push(
            tx.apiMonitorAggregate.create({
              data: {
                apiPath: agg.apiPath,
                method: agg.method,
                dateHour: agg.dateHour,
                callCount: agg.callCount,
                avgTime,
                maxTime: agg.maxTime,
                errorCount: agg.errorCount,
              },
            })
          );
        }
      }

      await Promise.all(operations);
    });
  } catch (err) {
    console.error('Flush metrics error:', err);
    // Put metrics back at the front of the buffer for retry
    metricsBuffer.unshift(...metrics);
    return 0;
  }

  return metrics.length;
}

// Flush error details to ApiError table
async function flushErrors(): Promise<number> {
  if (errorDetailBuffer.length === 0) return 0;

  const errors = errorDetailBuffer.splice(0, errorDetailBuffer.length);
  if (errors.length === 0) return 0;

  try {
    const { db } = await import('@/lib/db');

    // Batch create error records
    await db.apiError.createMany({
      data: errors.map(e => ({
        apiPath: e.apiPath,
        method: e.method,
        statusCode: e.statusCode,
        errorMessage: e.errorMessage?.substring(0, 2000) || null,
        requestBody: e.requestBody?.substring(0, 2000) || null,
        queryParams: e.queryParams?.substring(0, 1000) || null,
        userAgent: e.userAgent?.substring(0, 500) || null,
        clientIp: e.clientIp?.substring(0, 50) || null,
        userId: e.userId || null,
        responseTime: e.responseTime,
      })),
    });

    // Auto-cleanup: keep only last 7 days of error records (max 10000)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await db.apiError.deleteMany({
      where: {
        createdAt: { lt: sevenDaysAgo },
      },
    });
  } catch (err) {
    console.error('Flush API errors error:', err);
    errorDetailBuffer.unshift(...errors);
    return 0;
  }

  return errors.length;
}

export async function flushMetrics(): Promise<number> {
  const m = await doFlush();
  const e = await flushErrors();
  return m + e;
}

// Start periodic flush (every 30 seconds)
export function startMetricsFlush() {
  if (flushInterval) return;
  flushInterval = setInterval(() => {
    flushMetrics().catch(() => {});
  }, 30000);
  // 不阻止进程退出
  if (flushInterval && typeof flushInterval === 'object' && 'unref' in flushInterval) {
    flushInterval.unref();
  }
}

// 停止监控刷入（用于优雅关闭）
export function stopMetricsFlush() {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
}

// Auto-start on import
if (typeof setInterval !== 'undefined') {
  startMetricsFlush();
}
