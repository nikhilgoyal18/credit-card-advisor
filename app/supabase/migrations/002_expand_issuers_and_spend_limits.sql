-- Migration 002: Expand issuers, add spend limit fields, add PHONE_WIRELESS category

-- ============================================================================
-- ADD NEW ISSUER ENUM VALUES
-- ============================================================================

ALTER TYPE public.issuer_enum ADD VALUE IF NOT EXISTS 'bank_of_america';
ALTER TYPE public.issuer_enum ADD VALUE IF NOT EXISTS 'wells_fargo';

-- ============================================================================
-- SEED NEW ISSUERS
-- ============================================================================

INSERT INTO public.issuers (id, name) VALUES
  ('bank_of_america', 'Bank of America'),
  ('wells_fargo', 'Wells Fargo')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ADD SPEND LIMIT FIELDS TO REWARD_RULES
-- For cards like Amex Blue Cash Preferred (6% grocery up to $6k/year)
-- ============================================================================

ALTER TABLE public.reward_rules
  ADD COLUMN IF NOT EXISTS spend_limit_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS spend_limit_reset_period TEXT
    CHECK (spend_limit_reset_period IN ('year', 'quarter', 'month'));

-- ============================================================================
-- ADD PHONE_WIRELESS CATEGORY
-- Required for Wells Fargo Autograph (3x on phone plans)
-- ============================================================================

ALTER TYPE public.category_enum ADD VALUE IF NOT EXISTS 'PHONE_WIRELESS';
