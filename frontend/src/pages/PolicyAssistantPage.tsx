/**
 * Policy Assistant page (every authenticated user).
 *
 * Ask a plain-English question about company policy and get an answer grounded
 * in the handbook, with the exact source passages cited. Search only runs over
 * the documents your role is allowed to see, so restricted content is never
 * surfaced. Honest framing: this is keyword-relevance search over real docs, not
 * a large language model.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Search, FileText, BookOpen } from 'lucide-react';
import { policyApi } from '../api/features';
import type { PolicyAnswer, PolicySummary } from '../types';
import { staggerContainer, staggerItem } from '../lib/motion';
import { Badge } from '../components/ui/Badge';
import { PageTransition } from '../components/ui/PageTransition';

const SAMPLE_QUESTIONS = [
  'What is the travel meal reimbursement limit?',
  'How many annual leave days do I get?',
  'Can I work remotely?',
];

export default function PolicyAssistantPage() {
  const [docs, setDocs] = useState<PolicySummary[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<PolicyAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    policyApi.list().then(setDocs).catch((err) => setError((err as Error).message));
  }, []);

  const ask = async (q: string) => {
    const query = q.trim();
    if (!query) return;
    setQuestion(query);
    setLoading(true);
    setError('');
    try {
      setAnswer(await policyApi.ask(query));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-white sm:text-3xl">
            <Sparkles className="text-brand-500" /> Policy Assistant
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ask about company policy — answers come straight from the handbook, with sources cited.
          </p>
        </div>

        {/* Ask box. */}
        <div className="card">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-10"
                placeholder="Ask a question about company policy…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask(question)}
              />
            </div>
            <button className="btn-primary" onClick={() => ask(question)} disabled={loading}>
              {loading ? 'Searching…' : 'Ask'}
            </button>
          </div>
          {/* Sample chips. */}
          <div className="mt-3 flex flex-wrap gap-2">
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="rounded-full border border-slate-200 bg-white/60 px-3 py-1 text-xs text-slate-500 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Answer. */}
        {answer && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card border-brand-200/60 dark:border-brand-500/20">
            {answer.answer ? (
              <>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
                  <Sparkles size={16} /> Answer
                </div>
                <p className="whitespace-pre-line text-slate-700 dark:text-slate-200">{answer.answer}</p>

                {answer.citations.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sources</p>
                    <div className="space-y-2">
                      {answer.citations.map((c) => (
                        <div key={c.id} className="flex items-start gap-2 text-sm">
                          <FileText size={16} className="mt-0.5 shrink-0 text-slate-400" />
                          <div>
                            <span className="font-medium text-slate-700 dark:text-slate-200">{c.title}</span>{' '}
                            <Badge tone="slate">{c.category}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">{answer.message}</p>
            )}
          </motion.div>
        )}

        {/* Handbook index (what you're allowed to see). */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
            <BookOpen size={18} className="text-brand-500" /> Handbook ({docs.length} documents)
          </h2>
          <motion.div className="grid grid-cols-1 gap-3 sm:grid-cols-2" variants={staggerContainer} initial="hidden" animate="visible">
            {docs.map((d) => (
              <motion.div key={d._id} variants={staggerItem} className="card flex items-center gap-3">
                <FileText size={18} className="text-brand-500" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800 dark:text-slate-100">{d.title}</p>
                  <Badge tone="slate">{d.category}</Badge>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>
      </div>
    </PageTransition>
  );
}
