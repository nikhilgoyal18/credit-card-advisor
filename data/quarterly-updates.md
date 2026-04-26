# Quarterly Category Updates

Cards that require manual updates each quarter. Check these ~1 month before the quarter starts.

---

## Chase Freedom Flex

**Update frequency:** Quarterly (Q1: Jan–Mar, Q2: Apr–Jun, Q3: Jul–Sep, Q4: Oct–Dec)

**Where to check:** https://creditcards.chase.com/freedom-credit-cards/freedom-flex

**Fields to update in `data/seed/cards.json`** → card `chase_freedom_flex` → rule `quarterly_5x`:
```json
"quarterly_config": {
  "activation_required": true,
  "current_quarter_categories": ["GROCERY", "TRAVEL_PORTAL"],  ← update each quarter
  "current_quarter_start": "2026-04-01",                        ← update each quarter
  "current_quarter_end": "2026-06-30"                           ← update each quarter
}
```

**After updating, run:**
```bash
npx tsx scripts/refresh-rewards.ts
```

### Known Category → Taxonomy Mapping

| Chase Category Label     | Our Taxonomy Key   |
|--------------------------|--------------------|
| Grocery stores           | GROCERY            |
| Restaurants              | DINING             |
| Gas stations             | GAS_STATIONS       |
| Amazon.com               | GROCERY (Amazon = Whole Foods parent) |
| Whole Foods Market       | GROCERY            |
| Chase Travel             | TRAVEL_PORTAL      |
| PayPal                   | GENERAL            |
| Home improvement         | HOME_IMPROVEMENT   |
| Drug stores              | DRUGSTORES         |
| Movie theaters           | ENTERTAINMENT      |
| Fitness clubs            | ENTERTAINMENT      |

### Historical Quarters (for reference)

| Quarter   | Categories                                        |
|-----------|---------------------------------------------------|
| Q1 2026   | Grocery stores, dining (Jan 1 – Mar 31)           |
| Q2 2026   | Amazon, Whole Foods, Chase Travel (Apr 1 – Jun 30)|
| Q3 2025   | Gas stations, EV charging, movie theaters         |
| Q4 2025   | PayPal, wholesale clubs, charities                |

---

## Notes

- The `categories` array in the rule should list ALL categories the card has ever earned 5% on (used for the rotating label)
- `current_quarter_categories` is the active subset — only these earn 5% right now
- Chase announces next quarter categories ~1 month in advance via press release at `media.chase.com`
- Activation is required each quarter. This is noted in the `activation_required: true` flag.
