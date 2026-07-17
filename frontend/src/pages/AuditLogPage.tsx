/**
 * Audit-log page (Super Admin only).
 *
 * A read-only, newest-first view of the immutable security trail: logins (and
 * failed logins), employee changes, salary/role changes, and leave decisions.
 * Each entry shows who did what, to whom, and when.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, LogIn, ShieldAlert, UserPlus, UserCog, Trash2,
  DollarSign, KeyRound, CalendarCheck, Search, type LucideIcon,
} from 'lucide-react';
import { auditApi } from '../api/features';
import type { AuditLog } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { staggerContainer, staggerItem } from '../lib/motion';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { PageTransition } from '../components/ui/PageTransition';

/** Icon + tone per action type, so the trail is scannable at a glance. */
const ACTION_META: Record<string, { icon: LucideIcon; tone: 'green' | 'red' | 'amber' | 'indigo' | 'slate'; label: string }> = {
  'auth.login': { icon: LogIn, tone: 'green', label: 'Login' },
  'auth.login_failed': { icon: ShieldAlert, tone: 'red', label: 'Failed login' },
  'employee.created': { icon: UserPlus, tone: 'indigo', label: 'Employee created' },
  'employee.updated': { icon: UserCog, tone: 'slate', label: 'Employee updated' },
  'employee.deleted': { icon: Trash2, tone: 'red', label: 'Employee deleted' },
  'employee.salary_changed': { icon: DollarSign, tone: 'amber', label: 'Salary changed' },
  'employee.role_changed': { icon: KeyRound, tone: 'amber', label: 'Role changed' },
  'employee.manager_changed': { icon: UserCog, tone: 'slate', label: 'Manager changed' },
  'leave.decision': { icon: CalendarCheck, tone: 'indigo', label: 'Leave decision' },
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const debounced = useDebounce(search);

  useEffect(() => {
    setLoading(true);
    auditApi
      .list({ search: debounced, action, page: 1 })
      .then((data) => {
        setLogs(data);
        setError('');
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [debounced, action]);

  const actionOptions = useMemo(() => Object.entries(ACTION_META).map(([value, m]) => ({ value, label: m.label })), []);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-white sm:text-3xl">
            <ShieldCheck className="text-brand-500" /> Audit Trail
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            An append-only record of security-critical actions. Entries can never be edited or deleted.
          </p>
        </div>

        {/* Filters. */}
        <div className="card flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10" placeholder="Search actor, target, or summary…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input !w-auto" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            {actionOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <Spinner label="Loading audit trail…" />
        ) : logs.length === 0 ? (
          <p className="card text-sm text-slate-500">No audit entries match your filters.</p>
        ) : (
          <motion.ol className="space-y-2" variants={staggerContainer} initial="hidden" animate="visible">
            {logs.map((log) => {
              const meta = ACTION_META[log.action] || { icon: ShieldCheck, tone: 'slate' as const, label: log.action };
              const Icon = meta.icon;
              return (
                <motion.li key={log._id} variants={staggerItem} className="card flex items-start gap-3 py-3">
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    meta.tone === 'red' ? 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                    : meta.tone === 'green' ? 'bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-300'
                    : meta.tone === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300'
                    : 'bg-brand-100 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300'
                  }`}>
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-800 dark:text-slate-100">{log.summary || meta.label}</span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {log.actorName}{log.actorRole ? ` (${log.actorRole})` : ''} · {formatWhen(log.createdAt)}
                      {log.ip ? ` · ${log.ip}` : ''}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </motion.ol>
        )}
      </div>
    </PageTransition>
  );
}
