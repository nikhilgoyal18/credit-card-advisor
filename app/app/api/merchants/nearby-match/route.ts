/**
 * POST /api/merchants/nearby-match
 * Accepts a list of OSM merchant names + categories and returns DB-matched
 * merchants with reward data, plus OSM-only merchants with category estimates
 * derived from the user's wallet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { calculateRelevance } from '@/lib/merchants/fuzzy';
import type { CategoryEstimate } from '@/lib/validation/schemas';

const MATCH_THRESHOLD = 100;

type Category =
  | 'GROCERY' | 'DINING' | 'TRAVEL_GENERAL' | 'TRAVEL_HOTELS' | 'TRAVEL_AIRLINES'
  | 'TRAVEL_PORTAL' | 'STREAMING' | 'ENTERTAINMENT' | 'GAS_STATIONS' | 'DRUGSTORES'
  | 'HOME_IMPROVEMENT' | 'TRANSIT' | 'DEPARTMENT_STORES' | 'WHOLESALE_CLUBS'
  | 'PHONE_WIRELESS' | 'CLOTHING_STORES' | 'SPORTS_APPAREL' | 'SHOE_STORES' | 'GENERAL';

function osmTagToCategory(tag: string | undefined): Category {
  if (!tag) return 'GENERAL';
  const t = tag.toLowerCase();
  if (['restaurant','cafe','fast_food','bar','pub','food_court','ice_cream','bakery','deli','biergarten'].includes(t)) return 'DINING';
  if (['supermarket','convenience','greengrocer','butcher','seafood','fishmonger','confectionery','alcohol','wine','beverages'].includes(t)) return 'GROCERY';
  if (['department_store','mall'].includes(t)) return 'DEPARTMENT_STORES';
  if (['clothes','clothing','fashion','boutique','jewelry','accessories','watches','bag','leather','second_hand','vintage','tailor','fabric','variety_store'].includes(t)) return 'CLOTHING_STORES';
  if (['shoes'].includes(t)) return 'SHOE_STORES';
  if (['sports','outdoor','fitness','bicycle','golf'].includes(t)) return 'SPORTS_APPAREL';
  if (['fuel'].includes(t)) return 'GAS_STATIONS';
  if (['pharmacy','chemist','herbalist'].includes(t)) return 'DRUGSTORES';
  if (['hardware','garden','flooring','paint','kitchen','bathroom','doityourself','furniture','lighting','appliance'].includes(t)) return 'HOME_IMPROVEMENT';
  if (['wholesale'].includes(t)) return 'WHOLESALE_CLUBS';
  if (['cinema','theatre','nightclub','casino','amusement_arcade','bowling_alley','escape_game'].includes(t)) return 'ENTERTAINMENT';
  if (['hotel','motel','hostel','resort'].includes(t)) return 'TRAVEL_HOTELS';
  if (['car_rental'].includes(t)) return 'TRAVEL_GENERAL';
  return 'GENERAL';
}

interface CardWithRules {
  name: string;
  base_earn_rate: number;
  reward_unit: 'cashback_percent' | 'points_multiplier';
  rules: Array<{
    categories: string[] | null;
    earn_rate: number;
    earn_type: 'cashback_percent' | 'points_multiplier';
    quarterly_rotating: boolean;
  }>;
}

function getBestCategoryEstimate(
  category: Category,
  cards: Map<string, CardWithRules>
): CategoryEstimate | null {
  if (cards.size === 0) return null;

  let best: CategoryEstimate | null = null;

  for (const [, card] of cards) {
    const categoryRules = (card.rules ?? []).filter(
      (r) => !r.quarterly_rotating &&
             Array.isArray(r.categories) &&
             r.categories.includes(category)
    );

    const rate = categoryRules.length > 0
      ? Math.max(...categoryRules.map((r) => r.earn_rate))
      : card.base_earn_rate;
    const earnType = categoryRules.length > 0
      ? categoryRules.reduce((a, b) => a.earn_rate >= b.earn_rate ? a : b).earn_type
      : card.reward_unit;

    if (!best || rate > best.best_rate) {
      best = { category, best_rate: rate, earn_type: earnType, card_name: card.name };
    }
  }

  return best;
}

const BodySchema = z.object({
  merchants: z.array(z.object({
    name: z.string(),
    category: z.string().optional(),
  })).max(2000),
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

    // Fetch DB merchants and user cards in parallel
    const [
      { data: dbMerchants, error: dbError },
      userCardMap,
    ] = await Promise.all([
      supabase.from('merchants').select('id, canonical_name, aliases, primary_category'),
      (async (): Promise<Map<string, CardWithRules>> => {
        try {
          const { data: userCardRows } = await supabase
            .from('user_cards')
            .select('card_id')
            .eq('user_id', user.id)
            .eq('disabled', false);

          const enabledIds = (userCardRows ?? []).map((r: { card_id: string }) => r.card_id);
          if (enabledIds.length === 0) return new Map();

          const [{ data: cards }, { data: rules }] = await Promise.all([
            supabase.from('cards').select('id, name, base_earn_rate, reward_unit').in('id', enabledIds),
            supabase.from('reward_rules').select('card_id, categories, earn_rate, earn_type, quarterly_rotating').in('card_id', enabledIds),
          ]);

          const map = new Map<string, CardWithRules>();
          for (const card of cards ?? []) {
            map.set(card.id, {
              name: card.name,
              base_earn_rate: card.base_earn_rate,
              reward_unit: card.reward_unit,
              rules: (rules ?? []).filter((r: { card_id: string }) => r.card_id === card.id),
            });
          }
          return map;
        } catch {
          return new Map();
        }
      })(),
    ]);

    if (dbError) {
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    const results: object[] = [];
    const claimedDbIds = new Set<string>();
    const matchedOsmNames = new Set<string>(); // track which OSM names got a DB match

    for (const osm of osmMerchants) {
      let bestMatch: (typeof dbMerchants)[0] | null = null;
      let bestScore = 0;

      for (const db of dbMerchants ?? []) {
        const score = calculateRelevance(osm.name, db.canonical_name, db.aliases);
        if (score > bestScore) { bestScore = score; bestMatch = db; }
      }

      if (bestMatch && bestScore >= MATCH_THRESHOLD && !claimedDbIds.has(bestMatch.id)) {
        claimedDbIds.add(bestMatch.id);
        matchedOsmNames.add(osm.name.toLowerCase().trim());
        results.push({
          id: bestMatch.id,
          canonical_name: bestMatch.canonical_name,
          primary_category: bestMatch.primary_category,
          aliases: bestMatch.aliases,
          has_rewards: true,
        });
      } else {
        const category = osmTagToCategory(osm.category);
        const estimate = getBestCategoryEstimate(category, userCardMap);
        results.push({
          id: `osm:${osm.name.toLowerCase().trim()}`,
          canonical_name: osm.name,
          primary_category: null,
          aliases: [],
          has_rewards: false,
          category_estimate: estimate,
        });
      }
    }

    // DB-matched merchants first, then OSM-only sorted by best estimated rate
    results.sort((a: any, b: any) => {
      if (a.has_rewards !== b.has_rewards) return a.has_rewards ? -1 : 1;
      return (b.category_estimate?.best_rate ?? 0) - (a.category_estimate?.best_rate ?? 0);
    });

    // Queue unmatched merchants for later AI classification — fire-and-forget
    const unmatchedMap = new Map<string, { osm_name: string; normalized_name: string; osm_category: string | null }>();
    for (const osm of osmMerchants) {
      const norm = osm.name.toLowerCase().trim();
      if (!matchedOsmNames.has(norm) && !unmatchedMap.has(norm)) {
        unmatchedMap.set(norm, {
          osm_name: osm.name,
          normalized_name: norm,
          osm_category: osm.category ?? null,
        });
      }
    }
    if (unmatchedMap.size > 0) {
      import('@/lib/supabase/service').then(({ createServiceClient }) => {
        void (async () => {
          try {
            const { error } = await createServiceClient()
              .rpc('upsert_discovered_merchants', { rows: [...unmatchedMap.values()] });
            if (error) console.error('[discovery-queue] RPC error:', error.message);
            else console.log(`[discovery-queue] queued ${unmatchedMap.size} merchants`);
          } catch (e) {
            console.error('[discovery-queue] failed:', e);
          }
        })();
      }).catch((e) => console.error('[discovery-queue] import failed:', e));
    }

    return NextResponse.json({ data: results, count: results.length });
  } catch (error) {
    console.error('nearby-match error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
