/**
 * PolicyDoc model — an HR handbook article the Policy Assistant searches over.
 *
 * The `audience` array is the access-control lever: it lists the roles allowed
 * to see a document. This is exactly how we stop "executive-only" content (e.g.
 * compensation bands) from leaking to a standard employee — a query only ever
 * searches documents whose `audience` includes the caller's role. Access is
 * enforced in the query filter, not after the fact, so restricted content is
 * never even loaded for the wrong user.
 */
import mongoose from 'mongoose';
import { ROLE_VALUES } from '../utils/roles.js';

const { Schema, model } = mongoose;

export const POLICY_CATEGORIES = Object.freeze([
  'leave',
  'benefits',
  'conduct',
  'it',
  'travel',
  'compensation',
]);

const policyDocSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, enum: POLICY_CATEGORIES, default: 'conduct', index: true },

    // Roles permitted to read this document. Defaults to everyone; sensitive
    // docs (e.g. compensation) are seeded with a narrower audience.
    audience: {
      type: [{ type: String, enum: ROLE_VALUES }],
      default: ROLE_VALUES,
      index: true,
    },

    // The article body. Paragraphs are separated by blank lines; the search
    // service scores each paragraph so it can cite the exact passage.
    content: { type: String, required: true },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

export const PolicyDoc = model('PolicyDoc', policyDocSchema);
