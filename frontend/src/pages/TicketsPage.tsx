/**
 * Helpdesk page.
 *
 * Employees raise IT/HR tickets and follow their own; HR & Super Admin see every
 * ticket and can triage it (change status/priority) and reply. The detail view
 * opens in a modal with the full comment thread.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, LifeBuoy, Send } from 'lucide-react';
import { ticketApi } from '../api/features';
import type { Ticket, TicketCategory, TicketPriority, TicketStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  TICKET_CATEGORY_OPTIONS,
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
  STATUS_TONE,
  PRIORITY_TONE,
} from '../lib/constants';
import { formatDate } from '../lib/format';
import { staggerContainer, staggerItem } from '../lib/motion';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { Modal } from '../components/ui/Modal';
import { PageTransition } from '../components/ui/PageTransition';

export default function TicketsPage() {
  const { hasRole } = useAuth();
  const isAgent = hasRole('super_admin', 'hr_manager');

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [active, setActive] = useState<Ticket | null>(null);

  const load = () => {
    setLoading(true);
    ticketApi
      .list()
      .then((t) => {
        setTickets(t);
        setError('');
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <Spinner label="Loading tickets…" />;

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white sm:text-3xl">Helpdesk</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isAgent ? 'Triage and resolve staff requests' : 'Raise a request and track its progress'}
            </p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={18} /> New ticket
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {tickets.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 py-12 text-center">
            <LifeBuoy className="text-slate-300" size={36} />
            <p className="text-slate-500">No tickets yet. Raise one to get help.</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {tickets.map((t) => (
              <motion.button
                key={t._id}
                variants={staggerItem}
                onClick={() => setActive(t)}
                className="card text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft dark:hover:border-brand-500/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{t.subject}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{t.ticketId} · {formatDate(t.createdAt)}</p>
                  </div>
                  <Badge tone={STATUS_TONE[t.status]} dot>{t.status.replace('_', ' ')}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{t.description}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Badge tone="slate">{t.category.toUpperCase()}</Badge>
                  <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                  {isAgent && (
                    <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
                      <Avatar name={t.raisedBy.name} src={t.raisedBy.profileImage} size="sm" />
                      {t.raisedBy.name}
                    </span>
                  )}
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}

        <TicketFormModal open={showForm} onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); load(); }} onError={setError} />
        <TicketDetailModal
          ticket={active}
          isAgent={isAgent}
          onClose={() => setActive(null)}
          onChanged={(updated) => {
            setActive(updated);
            setTickets((list) => list.map((t) => (t._id === updated._id ? updated : t)));
          }}
          onError={setError}
        />
      </div>
    </PageTransition>
  );
}

/** Modal to raise a new ticket. */
function TicketFormModal({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onError: (m: string) => void;
}) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('it');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (subject.trim().length < 3 || !description.trim()) return onError('Add a subject and description');
    setSaving(true);
    try {
      await ticketApi.create({ subject, description, category, priority });
      setSubject('');
      setDescription('');
      onCreated();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Raise a ticket"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'Submitting…' : 'Submit'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Subject</label>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
              {TICKET_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
              {TICKET_PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue…" />
        </div>
      </div>
    </Modal>
  );
}

/** Ticket detail + comment thread; agents can also change status/priority. */
function TicketDetailModal({
  ticket,
  isAgent,
  onClose,
  onChanged,
  onError,
}: {
  ticket: Ticket | null;
  isAgent: boolean;
  onClose: () => void;
  onChanged: (t: Ticket) => void;
  onError: (m: string) => void;
}) {
  const [comment, setComment] = useState('');

  if (!ticket) return null;

  const patch = async (payload: { status?: TicketStatus; priority?: TicketPriority }) => {
    try {
      onChanged(await ticketApi.update(ticket._id, payload));
    } catch (err) {
      onError((err as Error).message);
    }
  };
  const send = async () => {
    if (!comment.trim()) return;
    try {
      onChanged(await ticketApi.comment(ticket._id, comment));
      setComment('');
    } catch (err) {
      onError((err as Error).message);
    }
  };

  return (
    <Modal open={!!ticket} title={ticket.subject} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="slate">{ticket.ticketId}</Badge>
          <Badge tone={STATUS_TONE[ticket.status]} dot>{ticket.status.replace('_', ' ')}</Badge>
          <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>
          <Badge tone="slate">{ticket.category.toUpperCase()}</Badge>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">{ticket.description}</p>
        <p className="text-xs text-slate-400">Raised by {ticket.raisedBy.name} · {formatDate(ticket.createdAt)}</p>

        {/* Agent triage controls. */}
        {isAgent && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <div>
              <label className="label">Status</label>
              <select className="input" value={ticket.status} onChange={(e) => patch({ status: e.target.value as TicketStatus })}>
                {TICKET_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={ticket.priority} onChange={(e) => patch({ priority: e.target.value as TicketPriority })}>
                {TICKET_PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Comment thread. */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Conversation</p>
          {ticket.comments.length === 0 ? (
            <p className="text-xs text-slate-400">No replies yet.</p>
          ) : (
            ticket.comments.map((c, i) => (
              <div key={c._id || i} className="rounded-xl bg-slate-100/70 p-3 dark:bg-slate-800/60">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{c.authorName}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{c.body}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(c.createdAt)}</p>
              </div>
            ))
          )}
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Write a reply…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button className="btn-primary !px-3" onClick={send} aria-label="Send"><Send size={16} /></button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
