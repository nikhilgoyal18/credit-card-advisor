-- Credit Card Advisor - Phase 1 Initial Schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.category_enum AS ENUM (
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
  'GENERAL'
);

CREATE TYPE public.issuer_enum AS ENUM ('chase', 'amex', 'capital_one');

CREATE TYPE public.reward_unit_enum AS ENUM ('cashback_percent', 'points_multiplier');

CREATE TYPE public.earn_type_enum AS ENUM ('cashback_percent', 'points_multiplier');

-- ============================================================================
-- ISSUERS TABLE
-- ============================================================================

CREATE TABLE public.issuers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- CARDS TABLE
-- ============================================================================

CREATE TABLE public.cards (
  id TEXT PRIMARY KEY,
  issuer_id issuer_enum NOT NULL,
  name TEXT NOT NULL,
  network TEXT NOT NULL,
  reward_unit reward_unit_enum NOT NULL,
  reward_currency TEXT,
  base_earn_rate NUMERIC(5, 2) NOT NULL CHECK (base_earn_rate >= 0 AND base_earn_rate <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_cards_issuer ON public.cards(issuer_id);

-- ============================================================================
-- MERCHANTS TABLE
-- ============================================================================

CREATE TABLE public.merchants (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  primary_category category_enum NOT NULL,
  secondary_categories category_enum[] NOT NULL DEFAULT '{}',
  mcc_codes TEXT[] NOT NULL DEFAULT '{}',
  is_online_only BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_merchants_primary_category ON public.merchants(primary_category);

-- ============================================================================
-- MERCHANT ALIASES TABLE
-- ============================================================================

CREATE TABLE public.merchant_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  alias_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_merchant_aliases_merchant_id ON public.merchant_aliases(merchant_id);
CREATE INDEX idx_merchant_aliases_alias_name ON public.merchant_aliases(alias_name);

-- ============================================================================
-- MERCHANT CATEGORY MAP TABLE
-- ============================================================================

CREATE TABLE public.merchant_category_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  category category_enum NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_merchant_category_map_merchant ON public.merchant_category_map(merchant_id);
CREATE INDEX idx_merchant_category_map_category ON public.merchant_category_map(category);

-- ============================================================================
-- REWARD RULES TABLE
-- ============================================================================

CREATE TABLE public.reward_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id TEXT NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  categories category_enum[] NOT NULL DEFAULT '{}',
  earn_rate NUMERIC(5, 2) NOT NULL CHECK (earn_rate >= 0 AND earn_rate <= 100),
  earn_type earn_type_enum NOT NULL,
  merchant_specific TEXT[] NOT NULL DEFAULT '{}',
  quarterly_rotating BOOLEAN NOT NULL DEFAULT false,
  quarterly_config JSONB,
  excluded_merchants TEXT[] NOT NULL DEFAULT '{}',
  excluded_categories category_enum[] NOT NULL DEFAULT '{}',
  valid_from DATE,
  valid_until TIMESTAMP WITH TIME ZONE,
  source_url TEXT,
  source_last_verified TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX idx_reward_rules_card_rule ON public.reward_rules(card_id, rule_id);
CREATE INDEX idx_reward_rules_card ON public.reward_rules(card_id);
CREATE INDEX idx_reward_rules_quarterly ON public.reward_rules(quarterly_rotating);

-- ============================================================================
-- USER CARDS TABLE (Wallet)
-- ============================================================================

CREATE TABLE public.user_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  card_id TEXT NOT NULL REFERENCES public.cards(id) ON DELETE RESTRICT,
  nickname TEXT,
  disabled BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_user_cards_user_id ON public.user_cards(user_id);
CREATE INDEX idx_user_cards_card_id ON public.user_cards(card_id);
CREATE UNIQUE INDEX idx_user_cards_user_card ON public.user_cards(user_id, card_id);

-- ============================================================================
-- RECOMMENDATIONS TABLE (Event Log)
-- ============================================================================

CREATE TABLE public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  merchant_id TEXT NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  recommended_card_id TEXT NOT NULL REFERENCES public.cards(id) ON DELETE RESTRICT,
  effective_rate NUMERIC(5, 2) NOT NULL,
  earn_type earn_type_enum NOT NULL,
  explanation TEXT NOT NULL,
  caveats TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_recommendations_user_id ON public.recommendations(user_id);
CREATE INDEX idx_recommendations_merchant_id ON public.recommendations(merchant_id);
CREATE INDEX idx_recommendations_created_at ON public.recommendations(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_category_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issuers ENABLE ROW LEVEL SECURITY;

-- Cards: read-only for authenticated users
CREATE POLICY "cards_read_authenticated" ON public.cards
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Merchants: read-only for authenticated users
CREATE POLICY "merchants_read_authenticated" ON public.merchants
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Merchant aliases: read-only for authenticated users
CREATE POLICY "merchant_aliases_read_authenticated" ON public.merchant_aliases
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Merchant category map: read-only for authenticated users
CREATE POLICY "merchant_category_map_read_authenticated" ON public.merchant_category_map
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Reward rules: read-only for authenticated users
CREATE POLICY "reward_rules_read_authenticated" ON public.reward_rules
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Issuers: read-only for authenticated users
CREATE POLICY "issuers_read_authenticated" ON public.issuers
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- User cards: authenticated users CRUD their own
CREATE POLICY "user_cards_own_read" ON public.user_cards
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_cards_own_insert" ON public.user_cards
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_cards_own_update" ON public.user_cards
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_cards_own_delete" ON public.user_cards
  FOR DELETE
  USING (auth.uid() = user_id);

-- Recommendations: authenticated users insert + read their own
CREATE POLICY "recommendations_own_read" ON public.recommendations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "recommendations_own_insert" ON public.recommendations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert issuers
INSERT INTO public.issuers (id, name) VALUES
  ('chase', 'Chase'),
  ('amex', 'American Express'),
  ('capital_one', 'Capital One')
ON CONFLICT (id) DO NOTHING;
