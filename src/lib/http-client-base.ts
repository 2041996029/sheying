import { v4 as uuidv4 } from 'uuid';

export interface HttpClientConfig {
  accessTokenKey: string;
  refreshTokenKey: string;
  userKey?: string;
  baseUrl: string;
  onAuthInvalid?: () => void;
  appId?: string;
  appSecret?: string;
}

export interface ApiResult<T = unknown> {
  code: number;
  message: string;
  data: T;
  request_id: string;
  timestamp: number;
}

export class HttpClientBase {
  protected config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    this.config = config;
  }

  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.config.accessTokenKey);
  }

  protected getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.config.refreshTokenKey);
  }

  setTokens(accessToken: string, refreshToken: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.config.accessTokenKey, accessToken);
    localStorage.setItem(this.config.refreshTokenKey, refreshToken);
  }

  clearTokens() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.config.accessTokenKey);
    localStorage.removeItem(this.config.refreshTokenKey);
    if (this.config.userKey) {
      localStorage.removeItem(this.config.userKey);
    }
  }

  /**
   * Compute API signature headers for request signing.
   * Uses browser-compatible crypto.subtle.digest.
   */
  private async signHeaders(path: string, method: string, body?: string): Promise<Record<string, string>> {
    if (!this.config.appId || !this.config.appSecret) return {};
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomUUID();
    const signStr = this.config.appSecret + timestamp + nonce + method + path + (body || '');
    const encoder = new TextEncoder();
    const data = encoder.encode(signStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sign = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return {
      'X-App-Id': this.config.appId,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Sign': sign,
    };
  }

  private isRefreshing = false;
  private refreshPromise: Promise<'success' | 'invalid' | 'network_error'> | null = null;

  async refreshAccessToken(): Promise<'success' | 'invalid' | 'network_error'> {
    if (this.isRefreshing && this.refreshPromise) return this.refreshPromise;
    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const rt = this.getRefreshToken();
        if (!rt) return 'invalid' as const;
        const res = await fetch(`${this.config.baseUrl}/auth/token/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rt }),
        });
        const result: ApiResult<{ access_token: string; refresh_token: string }> = await res.json();
        if (result.code === 0 && result.data) {
          this.setTokens(result.data.access_token, result.data.refresh_token);
          return 'success' as const;
        }
        this.clearTokens();
        return 'invalid' as const;
      } catch {
        return 'network_error' as const;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }

  async request<T = unknown>(
    path: string,
    options: RequestInit = {},
    retry = true
  ): Promise<ApiResult<T>> {
    const accessToken = this.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Id': uuidv4(),
      ...(options.headers as Record<string, string> || {}),
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Add API signature headers if appId/appSecret are configured
    try {
      const bodyStr = typeof options.body === 'string' ? options.body : undefined;
      const sigHeaders = await this.signHeaders(path, options.method || 'GET', bodyStr);
      Object.assign(headers, sigHeaders);
    } catch {
      // Signing failure should not block the request
    }

    try {
      const res = await fetch(`${this.config.baseUrl}${path}`, {
        ...options,
        headers,
      });

      const result: ApiResult<T> = await res.json();

      if (result.code === 40101 && retry) {
        const refreshResult = await this.refreshAccessToken();
        if (refreshResult === 'success') {
          return this.request<T>(path, options, false);
        }
        if (refreshResult === 'invalid') {
          if (typeof window !== 'undefined') {
            this.clearTokens();
            this.config.onAuthInvalid?.();
          }
        }
      }

      return result;
    } catch {
      return {
        code: 50001,
        message: '网络请求失败，请稍后重试',
        data: null as T,
        request_id: uuidv4(),
        timestamp: Math.floor(Date.now() / 1000),
      };
    }
  }

  get<T = unknown>(path: string) {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T = unknown>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T = unknown>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }

  async upload<T = unknown>(path: string, file: File, fieldName = 'file'): Promise<ApiResult<T>> {
    const accessToken = this.getAccessToken();
    const formData = new FormData();
    formData.append(fieldName, file);

    const headers: Record<string, string> = {
      'X-Request-Id': uuidv4(),
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
      const res = await fetch(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const result: ApiResult<T> = await res.json();

      if (result.code === 40101) {
        const refreshResult = await this.refreshAccessToken();
        if (refreshResult === 'success') {
          const newToken = this.getAccessToken();
          if (newToken) headers['Authorization'] = `Bearer ${newToken}`;
          const retryRes = await fetch(`${this.config.baseUrl}${path}`, {
            method: 'POST',
            headers,
            body: formData,
          });
          return retryRes.json();
        }
        if (refreshResult === 'invalid') {
          if (typeof window !== 'undefined') {
            this.clearTokens();
            this.config.onAuthInvalid?.();
          }
        }
      }

      return result;
    } catch {
      return {
        code: 50001,
        message: '上传失败，请稍后重试',
        data: null as T,
        request_id: uuidv4(),
        timestamp: Math.floor(Date.now() / 1000),
      };
    }
  }
}
