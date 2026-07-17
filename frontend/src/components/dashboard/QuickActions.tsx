/**
 * Role-aware quick actions.
 *
 * Renders a set of shortcut tiles filtered by the current user's role, so each
 * persona is guided to the actions they actually have permission to perform.
 */
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, Users, Network, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { Role } from '../../types';
import { staggerContainer, staggerItem } from '../../lib/motion';

interface Action {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  roles: Role[];
}

const ACTIONS: Action[] = [
  {
    to: '/employees/new',
    label: 'Add Employee',
    description: 'Onboard a new team member',
    icon: UserPlus,
    gradient: 'from-brand-500 to-violet-500',
    roles: ['super_admin', 'hr_manager'],
  },
  {
    to: '/employees',
    label: 'Manage Employees',
    description: 'Search, edit & organise',
    icon: Users,
    gradient: 'from-sky-500 to-blue-600',
    roles: ['super_admin', 'hr_manager'],
  },
  {
    to: '/organization',
    label: 'Org Chart',
    description: 'View reporting hierarchy',
    icon: Network,
    gradient: 'from-emerald-500 to-teal-600',
    roles: ['super_admin', 'hr_manager'],
  },
  {
    // Super-Admin-only: jump to the directory to change roles / managers.
    to: '/employees',
    label: 'Roles & Access',
    description: 'Assign roles and managers',
    icon: ShieldCheck,
    gradient: 'from-amber-500 to-orange-600',
    roles: ['super_admin'],
  },
];

export function QuickActions({ role }: { role: Role }) {
  const visible = ACTIONS.filter((a) => a.roles.includes(role));

  return (
    <motion.div
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {visible.map((action) => {
        const Icon = action.icon;
        return (
          <motion.div key={action.label} variants={staggerItem} whileHover={{ y: -3 }}>
            <Link
              to={action.to}
              className="card flex h-full items-center gap-3 transition hover:border-brand-300 hover:shadow-soft dark:hover:border-brand-500/40"
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient} text-white shadow-lg`}>
                <Icon size={20} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{action.label}</p>
                <p className="truncate text-xs text-slate-400">{action.description}</p>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
