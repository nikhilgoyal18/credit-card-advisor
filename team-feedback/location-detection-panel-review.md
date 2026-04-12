# Full-Stack Panel Review: Location-Based Merchant Detection

> Reviewed by: Cross-Functional Panel (AI Engineer, Full-Stack Lead, Product Manager, UI/UX Reviewer)

---

## Orientation

This feature adds ambient, context-aware merchant detection to a personal-use rewards advisor. Instead of a user typing "Safeway," the app detects their GPS position, queries OpenStreetMap for nearby POIs, fuzzy-matches those names against the merchant database, and surfaces the best card recommendation in an inline banner. The intended experience is zero-friction: walk into a store, open the app, and it already knows where you are.

---

## Domain Reviews

### AI / Prompt Engineer — Score: 7/10

The matching strategy is reasonable but has a semantic gap that will hurt real-world performance. The fuzzy-match + `calculateRelevance()` function was designed for user-typed search queries (short, intentional strings like "Whole Foods"). Overpass `name` tags are often verbose, locale-specific, or structured differently — "Whole Foods Market #1234" or "WFM" or "Whole Foods Market" with a brand tag of "Whole Foods." Running the full POI name as the "query" against `calculateRelevance()` will produce inconsistent scores.

Concretely: `calculateRelevance("Whole Foods Market #1234", "Whole Foods Market", [])` gets 200 points (contains substring), but `calculateRelevance("WFM", "Whole Foods Market", [])` gets 0 — even though both name the same store. The plan says to use `[name, brand, operator]` as candidates, which helps, but doesn't resolve the case where the brand tag matches better than the name tag. The plan should explicitly specify: run each candidate independently, take the max score per merchant per Overpass element, then take the max score per merchant across all Overpass elements. That logic is implied but not written, which is a spec gap.

The score threshold of 200 is also a silent footgun. In the current scoring function, `score >= 200` means "canonical name contains query as substring." That criterion is appropriate when the query is typed by a human. For a machine-generated POI name ("Safeway #0542"), a substring match on "Safeway" correctly fires. But for a merchant stored as "Safeway" with an alias "Vons," a POI tagged as "Vons" produces only 100 points (alias contains query) — below the threshold. The threshold effectively ignores alias matches, which is backwards for location detection where the store signage may differ from the canonical name.

**Recommendation:** Lower the threshold to 100 or eliminate it in favor of a top-N-results approach, and document the candidate-scoring pipeline explicitly.

---

### Full-Stack Lead — Score: 5/10

There are three concrete engineering problems.

**Problem 1 — Fetching all merchants from Supabase on every location request.** The plan says "Fetch all merchants from Supabase." The existing search route already does this with a hard cap of 100 rows (line 115 of `search/route.ts`). The nearby route intends to fetch all of them without that cap. For a personal app with ~50–100 seeded merchants this is fine today, but it is an unscalable pattern being written without any cap or pagination. The right fix is trivial: cap the fetch at 200 rows. The plan should state this explicitly rather than leaving it open-ended.

**Problem 2 — Overpass API is a public, rate-limited, shared instance with no SLA.** The plan acknowledges this is "acceptable for low-traffic personal app" but treats it as a non-issue. The real failure mode is not rate-limiting (Overpass is generous for low traffic) — it is response size and timeout behavior. In a dense urban area, a 200m radius query with `node["name"]` and `way["name"]` can return hundreds to thousands of results, all of which need to be parsed. The plan uses a 10-second Overpass timeout and a 5-second fetch timeout — these are inconsistent. If the Overpass server is set to `[timeout:10]` but the fetch abort is 5 seconds, the fetch will cancel before Overpass finishes. These should be aligned (both 5 seconds). More importantly, the plan has no response-size guard: a JSON payload from a busy area could be 500KB–1MB. Add a response size check before JSON parsing, or switch to a more targeted query using `amenity` and `shop` tags to reduce POI noise.

**Problem 3 — `fuzzyMatch()` and `calculateRelevance()` cannot actually be reused without a refactor.** These functions live inside `app/app/api/merchants/search/route.ts` as unexported module-level functions. The nearby route cannot import them without extracting them into a shared utility (e.g., `app/lib/merchants/fuzzy.ts`). This refactor should be listed as a prerequisite step in the plan, not glossed over.

**Missing: auth check.** Every existing API route validates the Supabase session first. The nearby route plan omits this entirely.

**Missing: caching.** A simple `Cache-Control` layer (e.g., 60-second stale-while-revalidate keyed on rounded lat/lng) would prevent hammering Overpass if the user opens and closes the app repeatedly in the same spot.

---

### Product Manager — Score: 7/10

The feature has clear value: it reduces the primary friction point (typing) in the most natural use case (standing in a store about to pay). The "Looks like you're at X — use Card Y" pattern is proven. The core product logic is sound.

**Concern 1 — The multi-merchant pick-list may be the wrong default.** In a mixed retail area (a strip mall, an airport terminal, a food court), you could easily return 3 confident matches. Showing "Where are you?" to a user who just tapped "Detect my location" is a confusing reversal — they gave the app their location precisely to avoid choosing. The better default for 2–3 matches is to show the top match with a "Not right? Switch" option below, rather than a pick-list.

**Concern 2 — The score >= 200 threshold gates the whole feature silently.** If no match clears 200, the banner simply doesn't appear with no user feedback. The UI should distinguish between "feature ran but no nearby merchant found" and "location permission denied" and "Overpass timed out."

**Privacy:** The plan routes coordinates through the Next.js server-side route, which is the right call — coordinates never go directly to Overpass from the browser. But users should be informed in the UI why location is being requested before the browser prompt fires. A one-line label ("We'll check nearby stores to suggest your best card — no location data is stored") satisfies informed consent.

---

### UI/UX Reviewer — Score: 6/10

**Button placement conflict.** The plan says "below the search input." A button there would compete visually with the search results list, which renders in the same vertical space. When location detection completes and the banner appears, the results list (if any) would need to be cleared or pushed down, causing layout shifts. A cleaner approach: place the button inside the search input as a right-side icon, mirroring the pattern used in native maps apps.

**Sequential API call latency.** The 1-match case auto-fetches `/api/recommend` before rendering anything. Combined with geolocation acquisition time, total latency from "tap Detect" to "see recommendation" could be 3–5 seconds. A better pattern: navigate directly to `/recommend/[merchantId]` on tap, reusing the existing polished recommendation page, rather than building a second recommendation display inside the banner.

**Dismiss interaction.** The `dismissed` state clears the banner but doesn't restore focus to the search input. On mobile, the user's next action after dismissing is almost certainly to type a merchant name. The dismiss handler should call `.focus()` on the search input.

**Accessibility.** The banner has no announced role. When it appears dynamically, screen readers won't know it's there. It needs `role="status"` or `aria-live="polite"` to announce the detected merchant, and the dismiss button needs an `aria-label`.

---

## Team Synthesis

The feature concept is correct and the broad architecture (browser geolocation → server-side Overpass call → fuzzy match → banner) is sound. The plan's weakest areas cluster around three themes:

1. **Spec gaps that will cause bugs:** The candidate matching pipeline is underspecified (score threshold excludes alias matches, candidate generation order is ambiguous), the fuzzyMatch/calculateRelevance functions cannot actually be reused without a prerequisite refactor, and the fetch/Overpass timeouts are misaligned.

2. **UX decisions that undermine the feature's premise:** The multi-merchant pick-list defeats zero-friction intent; the banner-embedded recommendation display duplicates the existing recommend page; the "nothing found" case has no user feedback.

3. **Engineering hygiene gaps:** No auth check on the new route, no merchant fetch cap stated, no response-size guard on Overpass payload, no caching consideration.

None of these are blockers in isolation, but items 1 and 2 will produce user-visible failures (wrong match, missing matches, confusing UI) in the first week of real use.

---

## Panel Scores

| Role | Score |
|------|-------|
| AI Prompt Engineer | 7/10 |
| Full-Stack Lead Engineer | 5/10 |
| Seasoned Product Manager | 7/10 |
| UI/UX Reviewer | 6/10 |
| **Overall** | **6/10** |

---

## Next Action Item (Highest Leverage)

**Extract `fuzzyMatch()` and `calculateRelevance()` into `/app/lib/merchants/fuzzy.ts`, lower the match threshold from 200 to 100, and add an explicit comment documenting the candidate-scoring pipeline (generate `[name, brand, operator]` candidates per element → score each → keep max per merchant → rank top 3).**

This single refactor unblocks the shared code reuse the plan depends on, fixes the alias-blindness in location matching (the most likely real-world failure mode), and forces the matching contract to be written down in one place rather than left implicit. Every other issue in this review is a follow-on from this foundation being unstable.

---

> *Note: The final implementation plan (`docs/location-detection-plan.md`) already incorporates all findings from this review.*
