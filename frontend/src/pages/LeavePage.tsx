/**
 * Leave page.
 *
 * Every user sees their own balance and can apply for leave. HR & Super Admin
 * additionally see a "pending approvals" queue and can approve/reject requests.
 * The list adapts: an employee sees only their own requests; a manager sees all.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Plus, Check, X, Clock } from 'lucide-react';
import { leaveApi } from '../api/features';
import type { LeaveBalance, LeaveRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import { LEAVE_TYPE_OPTIONS, STATUS_TONE } from '../lib/constants';
import { formatDate } from '../lib/format';
import { staggerContainer, staggerItem } from '../lib/motion';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { Modal } from '../components/ui/Modal';
import { PageTransition } from '../components/ui/PageTransition';

export default function LeavePage() {
  const { user, hasRole } = useAuth();
  const isManager = hasRole('super_admin', 'hr_manager');

  const [balance, setBalance] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([leaveApi.balance(), leaveApi.list()])
      .then(([b, r]) => {
        setBalance(b);
        setRequests(r);
        setError('');
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const pending = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);

  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    try {
      await leaveApi.decide(id, decision);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <Spinner label="Loading leave…" />;

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white sm:text-3xl">Leave</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isManager ? 'Review requests and track your own balance' : 'Apply for leave and track your balance'}
            </p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={18} /> Request leave
          </button>
        </div>

        {error && <ErrorBanner message={error} />}

        {/* Balance tiles. */}
        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {balance.map((b) => (
            <motion.div key={b.type} variants={staggerItem} className="card">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium capitalize text-slate-500 dark:text-slate-400">{b.type} leave</p>
                <CalendarDays size={18} className="text-brand-500" />
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-800 dark:text-white">
                {b.remaining}
                <span className="text-base font-medium text-slate-400"> / {b.allowance} days</span>
              </p>
              {/* Usage bar. */}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-brand-gradient"
                  style={{ width: `${Math.min(100, (b.used / b.allowance) * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">{b.used} used</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Pending approvals (managers only). */}
        {isManager && pending.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
              <Clock size={18} className="text-amber-500" /> Pending approvals ({pending.length})
            </h2>
            <div className="space-y-3">
              {pending.map((r) => (
                <div key={r._id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.employee.name} src={r.employee.profileImage} size="sm" ring />
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{r.employee.name}</p>
                      <p className="text-xs text-slate-400">
                        <span className="capitalize">{r.type}</span> · {r.days} day(s) · {formatDate(r.startDate)} → {formatDate(r.endDate)}
                      </p>
                      {r.reason && <p className="mt-0.5 text-xs italic text-slate-400">“{r.reason}”</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary !py-1.5 !text-green-600" onClick={() => decide(r._id, 'approved')}>
                      <Check size={16} /> Approve
                    </button>
                    <button className="btn-secondary !py-1.5 !text-red-600" onClick={() => decide(r._id, 'rejected')}>
                      <X size={16} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Full request history. */}
        <section>
          <h2 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">
            {isManager ? 'All requests' : 'My requests'}
          </h2>
          {requests.length === 0 ? (
            <p className="card text-sm text-slate-500">No leave requests yet.</p>
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                    <tr>
                      {isManager && <th className="px-5 py-3 font-semibold">Employee</th>}
                      <th className="px-5 py-3 font-semibold">Type</th>
                      <th className="px-5 py-3 font-semibold">Dates</th>
                      <th className="px-5 py-3 font-semibold">Days</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r._id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                        {isManager && (
                          <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">{r.employee.name}</td>
                        )}
                        <td className="px-5 py-3 capitalize text-slate-600 dark:text-slate-300">{r.type}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                          {formatDate(r.startDate)} → {formatDate(r.endDate)}
                        </td>
                        <td className="px-5 py-3 tabular-nums text-slate-600 dark:text-slate-300">{r.days}</td>
                        <td className="px-5 py-3">
                          <Badge tone={STATUS_TONE[r.status]} dot>{r.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <LeaveFormModal
          open={showForm}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setError}
          defaultName={user?.name}
        />
      </div>
    </PageTransition>
  );
}

/** The "apply for leave" modal form. */
function LeaveFormModal({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string) => void;
  defaultName?: string;
}) {
  const [type, setType] = useState<'annual' | 'sick' | 'casual' | 'unpaid'>('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!startDate || !endDate) return onError('Please pick a start and end date');
    setSaving(true);
    try {
      await leaveApi.create({ type, startDate, endDate, reason });
      setStartDate('');
      setEndDate('');
      setReason('');
      onCreated();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Request leave"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Submitting…' : 'Submit request'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Leave type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {LEAVE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start date</label>
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">End date</label>
            <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Reason (optional)</label>
          <textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Family holiday…" />
        </div>
      </div>
    </Modal>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
      {message}
    </div>
  );
}
