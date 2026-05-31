import { NextRequest } from 'next/server';
import { success, error, getRequestId } from '@/lib/response';
import { getCache, setCache } from '@/lib/cache';

interface HitokotoData {
  text: string;
  from: string;
  from_who: string | null;
}

// 摄影相关备用语录
const fallbackQuotes: HitokotoData[] = [
  { text: '摄影是让瞬间变成永恒的艺术', from: '摄影格言', from_who: null },
  { text: '光与影的交错，是世间最动人的诗篇', from: '光影集', from_who: null },
  { text: '最好的相机，就是你此刻手中的那一台', from: '摄影箴言', from_who: null },
  { text: '每一张照片，都是一次与时光的对话', from: '摄影随想', from_who: null },
  { text: '用镜头记录世界，用心灵感受美好', from: '光影集', from_who: null },
  { text: '照片是时间的标本，定格了再也回不去的刹那', from: '摄影笔记', from_who: null },
  { text: '万物皆有裂痕，那是光照进来的地方', from: 'Anthem', from_who: 'Leonard Cohen' },
  { text: '生活不是等待暴风雨过去，而是学会在雨中翩翩起舞', from: '生活感悟', from_who: null },
  { text: '你所浪费的今天，是昨天逝去的人奢望的明天', from: '时间物语', from_who: null },
  { text: '世界很大，生命很短，尽力去感受每一处风景', from: '旅行笔记', from_who: null },
];

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    // 检查是否请求刷新（前端点击刷新时带 no_cache=1）
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('no_cache') === '1';

    // 检查Redis缓存（强制刷新时跳过）
    const cacheKey = 'hitokoto:latest';
    if (!forceRefresh) {
      const cached = await getCache<HitokotoData>(cacheKey);
      if (cached) {
        return success(cached, 'ok', requestId);
      }
    }

    // 从 hitokoto API 获取
    try {
      const res = await fetch('https://v1.hitokoto.cn/?c=i&c=d&c=k', {
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.hitokoto) {
          const hitokotoData: HitokotoData = {
            text: data.hitokoto,
            from: data.from || '',
            from_who: data.from_who || null,
          };
          // 缓存5分钟
          await setCache(cacheKey, hitokotoData, 300);
          return success(hitokotoData, 'ok', requestId);
        }
      }
    } catch {
      // hitokoto API 不可用，使用备用语录
    }

    // 使用备用语录
    const randomIndex = Math.floor(Math.random() * fallbackQuotes.length);
    const fallback = fallbackQuotes[randomIndex];
    // 缓存5分钟
    await setCache(cacheKey, fallback, 300);

    return success(fallback, 'ok', requestId);
  } catch (err) {
    console.error('Hitokoto error:', err);
    return error(50001, '获取一言失败', requestId);
  }
}
