/**
 * AuditLog model.
 *
 * An append-only record of every security-critical action (logins, employee
 * create/update/delete, salary changes, role changes). "Append-only" is the key
 * idea: entries are only ever *inserted*, never updated or deleted, so the log
 * is a trustworthy history of who did what and when.
 *
 * This is the honest, plain-Mongo version of the "immutable audit / event log"
 * idea — no event bus or event sourcing framework, just a well-indexed
 * write-once collection that any admin can review.
 */
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/** The finite set of actions we log — keeps entries consistent and filterable. */
export const AUDIT_ACTIONS = Object.freeze({
  LOGIN: 'auth.login',
  LOGIN_FAILED: 'auth.login_failed',
  EMPLOYEE_CREATED: 'employee.created',
  EMPLOYEE_UPDATED: 'employee.updated',
  EMPLOYEE_DELETED: 'employee.deleted',
  SALARY_CHANGED: 'employee.salary_changed',
  ROLE_CHANGED: 'employee.role_changed',
  MANAGER_CHANGED: 'employee.manager_changed',
  LEAVE_DECISION: 'leave.decision',
});

const auditLogSchema = new Schema(
  {
    // What happened (one of AUDIT_ACTIONS).
    action: { type: String, required: true, index: true },

    // Who did it. Stored as both a reference and a denormalised name/email so the
    // log stays readable even if the actor is later renamed or removed.
    actor: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    actorName: { type: String, default: 'System' },
    actorRole: { type: String, default: '' },

    // Who/what it was done to (optional — e.g. logins have no target).
    target: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    targetName: { type: String, default: '' },

    // Human-readable summary shown in the UI, e.g. "Salary changed 90000 → 95000".
    summary: { type: String, default: '' },

    // Structured extra detail (before/after values, ip, etc.) for deeper review.
    metadata: { type: Schema.Types.Mixed, default: {} },

    // Request origin, useful for spotting unusual access patterns.
    ip: { type: String, default: '' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only creation time matters.
    toJSON: { virtuals: true },
  },
);

// Most audit views are "newest first" — index supports that ordering cheaply.
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = model('AuditLog', auditLogSchema);
