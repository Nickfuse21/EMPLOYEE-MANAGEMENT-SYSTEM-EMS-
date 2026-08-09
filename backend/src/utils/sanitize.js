/**
 * Input-sanitising helpers for values that reach the database.
 */

/**
 * Escapes every regular-expression metacharacter in a user-supplied string so it
 * can be used safely inside `$regex`.
 *
 * Without this, a search box is a code-injection point: `.*` scans the whole
 * collection, and a catastrophically-backtracking pattern such as `(a+)+$`
 * blocks the event loop for the entire process (a ReDoS denial of service).
 * Escaping turns the input back into a literal string to look for.
 */
export function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a safe case-insensitive "contains" matcher for a user-supplied term,
 * capping the length so a huge input cannot make the scan pathological.
 */
export function containsMatcher(term, maxLength = 100) {
  return { $regex: escapeRegex(String(term).slice(0, maxLength)), $options: 'i' };
}
