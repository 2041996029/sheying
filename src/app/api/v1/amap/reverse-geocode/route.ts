import { NextRequest } from 'next/server';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { db } from '@/lib/db';
import { getCache, setCache } from '@/lib/cache';

const REVERSE_GEOCODE_CACHE_PREFIX = 'amap:reverse:';
const CACHE_TTL = 7 * 24 * 3600; // 缓存7天，地点不会频繁变化

/**
 * GET /api/v1/amap/reverse-geocode?lat=xxx&lng=xxx
 * 高德地图反向地理编码（服务端代理，保护API Key）
 * 管理员接口
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) {
      return error(40001, '缺少经纬度参数 lat/lng', requestId);
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return error(40002, '经纬度格式无效', requestId);
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return error(40003, '经纬度超出有效范围', requestId);
    }

    // 从数据库获取高德API Key
    const config = await db.config.findUnique({
      where: { key: 'amap_api_key' },
    });

    const apiKey = config?.value;
    if (!apiKey) {
      return error(50002, '高德地图API Key未配置，请在后台配置中心填写', requestId);
    }

    // 检查缓存
    const cacheKey = `${REVERSE_GEOCODE_CACHE_PREFIX}${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const cached = await getCache<string>(cacheKey);
    if (cached) {
      return success({ location: cached, lat: latitude, lng: longitude, cached: true }, '获取位置成功(缓存)', requestId);
    }

    // 调用高德反向地理编码API
    const amapUrl = `https://restapi.amap.com/v3/geocode/regeo?key=${apiKey}&location=${longitude},${latitude}&extensions=base&output=JSON`;
    const response = await fetch(amapUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return error(50301, `高德接口请求失败: HTTP ${response.status}`, requestId);
    }

    const result = await response.json();

    if (result.status !== '1' || result.info !== 'OK') {
      console.error('高德反向地理编码失败:', result);
      return error(50302, `高德接口返回错误: ${result.info || '未知错误'}`, requestId);
    }

    // 解析地址组件，提取省市信息
    const addressComponent = result.regeocode?.addressComponent;
    let locationName = '';

    if (addressComponent) {
      const province = addressComponent.province || '';
      const city = addressComponent.city || '';
      const district = addressComponent.district || '';

      // 高德返回的 city 可能是空数组（直辖区），此时用 province
      const cityStr = Array.isArray(city) ? '' : city;

      if (cityStr && cityStr !== province) {
        locationName = `${province}·${cityStr}`;
      } else if (district && district !== province) {
        locationName = `${province}·${district}`;
      } else {
        locationName = province;
      }
    }

    // 如果解析失败，使用完整地址
    if (!locationName && result.regeocode?.formatted_address) {
      locationName = result.regeocode.formatted_address;
    }

    // 缓存结果
    if (locationName) {
      await setCache(cacheKey, locationName, CACHE_TTL);
    }

    return success({
      location: locationName,
      lat: latitude,
      lng: longitude,
      cached: false,
      raw: {
        province: addressComponent?.province,
        city: addressComponent?.city,
        district: addressComponent?.district,
        township: addressComponent?.township,
        formatted_address: result.regeocode?.formatted_address,
      },
    }, '获取位置成功', requestId);
  } catch (err) {
    console.error('Amap reverse geocode error:', err);
    return error(50001, err instanceof Error ? err.message : '反向地理编码失败', requestId);
  }
}
