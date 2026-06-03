import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';
import { api } from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'RH' | 'GESTOR' | 'CONSULTA';
  mustChangePassword: boolean;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/login', { email, password }) as any;
          const { accessToken, refreshToken, user } = response.data;

          Cookies.set('sc_access_token', accessToken, {
            expires: 1 / 96, // 15 min
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
          });
          Cookies.set('sc_refresh_token', refreshToken, {
            expires: 7,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
          });

          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          const refreshToken = Cookies.get('sc_refresh_token');
          if (refreshToken) {
            await api.post('/auth/logout', { refreshToken });
          }
        } finally {
          Cookies.remove('sc_access_token');
          Cookies.remove('sc_refresh_token');
          set({ user: null, isAuthenticated: false });
        }
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'sc-office-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
);

// Permission helpers
export const usePermissions = () => {
  const { user } = useAuthStore();

  return {
    isAdmin: user?.role === 'ADMIN',
    isRH: user?.role === 'RH' || user?.role === 'ADMIN',
    isGestor: user?.role === 'GESTOR' || user?.role === 'ADMIN',
    canManageEmployees: ['ADMIN', 'RH'].includes(user?.role || ''),
    canManageTemplates: ['ADMIN', 'RH'].includes(user?.role || ''),
    canViewAudit: user?.role === 'ADMIN',
    canManageUsers: user?.role === 'ADMIN',
    role: user?.role,
  };
};
