import { NextRequest } from 'next/server';
import { success, error, requireAdmin } from '@/lib/response';

// ==================== API Endpoint Registry ====================
// Complete API endpoint definitions with metadata

interface ScanEndpoint {
  method: string;
  path: string;
  category: 'public' | 'authenticated' | 'admin';
  description: string;
  params: Record<string, { type: string; required: boolean; description: string }>;
  requestBody?: Record<string, { type: string; required: boolean; description: string }>;
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

function buildCurl(method: string, path: string, category: string, params?: Record<string, any>, body?: Record<string, any>): string {
  const baseUrl = '${BASE_URL}';
  let url = `${baseUrl}${path}`;
  const headers: string[] = [];

  if (category === 'authenticated') {
    headers.push('-H "Authorization: Bearer ${ACCESS_TOKEN}"');
  } else if (category === 'admin') {
    headers.push('-H "Authorization: Bearer ${ADMIN_ACCESS_TOKEN}"');
  }

  // Add query params for GET
  if (method === 'GET' && params) {
    const queryParams = Object.entries(params)
      .filter(([_, v]) => v.required)
      .map(([k]) => `${k}=<value>`)
      .join('&');
    if (queryParams) url += `?${queryParams}`;
  }

  let cmd = `curl -X ${method} "${url}"`;
  headers.forEach(h => { cmd += ` \\\n  ${h}`; });

  if (body && (method === 'POST' || method === 'PUT')) {
    headers.push('-H "Content-Type: application/json"');
    cmd = `curl -X ${method} "${url}"`;
    headers.forEach(h => { cmd += ` \\\n  ${h}`; });
    const bodyObj: Record<string, string> = {};
    Object.entries(body).forEach(([k, v]) => {
      if (v.required) bodyObj[k] = `<${v.type}>`;
    });
    if (Object.keys(bodyObj).length > 0) {
      cmd += ` \\\n  -d '${JSON.stringify(bodyObj)}'`;
    }
  }

  return cmd;
}

const apiScanData: ScanCategory[] = [
  {
    name: '认证授权',
    icon: '🔐',
    color: 'violet',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/auth/login',
        category: 'public',
        description: '邮箱密码登录，含暴力破解防护（5次失败锁定15分钟）',
        params: {},
        requestBody: { email: { type: 'string', required: true, description: '邮箱地址' }, password: { type: 'string', required: true, description: '密码' } },
        responseFields: { access_token: 'string (JWT)', refresh_token: 'string (JWT)', 'user.id': 'string (CUID)', 'user.email': 'string|null', 'user.nickname': 'string', 'user.role': 'string (visitor|user|admin|super_admin)', 'user.avatarUrl': 'string|null', 'user.bio': 'string|null' },
        statusCodes: [{ code: 200, description: '登录成功' }, { code: 400, description: '参数错误' }, { code: 401, description: '邮箱或密码错误' }, { code: 403, description: '账号已被封禁或删除' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/auth/register/email',
        category: 'public',
        description: '邮箱注册（需验证码），自动从邮箱生成昵称',
        params: {},
        requestBody: { email: { type: 'string', required: true, description: '邮箱地址' }, password: { type: 'string', required: true, description: '密码' }, code: { type: 'string', required: true, description: '邮箱验证码' }, nickname: { type: 'string', required: false, description: '昵称（可选）' } },
        responseFields: { access_token: 'string', refresh_token: 'string', 'user.id': 'string', 'user.email': 'string', 'user.nickname': 'string', 'user.role': 'string', 'user.avatarUrl': 'string|null' },
        statusCodes: [{ code: 200, description: '注册成功' }, { code: 400, description: '参数错误或邮箱已注册' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/auth/token/refresh',
        category: 'public',
        description: '刷新JWT令牌对（令牌轮换，旧令牌作废）',
        params: {},
        requestBody: { refresh_token: { type: 'string', required: true, description: '刷新令牌' } },
        responseFields: { access_token: 'string', refresh_token: 'string', expires_in: 'number' },
        statusCodes: [{ code: 200, description: '刷新成功' }, { code: 401, description: '刷新令牌无效或已过期' }],
        authType: '无需鉴权（需refresh_token）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/auth/logout',
        category: 'authenticated',
        description: '退出登录，撤销所有刷新令牌',
        params: {},
        responseFields: {},
        statusCodes: [{ code: 200, description: '退出成功' }, { code: 401, description: '未授权' }],
        authType: 'Bearer Token（用户）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/auth/password',
        category: 'authenticated',
        description: '修改密码（需旧密码验证，限流保护）',
        params: {},
        requestBody: { old_password: { type: 'string', required: true, description: '旧密码' }, new_password: { type: 'string', required: true, description: '新密码' } },
        responseFields: {},
        statusCodes: [{ code: 200, description: '修改成功' }, { code: 400, description: '参数错误' }, { code: 401, description: '旧密码错误' }],
        authType: 'Bearer Token（用户）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/auth/send-code',
        category: 'authenticated',
        description: '发送邮箱验证码（register类型无需登录，bind_email需登录，60秒限流，10分钟有效期）',
        params: {},
        requestBody: { email: { type: 'string', required: true, description: '邮箱地址' }, type: { type: 'string', required: true, description: '类型: register|bind_email|reset_password' } },
        responseFields: { email: 'string', sent: 'boolean', code: 'string (仅开发环境返回)' },
        statusCodes: [{ code: 200, description: '发送成功' }, { code: 429, description: '发送过频，请60秒后重试' }],
        authType: 'Bearer Token（bind_email需要）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/auth/bind-email',
        category: 'authenticated',
        description: '绑定邮箱到微信账号；如邮箱已存在则合并账号（迁移收藏、点赞、评论、历史）',
        params: {},
        requestBody: { email: { type: 'string', required: true, description: '邮箱地址' }, code: { type: 'string', required: true, description: '验证码' } },
        responseFields: { access_token: 'string', refresh_token: 'string', user: 'object', merged: 'boolean' },
        statusCodes: [{ code: 200, description: '绑定成功' }, { code: 400, description: '验证码错误或参数无效' }],
        authType: 'Bearer Token（用户）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/auth/wechat/miniprogram',
        category: 'public',
        description: '微信小程序登录（code2session），新用户自动注册',
        params: {},
        requestBody: { code: { type: 'string', required: true, description: 'wx.login获取的code' }, nickName: { type: 'string', required: false, description: '昵称' }, avatarUrl: { type: 'string', required: false, description: '头像URL' } },
        responseFields: { access_token: 'string', refresh_token: 'string', sign_key: 'string?', sign_key_ref: 'string?', sign_key_expires_at: 'string?', 'user.id': 'string', 'user.openid': 'string', 'user.nickname': 'string', 'user.role': 'string' },
        statusCodes: [{ code: 200, description: '登录成功' }, { code: 400, description: '参数错误' }, { code: 502, description: '微信服务异常' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/auth/wechat/miniprogram/refresh-signkey',
        category: 'authenticated',
        description: '刷新小程序动态签名密钥',
        params: {},
        responseFields: { sign_key: 'string', sign_key_ref: 'string', sign_key_expires_at: 'string' },
        statusCodes: [{ code: 200, description: '刷新成功' }, { code: 401, description: '未授权' }],
        authType: 'Bearer Token（小程序用户）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/auth/social/providers',
        category: 'public',
        description: '获取可用的第三方登录方式列表',
        params: {},
        responseFields: { enabled: 'boolean', 'providers[].type': 'string', 'providers[].name': 'string', 'providers[].icon': 'string' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/auth/social/redirect',
        category: 'public',
        description: '获取第三方登录跳转地址',
        params: { type: { type: 'string', required: true, description: '登录类型: qq/wx/alipay等' } },
        responseFields: { type: 'string', url: 'string', qrcode: 'string|null' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 400, description: '不支持的登录类型' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/auth/social/callback',
        category: 'public',
        description: '第三方登录回调处理（用code换取用户信息并登录/注册）',
        params: { type: { type: 'string', required: true, description: '登录类型' }, code: { type: 'string', required: true, description: '授权码' } },
        responseFields: { access_token: 'string', refresh_token: 'string', user: 'object', provider: 'string', isNewUser: 'boolean' },
        statusCodes: [{ code: 200, description: '登录成功' }, { code: 400, description: '参数错误' }, { code: 502, description: '第三方服务异常' }],
        authType: '无需鉴权',
        curlExample: '',
      },
    ],
  },
  {
    name: '用户中心',
    icon: '👤',
    color: 'emerald',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/user/profile',
        category: 'authenticated',
        description: '获取当前用户个人资料',
        params: {},
        responseFields: { id: 'string', email: 'string|null', nickname: 'string', avatarUrl: 'string|null', bio: 'string|null', role: 'string', status: 'string', createdAt: 'string' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 401, description: '未授权' }],
        authType: 'Bearer Token（用户）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/user/profile',
        category: 'authenticated',
        description: '更新个人资料',
        params: {},
        requestBody: { nickname: { type: 'string', required: false, description: '昵称' }, avatarUrl: { type: 'string', required: false, description: '头像URL' }, bio: { type: 'string', required: false, description: '个人简介' } },
        responseFields: { id: 'string', email: 'string', nickname: 'string', avatarUrl: 'string|null', bio: 'string|null', role: 'string' },
        statusCodes: [{ code: 200, description: '更新成功' }, { code: 400, description: '参数错误' }, { code: 401, description: '未授权' }],
        authType: 'Bearer Token（用户）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/user/browse-history',
        category: 'authenticated',
        description: '获取浏览历史（分页）',
        params: { page: { type: 'number', required: false, description: '页码，默认1' }, pageSize: { type: 'number', required: false, description: '每页数量，默认20' } },
        responseFields: { 'list[].id': 'string', 'list[].workId': 'string', 'list[].work.id': 'string', 'list[].work.title': 'string', 'list[].work.coverUrl': 'string', 'list[].viewedAt': 'string', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 401, description: '未授权' }],
        authType: 'Bearer Token（用户）',
        curlExample: '',
      },
      {
        method: 'DELETE',
        path: '/api/v1/user/browse-history',
        category: 'authenticated',
        description: '清空所有浏览历史',
        params: {},
        responseFields: {},
        statusCodes: [{ code: 200, description: '清空成功' }, { code: 401, description: '未授权' }],
        authType: 'Bearer Token（用户）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/user/favorites',
        category: 'authenticated',
        description: '获取收藏列表（分页）',
        params: { page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' } },
        responseFields: { 'list[].id': 'string', 'list[].workId': 'string', 'list[].work.title': 'string', 'list[].work.coverUrl': 'string', 'list[].createdAt': 'string', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 401, description: '未授权' }],
        authType: 'Bearer Token（用户）',
        curlExample: '',
      },
      {
        method: 'DELETE',
        path: '/api/v1/user/favorites/{workId}',
        category: 'authenticated',
        description: '取消收藏',
        params: { workId: { type: 'string', required: true, description: '作品ID' } },
        responseFields: {},
        statusCodes: [{ code: 200, description: '取消成功' }, { code: 401, description: '未授权' }, { code: 404, description: '未找到收藏记录' }],
        authType: 'Bearer Token（用户）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/user/likes',
        category: 'authenticated',
        description: '获取点赞列表（分页）',
        params: { page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' } },
        responseFields: { 'list[].id': 'string', 'list[].workId': 'string', 'list[].work.title': 'string', 'list[].createdAt': 'string', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 401, description: '未授权' }],
        authType: 'Bearer Token（用户）',
        curlExample: '',
      },
    ],
  },
  {
    name: '分类（公开）',
    icon: '📁',
    color: 'amber',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/categories',
        category: 'public',
        description: '获取分类扁平列表（含作品数量）',
        params: {},
        responseFields: { 'id': 'string', 'name': 'string', 'parentId': 'string|null', 'coverUrl': 'string|null', 'sortOrder': 'number', 'level': 'number', 'workCount': 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/categories/tree',
        category: 'public',
        description: '获取分类树形结构（递归子分类）',
        params: {},
        responseFields: { 'id': 'string', 'name': 'string', 'parentId': 'string|null', 'coverUrl': 'string|null', 'sortOrder': 'number', 'level': 'number', 'workCount': 'number', 'children': 'CategoryNode[]' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '无需鉴权',
        curlExample: '',
      },
    ],
  },
  {
    name: '作品（公开）',
    icon: '🖼️',
    color: 'sky',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/works',
        category: 'public',
        description: '获取作品列表（支持分类、标签、搜索、排序）',
        params: { page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' }, category_id: { type: 'string', required: false, description: '分类ID' }, tag: { type: 'string', required: false, description: '标签' }, search: { type: 'string', required: false, description: '搜索关键词' }, sort: { type: 'string', required: false, description: '排序: latest|featured|popular' } },
        responseFields: { 'list[].id': 'string', 'list[].title': 'string', 'list[].coverUrl': 'string|null', 'list[].categoryId': 'string|null', 'list[].tags': 'string[]', 'list[].isFeatured': 'boolean', 'list[].likeCount': 'number', 'list[].favoriteCount': 'number', 'list[].viewCount': 'number', 'list[].commentCount': 'number', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/works/featured',
        category: 'public',
        description: '获取精选作品（最多20个）',
        params: {},
        responseFields: { 'id': 'string', 'title': 'string', 'coverUrl': 'string|null', 'tags': 'string[]', 'likeCount': 'number', 'favoriteCount': 'number', 'viewCount': 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/works/{id}',
        category: 'public',
        description: '获取作品详情（自动增加浏览量，记录浏览历史）',
        params: { id: { type: 'string', required: true, description: '作品ID' } },
        responseFields: { id: 'string', title: 'string', description: 'string|null', images: 'string[]', coverUrl: 'string|null', categoryId: 'string|null', category: 'object', tags: 'string[]', params: 'object|null', location: 'string|null', latitude: 'number|null', longitude: 'number|null', isFeatured: 'boolean', status: 'string', likeCount: 'number', favoriteCount: 'number', viewCount: 'number', commentCount: 'number', aiTags: 'array', createdAt: 'string', updatedAt: 'string' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 404, description: '作品不存在' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/works/{id}/like',
        category: 'public',
        description: '检查是否已点赞（未登录返回false）',
        params: { id: { type: 'string', required: true, description: '作品ID' } },
        responseFields: { liked: 'boolean' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '可选鉴权（未登录返回liked=false）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/works/{id}/like',
        category: 'authenticated',
        description: '点赞作品（幂等操作）',
        params: { id: { type: 'string', required: true, description: '作品ID' } },
        responseFields: { liked: 'boolean' },
        statusCodes: [{ code: 200, description: '点赞成功' }, { code: 401, description: '未授权' }, { code: 404, description: '作品不存在' }],
        authType: 'Bearer Token（用户）',
        curlExample: '',
      },
      {
        method: 'DELETE',
        path: '/api/v1/works/{id}/like',
        category: 'authenticated',
        description: '取消点赞',
        params: { id: { type: 'string', required: true, description: '作品ID' } },
        responseFields: { liked: 'boolean' },
        statusCodes: [{ code: 200, description: '取消成功' }, { code: 401, description: '未授权' }],
        authType: 'Bearer Token（用户）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/works/{id}/favorite',
        category: 'public',
        description: '检查是否已收藏（未登录返回false）',
        params: { id: { type: 'string', required: true, description: '作品ID' } },
        responseFields: { favorited: 'boolean' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '可选鉴权',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/works/{id}/favorite',
        category: 'authenticated',
        description: '收藏作品（幂等操作）',
        params: { id: { type: 'string', required: true, description: '作品ID' } },
        responseFields: { favorited: 'boolean' },
        statusCodes: [{ code: 200, description: '收藏成功' }, { code: 401, description: '未授权' }, { code: 404, description: '作品不存在' }],
        authType: 'Bearer Token（用户）',
        curlExample: '',
      },
      {
        method: 'DELETE',
        path: '/api/v1/works/{id}/favorite',
        category: 'authenticated',
        description: '取消收藏',
        params: { id: { type: 'string', required: true, description: '作品ID' } },
        responseFields: { favorited: 'boolean' },
        statusCodes: [{ code: 200, description: '取消成功' }, { code: 401, description: '未授权' }],
        authType: 'Bearer Token（用户）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/works/{id}/qrcode',
        category: 'public',
        description: '获取作品分享小程序码',
        params: { id: { type: 'string', required: true, description: '作品ID' }, env_version: { type: 'string', required: false, description: '版本: release|trial|develop' }, width: { type: 'number', required: false, description: '宽度' }, force: { type: 'string', required: false, description: 'true=重新生成' } },
        responseFields: { 'QR code data from WeChat API': '' },
        statusCodes: [{ code: 200, description: '生成成功' }, { code: 404, description: '作品不存在' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/works/search',
        category: 'public',
        description: '搜索作品（标题/描述）',
        params: { q: { type: 'string', required: true, description: '搜索关键词' }, category_id: { type: 'string', required: false, description: '分类ID' }, sort: { type: 'string', required: false, description: '排序: latest|popular|most_liked' }, page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' } },
        responseFields: { 'list[]': '同作品列表字段', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '搜索成功' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/works/by-tag',
        category: 'public',
        description: '按标签获取作品列表',
        params: { tag: { type: 'string', required: true, description: '标签名' }, page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' } },
        responseFields: { 'list[]': '同作品列表字段', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '无需鉴权',
        curlExample: '',
      },
    ],
  },
  {
    name: '评论',
    icon: '💬',
    color: 'pink',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/comments',
        category: 'public',
        description: '获取评论列表（公开，管理员可按status过滤）',
        params: { work_id: { type: 'string', required: true, description: '作品ID（必填）' }, status: { type: 'string', required: false, description: '状态（管理员）' }, page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' } },
        responseFields: { 'list[].id': 'string', 'list[].workId': 'string', 'list[].content': 'string', 'list[].status': 'string', 'list[].authorName': 'string', 'list[].authorAvatar': 'string|null', 'list[].createdAt': 'string', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 400, description: '缺少work_id' }],
        authType: '无需鉴权（管理员可过滤）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/comments',
        category: 'public',
        description: '提交评论（登录用户或游客，管理员免审核）',
        params: {},
        requestBody: { work_id: { type: 'string', required: true, description: '作品ID' }, content: { type: 'string', required: true, description: '评论内容' }, guest_name: { type: 'string', required: false, description: '游客名称' }, guest_email: { type: 'string', required: false, description: '游客邮箱' } },
        responseFields: { id: 'string', workId: 'string', content: 'string', status: 'string', authorName: 'string', authorAvatar: 'string|null' },
        statusCodes: [{ code: 200, description: '发表成功' }, { code: 400, description: '参数错误' }],
        authType: '可选鉴权（游客需提供name+email）',
        curlExample: '',
      },
      {
        method: 'DELETE',
        path: '/api/v1/comments/{id}',
        category: 'authenticated',
        description: '删除评论（管理员/评论作者/游客邮箱验证）',
        params: { id: { type: 'string', required: true, description: '评论ID' }, guest_email: { type: 'string', required: false, description: '游客邮箱（删除游客评论）' } },
        responseFields: {},
        statusCodes: [{ code: 200, description: '删除成功' }, { code: 401, description: '未授权' }, { code: 403, description: '无权限' }, { code: 404, description: '评论不存在' }],
        authType: 'Bearer Token 或 游客邮箱验证',
        curlExample: '',
      },
    ],
  },
  {
    name: 'AI标签',
    icon: '🤖',
    color: 'indigo',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/ai-tags',
        category: 'public',
        description: '获取AI标签列表（非管理员只看approved）',
        params: { work_id: { type: 'string', required: false, description: '作品ID' }, audit_status: { type: 'string', required: false, description: '审核状态（管理员）' }, page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' } },
        responseFields: { 'list[].id': 'string', 'list[].workId': 'string', 'list[].tagName': 'string', 'list[].confidence': 'number', 'list[].auditStatus': 'string', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '无需鉴权（管理员可过滤）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/ai-tags/pending',
        category: 'admin',
        description: '获取待审核AI标签（最多100条）',
        params: {},
        responseFields: { 'id': 'string', 'workId': 'string', 'tagName': 'string', 'confidence': 'number', 'auditStatus': 'string', 'work.id': 'string', 'work.title': 'string', 'work.coverUrl': 'string' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/ai-tags/batch-recognize',
        category: 'admin',
        description: '批量触发AI标签识别',
        params: {},
        requestBody: { work_ids: { type: 'string[]', required: true, description: '作品ID数组' } },
        responseFields: { taskId: 'string', totalCount: 'number', completedCount: 'number', failedCount: 'number', totalImages: 'number' },
        statusCodes: [{ code: 200, description: '触发成功' }, { code: 400, description: '参数错误' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/ai-tags/batch-review',
        category: 'admin',
        description: '批量审核AI标签（通过/拒绝/删除）',
        params: {},
        requestBody: { tag_ids: { type: 'string[]', required: true, description: '标签ID数组' }, action: { type: 'string', required: true, description: '操作: approve|reject|delete' } },
        responseFields: { count: 'number' },
        statusCodes: [{ code: 200, description: '操作成功' }, { code: 400, description: '参数错误' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'DELETE',
        path: '/api/v1/ai-tags',
        category: 'admin',
        description: '删除AI标签',
        params: { id: { type: 'string', required: true, description: '标签ID' } },
        responseFields: {},
        statusCodes: [{ code: 200, description: '删除成功' }, { code: 400, description: '参数错误' }, { code: 403, description: '需要管理员权限' }, { code: 404, description: '标签不存在' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '配置管理',
    icon: '⚙️',
    color: 'slate',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/configs/public',
        category: 'public',
        description: '获取公开配置项（非加密，公开分组）',
        params: {},
        responseFields: { '[key]': 'string (键值对)' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/configs/group/{group}',
        category: 'admin',
        description: '获取指定分组所有配置项',
        params: { group: { type: 'string', required: true, description: '分组名称' } },
        responseFields: { 'id': 'string', 'key': 'string', 'value': 'string', 'isEncrypted': 'boolean', 'group': 'string', 'description': 'string' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/configs/item/{key}',
        category: 'admin',
        description: '更新指定配置项值（自动应用运行时变更）',
        params: { key: { type: 'string', required: true, description: '配置项键名' } },
        requestBody: { value: { type: 'string', required: true, description: '配置值' } },
        responseFields: { key: 'string', value: 'string', group: 'string', description: 'string', isEncrypted: 'boolean' },
        statusCodes: [{ code: 200, description: '更新成功' }, { code: 400, description: '参数错误' }, { code: 403, description: '需要管理员权限' }, { code: 404, description: '配置项不存在' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '预约/联系',
    icon: '📷',
    color: 'rose',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/booking/info',
        category: 'public',
        description: '获取约拍公开配置信息',
        params: {},
        responseFields: { '[key]': 'string (键值对)' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/booking/contact',
        category: 'public',
        description: '提交约拍/联系留言（IP限流）',
        params: {},
        requestBody: { name: { type: 'string', required: false, description: '姓名' }, email: { type: 'string', required: false, description: '邮箱' }, phone: { type: 'string', required: false, description: '电话' }, message: { type: 'string', required: true, description: '留言内容' } },
        responseFields: { id: 'string' },
        statusCodes: [{ code: 200, description: '提交成功' }, { code: 400, description: '参数错误' }],
        authType: '无需鉴权（可选登录）',
        curlExample: '',
      },
    ],
  },
  {
    name: '上传服务',
    icon: '📤',
    color: 'teal',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/upload/serve/{...path}',
        category: 'public',
        description: '静态文件服务（读取本地uploads目录的文件，1年缓存）',
        params: { path: { type: 'string', required: true, description: '文件路径片段' } },
        responseFields: { 'binary': '文件二进制流（带Content-Type）' },
        statusCodes: [{ code: 200, description: '文件内容' }, { code: 404, description: '文件不存在' }, { code: 403, description: '路径遍历被拒绝' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/upload/avatar',
        category: 'authenticated',
        description: '上传用户头像（支持COS与本地存储，最大5MB）',
        params: {},
        requestBody: { file: { type: 'File', required: true, description: '图片文件（JPG/PNG/GIF/WebP，最大5MB）' } },
        responseFields: { url: 'string' },
        statusCodes: [{ code: 200, description: '上传成功' }, { code: 400, description: '文件格式不支持或大小超限' }, { code: 401, description: '未授权' }],
        authType: 'Bearer Token（用户）',
        curlExample: '',
      },
    ],
  },
  {
    name: '统计/其他',
    icon: '📊',
    color: 'teal',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/stats/public',
        category: 'public',
        description: '获取公开统计数据（作品数、分类数、浏览量等）',
        params: {},
        responseFields: { workCount: 'number', categoryCount: 'number', totalViews: 'number', totalLikes: 'number', totalFavorites: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/hitokoto',
        category: 'public',
        description: '获取一言（随机语录，5分钟缓存，降级到本地语录）',
        params: { no_cache: { type: 'string', required: false, description: '1=强制刷新' } },
        responseFields: { text: 'string', from: 'string', from_who: 'string|null' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/footprint',
        category: 'public',
        description: '获取足迹地图数据（含GPS的作品列表，10分钟Redis缓存）',
        params: {},
        responseFields: { 'id': 'string', 'title': 'string', 'coverUrl': 'string|null', 'latitude': 'number', 'longitude': 'number', 'location': 'string|null', 'takenAt': 'string|null', 'sortTime': 'string', 'category.id': 'string', 'category.name': 'string' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/changelog',
        category: 'public',
        description: '获取已发布的版本更新记录',
        params: { limit: { type: 'number', required: false, description: '数量（1-50，默认20）' } },
        responseFields: { 'id': 'string', 'version': 'string', 'title': 'string', 'content': 'string', 'type': 'string', 'publishedAt': 'string', 'createdAt': 'string' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api',
        category: 'public',
        description: '健康检查 / Hello World',
        params: {},
        responseFields: { message: 'string' },
        statusCodes: [{ code: 200, description: '服务正常' }],
        authType: '无需鉴权',
        curlExample: '',
      },
    ],
  },
  {
    name: 'SEO',
    icon: '🌐',
    color: 'cyan',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/seo/robots.txt',
        category: 'public',
        description: '生成robots.txt',
        params: {},
        responseFields: { 'content': 'text/plain' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '无需鉴权',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/seo/sitemap.xml',
        category: 'public',
        description: '生成XML站点地图（已发布作品和分类）',
        params: {},
        responseFields: { 'content': 'application/xml' },
        statusCodes: [{ code: 200, description: '获取成功' }],
        authType: '无需鉴权',
        curlExample: '',
      },
    ],
  },
  {
    name: '地图服务',
    icon: '🗺️',
    color: 'orange',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/amap/test',
        category: 'admin',
        description: '测试高德地图API Key配置是否有效',
        params: {},
        responseFields: { apiValid: 'boolean', 'results.apiKey.valid': 'boolean', 'results.apiKey.message': 'string', 'results.jsKey.configured': 'boolean', 'results.securityKey.configured': 'boolean' },
        statusCodes: [{ code: 200, description: '测试完成' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/amap/reverse-geocode',
        category: 'admin',
        description: '逆地理编码（经纬度转地址，7天缓存）',
        params: { lat: { type: 'number', required: true, description: '纬度' }, lng: { type: 'number', required: true, description: '经度' } },
        responseFields: { location: 'string', lat: 'number', lng: 'number', cached: 'boolean', 'raw.province': 'string', 'raw.city': 'string', 'raw.district': 'string', 'raw.formatted_address': 'string' },
        statusCodes: [{ code: 200, description: '查询成功' }, { code: 400, description: '缺少经纬度参数' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '监控/前端错误',
    icon: '📡',
    color: 'rose',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/monitor/frontend-error',
        category: 'public',
        description: '上报前端错误（自动触发AI分析）',
        params: {},
        requestBody: { error_message: { type: 'string', required: true, description: '错误信息' }, error_stack: { type: 'string', required: false, description: '错误堆栈' }, source: { type: 'string', required: false, description: '来源' }, page_path: { type: 'string', required: false, description: '页面路径' }, user_agent: { type: 'string', required: false, description: '浏览器UA' } },
        responseFields: { id: 'string', aiAnalysisTriggered: 'boolean' },
        statusCodes: [{ code: 200, description: '上报成功' }],
        authType: '可选鉴权',
        curlExample: '',
      },
    ],
  },
  {
    name: '仪表盘',
    icon: '📈',
    color: 'blue',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/dashboard/overview',
        category: 'admin',
        description: '仪表盘概览统计',
        params: {},
        responseFields: { totalWorks: 'number', publishedWorks: 'number', totalUsers: 'number', totalViews: 'number', totalLikes: 'number', totalComments: 'number', latestVersion: 'string|null', 'today.views': 'number', 'today.likes': 'number', 'today.favorites': 'number', 'today.comments': 'number', 'today.newWorks': 'number', 'today.newUsers': 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/dashboard/trend',
        category: 'admin',
        description: '每日趋势数据（近N天）',
        params: { days: { type: 'number', required: false, description: '天数（1-90，默认7）' } },
        responseFields: { 'date': 'string', 'views': 'number', 'likes': 'number', 'favorites': 'number', 'comments': 'number', 'newWorks': 'number', 'newUsers': 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/dashboard/top-works',
        category: 'admin',
        description: '热门作品排行',
        params: { limit: { type: 'number', required: false, description: '数量（1-50，默认10）' }, by: { type: 'string', required: false, description: '排序: views|likes|favorites' } },
        responseFields: { 'id': 'string', 'title': 'string', 'coverUrl': 'string|null', 'category.id': 'string', 'category.name': 'string', 'likeCount': 'number', 'favoriteCount': 'number', 'viewCount': 'number', 'commentCount': 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '缓存管理',
    icon: '🗄️',
    color: 'green',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/cache/stats',
        category: 'admin',
        description: '获取缓存统计信息',
        params: {},
        responseFields: { redisConnected: 'boolean', redisInfo: 'object|null', memoryInfo: 'object|null', keyspaceInfo: 'object|null' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/cache/keys',
        category: 'admin',
        description: '获取缓存键列表（支持前缀过滤）',
        params: { prefix: { type: 'string', required: false, description: '键前缀' } },
        responseFields: { 'keys[]': 'string' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'DELETE',
        path: '/api/v1/cache/keys/{key}',
        category: 'admin',
        description: '删除指定缓存键',
        params: { key: { type: 'string', required: true, description: '缓存键（URL编码）' } },
        responseFields: { key: 'string', deleted: 'boolean' },
        statusCodes: [{ code: 200, description: '删除成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/cache/redis-info',
        category: 'admin',
        description: '获取Redis详细信息',
        params: {},
        responseFields: { connected: 'boolean', serverInfo: 'object|null', memoryInfo: 'object|null', commandStats: 'object|null' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'DELETE',
        path: '/api/v1/cache/clear',
        category: 'admin',
        description: '清除缓存（支持按key、prefix或清空全部）',
        params: { key: { type: 'string', required: false, description: '指定键' }, prefix: { type: 'string', required: false, description: '键前缀' } },
        responseFields: { deleted: 'boolean', clearedKeys: 'number' },
        statusCodes: [{ code: 200, description: '清除成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '管理 - 监控',
    icon: '📡',
    color: 'red',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/monitor/api-errors',
        category: 'admin',
        description: '获取API错误列表',
        params: { status_code: { type: 'number', required: false, description: 'HTTP状态码' }, api_path: { type: 'string', required: false, description: 'API路径' }, method: { type: 'string', required: false, description: 'HTTP方法' }, page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' } },
        responseFields: { 'list[]': 'API错误记录', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'DELETE',
        path: '/api/v1/monitor/api-errors',
        category: 'admin',
        description: '清理旧API错误记录',
        params: { days: { type: 'number', required: false, description: '清理多少天前的（默认7）' } },
        responseFields: { count: 'number' },
        statusCodes: [{ code: 200, description: '清理成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/monitor/errors',
        category: 'admin',
        description: '获取前端错误列表',
        params: { page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' } },
        responseFields: { 'list[]': '前端错误记录', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/monitor/overview',
        category: 'admin',
        description: '获取监控概览（API调用统计、慢接口、错误分布、缓存状态）',
        params: {},
        responseFields: { apiMonitor: 'object', apiErrors: 'object', cache: 'object' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '管理 - 作品',
    icon: '🛡️',
    color: 'red',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/admin/works',
        category: 'admin',
        description: '管理员作品列表（含所有状态）',
        params: { page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' }, status: { type: 'string', required: false, description: '状态' }, category_id: { type: 'string', required: false, description: '分类ID' }, search: { type: 'string', required: false, description: '搜索' }, featured: { type: 'string', required: false, description: '精选' } },
        responseFields: { 'list[]': '作品对象（含分类信息）', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/admin/works',
        category: 'admin',
        description: '创建作品',
        params: {},
        requestBody: { title: { type: 'string', required: true, description: '标题' }, description: { type: 'string', required: false, description: '描述' }, images: { type: 'string[]', required: true, description: '图片URL数组' }, category_id: { type: 'string', required: false, description: '分类ID' }, tags: { type: 'string[]', required: false, description: '标签' }, is_featured: { type: 'boolean', required: false, description: '是否精选' }, status: { type: 'string', required: false, description: '状态' }, location: { type: 'string', required: false, description: '地点' }, latitude: { type: 'number', required: false, description: '纬度' }, longitude: { type: 'number', required: false, description: '经度' } },
        responseFields: { 'created work': '完整作品对象' },
        statusCodes: [{ code: 200, description: '创建成功' }, { code: 400, description: '参数错误' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/admin/works/{id}',
        category: 'admin',
        description: '获取作品详情（管理端，含所有状态）',
        params: { id: { type: 'string', required: true, description: '作品ID' } },
        responseFields: { 'work detail with category': '' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }, { code: 404, description: '作品不存在' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/works/{id}',
        category: 'admin',
        description: '更新作品',
        params: { id: { type: 'string', required: true, description: '作品ID' } },
        requestBody: { title: { type: 'string', required: false, description: '标题' }, description: { type: 'string', required: false, description: '描述' }, images: { type: 'string[]', required: false, description: '图片' } },
        responseFields: { 'updated work': '更新后的作品对象' },
        statusCodes: [{ code: 200, description: '更新成功' }, { code: 400, description: '参数错误' }, { code: 403, description: '需要管理员权限' }, { code: 404, description: '作品不存在' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'DELETE',
        path: '/api/v1/admin/works/{id}',
        category: 'admin',
        description: '软删除作品（清理关联数据）',
        params: { id: { type: 'string', required: true, description: '作品ID' } },
        responseFields: {},
        statusCodes: [{ code: 200, description: '删除成功' }, { code: 403, description: '需要管理员权限' }, { code: 404, description: '作品不存在' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/works/{id}/featured',
        category: 'admin',
        description: '切换作品精选状态',
        params: { id: { type: 'string', required: true, description: '作品ID' } },
        responseFields: { isFeatured: 'boolean' },
        statusCodes: [{ code: 200, description: '切换成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/admin/works/{id}/ai-tag-trigger',
        category: 'admin',
        description: '触发单个作品的AI标签识别',
        params: { id: { type: 'string', required: true, description: '作品ID' } },
        responseFields: { tags: 'array', imageCount: 'number' },
        statusCodes: [{ code: 200, description: '触发成功' }, { code: 403, description: '需要管理员权限' }, { code: 404, description: '作品不存在' }, { code: 503, description: 'AI服务不可用' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/admin/works/{id}/refresh-exif',
        category: 'admin',
        description: '重新获取作品EXIF信息',
        params: { id: { type: 'string', required: true, description: '作品ID' } },
        responseFields: { work: '更新后的作品', 'result.totalImages': 'number', 'result.successCount': 'number', 'result.failCount': 'number' },
        statusCodes: [{ code: 200, description: '刷新成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '管理 - 分类',
    icon: '📂',
    color: 'yellow',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/admin/categories',
        category: 'admin',
        description: '创建分类（自动计算层级）',
        params: {},
        requestBody: { name: { type: 'string', required: true, description: '分类名' }, parent_id: { type: 'string', required: false, description: '父分类ID' }, cover_url: { type: 'string', required: false, description: '封面URL' }, sort_order: { type: 'number', required: false, description: '排序' } },
        responseFields: { 'category': '分类对象' },
        statusCodes: [{ code: 200, description: '创建成功' }, { code: 400, description: '参数错误' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/categories/{id}',
        category: 'admin',
        description: '更新分类',
        params: { id: { type: 'string', required: true, description: '分类ID' } },
        requestBody: { name: { type: 'string', required: false, description: '分类名' }, parent_id: { type: 'string', required: false, description: '父分类ID' }, cover_url: { type: 'string', required: false, description: '封面URL' }, sort_order: { type: 'number', required: false, description: '排序' } },
        responseFields: { 'category': '更新后的分类对象' },
        statusCodes: [{ code: 200, description: '更新成功' }, { code: 400, description: '参数错误' }, { code: 403, description: '需要管理员权限' }, { code: 404, description: '分类不存在' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'DELETE',
        path: '/api/v1/admin/categories/{id}',
        category: 'admin',
        description: '软删除分类',
        params: { id: { type: 'string', required: true, description: '分类ID' } },
        responseFields: {},
        statusCodes: [{ code: 200, description: '删除成功' }, { code: 403, description: '需要管理员权限' }, { code: 404, description: '分类不存在' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/categories/sort',
        category: 'admin',
        description: '批量更新分类排序',
        params: {},
        requestBody: { items: { type: 'array', required: true, description: '[{id, sort_order}]' } },
        responseFields: {},
        statusCodes: [{ code: 200, description: '排序成功' }, { code: 400, description: '参数错误' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '管理 - 用户',
    icon: '👥',
    color: 'purple',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/admin/users',
        category: 'admin',
        description: '用户列表（支持搜索、角色、状态过滤）',
        params: { search: { type: 'string', required: false, description: '搜索' }, role: { type: 'string', required: false, description: '角色' }, status: { type: 'string', required: false, description: '状态' }, page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' } },
        responseFields: { 'list[].id': 'string', 'list[].email': 'string|null', 'list[].nickname': 'string', 'list[].role': 'string', 'list[].status': 'string', 'list[].avatarUrl': 'string|null', 'list[].createdAt': 'string', 'list[]._count.likes': 'number', 'list[]._count.favorites': 'number', 'list[]._count.comments': 'number', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/admin/users/{id}',
        category: 'admin',
        description: '获取用户详情（openid/unionid脱敏）',
        params: { id: { type: 'string', required: true, description: '用户ID' } },
        responseFields: { 'user detail with masked openid/unionid and _count': '' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }, { code: 404, description: '用户不存在' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/users/{id}/nickname',
        category: 'admin',
        description: '修改用户昵称',
        params: { id: { type: 'string', required: true, description: '用户ID' } },
        requestBody: { nickname: { type: 'string', required: true, description: '新昵称' } },
        responseFields: { id: 'string', nickname: 'string', email: 'string', avatarUrl: 'string|null', role: 'string', status: 'string' },
        statusCodes: [{ code: 200, description: '更新成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/users/{id}/email',
        category: 'admin',
        description: '修改用户邮箱',
        params: { id: { type: 'string', required: true, description: '用户ID' } },
        requestBody: { email: { type: 'string', required: true, description: '新邮箱' } },
        responseFields: { id: 'string', nickname: 'string', email: 'string', role: 'string', status: 'string' },
        statusCodes: [{ code: 200, description: '更新成功' }, { code: 400, description: '邮箱已被使用' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/users/{id}/status',
        category: 'admin',
        description: '修改用户状态（不能修改自己，super_admin才能操作super_admin）',
        params: { id: { type: 'string', required: true, description: '用户ID' } },
        requestBody: { status: { type: 'string', required: true, description: 'active|banned|deleted' } },
        responseFields: { id: 'string', nickname: 'string', email: 'string', role: 'string', status: 'string' },
        statusCodes: [{ code: 200, description: '更新成功' }, { code: 400, description: '不能修改自身状态' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/users/{id}/role',
        category: 'admin',
        description: '修改用户角色（仅super_admin可操作）',
        params: { id: { type: 'string', required: true, description: '用户ID' } },
        requestBody: { role: { type: 'string', required: true, description: 'user|admin|super_admin' } },
        responseFields: { id: 'string', nickname: 'string', email: 'string', role: 'string' },
        statusCodes: [{ code: 200, description: '修改成功' }, { code: 400, description: '不能修改自身角色' }, { code: 403, description: '需要超级管理员权限' }],
        authType: 'Bearer Token（仅super_admin）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/users/{id}/reset-password',
        category: 'admin',
        description: '重置用户密码（操作其他管理员需super_admin）',
        params: { id: { type: 'string', required: true, description: '用户ID' } },
        requestBody: { new_password: { type: 'string', required: true, description: '新密码（至少8位）' } },
        responseFields: {},
        statusCodes: [{ code: 200, description: '重置成功' }, { code: 403, description: '权限不足' }, { code: 404, description: '用户不存在' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '管理 - 评论',
    icon: '📝',
    color: 'fuchsia',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/admin/comments',
        category: 'admin',
        description: '管理员评论列表（含筛选）',
        params: { status: { type: 'string', required: false, description: '状态' }, search: { type: 'string', required: false, description: '搜索' }, page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' } },
        responseFields: { 'list[]': '评论对象（含用户和作品信息）', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/comments/{id}/status',
        category: 'admin',
        description: '更新评论审核状态和可见性',
        params: { id: { type: 'string', required: true, description: '评论ID' } },
        requestBody: { status: { type: 'string', required: false, description: '审核状态' }, is_visible: { type: 'boolean', required: false, description: '是否可见' } },
        responseFields: { 'updated comment': '更新后的评论对象' },
        statusCodes: [{ code: 200, description: '更新成功' }, { code: 403, description: '需要管理员权限' }, { code: 404, description: '评论不存在' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '管理 - 上传',
    icon: '📤',
    color: 'teal',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/admin/upload',
        category: 'admin',
        description: '上传图片（管理端，自动提取EXIF）',
        params: {},
        requestBody: { file: { type: 'File', required: true, description: '图片文件' } },
        responseFields: { url: 'string', filename: 'string', size: 'number', type: 'string', exif: 'object|null' },
        statusCodes: [{ code: 200, description: '上传成功' }, { code: 400, description: '参数错误' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/admin/upload/test-cos',
        category: 'admin',
        description: '测试腾讯云COS连接',
        params: {},
        requestBody: { bucket: { type: 'string', required: true, description: '存储桶' }, region: { type: 'string', required: true, description: '区域' }, secret_id: { type: 'string', required: true, description: 'SecretId' }, secret_key: { type: 'string', required: true, description: 'SecretKey' } },
        responseFields: { connected: 'boolean' },
        statusCodes: [{ code: 200, description: '测试完成' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/admin/fetch-exif',
        category: 'admin',
        description: '从远程图片URL获取EXIF信息',
        params: {},
        requestBody: { url: { type: 'string', required: true, description: '图片URL' } },
        responseFields: { exif: 'object|null' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '管理 - AI模型',
    icon: '⚡',
    color: 'lime',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/admin/ai-models',
        category: 'admin',
        description: '获取AI模型列表（含内置模型，API Key脱敏）',
        params: {},
        responseFields: { 'models[]': 'AI模型对象（apiKey脱敏）', builtinModel: 'object' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/admin/ai-models',
        category: 'admin',
        description: '创建AI模型',
        params: {},
        requestBody: { name: { type: 'string', required: true, description: '名称' }, api_url: { type: 'string', required: true, description: 'API地址' }, api_key: { type: 'string', required: true, description: 'API Key' }, model_type: { type: 'string', required: false, description: '模型类型' }, model_name: { type: 'string', required: false, description: '模型名称' }, sort_order: { type: 'number', required: false, description: '排序' }, is_enabled: { type: 'boolean', required: false, description: '是否启用' } },
        responseFields: { 'aiModel': 'AI模型对象' },
        statusCodes: [{ code: 200, description: '创建成功' }, { code: 400, description: '参数错误' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/ai-models/{id}',
        category: 'admin',
        description: '更新AI模型',
        params: { id: { type: 'string', required: true, description: '模型ID' } },
        requestBody: { name: { type: 'string', required: false, description: '名称' }, api_url: { type: 'string', required: false, description: 'API地址' }, api_key: { type: 'string', required: false, description: 'API Key' } },
        responseFields: { 'aiModel': '更新后的AI模型对象' },
        statusCodes: [{ code: 200, description: '更新成功' }, { code: 403, description: '需要管理员权限' }, { code: 404, description: '模型不存在' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'DELETE',
        path: '/api/v1/admin/ai-models/{id}',
        category: 'admin',
        description: '删除AI模型',
        params: { id: { type: 'string', required: true, description: '模型ID' } },
        responseFields: {},
        statusCodes: [{ code: 200, description: '删除成功' }, { code: 403, description: '需要管理员权限' }, { code: 404, description: '模型不存在' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/ai-models/{id}/toggle',
        category: 'admin',
        description: '切换AI模型启用/禁用状态',
        params: { id: { type: 'string', required: true, description: '模型ID' } },
        responseFields: { id: 'string', isEnabled: 'boolean' },
        statusCodes: [{ code: 200, description: '切换成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/admin/ai-models/{id}/test',
        category: 'admin',
        description: '测试AI模型连接',
        params: { id: { type: 'string', required: true, description: '模型ID或builtin-z-ai-sdk' } },
        responseFields: { success: 'boolean', latency: 'number', response: 'string?', model: 'string?', error: 'string?' },
        statusCodes: [{ code: 200, description: '测试完成' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '管理 - AI错误分析',
    icon: '🔍',
    color: 'stone',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/admin/ai-error-analyses',
        category: 'admin',
        description: '获取AI错误分析列表',
        params: { status: { type: 'string', required: false, description: '状态' }, page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' } },
        responseFields: { 'list[]': 'AI错误分析记录', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/admin/ai-error-analyses/{id}',
        category: 'admin',
        description: '获取AI错误分析详情',
        params: { id: { type: 'string', required: true, description: '记录ID' } },
        responseFields: { 'aiErrorAnalysis detail': '' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }, { code: 404, description: '记录不存在' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/admin/ai-error-analyses/{id}/analyze',
        category: 'admin',
        description: '触发AI错误分析（异步）',
        params: { id: { type: 'string', required: true, description: '记录ID' } },
        responseFields: { 'updated aiErrorAnalysis': '' },
        statusCodes: [{ code: 200, description: '触发成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/ai-error-analyses/{id}/status',
        category: 'admin',
        description: '更新AI错误分析状态',
        params: { id: { type: 'string', required: true, description: '记录ID' } },
        requestBody: { analysis_status: { type: 'string', required: true, description: 'pending|analyzed|resolved' } },
        responseFields: { 'updated aiErrorAnalysis': '' },
        statusCodes: [{ code: 200, description: '更新成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/admin/ai-error-analysis',
        category: 'admin',
        description: '获取AI错误分析列表（支持error_type过滤）',
        params: { status: { type: 'string', required: false, description: '状态' }, error_type: { type: 'string', required: false, description: '错误类型' }, page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' } },
        responseFields: { 'list[]': 'AI错误分析记录', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/admin/ai-error-analysis',
        category: 'admin',
        description: '手动创建AI错误分析记录并触发分析',
        params: {},
        requestBody: { error_message: { type: 'string', required: true, description: '错误信息' }, error_stack: { type: 'string', required: false, description: '错误堆栈' }, request_url: { type: 'string', required: false, description: '请求URL' }, error_type: { type: 'string', required: false, description: '错误类型' }, context: { type: 'object', required: false, description: '上下文' } },
        responseFields: { id: 'string', analysisStatus: 'string', aiAnalysis: 'string?' },
        statusCodes: [{ code: 200, description: '创建成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/admin/ai-error-analysis/{id}',
        category: 'admin',
        description: '获取AI错误分析详情（另一路径）',
        params: { id: { type: 'string', required: true, description: '记录ID' } },
        responseFields: { 'aiErrorAnalysis detail': '' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '管理 - 审计日志',
    icon: '📋',
    color: 'neutral',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/admin/audit',
        category: 'admin',
        description: '获取审计日志列表',
        params: { action: { type: 'string', required: false, description: '操作类型' }, page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' } },
        responseFields: { 'list[]': '审计日志（含管理员信息）', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '管理 - 版本日志',
    icon: '🚀',
    color: 'sky',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/admin/changelog',
        category: 'admin',
        description: '获取版本记录列表（含未发布）',
        params: { type: { type: 'string', required: false, description: '类型' }, is_published: { type: 'string', required: false, description: '是否发布' }, page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' } },
        responseFields: { 'list[]': '版本记录', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'POST',
        path: '/api/v1/admin/changelog',
        category: 'admin',
        description: '新增版本记录',
        params: {},
        requestBody: { version: { type: 'string', required: true, description: '版本号' }, title: { type: 'string', required: true, description: '标题' }, content: { type: 'string', required: true, description: '内容' }, type: { type: 'string', required: false, description: '类型' }, is_published: { type: 'boolean', required: false, description: '是否发布' }, sort_order: { type: 'number', required: false, description: '排序' } },
        responseFields: { 'versionLog': '版本记录对象' },
        statusCodes: [{ code: 200, description: '创建成功' }, { code: 400, description: '参数错误' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'GET',
        path: '/api/v1/admin/changelog/{id}',
        category: 'admin',
        description: '获取单条版本记录',
        params: { id: { type: 'string', required: true, description: '记录ID' } },
        responseFields: { 'versionLog': '版本记录详情' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/changelog/{id}',
        category: 'admin',
        description: '更新版本记录',
        params: { id: { type: 'string', required: true, description: '记录ID' } },
        requestBody: { version: { type: 'string', required: false, description: '版本号' }, title: { type: 'string', required: false, description: '标题' }, content: { type: 'string', required: false, description: '内容' }, is_published: { type: 'boolean', required: false, description: '是否发布' } },
        responseFields: { 'versionLog': '更新后的版本记录' },
        statusCodes: [{ code: 200, description: '更新成功' }, { code: 403, description: '需要管理员权限' }, { code: 404, description: '记录不存在' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'DELETE',
        path: '/api/v1/admin/changelog/{id}',
        category: 'admin',
        description: '删除版本记录',
        params: { id: { type: 'string', required: true, description: '记录ID' } },
        responseFields: {},
        statusCodes: [{ code: 200, description: '删除成功' }, { code: 403, description: '需要管理员权限' }, { code: 404, description: '记录不存在' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '管理 - 约拍留言',
    icon: '✉️',
    color: 'rose',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/admin/booking',
        category: 'admin',
        description: '获取约拍留言列表',
        params: { status: { type: 'string', required: false, description: '状态' }, page: { type: 'number', required: false, description: '页码' }, pageSize: { type: 'number', required: false, description: '每页数量' } },
        responseFields: { 'list[]': '留言对象（含用户信息）', total: 'number', page: 'number', page_size: 'number' },
        statusCodes: [{ code: 200, description: '获取成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/booking/{id}',
        category: 'admin',
        description: '更新约拍留言状态',
        params: { id: { type: 'string', required: true, description: '留言ID' } },
        requestBody: { status: { type: 'string', required: true, description: 'pending|read|replied' } },
        responseFields: { 'updated contact': '更新后的留言对象' },
        statusCodes: [{ code: 200, description: '更新成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
      {
        method: 'DELETE',
        path: '/api/v1/admin/booking/{id}',
        category: 'admin',
        description: '删除约拍留言',
        params: { id: { type: 'string', required: true, description: '留言ID' } },
        responseFields: {},
        statusCodes: [{ code: 200, description: '删除成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
  {
    name: '种子数据',
    icon: '🌱',
    color: 'green',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/seed',
        category: 'admin',
        description: '数据初始化/种子数据（创建管理员、分类、示例作品、默认配置）',
        params: {},
        responseFields: { 'admin.id': 'string', 'admin.email': 'string', 'admin.warning': 'string', categories: 'number', works: 'number', configs: 'number' },
        statusCodes: [{ code: 200, description: '初始化成功' }, { code: 403, description: '需要管理员权限' }],
        authType: 'Bearer Token（管理员）',
        curlExample: '',
      },
    ],
  },
];

// ==================== Scan Logic ====================

// Generate curl examples
apiScanData.forEach(cat => {
  cat.endpoints.forEach(ep => {
    if (!ep.curlExample) {
      ep.curlExample = buildCurl(ep.method, ep.path, ep.category, ep.params, ep.requestBody);
    }
  });
});

// GET /api/v1/admin/api-scan — Return the complete API registry
export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  // Count stats
  let totalEndpoints = 0;
  let publicCount = 0;
  let authCount = 0;
  let adminCount = 0;

  apiScanData.forEach(cat => {
    cat.endpoints.forEach(ep => {
      totalEndpoints++;
      if (ep.category === 'public') publicCount++;
      else if (ep.category === 'authenticated') authCount++;
      else if (ep.category === 'admin') adminCount++;
    });
  });

  return success({
    categories: apiScanData,
    stats: {
      totalEndpoints,
      publicCount,
      authCount,
      adminCount,
      categoryCount: apiScanData.length,
    },
    scannedAt: new Date().toISOString(),
    version: '1.0.0',
  });
}

// POST /api/v1/admin/api-scan — Run live tests against public endpoints
export async function POST(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const body = await request.json().catch(() => ({}));
  const { endpoints: testEndpoints } = body as { endpoints?: string[] };

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 53626}`;
  const results: Array<{
    method: string;
    path: string;
    status: 'online' | 'offline' | 'error' | 'timeout';
    statusCode: number | null;
    responseTime: number | null;
    error: string | null;
    responseBody: unknown;
  }> = [];

  // Testable public endpoints (GET only, no required params)
  const testableEndpoints = [
    { method: 'GET', path: '/api' },
    { method: 'GET', path: '/api/v1/configs/public' },
    { method: 'GET', path: '/api/v1/stats/public' },
    { method: 'GET', path: '/api/v1/hitokoto' },
    { method: 'GET', path: '/api/v1/categories' },
    { method: 'GET', path: '/api/v1/categories/tree' },
    { method: 'GET', path: '/api/v1/works?page=1&pageSize=5' },
    { method: 'GET', path: '/api/v1/works/featured' },
    { method: 'GET', path: '/api/v1/booking/info' },
    { method: 'GET', path: '/api/v1/footprint' },
    { method: 'GET', path: '/api/v1/changelog?limit=5' },
    { method: 'GET', path: '/api/v1/auth/social/providers' },
    { method: 'GET', path: '/api/v1/seo/robots.txt' },
    { method: 'GET', path: '/api/v1/seo/sitemap.xml' },
    { method: 'GET', path: '/api/v1/ai-tags?pageSize=5' },
    { method: 'GET', path: '/api/v1/comments?work_id=test&page=1&pageSize=5' },
  ];

  // Filter if specific endpoints requested
  const endpointsToTest = testEndpoints
    ? testableEndpoints.filter(e => testEndpoints.includes(e.path))
    : testableEndpoints;

  // Get admin token for auth/admin endpoint testing
  const adminToken = request.headers.get('authorization')?.replace('Bearer ', '');

  // Also test some admin endpoints
  const adminEndpoints = adminToken ? [
    { method: 'GET', path: '/api/v1/dashboard/overview', needsAuth: true },
    { method: 'GET', path: '/api/v1/admin/users?page=1&pageSize=5', needsAuth: true },
    { method: 'GET', path: '/api/v1/admin/works?page=1&pageSize=5', needsAuth: true },
    { method: 'GET', path: '/api/v1/cache/stats', needsAuth: true },
    { method: 'GET', path: '/api/v1/monitor/overview', needsAuth: true },
  ] : [];

  // Test public endpoints
  for (const endpoint of endpointsToTest) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
      const res = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const elapsed = Date.now() - start;
      let responseBody: unknown = null;
      try {
        responseBody = await res.json();
      } catch {
        responseBody = await res.text().catch(() => null);
      }
      results.push({
        method: endpoint.method,
        path: endpoint.path,
        status: res.ok ? 'online' : 'error',
        statusCode: res.status,
        responseTime: elapsed,
        error: res.ok ? null : `HTTP ${res.status}`,
        responseBody: res.ok ? null : responseBody,
      });
    } catch (err: any) {
      const elapsed = Date.now() - start;
      results.push({
        method: endpoint.method,
        path: endpoint.path,
        status: err.name === 'AbortError' ? 'timeout' : 'offline',
        statusCode: null,
        responseTime: elapsed,
        error: err.message,
        responseBody: null,
      });
    }
  }

  // Test admin endpoints
  for (const endpoint of adminEndpoints) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: { Authorization: `Bearer ${adminToken}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const elapsed = Date.now() - start;
      let responseBody: unknown = null;
      try {
        responseBody = await res.json();
      } catch {
        responseBody = null;
      }
      results.push({
        method: endpoint.method,
        path: endpoint.path,
        status: res.ok ? 'online' : 'error',
        statusCode: res.status,
        responseTime: elapsed,
        error: res.ok ? null : `HTTP ${res.status}`,
        responseBody: res.ok ? null : responseBody,
      });
    } catch (err: any) {
      const elapsed = Date.now() - start;
      results.push({
        method: endpoint.method,
        path: endpoint.path,
        status: err.name === 'AbortError' ? 'timeout' : 'offline',
        statusCode: null,
        responseTime: elapsed,
        error: err.message,
        responseBody: null,
      });
    }
  }

  // Summary
  const online = results.filter(r => r.status === 'online').length;
  const offline = results.filter(r => r.status === 'offline').length;
  const errored = results.filter(r => r.status === 'error').length;
  const timedOut = results.filter(r => r.status === 'timeout').length;
  const avgResponseTime = results.filter(r => r.responseTime !== null).reduce((sum, r) => sum + (r.responseTime || 0), 0) / (results.length || 1);

  return success({
    results,
    summary: {
      total: results.length,
      online,
      offline,
      errored,
      timedOut,
      avgResponseTime: Math.round(avgResponseTime),
      scannedAt: new Date().toISOString(),
    },
    // Email notification flag
    hasErrors: errored > 0 || offline > 0 || timedOut > 0,
    errorEndpoints: results.filter(r => r.status !== 'online').map(r => ({
      method: r.method,
      path: r.path,
      status: r.status,
      error: r.error,
      statusCode: r.statusCode,
    })),
  });
}
