# API Contracts — Phase 1

Canonical request/response schemas for Phase 1 MVP endpoints. Implement exactly as specified.

---

## 1. POST /api/recommend

**Purpose**: Get ranked card recommendations for a merchant

**Authentication**: Required (Supabase Auth session)

### Request

```typescript
POST /api/recommend
Content-Type: application/json

{
  "merchant_id": string   // Required. ID of merchant from merchants table
}
```

**Validation**:
- `merchant_id` must be non-empty string
- `merchant_id` must exist in merchants table

### Response

**HTTP 200** — Success. Returns array of ranked recommendations.

```typescript
{
  "data": [
    {
      "card_id": string,                               // Card product ID
      "effective_rate": number,                        // Numeric rate (0-100)
      "earn_type": "cashback_percent" | "points_multiplier",
      "explanation": string,                           // Plain-language reason
      "caveats": string[],                            // Array of important notes
      "last_verified_at": string,                      // ISO 8601 timestamp when rules were last refreshed
      "recommendation_type": "best_likely_card"        // Always this value for Phase 1
    }
    // ... additional cards, ranked best-to-worst
  ],
  "merchant": {
    "id": string,
    "canonical_name": string,
    "primary_category": string
  },
  "disclaimer": "Final rewards may depend on issuer terms, merchant classification, and account-specific conditions."
}
```

**Example**:

```json
{
  "data": [
    {
      "card_id": "chase_freedom_flex",
      "effective_rate": 5.0,
      "earn_type": "cashback_percent",
      "explanation": "Chase Freedom Flex earns 5% on Whole Foods Market (active quarter).",
      "caveats": ["Requires quarterly activation"],
      "last_verified_at": "2026-04-10T02:00:00Z",
      "recommendation_type": "best_likely_card"
    },
    {
      "card_id": "amex_gold",
      "effective_rate": 4.0,
      "earn_type": "points_multiplier",
      "explanation": "American Express Gold earns 4x on grocery store purchases.",
      "caveats": [],
      "last_verified_at": "2026-04-10T02:00:00Z",
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

**HTTP 400** — Bad Request

```json
{
  "error": "merchant_id is required",
  "code": "VALIDATION_ERROR"
}
```

**HTTP 404** — Merchant not found

```json
{
  "error": "Merchant not found",
  "code": "NOT_FOUND"
}
```

**HTTP 401** — Unauthenticated

```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

---

## 2. GET /api/merchants/search

**Purpose**: Fuzzy search merchants by name

**Authentication**: Required (Supabase Auth session)

### Request

```typescript
GET /api/merchants/search?q=<query>&limit=<limit>

Query parameters:
- q (string, required): Search query (e.g., "whole", "starbucks")
- limit (integer, optional): Max results to return (default: 10, max: 50)
```

**Validation**:
- `q` must be non-empty string
- `limit` must be integer 1-50

### Response

**HTTP 200** — Success

```typescript
{
  "data": [
    {
      "id": string,                    // Merchant ID
      "canonical_name": string,        // Primary name
      "primary_category": string,      // Category enum value
      "aliases": string[]              // Alternative names
    }
    // ... additional merchants, sorted by relevance
  ],
  "query": string,                     // Original search query
  "count": number                      // Number of results
}
```

**Example**:

```json
{
  "data": [
    {
      "id": "whole_foods_market",
      "canonical_name": "Whole Foods Market",
      "primary_category": "GROCERY",
      "aliases": ["Whole Foods", "WFM", "WHOLEFDS"]
    },
    {
      "id": "walmart",
      "canonical_name": "Walmart",
      "primary_category": "GROCERY",
      "aliases": ["Walmart Inc", "Walmart Stores"]
    }
  ],
  "query": "whole",
  "count": 2
}
```

**HTTP 400** — Bad Request

```json
{
  "error": "q parameter is required",
  "code": "VALIDATION_ERROR"
}
```

**HTTP 401** — Unauthenticated

```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

---

## Notes

- **Timestamps** are ISO 8601 format (UTC)
- **Error messages** are descriptive and include a `code` field for client-side handling
- **Rate limiting** (Phase 2): no client-side rate limiting needed for MVP
- **Caching** (Phase 2): implement if performance monitoring shows need
- **Admin endpoints** (Phase 3): documented in separate spec file when implemented
