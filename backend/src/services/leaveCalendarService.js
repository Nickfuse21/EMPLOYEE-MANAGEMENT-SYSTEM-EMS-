/**
 * Leave calendar — turns a date range into a number of *working* days.
 *
 * This is the arithmetic every HR system is judged on. Counting raw calendar
 * days means a Friday-to-Monday absence costs an employee four days of their
 * entitlement instead of two, and a week containing a public holiday costs five
 * instead of four. Neither is defensible to the person losing the days.
 *
 * All arithmetic is done in UTC so the result never depends on the server's
 * timezone: the same request produces the same day count in every region.
 */
import { Holiday, WORKING_WEEK, toUtcMidnight } from '../models/Holiday.js';

/** True when the given date falls on a configured working day of the week. */
export function isWorkingWeekday(date) {
  return WORKING_WEEK.includes(new Date(date).getUTCDay());
}

/** Every calendar day from start to end inclusive, as UTC-midnight dates. */
function eachDay(start, end) {
  const days = [];
  const cursor = toUtcMidnight(start);
  const last = toUtcMidnight(end);

  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/**
 * Loads the holidays that fall inside a range, as a Set of ISO date strings for
 * O(1) lookup.
 */
async function loadHolidaySet(start, end) {
  const holidays = await Holiday.find({
    date: { $gte: toUtcMidnight(start), $lte: toUtcMidnight(end) },
  }).select('date');

  return new Set(holidays.map((h) => toUtcMidnight(h.date).toISOString()));
}

/**
 * Counts the working days in an inclusive date range, excluding weekends and
 * public holidays.
 *
 * @param {Date|string} start
 * @param {Date|string} end
 * @returns {Promise<{ days: number, breakdown: { total: number, weekends: number, holidays: number } }>}
 */
export async function countWorkingDays(start, end) {
  const all = eachDay(start, end);
  const holidaySet = await loadHolidaySet(start, end);

  let weekends = 0;
  let holidays = 0;
  let working = 0;

  for (const day of all) {
    if (!isWorkingWeekday(day)) {
      weekends += 1;
    } else if (holidaySet.has(day.toISOString())) {
      holidays += 1;
    } else {
      working += 1;
    }
  }

  return {
    days: working,
    breakdown: { total: all.length, weekends, holidays },
  };
}

/**
 * Lists the non-working dates inside a range, so the UI can explain *why* a
 * request costs fewer days than the calendar span suggests.
 */
export async function listNonWorkingDays(start, end) {
  const holidayDocs = await Holiday.find({
    date: { $gte: toUtcMidnight(start), $lte: toUtcMidnight(end) },
  }).sort({ date: 1 });

  const holidaysByIso = new Map(
    holidayDocs.map((h) => [toUtcMidnight(h.date).toISOString(), h.name]),
  );

  return eachDay(start, end)
    .filter((day) => !isWorkingWeekday(day) || holidaysByIso.has(day.toISOString()))
    .map((day) => ({
      date: day.toISOString().slice(0, 10),
      reason: holidaysByIso.get(day.toISOString()) || 'Weekend',
    }));
}
