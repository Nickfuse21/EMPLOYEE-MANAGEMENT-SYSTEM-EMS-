/**
 * AuroraBackground — slowly drifting, blurred colour blobs that create a
 * premium "aurora / mesh gradient" backdrop (seen on many enterprise sites).
 * Pure CSS, no assets. Sits behind content via absolute positioning.
 */
export function AuroraBackground({ variant = 'app' }: { variant?: 'app' | 'brand' }) {
  // On the brand (login hero) surface the blobs are light; on app surfaces they
  // are tinted brand colours at low opacity.
  const blobs =
    variant === 'brand'
      ? ['bg-white/20', 'bg-violet-300/25', 'bg-sky-300/20']
      : ['bg-brand-400/20 dark:bg-brand-600/10', 'bg-violet-400/20 dark:bg-violet-700/10', 'bg-sky-300/20 dark:bg-sky-800/10'];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className={`absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl animate-blob ${blobs[0]}`} />
      <div
        className={`absolute right-0 top-1/4 h-[28rem] w-[28rem] rounded-full blur-3xl animate-blob ${blobs[1]}`}
        style={{ animationDelay: '4s' }}
      />
      <div
        className={`absolute bottom-0 left-1/3 h-80 w-80 rounded-full blur-3xl animate-blob ${blobs[2]}`}
        style={{ animationDelay: '8s' }}
      />
    </div>
  );
}
