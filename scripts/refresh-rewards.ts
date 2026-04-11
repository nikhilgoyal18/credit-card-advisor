import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// Types
const RewardRuleSchema = z.object({
  rule_id: z.string(),
  categories: z.array(z.enum([
    "GROCERY", "DINING", "TRAVEL_GENERAL", "TRAVEL_HOTELS", "TRAVEL_AIRLINES",
    "TRAVEL_PORTAL", "STREAMING", "ENTERTAINMENT", "GAS_STATIONS", "DRUGSTORES",
    "HOME_IMPROVEMENT", "TRANSIT", "DEPARTMENT_STORES", "WHOLESALE_CLUBS", "GENERAL"
  ])),
  earn_rate: z.number().min(0).max(100),
  earn_type: z.enum(["cashback_percent", "points_multiplier"]),
  excluded_categories: z.array(z.string()).optional(),
  quarterly_rotating: z.boolean().optional(),
  notes: z.string().optional(),
});

type RewardRule = z.infer<typeof RewardRuleSchema>;

interface Card {
  id: string;
  name: string;
  source_url?: string;
  reward_rules?: Array<{ source_url?: string }>;
}

// Hardcoded source URLs (fallback)
const SOURCE_URLS: Record<string, string> = {
  chase_freedom_flex: "https://www.chase.com/personal/credit-cards/freedom-flex",
  chase_sapphire_preferred: "https://www.chase.com/personal/credit-cards/sapphire/preferred",
  amex_gold: "https://www.americanexpress.com/us/credit-cards/card/gold-card/",
  amex_platinum: "https://www.americanexpress.com/us/credit-cards/card/platinum/",
  capital_one_savor: "https://www.capitalone.com/credit-cards/savor-dining-entertainment/",
  capital_one_venture_x: "https://www.capitalone.com/credit-cards/venture-x/",
};

// Extract text content from HTML
function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Fetch card benefit page
async function fetchCardPage(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 10000,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error}`);
  }
}

// Parse reward data using Groq
async function parseRewardsWithGroq(
  groq: Groq,
  cardName: string,
  htmlText: string
): Promise<RewardRule[]> {
  const prompt = `You are a credit card rewards data extraction expert. Extract ONLY the actual card rewards/benefits from the following text.

IMPORTANT:
- Extract ONLY real, specific rewards (e.g., "3x points on dining")
- Do NOT invent or estimate rewards if not explicitly mentioned
- For quarterly rotating categories: set quarterly_rotating: true
- Map merchant categories to one of these enums:
  GROCERY, DINING, TRAVEL_GENERAL, TRAVEL_HOTELS, TRAVEL_AIRLINES, TRAVEL_PORTAL,
  STREAMING, ENTERTAINMENT, GAS_STATIONS, DRUGSTORES, HOME_IMPROVEMENT, TRANSIT,
  DEPARTMENT_STORES, WHOLESALE_CLUBS, GENERAL
- earn_type must be "cashback_percent" or "points_multiplier"
- earn_rate is the numeric value (e.g., 3 for 3x or 3%)

Return a JSON array of reward rules. Example:
[
  {
    "rule_id": "5x_dining",
    "categories": ["DINING"],
    "earn_rate": 5,
    "earn_type": "points_multiplier",
    "notes": "Limited time offer expires 12/31/2026"
  }
]

Card: ${cardName}
Content:
${htmlText.substring(0, 3000)}`;

  try {
    const message = await groq.messages.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn(`No JSON found in Groq response for ${cardName}`);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate each rule
    const validated: RewardRule[] = [];
    for (const rule of parsed) {
      try {
        validated.push(RewardRuleSchema.parse(rule));
      } catch (err) {
        console.warn(`Validation failed for rule in ${cardName}:`, rule, err);
      }
    }

    return validated;
  } catch (error) {
    throw new Error(`Groq parsing failed for ${cardName}: ${error}`);
  }
}

// Upsert rules to Supabase
async function upsertRulesToSupabase(
  supabase: ReturnType<typeof createClient>,
  cardId: string,
  rules: RewardRule[],
  sourceUrl: string
): Promise<number> {
  let upserted = 0;

  for (const rule of rules) {
    const { error } = await supabase.from("reward_rules").upsert(
      {
        card_id: cardId,
        rule_id: rule.rule_id,
        categories: rule.categories,
        earn_rate: rule.earn_rate,
        earn_type: rule.earn_type,
        excluded_categories: rule.excluded_categories || [],
        quarterly_rotating: rule.quarterly_rotating || false,
        notes: rule.notes || null,
        source_url: sourceUrl,
        source_last_verified: new Date().toISOString(),
      },
      { onConflict: "card_id,rule_id" }
    );

    if (error) {
      console.error(`Failed to upsert rule ${rule.rule_id} for card ${cardId}:`, error);
    } else {
      upserted++;
    }
  }

  return upserted;
}

// Main function
async function refreshRewards() {
  const groqApiKey = process.env.GROQ_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!groqApiKey) throw new Error("GROQ_API_KEY not set");
  if (!supabaseUrl) throw new Error("SUPABASE_URL not set");
  if (!supabaseKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");

  const groq = new Groq({ apiKey: groqApiKey });
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Load cards from seed data
  const cardsPath = path.resolve("../data/seed/cards.json");
  const cardsData = JSON.parse(fs.readFileSync(cardsPath, "utf-8")) as Array<any>;

  console.log(`\n📊 Starting reward refresh for ${cardsData.length} cards...`);

  let totalUpserted = 0;
  const results: { card: string; rules: number; success: boolean; error?: string }[] = [];

  for (const cardData of cardsData) {
    const card: Card = {
      id: cardData.id,
      name: cardData.name,
      source_url:
        cardData.source_url ||
        cardData.reward_rules?.[0]?.source_url ||
        SOURCE_URLS[cardData.id],
    };

    if (!card.source_url) {
      console.warn(`⚠️  ${card.name}: No source_url found, skipping`);
      results.push({ card: card.name, rules: 0, success: false, error: "No source URL" });
      continue;
    }

    try {
      console.log(`\n🔄 Fetching ${card.name}...`);
      const html = await fetchCardPage(card.source_url);
      const text = stripHtml(html);

      console.log(`📝 Parsing rewards with Groq...`);
      const rules = await parseRewardsWithGroq(groq, card.name, text);

      if (rules.length === 0) {
        console.warn(`⚠️  ${card.name}: No rules extracted`);
        results.push({ card: card.name, rules: 0, success: false, error: "No rules extracted" });
        continue;
      }

      console.log(`💾 Upserting ${rules.length} rules to Supabase...`);
      const upserted = await upsertRulesToSupabase(supabase, card.id, rules, card.source_url);

      console.log(`✅ ${card.name}: ${upserted}/${rules.length} rules upserted`);
      results.push({ card: card.name, rules: upserted, success: true });
      totalUpserted += upserted;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${card.name}: ${errorMsg}`);
      results.push({ card: card.name, rules: 0, success: false, error: errorMsg });
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
