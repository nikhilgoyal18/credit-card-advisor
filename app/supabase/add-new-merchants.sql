-- Add 29 new merchants (apparel, department stores, wireless)
-- Safe to re-run: ON CONFLICT DO NOTHING skips existing rows

INSERT INTO merchants (id, canonical_name, aliases, primary_category, secondary_categories, mcc_codes, is_online_only, notes) VALUES
-- Department Stores
('nordstrom', 'Nordstrom', ARRAY['Nordstrom Inc', 'Nordstrom Rack', 'NORDSTROM'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5311'], false, NULL),
('macys', 'Macy''s', ARRAY['Macys', 'Macy''s Inc', 'MACYS'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5311'], false, NULL),
('bloomingdales', 'Bloomingdale''s', ARRAY['Bloomingdales', 'BLOOMINGDALES'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5311'], false, NULL),
('neiman_marcus', 'Neiman Marcus', ARRAY['Neiman Marcus Group', 'NEIMANMARCUS'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5311'], false, NULL),
('saks_fifth_avenue', 'Saks Fifth Avenue', ARRAY['Saks', 'Saks Inc', 'SAKS'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5311'], false, NULL),
-- Apparel Brands
('zara', 'Zara', ARRAY['Zara USA', 'Inditex', 'ZARA'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5699'], false, NULL),
('lululemon', 'Lululemon', ARRAY['lululemon athletica', 'Lululemon Inc', 'LULULEMON'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5699'], false, NULL),
('hm', 'H&M', ARRAY['H and M', 'H&M Group', 'HM'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5651'], false, NULL),
('gap', 'Gap', ARRAY['Gap Inc', 'Gap Stores', 'GAP'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5651'], false, NULL),
('old_navy', 'Old Navy', ARRAY['Old Navy LLC', 'OLDNAVY'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5651'], false, NULL),
('banana_republic', 'Banana Republic', ARRAY['Banana Republic LLC', 'BANANAREPUBLIC'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5651'], false, NULL),
('uniqlo', 'Uniqlo', ARRAY['UNIQLO Co', 'Fast Retailing', 'UNIQLO'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5651'], false, NULL),
('forever_21', 'Forever 21', ARRAY['Forever21', 'FOREVER21'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5651'], false, NULL),
('urban_outfitters', 'Urban Outfitters', ARRAY['Urban Outfitters Inc', 'URBANOUTFITTERS', 'UO'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5699'], false, NULL),
('anthropologie', 'Anthropologie', ARRAY['Anthropologie Group', 'ANTHROPOLOGIE'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5699'], false, NULL),
('free_people', 'Free People', ARRAY['Free People LLC', 'FREEPEOPLE', 'FP'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5699'], false, NULL),
('express', 'Express', ARRAY['Express Inc', 'EXPRESS'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5651'], false, NULL),
-- Off-Price Retail
('tj_maxx', 'TJ Maxx', ARRAY['TJX', 'TJ Maxx Inc', 'T.J.Maxx', 'TJMAXX'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5651'], false, NULL),
('marshalls', 'Marshalls', ARRAY['Marshalls Inc', 'MARSHALLS'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5651'], false, NULL),
('ross', 'Ross Dress for Less', ARRAY['Ross Stores', 'Ross', 'ROSS'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5651'], false, NULL),
-- Athletic & Footwear
('nike', 'Nike', ARRAY['Nike Inc', 'Nike Store', 'Nike.com', 'NIKE'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5699'], false, NULL),
('adidas', 'Adidas', ARRAY['Adidas AG', 'Adidas Store', 'Adidas.com', 'ADIDAS'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5699'], false, NULL),
('foot_locker', 'Foot Locker', ARRAY['Foot Locker Inc', 'FOOTLOCKER'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5661'], false, NULL),
('dsw', 'DSW', ARRAY['Designer Shoe Warehouse', 'DSW Inc', 'DSW Shoes'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5661'], false, NULL),
-- Online Apparel
('shein', 'SHEIN', ARRAY['Shein Group', 'SHEIN.com'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5699'], true, NULL),
('asos', 'ASOS', ARRAY['ASOS.com', 'ASOS plc'], 'DEPARTMENT_STORES', ARRAY[]::category_enum[], ARRAY['5699'], true, NULL),
-- Phone / Wireless
('verizon', 'Verizon', ARRAY['Verizon Wireless', 'Verizon Communications', 'VERIZON'], 'PHONE_WIRELESS', ARRAY[]::category_enum[], ARRAY['4814'], false, NULL),
('att', 'AT&T', ARRAY['AT&T Inc', 'AT and T', 'ATT'], 'PHONE_WIRELESS', ARRAY[]::category_enum[], ARRAY['4814'], false, NULL),
('tmobile', 'T-Mobile', ARRAY['T Mobile', 'T-Mobile USA', 'TMOBILE'], 'PHONE_WIRELESS', ARRAY[]::category_enum[], ARRAY['4814'], false, NULL)
ON CONFLICT (id) DO NOTHING;
