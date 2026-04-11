import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

interface RewardRule {
  rule_id: string;
  categories: string[];
  earn_rate: number;
  earn_type: string;
  merchant_specific?: string[];
  quarterly_rotating?: boolean;
  quarterly_config?: Record<string, any>;
  excluded_merchants?: string[];
  excluded_categories?: string[];
  valid_from?: string;
  valid_until?: string;
  source_url?: string;
  notes?: string;
}

interface Card {
  id: string;
  name: string;
  reward_rules: RewardRule[];
}

async function refreshRewards() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("SUPABASE_URL not set");
  if (!supabaseKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Load cards from seed data
  const cardsPath = path.resolve("../data/seed/cards.json");
  const cardsData = JSON.parse(fs.readFileSync(cardsPath, "utf-8")) as Card[];

  console.log(`\n📊 Syncing rewards from seed data to Supabase...\n`);

  let totalUpserted = 0;
  const results: { card: string; rules: number; success: boolean; error?: string }[] = [];

  for (const card of cardsData) {
    try {
      const rules = card.reward_rules || [];
      let upserted = 0;

      for (const rule of rules) {
        const { error } = await supabase.from("reward_rules").upsert(
          {
            card_id: card.id,
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
            source_url: rule.source_url || "seed-data",
            source_last_verified: new Date().toISOString(),
            notes: rule.notes || null,
          },
          { onConflict: "idx_reward_rules_card_rule" }
        );

        if (error) {
          console.error(`  ❌ Failed to upsert ${rule.rule_id}:`, error.message);
        } else {
          upserted++;
        }
      }

      console.log(`✅ ${card.name}: ${upserted}/${rules.length} rules synced`);
      results.push({ card: card.name, rules: upserted, success: true });
      totalUpserted += upserted;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${card.name}: ${errorMsg}`);
      results.push({ card: card.name, rules: 0, success: false, error: errorMsg });
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SYNC SUMMARY");
  console.log("=".repeat(60));
  results.forEach((r) => {
    const status = r.success ? "✅" : "❌";
    console.log(`${status} ${r.card}: ${r.rules} rules${r.error ? ` (${r.error})` : ""}`);
  });
  console.log(`\n📈 Total rules synced: ${totalUpserted}`);
  console.log(`⏰ Last sync: ${new Date().toISOString()}`);
  console.log("📝 Update data/seed/cards.json to change rewards");
  console.log("=".repeat(60) + "\n");
}

refreshRewards().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
