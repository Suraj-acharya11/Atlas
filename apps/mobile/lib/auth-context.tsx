import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from './api-client';
import { isJwtExpired } from './auth-token';
import { onUnauthorized } from './auth-events';
import { queryClient } from './query-client';

type AuthResponse = { accessToken: string; user: { _id: string; email: string; timezone: string; preferences?: Record<string, any>; displayName?: string; bio?: string } };
type AuthContextValue = {
  token: string | null;
  loading: boolean;
  user: AuthResponse['user'] | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, timezone: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<AuthResponse['user'] | null>>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthResponse['user'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const removeUnauthorizedListener = onUnauthorized(() => {
      void SecureStore.deleteItemAsync('user_profile');
      setToken(null);
      setUser(null);
    });
    void (async () => {
      try {
        const value = await SecureStore.getItemAsync('jwt');
        if (!mounted) return;
        if (value && !isJwtExpired(value)) {
          setToken(value);

          // Restore cached profile snapshot first so offline UI has immediate context
          try {
            const cachedProfile = await SecureStore.getItemAsync('user_profile');
            if (cachedProfile && mounted) {
              setUser(JSON.parse(cachedProfile));
            }
          } catch {
            // ignore JSON parse error
          }

          // Authoritative fetch
          try {
            const me = await apiRequest<AuthResponse['user']>('/api/v1/users/me');
            if (mounted) {
              setUser(me);
              void SecureStore.setItemAsync('user_profile', JSON.stringify(me));
            }
          } catch {
            // Keep cached profile if network/server is unavailable
          }
        } else if (value) {
          await SecureStore.deleteItemAsync('jwt');
          await SecureStore.deleteItemAsync('user_profile');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      removeUnauthorizedListener();
    };
  }, []);

  const authenticate = async (path: string, body: unknown) => {
    const response = await apiRequest<AuthResponse>(path, { method: 'POST', body });
    await SecureStore.setItemAsync('jwt', response.accessToken);
    await SecureStore.setItemAsync('user_profile', JSON.stringify(response.user));
    setToken(response.accessToken);
    setUser(response.user);
  };

  const updateUser: React.Dispatch<React.SetStateAction<AuthResponse['user'] | null>> = (action) => {
    setUser((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (next) {
        void SecureStore.setItemAsync('user_profile', JSON.stringify(next));
      } else {
        void SecureStore.deleteItemAsync('user_profile');
      }
      return next;
    });
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      loading,
      user,
      signIn: (email, password) => authenticate('/auth/login', { email, password }),
      register: (email, password, timezone) => authenticate('/auth/register', { email, password, timezone }),
      signOut: async () => {
        await SecureStore.deleteItemAsync('jwt');
        await SecureStore.deleteItemAsync('user_profile');
        queryClient.clear();
        setToken(null);
        setUser(null);
      },
      setUser: updateUser,
    }),
    [token, loading, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }
