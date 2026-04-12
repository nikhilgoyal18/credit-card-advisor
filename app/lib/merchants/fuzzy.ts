/**
 * Shared fuzzy matching utilities for merchant name resolution.
 *
 * Candidate scoring pipeline (used in both search and location detection):
 *   1. For each source string (e.g. Overpass name/brand/operator, or user query),
 *      call calculateRelevance() against each merchant's canonical_name + aliases.
 *   2. Take the MAX score per merchant across all candidate strings.
 *   3. Rank merchants by score descending; take top N.
 *
 * Score reference:
 *   1000 = exact canonical match
 *    800 = exact alias match
 *    500 = canonical starts with query
 *    300 = alias starts with query
 *    200 = canonical contains query as substring
 *    100 = alias contains query as substring
 *      0 = no match
 */

/**
 * Returns true if needle is a fuzzy match for haystack.
 * Checks substring containment first, then character-by-character order.
 */
export function fuzzyMatch(needle: string, haystack: string): boolean {
  const needleLower = needle.toLowerCase();
  const haystackLower = haystack.toLowerCase();

  if (haystackLower.includes(needleLower)) {
    return true;
  }

  // Character-by-character fuzzy match
  let needleIdx = 0;
  for (let i = 0; i < haystackLower.length; i++) {
    if (haystackLower[i] === needleLower[needleIdx]) {
      needleIdx++;
    }
    if (needleIdx === needleLower.length) {
      return true;
    }
  }

  return false;
}

/**
 * Returns a relevance score for how well `query` matches a merchant.
 * Higher is better. Returns 0 if no match.
 */
export function calculateRelevance(query: string, canonical: string, aliases: string[]): number {
  const queryLower = query.toLowerCase();
  const canonicalLower = canonical.toLowerCase();

  let score = 0;

  if (canonicalLower === queryLower) {
    score += 1000;
  } else if (canonicalLower.startsWith(queryLower)) {
    score += 500;
  } else if (canonicalLower.includes(queryLower)) {
    score += 200;
  }

  for (const alias of aliases) {
    const aliasLower = alias.toLowerCase();
    if (aliasLower === queryLower) {
      score += 800;
    } else if (aliasLower.startsWith(queryLower)) {
      score += 300;
    } else if (aliasLower.includes(queryLower)) {
      score += 100;
    }
  }

  return score;
}
