import { NextRequest } from 'next/server';
import { success, error, getRequestId, requireAdmin } from '@/lib/response';
import { db } from '@/lib/db';

/**
 * GET /api/v1/amap/test
 * 高德地图配置测试接口（管理员）
 * 测试 API Key 是否有效，JS Key 是否已配置
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    // 从数据库获取高德地图相关配置
    const [apiKeyConfig, jsKeyConfig, securityKeyConfig] = await Promise.all([
      db.config.findUnique({ where: { key: 'amap_api_key' } }),
      db.config.findUnique({ where: { key: 'amap_js_key' } }),
      db.config.findUnique({ where: { key: 'amap_security_key' } }),
    ]);

    const apiKey = apiKeyConfig?.value;
    const jsKey = jsKeyConfig?.value;
    const securityKey = securityKeyConfig?.value;

    const results = {
      apiKey: { valid: false, message: '' },
      jsKey: { configured: false },
      securityKey: { configured: false },
    };

    // 检查 JS Key 是否已配置
    results.jsKey.configured = !!jsKey && jsKey.trim().length > 0;

    // 检查安全密钥是否已配置
    results.securityKey.configured = !!securityKey && securityKey.trim().length > 0;

    // 测试 Web 服务 API Key（调用高德 IP 定位接口做简单验证）
    if (!apiKey || apiKey.trim().length === 0) {
      results.apiKey.valid = false;
      results.apiKey.message = 'Web服务Key未配置';
    } else {
      try {
        const testUrl = `https://restapi.amap.com/v3/ip?key=${apiKey}&type=4`;
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(10000), // 10秒超时
        });

        if (!response.ok) {
          results.apiKey.valid = false;
          results.apiKey.message = `HTTP ${response.status}`;
        } else {
          const data = await response.json();
          if (data.status === '1') {
            results.apiKey.valid = true;
            results.apiKey.message = '验证通过';
          } else {
            results.apiKey.valid = false;
            results.apiKey.message = data.info || 'Key无效或已过期';
          }
        }
      } catch (fetchErr) {
        results.apiKey.valid = false;
        results.apiKey.message = '请求高德接口失败，请检查网络';
        console.error('Amap test fetch error:', fetchErr);
      }
    }

    const apiValid = results.apiKey.valid;

    if (apiValid) {
      return success(
        { apiValid, results },
        '高德地图配置正常',
        requestId
      );
    } else {
      const parts: string[] = [];
      if (!results.apiKey.valid) parts.push('Web服务Key: ' + (results.apiKey.message || '无效'));
      if (!results.jsKey.configured) parts.push('JS Key: 未配置');
      return success(
        { apiValid, results },
        parts.length > 0 ? parts.join('；') : '高德地图配置存在问题',
        requestId
      );
    }
  } catch (err) {
    console.error('Amap test error:', err);
    return error(50001, err instanceof Error ? err.message : '高德地图测试失败', requestId);
  }
}
