/**
 * Policy-assistant controller.
 *
 * Employees browse the handbook and ask free-text questions; answers are grounded
 * in real policy text and cited. The access-control guarantee lives here: every
 * query is scoped to `audience: req.user.role`, so restricted (e.g. compensation)
 * documents are never loaded for a user who isn't allowed to see them.
 */
import { PolicyDoc } from '../models/PolicyDoc.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { searchPolicies } from '../services/policySearchService.js';

/** Only documents whose audience includes the caller's role are ever visible. */
function visibilityFilter(user) {
  return { audience: user.role };
}

/**
 * GET /api/policies
 * List the handbook documents the current user is allowed to see (titles +
 * categories only — cheap for the browse view).
 */
export const listPolicies = asyncHandler(async (req, res) => {
  const docs = await PolicyDoc.find(visibilityFilter(req.user))
    .select('title category updatedAt')
    .sort({ category: 1, title: 1 });
  res.json({ success: true, data: docs });
});

/**
 * GET /api/policies/:id
 * Read one full document — but only if it is within the caller's audience.
 */
export const getPolicy = asyncHandler(async (req, res) => {
  const doc = await PolicyDoc.findOne({ _id: req.params.id, ...visibilityFilter(req.user) });
  if (!doc) throw ApiError.notFound('Policy not found'); // 404, not 403 — don't reveal it exists.
  res.json({ success: true, data: doc });
});

/**
 * POST /api/policies/ask
 * Answer a free-text question from the handbook, with citations.
 * Body: { question: string }
 */
export const askPolicy = asyncHandler(async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) throw ApiError.badRequest('Please enter a question');

  // Load ONLY the documents this user may see, then search within them.
  const docs = await PolicyDoc.find(visibilityFilter(req.user));
  const matches = searchPolicies(question, docs, 3);

  if (matches.length === 0) {
    return res.json({
      success: true,
      data: {
        answer: null,
        message: "I couldn't find anything about that in the handbook you have access to.",
        citations: [],
      },
    });
  }

  // The top passage is the answer; every match becomes a citation.
  const [top] = matches;
  res.json({
    success: true,
    data: {
      answer: top.passage,
      matchedTerms: top.matchedTerms,
      citations: matches.map((m) => ({
        id: m.doc.id,
        title: m.doc.title,
        category: m.doc.category,
        passage: m.passage,
      })),
    },
  });
});
