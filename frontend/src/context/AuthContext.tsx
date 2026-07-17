/**
 * Authentication context.
 *
 * Holds the current user, exposes login/logout, and restores the session on
 * page load by calling /auth/me. Also provides a small `hasRole` helper that
 * pages/components use to show or hide role-gated UI.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../api/auth';
import type { Employee, Role } from '../types';

interface AuthContextValue {
  user: Employee | null;
  loading: boolean; // True while the initial session check is in flight.
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, try to restore an existing session.
  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { user: loggedIn, token } = await authApi.login(email, password);
    // Persist the token as a header fallback (cookie is the primary transport).
    localStorage.setItem('ems_token', token);
    setUser(loggedIn);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      localStorage.removeItem('ems_token');
      setUser(null);
    }
  };

  const refresh = async () => {
    const fresh = await authApi.me();
    setUser(fresh);
  };

  const hasRole = (...roles: Role[]) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
