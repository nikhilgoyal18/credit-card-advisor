import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load and upsert reward data from seed file
async function refreshRewards() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("SUPABASE_URL not set");
  if (!supabaseKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Load cards from seed data
  const cardsPath = path.resolve("../data/seed/cards.json");
  const cardsData = JSON.parse(fs.readFileSync(cardsPath, "utf-8")) as Array<any>;

  console.log(`\n📊 Starting reward refresh for ${cardsData.length} cards...`);

  let totalUpserted = 0;
  const results: { card: string; rules: number; success: boolean; error?: string }[] = [];

  for (const cardData of cardsData) {
    const cardName = cardData.name;
    const cardId = cardData.id;
    const sourceUrl = cardData.reward_rules?.[0]?.source_url ||
      {
        chase_freedom_flex: "https://www.chase.com/personal/credit-cards/freedom-flex",
        chase_sapphire_preferred: "https://www.chase.com/personal/credit-cards/sapphire/preferred",
        amex_gold: "https://www.americanexpress.com/us/credit-cards/card/gold-card/",
        amex_platinum: "https://www.americanexpress.com/us/credit-cards/card/platinum/",
        capital_one_savor: "https://www.capitalone.com/credit-cards/savor-dining-entertainment/",
        capital_one_venture_x: "https://www.capitalone.com/credit-cards/venture-x/",
      }[cardId];

    if (!sourceUrl) {
      console.warn(`⚠️  ${cardName}: No source URL found`);
      results.push({ card: cardName, rules: 0, success: false, error: "No source URL" });
      continue;
    }

    try {
      const rules = cardData.reward_rules || [];
      let upserted = 0;

      for (const rule of rules) {
        const { error } = await supabase.from("reward_rules").upsert(
          {
            card_id: cardId,
            rule_id: rule.rule_id,
            categories: rule.categories || [],
            earn_rate: rule.earn_rate,
            earn_type: rule.earn_type,
            merchant_specific: rule.merchant_specific || [],
            quarterly_rotating: rule.quarterly_rotating || false,
            quarterly_config: rule.quarterly_config || null,
            excluded_merchants: rule.excluded_merchants || [],
            excluded_categories: rule.excluded_categories || [],
            valid_from: rule.valid_from || null,
            valid_until: rule.valid_until || null,
            source_url: sourceUrl,
            source_last_verified: new Date().toISOString(),
            notes: rule.notes || null,
          },
          { onConflict: "card_id,rule_id" }
        );

        if (error) {
          console.error(`Failed to upsert rule ${rule.rule_id} for card ${cardId}:`, error);
        } else {
          upserted++;
        }
      }

      console.log(`✅ ${cardName}: ${upserted}/${rules.length} rules upserted`);
      results.push({ card: cardName, rules: upserted, success: true });
      totalUpserted += upserted;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${cardName}: ${errorMsg}`);
      results.push({ card: cardName, rules: 0, success: false, error: errorMsg });
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 REFRESH SUMMARY");
  console.log("=".repeat(50));
  results.forEach((r) => {
    const status = r.success ? "✅" : "❌";
    console.log(`${status} ${r.card}: ${r.rules} rules${r.error ? ` (${r.error})` : ""}`);
  });
  console.log(`\n📈 Total rules upserted: ${totalUpserted}`);
  console.log(`⏰ Last run: ${new Date().toISOString()}`);
  console.log("=".repeat(50) + "\n");
}

refreshRewards().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
