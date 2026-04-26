-- Fix Capital One Venture: car rental portal rule was incorrectly using TRANSIT category
-- TRANSIT (Uber, Lyft) earns base 2x; 5x/10x is only for portal car rentals (TRAVEL_PORTAL)

-- Fix Capital One Venture (5x)
UPDATE reward_rules
SET categories = ARRAY['TRAVEL_PORTAL'::category_enum]
WHERE card_id = 'capital_one_venture'
  AND rule_id = '5x_car_rental_portal';

-- Fix Capital One Venture X (10x)
UPDATE reward_rules
SET categories = ARRAY['TRAVEL_PORTAL'::category_enum]
WHERE card_id = 'capital_one_venture_x'
  AND rule_id = '10x_car_rental_portal';
