/** Circular avatar that shows a profile image, or gradient initials as a fallback. */
import { initials } from '../../lib/format';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  ring?: boolean;
}

const SIZES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-20 w-20 text-2xl',
  xl: 'h-24 w-24 text-3xl',
};

export function Avatar({ name, src, size = 'md', ring = false }: AvatarProps) {
  const ringCls = ring ? 'ring-2 ring-white shadow-soft dark:ring-slate-800' : '';
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ${SIZES[size]} ${ringCls}`;

  if (src) {
    return <img src={src} alt={name} className={`${base} object-cover`} />;
  }
  return (
    <span className={`${base} bg-brand-gradient text-white`}>
      {initials(name)}
    </span>
  );
}
