/**
 * "My Team" page — available to every authenticated user.
 *
 * Gives each person a self-service view of their place in the organisation:
 *   • their reporting manager,
 *   • their peers (colleagues who share the same manager), and
 *   • their own direct reports.
 *
 * This is especially valuable for plain Employees, who don't have access to the
 * company-wide directory but should still see their immediate team.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserCog, Users, GitBranch, Sparkles } from 'lucide-react';
import { orgApi } from '../api/employees';
import type { Employee, MyTeam } from '../types';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../lib/constants';
import { staggerContainer, staggerItem } from '../lib/motion';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { PageTransition } from '../components/ui/PageTransition';

export default function MyTeamPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState<MyTeam | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    orgApi.myTeam().then(setTeam).catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!team || !user) return <Spinner label="Loading your team…" />;

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Personalised welcome banner. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-brand-gradient p-6 text-white shadow-glow"
        >
          <div aria-hidden className="absolute -right-6 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <Avatar name={user.name} src={user.profileImage} size="lg" ring />
            <div>
              <p className="text-sm text-white/80">{greeting} 👋</p>
              <h1 className="text-2xl font-bold sm:text-3xl">{user.name}</h1>
              <p className="text-sm text-white/80">
                {user.designation || ROLE_LABELS[user.role]}
                {user.department ? ` · ${user.department}` : ''}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Reporting manager. */}
        <section>
          <SectionHeader icon={UserCog} title="My Manager" />
          {team.manager ? (
            <PersonCard person={team.manager} highlight />
          ) : (
            <div className="card flex items-center gap-3 text-sm text-slate-500">
              <Sparkles size={18} className="text-brand-500" />
              You’re at the top of the reporting chain — no manager assigned.
            </div>
          )}
        </section>

        {/* Direct reports. */}
        <section>
          <SectionHeader icon={GitBranch} title="My Direct Reports" count={team.directReports.length} />
          {team.directReports.length === 0 ? (
            <p className="card text-sm text-slate-500">No one reports to you yet.</p>
          ) : (
            <PeopleGrid people={team.directReports} />
          )}
        </section>

        {/* Peers. */}
        <section>
          <SectionHeader icon={Users} title="My Peers" count={team.peers.length} />
          {team.peers.length === 0 ? (
            <p className="card text-sm text-slate-500">No peers on your team.</p>
          ) : (
            <PeopleGrid people={team.peers} />
          )}
        </section>
      </div>
    </PageTransition>
  );
}

function SectionHeader({ icon: Icon, title, count }: { icon: typeof Users; title: string; count?: number }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={18} className="text-brand-600 dark:text-brand-400" />
      <h2 className="font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
      {count !== undefined && <span className="text-sm text-slate-400">({count})</span>}
    </div>
  );
}

function PeopleGrid({ people }: { people: Employee[] }) {
  return (
    <motion.div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {people.map((p) => (
        <motion.div key={p._id} variants={staggerItem}>
          <PersonCard person={p} />
        </motion.div>
      ))}
    </motion.div>
  );
}

function PersonCard({ person, highlight = false }: { person: Employee; highlight?: boolean }) {
  return (
    <Link
      to={`/employees/${person._id}`}
      className={`card flex items-center gap-3 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft dark:hover:border-brand-500/40 ${
        highlight ? 'ring-1 ring-brand-200 dark:ring-brand-500/20' : ''
      }`}
    >
      <Avatar name={person.name} src={person.profileImage} size="md" ring />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{person.name}</p>
        <p className="truncate text-xs text-slate-400">{person.designation || '—'} · {person.department || '—'}</p>
      </div>
      <Badge tone={person.role === 'super_admin' ? 'indigo' : 'slate'}>{ROLE_LABELS[person.role]}</Badge>
    </Link>
  );
}
