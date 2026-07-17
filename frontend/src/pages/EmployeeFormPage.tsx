/**
 * Create / Edit employee form (Super Admin & HR).
 *
 * The same component handles both modes: presence of an `:id` route param means
 * "edit". Includes client-side validation that mirrors the backend rules, plus
 * a reporting-manager dropdown (excluding the employee themselves to avoid the
 * most obvious self-reporting mistake — the server still guards against cycles).
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, UserPlus, Save } from 'lucide-react';
import { employeeApi } from '../api/employees';
import type { Employee, ManagerRef } from '../types';
import { useAuth } from '../context/AuthContext';
import { ROLE_OPTIONS, STATUS_OPTIONS } from '../lib/constants';
import { Spinner } from '../components/ui/Spinner';
import { PageTransition } from '../components/ui/PageTransition';

/** Shape of the editable form fields. */
interface FormState {
  name: string;
  email: string;
  password: string;
  phone: string;
  department: string;
  designation: string;
  salary: string;
  joiningDate: string;
  status: string;
  role: string;
  reportingManager: string;
  profileImage: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  password: '',
  phone: '',
  department: '',
  designation: '',
  salary: '',
  joiningDate: '',
  status: 'active',
  role: 'employee',
  reportingManager: '',
  profileImage: '',
};

export default function EmployeeFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');

  // Load the manager options (all employees) and, in edit mode, the record.
  useEffect(() => {
    // A large limit gives us essentially all employees for the dropdown.
    employeeApi.list({ limit: 100, sortBy: 'name', order: 'asc' }).then((res) => setManagers(res.data));

    if (isEdit && id) {
      employeeApi
        .get(id)
        .then((emp) => {
          const mgr = emp.reportingManager as ManagerRef | null;
          setForm({
            name: emp.name,
            email: emp.email,
            password: '',
            phone: emp.phone ?? '',
            department: emp.department ?? '',
            designation: emp.designation ?? '',
            salary: emp.salary != null ? String(emp.salary) : '',
            joiningDate: emp.joiningDate ? emp.joiningDate.slice(0, 10) : '',
            status: emp.status,
            role: emp.role,
            reportingManager: mgr && typeof mgr === 'object' ? mgr._id : '',
            profileImage: emp.profileImage ?? '',
          });
        })
        .catch((err) => setServerError((err as Error).message))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  // Exclude the employee being edited from their own manager options.
  const managerOptions = useMemo(
    () => managers.filter((m) => m._id !== id),
    [managers, id],
  );

  const setField = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /** Client-side validation mirroring the backend contract. */
  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Name must be at least 2 characters';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'A valid email is required';
    if (!isEdit && form.password.length < 6) next.password = 'Password must be at least 6 characters';
    if (isEdit && form.password && form.password.length < 6)
      next.password = 'Password must be at least 6 characters';
    if (form.phone && !/^[0-9+\-\s()]{7,20}$/.test(form.phone)) next.phone = 'Invalid phone number';
    if (form.salary && Number(form.salary) < 0) next.salary = 'Salary cannot be negative';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    // Build the payload, omitting empty optional fields.
    const payload: Partial<Employee> & { password?: string } = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone || undefined,
      department: form.department || undefined,
      designation: form.designation || undefined,
      salary: form.salary ? Number(form.salary) : undefined,
      joiningDate: form.joiningDate || undefined,
      status: form.status as Employee['status'],
      role: form.role as Employee['role'],
      reportingManager: form.reportingManager || null,
      profileImage: form.profileImage || undefined,
    };
    // Only send a password when one was actually entered.
    if (form.password) payload.password = form.password;

    setSaving(true);
    try {
      if (isEdit && id) {
        await employeeApi.update(id, payload);
      } else {
        await employeeApi.create(payload);
      }
      navigate('/employees');
    } catch (err) {
      // Map server-side field errors back onto the form if provided.
      const details = (err as { details?: Record<string, string> }).details;
      if (details) setErrors(details);
      setServerError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading employee…" />;

  return (
    <PageTransition>
    <div className="mx-auto max-w-3xl space-y-6">
      <button className="btn-ghost !px-2" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
          {isEdit ? <Save size={20} /> : <UserPlus size={20} />}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            {isEdit ? 'Edit Employee' : 'Add Employee'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isEdit ? 'Update this employee’s details.' : 'Create a new employee record.'}
          </p>
        </div>
      </div>

      {serverError && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" error={errors.name}>
          <input className="input" value={form.name} onChange={(e) => setField('name', e.target.value)} />
        </Field>

        <Field label="Email" error={errors.email}>
          <input className="input" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
        </Field>

        <Field label={isEdit ? 'New password (leave blank to keep)' : 'Password'} error={errors.password}>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => setField('password', e.target.value)}
            autoComplete="new-password"
          />
        </Field>

        <Field label="Phone" error={errors.phone}>
          <input className="input" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
        </Field>

        <Field label="Department">
          <input className="input" value={form.department} onChange={(e) => setField('department', e.target.value)} />
        </Field>

        <Field label="Designation">
          <input className="input" value={form.designation} onChange={(e) => setField('designation', e.target.value)} />
        </Field>

        <Field label="Salary (USD)" error={errors.salary}>
          <input className="input" type="number" min="0" value={form.salary} onChange={(e) => setField('salary', e.target.value)} />
        </Field>

        <Field label="Joining date">
          <input className="input" type="date" value={form.joiningDate} onChange={(e) => setField('joiningDate', e.target.value)} />
        </Field>

        <Field label="Status">
          <select className="input" value={form.status} onChange={(e) => setField('status', e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Role">
          <select className="input" value={form.role} onChange={(e) => setField('role', e.target.value)}>
            {ROLE_OPTIONS
              // HR cannot assign the Super Admin role — hide it for them.
              .filter((r) => r.value !== 'super_admin' || hasRole('super_admin'))
              .map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Reporting manager">
          <select
            className="input"
            value={form.reportingManager}
            onChange={(e) => setField('reportingManager', e.target.value)}
          >
            <option value="">— None —</option>
            {managerOptions.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name} ({m.employeeId})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Profile image URL">
          <input
            className="input"
            placeholder="https://…"
            value={form.profileImage}
            onChange={(e) => setField('profileImage', e.target.value)}
          />
        </Field>

        {/* Actions span both columns. */}
        <div className="col-span-full mt-2 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {!saving && (isEdit ? <Save size={16} /> : <UserPlus size={16} />)}
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create employee'}
          </button>
        </div>
      </form>
    </div>
    </PageTransition>
  );
}

/** Small labelled field wrapper with inline error text. */
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
