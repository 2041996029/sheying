import { NextRequest, NextResponse } from 'next/server';
import { recordMetric } from '@/lib/api-monitor';
import { getCache } from '@/lib/cache';
import { verifyRequest } from '@/lib/api-guard';

let monitorEnabledCache: boolean = true;
let monitorEnabledCacheTime: number = 0;
const MONITOR_CACHE_TTL = 30000;

async function isMonitorEnabled(): Promise<boolean> {
  const now = Date.now();
  if (now - monitorEnabledCacheTime < MONITOR_CACHE_TTL) {
    return monitorEnabledCache;
  }

  try {
    const cached = await getCache<string>('configs:monitor_enabled');
    if (cached !== null) {
      monitorEnabledCache = cached === 'true';
    } else {
      monitorEnabledCache = true;
    }
  } catch {
    monitorEnabledCache = true;
  }

  monitorEnabledCacheTime = now;
  return monitorEnabledCache;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Only intercept /api/v1/ paths
  if (!pathname.startsWith('/api/v1/')) {
    return NextResponse.next();
  }

  // Internal endpoints bypass guard
  if (pathname.startsWith('/api/v1/_internal/')) {
    return NextResponse.next();
  }

  // API Guard verification (runs in Node.js Runtime via proxy, can access DB directly)
  const guardResult = await verifyRequest(request);
  if (!guardResult.valid) {
    return guardResult.response;
  }

  // API monitoring
  const monitorEnabled = await isMonitorEnabled();
  if (!monitorEnabled) {
    return NextResponse.next();
  }

  const startTime = Date.now();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-monitor-start-time', String(startTime));
  if (guardResult.valid) {
    requestHeaders.set('x-client-type', guardResult.clientType);
  }

  recordMetric(pathname, request.method, 0, false, 0);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/api/v1/:path*'],
};
