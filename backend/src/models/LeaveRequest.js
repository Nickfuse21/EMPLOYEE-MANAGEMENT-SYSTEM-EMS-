/**
 * LeaveRequest model.
 *
 * A single leave application: who is asking, what type, the date range, and its
 * approval status. Leave *balance* is not stored as a mutable counter — instead
 * it is derived by summing approved and pending requests (see
 * services/leaveBalanceService.js), so the balance can never drift out of sync
 * with the underlying records.
 *
 * `days` holds *working* days, which is what an entitlement is actually measured
 * in; `calendarDays` keeps the raw span for display ("12–16 Aug, 3 working days
 * of a 5-day span").
 */
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export const LEAVE_TYPES = Object.freeze(['annual', 'sick', 'casual', 'unpaid']);
export const LEAVE_STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'cancelled']);

/** Company-wide annual entitlement per paid leave type (days). Unpaid is uncapped. */
export const LEAVE_ALLOWANCE = Object.freeze({ annual: 20, sick: 10, casual: 5 });

/** Which half of the day a half-day request covers. */
export const HALF_DAY_SLOTS = Object.freeze(['first_half', 'second_half']);

const leaveRequestSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    type: { type: String, enum: LEAVE_TYPES, required: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },

    // Working days consumed — weekends and public holidays already removed.
    days: { type: Number, required: true, min: 0.5 },
    // Raw inclusive span, kept for display alongside the working-day figure.
    calendarDays: { type: Number, default: 0 },
    // A single-day request may be taken as a half day.
    halfDay: { type: String, enum: [...HALF_DAY_SLOTS, null], default: null },

    reason: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: LEAVE_STATUSES, default: 'pending', index: true },

    // The manager this request is waiting on. Set from the employee's reporting
    // line at submission time so that later re-orgs cannot silently move an
    // in-flight request to someone else's queue.
    pendingWith: { type: Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },

    // Who approved/rejected it, and any note they left.
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    reviewNote: { type: String, trim: true, maxlength: 500, default: '' },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

// Supports both "my requests, newest first" and the overlap check.
leaveRequestSchema.index({ employee: 1, status: 1, startDate: -1 });

export const LeaveRequest = model('LeaveRequest', leaveRequestSchema);

/**
 * Inclusive whole-day count between two dates, ignoring weekends and holidays.
 *
 * Kept for the seed script and for display only. Anything that draws down an
 * entitlement must use `countWorkingDays` from services/leaveCalendarService.js
 * instead — charging an employee for the weekend is not an acceptable default.
 */
export function countCalendarDays(start, end) {
  const ms = new Date(end).setHours(0, 0, 0, 0) - new Date(start).setHours(0, 0, 0, 0);
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}
