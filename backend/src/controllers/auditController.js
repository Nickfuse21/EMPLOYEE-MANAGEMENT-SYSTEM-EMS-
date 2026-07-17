/**
 * Audit-log controller — read-only access for Super Admins.
 *
 * There is intentionally no create/update/delete here: entries are written only
 * by the audit service as a side-effect of real actions, and never edited. This
 * controller just lets an admin browse and filter the history.
 */
import { AuditLog } from '../models/AuditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/audit
 * Paginated, newest-first audit trail. Optional ?action= and ?search= filters.
 * Super Admin only (route guard).
 */
export const listAuditLogs = asyncHandler(async (req, res) => {
  const { action, search = '', page = 1, limit = 20 } = req.query;

  const filter = {};
  if (action) filter.action = action;
  if (search) {
    filter.$or = [
      { actorName: { $regex: search, $options: 'i' } },
      { targetName: { $regex: search, $options: 'i' } },
      { summary: { $regex: search, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, Number(page));
  const pageSize = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * pageSize;

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    AuditLog.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: items,
    pagination: {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  });
});
