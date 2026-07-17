/**
 * Ticket model — the internal IT / HR helpdesk.
 *
 * An employee raises a ticket; HR & Super Admin trage it (assign, change
 * priority, move it through open → in_progress → resolved). Threaded comments
 * are embedded so the whole conversation lives with the ticket.
 */
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export const TICKET_CATEGORIES = Object.freeze(['it', 'hr', 'payroll', 'facilities', 'other']);
export const TICKET_PRIORITIES = Object.freeze(['low', 'medium', 'high', 'urgent']);
export const TICKET_STATUSES = Object.freeze(['open', 'in_progress', 'resolved', 'closed']);

/** One message in a ticket's conversation thread. */
const commentSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    authorName: { type: String, default: '' },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const ticketSchema = new Schema(
  {
    // Human-friendly reference (e.g. "TKT-0007"), generated on save.
    ticketId: { type: String, unique: true, index: true },
    subject: { type: String, required: true, trim: true, minlength: 3, maxlength: 140 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    category: { type: String, enum: TICKET_CATEGORIES, default: 'other', index: true },
    priority: { type: String, enum: TICKET_PRIORITIES, default: 'medium', index: true },
    status: { type: String, enum: TICKET_STATUSES, default: 'open', index: true },

    raisedBy: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },

    comments: { type: [commentSchema], default: [] },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

/** Generate a sequential padded ticketId (TKT-0001, ...) for new tickets. */
ticketSchema.pre('save', async function assignTicketId(next) {
  if (this.ticketId) return next();
  const count = await this.constructor.countDocuments();
  this.ticketId = `TKT-${String(count + 1).padStart(4, '0')}`;
  next();
});

export const Ticket = model('Ticket', ticketSchema);
