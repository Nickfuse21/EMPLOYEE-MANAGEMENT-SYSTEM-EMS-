/**
 * Holiday model — the company's non-working calendar.
 *
 * Leave is measured in *working* days, so the leave engine needs to know which
 * dates don't count. Weekends are configured per-organisation (see
 * `WORKING_WEEK` below); public holidays are data, because they differ by year
 * and by country and HR must be able to maintain them without a code change.
 *
 * Dates are stored normalised to UTC midnight so a lookup is an exact match and
 * never depends on the server's timezone.
 */
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * Days of the week that are working days (0 = Sunday … 6 = Saturday).
 * Defaults to a Monday–Friday week.
 */
export const WORKING_WEEK = Object.freeze([1, 2, 3, 4, 5]);

const holidaySchema = new Schema(
  {
    // UTC-midnight instant of the holiday.
    date: { type: Date, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Optional country/region label for organisations with multiple locations.
    region: { type: String, trim: true, default: 'ALL', index: true },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

export const Holiday = model('Holiday', holidaySchema);

/** Normalises any date-like value to that calendar day at UTC midnight. */
export function toUtcMidnight(value) {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
