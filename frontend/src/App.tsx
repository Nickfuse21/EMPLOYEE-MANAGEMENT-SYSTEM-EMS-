/**
 * Route map for the whole application.
 *
 * Public:   /login
 * Private:  everything inside <ProtectedRoute> (requires authentication).
 * Role-gated: /dashboard, /employees, /employees/new, /employees/:id/edit are
 *             wrapped in <RoleRoute> so only Super Admin & HR reach them.
 */
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute';
import { RootRedirect } from './components/RootRedirect';
import { AppLayout } from './components/layout/AppLayout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeFormPage from './pages/EmployeeFormPage';
import EmployeeDetailPage from './pages/EmployeeDetailPage';
import OrganizationPage from './pages/OrganizationPage';
import ProfilePage from './pages/ProfilePage';
import MyTeamPage from './pages/MyTeamPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      {/* Public route. */}
      <Route path="/login" element={<LoginPage />} />

      {/* Authenticated routes share the app layout (sidebar + navbar). */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {/* Management-only routes. */}
          <Route element={<RoleRoute allow={['super_admin', 'hr_manager']} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/employees/new" element={<EmployeeFormPage />} />
            <Route path="/employees/:id/edit" element={<EmployeeFormPage />} />
          </Route>

          {/* Available to every authenticated user. */}
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="/organization" element={<OrganizationPage />} />
          <Route path="/my-team" element={<MyTeamPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Default landing depends on the user's role. */}
          <Route index element={<RootRedirect />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
