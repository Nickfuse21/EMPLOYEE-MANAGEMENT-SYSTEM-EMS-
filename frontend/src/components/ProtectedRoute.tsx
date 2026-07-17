/**
 * Route guards.
 *
 * `ProtectedRoute` blocks unauthenticated users (redirects to /login).
 * `RoleRoute` additionally restricts a route to specific roles, satisfying the
 * "protected routes" + RBAC requirements on the client side. (The server always
 * re-checks; the client guard is purely for UX.)
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';
import { Spinner } from './ui/Spinner';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function RoleRoute({ allow }: { allow: Role[] }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  // Authenticated but wrong role → send to the dashboard rather than error out.
  if (!allow.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
