/** Centered loading spinner with a brand-tinted ring. */
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400">
      <span className="relative h-10 w-10">
        <span className="absolute inset-0 rounded-full border-[3px] border-slate-200 dark:border-slate-700" />
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-brand-600" />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
