# AI Engineer Review: Zero-Budget Credit Card Advisor

**Reviewer:** Senior AI Engineer / Tech Lead  
**Review Date:** April 10, 2026  
**Overall Score:** 6/10

---

## Executive Summary

This is a **pre-implementation project** at the planning stage with a comprehensive PRD but no shipping code yet. The project demonstrates strong planning discipline: a detailed product requirements document, thoughtful zero-cost architecture constraints, and an honest acknowledgment of AI's limited role (deterministic rules engine, not core decision logic). However, the absence of any implementation code means there are no LLM integration patterns, prompts, or architecture decisions to evaluate. The critical question is not "is this well-built?" but "is this plan realistic for solo execution?"

---

## Dimension Scores

| Dimension | Score | Notes |
|---|---|---|
| 1. Architecture & Design | 7/10 | Thoughtful, modular plan; zero-cost constraint is well-reasoned but execution risk is high. No code to validate assumptions. |
| 2. LLM Integration Quality | N/A | No LLM integrations in scope for MVP. Plan explicitly states "rules before AI." |
| 3. Prompt Engineering | N/A | No prompts present or planned for MVP. |
| 4. RAG Pipeline | N/A | No RAG architecture planned. |
| 5. Agent Architecture | N/A | No agents in MVP scope. |
| 6. Reliability & Error Handling | 6/10 | Plan identifies key failure modes but provides no implementation strategy, testing approach, or observability blueprint. |
| 7. Observability & Evaluation | 5/10 | Metrics defined abstractly; no evaluation harness, test fixtures, or seed data structure documented. |
| 8. Code Quality & Maintainability | 5/10 | Recommended modular structure but not validated by actual code. No test strategy, CI/CD plan, or local dev setup described. |
| 9. Security & Safety | 7/10 | Privacy-first thinking (minimal location history, PII awareness), but no threat model, input validation specs, or authorization boundaries defined. |
| 10. Scalability & Cost | 8/10 | Zero-cost constraint is the north star; smart avoidance of Plaid, Mastercard Places, geofencing. Risk is scope creep pushing toward paid APIs. |

---

## 🔴 Critical Issues

### 1. No implementation and risk of feature creep

The plan is ambitious for solo execution: card catalog, merchant aliasing, geolocation integration, admin console, feedback loops, versioning.

**Risk:** Trying to ship all of Phase 1 at once instead of truly MVP-first (manual merchant search only, no location, no feedback loop, no admin UI).

**Recommendation:** Phase 1 should be *"user enters merchant name manually, sees ranked card list, no external APIs"* before adding anything else.

### 2. Merchant normalization strategy is underspecified

The PRD references "merchant aliasing" as a core de-risking mechanism but provides no algorithm, no seed data, no fuzzy matching spec, and no evaluation criteria.

**Risk:** First user testing will reveal that "Trader Joe's" → "Trader Joe's #1234" → "Whole Foods / Grocery" mapping is much harder than hardcoding. How will you scale this?

**Recommendation:** Before code, build a merchant test dataset (50–100 real merchant names from Amex/Chase statements) and design the normalization logic as a separate module with unit tests.

### 3. Recommendation scoring logic is vague

The PRD describes the scoring model at a high level but leaves critical details unspecified:
- How are category multipliers applied when a merchant maps to multiple categories? (e.g., Costco is both "grocery" and "warehouse club")
- How is "cap-adjusted value" computed? (e.g., if a user has hit the $25k cap on a 4x grocery card for the year, what value does it return?)
- What is the tiebreaker when two cards have identical expected value?

**Risk:** Ambiguity in the spec will lead to inconsistent implementation, failed tests, and user confusion.

**Recommendation:** Write the scoring algorithm as pseudocode or a TypeScript function signature *before* starting the UI. Include test cases for edge cases (tied scores, caps exceeded, single card, no cards).

### 4. No test strategy or local dev setup described

PRD mentions "robust seed dataset and unit tests" but provides no examples, test fixtures, or development workflow.

**Risk:** Without a clear testing path, the recommendation engine will be tested only via manual UI clicks, which is slow and unreliable.

**Recommendation:** Define a test structure upfront: unit tests for the scoring function, a small JSON seed of 20 test cards and 50 test merchants, and a CI workflow (GitHub Actions or similar) that runs tests on every push.

### 5. Admin console scope and security unclear

PRD says "protected admin interface" but provides no authentication mechanism, permission boundaries, or audit logging spec.

**Risk:** If admin routes are just a frontend toggle, anyone can edit card rules. If Supabase auth is added "later," initial testing will use weak auth.

**Recommendation:** Define admin access upfront: Is it passwordless email link? Hardcoded token for MVP? Supabase row-level security rules? Document before code.

---

## 🟡 Significant Improvements

### 1. Evaluation harness missing

The PRD lists product and quality metrics but provides no harness, baseline data, or acceptance test suite.

**Current state:** "success is 60% of sessions without correction" but no way to measure this until product is live.

**Suggestion:** Build a test suite of 50 real-world scenarios before launch (e.g., "User has 3 cards, is at Whole Foods, Amex Gold with 4x grocery should rank first"). This will catch scoring bugs early and give you confidence before user testing.

### 2. Card catalog seed data is absent

PRD says "preloaded card catalog" but doesn't specify the starting set (25, 50, 100?), format, or examples.

**Risk:** First implementation will hard-code 10 cards in JSON, then struggle to add the next 40 as features.

**Suggestion:** Define a card schema in JSON or SQL, populate it with 10 high-value cards (Amex Gold, Chase Sapphire, Capital One, Discover, etc.), and store it in a version-controlled seed file. Make it swappable (database vs. hardcoded) from day one.

### 3. Feedback loop logic is loose

PRD mentions "user feedback" but the flow is undefined: Is feedback immediate or requires admin review? How does it update recommendations? Is it stored in client-side state or sync'd to backend?

**Current state:** Suggests it can be a "structured learning signal" but doesn't say what "structured" means.

**Suggestion:** For MVP, keep feedback simple: store corrections as JSON events in local storage (offline-first), disable syncing to backend until Phase 2. Example: `{ event: "wrong_merchant", original: "Walmart", corrected_to: "Whole Foods", timestamp, card_id }`.

### 4. No mention of merchant categorization rules

PRD defines categories (grocery, dining, gas, etc.) but doesn't say who assigns each merchant to categories, how conflicts are resolved, or whether multi-category mapping is allowed.

**Suggestion:** Start with a fixed set of ~10 merchants, hand-assign them to single categories, and test the sorting logic. Expand to multi-category and merchant overrides in Phase 2 after you understand the data.

### 5. Location permission and fallback handling not specified

PRD says "request only when needed" and "degrade gracefully" but provides no decision tree, prompt copy, or data flow diagram.

**Suggestion:** Write the decision tree before code:
```
1. App loads → location disabled (default)
2. User clicks "use my location" → request geolocation
3. Permission granted → fetch nearby merchants
4. Permission denied or timeout → show manual search
5. Both flows converge to merchant picker
```

### 6. No description of data persistence strategy

PRD mentions local-first with optional Supabase but doesn't specify:
- What data is local (cards, settings) vs. synced (card catalog, merchant aliases)?
- How is conflict resolution handled if user edits a card offline then comes online?
- What happens to feedback events if sync fails?

**Suggestion:** Choose one for MVP: either pure local storage (simplest) or Supabase + local cache with sync on open (medium). Document which one in a IMPLEMENTATION.md file before code.

---

## 🟢 Suggestions & Polish

### 1. Break Phase 1 into smaller checkpoints

**Current:** One big "local-only prototype" phase.  
**Suggest:** (a) Card input & wallet display (no recommendations), (b) Merchant search (no geolocation), (c) Scoring logic (unit tests only), (d) Recommendation UI, (e) Feedback capture.

**Benefit:** Each checkpoint is shippable and testable independently.

### 2. Create a "DECISIONS.md" file

Document every trade-off: Why Supabase over Firebase? Why manual merchant search first? Why no geofencing? This will help you reason about future pivots.

### 3. Consider a "KNOWN_LIMITATIONS.md" for users

Be transparent upfront: "This MVP doesn't sync to bank accounts," "Reward rules are updated manually," "Merchant detection may be wrong for new stores." Builds trust and sets expectations.

### 4. Design the rules JSON schema early

**Current:** Example shows one structure but no discussion of versioning, effective dates, or how to represent rotating categories or enrollment flags.

**Suggestion:** Write a TS/Python TypeScript definition or Pydantic model for the rule schema, store it in version control, and use it to validate edits in the admin console.

### 5. Plan for merchant alias conflicts

What if two chains have the same name (e.g., "CVS" is a pharmacy, "CVS Pharmacy" is the same)? What if a merchant name changes (e.g., "Whole Foods" → "Whole Foods Market")?

**Suggestion:** Add a `canonical_merchant_id` field to the alias table and document the uniqueness constraint.

### 6. Add a README section on running tests locally

Provide a quick start: `npm test` or `python -m pytest` should run the scoring logic tests without API calls.

### 7. Consider reward currency normalization upfront

PRD mentions "cash-equivalent scoring" but doesn't say how to convert points to dollars (e.g., Amex MR, Chase UR, Citi TY, Discover Cashback).

**Suggestion:** Add a `point_value_cents` field to the card schema (default 1) and let users override it. This is simpler than a complex points-to-currency mapping system.

---

## ✅ What's Working Well

**1. Zero-cost constraint is non-negotiable and thoughtful**  
Explicitly avoiding Plaid, Mastercard Places, and geofencing APIs shows product maturity. Most solo builders would default to "paid APIs are fine for MVP"; this team knows better. Trade-off: Merchant normalization is harder without Plaid, but solved via aliasing + manual search. Good choice.

**2. Deterministic recommendation engine, not LLM**  
PRD correctly observes that "determinism makes debugging, testing, and trust much easier" and reserves LLM only for content generation. This prevents prompt injection, reduces costs, and makes the product transparent. Best decision in the PRD.

**3. Modular phase plan**  
Phase 1 (local-only) → Phase 2 (cloud sync) → Phase 3 (geolocation) → Phase 4 (data quality) is realistic and deferral-focused. Shows understanding of risk and MVP sequencing.

**4. User feedback as a core loop**  
Instead of assuming the scoring logic is correct, the PRD treats user corrections as signals for improvement. Merchant corrections ("wrong category," "wrong merchant") are especially valuable for calibrating the alias table.

**5. Clear acceptance criteria for MVP success**  
"60% of sessions without correction," "under 10 seconds," "40% day-7 retention," "stay within free API limits." These are measurable and realistic. Good product discipline.

**6. Privacy-first approach**  
Explicit decision to minimize location history and avoid PII in logs. Shows awareness of regulatory and user-trust risks.

**7. Honest about scope and team**  
PRD repeatedly acknowledges this is a solo MVP: "single builder," "avoid upfront scope," "ship manual-first." This self-awareness is rare and a sign of good judgment.

---

## Next Steps

### 1. Build the scoring function first, as a pure function with unit tests

Write the recommendation algorithm in TypeScript or Python (not in the UI).

**Start with 5 test cases:**
- (a) one card wins clearly
- (b) two cards tied
- (c) cap exceeded
- (d) no cards match
- (e) all cards have same rate

This is the foundation for everything else. Get it right before UI.

### 2. Create a card catalog seed with 15–20 real cards and a JSON schema

**Include:** Chase Sapphire Preferred, Amex Gold, Capital One 360, Discover It, Chase Freedom Flex, etc.

**Define schema:** `{ card_id, issuer, name, base_rate, categories: [{ name, multiplier, cap }] }`.

**Version control it.** This will be your ground truth.

### 3. Define the merchant categorization strategy and hand-assign 50 test merchants

Create a seed CSV: `merchant_name, canonical_name, category, confidence`.

**Examples:** `"Trader Joe's", "Trader Joe's", "grocery", "high"` | `"Starbucks", "Starbucks", "dining", "high"`.

Use this for all unit tests and early UI testing.

### 4. Write IMPLEMENTATION.md with decision tree for data persistence

Decide: Pure local storage (localStorage + IndexedDB) or Supabase+local cache?

Document the choice, sync strategy, and conflict resolution.

This unlocks the backend/sync work in Phase 2.

### 5. Sketch the admin console schema

Mock 3 screens: (a) Card rule editor, (b) Merchant alias editor, (c) Feedback review queue.

Define the data model for each (e.g., what fields can an admin edit on a card rule?).

Don't build it yet, but nail the data model so Phase 2 doesn't surprise you.

---

## Overall Assessment

**Score: 6/10**

This is a **well-thought-out product plan with strong product discipline, thoughtful zero-cost constraints, and realistic scope for solo execution.** However, it remains a plan. Without implementation, testing strategy, seed data, or architecture code (scoring function, schema definitions, test fixtures), the actual engineering quality is unproven. The plan's biggest risks — merchant aliasing at scale, recommendation scoring correctness, and feature creep — are not yet validated.

A 6/10 reflects **"promising plan with clear next steps"** rather than **"ready to ship"** or **"already shipping."** Execution on Steps 1–3 above (scoring function, card catalog, merchant seed data) will likely raise this to 8+/10. Failure to validate those foundations before UI work will push it down.
