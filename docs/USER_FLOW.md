# Credit Card Advisor — High-Level User Flow

---

## 1. End-to-End Application Flow

```mermaid
flowchart TD
    A([User Opens App]) --> B{Has wallet set up?}

    %% Onboarding
    B -- No --> C[Onboarding Screen\nExplain what the app does]
    C --> D[Add Cards to Wallet\nSelect issuer → product]
    D --> E{Add more cards?}
    E -- Yes --> D
    E -- No --> F([Home Screen])

    %% Returning user
    B -- Yes --> F

    %% Core recommendation loop
    F --> G{How to find merchant?}
    G -- Search --> H[Type merchant name\nFuzzy search results]
    G -- Nearby --> I[Request location permission]
    I -- Granted --> J[Show nearby merchants list]
    I -- Denied --> H
    J --> K[Select merchant]
    H --> K

    K --> L[Recommendation Screen\nRanked cards best → worst]
    L --> M[User sees:\n• Best card + reward rate\n• Plain-language reason\n• Freshness timestamp\n• Disclaimer]

    M --> N{Recommendation correct?}
    N -- Yes --> O([Use the card ✓])
    N -- Wrong merchant --> P[Search for correct merchant]
    N -- Wrong category --> Q[Pick correct category]
    P --> L
    Q --> L

    %% Wallet management (sidebar flow)
    F --> R[Wallet Screen]
    R --> S{Action}
    S -- Add card --> D
    S -- Remove card --> T[Confirm removal]
    T --> R
    S -- Configure card --> U[Card Settings\ne.g. activate quarterly category]
    U --> R
```

---

## 2. First-Time User Flow (Onboarding)

```mermaid
flowchart LR
    A([Open App]) --> B[Welcome Screen\nWhat this app does]
    B --> C[Add Your Cards\nStep 1 of 2]
    C --> D[Choose Issuer\nChase / Amex / Capital One]
    D --> E[Choose Card Product\ne.g. Amex Gold]
    E --> F{Add another card?}
    F -- Yes --> D
    F -- No --> G[Wallet Summary\nReview your cards]
    G --> H([Go to Home])
```

---

## 3. Recommendation Flow (Core Loop)

```mermaid
flowchart TD
    A([Home Screen]) --> B[Search or Browse Merchants]
    B --> C[Select Merchant\ne.g. Whole Foods]

    C --> D[(Recommendation Engine)]

    D --> E[Resolve merchant → category]
    E --> F[Fetch reward rules for user's cards]
    F --> G[Score each card\ncash-equivalent value]
    G --> H[Rank cards best → worst]
    H --> I[Attach explanation + caveats]

    I --> J[Recommendation Screen]

    J --> K[Best Card\n★ Card name\n★ Reward rate display\n★ Why this card wins]
    J --> L[Other Cards\nListed with their rates]
    J --> M[Freshness & Disclaimer\nLast verified date\nStandard disclaimer text]

    K --> N{User action}
    N -- Use card --> O([Done ✓])
    N -- Wrong merchant --> P[Correction Flow]
    N -- Wrong category --> P
    P --> Q[Log feedback locally]
    Q --> A
```

---

## 4. Admin Flow

```mermaid
flowchart TD
    A([Admin Login\nEmail + Password]) --> B{Authenticated?}
    B -- No --> C[Access Denied]
    B -- Yes --> D[Admin Dashboard]

    D --> E{Choose area}

    E -- Card Rules --> F[Card Rule CRUD\nView all rules per card]
    F --> G[Edit rate / categories / dates]
    G --> H[Mark as manually verified]
    H --> I[(rule_change_events logged)]

    E -- Merchant Mapping --> J[Merchant Manager\nSearch merchants]
    J --> K[Edit aliases / categories\nAdd new merchants]
    K --> I

    E -- Parser Monitoring --> L[Parser Failures\nFlag for review]
    L --> M[Rule Change Diffs\nApprove or Reject]
    M --> N[User Feedback Queue\nAccept / Reject / Needs Review]
    N --> I
```

---

## 5. Rules Refresh Pipeline (Background)

```mermaid
flowchart LR
    A([Daily Cron\n2am UTC]) --> B[Fetch issuer pages\nChase + Amex + Capital One]
    B --> C{Parse succeeds?}
    C -- Yes --> D[Normalize rules]
    D --> E[Diff against stored rules]
    E --> F{Rules changed?}
    F -- Yes --> G[Write new rules\nUpdate last_verified_at]
    G --> H[Log rule_change_events]
    F -- No --> I[Update last_run timestamp]
    C -- No --> J[Write to parser_failures\nDo NOT remove existing rules]
    J --> K[Flag for admin review]
    H --> L([Refresh complete])
    I --> L
    K --> L
```

---

## 6. State Summary

| Screen | Who sees it | Key action |
|---|---|---|
| Onboarding | New users only | Add cards to wallet |
| Home | All users | Search or browse merchants |
| Recommendation | All users | See ranked cards + explanation |
| Wallet | Authenticated users | Manage saved cards |
| Feedback/Correction | All users | Fix wrong merchant or category |
| Admin Dashboard | Admin only | Manage rules, merchants, parsers |

---

## 7. Data Flow Summary

```mermaid
flowchart LR
    U[User] -->|selects merchant| API[/api/recommend]
    API -->|merchant_id| E[Engine]
    E -->|lookup| DB[(Supabase DB)]
    DB -->|reward_rules| E
    DB -->|merchant + category| E
    E -->|ranked scores| API
    API -->|JSON response| U

    CRON([Daily Cron]) -->|fetch + parse| PIPE[Refresh Pipeline]
    PIPE -->|upsert rules| DB
    PIPE -->|log failures| DB

    ADMIN[Admin] -->|CRUD| ADMINAPI[/api/admin/rules]
    ADMINAPI -->|writes| DB
    DB -->|audit log| DB
```
