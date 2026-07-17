/**
 * Counts up from 0 to `value` on mount using a framer-motion spring, giving the
 * dashboard KPI tiles a lively, professional feel.
 */
import { useEffect } from 'react';
import { animate, useMotionValue, useTransform, motion } from 'framer-motion';

export function AnimatedCounter({ value, className }: { value: number; className?: string }) {
  const count = useMotionValue(0);
  // Render as a rounded integer.
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString());

  useEffect(() => {
    const controls = animate(count, value, { duration: 1, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [value, count]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
