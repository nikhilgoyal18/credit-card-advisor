import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env file from scripts directory
const envPath = path.resolve(import.meta.dirname ?? ".", ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

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
  spend_limit_amount?: number;
  spend_limit_reset_period?: string;
}

interface Card {
  id: string;
  issuer_id: string;
  name: string;
  network: string;
  reward_unit: string;
  reward_currency?: string;
  base_earn_rate: number;
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

  let totalRulesUpserted = 0;
  let totalCardsUpserted = 0;
  const results: { card: string; rules: number; success: boolean; error?: string }[] = [];

  for (const card of cardsData) {
    try {
      // Step 1: Upsert card metadata first (prevents FK violation on reward_rules)
      const { error: cardError } = await supabase.from("cards").upsert(
        {
          id: card.id,
          issuer_id: card.issuer_id,
          name: card.name,
          network: card.network,
          reward_unit: card.reward_unit,
          reward_currency: card.reward_currency || null,
          base_earn_rate: card.base_earn_rate,
        },
        { onConflict: "id" }
      );

      if (cardError) {
        console.error(`  ❌ Failed to upsert card ${card.id}:`, cardError.message);
        results.push({ card: card.name, rules: 0, success: false, error: cardError.message });
        continue;
      }

      totalCardsUpserted++;

      // Step 2: Upsert reward rules
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
            spend_limit_amount: rule.spend_limit_amount || null,
            spend_limit_reset_period: rule.spend_limit_reset_period || null,
          },
          { onConflict: "card_id,rule_id" }
        );

        if (error) {
          console.error(`  ❌ Failed to upsert ${rule.rule_id}:`, error.message);
        } else {
          upserted++;
        }
      }

      console.log(`✅ ${card.name}: card synced, ${upserted}/${rules.length} rules synced`);
      results.push({ card: card.name, rules: upserted, success: true });
      totalRulesUpserted += upserted;
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
  console.log(`\n📇 Total cards synced: ${totalCardsUpserted}`);
  console.log(`📈 Total rules synced: ${totalRulesUpserted}`);
  console.log(`⏰ Last sync: ${new Date().toISOString()}`);
  console.log(`📝 Update data/seed/cards.json to change rewards`);
  console.log("=".repeat(60) + "\n");
}

refreshRewards().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
