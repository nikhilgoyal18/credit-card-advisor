-- Seed cards
INSERT INTO public.cards (id, issuer_id, name, network, reward_unit, reward_currency, base_earn_rate) VALUES
  ('chase_freedom_flex', 'chase', 'Chase Freedom Flex', 'visa', 'cashback_percent', 'cashback', 1.0),
  ('chase_sapphire_preferred', 'chase', 'Chase Sapphire Preferred', 'visa', 'points_multiplier', 'Ultimate Rewards', 1.0),
  ('amex_gold', 'amex', 'American Express Gold Card', 'amex', 'points_multiplier', 'Membership Rewards', 1.0),
  ('amex_platinum', 'amex', 'American Express Platinum Card', 'amex', 'points_multiplier', 'Membership Rewards', 1.0),
  ('capital_one_savor', 'capital_one', 'Capital One Savor Cash Rewards Visa Signature', 'visa', 'cashback_percent', 'cashback', 1.0),
  ('capital_one_venture_x', 'capital_one', 'Capital One Venture X Business Travel Card', 'visa', 'points_multiplier', 'Miles', 2.0)
ON CONFLICT (id) DO NOTHING;

-- Seed merchants (sample - full seed would come from JSON)
INSERT INTO public.merchants (id, canonical_name, aliases, primary_category, secondary_categories, mcc_codes, is_online_only) VALUES
  ('whole_foods_market', 'Whole Foods Market', ARRAY['Whole Foods', 'WFM', 'WHOLEFDS', 'Whole Foods Market Inc'], 'GROCERY'::category_enum, ARRAY[]::category_enum[], ARRAY['5411'], false),
  ('kroger', 'Kroger', ARRAY['Kroger Co', 'Ralphs', 'Fred Meyer', 'QFC', 'Smith''s', 'Fry''s', 'King Soopers', 'Mariano''s', 'Dillons', 'Gerbes', 'KROGR'], 'GROCERY'::category_enum, ARRAY[]::category_enum[], ARRAY['5411'], false),
  ('trader_joes', 'Trader Joe''s', ARRAY['Trader Joes', 'TJ''s', 'TRADERJOES'], 'GROCERY'::category_enum, ARRAY[]::category_enum[], ARRAY['5411'], false),
  ('aldi', 'Aldi', ARRAY['Aldi Süd', 'Aldi Nord', 'ALDI US'], 'GROCERY'::category_enum, ARRAY[]::category_enum[], ARRAY['5411'], false),
  ('costco', 'Costco', ARRAY['Costco Warehouse', 'Costco.com', 'COSTCO'], 'WHOLESALE_CLUBS'::category_enum, ARRAY[]::category_enum[], ARRAY['5411', '5942'], false),
  ('sams_club', 'Sam''s Club', ARRAY['Sams Club', 'Sam''s Warehouse Club', 'SAMSCLUB'], 'WHOLESALE_CLUBS'::category_enum, ARRAY[]::category_enum[], ARRAY['5411', '5942'], false),
  ('target', 'Target', ARRAY['Target Corp', 'Target Stores', 'Target.com', 'TARGET'], 'GROCERY'::category_enum, ARRAY['GENERAL'::category_enum], ARRAY['5411', '5399'], false),
  ('walmart', 'Walmart', ARRAY['Walmart Inc', 'Walmart Stores', 'Walmart.com', 'WALMART', 'Walmart Supercenter'], 'GROCERY'::category_enum, ARRAY['GENERAL'::category_enum], ARRAY['5411', '5399'], false),
  ('starbucks', 'Starbucks', ARRAY['Starbucks Coffee', 'STARBKS', 'Starbucks Corp'], 'DINING'::category_enum, ARRAY[]::category_enum[], ARRAY['5814'], false),
  ('mcdonalds', 'McDonald''s', ARRAY['McDonalds', 'McDonald''s Corporation', 'MCDONLDS'], 'DINING'::category_enum, ARRAY[]::category_enum[], ARRAY['5814'], false)
ON CONFLICT (id) DO NOTHING;

-- Seed reward rules for cards
-- Chase Freedom Flex
INSERT INTO public.reward_rules (card_id, rule_id, categories, earn_rate, earn_type, quarterly_rotating, quarterly_config, source_last_verified) VALUES
  ('chase_freedom_flex', 'quarterly_5x', ARRAY['GROCERY'::category_enum, 'DINING'::category_enum, 'TRAVEL_GENERAL'::category_enum, 'STREAMING'::category_enum, 'ENTERTAINMENT'::category_enum], 5.0, 'cashback_percent'::earn_type_enum, true, 
   jsonb_build_object(
     'activation_required', true,
     'current_quarter_categories', jsonb_build_array('GROCERY', 'DINING'),
     'current_quarter_start', '2026-01-01',
     'current_quarter_end', '2026-03-31'
   ), now()),
  ('chase_freedom_flex', 'fixed_3x_dining', ARRAY['DINING'::category_enum], 3.0, 'cashback_percent'::earn_type_enum, false, NULL, now()),
  ('chase_freedom_flex', 'fixed_3x_drugstores', ARRAY['DRUGSTORES'::category_enum], 3.0, 'cashback_percent'::earn_type_enum, false, NULL, now()),
  ('chase_freedom_flex', 'base_1x', ARRAY['GENERAL'::category_enum], 1.0, 'cashback_percent'::earn_type_enum, false, NULL, now())
ON CONFLICT DO NOTHING;

-- Chase Sapphire Preferred
INSERT INTO public.reward_rules (card_id, rule_id, categories, earn_rate, earn_type, source_last_verified) VALUES
  ('chase_sapphire_preferred', '5x_travel_portal', ARRAY['TRAVEL_PORTAL'::category_enum], 5.0, 'points_multiplier'::earn_type_enum, now()),
  ('chase_sapphire_preferred', '3x_dining', ARRAY['DINING'::category_enum], 3.0, 'points_multiplier'::earn_type_enum, now()),
  ('chase_sapphire_preferred', '3x_streaming', ARRAY['STREAMING'::category_enum], 3.0, 'points_multiplier'::earn_type_enum, now()),
  ('chase_sapphire_preferred', '2x_travel', ARRAY['TRAVEL_GENERAL'::category_enum, 'TRAVEL_HOTELS'::category_enum, 'TRAVEL_AIRLINES'::category_enum], 2.0, 'points_multiplier'::earn_type_enum, now()),
  ('chase_sapphire_preferred', 'base_1x', ARRAY['GENERAL'::category_enum], 1.0, 'points_multiplier'::earn_type_enum, now())
ON CONFLICT DO NOTHING;

-- Amex Gold
INSERT INTO public.reward_rules (card_id, rule_id, categories, earn_rate, earn_type, excluded_categories, source_last_verified) VALUES
  ('amex_gold', '4x_dining', ARRAY['DINING'::category_enum], 4.0, 'points_multiplier'::earn_type_enum, ARRAY[]::category_enum[], now()),
  ('amex_gold', '4x_grocery', ARRAY['GROCERY'::category_enum], 4.0, 'points_multiplier'::earn_type_enum, ARRAY['WHOLESALE_CLUBS'::category_enum], now()),
  ('amex_gold', '3x_airlines', ARRAY['TRAVEL_AIRLINES'::category_enum], 3.0, 'points_multiplier'::earn_type_enum, ARRAY[]::category_enum[], now()),
  ('amex_gold', 'base_1x', ARRAY['GENERAL'::category_enum], 1.0, 'points_multiplier'::earn_type_enum, ARRAY[]::category_enum[], now())
ON CONFLICT DO NOTHING;

-- Amex Platinum
INSERT INTO public.reward_rules (card_id, rule_id, categories, earn_rate, earn_type, source_last_verified) VALUES
  ('amex_platinum', '5x_airlines_direct', ARRAY['TRAVEL_AIRLINES'::category_enum], 5.0, 'points_multiplier'::earn_type_enum, now()),
  ('amex_platinum', '5x_hotels_travel_portal', ARRAY['TRAVEL_HOTELS'::category_enum], 5.0, 'points_multiplier'::earn_type_enum, now()),
  ('amex_platinum', 'base_1x', ARRAY['GENERAL'::category_enum], 1.0, 'points_multiplier'::earn_type_enum, now())
ON CONFLICT DO NOTHING;

-- Capital One Savor
INSERT INTO public.reward_rules (card_id, rule_id, categories, earn_rate, earn_type, source_last_verified) VALUES
  ('capital_one_savor', '3x_dining', ARRAY['DINING'::category_enum], 3.0, 'cashback_percent'::earn_type_enum, now()),
  ('capital_one_savor', '3x_entertainment', ARRAY['ENTERTAINMENT'::category_enum], 3.0, 'cashback_percent'::earn_type_enum, now()),
  ('capital_one_savor', '3x_grocery', ARRAY['GROCERY'::category_enum], 3.0, 'cashback_percent'::earn_type_enum, now()),
  ('capital_one_savor', '3x_streaming', ARRAY['STREAMING'::category_enum], 3.0, 'cashback_percent'::earn_type_enum, now()),
  ('capital_one_savor', 'base_1x', ARRAY['GENERAL'::category_enum], 1.0, 'cashback_percent'::earn_type_enum, now())
ON CONFLICT DO NOTHING;

-- Capital One Venture X
INSERT INTO public.reward_rules (card_id, rule_id, categories, earn_rate, earn_type, source_last_verified) VALUES
  ('capital_one_venture_x', '10x_hotels_portal', ARRAY['TRAVEL_HOTELS'::category_enum], 10.0, 'points_multiplier'::earn_type_enum, now()),
  ('capital_one_venture_x', '10x_car_rental_portal', ARRAY['TRAVEL_PORTAL'::category_enum], 10.0, 'points_multiplier'::earn_type_enum, now()),
  ('capital_one_venture_x', '5x_flights_portal', ARRAY['TRAVEL_AIRLINES'::category_enum], 5.0, 'points_multiplier'::earn_type_enum, now()),
  ('capital_one_venture_x', 'base_2x', ARRAY['GENERAL'::category_enum], 2.0, 'points_multiplier'::earn_type_enum, now())
ON CONFLICT DO NOTHING;
