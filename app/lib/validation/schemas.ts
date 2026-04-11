/**
 * Validation Schemas — Reference Implementation
 *
 * This file defines Zod schemas for all request/response types.
 * Use these as the canonical source when implementing validation in the app.
 *
 * File location in app: src/lib/validation/schemas.ts
 * You will import from here during implementation.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const CategoryEnum = z.enum([
  'GROCERY',
  'DINING',
  'TRAVEL_GENERAL',
  'TRAVEL_HOTELS',
  'TRAVEL_AIRLINES',
  'TRAVEL_PORTAL',
  'STREAMING',
  'ENTERTAINMENT',
  'GAS_STATIONS',
  'DRUGSTORES',
  'HOME_IMPROVEMENT',
  'TRANSIT',
  'DEPARTMENT_STORES',
  'WHOLESALE_CLUBS',
  'GENERAL',
]);

export const IssuerEnum = z.enum(['chase', 'amex', 'capital_one']);

export const RewardUnitEnum = z.enum(['cashback_percent', 'points_multiplier']);

export const EarnTypeEnum = z.enum(['cashback_percent', 'points_multiplier']);

export const NetworkEnum = z.enum(['visa', 'mastercard', 'amex', 'discover']);

// ============================================================================
// API Request/Response Schemas
// ============================================================================

/**
 * POST /api/recommend request
 */
export const RecommendRequestSchema = z.object({
  merchant_id: z.string().min(1, 'merchant_id is required'),
});

export type RecommendRequest = z.infer<typeof RecommendRequestSchema>;

/**
 * POST /api/recommend response (single recommendation)
 */
export const RecommendationSchema = z.object({
  card_id: z.string(),
  effective_rate: z.number().min(0).max(100),
  earn_type: EarnTypeEnum,
  explanation: z.string(),
  caveats: z.array(z.string()),
  last_verified_at: z.string().datetime('ISO 8601 timestamp required'),
  recommendation_type: z.literal('best_likely_card'),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

/**
 * POST /api/recommend response (full)
 */
export const RecommendResponseSchema = z.object({
  data: z.array(RecommendationSchema),
  merchant: z.object({
    id: z.string(),
    canonical_name: z.string(),
    primary_category: CategoryEnum,
  }),
  disclaimer: z.string(),
});

export type RecommendResponse = z.infer<typeof RecommendResponseSchema>;

/**
 * GET /api/merchants/search query parameters
 */
export const MerchantSearchQuerySchema = z.object({
  q: z.string().min(1, 'q parameter is required'),
  limit: z.coerce.number().int().min(1).max(50).default(10).optional(),
});

export type MerchantSearchQuery = z.infer<typeof MerchantSearchQuerySchema>;

/**
 * GET /api/merchants/search response (single merchant in results)
 */
export const MerchantResultSchema = z.object({
  id: z.string(),
  canonical_name: z.string(),
  primary_category: CategoryEnum,
  aliases: z.array(z.string()),
});

export type MerchantResult = z.infer<typeof MerchantResultSchema>;

/**
 * GET /api/merchants/search response (full)
 */
export const MerchantSearchResponseSchema = z.object({
  data: z.array(MerchantResultSchema),
  query: z.string(),
  count: z.number().int().min(0),
});

export type MerchantSearchResponse = z.infer<typeof MerchantSearchResponseSchema>;

// ============================================================================
// Database Schemas
// ============================================================================

/**
 * Card product (from cards table)
 */
export const CardSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/, 'ID must be lowercase letters, numbers, underscores'),
  issuer_id: IssuerEnum,
  name: z.string().min(1),
  network: NetworkEnum,
  reward_unit: RewardUnitEnum,
  reward_currency: z.string().optional(),
  base_earn_rate: z.number().min(0).max(100),
});

export type Card = z.infer<typeof CardSchema>;

/**
 * Reward rule
 */
export const RewardRuleSchema = z.object({
  rule_id: z.string().regex(/^[a-z0-9_]+$/),
  categories: z.array(CategoryEnum).optional(),
  earn_rate: z.number().min(0).max(100),
  earn_type: EarnTypeEnum,
  merchant_specific: z.array(z.string()).optional(),
  quarterly_rotating: z.boolean().optional().default(false),
  quarterly_config: z
    .object({
      activation_required: z.boolean().optional(),
      current_quarter_categories: z.array(CategoryEnum).optional(),
      current_quarter_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      current_quarter_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
    .optional(),
  excluded_merchants: z.array(z.string()).optional(),
  excluded_categories: z.array(CategoryEnum).optional(),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  valid_until: z.string().datetime().optional(),
  source_url: z.string().url().optional(),
  source_last_verified: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export type RewardRule = z.infer<typeof RewardRuleSchema>;

/**
 * Merchant (from merchants table)
 */
export const MerchantSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  canonical_name: z.string().min(1),
  aliases: z.array(z.string()),
  primary_category: CategoryEnum,
  secondary_categories: z.array(CategoryEnum).optional().default([]),
  mcc_codes: z.array(z.string()).optional(),
  is_online_only: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

export type Merchant = z.infer<typeof MerchantSchema>;

/**
 * User card (from user_cards table)
 */
export const UserCardSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  card_id: z.string(),
  nickname: z.string().optional(),
  disabled: z.boolean().default(false),
  display_order: z.number().int().min(0),
  created_at: z.string().datetime(),
});

export type UserCard = z.infer<typeof UserCardSchema>;

// ============================================================================
// Error Response Schema
// ============================================================================

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.record(z.any()).optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
