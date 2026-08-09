/**
 * Model registry — imports every schema for its side effect of registering the
 * model on the shared mongoose instance.
 *
 * Ordinary application code should import the specific model it needs. This
 * module exists for the cases that need *all* of them at once: building indexes
 * on start-up, and the test harness.
 */
export { Employee } from './Employee.js';
export { LeaveRequest } from './LeaveRequest.js';
export { AuditLog } from './AuditLog.js';
export { Ticket } from './Ticket.js';
export { PolicyDoc } from './PolicyDoc.js';
export { Counter } from './Counter.js';
export { Holiday } from './Holiday.js';
