# Product Requirements Document: Zero-Budget Credit Card Advisor

## Overview

This document defines the product requirements for a zero-budget application that recommends which of a user’s existing credit cards to use at a specific store in order to maximize rewards. The product is intentionally scoped so a single builder can implement it using Claude Code and free-tier infrastructure, while deferring paid APIs, bank-grade integrations, and enterprise data partnerships until there is proven user value. [developers.google](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)

The core product idea is simple: detect or let the user select a merchant, map that merchant to a normalized category, evaluate the reward rules for the cards in the user’s wallet, and recommend the highest-value card with a short explanation. The product should optimize for accuracy, trust, low operational complexity, and zero mandatory spend. [developers.google](https://developers.google.com/maps/documentation/places/web-service/place-types)

## Product vision

The product should become a lightweight personal “wallet brain” that helps users capture more value from the cards they already own without requiring them to memorize category bonuses, quarterly activations, or merchant exceptions. The initial version should prioritize explicit user control and transparent logic over full automation because low-cost merchant detection will be imperfect and reward-rule drift is a major trust risk. [plaid](https://plaid.com/docs/enrich/)

The long-term vision is a recommendation engine with merchant intelligence, user-level preferences, and eventually transaction feedback loops. However, the first release should be intentionally narrow: manual card setup, merchant lookup, category mapping, and deterministic ranking logic that a user can inspect and correct. [developers.google](https://developers.google.com/maps/documentation/places/web-service/place-types)

## Problem statement

Credit card rewards are fragmented across issuers, card products, rotating categories, merchant-specific offers, and spend caps. Most users cannot remember the optimal card for each purchase context, especially when several cards have overlapping bonus structures. [developer.visa](https://developer.visa.com/products/merchant_search)

Existing wallet and banking apps usually show balances and transactions, but they do not reliably answer a context-specific question such as “I am at Trader Joe’s right now; which card should I use?” A useful solution must combine location or merchant input, merchant/category normalization, and card-specific reward logic in one fast recommendation flow. [plaid](https://plaid.com/docs/enrich/)

## Goals

- Help a user choose the best card for an in-store purchase in under 5 seconds after opening the app.
- Require zero mandatory infrastructure spend for MVP launch.
- Avoid paid financial-data integrations in the first version.
- Make every recommendation explainable with plain-language reasoning.
- Allow the user to override or correct the merchant and category when the app is uncertain.
- Support iterative implementation through Claude Code with simple, modular architecture.

## Non-goals

- Automatic syncing of every user card account through paid aggregators in MVP.
- Real-time issuer-verified rewards and offers ingestion in MVP.
- Background geofencing or high-frequency location polling that may increase platform complexity.
- Full optimization across online purchases, travel portals, transfer partners, lounge benefits, or annual-fee economics in the first release.
- Enterprise-grade fraud, underwriting, lending, or credit-decisioning features.

## User segments

### Primary user

The primary user is an optimization-oriented US credit card holder who already understands basic rewards programs and has multiple cards in their wallet. This user is willing to manually enter cards if the payoff is clear and trusts products that show reasoning rather than opaque “AI” recommendations. [developer.visa](https://developer.visa.com/products/merchant_search)

### Secondary user

A secondary user is a casual rewards user with two to four cards who wants a quick answer without learning category details. This user benefits most from simple UX such as “Use Card X here because this merchant maps to grocery and your card earns 4x on grocery.” [developers.google](https://developers.google.com/maps/documentation/places/web-service/place-types)

## Product principles

- **Zero-cost first:** every core dependency must have a workable free path or be replaceable with self-hosted logic.
- **Trust over automation:** recommendation explanations matter as much as the ranking itself.
- **Manual fallback always available:** merchant search and card setup must work even if location is denied.
- **Rules before AI:** deterministic scoring should power recommendations; AI can assist content generation and coding, not core scoring.
- **Human-correctable system:** users and admins must be able to fix card rules, merchant mappings, and valuations.

## MVP scope

The MVP should ship with the following capabilities:

- User account or passwordless local profile.
- Manual card entry from a preloaded card catalog and optional custom card entry.
- Current-location lookup with a nearby merchant list.
- Merchant name search as a no-location fallback.
- Merchant-to-category mapping.
- Rules engine that ranks all user cards for the selected merchant.
- Plain-language explanation of why one card wins.
- User feedback controls such as “wrong merchant,” “wrong category,” or “wrong recommendation.”
- Lightweight admin interface to edit card rules and merchant aliases.

The MVP should not depend on Plaid or other paid aggregators. Plaid offers free sandbox testing and limited production allowances, but live usage is still usage-priced, so it should be postponed until the product proves retention and recommendation quality. [plaid](https://plaid.com/pricing/)

## User stories

### Core usage stories

- As a user, when I open the app at a store, I want to see likely nearby merchants so I can quickly choose where I am.
- As a user, after selecting a merchant, I want the app to rank my saved cards by expected reward value.
- As a user, I want to see why a card was recommended so I can trust the result.
- As a user, I want to edit or add cards manually so I do not need bank connectivity.
- As a user, I want to correct the merchant or category if the app guessed wrong.

### Admin stories

- As an admin, I want to edit a card’s reward rules without redeploying the app.
- As an admin, I want to view recommendation errors and user corrections to improve mappings.
- As an admin, I want to add merchant aliases so common merchant name variants resolve correctly.

## Jobs to be done

- When making a purchase in a physical store, help determine the best card to use right now.
- When building a wallet strategy, help a user understand which cards are best in which merchant categories.
- When the system is uncertain, help the user resolve ambiguity with minimal friction.

## Functional requirements

### Card wallet management

The system shall allow users to add cards from a predefined catalog. Each catalog card record shall include issuer, network, card name, reward currency, base earn rate, category bonus rules, spend caps, activation requirements, and notes on known exclusions.

The system shall allow custom card creation so users can define cards not in the shared catalog. The system shall allow editing, reordering, activating, and archiving cards in the user wallet.

### Merchant detection and search

The system shall request location permission only when needed and gracefully degrade if location is denied. If location is available, the system shall retrieve nearby merchants using a free-tier map or places service and display a ranked shortlist. [developers.google](https://developers.google.com/maps/billing-and-pricing/pricing)

The system shall allow manual merchant search by name, because location-only flows are fragile in malls, airports, and dense retail zones. The system shall support user confirmation before a recommendation is finalized. [developers.google](https://developers.google.com/maps/documentation/places/web-service/place-types)

### Merchant normalization

The system shall store merchant entities separately from merchant locations and aliases. A merchant alias table shall support normalization from noisy place names into a canonical merchant record.

The system shall map merchants to one or more internal reward categories such as grocery, dining, gas, pharmacy, travel, transit, office supply, and wholesale club. The system shall support merchant-level overrides where a specific chain behaves differently from the default category.

### Recommendation engine

The system shall evaluate all active user cards against the selected merchant and return a ranked list. The default ranking formula shall use estimated cash-equivalent value based on base reward rate, category multiplier, merchant-specific boost, spend-cap status, and optional user-defined point valuations.

The system shall generate an explanation object for each recommendation, including matched category, applied multiplier, excluded cards, and uncertainty flags. If merchant confidence is low, the system shall show a confirmation prompt rather than pretending certainty. [developer.visa](https://developer.visa.com/products/merchant_search)

### Feedback and correction

The system shall allow users to report “wrong merchant,” “wrong category,” “wrong card,” and “missing card rule.” The system shall log each correction so the admin can review it in the dashboard.

### Admin tooling

The system shall include a protected admin interface for managing card rules, merchant aliases, category mappings, and user feedback review queues. The admin interface shall allow rule versioning with effective dates to reduce reward-rule drift risk.

## Non-functional requirements

### Cost

The production MVP shall run at zero mandatory monthly cost. This means the chosen stack must fit within free tiers or self-hosted development workflows. Google Places and related Maps services are not truly free forever, even though they offer free monthly usage and quota controls, so the architecture must treat them as optional or swappable rather than foundational to the business model. [developers.google](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)

### Performance

The app should return a recommendation in under 2 seconds after merchant selection on a normal mobile connection. Nearby merchant search should complete in under 3 seconds under normal conditions.

### Reliability

The system should still function if the location provider fails, by falling back to manual merchant search and cached recent merchants. Core recommendation logic should be executable entirely from local business rules once a merchant is selected.

### Explainability

Every recommendation shall include enough detail for a user to verify the logic. The app must never output a bare recommendation without a rationale.

### Privacy

The system shall minimize storage of raw location history. It should store only the merchant selections and coarse analytics needed to improve the product unless the user explicitly opts into richer telemetry.

## Detailed feature requirements

## Feature 1: Onboarding

The onboarding flow should explain the product in one screen, ask whether the user wants a lightweight local-only setup or a cloud-synced account, and then immediately move to wallet setup. To preserve the zero-budget requirement, local-first mode should be the default, with optional sign-in added only if a free backend is being used.

Acceptance criteria:

- User can complete onboarding in under 2 minutes.
- User can skip location permission during onboarding.
- User is prompted to add at least one card before accessing recommendations.

## Feature 2: Wallet setup

The wallet setup flow should let the user search a starter card catalog and add cards with one tap. Each card detail screen should show category bonuses, known caps, and editable assumptions such as cents-per-point valuation.

Acceptance criteria:

- User can add, edit, archive, and reorder cards.
- Custom card entry is available if a card is missing.
- Validation prevents impossible rates or malformed rules.

## Feature 3: Merchant picker

The merchant picker should support two entry modes: “Use my location” and “Search merchant manually.” If the location path is chosen, the app should request current location, call the place provider, and display a shortlist of nearby merchants with distance and category hints. [developers.google](https://developers.google.com/maps/billing-and-pricing/pricing)

Acceptance criteria:

- If location is denied, manual search remains fully usable.
- Nearby merchants are shown with enough context to disambiguate similarly named businesses.
- User can confirm or change the merchant before recommendation.

## Feature 4: Recommendation results

The result screen should show the top recommended card first, the expected reward rate or estimated value, and a concise explanation. Secondary cards should appear underneath with reasons they ranked lower.

Acceptance criteria:

- Top recommendation appears with human-readable explanation.
- Secondary cards are ranked and expandable.
- Uncertainty state appears when merchant confidence is low.
- User can flag bad output directly from the screen.

## Feature 5: Feedback loop

The app should convert user corrections into structured learning signals. For example, if many users change “Walmart Neighborhood Market” from discount store to grocery, the admin should see that pattern.

Acceptance criteria:

- Feedback types are structured, not just free text.
- Admin can triage open feedback items.
- Accepted fixes update future recommendations.

## Feature 6: Admin console

The admin console should be simple and utilitarian. It should include card catalog management, merchant alias editing, reward rule versioning, and feedback review.

Acceptance criteria:

- Admin can edit a card rule and set an effective date.
- Admin can map or remap merchant aliases to canonical merchants.
- Admin can inspect a recommendation trace for debugging.

## Core data model

The minimum schema should include the following logical entities:

| Entity | Purpose |
|---|---|
| users | User identity or local profile metadata |
| cards | Shared card catalog |
| user_cards | Cards the user has added |
| reward_rules | Versioned earn-rate and category logic |
| reward_caps | Spend caps and time windows |
| merchants | Canonical merchant entities |
| merchant_locations | Store-level locations |
| merchant_aliases | Name normalization and fuzzy matches |
| merchant_categories | Internal reward categories |
| merchant_category_map | Merchant-to-category mapping |
| recommendations | Stored recommendation events |
| feedback_events | User correction and quality signals |
| admin_audit_logs | Admin changes and traceability |

The schema should separate chain-level merchant identity from physical locations because a chain can have many stores and some reward logic may differ by merchant or location. Merchant aliasing is critical because third-party place names are often messy. [developer.visa](https://developer.visa.com/products/merchant_search)

## Recommendation logic

The recommendation engine should be deterministic and implemented as a pure function over user wallet data, merchant data, and rule data. This is better than using an LLM in the decision loop because determinism makes debugging, testing, and trust much easier.

A recommended scoring model for MVP is:

1. Resolve merchant.
2. Resolve reward category.
3. For each active user card, compute:
   - base reward value;
   - category bonus value;
   - merchant-specific override value;
   - cap-adjusted value;
   - user-defined point valuation multiplier.
4. Rank descending by expected cash-equivalent value.
5. Attach explanation and confidence metadata.

The formula should use cash-equivalent scoring rather than raw points so cards with different reward currencies can still be compared in one list. Users who do not care about custom point valuations should be able to keep a simple default such as 1 cent per point.

## Rules engine design

The rules engine should not be embedded as scattered conditionals in frontend code. It should read from structured JSON or database-backed rule definitions so card logic can be edited without code changes.

A sample rule object should include:

```json
{
  "card_id": "amex_gold",
  "effective_start": "2026-01-01",
  "base_rate": 1,
  "reward_currency": "mr_points",
  "categories": [
    {
      "category": "grocery",
      "multiplier": 4,
      "cap_amount": 25000,
      "cap_period": "year"
    },
    {
      "category": "dining",
      "multiplier": 4
    }
  ],
  "merchant_overrides": [],
  "notes": "Sample structure only"
}
```

The system should support future rule types such as rotating categories and enrollment flags, even if the MVP does not expose all of them in the UI.

## Metrics

### Product metrics

- Weekly active users
- Recommendation requests per active user
- Recommendation acceptance rate
- Merchant correction rate
- Category correction rate
- Card correction rate
- Day 7 and day 30 retention

### Quality metrics

- Merchant resolution confidence
- Recommendation latency
- Recommendation disagreement rate
- Rules freshness coverage, meaning percentage of active cards reviewed in the last 90 days

### Cost metrics

- Place API requests per active user
- Monthly external API calls
- Percentage of recommendation requests served from manual merchant entry versus external lookup

## Success criteria for MVP

The MVP should be considered successful if it achieves the following within the first testing cohort:

- At least 60 percent of recommendation sessions end without user correction.
- Median time from app open to recommendation is under 10 seconds.
- At least 40 percent of weekly active users return in the next week.
- External API usage remains inside free limits or can be disabled without breaking the product.

## UX requirements

The UX should optimize for one-handed mobile use. The primary screen should have one dominant call to action: identify merchant. After merchant selection, the recommendation should appear immediately with a clear winner and a short explanation.

The app should avoid gimmicky conversational UI in the MVP. A card recommendation app benefits more from certainty, structure, and speed than from chatbot interaction.

## Suggested zero-budget stack

| Layer | Recommended choice | Why |
|---|---|---|
| Frontend | React Native with Expo or Next.js PWA | Large ecosystem, easy Claude Code support, fast MVP build |
| Backend | Supabase free tier or local-first with SQLite/IndexedDB | Free starting point with auth/database options if cloud sync is needed. [wearefounders](https://www.wearefounders.uk/supabase-pricing-2026-every-tier-explained-for-indie-hackers/) |
| Database | Supabase Postgres or SQLite | Simple relational model for rules and merchants. [wearefounders](https://www.wearefounders.uk/supabase-pricing-2026-every-tier-explained-for-indie-hackers/) |
| Auth | Supabase Auth free tier or no-auth local profile | Avoids paid identity tooling. [wearefounders](https://www.wearefounders.uk/supabase-pricing-2026-every-tier-explained-for-indie-hackers/) |
| Merchant lookup | Manual search first, optional Google Places within quota | Keeps product usable without paid dependency. [developers.google](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing) |
| Admin UI | Same web app behind admin route | Zero extra deployment surface |
| Hosting | Vercel/Netlify/Cloudflare free tier | Good enough for MVP static/web workloads |
| Analytics | PostHog free tier self-hosted later or simple event logs | Keep instrumentation lightweight |

A progressive web app may be the best zero-budget starting point because it avoids App Store friction and still supports location, installability, and rapid iteration. A React Native app is stronger for long-term native UX, but a PWA is cheaper operationally and faster to ship.

## APIs and services: what to use and what to avoid

### Recommended for MVP

- Browser geolocation or mobile geolocation APIs.
- Manual merchant search backed by an internal merchant table.
- Optional Google Places only if capped tightly and used as a convenience layer rather than a hard dependency. [developers.google](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
- Supabase free tier only if cloud sync is needed. [wearefounders](https://www.wearefounders.uk/supabase-pricing-2026-every-tier-explained-for-indie-hackers/)

### Avoid for MVP because they break the zero-budget constraint

- Plaid production integrations, because live usage is usage-priced even though testing is free and limited production exists. [plaid](https://plaid.com/pricing/)
- Mastercard Places and Visa merchant products, because they are partner-oriented and not realistic for a no-cost solo MVP. [mastercardservices](https://www.mastercardservices.com/en/capabilities/places)
- Any background location or geofencing service with metered billing.

## Claude Code implementation guidance

Claude Code should be used as the implementation accelerator, not the product brain. The build should be broken into modules so Claude can generate, test, and refine pieces independently:

1. `card-catalog` module for card definitions.
2. `merchant-service` module for search, aliasing, and normalization.
3. `rules-engine` module for deterministic scoring.
4. `recommendation-api` module for result composition.
5. `admin-console` module for editing and debugging.
6. `analytics` module for event capture.

The codebase should include a robust seed dataset and unit tests for reward rules. The highest-value engineering work is not UI polish but correctness of merchant normalization and scoring.

## Development phases

### Phase 1: Local-only prototype

Build a PWA with no backend, local storage only, manual card setup, manual merchant search, and deterministic recommendation logic. This proves the card ranking experience before any cloud complexity is added.

### Phase 2: Lightweight cloud sync

Add Supabase for shared card catalog, optional user sync, admin tooling, and analytics. Keep recommendation logic mostly unchanged.

### Phase 3: Smarter merchant resolution

Add optional location-based nearby merchant lookup through Google Places, with strict quotas and a manual fallback. Only continue using it if real users find the speed gain meaningful enough to justify the dependency. [developers.google](https://developers.google.com/maps/billing-and-pricing/pricing)

### Phase 4: Data quality improvements

Add feedback review workflows, merchant alias learning, rule versioning, and more complete card catalog coverage.

## Risks and mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Reward rules become stale | Incorrect recommendations destroy trust | Use versioned rules, admin review, and source links |
| Merchant detection is wrong | Wrong merchant means wrong card | Require confirmation, support manual search, track corrections |
| External API costs appear | Breaks zero-budget goal | Prefer local/manual flows, cap quotas, make providers swappable. [developers.google](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing) |
| Too much upfront scope | Solo build stalls | Ship manual-first MVP before automation |
| Users do not trust rankings | Black-box logic hurts retention | Show explanations and second-best options |

## Open questions

- Should the first version support only cashback-equivalent scoring, or customizable point valuations from day one?
- Should warehouse clubs, superstores, and merchant-within-merchant cases be modeled explicitly in MVP?
- Should the first release be local-only, or should it include free-tier cloud sync immediately?
- How many cards should the starter catalog include at launch: 25, 50, or 100?
- Should user corrections be applied only after admin review, or immediately as private user-level overrides?

## Final recommendation

The best zero-budget path is to build this first as a **manual-first PWA** with a structured card catalog, deterministic rules engine, merchant search, and optional location assist. That path avoids paid fintech integrations, avoids dependence on partner-only network APIs, and still delivers the core user value: telling someone which card to use at a specific merchant right now. [wearefounders](https://www.wearefounders.uk/supabase-pricing-2026-every-tier-explained-for-indie-hackers/)

The most important product decision is to optimize for **accuracy and explainability**, not automation glamour. A smaller, more trustworthy product will create more long-term value than a more “automated” app that relies on paid data sources and produces uncertain recommendations. [plaid](https://plaid.com/docs/enrich/)