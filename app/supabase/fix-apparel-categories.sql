-- Step 1: Add new enum values
ALTER TYPE public.category_enum ADD VALUE IF NOT EXISTS 'PHONE_WIRELESS';
ALTER TYPE public.category_enum ADD VALUE IF NOT EXISTS 'CLOTHING_STORES';
ALTER TYPE public.category_enum ADD VALUE IF NOT EXISTS 'SPORTS_APPAREL';
ALTER TYPE public.category_enum ADD VALUE IF NOT EXISTS 'SHOE_STORES';

-- Step 2: Reassign merchant categories
-- SPORTS_APPAREL (MCC 5655)
UPDATE merchants SET primary_category = 'SPORTS_APPAREL' WHERE id IN ('nike', 'lululemon');

-- CLOTHING_STORES (MCC 5621/5651/5699)
UPDATE merchants SET primary_category = 'CLOTHING_STORES' WHERE id IN (
  'zara', 'hm', 'gap', 'old_navy', 'banana_republic', 'uniqlo',
  'forever_21', 'urban_outfitters', 'anthropologie', 'free_people',
  'express', 'tj_maxx', 'marshalls', 'ross', 'shein', 'asos'
);

-- SHOE_STORES (MCC 5661)
UPDATE merchants SET primary_category = 'SHOE_STORES' WHERE id IN ('foot_locker', 'dsw');

-- DEPARTMENT_STORES stays for true dept stores (MCC 5311) — no change needed
-- nordstrom, macys, bloomingdales, neiman_marcus, saks_fifth_avenue already correct
