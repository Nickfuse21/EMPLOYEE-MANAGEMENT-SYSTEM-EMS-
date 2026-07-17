/**
 * Analytics controller — predictive/HR insights.
 *
 * Currently exposes the attrition ("flight risk") report. Restricted to HR &
 * Super Admin at the route level because it surfaces sensitive, per-person
 * signals (pay position, leave patterns).
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { computeAttritionRisks } from '../services/attritionService.js';

/**
 * GET /api/analytics/attrition
 * Returns every active employee scored for flight risk (highest first), plus a
 * summary count per band for the dashboard.
 */
export const getAttritionReport = asyncHandler(async (_req, res) => {
  const risks = await computeAttritionRisks();

  const summary = { high: 0, medium: 0, low: 0 };
  for (const r of risks) summary[r.band] += 1;

  res.json({ success: true, data: { summary, employees: risks } });
});
