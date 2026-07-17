/**
 * Dashboard page (Super Admin & HR).
 *
 * Role-aware management overview:
 *   • a personalised welcome banner + role-filtered quick actions,
 *   • KPI tiles (Super Admin additionally sees payroll totals),
 *   • a department bar chart + a role donut (validated chart colours), and
 *   • a "Recent Hires" widget.
 *
 * Chart colours were validated with the data-viz palette validator (categorical
 * trio passes CVD + normal-vision gates in both modes; the donut carries direct
 * labels + a legend as the required contrast "relief").
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts';
import { Users, UserCheck, UserX, Building2, Wallet, TrendingUp, type LucideIcon } from 'lucide-react';
import { dashboardApi } from '../api/employees';
import type { DashboardStats } from '../types';
import { ROLE_LABELS } from '../lib/constants';
import { formatCompactCurrency } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { staggerContainer, staggerItem } from '../lib/motion';
import { AnimatedCounter } from '../components/ui/AnimatedCounter';
import { Skeleton } from '../components/ui/Skeleton';
import { QuickActions } from '../components/dashboard/QuickActions';
import { RecentHires } from '../components/dashboard/RecentHires';

/** Theme-aware chart palette (validated with the data-viz palette validator). */
const CHART = {
  light: {
    bar: '#4f46e5',
    categorical: ['#2a78d6', '#008300', '#e87ba4'],
    grid: '#e1e0d9',
    axis: '#898781',
    tooltipBg: '#ffffff',
    tooltipText: '#0b0b0b',
  },
  dark: {
    bar: '#818cf8',
    categorical: ['#3987e5', '#008300', '#d55181'],
    grid: '#2c2c2a',
    axis: '#898781',
    tooltipBg: '#1e293b',
    tooltipText: '#ffffff',
  },
};

interface StatConfig {
  label: string;
  value: number;
  display?: string; // Overrides the animated number (e.g. currency).
  icon: LucideIcon;
  gradient: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const palette = theme === 'dark' ? CHART.dark : CHART.light;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi.stats().then(setStats).catch((err) => setError((err as Error).message));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
        {error}
      </div>
    );
  }

  const isAdmin = user?.role === 'super_admin';
  const greeting = getGreeting();

  // Base KPI tiles; Super Admin gets two extra payroll tiles.
  const statCards: StatConfig[] = stats
    ? [
        { label: 'Total Employees', value: stats.totalEmployees, icon: Users, gradient: 'from-brand-500 to-violet-500' },
        { label: 'Active', value: stats.activeEmployees, icon: UserCheck, gradient: 'from-emerald-500 to-teal-500' },
        { label: 'Inactive', value: stats.inactiveEmployees, icon: UserX, gradient: 'from-rose-500 to-red-500' },
        { label: 'Departments', value: stats.departmentCount, icon: Building2, gradient: 'from-amber-500 to-orange-500' },
        ...(isAdmin && stats.totalPayroll !== undefined
          ? [
              { label: 'Total Payroll', value: stats.totalPayroll, display: formatCompactCurrency(stats.totalPayroll), icon: Wallet, gradient: 'from-fuchsia-500 to-pink-600' } as StatConfig,
              { label: 'Avg. Salary', value: stats.avgSalary ?? 0, display: formatCompactCurrency(stats.avgSalary), icon: TrendingUp, gradient: 'from-cyan-500 to-sky-600' } as StatConfig,
            ]
          : []),
      ]
    : [];

  const roleData = stats?.byRole.map((r) => ({ name: ROLE_LABELS[r.role] ?? r.role, value: r.count })) ?? [];

  const tooltipStyle = {
    backgroundColor: palette.tooltipBg,
    border: 'none',
    borderRadius: 12,
    boxShadow: '0 8px 30px -8px rgba(15,23,42,0.35)',
    color: palette.tooltipText,
    fontSize: 13,
  };

  return (
    <div className="space-y-6">
      {/* Welcome banner. */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-brand-gradient p-6 text-white shadow-glow"
      >
        <div aria-hidden className="absolute -right-6 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-white/80">{greeting}, {user?.name?.split(' ')[0]} 👋</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            {isAdmin ? 'Super Admin Console' : 'HR Management Dashboard'}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-white/80">
            {isAdmin
              ? 'Full control over your organisation — people, roles, structure and payroll.'
              : 'Manage your workforce, onboard new hires and keep records up to date.'}
          </p>
        </div>
      </motion.div>

      {/* Role-aware quick actions. */}
      {user && <QuickActions role={user.role} />}

      {/* KPI tiles. */}
      <motion.div
        className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {!stats
          ? Array.from({ length: isAdmin ? 6 : 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : statCards.map((card) => {
              const Icon = card.icon;
              return (
                <motion.div key={card.label} variants={staggerItem} whileHover={{ y: -4 }} className="card group relative overflow-hidden">
                  <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${card.gradient} opacity-10 blur-xl transition-opacity group-hover:opacity-20`} />
                  <div className="relative">
                    <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${card.gradient} text-white shadow-lg`}>
                      <Icon size={20} />
                    </div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                    {card.display ? (
                      <span className="mt-0.5 block text-2xl font-extrabold tabular-nums text-slate-800 dark:text-white">{card.display}</span>
                    ) : (
                      <AnimatedCounter value={card.value} className="mt-0.5 block text-2xl font-extrabold tabular-nums text-slate-800 dark:text-white" />
                    )}
                  </div>
                </motion.div>
              );
            })}
      </motion.div>

      {/* Charts. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-3">
          <h2 className="mb-1 font-semibold text-slate-700 dark:text-slate-200">Employees by Department</h2>
          <p className="mb-4 text-xs text-slate-400">Head-count across departments</p>
          {!stats ? (
            <Skeleton className="h-72 w-full" />
          ) : stats.byDepartment.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">No department data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={288}>
              <BarChart data={stats.byDepartment} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={palette.grid} strokeDasharray="3 3" />
                <XAxis dataKey="department" tick={{ fontSize: 12, fill: palette.axis }} tickLine={false} axisLine={{ stroke: palette.grid }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: palette.axis }} tickLine={false} axisLine={false} width={40} />
                <Tooltip cursor={{ fill: 'rgba(99,102,241,0.08)' }} contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Employees" fill={palette.bar} radius={[6, 6, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-1 font-semibold text-slate-700 dark:text-slate-200">Employees by Role</h2>
          <p className="mb-4 text-xs text-slate-400">Distribution across roles</p>
          {!stats ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={288}>
              <PieChart>
                <Pie
                  data={roleData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={3}
                  cornerRadius={6}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                  stroke="none"
                >
                  {roleData.map((_, i) => (
                    <Cell key={i} fill={palette.categorical[i % palette.categorical.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent hires. */}
      {stats && <RecentHires hires={stats.recentHires} />}
    </div>
  );
}

/** Time-of-day greeting. */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
