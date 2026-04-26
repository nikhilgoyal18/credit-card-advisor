/**
 * GET /api/merchants/nearby
 * Detects nearby merchants using OpenStreetMap Overpass API and fuzzy-matches
 * them against the merchant database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { NearbyMerchantsQuerySchema, CategoryEnum, type NearbyMerchantResult, type CategoryEstimate } from '@/lib/validation/schemas';

type Category = z.infer<typeof CategoryEnum>;
import { calculateRelevance } from '@/lib/merchants/fuzzy';

// Minimum relevance score to count as a match.
const MATCH_THRESHOLD = 100;

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  center?: { lat: number; lon: number };
  lat?: number;
  lon?: number;
}

interface OverpassResponse {
  elements: OverpassElement[];
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

/**
 * Maps OSM tags to our internal CategoryEnum values.
 * Returns null only if no recognizable commercial category can be inferred.
 */
function mapOsmTagsToCategory(tags: Record<string, string>): Category {
  const amenity = tags['amenity'];
  const shop    = tags['shop'];
  const tourism = tags['tourism'];
  const leisure = tags['leisure'];

  if (amenity) {
    if (['restaurant','cafe','fast_food','bar','pub','food_court','ice_cream','bakery','deli','biergarten'].includes(amenity))
      return 'DINING';
    if (amenity === 'fuel')
      return 'GAS_STATIONS';
    if (['pharmacy'].includes(amenity))
      return 'DRUGSTORES';
    if (['supermarket','convenience'].includes(amenity))
      return 'GROCERY';
    if (['hotel'].includes(amenity))
      return 'TRAVEL_HOTELS';
    if (['car_rental'].includes(amenity))
      return 'TRAVEL_GENERAL';
    if (['cinema','theatre','nightclub','casino','amusement_arcade','gym','fitness_centre'].includes(amenity))
      return 'ENTERTAINMENT';
  }

  if (shop) {
    if (['supermarket','convenience','greengrocer','butcher','bakery','deli','seafood','fishmonger','confectionery','chocolate','tea','coffee'].includes(shop))
      return 'GROCERY';
    if (['pharmacy','chemist','herbalist'].includes(shop))
      return 'DRUGSTORES';
    if (['clothes','clothing','fashion','boutique','shoes','jewelry','accessories','watches','bag',
         'leather','second_hand','vintage','tailor','fabric','department_store','mall','variety_store'].includes(shop))
      return 'DEPARTMENT_STORES';
    if (['hardware','garden','flooring','paint','kitchen','bathroom','lighting','appliance',
         'furniture','interior_decoration','doityourself'].includes(shop))
      return 'HOME_IMPROVEMENT';
    if (['wholesale'].includes(shop))
      return 'WHOLESALE_CLUBS';
    if (['alcohol','wine','beverages'].includes(shop))
      return 'DINING';
  }

  if (tourism && ['hotel','motel','hostel','resort'].includes(tourism))
    return 'TRAVEL_HOTELS';
  if (leisure && ['bowling_alley','golf_course','miniature_golf','escape_game','trampoline_park','sports_centre','swimming_pool','water_park','ice_rink'].includes(leisure))
    return 'ENTERTAINMENT';

  return 'GENERAL';
}

/**
 * Returns the best reward estimate for a given category across the user's cards.
 */
function getBestCategoryEstimate(
  category: (Category),
  cards: Map<string, CardWithRules>
): CategoryEstimate | null {
  if (cards.size === 0) return null;

  let best: CategoryEstimate | null = null;

  for (const [, card] of cards) {
    // Exclude quarterly-rotating rules — those are retailer-specific deals
    // (e.g. Freedom Flex 5% at Amazon/Walmart), not blanket category rates.
    // An unknown OSM merchant won't qualify for them.
    const categoryRules = (card.rules ?? []).filter(
      (r) => !r.quarterly_rotating &&
             Array.isArray(r.categories) &&
             r.categories.includes(category)
    );

    const rate    = categoryRules.length > 0
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
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

    // Validate query params
    const { searchParams } = new URL(request.url);
    const validationResult = NearbyMerchantsQuerySchema.safeParse({
      lat: searchParams.get('lat'),
      lng: searchParams.get('lng'),
      radius: searchParams.get('radius') ?? undefined,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid parameters',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { lat, lng, radius } = validationResult.data;

    // Fetch the user's enabled cards + reward rules so we can compute category
    // estimates for OSM-only merchants. Runs in parallel with Overpass below.
    const userCardMapPromise: Promise<Map<string, CardWithRules>> = (async () => {
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
        return new Map(); // non-fatal — estimates just won't show
      }
    })();

    // Timeout: keep well under public Overpass's hard cap (~180s) but short enough
    // that the user isn't waiting forever. Bounding-box queries are much faster
    // than `around`, so these values are generous.
    const overpassTimeoutSec =
      radius <= 500   ? 8  :
      radius <= 2000  ? 12 :
      radius <= 10000 ? 20 : 25;
    const fetchTimeoutMs = (overpassTimeoutSec + 5) * 1000; // AbortController gets 5s extra grace

    const resultCap =
      radius <= 500   ? 400  :
      radius <= 2000  ? 800  :
      radius <= 10000 ? 2000 : 5000;

    // Convert radius → bounding box. Overpass [bbox:...] is orders of magnitude
    // faster than `around:` for large radii because Overpass can use its spatial
    // index directly instead of computing distances for every node.
    const latDelta = radius / 111_320;
    const lngDelta = radius / (111_320 * Math.cos((lat * Math.PI) / 180));
    const bbox = `${lat - latDelta},${lng - lngDelta},${lat + latDelta},${lng + lngDelta}`;

    // Use bare tag-existence queries — no regex, guaranteed valid Overpass QL.
    // Long regex alternations in Overpass cause HTTP 400 on some instances.
    // Non-commercial noise (benches, parking, streetlights) is filtered in JS below.
    const overpassQuery = `
[out:json][timeout:${overpassTimeoutSec}][bbox:${bbox}];
(
  node["shop"];
  node["amenity"];
  node["brand"];
  way["shop"];
  way["amenity"];
  way["brand"];
  node["tourism"="hotel"];
  node["tourism"="motel"];
  node["tourism"="hostel"];
  node["leisure"="bowling_alley"];
  node["leisure"="cinema"];
  node["leisure"="escape_game"];
  node["leisure"="golf_course"];
  node["leisure"="sports_centre"];
  node["leisure"="swimming_pool"];
  node["leisure"="water_park"];
  node["leisure"="ice_rink"];
);
out center tags ${resultCap};
    `.trim();

  // Amenity values that are not retail/commercial establishments.
  // Everything NOT in this set is kept — errs on the side of inclusion.
  const NON_COMMERCIAL_AMENITY = new Set([
    'parking','parking_space','parking_entrance','parking_exit',
    'bicycle_parking','motorcycle_parking','car_pooling',
    'bench','waste_basket','waste_disposal','recycling','recycling_centre',
    'toilets','drinking_water','shower','water_point','fountain','watering_place',
    'street_lamp','post_box','vending_machine','shelter','telephone','emergency_phone',
    'bus_station','bus_stop','taxi','car_sharing','ferry_terminal','bicycle_rental',
    'place_of_worship','school','college','university','kindergarten','library',
    'prep_school','language_school','music_school','driving_school',
    'community_centre','social_facility','social_centre','village_hall','town_hall',
    'public_bath','public_building',
    'police','fire_station','courthouse','embassy','prison','ranger_station',
    'customs','border_control',
    'hospital','clinic','nursing_home','childcare','baby_hatch',
    'charging_station','compressed_air','sanitary_dump_station',
    'arts_centre','conference_centre','events_venue','exhibition_centre',
    'grave_yard','crematorium','mortuary',
  ]);

    let overpassData: OverpassResponse | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), fetchTimeoutMs);

      const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!overpassRes.ok) {
        const body = await overpassRes.text().catch(() => '');
        console.error(`Overpass HTTP ${overpassRes.status} (radius=${radius}m):`, body.slice(0, 500));
        return NextResponse.json({ data: [], count: 0, timed_out: false });
      }

      {
        // Guard against huge payloads — content-length is absent on chunked
        // responses, so stream and accumulate bytes before parsing.
        const reader = overpassRes.body?.getReader();
        if (!reader) {
          console.warn('Overpass: no response body reader');
          return NextResponse.json({ data: [], count: 0, timed_out: false });
        }

        const MAX_BYTES =
          radius <= 500   ? 1_500_000  :
          radius <= 2000  ? 3_000_000  :
          radius <= 10000 ? 6_000_000  : 10_000_000;
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;
        let tooLarge = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          totalBytes += value.byteLength;
          if (totalBytes > MAX_BYTES) {
            tooLarge = true;
            reader.cancel();
            break;
          }
          chunks.push(value);
        }

        if (tooLarge) {
          console.warn(`Overpass response exceeded ${MAX_BYTES} bytes, skipping parse`);
          return NextResponse.json({ data: [], count: 0, timed_out: true });
        }

        const combined = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.byteLength;
        }
        overpassData = JSON.parse(new TextDecoder().decode(combined));
      }
    } catch (err) {
      // Timeout or network error — degrade gracefully
      const timedOut = err instanceof Error && err.name === 'AbortError';
      console.warn(`Overpass API ${timedOut ? 'timed out' : 'unavailable'} (radius=${radius}m, timeout=${overpassTimeoutSec}s):`, err);
      return NextResponse.json({ data: [], count: 0, timed_out: timedOut });
    }

    if (!overpassData?.elements?.length) {
      console.log(`[nearby] radius=${radius}m → 0 Overpass elements`);
      return NextResponse.json({ data: [], count: 0 });
    }

    console.log(`[nearby] radius=${radius}m → ${overpassData.elements.length} Overpass elements (cap=${resultCap})`);

    // Fetch our merchant catalogue (capped to prevent unbounded queries)
    const MERCHANT_CAP = 1000;
    const { data: merchants, error: merchantsError } = await supabase
      .from('merchants')
      .select('id, canonical_name, aliases, primary_category')
      .limit(MERCHANT_CAP);

    if (merchantsError) {
      console.error('Nearby merchants DB error:', merchantsError);
      return NextResponse.json(
        { error: 'Database error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }

    if (!merchants?.length) {
      return NextResponse.json({ data: [], count: 0 });
    }

    if (merchants.length === MERCHANT_CAP) {
      console.warn(`Nearby merchants: hit .limit(${MERCHANT_CAP}) cap — catalogue may be truncated. Consider switching to full-text search.`);
    }

    // Await the card map (it was fetching in parallel with Overpass)
    const userCardMap = await userCardMapPromise;

    // Step 1: Deduplicate OSM elements by display name, preserving tags for
    // category inference. Skip non-commercial amenity types (benches, parking, etc.)
    const uniqueOsmNames = new Map<string, { display: string; tags: Record<string, string> }>();
    for (const element of overpassData.elements) {
      if (!element.tags) continue;

      // Skip infrastructure / public-service amenities that aren't spendable
      const amenityVal = element.tags['amenity'];
      if (amenityVal && NON_COMMERCIAL_AMENITY.has(amenityVal)) continue;

      // Skip vacant/placeholder shops
      const shopVal = element.tags['shop'];
      if (shopVal === 'vacant' || shopVal === 'no') continue;

      const display =
        element.tags['brand'] ?? element.tags['name'] ?? element.tags['operator'];
      if (!display) continue;
      const normalized = display.toLowerCase().trim();
      if (!uniqueOsmNames.has(normalized)) {
        uniqueOsmNames.set(normalized, { display, tags: element.tags });
      }
    }

    console.log(`[nearby] ${uniqueOsmNames.size} unique OSM names after dedup`);

    // Step 2: For each unique OSM name, find the best-scoring DB merchant.
    // OSM-only merchants get a category estimate from the user's reward rules.
    type ScoredResult = NearbyMerchantResult & { _score: number };
    const results: ScoredResult[] = [];
    const claimedMerchantIds = new Set<string>();

    for (const [, { display: displayName, tags }] of uniqueOsmNames) {
      let bestMerchant: (typeof merchants)[0] | null = null;
      let bestScore = 0;

      for (const merchant of merchants) {
        const score = calculateRelevance(displayName, merchant.canonical_name, merchant.aliases);
        if (score > bestScore) {
          bestScore = score;
          bestMerchant = merchant;
        }
      }

      if (bestMerchant && bestScore >= MATCH_THRESHOLD && !claimedMerchantIds.has(bestMerchant.id)) {
        claimedMerchantIds.add(bestMerchant.id);
        results.push({
          id: bestMerchant.id,
          canonical_name: bestMerchant.canonical_name,
          primary_category: bestMerchant.primary_category,
          aliases: bestMerchant.aliases,
          has_rewards: true,
          _score: bestScore,
        });
      } else if (!bestMerchant || bestScore < MATCH_THRESHOLD) {
        // OSM-only merchant — infer category from OSM tags and estimate reward rate.
        const inferredCategory = mapOsmTagsToCategory(tags);
        const estimate = getBestCategoryEstimate(inferredCategory, userCardMap);
        results.push({
          id: `osm:${displayName.toLowerCase().trim()}`,
          canonical_name: displayName,
          primary_category: null,
          aliases: [],
          has_rewards: false,
          category_estimate: estimate,
          _score: 0,
        });
      }
    }

    // Step 3: Sort — reward-matched merchants first (by score desc), then
    // OSM-only merchants alphabetically. Scale result cap with radius so larger
    // searches return a proportionally richer list.
    results.sort((a, b) => {
      if (a.has_rewards !== b.has_rewards) return a.has_rewards ? -1 : 1;
      if (a._score !== b._score) return b._score - a._score;
      return a.canonical_name.localeCompare(b.canonical_name);
    });

    const displayCap =
      radius <= 500   ? 15 :
      radius <= 2000  ? 25 :
      radius <= 10000 ? 40 : 80;

    const top = results.slice(0, displayCap);
    const matched = top.map(({ _score: _s, ...rest }) => rest);

    console.log(`[nearby] returning ${matched.length}/${results.length} merchants (${top.filter(r => r.has_rewards).length} with rewards, cap=${displayCap}):`,
      top.map(r => `${r.canonical_name}(${r.has_rewards ? r._score : 'osm'})`).join(', ') || 'none');

    return NextResponse.json({ data: matched, count: matched.length });
  } catch (error) {
    console.error('Nearby merchants error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
