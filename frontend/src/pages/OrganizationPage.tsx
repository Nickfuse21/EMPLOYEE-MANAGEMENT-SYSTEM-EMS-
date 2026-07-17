/**
 * Organisation chart page.
 *
 * Renders the reporting hierarchy returned by /api/organization/tree as a
 * recursive, collapsible tree. Each node shows the person and their direct
 * reports nested beneath them, connected with subtle guide lines.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Network } from 'lucide-react';
import { orgApi } from '../api/employees';
import type { OrgNode } from '../types';
import { ROLE_LABELS } from '../lib/constants';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { PageTransition } from '../components/ui/PageTransition';

/** Recursive tree node. Collapsible when it has children. */
function TreeNode({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2); // Auto-expand the top two levels.
  const hasChildren = node.directReports.length > 0;

  return (
    <li className="relative">
      <div className="group flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-3 shadow-sm backdrop-blur-sm transition hover:border-brand-300 hover:shadow-soft dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-brand-500/40">
        {/* Expand / collapse toggle. */}
        {hasChildren ? (
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }}>
              <ChevronRight size={16} />
            </motion.span>
          </button>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          </span>
        )}

        <Avatar name={node.name} src={node.profileImage} size="sm" ring />
        <div className="min-w-0 flex-1">
          <Link to={`/employees/${node._id}`} className="font-semibold text-slate-800 transition hover:text-brand-600 dark:text-slate-100 dark:hover:text-brand-300">
            {node.name}
          </Link>
          <p className="truncate text-xs text-slate-400">
            {node.designation || '—'} · {node.department || '—'}
          </p>
        </div>
        <Badge tone={node.role === 'super_admin' ? 'indigo' : 'slate'}>{ROLE_LABELS[node.role]}</Badge>
        {hasChildren && (
          <span className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:inline">
            {node.directReports.length} report{node.directReports.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Children — indented with a connecting left guide line. */}
      <AnimatePresence initial={false}>
        {hasChildren && open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="ml-7 mt-2 space-y-2 overflow-hidden border-l-2 border-slate-200 pl-5 dark:border-slate-800"
          >
            {node.directReports.map((child) => (
              <TreeNode key={child._id} node={child} depth={depth + 1} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

export default function OrganizationPage() {
  const [tree, setTree] = useState<OrgNode[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    orgApi.tree().then(setTree).catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!tree) return <Spinner label="Building org chart…" />;

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
            <Network size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white sm:text-3xl">Organisation Chart</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Reporting hierarchy across the company.</p>
          </div>
        </div>

        {tree.length === 0 ? (
          <p className="text-slate-500">No employees to display.</p>
        ) : (
          <ul className="space-y-2">
            {tree.map((root) => (
              <TreeNode key={root._id} node={root} />
            ))}
          </ul>
        )}
      </div>
    </PageTransition>
  );
}
