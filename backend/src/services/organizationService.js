/**
 * Organisational-hierarchy helpers.
 *
 * The reporting structure is a tree stored as parent pointers
 * (`reportingManager`). These helpers keep that tree valid (no cycles) and can
 * assemble it into a nested structure for the frontend.
 */
import { Employee } from '../models/Employee.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Guards against circular reporting. A cycle would occur if the proposed
 * manager is the employee themselves, or if the employee already appears
 * somewhere *above* the proposed manager in the chain.
 *
 * Walks up from `managerId` following each manager's own manager; if we reach
 * `employeeId`, assigning would close a loop.
 *
 * @throws {ApiError} 400 when the assignment would create a cycle.
 */
export async function assertNoCircularReporting(employeeId, managerId) {
  if (!managerId) return; // Clearing the manager can never create a cycle.

  const empIdStr = employeeId.toString();
  if (empIdStr === managerId.toString()) {
    throw ApiError.badRequest('An employee cannot report to themselves');
  }

  let cursorId = managerId.toString();
  const visited = new Set(); // Also protects against pre-existing corrupt loops.

  while (cursorId) {
    if (cursorId === empIdStr) {
      throw ApiError.badRequest(
        'This assignment would create a circular reporting relationship',
      );
    }
    if (visited.has(cursorId)) break;
    visited.add(cursorId);

    const manager = await Employee.findById(cursorId).select('reportingManager').lean();
    if (!manager) throw ApiError.badRequest('Reporting manager not found');
    cursorId = manager.reportingManager ? manager.reportingManager.toString() : null;
  }
}

/**
 * Builds the full company reporting tree (top-level employees are those with no
 * manager). Runs in O(n): one DB read, then an in-memory grouping pass.
 *
 * @returns {Array} Roots, each with a recursive `directReports` array.
 */
export async function buildOrganizationTree() {
  const employees = await Employee.find({ isDeleted: false })
    .select('name email employeeId designation department role status reportingManager profileImage')
    .lean();

  // Index every node by id and give it an empty children list.
  const byId = new Map();
  for (const emp of employees) {
    byId.set(emp._id.toString(), { ...emp, directReports: [] });
  }

  // Link each node to its manager; nodes without a (valid) manager are roots.
  const roots = [];
  for (const node of byId.values()) {
    const managerId = node.reportingManager?.toString();
    const parent = managerId ? byId.get(managerId) : null;
    if (parent) parent.directReports.push(node);
    else roots.push(node);
  }

  return roots;
}
