/**
 * Login page.
 *
 * A split-screen layout: an animated brand hero on the left (feature
 * highlights + floating gradient shapes) and the sign-in form on the right.
 * Redirects to the role-appropriate landing page on success.
 */
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Mail, Lock, Eye, EyeOff, ShieldCheck, Users, Network } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { landingPath } from '../components/RootRedirect';
import { staggerContainer, staggerItem } from '../lib/motion';
import { ParticleField } from '../components/ui/ParticleField';

const HIGHLIGHTS = [
  { icon: ShieldCheck, title: 'Secure by design', text: 'JWT auth, bcrypt hashing & role-based access.' },
  { icon: Users, title: 'Full employee lifecycle', text: 'Create, manage and track your entire team.' },
  { icon: Network, title: 'Org hierarchy', text: 'Visualise reporting lines at a glance.' },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@ems.com');
  const [password, setPassword] = useState('Admin@123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, don't show the login form.
  if (user) return <Navigate to={landingPath(user.role)} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ---- Left: brand hero (hidden on small screens) ---- */}
      <div className="relative hidden w-1/2 overflow-hidden bg-brand-gradient lg:flex">
        {/* Animated background: drifting blobs + constellation particle field. */}
        <div aria-hidden className="absolute inset-0">
          <div className="absolute -left-10 top-10 h-72 w-72 rounded-full bg-white/10 blur-2xl animate-blob" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl animate-blob" style={{ animationDelay: '4s' }} />
          <div className="absolute right-16 top-24 h-24 w-24 rotate-12 rounded-3xl bg-white/10 backdrop-blur-sm animate-float" style={{ animationDelay: '0.8s' }} />
        </div>
        <ParticleField />

        <motion.div
          className="relative z-10 flex flex-col justify-center px-14 text-white"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={staggerItem} className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Building2 size={24} />
            </div>
            <span className="text-2xl font-extrabold tracking-tight">EMS</span>
          </motion.div>

          <motion.h1 variants={staggerItem} className="mb-4 max-w-md text-4xl font-extrabold leading-tight">
            Manage your workforce, beautifully.
          </motion.h1>
          <motion.p variants={staggerItem} className="mb-10 max-w-md text-white/80">
            A modern Employee Management System with secure access control, an
            organisational hierarchy, and insightful dashboards.
          </motion.p>

          <div className="space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <motion.div key={title} variants={staggerItem} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-white/70">{text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ---- Right: sign-in form ---- */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Mobile brand (shown only when hero is hidden). */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow">
              <Building2 size={22} className="text-white" />
            </div>
            <span className="text-xl font-extrabold text-gradient">EMS</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Welcome back</h2>
          <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
            Sign in to your account to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
              >
                {error}
              </motion.div>
            )}

            <div>
              <label className="label" htmlFor="email">Email address</label>
              <div className="relative">
                <Mail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  className="input pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <Lock size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input px-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full py-3 text-base" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Demo hints so a reviewer can log in immediately. */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <p className="mb-1 font-semibold text-slate-600 dark:text-slate-300">Demo accounts</p>
            <div className="grid gap-1">
              <span>👑 Super Admin — <code>admin@ems.com</code> / <code>Admin@123</code></span>
              <span>🧑‍💼 HR Manager — <code>hr@ems.com</code> / <code>Password@123</code></span>
              <span>🙍 Employee — <code>john@ems.com</code> / <code>Password@123</code></span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
