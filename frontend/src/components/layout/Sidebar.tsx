/**
 * Left navigation sidebar.
 *
 * Menu items are filtered by the current user's role so people only see what
 * they're allowed to use. The active item is highlighted with a shared
 * `layoutId` pill that animates smoothly between links (framer-motion).
 */
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, Network, UserCircle, Building2, UsersRound,
  CalendarDays, LifeBuoy, TrendingDown, Sparkles, ShieldCheck, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../lib/constants';
import type { Role } from '../../types';
import { Avatar } from '../ui/Avatar';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[]; // If omitted, visible to everyone.
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'hr_manager'] },
  { to: '/employees', label: 'Employees', icon: Users, roles: ['super_admin', 'hr_manager'] },
  { to: '/attrition', label: 'Attrition Risk', icon: TrendingDown, roles: ['super_admin', 'hr_manager'] },
  { to: '/my-team', label: 'My Team', icon: UsersRound },
  { to: '/organization', label: 'Org Chart', icon: Network },
  { to: '/leave', label: 'Leave', icon: CalendarDays },
  { to: '/tickets', label: 'Helpdesk', icon: LifeBuoy },
  { to: '/policies', label: 'Policy Assistant', icon: Sparkles },
  { to: '/audit', label: 'Audit Trail', icon: ShieldCheck, roles: ['super_admin'] },
  { to: '/profile', label: 'My Profile', icon: UserCircle },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const location = useLocation();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <nav className="flex h-full flex-col p-4">
      {/* Brand. */}
      <div className="mb-8 flex items-center gap-3 px-2 pt-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
          <Building2 size={20} className="text-white" />
        </div>
        <div>
          <p className="text-lg font-extrabold leading-none text-gradient">EMS</p>
          <p className="text-[11px] font-medium text-slate-400">Management Suite</p>
        </div>
      </div>

      {/* Links. */}
      <div className="flex flex-1 flex-col gap-1">
        {visibleItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
            >
              {/* Animated active background — shared across links via layoutId. */}
              {isActive && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-brand-gradient shadow-glow"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span
                className={`relative z-10 flex items-center gap-3 ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-white'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>

      {/* Current user footer. */}
      {user && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
          <Avatar name={user.name} src={user.profileImage} size="sm" ring />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{user.name}</p>
            <p className="truncate text-xs text-slate-400">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
      )}
    </nav>
  );
}
