/**
 * LeaveRequest model.
 *
 * A single leave application: who is asking, what type, the date range, and its
 * approval status. Leave *balance* is not stored as a mutable counter — instead
 * we derive "days used" by summing approved requests (see leaveController), so
 * the balance can never drift out of sync with the underlying records. That is
 * the honest, hard-to-get-wrong way to track balances.
 */
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export const LEAVE_TYPES = Object.freeze(['annual', 'sick', 'casual', 'unpaid']);
export const LEAVE_STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'cancelled']);

/** Company-wide annual entitlement per paid leave type (days). Unpaid is uncapped. */
export const LEAVE_ALLOWANCE = Object.freeze({ annual: 20, sick: 10, casual: 5 });

const leaveRequestSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    type: { type: String, enum: LEAVE_TYPES, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    // Whole-day count for the request, computed on save from the date range.
    days: { type: Number, required: true, min: 0.5 },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: LEAVE_STATUSES, default: 'pending', index: true },

    // Who approved/rejected it, and any note they left.
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    reviewNote: { type: String, trim: true, maxlength: 500, default: '' },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

export const LeaveRequest = model('LeaveRequest', leaveRequestSchema);

/** Inclusive whole-day count between two dates (min 1 day). */
export function countLeaveDays(start, end) {
  const ms = new Date(end).setHours(0, 0, 0, 0) - new Date(start).setHours(0, 0, 0, 0);
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}
