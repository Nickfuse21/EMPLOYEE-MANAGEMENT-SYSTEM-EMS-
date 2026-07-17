/**
 * Employees list page (Super Admin & HR).
 *
 * Combines search (by name/email), filters (department, role, status), sorting
 * (name / joining date / salary), and pagination — all driven from server-side
 * query params. Super Admin additionally sees a delete action (soft delete).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Plus, Eye, Pencil, Trash2, ArrowUpDown, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { employeeApi } from '../api/employees';
import type { Employee, EmployeeQuery, ManagerRef, Pagination } from '../types';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { ROLE_LABELS, ROLE_OPTIONS, STATUS_OPTIONS } from '../lib/constants';
import { formatDate } from '../lib/format';
import { staggerContainer, staggerItem } from '../lib/motion';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Modal } from '../components/ui/Modal';

export default function EmployeesPage() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();

  // --- Filter / sort / pagination state -----------------------------------
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search);

  // --- Data state ----------------------------------------------------------
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<Employee | null>(null);

  const query: EmployeeQuery = useMemo(
    () => ({
      search: debouncedSearch,
      department,
      role: role as EmployeeQuery['role'],
      status: status as EmployeeQuery['status'],
      sortBy,
      order,
      page,
      limit: 10,
    }),
    [debouncedSearch, department, role, status, sortBy, order, page],
  );

  // Fetch whenever the query changes.
  useEffect(() => {
    let active = true;
    setLoading(true);
    employeeApi
      .list(query)
      .then((res) => {
        if (!active) return;
        setEmployees(res.data);
        setPagination(res.pagination);
        setError('');
      })
      .catch((err) => active && setError((err as Error).message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query]);

  // Reset to page 1 whenever a filter/search/sort changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, department, role, status, sortBy, order]);

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await employeeApi.remove(toDelete._id);
      setToDelete(null);
      setEmployees((list) => list.filter((e) => e._id !== toDelete._id));
    } catch (err) {
      setError((err as Error).message);
      setToDelete(null);
    }
  };

  const managerName = (m?: ManagerRef | string | null) =>
    m && typeof m === 'object' ? m.name : '—';

  return (
    <div className="space-y-6">
      {/* Header. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white sm:text-3xl">Employees</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {pagination ? `${pagination.total} people` : 'Manage your team'}
          </p>
        </div>
        <Link to="/employees/new" className="btn-primary">
          <Plus size={18} />
          Add Employee
        </Link>
      </div>

      {/* Filter bar. */}
      <div className="card space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-10"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <input
            className="input"
            placeholder="Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Sort controls. */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
          <span className="flex items-center gap-1.5 text-slate-400">
            <SlidersHorizontal size={14} /> Sort
          </span>
          <select className="input !w-auto !py-1.5" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="createdAt">Date added</option>
            <option value="name">Name</option>
            <option value="joiningDate">Joining date</option>
            <option value="salary">Salary</option>
          </select>
          <button
            className="btn-secondary !py-1.5"
            onClick={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
          >
            <ArrowUpDown size={14} />
            {order === 'asc' ? 'Ascending' : 'Descending'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Table. */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <TableSkeleton />
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <Search className="text-slate-300" size={36} />
            <p className="text-slate-500">No employees match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Employee</th>
                  <th className="px-5 py-3.5 font-semibold">Department</th>
                  <th className="px-5 py-3.5 font-semibold">Role</th>
                  <th className="px-5 py-3.5 font-semibold">Manager</th>
                  <th className="px-5 py-3.5 font-semibold">Joined</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <motion.tbody variants={staggerContainer} initial="hidden" animate="visible">
                {employees.map((emp) => (
                  <motion.tr
                    key={emp._id}
                    variants={staggerItem}
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={emp.name} src={emp.profileImage} size="sm" ring />
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{emp.department || '—'}</td>
                    <td className="px-5 py-3">
                      <Badge tone={emp.role === 'super_admin' ? 'indigo' : 'slate'}>
                        {ROLE_LABELS[emp.role]}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{managerName(emp.reportingManager)}</td>
                    <td className="px-5 py-3 tabular-nums text-slate-600 dark:text-slate-300">{formatDate(emp.joiningDate)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={emp.status === 'active' ? 'green' : 'red'} dot>{emp.status}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton title="View" onClick={() => navigate(`/employees/${emp._id}`)}>
                          <Eye size={16} />
                        </IconButton>
                        <IconButton title="Edit" onClick={() => navigate(`/employees/${emp._id}/edit`)}>
                          <Pencil size={16} />
                        </IconButton>
                        {hasRole('super_admin') && (
                          <IconButton title="Delete" danger onClick={() => setToDelete(emp)}>
                            <Trash2 size={16} />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination. */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            Page <span className="font-semibold text-slate-700 dark:text-slate-200">{pagination.page}</span> of{' '}
            {pagination.totalPages} · {pagination.total} total
          </span>
          <div className="flex gap-2">
            <button className="btn-secondary !py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              className="btn-secondary !py-1.5"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal. */}
      <Modal
        open={!!toDelete}
        title="Delete employee?"
        onClose={() => setToDelete(null)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setToDelete(null)}>Cancel</button>
            <button className="btn-danger" onClick={handleDelete}>
              <Trash2 size={16} /> Delete
            </button>
          </>
        }
      >
        Are you sure you want to delete <strong>{toDelete?.name}</strong>? This performs a soft
        delete — the record is deactivated and hidden, not permanently removed.
      </Modal>
    </div>
  );
}

/** Small square icon button used for row actions. */
function IconButton({
  children,
  title,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
        danger
          ? 'text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300'
          : 'text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800 dark:hover:text-brand-300'
      }`}
    >
      {children}
    </button>
  );
}
