'use client';

/**
 * Session management for the TrustLayer web app.
 *
 * The JWT lives in localStorage (the API is a separate origin, so httpOnly
 * cookies would need CSRF protection to be worth it here). On mount the stored
 * token is *re-validated* against `/api/auth/me` so a revoked or expired
 * session can never leave the UI in a half-authenticated state.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import {
  api,
  clearSession,
  readStoredToken,
  readStoredUser,
  storeToken,
  storeUser,
  UNAUTHORIZED_EVENT,
} from './api';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  /** False until the stored session has been validated against the API. */
  ready: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!readStoredToken()) {
        if (!cancelled) {
          setUser(null);
          setReady(true);
        }
        return;
      }

      // Optimistically restore the cached profile to avoid a flash of the
      // sign-in screen, then confirm it with the server.
      const cached = readStoredUser();
      if (cached && !cancelled) setUser(cached);

      try {
        const fresh = await api.auth.me();
        if (!cancelled) {
          setUser(fresh);
          storeUser(fresh);
        }
      } catch {
        clearSession();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // Any 401 raised by the API layer drops the local session immediately.
  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      setUser(null);
      setReady(true);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const signInAndLoad = useCallback(async (email: string, password: string) => {
    const token = await api.auth.login(email, password);
    storeToken(token.access_token);
    const me = await api.auth.me();
    storeUser(me);
    setUser(me);
    setReady(true);
    return me;
  }, []);

  const login = useCallback(
    (email: string, password: string) => signInAndLoad(email, password),
    [signInAndLoad],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      await api.auth.register(email, password);
      return signInAndLoad(email, password);
    },
    [signInAndLoad],
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, ready, isAdmin: user?.role === 'admin', login, register, logout }),
    [user, ready, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

/** Center-screen placeholder shown while a session is being resolved. */
export function SessionGate({ label = 'Verifying your session...' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <span
        aria-hidden
        className="h-10 w-10 animate-spin rounded-full border-2 border-border-default border-t-brand"
      />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

/**
 * Client-side route guard. The API enforces authorization independently -
 * this only keeps unauthenticated users out of views that cannot render.
 */
export function RequireAuth({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready || user) return;
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    router.replace(`/login?next=${next}`);
  }, [ready, user, router]);

  if (!ready) return <SessionGate />;
  if (!user) return <SessionGate label="Redirecting to sign in..." />;

  if (adminOnly && user.role !== 'admin') {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-bold">Administrator access required</h1>
        <p className="text-sm text-muted">
          Your account ({user.email}) does not have permission to view the SOC dashboard.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}