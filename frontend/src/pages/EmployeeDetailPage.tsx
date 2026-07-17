/**
 * Employee detail page.
 *
 * Shows a single employee's full record, their reporting manager, and their
 * direct reports. Management roles get quick Edit access. Plain employees can
 * only reach their own detail (enforced by the backend).
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Pencil, Mail, Phone, Building2, BriefcaseBusiness,
  Wallet, CalendarDays, IdCard, UserCog,
} from 'lucide-react';
import { employeeApi } from '../api/employees';
import type { Employee, ManagerRef } from '../types';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../lib/constants';
import { formatCurrency, formatDate } from '../lib/format';
import { staggerContainer, staggerItem } from '../lib/motion';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { PageTransition } from '../components/ui/PageTransition';
import type { LucideIcon } from 'lucide-react';

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [reportees, setReportees] = useState<Employee[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    employeeApi.get(id).then(setEmployee).catch((err) => setError((err as Error).message));
    if (hasRole('super_admin', 'hr_manager')) {
      employeeApi.reportees(id).then(setReportees).catch(() => setReportees([]));
    }
  }, [id, hasRole]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!employee) return <Spinner label="Loading employee…" />;

  const manager = employee.reportingManager as ManagerRef | null;

  const detailRows: { label: string; value: string; icon: LucideIcon }[] = [
    { label: 'Employee ID', value: employee.employeeId, icon: IdCard },
    { label: 'Email', value: employee.email, icon: Mail },
    { label: 'Phone', value: employee.phone || '—', icon: Phone },
    { label: 'Department', value: employee.department || '—', icon: Building2 },
    { label: 'Designation', value: employee.designation || '—', icon: BriefcaseBusiness },
    { label: 'Salary', value: formatCurrency(employee.salary), icon: Wallet },
    { label: 'Joining date', value: formatDate(employee.joiningDate), icon: CalendarDays },
    { label: 'Reporting manager', value: manager && typeof manager === 'object' ? manager.name : '—', icon: UserCog },
  ];

  return (
    <PageTransition>
      <div className="space-y-6">
        <button className="btn-ghost !px-2" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>

        {/* Header card with a gradient banner. */}
        <div className="card overflow-hidden p-0">
          <div className="h-24 bg-brand-gradient" />
          <div className="flex flex-col items-center gap-4 px-6 pb-6 sm:flex-row sm:items-end">
            <div className="-mt-12">
              <Avatar name={employee.name} src={employee.profileImage} size="xl" ring />
            </div>
            <div className="flex-1 text-center sm:pb-1 sm:text-left">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{employee.name}</h1>
              <p className="text-slate-500 dark:text-slate-400">{employee.designation || '—'}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge tone="indigo">{ROLE_LABELS[employee.role]}</Badge>
                <Badge tone={employee.status === 'active' ? 'green' : 'red'} dot>{employee.status}</Badge>
              </div>
            </div>
            {hasRole('super_admin', 'hr_manager') && (
              <Link to={`/employees/${employee._id}/edit`} className="btn-primary sm:mb-1">
                <Pencil size={16} /> Edit
              </Link>
            )}
          </div>
        </div>

        {/* Details grid. */}
        <div className="card">
          <h2 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Details</h2>
          <motion.dl
            className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {detailRows.map((row) => {
              const Icon = row.icon;
              return (
                <motion.div key={row.label} variants={staggerItem} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-400">{row.label}</dt>
                    <dd className="truncate font-medium text-slate-800 dark:text-slate-100">{row.value}</dd>
                  </div>
                </motion.div>
              );
            })}
          </motion.dl>
        </div>

        {/* Direct reports (management view). */}
        {hasRole('super_admin', 'hr_manager') && (
          <div className="card">
            <h2 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">
              Direct Reports <span className="text-slate-400">({reportees.length})</span>
            </h2>
            {reportees.length === 0 ? (
              <p className="text-sm text-slate-500">This employee has no direct reports.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {reportees.map((r) => (
                  <li key={r._id} className="flex items-center gap-3 py-3">
                    <Avatar name={r.name} src={r.profileImage} size="sm" ring />
                    <div className="flex-1">
                      <Link to={`/employees/${r._id}`} className="font-medium text-brand-600 hover:underline dark:text-brand-300">
                        {r.name}
                      </Link>
                      <p className="text-xs text-slate-400">{r.designation || '—'} · {r.department || '—'}</p>
                    </div>
                    <Badge tone={r.status === 'active' ? 'green' : 'red'} dot>{r.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
