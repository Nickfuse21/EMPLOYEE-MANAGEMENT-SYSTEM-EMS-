/**
 * Audit service — the single place that writes to the audit log.
 *
 * Controllers call `recordAudit(...)` after a critical action succeeds. Writing
 * is deliberately "fire-and-forget with a safety net": a failure to log must
 * never break the user's actual request, so we catch and console.error instead
 * of throwing. The log is important, but it is a side-channel — not the primary
 * operation.
 */
import { AuditLog } from '../models/AuditLog.js';

/**
 * Append one entry to the audit log.
 *
 * @param {object}  opts
 * @param {string}  opts.action    - one of AUDIT_ACTIONS.
 * @param {object} [opts.actor]    - the Employee performing the action (req.user).
 * @param {object} [opts.target]   - the Employee being acted upon.
 * @param {string} [opts.summary]  - human-readable one-liner for the UI.
 * @param {object} [opts.metadata] - structured before/after detail.
 * @param {string} [opts.ip]       - request IP.
 */
export async function recordAudit({ action, actor, target, summary = '', metadata = {}, ip = '' }) {
  try {
    await AuditLog.create({
      action,
      actor: actor?._id ?? null,
      actorName: actor?.name ?? 'System',
      actorRole: actor?.role ?? '',
      target: target?._id ?? null,
      targetName: target?.name ?? '',
      summary,
      metadata,
      ip,
    });
  } catch (err) {
    // Never let an audit-logging failure surface to the caller.
    console.error('⚠️  Failed to write audit log:', err.message);
  }
}

/**
 * Compares an employee's fields before/after an update and returns a list of
 * significant changes worth auditing individually (salary and role changes are
 * the headline "critical actions" from the assignment). Returns an array of
 * { action, summary } so the caller can log each one.
 */
export function diffSensitiveChanges(before, updates) {
  const changes = [];

  if (updates.salary !== undefined && Number(updates.salary) !== Number(before.salary)) {
    changes.push({
      action: 'employee.salary_changed',
      summary: `Salary changed ${before.salary} → ${updates.salary}`,
      metadata: { from: before.salary, to: Number(updates.salary) },
    });
  }

  if (updates.role !== undefined && updates.role !== before.role) {
    changes.push({
      action: 'employee.role_changed',
      summary: `Role changed ${before.role} → ${updates.role}`,
      metadata: { from: before.role, to: updates.role },
    });
  }

  return changes;
}
