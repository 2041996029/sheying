// Admin API Client with auth, error handling, and auto-refresh
import { HttpClientBase, type ApiResult } from './http-client-base';

interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}

class AdminApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = 'AdminApiError';
  }
}

const adminHttp = new HttpClientBase({
  accessTokenKey: 'admin_access_token',
  refreshTokenKey: 'admin_refresh_token',
  userKey: 'admin_user',
  baseUrl: '/api/v1',
  appId: 'gyj_admin',
  appSecret: typeof window !== 'undefined'
    ? (document.querySelector('meta[name="api-app-secret"]')?.getAttribute('content') || '')
    : '',
  onAuthInvalid: () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
  },
});

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const result = await adminHttp.request<T>(path, options, retry);
  if (result.code !== 0) {
    throw new AdminApiError(result.code, result.message);
  }
  return result.data;
}

async function upload(file: File): Promise<UploadResult> {
  const result = await adminHttp.upload<UploadResult>('/admin/upload', file);
  if (result.code !== 0) {
    throw new AdminApiError(result.code, result.message);
  }
  return result.data;
}

function getToken(): string | null {
  return adminHttp.getAccessToken();
}

function setTokens(access: string, refresh: string) {
  adminHttp.setTokens(access, refresh);
}

function clearTokens() {
  adminHttp.clearTokens();
}

// ============ Auth API ============

export const authApi = {
  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token: string; user: { id: string; nickname: string; role: string; email: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  logout: () => {
    clearTokens();
  },
};

// ============ Dashboard API ============

export const dashboardApi = {
  overview: () =>
    request<{
      totalWorks: number;
      publishedWorks: number;
      totalUsers: number;
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      today: { views: number; likes: number; favorites: number; comments: number; newWorks: number; newUsers: number };
    }>('/dashboard/overview'),
  trend: (days = 7) =>
    request<{ date: string; views: number; likes: number; favorites: number; comments: number; newWorks: number; newUsers: number }[]>(
      `/dashboard/trend?days=${days}`
    ),
  topWorks: (limit = 10, by = 'views') =>
    request<{ id: string; title: string; coverUrl: string; category: { id: string; name: string } | null; likeCount: number; favoriteCount: number; viewCount: number; commentCount: number }[]>(
      `/dashboard/top-works?limit=${limit}&by=${by}`
    ),
};

// ============ Works API ============

export interface WorkItem {
  id: string;
  title: string;
  description: string | null;
  images: string;
  coverUrl: string | null;
  categoryId: string | null;
  tags: string | null;
  params: string | null;
  isFeatured: boolean;
  status: string;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  viewCount: number;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  category: { id: string; name: string } | null;
}

interface UploadResult {
  url: string;
  filename: string;
  size: number;
  type: string;
  exif: Record<string, string | number | null> | null;
}

export const worksApi = {
  list: (params: { page?: number; page_size?: number; status?: string; category_id?: string; search?: string; featured?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    if (params.status) q.set('status', params.status);
    if (params.category_id) q.set('category_id', params.category_id);
    if (params.search) q.set('search', params.search);
    if (params.featured) q.set('featured', params.featured);
    return request<PaginatedData<WorkItem>>(`/admin/works?${q.toString()}`);
  },
  create: (data: {
    title: string;
    description?: string;
    images: string;
    category_id?: string;
    tags?: string;
    params?: string;
    is_featured?: boolean;
    status: string;
    location?: string;
    latitude?: string;
    longitude?: string;
  }) => request<WorkItem>('/admin/works', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    request<WorkItem>(`/admin/works/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<null>(`/admin/works/${id}`, { method: 'DELETE' }),
  toggleFeatured: (id: string) =>
    request<{ isFeatured: boolean }>(`/admin/works/${id}/featured`, { method: 'PUT' }),
  triggerAiTag: (id: string) =>
    request<{ tags: unknown[]; imageCount: number }>(`/admin/works/${id}/ai-tag-trigger`, { method: 'POST' }),
  upload,
  fetchExif: (url: string) =>
    request<{ exif: Record<string, string | number | null> | null }>('/admin/fetch-exif', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
  refreshExif: (id: string) =>
    request<{
      work: WorkItem;
      result: { totalImages: number; successCount: number; failCount: number };
    }>(`/admin/works/${id}/refresh-exif`, { method: 'POST' }),
};

// ============ Categories API ============

export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  coverUrl: string | null;
  autoCover: boolean;
  sortOrder: number;
  level: number;
  workCount: number;
  children: CategoryNode[];
}

export const categoriesApi = {
  tree: () => request<CategoryNode[]>('/categories/tree'),
  list: () =>
    request<CategoryNode[]>('/categories/tree'),
  create: (data: { name: string; parent_id?: string; cover_url?: string; sort_order?: number }) =>
    request<unknown>('/admin/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; parent_id?: string; cover_url?: string; sort_order?: number }) =>
    request<unknown>(`/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<null>(`/admin/categories/${id}`, { method: 'DELETE' }),
  sort: (items: { id: string; sort_order: number }[]) =>
    request<null>('/admin/categories/sort', { method: 'PUT', body: JSON.stringify({ items }) }),
};

// ============ Comments API ============

export interface CommentItem {
  id: string;
  workId: string;
  userId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  content: string;
  status: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  user: { id: string; nickname: string | null; avatarUrl: string | null } | null;
  work: { id: string; title: string };
}

export const commentsApi = {
  list: (params: { page?: number; page_size?: number; status?: string; search?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);
    return request<PaginatedData<CommentItem>>(`/admin/comments?${q.toString()}`);
  },
  updateStatus: (id: string, status: string, is_visible?: boolean) =>
    request<unknown>(`/admin/comments/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, is_visible }),
    }),
  delete: (id: string) =>
    request<null>(`/comments/${id}`, { method: 'DELETE' }),
};

// ============ AI Tags API ============

export interface AiTagItem {
  id: string;
  workId: string;
  imageUrl: string | null;
  tagName: string;
  confidence: number;
  auditStatus: string;
  modelId: string | null;
  usedPrompt: string | null;
  rawResponse: string | null;
  createdAt: string;
  updatedAt: string;
  work: { id: string; title: string; coverUrl: string | null };
  aiModel: { id: string; name: string; modelName: string | null } | null;
}

export const aiTagsApi = {
  list: (params: { page?: number; page_size?: number; work_id?: string; audit_status?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    if (params.work_id) q.set('work_id', params.work_id);
    if (params.audit_status) q.set('audit_status', params.audit_status);
    return request<PaginatedData<AiTagItem>>(`/ai-tags?${q.toString()}`);
  },
  pending: () => request<AiTagItem[]>('/ai-tags/pending'),
  delete: (id: string) =>
    request<null>(`/ai-tags?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  batchRecognize: (work_ids: string[]) =>
    request<{ taskId: string; totalCount: number; completedCount: number; failedCount: number; totalImages: number }>(
      '/ai-tags/batch-recognize',
      { method: 'POST', body: JSON.stringify({ work_ids }) }
    ),
  batchReview: (tag_ids: string[], action: 'approve' | 'reject') =>
    request<{ count: number }>('/ai-tags/batch-review', {
      method: 'PUT',
      body: JSON.stringify({ tag_ids, action }),
    }),
  batchDelete: (tag_ids: string[]) =>
    request<{ count: number }>('/ai-tags/batch-review', {
      method: 'PUT',
      body: JSON.stringify({ tag_ids, action: 'delete' }),
    }),
};

// ============ Configs API ============

export interface ConfigItem {
  id: string;
  key: string;
  value: string;
  isEncrypted: boolean;
  group: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export const configsApi = {
  group: (group: string) => request<ConfigItem[]>(`/configs/group/${group}`),
  updateItem: (key: string, value: string) =>
    request<ConfigItem>(`/configs/item/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),
};

// ============ Monitor API ============

export interface ApiErrorOverview {
  total: number;
  today: number;
  topPaths: { apiPath: string; method: string; count: number; avgTime: number }[];
  byStatus: { statusCode: number; count: number }[];
}

export const monitorApi = {
  overview: () =>
    request<{
      apiMonitor: {
        totalAggregates: number;
        recentErrors: number;
        totalErrors: number;
        todayCalls: number;
        todayAvgTime: number;
        todayErrorRate: number;
        top5Slowest: { endpoint: string; maxTime: number; avgTime: number }[];
        top5MostCalled: { endpoint: string; totalCalls: number; avgTime: number }[];
      };
      apiErrors: ApiErrorOverview;
      cache: { keys: number; size: string };
    }>('/monitor/overview'),
  errors: (params: { page?: number; page_size?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    return request<PaginatedData<{
      id: string;
      errorMessage: string;
      errorStack: string | null;
      source: string | null;
      pagePath: string | null;
      userAgent: string | null;
      userId: string | null;
      requestId: string | null;
      createdAt: string;
    }>>(`/monitor/errors?${q.toString()}`);
  },
  apiErrors: (params: { page?: number; page_size?: number; status_code?: number; api_path?: string; method?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    if (params.status_code) q.set('status_code', String(params.status_code));
    if (params.api_path) q.set('api_path', params.api_path);
    if (params.method) q.set('method', params.method);
    return request<PaginatedData<{
      id: string;
      apiPath: string;
      method: string;
      statusCode: number;
      errorMessage: string | null;
      requestBody: string | null;
      queryParams: string | null;
      userAgent: string | null;
      clientIp: string | null;
      userId: string | null;
      responseTime: number;
      createdAt: string;
    }>>(`/monitor/api-errors?${q.toString()}`);
  },
  deleteApiErrors: (days: number = 7) =>
    request<{ count: number }>(`/monitor/api-errors?days=${days}`, { method: 'DELETE' }),
  cacheStats: () =>
    request<{ keys: number; size: string }>('/cache/stats'),
  clearCache: () =>
    request<{ clearedKeys: number }>('/cache/clear', { method: 'DELETE' }),
};

// ============ Audit API ============

export interface AuditLogItem {
  id: string;
  adminId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  createdAt: string;
  admin: { id: string; nickname: string | null; email: string | null };
}

export const auditApi = {
  list: (params: { page?: number; page_size?: number; action?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    if (params.action) q.set('action', params.action);
    return request<PaginatedData<AuditLogItem>>(`/admin/audit?${q.toString()}`);
  },
};

// ============ Booking API ============

export interface ContactItem {
  id: string;
  userId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; nickname: string | null; email: string | null } | null;
}

export const bookingApi = {
  list: (params: { page?: number; page_size?: number; status?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    if (params.status) q.set('status', params.status);
    return request<PaginatedData<ContactItem>>(`/admin/booking?${q.toString()}`);
  },
  updateStatus: (id: string, status: string) =>
    request<unknown>(`/admin/booking/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  delete: (id: string) =>
    request<null>(`/admin/booking/${id}`, { method: 'DELETE' }),
};

// ============ Users API ============

export interface UserItem {
  id: string;
  email: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
  openid: string | null;
  unionid: string | null;
  role: string;
  status: string;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserDetail extends UserItem {
  openid: string | null;
  unionid: string | null;
  deletedAt: string | null;
}

export const usersApi = {
  list: (params: { page?: number; page_size?: number; search?: string; role?: string; status?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    if (params.search) q.set('search', params.search);
    if (params.role) q.set('role', params.role);
    if (params.status) q.set('status', params.status);
    return request<PaginatedData<UserItem>>(`/admin/users?${q.toString()}`);
  },
  updateStatus: (id: string, status: string) =>
    request<UserItem>(`/admin/users/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  resetPassword: (id: string, newPassword: string) =>
    request<null>(`/admin/users/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ new_password: newPassword }),
    }),
  updateRole: (id: string, role: string) =>
    request<UserItem>(`/admin/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  getDetail: (id: string) =>
    request<UserDetail>(`/admin/users/${id}`),
  updateEmail: (id: string, email: string) =>
    request<UserItem>(`/admin/users/${id}/email`, {
      method: 'PUT',
      body: JSON.stringify({ email }),
    }),
  updateNickname: (id: string, nickname: string) =>
    request<UserItem>(`/admin/users/${id}/nickname`, {
      method: 'PUT',
      body: JSON.stringify({ nickname }),
    }),
};

// ============ AI Models API ============

export interface AiModelItem {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  modelType: string;
  modelName: string | null;
  sortOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const aiModelsApi = {
  list: () => request<AiModelItem[]>('/admin/ai-models'),
  create: (data: { name: string; api_url: string; api_key: string; model_type?: string; model_name?: string; sort_order?: number; is_enabled?: boolean }) =>
    request<AiModelItem>('/admin/ai-models', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; api_url?: string; api_key?: string; model_type?: string; model_name?: string; sort_order?: number; is_enabled?: boolean }) =>
    request<AiModelItem>(`/admin/ai-models/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<null>(`/admin/ai-models/${id}`, { method: 'DELETE' }),
  toggle: (id: string) =>
    request<{ isEnabled: boolean }>(`/admin/ai-models/${id}/toggle`, { method: 'PUT' }),
  test: (id: string) =>
    request<{ success: boolean; latency: number; response?: string; model?: string; error?: string; status?: number }>(`/admin/ai-models/${id}/test`, { method: 'POST' }),
};

// ============ AI Error Analysis API ============

export interface AiErrorAnalysisItem {
  id: string;
  errorType: string;
  requestUrl: string | null;
  aiAnalysis: string | null;
  analysisStatus: string;
  createdAt: string;
  updatedAt: string;
}

export const aiErrorAnalysisApi = {
  list: (params: { page?: number; page_size?: number; status?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    if (params.status) q.set('status', params.status);
    return request<PaginatedData<AiErrorAnalysisItem>>(`/admin/ai-error-analyses?${q.toString()}`);
  },
  trigger: (id: string) =>
    request<AiErrorAnalysisItem>(`/admin/ai-error-analyses/${id}/analyze`, { method: 'POST' }),
  getDetail: (id: string) =>
    request<AiErrorAnalysisItem>(`/admin/ai-error-analyses/${id}`),
  updateStatus: (id: string, status: string) =>
    request<AiErrorAnalysisItem>(`/admin/ai-error-analyses/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ analysis_status: status }),
    }),
};

// ============ Enhanced Cache API ============

export interface CacheKeyDetail {
  key: string;
  ttl: number;
  createdAt: number;
  expiresAt: number;
  remainingTtl: number;
  type: 'redis' | 'memory';
  size?: number;
}

export interface CacheStatsData {
  totalKeys: number;
  validKeys: number;
  expiredKeys: number;
  memoryUsage: string;
  memoryUsageBytes: number;
  appKeyCount: number;
  appMemoryUsage: string;
  appMemoryUsageBytes: number;
  redisTotalKeys: number;
  redisUsedMemory: string;
  redisUsedMemoryBytes: number;
  redisPeakMemory: string;
  redisVersion: string | null;
  redisUptime: string | null;
  redisConnected: boolean;
  redisInfo: {
    version: string | null;
    uptime: string | null;
    uptimeDays: string | null;
  } | null;
  memoryInfo: {
    usedMemory: string;
    usedMemoryBytes: number;
    peakMemory: string;
    peakMemoryBytes: number;
    fragmentationRatio: string;
    totalSystemMemory: string;
    totalSystemMemoryBytes: number;
  } | null;
  clientInfo: {
    connectedClients: number;
    totalConnectionsReceived: number;
    rejectedConnections: number;
  } | null;
  keyspaceInfo: {
    keys: number;
    expires: number;
    avgTtl: number;
  } | null;
}

export interface RedisInfoData {
  connected: boolean;
  serverInfo: {
    version: string | null;
    uptimeInSeconds: string | null;
    uptimeInDays: string | null;
    redisMode: string | null;
    os: string | null;
  } | null;
  memoryInfo: {
    usedMemory: string;
    usedMemoryBytes: number;
    peakMemory: string;
    peakMemoryBytes: number;
    fragmentationRatio: string;
    totalSystemMemory: string;
    totalSystemMemoryBytes: number;
  } | null;
  clientInfo: {
    connectedClients: number;
    totalConnectionsReceived: number;
    rejectedConnections: number;
  } | null;
  keyspaceInfo: {
    keys: number;
    expires: number;
    avgTtl: number;
  } | null;
  commandStats: { command: string; calls: number }[] | null;
}

export const cacheApi = {
  stats: () =>
    request<CacheStatsData>('/cache/stats'),
  keys: (params: { prefix?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.prefix) q.set('prefix', params.prefix);
    return request<CacheKeyDetail[]>(`/cache/keys?${q.toString()}`);
  },
  deleteKey: (key: string) =>
    request<{ key: string; deleted: boolean }>(`/cache/keys/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  clearByPrefix: (prefix: string) =>
    request<{ prefix: string; clearedKeys: number }>(`/cache/clear?prefix=${encodeURIComponent(prefix)}`, { method: 'DELETE' }),
  clearAll: () =>
    request<{ clearedKeys: number }>('/cache/clear', { method: 'DELETE' }),
  redisInfo: () =>
    request<RedisInfoData>('/cache/redis-info'),
};

// ============ Changelog API ============

export interface ChangelogItem {
  id: string;
  version: string;
  title: string;
  content: string;
  type: string;
  isPublished: boolean;
  publishedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const changelogApi = {
  list: (params: { page?: number; page_size?: number; type?: string; is_published?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    if (params.type) q.set('type', params.type);
    if (params.is_published) q.set('is_published', params.is_published);
    return request<PaginatedData<ChangelogItem>>(`/admin/changelog?${q.toString()}`);
  },
  create: (data: {
    version: string;
    title: string;
    content: string;
    type?: string;
    is_published?: boolean;
    sort_order?: number;
  }) => request<ChangelogItem>('/admin/changelog', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: {
    version?: string;
    title?: string;
    content?: string;
    type?: string;
    is_published?: boolean;
    sort_order?: number;
  }) => request<ChangelogItem>(`/admin/changelog/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<null>(`/admin/changelog/${id}`, { method: 'DELETE' }),
  togglePublish: (id: string, is_published: boolean) =>
    request<ChangelogItem>(`/admin/changelog/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_published }),
    }),
};

export { setTokens, clearTokens, getToken, AdminApiError };
