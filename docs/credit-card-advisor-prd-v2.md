# Product Requirements Document v2: Credit Card Nudge App (Chase, American Express, Capital One MVP)
<Ignore [x] numerical number at any given line>

## Executive summary

This PRD defines the second version of the product for a simplified MVP that recommends the **best likely credit card to use at a retailer** based on the cards a user has added to the app, the merchant they are currently at, and the latest publicly available reward rules for supported cards.[1][2][3]

The MVP is intentionally narrowed to **specific card products** from **Chase, American Express, and Capital One** only. The product will not attempt to verify activation status, spending caps consumed, targeted offers, or issuer-portal enrollment state. Instead, it will surface a **nudge recommendation** such as “You’re at Whole Foods. Best likely card: Chase Freedom,” paired with a lightweight disclaimer that final rewards depend on issuer terms and merchant classification. Reward logic is modeled at the exact card-product level, not at the issuer level, because products within the same bank have materially different earning structures.[1][4][5][3][6]

The system will use a **cached, internally normalized rewards database** refreshed on a schedule and optionally refreshed on demand, rather than depending on a live issuer API at runtime. This reflects the fact that issuers publish reward terms on public web pages, not as a universal real-time rewards API, and public issuer materials still acknowledge exclusions, category definitions, and merchant-coding variability.[1][2][3]

## Product vision

The product should become a lightweight personal wallet assistant that helps users quickly choose which of their saved cards is most likely best at a merchant. The initial version is not a guarantee engine and not a bank-grade rewards reconciliation product. Its purpose is to create a fast decision nudge at the point of purchase.[1][2][3]

A successful interaction looks like this: the user opens the app, confirms a merchant, and gets a recommendation in seconds. The recommendation should be fast, understandable, and current enough to be useful, while explicitly avoiding false precision around account-specific eligibility.[1][2]

## Product strategy

The correct product cut for MVP is to optimize for:

- small card coverage,
- high clarity,
- rules freshness,
- explainable recommendations,
- and low implementation complexity.

The MVP will support only three issuers because that reduces the ongoing maintenance burden of keeping rules current, but support will be defined at the **exact card-product level** rather than the issuer level. Chase provides publicly announced rotating quarterly categories and distinct product pages such as Sapphire Preferred, American Express publishes product-specific reward guidance such as Gold and merchant-category guidance for certain reward structures, and Capital One publishes category-based reward information for products such as Savor and Venture X.[1][4][2][5][3][6]

## Problem statement

Users with multiple cards often forget which card is likely best at the current store. Reward structures vary by issuer, merchant category, rotating quarterly promotions, and product family, and the user usually does not want to check multiple issuer apps before making a purchase.[1][3]

Most existing apps are not optimized for the moment-of-purchase question: “I’m at this retailer right now; which of my cards is likely best?” This product solves that by combining merchant identification, a maintained rewards rules database, and a ranking engine designed for quick nudges rather than exact reward adjudication.[1][2][3]

## Goals

- Help a user determine the best likely card at a merchant in under 5 seconds.
- Support only Chase, American Express, and Capital One cards in MVP.
- Refresh published rules daily and optionally on user request.
- Avoid modeling activation state, cap usage, and account-specific eligibility in MVP.
- Present recommendations as **best likely card** rather than guaranteed earned rewards.
- Build a system that is implementable by one builder using Claude Code.

## Non-goals

- Verifying whether the user activated a quarterly category.
- Verifying whether a spending cap has already been exhausted.
- Pulling transaction data from bank aggregators.
- Scraping authenticated issuer account portals.
- Supporting every US credit card at launch.
- Guaranteeing final earned rewards for a specific transaction.

## Product principles

- **Nudge, not guarantee**: the app recommends the best likely card based on published rules, not account-level certainty.
- **Fresh enough, not fake real-time**: refresh rules on a schedule and optionally on demand; do not block the user path on live scraping for every session.
- **Issuer sources first**: public issuer pages and official announcements are the source of truth for supported cards.[1][2][3]
- **Merchant-first UX**: the app begins with where the user is or where they are shopping.
- **Small supported universe**: fewer issuers and cards improve trust and maintainability.

## Supported issuers and initial scope

The MVP supports three issuers, but the recommendation engine and wallet model shall operate on **exact supported card products**, not issuer names alone. A user must add a product such as **Chase Freedom Flex**, **Chase Sapphire Preferred**, **American Express Gold Card**, **American Express Platinum Card**, **Capital One Savor**, or **Capital One Venture X**, rather than adding only “Chase,” “Amex,” or “Capital One.” Product pages for these cards publish different earning structures, which makes issuer-level modeling insufficient.[1][4][5][3][6]

### Supported issuers

- **Chase**
- **American Express**
- **Capital One**

### Supported card products

The initial card set should be intentionally small and selected at the card-product level. Illustrative examples include:

- **Chase Freedom / Freedom Flex** for rotating quarterly categories such as Q2 2026 categories including Amazon, Whole Foods Market, and Chase Travel.[1]
- **Chase Sapphire Preferred** for travel and dining-oriented rewards defined on the product page.[4]
- **American Express Gold Card** for product-specific Membership Rewards earning structures.[5]
- **American Express Platinum Card** if selected later for premium travel-oriented benefits and distinct product logic.[5]
- **Capital One Savor** for stable dining, entertainment, grocery, and streaming category rules.[3][7]
- **Capital One Venture X** for product-specific travel-oriented reward structures distinct from Savor.[6]

American Express is a strong fit because Amex publishes merchant guidance for certain reward structures, including a page that identifies Walgreens, CVS Pharmacy, DUANE Reade, and Rite Aid as select major U.S. drugstores for additional rewards where applicable.[2]

## User segments

### Primary user

The primary user is a rewards-aware consumer with multiple cards who wants a quick merchant-specific recommendation but does not want to manually check issuer portals in the moment of purchase.

### Secondary user

The secondary user is a lighter rewards user who wants a very simple answer, such as “Use this card here,” without managing every rules detail.

## Core user stories

- As a user, I want to add the Chase, Amex, and Capital One cards I have so the app can recommend from my wallet.
- As a user, I want to open the app at a store and quickly confirm the merchant.
- As a user, I want the app to tell me which card is most likely best right now.
- As a user, I want a short explanation for why that card was recommended.
- As a user, I want to know when the reward rules were last refreshed.
- As a user, I want an option to refresh current reward rules if needed.
- As an admin, I want issuer-rule updates to be auditable and editable.

## Jobs to be done

- When standing in front of a checkout counter, help pick a card quickly.
- When comparing several cards mentally, reduce friction by surfacing the likely best option.
- When reward rules change seasonally or periodically, keep recommendations current enough to remain useful.

## User experience overview

The app should support two entry points:

1. **Use my location**: identify likely nearby merchants and let the user pick one.
2. **Search merchant manually**: let the user search for a store by name.

After the merchant is selected, the app should immediately rank the user’s saved cards and display:

- the top recommendation,
- the likely reward rate or benefit,
- a brief explanation,
- and a brief disclaimer such as “Final rewards may depend on issuer terms and merchant classification.”

The result screen should also show when the rules were last refreshed and optionally include a “Refresh latest rules” action. This reinforces trust without pretending to guarantee transaction-level outcomes.[1][2]

## Functional requirements

### 1. Wallet management

The system shall allow a user to add cards manually from a predefined catalog of supported **card products** from Chase, American Express, and Capital One. The wallet flow shall require selection of an exact product name rather than issuer name only.

The system shall allow a user to:

- add a card,
- remove a card,
- reorder cards,
- nickname cards,
- and enable or disable a card for recommendations.

The system shall support user-specific configuration fields for cards where the public rewards program depends on a user choice. For example, if a supported card has a user-selected category concept, the app shall capture that choice from the user because the issuer page alone is not sufficient to determine the correct recommendation for that account.[8]

### 2. Merchant detection and search

The system shall allow the user to request current location and identify likely nearby merchants. The system shall also allow manual merchant search because location-based detection will sometimes be ambiguous.

The system shall normalize a selected merchant into a canonical merchant entity. The canonical merchant entity may also map to one or more internal merchant categories such as grocery, drugstore, dining, entertainment, streaming, travel, or general retail.[2][3]

### 3. Rewards rules ingestion

The system shall maintain an internal database of supported card-product reward rules. Rules shall be sourced from public issuer product pages and official issuer announcements where available.[1][4][2][5][3][6]

The system shall support two types of rules:

- **stable rules**, such as recurring category structures published on card pages;
- **time-bound rules**, such as quarterly rotating Chase Freedom categories.[1][3]

The system shall not depend on a public real-time rewards API because a universal public issuer API does not exist for this use case. Instead, the system shall periodically fetch and parse supported issuer pages into normalized internal rule records.[1][2][3]

### 4. Rules refresh service

The system shall run a scheduled refresh job at least once every 24 hours for all supported cards. The refresh job shall fetch source pages, parse reward details, compare results against current records, and update active rules when changes are detected.

The system shall also allow a user-triggered refresh action. A manual refresh shall not block the user from receiving a recommendation based on the last successfully verified rules.

The system shall store, for each rule:

- source URL,
- source issuer,
- last verified timestamp,
- effective start and end date if applicable,
- parser version,
- confidence,
- and notes.

### 5. Recommendation engine

The system shall rank only the exact card products the user has saved.

The ranking engine shall use:

- selected merchant,
- internal merchant category mapping,
- current active reward rules,
- user-configured card settings if applicable,
- and current date.

The engine shall return the **best likely card** rather than a guaranteed reward determination. The engine shall prefer clarity and recency over full account-level accuracy.

The engine shall attach an explanation object including:

- matched rule,
- matched merchant or category,
- displayed reward rate,
- last rules refresh timestamp,
- and a disclaimer message.

### 6. Disclaimers and trust signals

Every recommendation shall include a disclaimer that final rewards may depend on issuer terms, merchant classification, exclusions, or account-specific conditions. This is important because public issuer materials describe category definitions and merchant-specific eligibility conditions rather than guaranteeing every transaction outcome.[1][2][3]

The UI shall show the last successful rules refresh time. If rules are stale beyond a threshold, the app shall display a freshness warning.

### 7. Admin tooling

The system shall include an admin console for:

- supported card catalog management,
- source URL management,
- merchant mapping edits,
- rewards rule inspection,
- parser test results,
- change review,
- and audit logging.

The admin console shall allow manual override if a source page changes structure or a parser fails.

## Non-functional requirements

### Performance

- Merchant confirmation and recommendation should complete in under 5 seconds.
- Refresh jobs should run asynchronously and should not block recommendation delivery.
- Manual refresh should provide progress feedback and timeout gracefully.

### Reliability

- If the refresh job fails, the system shall continue to recommend based on the last successful rules snapshot.
- If a parser breaks, the affected rule should be flagged for review rather than silently removed.
- Runtime recommendations must never depend directly on scraping a live issuer page.

### Explainability

- Every recommendation must include a short, human-readable rationale.
- The rationale should cite whether the match came from a merchant-specific rule or a broader category rule.

### Data freshness

- Rules should be refreshed at least daily.
- The UI should show the last verified time for user-facing trust.
- The system should support additional refreshes at likely change boundaries, such as quarter transitions for Chase Freedom.[1]

### Compliance and safety posture

- The system shall scrape or fetch only public issuer pages used as source material.
- The system shall not attempt to scrape authenticated user account portals.
- The system shall maintain a narrow source list and auditable rule provenance.

## Data model

The minimum logical schema should include the following entities:

| Entity | Purpose |
|---|---|
| users | User identity or device-linked local profile |
| issuers | Supported banks such as Chase, American Express, and Capital One |
| cards | Supported exact card-product catalog linked to issuers |
| user_cards | Cards the user says they have |
| user_card_settings | Optional user-specific settings for supported cards |
| merchants | Canonical merchant entities |
| merchant_aliases | Alternate merchant names |
| merchant_categories | Internal reward categories |
| merchant_category_map | Merchant-to-category mapping |
| rule_sources | Public source URLs and metadata |
| reward_rules | Normalized active and historical rule definitions |
| rule_refresh_runs | Background refresh job logs |
| rule_change_events | Diff logs between prior and new rules |
| recommendations | Recommendation events |
| parser_failures | Failed parse events requiring admin review |

## Reward rule model

A reward rule should support both category and merchant-targeted logic.

Example fields:

- `issuer`
- `card_id`
- `rule_type` (`base`, `category_bonus`, `merchant_bonus`, `time_bound_bonus`)
- `merchant_id` or `category_id`
- `reward_rate_display`
- `effective_start`
- `effective_end`
- `source_id`
- `confidence`
- `notes`
- `is_active`

For Chase Freedom, a time-bound rule might map Whole Foods Market and Amazon to 5% during the Q2 2026 date window announced by Chase.[1]

For Capital One Savor, a stable rule might map dining, entertainment, grocery stores, and streaming to 3%, and all other purchases to 1%, with stated exclusions for grocery-like superstores such as Walmart and Target noted in public card materials.[3][7]

For Amex, rules may rely more heavily on merchant lists or category guidance published by the issuer, such as its select major U.S. drugstores page that names Walgreens and other merchants.[2]

## Merchant matching strategy

The system shall use a two-layer merchant resolution model:

1. **Canonical merchant matching** for merchants explicitly named in public issuer rules or lists, such as Whole Foods Market or Walgreens.[1][2]
2. **Category matching** for cards whose issuer materials primarily define rewards through categories such as grocery stores, dining, entertainment, or streaming.[3][7]

The merchant layer shall support overrides because issuer language often mixes exact named merchants with broader retail classes. This is essential for recommendations that are both useful and explainable.[1][2][3]

## Recommendation output contract

The response object for a recommendation should include:

```json
{
  "merchant": "Whole Foods Market",
  "recommended_card": "Chase Freedom",
  "reward_display": "5%",
  "recommendation_type": "best_likely_card",
  "reason": "Current Chase Freedom rotating category includes Whole Foods Market for the active quarter.",
  "last_verified_at": "2026-04-10T18:00:00Z",
  "disclaimer": "Final rewards may depend on issuer terms, merchant classification, and account-specific conditions."
}
```

The language should be assertive enough to be useful but not so strong that it implies certainty.

## Refresh architecture

The refresh system should have the following steps:

1. Load supported source URLs.
2. Fetch public issuer pages.
3. Parse relevant rules using issuer-specific parsers.
4. Normalize results into a common internal schema.
5. Compare with current active rules.
6. Write deltas and mark new active rules.
7. Log the run status and parser confidence.
8. Surface changes in admin UI.

The app should consume only normalized stored rules. It should never scrape the issuer site directly from the client.

## Supported source strategy by issuer

| Issuer | Source pattern | Why it works for MVP |
|---|---|---|
| Chase | Official card page + quarterly announcement pages [1] | Chase publicly publishes rotating quarterly categories |
| American Express | Official rewards information pages and merchant guidance [2] | Merchant-list guidance is useful for exact store nudges |
| Capital One | Official card pages with category descriptions [3] | Category-based structure is comparatively stable |

## Success metrics

### Product metrics

- Daily active users
- Recommendation sessions per active user
- Merchant confirmation success rate
- Tap-through rate on recommended card details
- Manual refresh usage rate

### Quality metrics

- Rules freshness SLA adherence
- Parser success rate
- Recommendation confidence rate
- User-reported incorrect recommendation rate
- Average age of active rules at recommendation time

### Trust metrics

- Percentage of recommendations shown with freshness timestamp
- Percentage of recommendations supported by issuer-source-backed rule records
- User satisfaction with recommendation usefulness

## Acceptance criteria

### MVP acceptance criteria

- User can add supported Chase, Amex, and Capital One cards manually.
- User can choose a merchant by search or nearby selection.
- App returns a best likely card recommendation for supported merchants/categories.
- App displays reason, reward display, last updated time, and disclaimer.
- Scheduled refresh runs at least daily.
- Manual refresh can be triggered without breaking the recommendation flow.
- Admin can inspect and edit source-backed rules.

## Risks and mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Public page structure changes | Parser can fail silently if not handled | Use issuer-specific parsers, snapshot tests, parser-failure alerts |
| Merchant coding differs from expectation | Final rewards may differ from recommendation | Use “best likely card” wording and show disclaimer |
| Over-expansion of card support | Maintenance burden grows too quickly | Limit MVP to Chase, Amex, and Capital One |
| Freshness gap | User trust drops if rules are stale | Daily refresh, last-updated badge, manual refresh option |
| Source ambiguity | Some rules depend on merchant list vs category | Support merchant-level and category-level rule types |

## Implementation roadmap

### Phase 1: Core wallet and recommendation engine

- Build supported card catalog for Chase, Amex, and Capital One.
- Build user wallet flows.
- Build merchant search and matching.
- Build deterministic rules engine.
- Build recommendation result UI.

### Phase 2: Rules ingestion and refresh

- Build source registry.
- Build issuer-specific parsers.
- Build normalized rule storage.
- Build daily refresh job.
- Build freshness indicators in UI.

### Phase 3: Admin and quality controls

- Build admin console.
- Add parser monitoring.
- Add rule diff review.
- Add merchant override management.
- Add feedback loop for incorrect recommendations.

## Final product decision

This MVP is a **merchant-aware credit card nudge app** for specific supported card products issued by Chase, American Express, and Capital One. It does not guarantee exact rewards. It recommends the **best likely card** using the user’s saved wallet of exact card products, merchant context, and a source-backed rules database refreshed from public issuer materials.

That product cut is the right balance between usefulness, trust, and implementation feasibility. It is narrow enough to ship, honest enough to avoid overpromising, and structured enough to expand later if the app proves value.

## Additional product modeling requirement

Reward logic shall always be attached to an exact card product and never to an issuer alone. For example, Chase Freedom and Chase Sapphire Preferred must be treated as different products with distinct rules, American Express Gold and Platinum must be treated as separate products, and Capital One Savor and Venture X must be modeled separately because their public reward structures differ materially.

The user interface shall therefore expose issuer, card product name, and product-specific details in wallet management, recommendation logic, admin tooling, and source configuration. All source URLs, parser logic, and reward rules shall be keyed by exact card product identifier rather than bank name.