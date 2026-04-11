# Credit Card Advisor - Phase 1 MVP - Complete

A zero-budget PWA that helps users find their best credit card for any purchase.

## Phase 1 Status: COMPLETE

All 6 steps of Phase 1 have been implemented:

1. ✅ Project scaffolding
2. ✅ Supabase configuration with initial schema
3. ✅ Supabase client setup (browser + server)
4. ✅ Auth flow (signup/login with session protection)
5. ✅ Recommendation engine with comprehensive tests
6. ✅ API routes + core UI screens

## Tech Stack

- **Frontend**: Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **Backend**: Supabase (Postgres + Auth)
- **Package Manager**: pnpm
- **Testing**: Vitest (11 tests, all passing)

## File Structure Created

```
app/
├── app/                                      # Next.js App Router
│   ├── (auth)/                               # Auth layout
│   │   ├── layout.tsx                        # Auth layout (no sidebar)
│   │   ├── login/page.tsx                    # Login form
│   │   └── signup/page.tsx                   # Signup form
│   ├── api/
│   │   ├── auth/callback/route.ts            # Auth callback handler
│   │   ├── recommend/route.ts                # POST /api/recommend
│   │   └── merchants/search/route.ts         # GET /api/merchants/search
│   ├── recommend/[merchantId]/page.tsx       # Recommendation results screen
│   ├── wallet/page.tsx                       # Card wallet management
│   ├── page.tsx                              # Home screen (merchant search)
│   ├── layout.tsx                            # Root layout
│   └── globals.css                           # Tailwind styles
├── src/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                     # Browser client
│   │   │   ├── server.ts                     # Server client
│   │   │   └── middleware.ts                 # Session refresh
│   │   ├── engine/
│   │   │   ├── recommend.ts                  # Scoring engine
│   │   │   └── __tests__/
│   │   │       └── recommend.test.ts         # 11 test scenarios
│   │   └── validation/
│   │       └── schemas.ts                    # Zod validation (from Phase 0)
│   └── middleware.ts                         # Next.js middleware
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql            # Complete Phase 1 schema
│   └── seed.sql                              # Seed data (cards, rules, merchants)
├── vitest.config.ts                          # Test configuration
├── package.json                              # Updated with test script
└── .env.local.example                        # Environment template
```

## Test Results

```
Test Files  1 passed (1)
     Tests  11 passed (11)
   Duration  92ms
```

All tests passing:

✅ Edge Case 1: Multi-category merchant (picks highest-earning category)
✅ Edge Case 2: Quarterly rotating card (shows caveat)
✅ Edge Case 2b: Quarterly card outside active quarter (fallback)
✅ Edge Case 3: Time-bound rule expired (fallback to base)
✅ Edge Case 4: No matching rules (all cards show base rate)
✅ Edge Case 5: Warehouse club exclusion (Costco doesn't earn Amex 4x)
✅ Edge Case 5b: Warehouse club with other card (works fine)
✅ Edge Case 6: Tiebreaker on equal rates
✅ Integration: Whole Foods ranking with Q1 date
✅ Integration: Starbucks dining scenarios
✅ Integration: Explanation generation

## API Testing

### POST /api/recommend with Whole Foods

**Request:**
```bash
curl -X POST http://localhost:3000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{"merchant_id": "whole_foods_market"}'
```

**Response (with 3 cards in wallet):**
```json
{
  "data": [
    {
      "card_id": "chase_freedom_flex",
      "effective_rate": 5.0,
      "earn_type": "cashback_percent",
      "explanation": "Chase Freedom Flex earns 5% on Whole Foods Market.",
      "caveats": ["Requires quarterly activation"],
      "last_verified_at": "2026-04-10T...",
      "recommendation_type": "best_likely_card"
    },
    {
      "card_id": "amex_gold",
      "effective_rate": 4.0,
      "earn_type": "points_multiplier",
      "explanation": "American Express Gold earns 4x on grocery.",
      "caveats": [],
      "last_verified_at": "2026-04-10T...",
      "recommendation_type": "best_likely_card"
    },
    {
      "card_id": "capital_one_savor",
      "effective_rate": 3.0,
      "earn_type": "cashback_percent",
      "explanation": "Capital One Savor earns 3% on grocery.",
      "caveats": [],
      "last_verified_at": "2026-04-10T...",
      "recommendation_type": "best_likely_card"
    }
  ],
  "merchant": {
    "id": "whole_foods_market",
    "canonical_name": "Whole Foods Market",
    "primary_category": "GROCERY"
  },
  "disclaimer": "Final rewards may depend on issuer terms, merchant classification, and account-specific conditions."
}
```

### GET /api/merchants/search?q=starbucks

**Response:**
```json
{
  "data": [
    {
      "id": "starbucks",
      "canonical_name": "Starbucks",
      "primary_category": "DINING",
      "aliases": ["Starbucks Coffee", "STARBKS", "Starbucks Corp"]
    }
  ],
  "query": "starbucks",
  "count": 1
}
```

## Core Screens

### Home Page (/
- Large merchant search input with real-time fuzzy results
- Tap merchant to view recommendations
- Mobile-optimized (one-handed)
- Sign out button in header

### Recommendation Screen (/recommend/[merchantId])
- Best card highlighted prominently (large rate display)
- Other cards listed below with rates
- Explanations and caveats for each
- Last verified timestamp
- Disclaimer
- Navigation to search again or wallet

### Wallet Page (/wallet)
- List of user's added cards
- Add/remove card buttons
- Card issuer and base earn rate displayed
- Modal picker for adding cards
- Message to add cards if empty

### Auth Screens
- Login page (/login) with email/password
- Signup page (/signup) with password confirmation
- Simple, mobile-friendly styling
- Redirect authenticated users from auth pages
- Protect /wallet routes with middleware

## Recommendation Engine Details

Implements all 6 edge cases from `data/specs/scoring-algorithm.md`:

1. **Multi-category merchants** — Finds highest-earning applicable rule across all categories
2. **Quarterly rotating cards** — Checks if current date is in active quarter, adds caveat
3. **Time-bound rules** — Falls back to base rate if valid_from/valid_until expired
4. **No matching rules** — Returns base_earn_rate for all cards
5. **Excluded categories** — Respects excluded_categories on rules (e.g., Amex Gold excludes WHOLESALE_CLUBS from 4x grocery)
6. **Tiebreaker** — When rates are equal, cards are ordered by created_at (earliest first)

### Scoring Logic

```typescript
async function getRecommendations(
  merchantId: string,
  userCardIds: string[],
  asOf: Date = new Date()
): Promise<RankedRecommendation[]>
```

For each card:
1. Fetch all reward rules for that card from database
2. Find best matching rule in priority order:
   - Merchant-specific rules (if any)
   - Category rules (highest earning)
   - Base rate (fallback)
3. Check rule validity (time-bound, quarterly rotating)
4. Convert points to cash-equivalent (1 point = 1 cent)
5. Generate explanation and caveats
6. Rank all cards by cash_equivalent descending
7. Apply tiebreaker by wallet order
8. Return ranked array with card metadata

## Database Schema

### 8 Phase 1 Tables

**issuers**
- id (TEXT): chase, amex, capital_one
- name (TEXT): Display name

**cards**
- id (TEXT): chase_freedom_flex, amex_gold, etc.
- issuer_id (ENUM)
- name (TEXT): Full card name
- network (TEXT): visa, amex, etc.
- reward_unit (ENUM): cashback_percent | points_multiplier
- base_earn_rate (NUMERIC): 0-100

**merchants**
- id (TEXT): whole_foods_market, starbucks, etc.
- canonical_name (TEXT)
- aliases (TEXT[])
- primary_category (ENUM)
- secondary_categories (ENUM[])
- mcc_codes (TEXT[])
- is_online_only (BOOL)

**reward_rules**
- id (UUID)
- card_id (TEXT FK)
- rule_id (TEXT): quarterly_5x, 4x_grocery, etc.
- categories (ENUM[])
- earn_rate (NUMERIC)
- earn_type (ENUM)
- quarterly_rotating (BOOL)
- quarterly_config (JSONB): Contains activation_required, current_quarter_categories, dates
- valid_from, valid_until (dates for time-bound rules)
- excluded_merchants, excluded_categories

**user_cards**
- id (UUID)
- user_id (UUID FK)
- card_id (TEXT FK)
- nickname (TEXT)
- disabled (BOOL)
- display_order (INT)

**recommendations**
- id (UUID)
- user_id (UUID FK)
- merchant_id (TEXT FK)
- recommended_card_id (TEXT FK)
- effective_rate, earn_type, explanation, caveats

Plus **merchant_aliases** and **merchant_category_map** for data normalization.

### RLS Policies

- **cards, merchants, reward_rules**: Read-only for authenticated users
- **user_cards**: Authenticated users can CRUD their own only
- **recommendations**: Authenticated users can insert + read their own

## Validation Schemas

All request/response schemas validated with Zod (from Phase 0):

- `RecommendRequestSchema`: { merchant_id: string }
- `RecommendResponseSchema`: { data: [], merchant: {}, disclaimer: string }
- `MerchantSearchQuerySchema`: { q: string, limit?: number }
- `MerchantSearchResponseSchema`: { data: [], query: string, count: number }
- Card, Merchant, RewardRule schemas for database types

## Key Design Decisions

1. **Server-side scoring** — Engine runs on server (Route Handler), never client-side
2. **1 point = 1 cent** — Default valuation; custom valuations deferred to Phase 2
3. **No spend caps** — App shows advertised rates as nudges only
4. **Fuzzy search client-side** — Fetch merchants from DB, filter in Route Handler
5. **Middleware for auth** — Automatic session refresh + route protection
6. **Quarterly caveat** — Always shown if rotating rule is active (user must activate)
7. **Event logging** — Top recommendation is logged to recommendations table

## Environment Setup

1. Create Supabase project
2. Create `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ```
3. Run migrations:
   ```bash
   supabase db push
   supabase db seed < supabase/seed.sql
   ```
4. Start dev server: `pnpm dev`

## Next Steps (Phase 2)

See `/docs/BACKLOG.md`:

- [ ] Rules refresh pipeline (automated parsers)
- [ ] Location-based nearby merchant search
- [ ] Admin console (rule CRUD)
- [ ] User feedback flows
- [ ] Custom point valuations
- [ ] Spend cap modeling
- [ ] Rule change audit log

## Success Criteria Met

✅ Next.js app scaffolded with all dependencies
✅ Supabase schema created with 8 Phase 1 tables
✅ RLS policies protect user data correctly
✅ Auth flow works: signup → login → session → redirect
✅ Recommendation engine implements all 6 edge cases
✅ All 11 test fixtures pass (`pnpm test`)
✅ POST `/api/recommend` with Whole Foods returns ranked cards
✅ GET `/api/merchants/search?q=starbucks` returns DINING category
✅ UI: Home screen has search, mobile-optimized
✅ UI: Wallet page lists/adds/removes cards
✅ UI: Recommendation screen shows ranked cards with explanations + disclaimer
