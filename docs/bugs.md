# Bugs

## BUG-001: Capital One Venture showing incorrect 5x on transit (should be 2x)

**Status:** Open  
**Reported:** 2026-04-26

**Description:**  
The Capital One Venture card is displaying 5x points on transit categories (e.g., Uber, Lyft) in the app. The correct earn rate is 2x on transit.

**Expected behavior:** Capital One Venture shows 2x on transit purchases (Uber, Lyft, etc.)  
**Actual behavior:** Capital One Venture shows 5x on transit purchases

**Likely cause:** Incorrect multiplier value in card rewards data for the transit category.

---

## BUG-002: Retailer search missing apparel and other key categories

**Status:** Fixed  
**Reported:** 2026-04-26

**Description:**  
The retailer search showed almost no clothing/apparel brands (e.g., Zara, Lululemon, H&M, Nike) and had no wireless carriers at all. The merchant database was seeded only with grocery, dining, travel, streaming, drugstores, gas, home improvement, and entertainment — leaving `DEPARTMENT_STORES` and `PHONE_WIRELESS` categories empty.

**Expected behavior:** Users can search for and find major apparel retailers (Zara, Lululemon, H&M, Gap, Old Navy, Nordstrom, TJ Maxx, Nike, etc.) and wireless carriers (Verizon, AT&T, T-Mobile).  
**Actual behavior:** Search returned no results for clothing brands; only grocery/wholesale/everyday stores appeared.

**Fix:** Added 29 new merchants to `data/seed/merchants.json` and `app/supabase/seed-complete.sql`:
- **Department stores:** Nordstrom, Macy's, Bloomingdale's, Neiman Marcus, Saks Fifth Avenue
- **Apparel brands:** Zara, Lululemon, H&M, Gap, Old Navy, Banana Republic, Uniqlo, Forever 21, Urban Outfitters, Anthropologie, Free People, Express
- **Off-price retail:** TJ Maxx, Marshalls, Ross
- **Athletic/footwear:** Nike, Adidas, Foot Locker, DSW
- **Online apparel:** SHEIN, ASOS
- **Wireless:** Verizon, AT&T, T-Mobile

**Action required:** Re-run `seed-complete.sql` against the database to populate new merchants.
