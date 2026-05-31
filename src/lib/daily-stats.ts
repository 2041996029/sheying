import { db } from '@/lib/db';
import { clearCacheByPrefix } from '@/lib/cache';

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export async function incrementDailyStat(field: 'viewCount' | 'likeCount' | 'favoriteCount' | 'commentCount' | 'newWorkCount' | 'newUserCount', delta: number = 1): Promise<void> {
  try {
    const today = getTodayDate();
    await db.dailyStat.upsert({
      where: { statDate: today },
      create: {
        statDate: today,
        [field]: Math.max(0, delta),
      },
      update: {
        [field]: { increment: delta },
      },
    });
    // 清除趋势缓存让仪表盘刷新
    clearCacheByPrefix('dashboard:').catch(() => {});
  } catch {
    // Non-critical, don't fail the request
  }
}
