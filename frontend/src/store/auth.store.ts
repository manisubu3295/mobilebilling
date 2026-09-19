import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';

interface AuthUser {
  id: string;
  name: string;
  role: string;
  store: { id: string; name: string; logoUrl?: string; staticQrUrl?: string };
}

interface AccountInfo {
  licenseExpiresAt: string | null;
  serviceModuleEnabled: boolean;
}

interface SignupInput {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  password: string;
}

interface AuthState {
  user: AuthUser | null;
  account: AccountInfo | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
  setToken: (token: string) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      account: null,
      accessToken: null,
      isAuthenticated: false,
      // Persisted state rehydrates from localStorage asynchronously, so on
      // first client render isAuthenticated is still its default `false` —
      // any redirect-if-logged-out guard must wait for this flag, or it
      // fires on every hard reload/deep link before hydration catches up.
      hasHydrated: false,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('access_token', data.accessToken);
        set({ user: data.user, account: data.account ?? null, accessToken: data.accessToken, isAuthenticated: true });
      },

      signup: async (input) => {
        const { data } = await api.post('/auth/signup', input);
        localStorage.setItem('access_token', data.accessToken);
        set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true });
      },

      logout: async () => {
        await api.post('/auth/logout').catch(() => {});
        localStorage.removeItem('access_token');
        set({ user: null, account: null, accessToken: null, isAuthenticated: false });
      },

      setToken: (token) => {
        localStorage.setItem('access_token', token);
        set({ accessToken: token });
      },

      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: 'auth-store',
      partialize: (s) => ({ user: s.user, account: s.account, isAuthenticated: s.isAuthenticated }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
