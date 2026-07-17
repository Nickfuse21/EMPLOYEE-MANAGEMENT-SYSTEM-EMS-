/**
 * "My Profile" page — available to every authenticated user.
 *
 * Employees may edit only their limited fields (name, phone, profile image).
 * The backend enforces this too; here we simply present those fields. Read-only
 * fields (email, role, salary, etc.) are shown for context but not editable.
 */
import { useState, type FormEvent } from 'react';
import { CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { employeeApi } from '../api/employees';
import type { ManagerRef } from '../types';
import { ROLE_LABELS } from '../lib/constants';
import { formatCurrency, formatDate } from '../lib/format';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { PageTransition } from '../components/ui/PageTransition';

export default function ProfilePage() {
  const { user, refresh } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [profileImage, setProfileImage] = useState(user?.profileImage ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const manager = user.reportingManager as ManagerRef | null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);
    try {
      await employeeApi.update(user._id, { name, phone, profileImage });
      await refresh(); // Pull the updated user back into context.
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white sm:text-3xl">My Profile</h1>

        {/* Read-only summary with gradient banner. */}
        <div className="card overflow-hidden p-0">
          <div className="h-24 bg-brand-gradient" />
          <div className="flex flex-col items-center gap-4 px-6 pb-6 sm:flex-row sm:items-end">
            <div className="-mt-12">
              <Avatar name={user.name} src={profileImage} size="xl" ring />
            </div>
            <div className="flex-1 text-center sm:pb-1 sm:text-left">
              <p className="text-xl font-bold text-slate-800 dark:text-white">{user.name}</p>
              <p className="text-slate-500 dark:text-slate-400">{user.designation || '—'}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge tone="indigo">{ROLE_LABELS[user.role]}</Badge>
                <Badge tone={user.status === 'active' ? 'green' : 'red'} dot>{user.status}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Editable fields. */}
          <form onSubmit={handleSubmit} className="card space-y-4">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200">Edit details</h2>

            {message && (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300">
                <CheckCircle2 size={16} /> {message}
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div>
              <label className="label">Full name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">Profile image URL</label>
              <input
                className="input"
                placeholder="https://…"
                value={profileImage}
                onChange={(e) => setProfileImage(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={saving}>
              {!saving && <Save size={16} />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>

          {/* Read-only info (managed by HR/Admin). */}
          <div className="card">
            <h2 className="mb-4 font-semibold text-slate-700 dark:text-slate-200">Employment info</h2>
            <dl className="space-y-3 text-sm">
              <Row label="Employee ID" value={user.employeeId} />
              <Row label="Email" value={user.email} />
              <Row label="Department" value={user.department || '—'} />
              <Row label="Salary" value={formatCurrency(user.salary)} />
              <Row label="Joining date" value={formatDate(user.joiningDate)} />
              <Row label="Reporting manager" value={manager && typeof manager === 'object' ? manager.name : '—'} />
            </dl>
            <p className="mt-4 text-xs text-slate-400">These fields are managed by HR / administrators.</p>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2.5 last:border-0 dark:border-slate-800">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-700 dark:text-slate-200">{value}</dd>
    </div>
  );
}
