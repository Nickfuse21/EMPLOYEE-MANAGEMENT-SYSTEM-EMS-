/** Small coloured pill used for statuses and roles, with an optional dot. */
import type { ReactNode } from 'react';

type Tone = 'green' | 'red' | 'indigo' | 'slate' | 'amber';

const TONES: Record<Tone, string> = {
  green: 'bg-green-100 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-400/20',
  red: 'bg-red-100 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20',
  indigo: 'bg-brand-100 text-brand-700 ring-brand-600/20 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-400/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-slate-400/10',
  amber: 'bg-amber-100 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
};

const DOTS: Record<Tone, string> = {
  green: 'bg-green-500',
  red: 'bg-red-500',
  indigo: 'bg-brand-500',
  slate: 'bg-slate-400',
  amber: 'bg-amber-500',
};

export function Badge({
  tone = 'slate',
  dot = false,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${TONES[tone]}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOTS[tone]}`} />}
      {children}
    </span>
  );
}
