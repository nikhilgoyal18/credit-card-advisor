# Plan: Location-Based Merchant Detection

## Context

Currently users manually type a merchant name into a search bar to get a credit card recommendation. The most valuable moment is *right when the user is standing in a store*. This feature uses the browser Geolocation API + OpenStreetMap Overpass API (free, no key) to detect nearby businesses, match them to the merchant database, and surface an instant card recommendation — no typing required.

**User choices confirmed:**
- API: OpenStreetMap Overpass (free, no API key required)
- Trigger: Explicit "Detect my location" button tap
- UX: Inline dismissable banner → tapping merchant navigates to existing `/recommend/[id]` page
- Radius: 200m
- Multi-match: Show top match prominently + a small "Not at [Merchant]?" switcher for alternates

---

## Files to Create / Modify

| Action | File |
|--------|------|
| **CREATE** | `app/lib/merchants/fuzzy.ts` ← prerequisite refactor |
| **CREATE** | `app/app/api/merchants/nearby/route.ts` |
| **CREATE** | `app/app/components/LocationBanner.tsx` |
| **MODIFY** | `app/app/api/merchants/search/route.ts` (import from new fuzzy.ts) |
| **MODIFY** | `app/app/page.tsx` |
| **MODIFY** | `app/lib/validation/schemas.ts` |

---

## Step 0 (Prerequisite): Extract Fuzzy Matching to Shared Lib

**Panel finding:** `fuzzyMatch()` and `calculateRelevance()` are unexported module-level functions inside `app/app/api/merchants/search/route.ts` (lines 14–73). The nearby route cannot import them without extraction.

**Action:** Move both functions to `app/lib/merchants/fuzzy.ts`, export them, and update the search route to import from there.

```typescript
// app/lib/merchants/fuzzy.ts
export function fuzzyMatch(query: string, target: string): boolean { ... }
export function calculateRelevance(query: string, canonicalName: string, aliases: string[]): number { ... }
```

---

## Step 1: New API Route `/api/merchants/nearby`

**File:** `app/app/api/merchants/nearby/route.ts`

**Request:** `GET /api/merchants/nearby?lat={lat}&lng={lng}&radius=200`

### Auth
Same Supabase session check as all other routes (see search/route.ts lines 79–90).

### Overpass Query
```
POST https://overpass-api.de/api/interpreter
[out:json][timeout:5];
(
  node["name"](around:200,{lat},{lng});
  way["name"](around:200,{lat},{lng});
);
out center;
```
- Use `[timeout:5]` in the Overpass QL **and** a 5-second `AbortController` on the fetch — keep these consistent.
- After response, check `response.headers.get('content-length')` before parsing; skip if > 2MB.

### Candidate Name Extraction
For each Overpass element, generate candidate strings:
```typescript
const candidates = [
  element.tags?.name,
  element.tags?.brand,
  element.tags?.operator,
].filter(Boolean) as string[];
```
Run **each candidate independently** through `calculateRelevance()` against every merchant's `canonical_name` + `aliases`. Take the **max score per merchant per element**, then the **max score per merchant across all elements**.

### Match Threshold
Use **score ≥ 100** (not 200). Score 200 = "canonical name contains query as substring"; score 100 = "alias contains query as substring." Alias matches are equally valid for location detection (e.g., OSM tags "Vons" but our DB stores "Safeway" with alias "Vons").

### Merchant Fetch Cap
Fetch merchants with a `.limit(200)` — sufficient for current seed data, prevents unbounded queries.

### Response
Return top 3 matched merchants sorted by score descending.

```typescript
// Add to app/lib/validation/schemas.ts
NearbyMerchantsQuerySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().min(50).max(500).default(200),
})

NearbyMerchantsResponseSchema = z.object({
  data: z.array(MerchantResultSchema),
  count: z.number(),
})
```

**Graceful degradation:** Overpass timeout or error → return `{ data: [], count: 0 }` with HTTP 200 (no 500s). Let the UI handle the empty state explicitly.

---

## Step 2: New Component `LocationBanner`

**File:** `app/app/components/LocationBanner.tsx`

**Props:**
```typescript
interface LocationBannerProps {
  merchants: Merchant[];      // 1–3 matched merchants
  onDismiss: () => void;
  onSelect: (id: string) => void;  // caller does router.push('/recommend/[id]')
}
```

**UX — single match:**
```
┌─────────────────────────────────────┐
│ 📍 Looks like you're at Safeway     │
│    Tap to see your best card →  [✕] │
└─────────────────────────────────────┘
```
Tapping the merchant name calls `onSelect(merchant.id)` → navigates to the existing `/recommend/[id]` page (no inline recommendation fetch — reuse the polished recommend page).

**UX — multiple matches (2–3):**
```
┌─────────────────────────────────────┐
│ 📍 Looks like you're at Safeway     │
│    Tap to see your best card →      │
│    Not right? [ Starbucks ]     [✕] │
└─────────────────────────────────────┘
```
Top match is shown prominently. Alternates listed as small chips below ("Not right? [Starbucks] [Target]"). No pick-list — the app makes a call on the top match.

**Accessibility:**
- Banner wrapper: `role="status" aria-live="polite"`
- Dismiss button: `aria-label="Dismiss location suggestion"`

**Dismiss behavior:** calls `onDismiss()` + `.focus()` on the search input ref (passed as prop or via a callback).

---

## Step 3: Modify `app/app/page.tsx`

### State additions
```typescript
type LocationState = 'idle' | 'requesting' | 'loading' | 'done' | 'no_match' | 'error' | 'dismissed';
const [locationState, setLocationState] = useState<LocationState>('idle');
const [nearbyMerchants, setNearbyMerchants] = useState<Merchant[]>([]);
const searchInputRef = useRef<HTMLInputElement>(null);
```

### Handler `handleDetectLocation()`
```
1. setLocationState('requesting')
2. navigator.geolocation.getCurrentPosition(
     success: ({ coords }) => {
       setLocationState('loading')
       fetch('/api/merchants/nearby?lat=X&lng=Y&radius=200')
       → if data.length > 0: setNearbyMerchants(data), setLocationState('done')
       → if data.length === 0: setLocationState('no_match')
     },
     error: () => setLocationState('error'),
     { timeout: 8000 }
   )
```

### "Detect my location" button placement
Add as a **secondary action inside the search area** — below the `<Input>` but above the results list, styled as a subtle text-button with a pin icon. This avoids layout conflicts with the results list.

### Privacy label
Show a one-line note in the button area:
> "📍 Detect my location — your coordinates are never stored"

### Render additions (after the `<Input>` block, before results):
```tsx
{/* Location detection */}
{locationState === 'idle' && (
  <button onClick={handleDetectLocation} ...>
    📍 Detect my location — your coordinates are never stored
  </button>
)}
{locationState === 'requesting' && <p className="text-sm text-gray-500">Waiting for location permission…</p>}
{locationState === 'loading'    && <div className="flex justify-center"><Spinner size="sm" /></div>}
{locationState === 'error'      && <p className="text-sm text-red-500">Couldn't access location. Try searching above.</p>}
{locationState === 'no_match'   && <p className="text-sm text-gray-500">No matching merchants found nearby.</p>}

{locationState === 'done' && nearbyMerchants.length > 0 && (
  <LocationBanner
    merchants={nearbyMerchants}
    onDismiss={() => { setLocationState('dismissed'); searchInputRef.current?.focus(); }}
    onSelect={(id) => router.push(`/recommend/${id}`)}
  />
)}
```

---

## Overpass API Summary

| Property | Value |
|----------|-------|
| Endpoint | `https://overpass-api.de/api/interpreter` |
| Method | POST |
| Auth | None (public instance) |
| Query timeout | `[timeout:5]` in QL |
| Fetch timeout | 5s AbortController (consistent with QL) |
| Response guard | Skip parse if > 2MB |
| Tags used | `name`, `brand`, `operator` |
| Rate limit | Public, generous for low-traffic personal app |

---

## Verification

1. Open home page — "Detect my location" button visible below search input with privacy note
2. Click button — browser permission dialog fires
3. **Grant** permission → spinner → banner appears with nearest matched merchant
4. Click merchant name in banner → navigates to `/recommend/[id]` with full recommendations
5. If multiple matches: top match shown prominently, alternates shown as chips
6. Tap an alternate chip → navigates to that merchant's recommend page
7. Dismiss banner → banner clears, search input focuses
8. **Deny** location permission → red error message, search input still works
9. **No nearby merchants**: state shows "No matching merchants found nearby"
10. Overpass timeout (simulate with DevTools network throttle) → silent empty state, no 500
11. Confirm auth check: unauthenticated fetch to `/api/merchants/nearby` returns 401
