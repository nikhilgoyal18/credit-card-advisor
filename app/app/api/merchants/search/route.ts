/**
 * GET /api/merchants/search
 * Fuzzy search merchants by name and aliases
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MerchantSearchQuerySchema, MerchantSearchResponseSchema } from '@/lib/validation/schemas';

/**
 * Simple fuzzy matching function
 * Returns true if needle is a fuzzy match for haystack
 */
function fuzzyMatch(needle: string, haystack: string): boolean {
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
 * Calculate relevance score for sorting
 */
function calculateRelevance(query: string, canonical: string, aliases: string[]): number {
  const queryLower = query.toLowerCase();
  const canonicalLower = canonical.toLowerCase();

  let score = 0;

  // Exact match on canonical name = highest score
  if (canonicalLower === queryLower) {
    score += 1000;
  }

  // Starts with query
  if (canonicalLower.startsWith(queryLower)) {
    score += 500;
  }

  // Contains query as substring
  if (canonicalLower.includes(queryLower)) {
    score += 200;
  }

  // Check aliases
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const limitParam = searchParams.get('limit');

    const validationResult = MerchantSearchQuerySchema.safeParse({
      q,
      limit: limitParam ? parseInt(limitParam, 10) : undefined,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'q parameter is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { q: query, limit = 10 } = validationResult.data;

    // Fetch merchants
    const { data: merchants, error: merchantsError } = await supabase
      .from('merchants')
      .select('id, canonical_name, aliases, primary_category')
      .limit(100); // Fetch more than needed for client-side filtering

    if (merchantsError) {
      return NextResponse.json(
        { error: 'Database error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }

    // Client-side fuzzy filtering and sorting
    const results = (merchants || [])
      .filter((merchant) => {
        // Check if query matches canonical name
        if (fuzzyMatch(query, merchant.canonical_name)) {
          return true;
        }

        // Check if query matches any alias
        return merchant.aliases.some((alias: string) => fuzzyMatch(query, alias));
      })
      .map((merchant) => ({
        ...merchant,
        _relevance: calculateRelevance(query, merchant.canonical_name, merchant.aliases),
      }))
      .sort((a, b) => b._relevance - a._relevance)
      .slice(0, limit)
      .map(({ _relevance, ...rest }) => rest);

    const response = {
      data: results,
      query,
      count: results.length,
    };

    const responseValidation = MerchantSearchResponseSchema.safeParse(response);
    if (!responseValidation.success) {
      console.error('Response validation failed:', responseValidation.error);
      return NextResponse.json(
        { error: 'Internal server error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Merchant search error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
