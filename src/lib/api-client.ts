// 统一API客户端
import { HttpClientBase, type ApiResult } from './http-client-base';

export type { ApiResult };

export interface PaginatedData<T = unknown> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}

class ApiClient extends HttpClientBase {
  constructor() {
    super({
      accessTokenKey: 'access_token',
      refreshTokenKey: 'refresh_token',
      baseUrl: '/api/v1',
      onAuthInvalid: () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:logout'));
        }
      },
    });
  }
}

export const apiClient = new ApiClient();
