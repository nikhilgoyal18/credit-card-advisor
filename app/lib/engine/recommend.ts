/**
 * Recommendation Engine
 * Core business logic: scores cards and returns ranked recommendations
 * Implements exact logic from data/specs/scoring-algorithm.md
 */

import { createClient } from '@/lib/supabase/server';

export interface Card {
  id: string;
  issuer_id: string;
  name: string;
  network: string;
  reward_unit: 'cashback_percent' | 'points_multiplier';
  reward_currency?: string;
  base_earn_rate: number;
}

export interface RewardRule {
  id: string;
  card_id: string;
  rule_id: string;
  categories: string[];
  earn_rate: number;
  earn_type: 'cashback_percent' | 'points_multiplier';
  merchant_specific: string[];
  quarterly_rotating: boolean;
  quarterly_config?: {
    activation_required?: boolean;
    current_quarter_categories?: string[];
    current_quarter_start?: string;
    current_quarter_end?: string;
  };
  excluded_merchants: string[];
  excluded_categories: string[];
  valid_from?: string;
  valid_until?: string;
  source_url?: string;
  source_last_verified?: string;
  notes?: string;
  spend_limit_amount?: number;
  spend_limit_reset_period?: string;
}

export interface Merchant {
  id: string;
  canonical_name: string;
  aliases: string[];
  primary_category: string;
  secondary_categories: string[];
}

export interface UserCard {
  id: string;
  user_id: string;
  card_id: string;
  disabled: boolean;
  display_order: number;
  created_at: string;
}

export interface RankedRecommendation {
  card_id: string;
  effective_rate: number;
  earn_type: 'cashback_percent' | 'points_multiplier';
  explanation: string;
  caveats: string[];
}

/**
 * Score a single card for a merchant
 */
function scoreCard(
  card: Card,
  merchant: Merchant,
  rules: RewardRule[],
  asOf: Date
): { rate: number; earnType: 'cashback_percent' | 'points_multiplier'; explanation: string; caveats: string[] } | null {
  // Resolve categories
  const resolvedCategories = [merchant.primary_category, ...merchant.secondary_categories];

  // Find best matching rule
  let bestRule: RewardRule | null = null;
  let rateSource: 'merchant_specific' | 'category' | 'base' = 'base';

  // 1. Check merchant-specific rules
  const merchantSpecificRules = rules.filter((r) =>
    r.merchant_specific.includes(merchant.id)
  );
  if (merchantSpecificRules.length > 0) {
    bestRule = merchantSpecificRules.reduce((best, rule) =>
      rule.earn_rate > best.earn_rate ? rule : best
    );
    rateSource = 'merchant_specific';
  }

  // 2. Check category rules
  if (!bestRule) {
    const categoryRules = rules.filter((r) =>
      r.categories.some((cat) => resolvedCategories.includes(cat))
    );
    if (categoryRules.length > 0) {
      bestRule = categoryRules.reduce((best, rule) =>
        rule.earn_rate > best.earn_rate ? rule : best
      );
      rateSource = 'category';
    }
  }

  let effectiveRate = bestRule ? bestRule.earn_rate : card.base_earn_rate;
  let earnType = bestRule ? bestRule.earn_type : card.reward_unit;
  const caveats: string[] = [];

  // Check time-bound rules
  if (bestRule) {
    if (bestRule.valid_from) {
      const validFrom = new Date(bestRule.valid_from);
      if (asOf < validFrom) {
        effectiveRate = card.base_earn_rate;
        earnType = card.reward_unit;
        bestRule = null;
      }
    }

    if (bestRule && bestRule.valid_until) {
      const validUntil = new Date(bestRule.valid_until);
      if (asOf > validUntil) {
        effectiveRate = card.base_earn_rate;
        earnType = card.reward_unit;
        bestRule = null;
      }
    }
  }

  // Check quarterly rotating rules
  if (bestRule && bestRule.quarterly_rotating) {
    if (bestRule.quarterly_config) {
      const { current_quarter_start, current_quarter_end, current_quarter_categories } =
        bestRule.quarterly_config;
      const isActive =
        current_quarter_start &&
        current_quarter_end &&
        asOf >= new Date(current_quarter_start) &&
        asOf <= new Date(current_quarter_end);

      if (isActive && current_quarter_categories) {
        // Check if this quarter includes any of the merchant's categories
        const quarterHasCategory = current_quarter_categories.some((cat) =>
          resolvedCategories.includes(cat)
        );
        if (quarterHasCategory) {
          caveats.push('Requires quarterly activation');
        } else {
          effectiveRate = card.base_earn_rate;
          earnType = card.reward_unit;
        }
      } else {
        effectiveRate = card.base_earn_rate;
        earnType = card.reward_unit;
      }
    }
  }

  // Build explanation
  let explanation = `${card.name} earns ${effectiveRate}${earnType === 'cashback_percent' ? '%' : 'x'} on ${merchant.canonical_name}.`;

  if (!bestRule) {
    // Fallback to base rate explanation
    const categoryName =
      resolvedCategories.length > 0
        ? resolvedCategories[0].replace(/_/g, ' ').toLowerCase()
        : 'all purchases';
    explanation = `${card.name} earns ${card.base_earn_rate}${card.reward_unit === 'cashback_percent' ? '%' : 'x'} on ${categoryName}.`;
  } else if (rateSource === 'category') {
    // Category rule explanation
    const categoryName =
      bestRule.categories[0]?.replace(/_/g, ' ').toLowerCase() || 'all purchases';
    explanation = `${card.name} earns ${effectiveRate}${earnType === 'cashback_percent' ? '%' : 'x'} on ${categoryName}.`;
  }

  // Add spend limit caveat if applicable
  if (bestRule?.spend_limit_amount) {
    const period = bestRule.spend_limit_reset_period || 'year';
    caveats.unshift(
      `${effectiveRate}${earnType === 'cashback_percent' ? '%' : 'x'} applies up to $${bestRule.spend_limit_amount.toLocaleString()}/${period}, then base rate`
    );
  }

  // Convert points to cash equivalent using known point valuations
  const POINT_VALUATIONS: Record<string, number> = {
    'Ultimate Rewards': 1.8,   // Chase UR ~1.8¢/pt (conservative transfer value)
    'Membership Rewards': 1.7, // Amex MR ~1.7¢/pt
    'Miles': 1.7,              // Capital One Miles ~1.7¢/pt
    'cashback': 1.0,
  };
  const pointValue = POINT_VALUATIONS[card.reward_currency ?? ''] ?? 1.0;
  const cashEquivalent = earnType === 'cashback_percent' ? effectiveRate : effectiveRate * pointValue;

  return {
    rate: cashEquivalent,
    earnType,
    explanation,
    caveats,
  };
}

/**
 * Get ranked recommendations for a merchant
 * Core entry point
 */
export async function getRecommendations(
  merchantId: string,
  userCardIds: string[],
  asOf: Date = new Date()
): Promise<RankedRecommendation[]> {
  const supabase = await createClient();

  // Fetch merchant
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('*')
    .eq('id', merchantId)
    .single();

  if (merchantError || !merchant) {
    throw new Error(`Merchant not found: ${merchantId}`);
  }

  // Fetch user cards
  const { data: userCards, error: userCardsError } = await supabase
    .from('user_cards')
    .select('*')
    .in('card_id', userCardIds)
    .order('created_at', { ascending: true });

  if (userCardsError) throw userCardsError;

  // Filter out disabled cards
  const enabledCardIds = (userCards || [])
    .filter((uc) => !uc.disabled)
    .map((uc) => uc.card_id);

  if (enabledCardIds.length === 0) {
    return [];
  }

  // Fetch all cards
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('*')
    .in('id', enabledCardIds);

  if (cardsError) throw cardsError;

  // Fetch all reward rules for these cards
  const { data: rules, error: rulesError } = await supabase
    .from('reward_rules')
    .select('*')
    .in('card_id', enabledCardIds);

  if (rulesError) throw rulesError;

  // Score each card
  const scores: (RankedRecommendation & { cardIndex: number })[] = [];

  for (const card of cards || []) {
    const cardRules = (rules || []).filter((r) => r.card_id === card.id);
    const cardIndex = (userCards || []).findIndex((uc) => uc.card_id === card.id);

    const scoreResult = scoreCard(card, merchant, cardRules, asOf);
    if (scoreResult) {
      scores.push({
        card_id: card.id,
        effective_rate: scoreResult.rate,
        earn_type: scoreResult.earnType,
        explanation: scoreResult.explanation,
        caveats: scoreResult.caveats,
        cardIndex,
      });
    }
  }

  // Sort by rate (descending), then by card index (ascending for tiebreaker)
  scores.sort((a, b) => {
    if (b.effective_rate !== a.effective_rate) {
      return b.effective_rate - a.effective_rate;
    }
    return a.cardIndex - b.cardIndex;
  });

  // Remove cardIndex before returning
  return scores.map(({ cardIndex, ...rest }) => rest);
}
