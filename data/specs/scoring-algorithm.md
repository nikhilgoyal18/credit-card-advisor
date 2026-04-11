# Scoring Algorithm Specification

This document defines the canonical scoring algorithm for credit card recommendations. All implementations (server-side, tests, documentation) must follow this logic exactly.

## Input

```typescript
{
  merchantId: string,           // ID of the selected merchant
  userCardIds: string[],        // IDs of cards in user's wallet
  asOf: Date = new Date()      // Evaluation date (for time-bound rules)
}
```

## Output

```typescript
{
  card_id: string,
  effective_rate: number,      // Effective earn rate for this merchant (0-100)
  earn_type: "cashback_percent" | "points_multiplier",
  explanation: string,         // Plain-language reason for recommendation
  caveats: string[]           // Array of important caveats (empty if none)
}[]  // Array sorted best-to-worst by effective_rate, then by wallet order
```

## Algorithm Steps

### Step 1: Resolve Merchant → Category

Given `merchantId`:
1. Look up merchant in `merchants` table
2. If not found → error (should not happen; UI validates before calling)
3. Get merchant's `primary_category` and `secondary_categories`

**Result**: `resolvedCategories` = [primary, ...secondary]

### Step 2: For Each User Card, Find the Best Matching Rule

For each `cardId` in `userCardIds`:

1. **Fetch all rules** for this card from `reward_rules` table

2. **Find best rule** (in this priority order):
   a. **Merchant-specific rule** — If any rule has `merchant_specific` array containing `merchantId`, use the first matching rule with highest `earn_rate`
   b. **Category rule** — If any rule's `categories` array intersects with `resolvedCategories`, use the one with highest `earn_rate`
   c. **Base rate** — If no merchant or category rules match, use the card's `base_earn_rate`

3. **Check time-bound rules** — If the selected rule has `valid_from` or `valid_until`:
   - If `asOf` is before `valid_from` → use base rate instead
   - If `asOf` is after `valid_until` → use base rate instead
   - Otherwise → use the selected rule

4. **Check quarterly rotating rules** — If the selected rule has `quarterly_rotating: true`:
   - Check if current date falls within `current_quarter_start` and `current_quarter_end`
   - Add caveat: "Requires quarterly activation" (quarterly categories need user activation)
   - Use the `earn_rate` if activated

5. **Check disabled cards** — If user has disabled this card in `user_cards.disabled = true`:
   - Exclude this card from results entirely (skip Steps 3-6 for this card)

### Step 3: Build Explanation String

For each card, construct a plain-language explanation:

**Format**: "{Card name} earns {rate} on {category/merchant} purchases."

**Examples**:
- "Amex Gold earns 4x on grocery store purchases."
- "Chase Freedom Flex earns 5% on Whole Foods Market during the active quarter."
- "Capital One Savor earns 3% on dining."
- "Chase Sapphire Preferred earns 1x on general purchases." (fallback)

**For rotating categories**, append: "Requires quarterly activation to earn this rate."

### Step 4: Convert Points to Cash-Equivalent Value

For comparability, convert all earn rates to a **cash-equivalent value**:

```
If earn_type == "cashback_percent":
  cash_equivalent = earn_rate (as-is, e.g., 5.0 for 5%)

If earn_type == "points_multiplier":
  cash_equivalent = earn_rate * 0.01  (assuming 1 point = 1 cent default valuation)
  Examples:
  - 5x points = 5.0 cash equivalent
  - 3x points = 3.0 cash equivalent
```

**Note**: This assumes **1 point = 1 cent** for valuation. Custom valuations are backlogged.

### Step 5: Rank Cards

1. Sort all cards (except disabled) by `cash_equivalent` descending (highest earn first)
2. **Tiebreaker**: If two cards have equal `cash_equivalent`, order by card addition order to wallet (earliest added = listed first)

### Step 6: Return Ranked Results

For each card in ranked order, return:

```typescript
{
  card_id: string,
  effective_rate: number,                         // Numeric earn rate (5 for 5%, 3 for 3x)
  earn_type: "cashback_percent" | "points_multiplier",
  explanation: string,                            // Plain-language explanation
  caveats: string[]                               // Array of caveats, empty if none
}
```

**Caveats array** examples:
- `["Requires quarterly activation"]` — for rotating Chase Freedom
- `[]` — most cards
- `["Requires direct booking with airline"]` — for airline-specific bonuses

## Edge Cases

### Case 1: Multi-Category Merchant

**Scenario**: Target (primary_category: GROCERY, secondary_categories: [GENERAL])

**Logic**: Find the highest-earning applicable rule across all categories.

**Example**:
- Amex Gold: 4x GROCERY, 1x GENERAL → use 4x (highest)
- Capital One Savor: 3% GROCERY, 1% GENERAL → use 3% (highest)
- Chase Freedom (non-rotating): 5% GENERAL only → use 1% base (GROCERY not in quarterly, GENERAL is 1%)

### Case 2: Quarterly Rotating Card Not Activated

**Scenario**: Chase Freedom Flex at Whole Foods (Q2 2026). Category is in quarterly_config but user has not activated it.

**Decision**: Show base rate (1%) with caveat "Requires quarterly activation to earn 5%."

**Why**: We do not verify activation state. The app is a nudge, not a guarantee. Users must understand they need to activate.

### Case 3: Time-Bound Rule Expired

**Scenario**: A temporary bonus rule for "dining at Marriott" valid until 2026-06-30. Current date is 2026-07-15.

**Logic**: Rule has expired. Fall back to base rate for this card.

### Case 4: No Rules Match Merchant

**Scenario**: Merchant "Mom's Corner Store" not in any card's rules, categories not mapped.

**Logic**: All cards fall back to their base_earn_rate. Tiebreaker applies if rates are equal.

### Case 5: Disabled Card

**Scenario**: User has disabled "Capital One Savor" in their wallet settings.

**Logic**: Do not include in recommendation results at all.

### Case 6: Equal Cash-Equivalent Rates (Tiebreaker)

**Scenario**: Two cards both earn effectively 3% (one via 3% cashback, one via 3x points at 1 cpp).

**Logic**: Prefer the card that was added to the wallet first. Use `user_cards.created_at` or equivalent ordering.

## Testing Checklist

Implement tests covering all 6 edge cases:

- [ ] Multi-category merchant (GROCERY + GENERAL) picks best rate
- [ ] Quarterly card without activation shows caveat
- [ ] Expired rule falls back to base rate
- [ ] No matching rules → all cards show base rate
- [ ] Disabled card excluded from results
- [ ] Tied rates use wallet order tiebreaker

## Example Trace

**Input**:
```
merchantId: "whole_foods_market"
userCardIds: ["amex_gold", "chase_freedom_flex", "capital_one_savor"]
asOf: 2026-04-10
```

**Merchant Resolution**:
- whole_foods_market → primary_category: GROCERY, secondary_categories: []

**Card Scoring**:

**Amex Gold**:
- Rule match: 4x GROCERY (4x points)
- Time-bound? No. Rotating? No.
- Cash equivalent: 4.0
- Explanation: "American Express Gold earns 4x on grocery store purchases."
- Caveats: []

**Chase Freedom Flex**:
- Best rule: 5% quarterly rotating (Q2 2026 includes GROCERY)
- Time-bound? No. Rotating? Yes, active quarter.
- Cash equivalent: 5.0
- Explanation: "Chase Freedom Flex earns 5% on Whole Foods Market (active quarter)."
- Caveats: ["Requires quarterly activation"]

**Capital One Savor**:
- Best rule: 3% GROCERY
- Time-bound? No. Rotating? No.
- Cash equivalent: 3.0
- Explanation: "Capital One Savor earns 3% on grocery store purchases."
- Caveats: []

**Ranking**:
1. Chase Freedom Flex — 5.0 (highest rate, caveat noted)
2. Amex Gold — 4.0
3. Capital One Savor — 3.0

**Output**:
```json
[
  {
    "card_id": "chase_freedom_flex",
    "effective_rate": 5.0,
    "earn_type": "cashback_percent",
    "explanation": "Chase Freedom Flex earns 5% on Whole Foods Market (active quarter).",
    "caveats": ["Requires quarterly activation"]
  },
  {
    "card_id": "amex_gold",
    "effective_rate": 4.0,
    "earn_type": "points_multiplier",
    "explanation": "American Express Gold earns 4x on grocery store purchases.",
    "caveats": []
  },
  {
    "card_id": "capital_one_savor",
    "effective_rate": 3.0,
    "earn_type": "cashback_percent",
    "explanation": "Capital One Savor earns 3% on grocery store purchases.",
    "caveats": []
  }
]
```
