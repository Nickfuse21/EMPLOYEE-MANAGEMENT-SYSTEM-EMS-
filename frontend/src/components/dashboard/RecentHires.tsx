/** "Recent Hires" widget — the five most recently-joined employees. */
import { Link } from 'react-router-dom';
import { UserRoundPlus } from 'lucide-react';
import type { Employee } from '../../types';
import { formatDate } from '../../lib/format';
import { Avatar } from '../ui/Avatar';

export function RecentHires({ hires }: { hires: Employee[] }) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center gap-2">
        <UserRoundPlus size={18} className="text-brand-600 dark:text-brand-400" />
        <h2 className="font-semibold text-slate-700 dark:text-slate-200">Recent Hires</h2>
      </div>
      {hires.length === 0 ? (
        <p className="text-sm text-slate-500">No employees yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {hires.map((h) => (
            <li key={h._id} className="flex items-center gap-3 py-2.5">
              <Avatar name={h.name} src={h.profileImage} size="sm" ring />
              <div className="min-w-0 flex-1">
                <Link to={`/employees/${h._id}`} className="truncate font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100 dark:hover:text-brand-300">
                  {h.name}
                </Link>
                <p className="truncate text-xs text-slate-400">{h.designation || '—'} · {h.department || '—'}</p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-slate-400">{formatDate(h.joiningDate)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
