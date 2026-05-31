// 认证状态管理
import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';

export interface UserInfo {
  id: string;
  email: string;
  nickname: string | null;
  role: string;
  avatarUrl: string | null;
  bio: string | null;
}

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  _initialized: boolean;

  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  register: (email: string, password: string, nickname: string, code: string) => Promise<{ success: boolean; message: string }>;
  sendCode: (email: string, type: 'register' | 'bind_email' | 'reset_password') => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateUser: (data: Partial<UserInfo>) => void;
  initAuth: () => void;
}

let authLogoutListenerAdded = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // 初始为true，等待token恢复
  _initialized: false,

  initAuth: () => {
    if (typeof window === 'undefined') return;

    // 防止重复初始化
    if (get()._initialized) return;
    set({ _initialized: true });

    // 全局只注册一次logout事件监听
    if (!authLogoutListenerAdded) {
      authLogoutListenerAdded = true;
      window.addEventListener('auth:logout', () => {
        set({ user: null, isAuthenticated: false, isLoading: false });
      });
    }

    const token = localStorage.getItem('access_token');
    if (token) {
      get().fetchProfile();
    } else {
      // 没有token，立即结束loading
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const result = await apiClient.post<{ access_token: string; refresh_token: string; user: UserInfo }>(
        '/auth/login',
        { email, password }
      );
      if (result.code === 0 && result.data) {
        apiClient.setTokens(result.data.access_token, result.data.refresh_token);
        set({ user: result.data.user, isAuthenticated: true, isLoading: false });
        return { success: true, message: '登录成功' };
      }
      set({ isLoading: false });
      return { success: false, message: result.message || '登录失败' };
    } catch {
      set({ isLoading: false });
      return { success: false, message: '登录失败，请稍后重试' };
    }
  },

  register: async (email, password, nickname, code) => {
    set({ isLoading: true });
    try {
      const result = await apiClient.post('/auth/register/email', { email, password, nickname, code });
      if (result.code === 0 && result.data) {
        // 注册接口已返回token，直接使用，无需再次登录
        const data = result.data as { access_token: string; refresh_token: string; user: UserInfo };
        apiClient.setTokens(data.access_token, data.refresh_token);
        set({ user: data.user, isAuthenticated: true, isLoading: false });
        return { success: true, message: '注册成功' };
      }
      set({ isLoading: false });
      return { success: false, message: result.message || '注册失败' };
    } catch {
      set({ isLoading: false });
      return { success: false, message: '注册失败，请稍后重试' };
    }
  },

  sendCode: async (email, type) => {
    try {
      const result = await apiClient.post('/auth/send-code', { email, type });
      if (result.code === 0) {
        return { success: true, message: result.message || '验证码已发送' };
      }
      return { success: false, message: result.message || '发送验证码失败' };
    } catch {
      return { success: false, message: '发送验证码失败，请稍后重试' };
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore logout errors
    }
    apiClient.clearTokens();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  fetchProfile: async () => {
    try {
      const result = await apiClient.get<UserInfo>('/user/profile');
      if (result.code === 0 && result.data) {
        set({ user: result.data, isAuthenticated: true, isLoading: false });
      } else {
        // fetchProfile失败不清除token，可能是临时网络问题
        // 只有401（未登录）才清除
        if (result.code === 40101 || result.code === 40102 || result.code === 40103) {
          apiClient.clearTokens();
          set({ user: null, isAuthenticated: false, isLoading: false });
        } else {
          // 其他错误（如500）保持loading状态让页面可以重试
          set({ isLoading: false });
        }
      }
    } catch {
      // 网络错误不清除token，保持isAuthenticated不变让用户可以重试
      set({ isLoading: false });
    }
  },

  updateUser: (data) => {
    const currentUser = get().user;
    if (currentUser) {
      set({ user: { ...currentUser, ...data } });
    }
  },
}));
