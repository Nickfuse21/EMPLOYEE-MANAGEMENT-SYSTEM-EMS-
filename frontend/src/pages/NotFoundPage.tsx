/** Catch-all 404 page. */
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Compass } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-slate-50 p-4 text-center dark:bg-slate-950">
      {/* Decorative blobs. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />
      </div>

      <motion.div
        className="relative z-10 flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-gradient text-white shadow-glow">
          <Compass size={30} />
        </div>
        <div>
          <h1 className="text-6xl font-extrabold text-gradient">404</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">This page could not be found.</p>
        </div>
        <Link to="/" className="btn-primary">
          <Home size={18} /> Go home
        </Link>
      </motion.div>
    </div>
  );
}
