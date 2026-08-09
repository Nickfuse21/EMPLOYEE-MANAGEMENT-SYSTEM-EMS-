/**
 * Counter model — atomic sequence generator for human-readable IDs.
 *
 * Deriving the next ID from `countDocuments()` is unsafe: two concurrent creates
 * both read the same count and generate the same ID, so one of them dies on the
 * unique index. It is also wrong after a delete, because the count goes back
 * down and a previously-used ID is handed out again.
 *
 * A counter document fixes both. `findOneAndUpdate` with `$inc` is a single
 * atomic operation in MongoDB, so each caller is guaranteed a distinct,
 * monotonically increasing number no matter how many run at once.
 */
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const counterSchema = new Schema({
  // Sequence name, e.g. 'employee' or 'ticket'.
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = model('Counter', counterSchema);

/**
 * Atomically reserves and returns the next number in a named sequence.
 *
 * @param {string} name              Sequence name.
 * @param {object} [options]
 * @param {import('mongoose').ClientSession} [options.session]
 * @returns {Promise<number>} The reserved value (first call returns 1).
 */
export async function nextSequence(name, { session } = {}) {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );
  return counter.seq;
}

/**
 * Formats a reserved sequence number as a prefixed, zero-padded reference.
 * e.g. formatReference('EMP', 7) === 'EMP-0007'
 */
export function formatReference(prefix, seq, width = 4) {
  return `${prefix}-${String(seq).padStart(width, '0')}`;
}
