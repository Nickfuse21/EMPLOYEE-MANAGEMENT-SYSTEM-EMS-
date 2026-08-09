/**
 * Holiday-calendar controller.
 *
 * The calendar is data, not code: public holidays differ by year and by country,
 * so HR must be able to maintain them without a deployment. Everyone can read
 * the calendar (it drives the leave preview); only HR and Super Admin can change
 * it, because a holiday directly changes what everyone's leave costs them.
 */
import { Holiday, toUtcMidnight } from '../models/Holiday.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/holidays?year=2026
 * The holiday calendar for one year, earliest first.
 */
export const listHolidays = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getUTCFullYear();
  const holidays = await Holiday.find({
    date: { $gte: new Date(Date.UTC(year, 0, 1)), $lte: new Date(Date.UTC(year, 11, 31)) },
  }).sort({ date: 1 });

  res.json({ success: true, data: holidays });
});

/**
 * POST /api/holidays
 * Add a holiday. HR & Super Admin only (route guard).
 */
export const createHoliday = asyncHandler(async (req, res) => {
  const { date, name, region = 'ALL' } = req.body;

  // Normalised so a lookup is an exact match regardless of the caller's timezone.
  const holiday = await Holiday.create({ date: toUtcMidnight(date), name, region });

  res.status(201).json({ success: true, message: 'Holiday added', data: holiday });
});

/**
 * DELETE /api/holidays/:id
 * Remove a holiday. HR & Super Admin only (route guard).
 */
export const deleteHoliday = asyncHandler(async (req, res) => {
  const deleted = await Holiday.findByIdAndDelete(req.params.id);
  if (!deleted) throw ApiError.notFound('Holiday not found');

  res.json({ success: true, message: 'Holiday removed' });
});
