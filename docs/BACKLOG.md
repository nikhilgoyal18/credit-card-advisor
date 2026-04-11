# Credit Card Advisor — Feature Backlog

Status tracking for features built, in progress, and deferred. Updated as development progresses.

## Phase 1: Core App (COMPLETE)

| Feature | Status | Notes |
|---------|--------|-------|
| Data foundation (Phase 0) | `[ DONE ]` | Categories, cards (6), merchants (69), scoring spec, API contracts, validation schemas |
| Next.js scaffolding | `[ DONE ]` | pnpm create next-app + all dependencies installed |
| Supabase schema + RLS | `[ DONE ]` | 8 core tables, auth, row-level security, seed data |
| Email/password auth | `[ DONE ]` | Login, signup, session refresh middleware |
| Recommendation engine | `[ DONE ]` | Scoring algorithm, 11 Vitest fixtures (all 6 edge cases covered) |
| API: /api/recommend | `[ DONE ]` | POST merchant_id → ranked cards with caveats |
| API: /api/merchants/search | `[ DONE ]` | GET ?q= → fuzzy search with relevance sorting |
| UI: Auth screens | `[ DONE ]` | Login, signup forms (mobile-first) |
| UI: Home / Merchant Search | `[ DONE ]` | Search box, fuzzy results, real-time filtering |
| UI: Wallet | `[ DONE ]` | Add/remove/reorder cards, modal card picker |
| UI: Recommendation | `[ DONE ]` | Ranked card list, explanations, freshness, disclaimer |
| Mobile optimization | `[ DONE ]` | One-handed use throughout, responsive Tailwind CSS |

## Phase 2: Rules Refresh Pipeline (Backlog)

| Feature | Status | Notes |
|---------|--------|-------|
| Rule source registry | `[ BACKLOG ]` | DB table + UI |
| Chase parser | `[ BACKLOG ]` | Scrape quarterly categories + benefit pages |
| Amex parser | `[ BACKLOG ]` | Scrape merchant guidance + rewards pages |
| Capital One parser | `[ BACKLOG ]` | Scrape category descriptions |
| Refresh orchestrator | `[ BACKLOG ]` | 8-step pipeline: fetch → parse → normalize → diff → write → log |
| Vercel Cron trigger | `[ BACKLOG ]` | Daily 2am UTC refresh |
| Parser snapshot tests | `[ BACKLOG ]` | Mock HTML → expected rules |
| Parser failure handling | `[ BACKLOG ]` | Flag for admin, never remove existing rules |
| Freshness UI warning | `[ BACKLOG ]` | Banner if `last_verified_at` > 7 days |
| Manual refresh endpoint | `[ BACKLOG ]` | POST /api/admin/refresh (non-blocking) |

## Phase 3: Admin Console (Backlog)

| Feature | Status | Notes |
|---------|--------|-------|
| Admin auth role | `[ BACKLOG ]` | users.role column, middleware check |
| Card rule CRUD | `[ BACKLOG ]` | View, edit, mark manually verified |
| Merchant mapping editor | `[ BACKLOG ]` | Search, edit aliases, reassign categories |
| Parser monitoring | `[ BACKLOG ]` | View parser_failures, parser test results |
| Rule change diff review | `[ BACKLOG ]` | rule_change_events, approve/reject diffs |
| User feedback queue | `[ BACKLOG ]` | Review corrections, 3-button triage |
| Audit logging | `[ BACKLOG ]` | All admin writes logged with who/when/what |

## Future Enhancements (Backlog)

| Feature | Status | Notes |
|---------|--------|-------|
| Location-based nearby merchants | `[ BACKLOG ]` | Google Places API, graceful degradation if denied |
| Custom point valuations | `[ BACKLOG ]` | User can set point value > 1 cent (e.g., travel points worth 2 cpp) |
| Spend cap tracking | `[ BACKLOG ]` | Track bonus category spend, show blended rate when cap reached |
| Saved merchants | `[ BACKLOG ]` | Cache last 10 merchant searches, suggest by location |
| User feedback / correction flow | `[ BACKLOG ]` | "Wrong merchant?", "Wrong category?" links on recommendation |
| Transfer partner value modeling | `[ BACKLOG ]` | For cards with transfer partners (e.g., Chase UR, Amex MR) |
| Lounge benefit tracking | `[ BACKLOG ]` | For premium cards with lounge access |
| Multi-user device support | `[ BACKLOG ]` | Multiple wallets per device |
| Offline support | `[ BACKLOG ]` | Service worker caching, work without internet |
| App installation prompt | `[ BACKLOG ]` | "Install app to home screen" for PWA |
| Dark mode | `[ BACKLOG ]` | User preference toggle |
| Analytics | `[ BACKLOG ]` | Track recommendation sessions, card usage patterns |
| Onboarding UX | `[ BACKLOG ]` | Tutorial, card category explanation, example recommendations |

---

## Legend

- `[ PENDING ]` — Assigned to Phase 1, waiting to be started
- `[ IN PROGRESS ]` — Currently being built
- `[ DONE ]` — Shipped and working
- `[ BACKLOG ]` — Planned for future phase, not started
- `[ BLOCKED ]` — Waiting on something else (noted in context)
- `[ DEFERRED ]` — Explicitly decided not to build (noted in context)
