/**
 * Attrition / flight-risk page (HR & Super Admin).
 *
 * Shows a transparent, rule-based risk score for each active employee. Every
 * score expands into the named factors that produced it, so the reason behind
 * each score is always visible.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, Info, ChevronDown } from 'lucide-react';
import { analyticsApi } from '../api/features';
import type { AttritionReport, AttritionRisk } from '../types';
import { formatDate } from '../lib/format';
import { staggerContainer, staggerItem } from '../lib/motion';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { PageTransition } from '../components/ui/PageTransition';

const BAND_TONE = { high: 'red', medium: 'amber', low: 'green' } as const;

export default function AttritionPage() {
  const [report, setReport] = useState<AttritionReport | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    analyticsApi.attrition().then(setReport).catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!report) return <Spinner label="Scoring attrition risk…" />;

  const { summary, employees } = report;

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white sm:text-3xl">Attrition Risk</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Early-warning flags so you can intervene before people leave
          </p>
        </div>

        {/* Disclaimer — this is a transparent rule-based score. */}
        <div className="flex items-start gap-2 rounded-xl border border-brand-200/60 bg-brand-50/60 p-3 text-sm text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-200">
          <Info size={18} className="mt-0.5 shrink-0" />
          <p>
            This is a <strong>transparent, rule-based score</strong> (0–100) built from data the system already
            holds — pay vs. the department median, leave usage, open helpdesk tickets, and tenure. Every point is
            explained below. It is a prompt to check in, not a prediction.
          </p>
        </div>

        {/* Band summary. */}
        <div className="grid grid-cols-3 gap-4">
          <SummaryTile label="High risk" value={summary.high} tone="red" />
          <SummaryTile label="Medium risk" value={summary.medium} tone="amber" />
          <SummaryTile label="Low risk" value={summary.low} tone="green" />
        </div>

        {/* Scored list. */}
        <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
          {employees.map((r) => (
            <motion.div key={r.employee._id} variants={staggerItem}>
              <RiskRow
                risk={r}
                open={expanded === r.employee._id}
                onToggle={() => setExpanded((id) => (id === r.employee._id ? null : r.employee._id))}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </PageTransition>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: 'red' | 'amber' | 'green' }) {
  const ring = { red: 'text-red-600', amber: 'text-amber-600', green: 'text-green-600' }[tone];
  return (
    <div className="card text-center">
      <p className={`text-4xl font-bold ${ring}`}>{value}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function RiskRow({ risk, open, onToggle }: { risk: AttritionRisk; open: boolean; onToggle: () => void }) {
  const { employee: e, score, band, factors } = risk;
  return (
    <div className="card">
      <button className="flex w-full items-center gap-4 text-left" onClick={onToggle}>
        <Avatar name={e.name} src={e.profileImage} size="md" ring />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{e.name}</p>
          <p className="truncate text-xs text-slate-400">
            {e.designation || '—'} · {e.department || '—'} · joined {formatDate(e.joiningDate)}
          </p>
        </div>
        {/* Score bar. */}
        <div className="hidden w-40 sm:block">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full ${band === 'high' ? 'bg-red-500' : band === 'medium' ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-lg font-bold text-slate-700 dark:text-slate-200">{score}</span>
          <Badge tone={BAND_TONE[band]} dot>{band}</Badge>
          <ChevronDown size={18} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Factor breakdown. */}
      {open && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {factors.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <TrendingDown size={16} className="text-green-500" /> No risk factors flagged.
            </p>
          ) : (
            factors.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{f.label}</span>
                <span className="tabular-nums font-semibold text-slate-500">+{f.points}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
