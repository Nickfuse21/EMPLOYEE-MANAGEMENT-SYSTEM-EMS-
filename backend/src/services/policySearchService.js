/**
 * Policy search — the dependency-free core of the Policy Assistant.
 *
 * Keyword-relevance search: split each document into paragraphs, score every
 * paragraph by how many of the question's meaningful words it contains (weighting
 * rarer words higher — the classic TF-IDF idea), and return the best-matching
 * passages as the answer, with the document title as a citation. It's explainable
 * end-to-end: you can point at exactly why a passage was chosen.
 *
 * Answers are grounded in real handbook text and always cited, and — critically —
 * search only ever runs over documents the caller is allowed to see (access is
 * filtered before scoring, in the caller).
 */

/** Words too common to be useful for matching. */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'and', 'or', 'in', 'on',
  'for', 'with', 'what', 'how', 'do', 'does', 'i', 'my', 'can', 'me', 'about', 'as',
  'at', 'by', 'be', 'this', 'that', 'it', 'if', 'we', 'you', 'your', 'our', 'am',
]);

/** Lowercase, strip punctuation, split into meaningful (non-stop) word tokens. */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Rank documents against a question and return the best matches with the single
 * most relevant passage from each, plus the terms that matched (for highlighting
 * and for showing *why* it matched).
 *
 * @param {string} question
 * @param {Array}  docs   - PolicyDoc documents the caller is allowed to see.
 * @param {number} [limit]
 */
export function searchPolicies(question, docs, limit = 3) {
  const queryTerms = [...new Set(tokenize(question))];
  if (queryTerms.length === 0 || docs.length === 0) return [];

  // Inverse document frequency: rare words across the corpus matter more.
  const idf = {};
  for (const term of queryTerms) {
    const containing = docs.filter((d) => d.content.toLowerCase().includes(term)).length;
    idf[term] = Math.log((docs.length + 1) / (containing + 1)) + 1;
  }

  const scored = docs.map((doc) => {
    // Break the document into paragraphs and score each one.
    const paragraphs = doc.content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    let bestParagraph = paragraphs[0] || '';
    let bestParaScore = -1;
    const matchedTerms = new Set();

    for (const para of paragraphs) {
      const paraTokens = tokenize(para);
      let paraScore = 0;
      for (const term of queryTerms) {
        const freq = paraTokens.filter((t) => t === term).length;
        if (freq > 0) {
          paraScore += freq * idf[term];
          matchedTerms.add(term);
        }
      }
      if (paraScore > bestParaScore) {
        bestParaScore = paraScore;
        bestParagraph = para;
      }
    }

    // A small boost when query terms appear in the title.
    const titleTokens = tokenize(doc.title);
    const titleBoost = queryTerms.filter((t) => titleTokens.includes(t)).length * 1.5;

    return {
      doc,
      score: bestParaScore + titleBoost,
      passage: bestParagraph,
      matchedTerms: [...matchedTerms],
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
