/**
 * Sends a freshly-landed user to the right home page for their role:
 * management roles get the Dashboard; plain employees get their Profile.
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';

export function landingPath(role: Role): string {
  // Employees land on their personalised team view; management on the dashboard.
  return role === 'employee' ? '/my-team' : '/dashboard';
}

export function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? landingPath(user.role) : '/login'} replace />;
}
