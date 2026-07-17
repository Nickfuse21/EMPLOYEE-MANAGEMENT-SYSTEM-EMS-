/** Wraps a page so it fades/rises in on mount. Used by every routed page. */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { fadeUp } from '../../lib/motion';

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}
