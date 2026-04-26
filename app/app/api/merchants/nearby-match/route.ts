/**
 * POST /api/merchants/nearby-match
 * Accepts a list of OSM merchant names (fetched client-side to avoid Overpass IP blocks)
 * and returns DB-matched merchants with reward estimates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { fuzzyMatch, calculateRelevance } from '@/lib/merchants/fuzzy';

const MATCH_THRESHOLD = 100;

const BodySchema = z.object({
  merchants: z.array(z.object({
    name: z.string(),
    category: z.string().optional(),
  })).max(100),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const { merchants: osmMerchants } = parsed.data;

    // Load all DB merchants for fuzzy matching
    const { data: dbMerchants, error: dbError } = await supabase
      .from('merchants')
      .select('id, canonical_name, aliases, primary_category');
    if (dbError) {
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    const results: object[] = [];
    const claimedIds = new Set<string>();

    for (const osm of osmMerchants) {
      let bestMatch: (typeof dbMerchants)[0] | null = null;
      let bestScore = 0;

      for (const db of dbMerchants ?? []) {
        const score = calculateRelevance(osm.name, db.canonical_name, db.aliases);
        if (score > bestScore) { bestScore = score; bestMatch = db; }
      }

      if (bestMatch && bestScore >= MATCH_THRESHOLD && !claimedIds.has(bestMatch.id)) {
        claimedIds.add(bestMatch.id);
        results.push({
          id: bestMatch.id,
          canonical_name: bestMatch.canonical_name,
          primary_category: bestMatch.primary_category,
          aliases: bestMatch.aliases,
          has_rewards: true,
        });
      } else {
        results.push({
          id: `osm:${osm.name.toLowerCase().trim()}`,
          canonical_name: osm.name,
          primary_category: osm.category ?? null,
          aliases: [],
          has_rewards: false,
        });
      }
    }

    // DB-matched merchants first
    results.sort((a: any, b: any) => (b.has_rewards ? 1 : 0) - (a.has_rewards ? 1 : 0));

    return NextResponse.json({ data: results, count: results.length });
  } catch (error) {
    console.error('nearby-match error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
