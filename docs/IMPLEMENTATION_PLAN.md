# Credit Card Points Advisor — Implementation Plan

## Context

This plan addresses a greenfield build of a zero-budget PWA that answers: "Which of my cards should I use at this merchant right now?" Two rounds of PRDs and four expert reviews have been completed. No code exists. The expert consensus is clear: **do not write UI code first**. The recommendation engine depends on a data foundation (merchants, cards, rules) that must be hand-curated before any UI work begins.

MVP scope is intentionally narrow: Chase, American Express, and Capital One only (6 specific card products). All scoring is deterministic and server-side. No live scraping at recommendation time.

---

## Architecture Decisions (locked in)

- **Stack**: Next.js 14 (App Router) + Supabase (Postgres + Auth + Edge Functions) + Vercel free tier
- **Auth model**: Three roles — anonymous (read-only recommendations), authenticated user (wallet management), admin (catalog + rule management). Supabase Row Level Security enforces boundaries.
- **Scoring**: Happens at the API layer, never client-side. Rules stored with `last_verified_at` timestamps.
- **Refresh model**: Rules ingested ahead of time via scheduled jobs. No live scraping at recommendation time. Refresh pipeline writes diffs to `rule_change_events`.
- **Point valuation**: Default 1 cent per point (cashback-equivalent). Custom valuations deferred post-MVP.

---

## Phase 0: Data Foundation (Weeks 1–2) — BEFORE any application code

All output is JSON/SQL files committed to `data/`. No UI work until Phase 0 is complete and reviewed.

### Task 0.1 — Define Category Enum
**File**: `data/categories.json`

Flat enum (not hierarchical). Categories map to what issuers actually use in benefit language:
```
GROCERY, DINING, TRAVEL_GENERAL, TRAVEL_HOTELS, TRAVEL_AIRLINES,
TRAVEL_PORTAL, STREAMING, ENTERTAINMENT, GAS_STATIONS, DRUGSTORES,
HOME_IMPROVEMENT, TRANSIT, DEPARTMENT_STORES, WHOLESALE_CLUBS, GENERAL
```

Critical: `WHOLESALE_CLUBS` must be separate from `GROCERY` — Amex explicitly excludes wholesale clubs from the 4x grocery earn. Use `DINING` (not `RESTAURANTS`) to match issuer language.

### Task 0.2 — Card Catalog JSON Schema
**File**: `data/schemas/card.schema.json`

Fields: `id`, `issuer_id` (enum: chase/amex/capital_one), `name`, `network`, `reward_unit` (cashback_percent | points_multiplier), `base_earn_rate`, `reward_rules[]`. Each rule has: `categories[]`, `earn_rate`, `merchant_specific[]`, `quarterly_rotating`, `spend_cap_cents`, `excluded_merchants[]`, `excluded_categories[]`, `valid_from/until`, `source_url`, `source_last_verified`.

### Task 0.3 — Card Catalog Seed (6 cards)
**File**: `data/seed/cards.json`

| Card | Key Rule | Critical Detail |
|---|---|---|
| Chase Freedom/Flex | 5% rotating quarterly; 3% dining/drugstores; 1% base | `spend_cap_cents: 150000`, `activation_required: true` |
| Chase Sapphire Preferred | 5x Chase Travel; 3x dining/streaming; 2x travel; 1x base | Travel-focused rewards |
| Amex Gold | 4x dining; 4x grocery (excl. WHOLESALE_CLUBS, cap $25k/yr); 3x airlines | Category-specific rewards |
| Amex Platinum | 5x airlines/hotels (direct/Amex Travel); 1x base | Premium travel rewards |
| Capital One Savor | 3% dining/entertainment/grocery/streaming; 1% base | Stable category-based rewards |
| Capital One Venture X | 10x hotels/cars via C1 Travel; 5x flights via C1 Travel; 2x all else | Travel portal rewards |

**Note**: Annual fees are not modeled in the recommendation engine. The app assumes users already own their cards. The recommendation answers "which of my existing cards should I use here?" not "should I apply for this card?" |

### Task 0.4 — Merchant Catalog Seed (200–300 entries)
**File**: `data/seed/merchants.json`

Per-entry fields: `id`, `canonical_name`, `aliases[]`, `primary_category`, `secondary_categories[]`, `mcc_codes[]`, `is_online_only`, `notes`.

Coverage priority:
1. Major grocery chains (30): Whole Foods, Kroger, Trader Joe's, Aldi, Costco (WHOLESALE_CLUBS), Sam's Club (WHOLESALE_CLUBS), Target, Walmart, Publix, H-E-B, Wegmans, etc.
2. Restaurants (60): McDonald's, Starbucks, Chipotle, Subway, Domino's, Panera, Chick-fil-A, etc.
3. Travel merchants (30): United, Delta, American, Southwest, Marriott, Hilton, Hyatt, Airbnb, Expedia, Uber, Lyft, etc.
4. Streaming services (15): Netflix, Hulu, Disney+, Spotify, Apple TV+, etc.
5. Drugstores (10): CVS, Walgreens, Rite Aid, etc.
6. Gas stations (10): Shell, BP, Chevron, Exxon, Speedway, etc.
7. Entertainment (15): AMC, Regal, Ticketmaster, StubHub, etc.
8. Retail/other (50+): Amazon, Target, Best Buy, Home Depot, Lowes, etc.

### Task 0.5 — Scoring Algorithm Pseudocode
**File**: `data/specs/scoring-algorithm.md`

Must document all edge cases:
1. Multi-category merchant (e.g., Target — GROCERY + GENERAL) → use highest-earning applicable category
2. Quarterly rotating card not activated → fall back to base rate, add disclaimer
3. Spend cap exceeded → reduce effective rate proportionally (or flag as "may not earn bonus rate")
4. Time-bound rule expired (e.g., past quarter) → do not apply, use base rate
5. No rules match merchant → use base rate for all cards
6. Tiebreaker: equal cash-equivalent value → prefer card added to wallet first
7. Card disabled in user settings → exclude from results

Scoring function signature:
```typescript
function scoreCard(card: UserCard, merchant: Merchant, rules: RewardRule[], asOf: Date): CardScore
```

Return: `{ card_id, effective_rate, earn_type, explanation, confidence, caveats[] }`

### Task 0.6 — API Contract (OpenAPI spec)
**File**: `data/specs/openapi.yaml`

Three core endpoints:
- `POST /api/recommend` — request: `{ merchant_id, user_id }` → response: recommendation JSON contract (from PRD v2)
- `GET /api/merchants/search` — query: `?q=whole+foods&lat=&lng=&radius=` → merchant list
- `GET/PUT/DELETE /api/admin/rules/{card_id}` — admin-only rule management

Full request schemas, response schemas, error codes, and auth requirements.

### Task 0.7 — Zod Validation Schemas
**File**: `data/specs/validation-schemas.ts` (canonical reference, not application code)

Types: `CardSchema`, `RewardRuleSchema`, `MerchantSchema`, `UserCardSettingsSchema`, `RecommendationRequestSchema`. Constrain: `earn_rate` (0–100), `spend_cap_cents` (positive integer or null), `category` (must be enum value), `issuer_id` (enum).

---

## Phase 1: Core App Build (Weeks 3–6)

### 1.1 — Project Scaffolding
```
npx create-next-app@latest credit-card-advisor --typescript --tailwind --app
```
**Key files to create**:
- `src/lib/supabase.ts` — Supabase client
- `src/lib/db/schema.sql` — full database schema
- `src/lib/validation/` — Zod schemas (ported from Phase 0 spec)
- `src/types/index.ts` — TypeScript types matching DB schema

### 1.2 — Database Schema (SQL migrations)
**File**: `supabase/migrations/001_initial_schema.sql`

Tables (15): `users`, `issuers`, `cards`, `user_cards`, `user_card_settings`, `merchants`, `merchant_aliases`, `merchant_categories`, `merchant_category_map`, `rule_sources`, `reward_rules`, `rule_refresh_runs`, `rule_change_events`, `recommendations`, `parser_failures`

Seed via: `supabase/seed.sql` (imports from Phase 0 JSON files)

RLS policies:
- `recommendations`: users read own; anon can insert
- `user_cards`: users CRUD own only
- `reward_rules`: read-only for authenticated; admin writes
- `rule_sources`, `parser_failures`: admin only

### 1.3 — Recommendation Engine
**File**: `src/lib/engine/recommend.ts`

```typescript
export async function getRecommendations(
  merchantId: string,
  userCardIds: string[],
  asOf: Date = new Date()
): Promise<RankedRecommendation[]>
```

Steps: resolve merchant → fetch applicable rules for user's cards → score each card → rank by effective cash-equivalent value → attach explanation and caveats → return with freshness metadata.

**Test file**: `src/lib/engine/__tests__/recommend.test.ts`
25–30 fixture test cases covering: all 6 cards at Whole Foods, all 6 at Starbucks, quarterly card not activated, spend cap exceeded, no matching rules, single card in wallet, tiebreaker scenario.

### 1.4 — API Routes
**Files**:
- `src/app/api/recommend/route.ts` — `POST`, validates with Zod, calls engine, logs to `recommendations`
- `src/app/api/merchants/search/route.ts` — `GET`, fuzzy search merchants + aliases
- `src/app/api/admin/rules/[card_id]/route.ts` — `GET/PUT/DELETE`, admin-only via middleware

### 1.5 — Core UI (4 screens)

**Screen 1: Wallet** (`src/app/wallet/page.tsx`)
- List user's saved cards (reorderable)
- Add card from catalog (dropdown by issuer → product)
- Enable/disable individual cards
- Per-card settings (e.g., quarterly rotating categories)

**Screen 2: Merchant Search** (`src/app/page.tsx` — home)
- Primary: search box with instant fuzzy results
- Secondary: optional location-based nearby merchants (if permission granted)
- Select merchant → navigate to recommendation screen

**Screen 3: Recommendation** (`src/app/recommend/[merchantId]/page.tsx`)
- Ranked card list (best to worst)
- Each card: card name, reward rate display, explanation text
- Freshness indicator ("Rules last verified: X days ago")
- Disclaimer text
- "Wrong merchant?" / "Wrong category?" correction links

**Screen 4: Feedback/Correction** (`src/app/feedback/page.tsx`)
- Wrong merchant → search for correct one
- Wrong category → show category list, pick correct
- Corrections logged locally (localStorage) for Phase 3 admin review

---

## Phase 2: Rules Refresh Pipeline (Weeks 7–9)

### 2.1 — Rule Source Registry
**Table**: `rule_sources` — stores source URL, issuer, parser version, last run, last success

### 2.2 — Issuer-Specific Parsers
**Files**:
- `src/lib/parsers/chase.ts` — parses Chase card benefit pages; handles quarterly rotation
- `src/lib/parsers/amex.ts` — parses Amex rewards info pages; handles named merchant rules
- `src/lib/parsers/capital-one.ts` — parses Capital One card pages

Each parser: `fetch(sourceUrl) → ParsedRules[]`. Failures written to `parser_failures` table, not thrown.

### 2.3 — Refresh Orchestrator
**File**: `src/lib/refresh/orchestrator.ts`

8-step pipeline: fetch → parse → normalize → diff against current rules → write new/updated rules → write `rule_change_events` → update `rule_refresh_runs` → flag parser failures for admin review.

**Trigger**: Vercel Cron Job (`vercel.json` schedule: `"0 2 * * *"` — daily at 2am)

Manual trigger: `POST /api/admin/refresh` (admin-only, non-blocking — runs in background)

### 2.4 — Freshness UI
Add freshness warning to recommendation screen if `last_verified_at` > 7 days old. Show "stale rules" banner.

---

## Phase 3: Admin Console (Weeks 10–12)

### 3.1 — Auth Setup
Supabase Auth with email+password. Admin role stored in `users.role` column. Middleware protects `/admin/*` routes.

### 3.2 — Admin Screens (3 MVP screens)
**Files**: `src/app/admin/`

1. **Card Rule CRUD** (`/admin/rules`) — view all rules per card, edit rate/categories/dates, view source URL, mark as manually verified
2. **Merchant Mapping** (`/admin/merchants`) — search merchants, edit aliases, reassign categories, add new merchants
3. **Parser Monitoring + Feedback Queue** (`/admin/monitoring`) — view `parser_failures`, review `rule_change_events` (approve/reject diffs), review user feedback events (3-button triage: accept/reject/needs-review)

### 3.3 — Audit Logging
All admin writes: `rule_change_events` with `changed_by`, `changed_at`, `old_value`, `new_value`, `reason`.

---

## Verification Plan

### Phase 0 Gate (before writing any code)
- [ ] `data/categories.json` reviewed — correct enum, no duplicates
- [ ] `data/seed/cards.json` validates against `card.schema.json` for all 6 cards
- [ ] Scoring pseudocode covers all 7 edge cases listed in Task 0.5
- [ ] OpenAPI spec covers all 3 endpoints with full request/response schemas

### Phase 1 Gate
- [ ] `npm test` — all 25+ fixture scenarios pass
- [ ] `POST /api/recommend` returns correct top card for Whole Foods (Amex Gold or Chase Freedom depending on wallet)
- [ ] `GET /api/merchants/search?q=starbucks` returns Starbucks with `primary_category: DINING`
- [ ] Wallet UI: add Chase Sapphire Preferred → appears in card list
- [ ] Recommendation screen: shows freshness timestamp and disclaimer

### Phase 2 Gate
- [ ] Parser snapshot tests pass for all 3 issuers (mock HTML → expected ParsedRules[])
- [ ] Daily cron runs without error (check Vercel logs)
- [ ] Parser failure → written to `parser_failures`, does NOT crash recommendation engine
- [ ] Freshness warning appears after 7+ days

### Phase 3 Gate
- [ ] Admin login works; non-admin gets 403 on `/admin/*`
- [ ] Rule edit in admin console → reflected in next recommendation
- [ ] All admin writes appear in `rule_change_events`

---

## Critical Files (top priority)

| File | Why Critical |
|---|---|
| `data/seed/cards.json` | Ground truth for all reward rules; incorrect data = wrong recommendations |
| `data/seed/merchants.json` | Merchant matching; coverage = recommendation hit rate |
| `data/specs/scoring-algorithm.md` | Pseudocode all devs implement against; ensures consistent behavior |
| `src/lib/engine/recommend.ts` | Core business logic |
| `src/lib/engine/__tests__/recommend.test.ts` | Primary correctness verification |
| `supabase/migrations/001_initial_schema.sql` | DB foundation for all features |
| `src/app/api/recommend/route.ts` | Primary API endpoint |
