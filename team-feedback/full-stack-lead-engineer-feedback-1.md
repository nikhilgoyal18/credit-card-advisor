# Full-Stack Lead Engineer Review: Credit Card Points Advisor

**Reviewer:** Full-Stack Lead Engineer  
**Review Date:** April 10, 2026  
**Overall Score:** 6/10

---

## Summary

The PRD articulates a clear, well-scoped MVP for a card recommendation system that prioritizes zero-cost operation, deterministic logic, and user trust over automation. The design philosophy is sound—manual-first, rules-based scoring, and fallback paths for when automation fails. The architecture is appropriately simple for a solo MVP and positions well for future evolution. However, several critical gaps exist around data correctness, operational resilience, performance under realistic use, and testing strategy that must be addressed before building.

---

## Dimension Scores & Analysis

### 1. System Architecture: 7/10

**Strengths:**
- Clean separation between merchant detection, rules engine, and recommendation logic
- Proposal to externalize rules as JSON/database-backed definitions (not scattered conditionals) is excellent
- Thoughtful phasing from local-only → cloud sync → smart merchant resolution

**Gaps:**
- No architectural diagrams showing data flow, component boundaries, or failure modes
- Relationship between "merchants," "merchant_locations," and "merchant_aliases" is described conceptually but lacks implementation detail
- No clear story for how user-specific card edits integrate with shared catalog
- Admin interface mentioned but no separation of concerns described (Is it same codebase? Different auth layer?)

---

### 2. Frontend Quality: 6/10

**Strengths:**
- Clear emphasis on UX principles (one-handed mobile, speed, explainability)
- Rejects "gimmicky conversational UI"
- User feedback controls are structured, not free-text

**Gaps:**
- No component library, state management strategy, or error boundary approach documented
- How does the app behave when merchant lookup returns 0 results?
- What's the offline story?
- No mention of accessibility requirements
- Loading states and network error handling are expected but not detailed
- Feedback loop (user correction flow) lacks wireframe or interaction detail

---

### 3. Backend Quality: 5/10

**Strengths:**
- Recommendation engine specified as a pure, deterministic function—excellent for debuggability
- Rules engine decoupled from business logic

**Gaps:**
- No API contract specs. How does the frontend request a recommendation?
- Does it send card definitions or card IDs?
- What's the response envelope?
- No mention of input validation rigor
- What prevents a malicious user from crafting a card with a 1000x multiplier?
- No discussion of rate-limiting, auth, or multi-tenancy
- Admin API separate from user API? No versioning story for API changes

---

### 4. Data Flow & State Management: 5/10

**Strengths:**
- Core data model is documented with 12 entities and clear purposes
- Merchant aliasing as a separate concern is a solid design to handle messy real-world data

**Gaps:**
- State ownership is unclear: Does frontend cache merchant-to-category mappings?
- Does it sync user card edits back to the backend?
- What's the consistency model if admin edits a rule while a user is viewing results?
- When a user adds a custom card, what's the persistence boundary (local storage vs. cloud)?
- How are recommended scores invalidated when rules change?
- No discussion of eventual consistency or data freshness expectations

---

### 5. API Design: 4/10

**Strengths:**
- Recommendation result format is conceptually sound (ranked cards with explanations and confidence metadata)
- Example rule JSON structure is reasonable

**Gaps:**
- No API specification
- No request/response examples
- How to handle merchants not found in the database—placeholder response or "search failed" state?
- No error taxonomy
- What does the feedback submission API look like?
- How does admin API differ from user API in terms of permission checks?
- How are field types specified (e.g., is `cap_amount` in cents or dollars)?
- No versioning strategy

---

### 6. Performance & Scalability: 6/10

**Strengths:**
- 2-second recommendation latency is well-chosen and achievable with deterministic logic
- 3-second nearby merchant lookup is realistic
- Recognition that location lookup should not be on the critical path (manual fallback)

**Gaps:**
- No query performance analysis for the recommendation engine
- If a user has 20 cards and evaluates 50 category permutations per card, what's execution time?
- No caching strategy documented—should results be cached per user per merchant? How long?
- No mention of database indexing strategy for merchant searches
- Nearby merchant list pagination not discussed
- If app scales to 100k users, will current design handle batch rule updates without blocking reads?

---

### 7. Reliability & Resilience: 5/10

**Strengths:**
- Explicit recognition of graceful degradation: "should still function if location provider fails"
- Manual merchant search as fallback is solid practice

**Gaps:**
- What happens if merchant database is down?
- Does app show "try again" or cached recent merchants?
- If admin pushes a broken rule update (JSON syntax error), does it silently fail or block recommendations?
- How are rules validated on submission?
- If card catalog is stale by 3 months, users get wrong recommendations—freshness check or warning?
- No circuit breaker pattern or retry strategy documented
- No mention of what constitutes critical vs. recoverable failure

---

### 8. Security & Safety: 5/10

**Strengths:**
- Recognition of privacy as a non-functional requirement
- Avoidance of unnecessary location history logging

**Gaps:**
- No authentication/authorization strategy
- Can any user view any other user's wallet or feedback?
- How are admin endpoints protected?
- No input validation rules (e.g., valid card name, multiplier range, category name?)
- If user submits custom card with 10x multiplier on every category, is it accepted?
- No mention of SQL injection/NoSQL injection prevention in merchant search
- Feedback data could leak user patterns—anonymization?
- Reward rules contain business logic—data exfiltration risk if rules exposed?

---

### 9. Testing & Quality Assurance: 3/10

**Strengths:**
- Recommendation engine specified as a pure function—inherently more testable than imperative code
- Recognition of need for "robust seed dataset"

**Gaps:**
- No test strategy documented
- No test pyramid (unit/integration/e2e mix)
- Which critical paths must be covered?
- What are failure cases for recommendation engine (missing cards, negative multipliers, conflicting rules)?
- No mention of regression testing for rule changes
- How do you verify a rule update doesn't break existing recommendations?
- No staging environment or canary deployment strategy
- How are merchant alias changes validated before going live?
- No load testing or soak testing documented

---

### 10. Maintainability & Team Velocity: 6/10

**Strengths:**
- Clear intent to use modular structure (card-catalog, merchant-service, rules-engine, etc.)
- Phase-based rollout reduces upfront complexity
- Explicit call for "robust seed dataset and unit tests"

**Gaps:**
- No code organization or naming conventions documented
- Modular structure is suggested but not with example file paths or interfaces
- How does rules engine get updated in production?
- Hot-reload mechanism or full redeploy?
- Admin console mentioned but not scoped—separate app or embedded?
- How does new team member onboard to rules format and merchant taxonomy?
- No documentation for "how to add a new card to the catalog" or "how to fix a merchant alias"

---

## 🔴 Critical Issues

### 1. No Input Validation Strategy

The system accepts card rules from admins without a documented validation spec. A malicious or careless admin could create infinite multipliers, negative rates, or conflicting caps that either crash the engine or break rankings. This corrupts recommendation integrity at the source.

**Fix:** Define a strict schema for card rules (JSON Schema or zod). Validate all user and admin inputs at the API boundary. Log all admin changes with before/after diffs for audit.

---

### 2. Merchant Data Freshness Risk Unchecked

No mechanism to track or update when card reward rules become stale. The PRD acknowledges "reward rules become stale" as a risk but proposes only "use versioned rules, admin review, and source links" as mitigation. This is insufficient—there's no TTL, freshness check, or alert if a rule hasn't been reviewed in 90+ days.

**Fix:** Add a `last_reviewed_date` to each rule. Display a warning in admin console if any rule is older than 90 days. Prompt users if they're viewing a card with stale data.

---

### 3. No Clear Data Consistency Model for Multi-User/Admin Scenarios

If admin edits a rule while a user is browsing recommendations, does the user see old or new values? If two admins edit the same rule simultaneously, which wins? No mention of optimistic locking, versioning, or eventual consistency.

**Fix:** Define clear consistency boundary: recommendation results are timestamped with their rule version. Admin edits increment the version and take effect on next request. Document this as "strong consistency at recommendation time, eventual consistency for rule updates."

---

### 4. Recommendation Engine Edge Cases Not Specified

The algorithm (base rate + category bonus + merchant override + cap-adjusted value) is clear, but edge cases are missing:
- What if card has no rules for a category?
- What if cap is already exceeded (shows 0 value or warning)?
- What if two rules conflict (merchant-specific override vs. category default)?

This ambiguity will cause bugs.

**Fix:** Specify recommendation engine algorithm as pseudocode function with explicit handling for all edge cases. Test against fixture of 50+ scenarios including edge cases.

---

### 5. No Authentication/Authorization Architecture

Anyone with network access can likely submit feedback or view the admin console (if it's a web URL). No mention of how user wallets are protected or how admin operations are restricted.

**Fix:** Define an auth model: local-only (no shared backend), passwordless signup (Supabase Auth), or email+password. Require admin authentication with separate role/permission model. Document how JWT tokens or session IDs are managed.

---

### 6. Offline-First Storage Not Designed

The app must "function if the location provider fails" and work with "local-first mode" per the onboarding spec, but there's no design for how offline data syncs with the backend, conflict resolution, or what happens when user adds a card offline then signs up for cloud sync.

**Fix:** Define a sync model: local SQLite/IndexedDB + optional cloud, with clear rules for what happens during merge. Include a sync status indicator in the UI.

---

## 🟡 Significant Improvements

### 1. API Contract Specification Missing

Users of the recommendation endpoint won't know what fields to send or what they'll get back. The rules JSON example is helpful but insufficient.

**Action:** Generate OpenAPI/Swagger spec with request/response examples for:
- `POST /api/recommend` — with merchant ID/name and user card IDs
- `POST /api/feedback` — with structured feedback type, merchant, recommendation
- `GET /api/cards` — for card catalog
- `GET /api/merchants/search` — for merchant autocomplete
- `PUT /api/admin/rules/{card_id}` — for admin edits

---

### 2. Rules Schema Not Enforced at Build Time

The example JSON rule structure is helpful but not formalized. There's no TypeScript interface, JSON Schema, or schema validation library specified. This increases risk of silent failures when rules malform.

**Action:** Create formal `Card | Rule | Recommendation` type hierarchy. Use TypeScript or Zod for runtime validation. Include examples in codebase as fixtures.

---

### 3. Performance Testing Not Planned

2-second latency target is good, but how do you verify it? No mention of load testing the recommendation engine, database query performance for merchant search, or realistic data scale.

**Action:** Add performance test matrix: recommendation latency with 5/10/20 cards and 10k/100k merchants. Benchmark merchant search (exact match vs. fuzzy). Test with realistic rule complexity (5-10 categories per card with caps and overrides).

---

### 4. Feedback Loop Resolution Not Specified

Users can report "wrong merchant," "wrong category," "wrong card," but no process for how admin acts on this. Does a single report auto-correct? Does admin need confirmation? Can users see the fix?

**Action:** Define feedback workflow: user submits → admin review queue → approval → update effective date → user notification (if possible). Specify when feedback auto-corrects (high confidence) vs. requires review (low confidence).

---

### 5. Merchant Alias Resolution Algorithm Unclear

The PRD says "support normalization from noisy place names into a canonical merchant record" but doesn't specify how. Is it exact match? Levenshtein distance? A trie? Phonetic matching?

**Action:** Choose matching strategy: (a) exact match with fallback to fuzzy search, (b) normalized comparison (lowercase, trim, strip punctuation), or (c) ML-based embedding similarity. Document the choice with rationale.

---

### 6. Admin Console Scope Creep Risk

"Lightweight admin interface" is vague. What features does it have at MVP? Edit card rules only? Or also merchant aliases, feedback review, analytics, rule versioning? Each adds complexity.

**Action:** Define MVP admin features: (1) card rule CRUD with effective-date scheduling, (2) merchant alias management, (3) feedback review queue with 3-button triage (approve/reject/ignore). Defer: bulk operations, analytics dashboards, A/B testing.

---

## 🟢 Suggestions & Polish

### 1. Document the Confidence/Uncertainty Flag

The PRD mentions "attach explanation and confidence metadata" and "If merchant confidence is low, show confirmation prompt," but doesn't define what "confidence" means numerically (0.0–1.0? percentage?).

**Document this as:** `confidence = (rules_match_score * merchant_name_match_score * location_distance_score)` or similar.

---

### 2. Add a "Recommendation Explainability" Template

Define the exact text format for explanations. E.g.: "Using [Card Name] on [Merchant] → [Category] earns [Rate] points. [Secondary card] earns less because [reason]."

This ensures consistency and prevents vague explanations.

---

### 3. Merchant Category Taxonomy Should Be Immutable-by-Default

The PRD defines internal categories (grocery, dining, gas, pharmacy, travel, transit, office supply, wholesale club) but doesn't lock them down. If an admin renames "grocery" to "groceries," historic data becomes hard to query.

**Document categories as an enum, not editable strings.**

---

### 4. Clarify the "Custom Card" Workflow

Can a user add a card that isn't in the catalog? If so, is validation the same (no infinite multipliers)? Do custom cards auto-sync to cloud if user signs up for sync later?

**Add a small diagram showing local vs. shared vs. custom card flows.**

---

### 5. Seed Dataset Should Be Versioned

The PRD calls for a "robust seed dataset" with test cards and merchants. This should be version-controlled and auditable so test results are reproducible.

**Include it in the code repo as a `.json` file or SQL dump with a `-- version: 1.0` comment.**

---

### 6. Document the "Last Card Used" Convenience Feature

Users might want to reuse the card they selected last time they were at a merchant. This isn't mentioned in the PRD but is a common pattern.

**Either reserve space for it or explicitly exclude it from MVP.**

---

## ✅ What's Working Well

### 1. Zero-Cost Constraint as a Design Driver

Rather than assuming infinite API budgets, the PRD forces manual-first workflows (merchant search before location), fallbacks (no location → manual entry), and optional integrations (Google Places only if quota allows). This is a mature design philosophy.

### 2. Emphasis on Explainability Over Automation

The decision to use deterministic rules instead of LLM-based scoring is correct. It makes the system debuggable, auditable, and trustworthy. Users can verify the recommendation logic themselves.

### 3. Clear Phase-Based Rollout

Phase 1 (local-only) → Phase 2 (cloud sync) → Phase 3 (location) → Phase 4 (quality) reduces upfront risk. A solo builder can ship Phase 1 in weeks without worrying about backend complexity.

### 4. Data Model Separation (Merchants vs. Locations vs. Aliases)

Distinguishing between `merchants` (a Trader Joe's chain), `merchant_locations` (the specific store at 123 Main St), and `merchant_aliases` (how Google Maps calls it) is smart. It avoids duplicate data and makes category overrides clean.

### 5. User Feedback as a First-Class Data Source

Treating user corrections (wrong merchant, wrong category, wrong card) as structured learning signals rather than free-text complaints is excellent. This data fuels Phase 4 improvements.

### 6. Concrete Success Criteria for MVP

"60% of sessions without correction," "sub-10-second latency," "40% week-7 retention," "free-tier API usage"—these are specific, measurable, and shippable. Not vague.

---

## Next Steps (Highest Leverage)

### 1. Write the Recommendation Engine Pseudocode with All Edge Cases

Before any implementation, formalize the scoring algorithm. Include: what happens if cap is hit, if no rules exist for a category, if merchant is unmapped. This document becomes the source of truth for engineers and tests.

**Effort:** 2–4 hours | **Impact:** Prevents costly rework during implementation

---

### 2. Define the OpenAPI Spec for User and Admin APIs

Specify exact request/response contracts for recommendation, feedback, card CRUD, and merchant search. Include HTTP status codes and error taxonomies.

**Effort:** 4–6 hours | **Impact:** Unblocks frontend and backend teams working in parallel

---

### 3. Design the Input Validation Schema (TypeScript/Zod)

Create a formal schema for Card | Rule | Merchant | Feedback objects. Include valid ranges (e.g., multiplier ≥ 0.1 and ≤ 100, cap amount in cents, category must match enum, etc.). Use this as the contract for both client and server.

**Effort:** 2–4 hours | **Impact:** Eliminates silent bugs from malformed data

---

### 4. Create a Rules Versioning and Sync Design Doc

Specify how rule updates roll out (effective-date-based? version-based?), how clients fetch new rules, and how stale rules are handled. Include a diagram showing admin edit → rule update → user sees new data.

**Effort:** 3–4 hours | **Impact:** Prevents consistency bugs in Phase 2+

---

### 5. Build a Minimal Test Fixture Library (Seed Data)

Create 20–30 representative test scenarios: normal merchants, edge cases (cap exceeded, no rules, conflicting rules), and error cases (merchant not found, bad rules). Codify these as JSON fixtures. This becomes the regression test suite.

**Effort:** 4–6 hours | **Impact:** Enables fast, reliable testing throughout development

---

## Overall Assessment

**Score: 6/10**

**Justification:**

The PRD is strategically sound and well-scoped. The emphasis on deterministic logic, zero-cost operation, user trust, and phased rollout demonstrates good product judgment and system thinking. However, the design lacks the operational and technical rigor needed to implement reliably.

**Critical gaps in validation, consistency models, API contracts, and testing strategy will cause implementation rework and bugs.** The architecture is right, but the specification is incomplete. Before building, you need:
- Formal API contracts (OpenAPI spec)
- Input validation rules (schema)
- Recommendation engine pseudocode (all edge cases)
- Rules versioning/sync design
- Test fixture strategy

With these five documents, the implementation becomes straightforward and low-risk. Without them, a solo builder will hit ambiguity-driven rework that delays launch and erodes confidence in the system.

**Why not 7/10?**

Because the system hasn't been built yet, the assumption that the architecture holds under real traffic, real data, and real user patterns is unvalidated. The PRD is an excellent plan, but plans change when they meet reality.

**Why not 5/10?**

Because the strategic choices (manual-first, rules-based, modular phases) are sound, and the non-functional requirements (cost, latency, explainability) are well-grounded in user value.
