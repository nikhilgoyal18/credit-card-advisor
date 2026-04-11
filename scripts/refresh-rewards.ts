import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import { z } from "zod";

const RewardRuleSchema = z.object({
  rule_id: z.string(),
  categories: z.array(z.enum([
    "GROCERY", "DINING", "TRAVEL_GENERAL", "TRAVEL_HOTELS", "TRAVEL_AIRLINES",
    "TRAVEL_PORTAL", "STREAMING", "ENTERTAINMENT", "GAS_STATIONS", "DRUGSTORES",
    "HOME_IMPROVEMENT", "TRANSIT", "DEPARTMENT_STORES", "WHOLESALE_CLUBS", "GENERAL"
  ])),
  earn_rate: z.number().min(0).max(100),
  earn_type: z.enum(["cashback_percent", "points_multiplier"]),
  notes: z.string().optional(),
});

type RewardRule = z.infer<typeof RewardRuleSchema>;

interface CardSource {
  id: string;
  name: string;
  sources: {
    site: string;
    url: string;
  }[];
}

// Card sources - multiple aggregator sites for fallback
const CARD_SOURCES: CardSource[] = [
  {
    id: "chase_freedom_flex",
    name: "Chase Freedom Flex",
    sources: [
      { site: "NerdWallet", url: "https://www.nerdwallet.com/article/credit-cards/chase-freedom-flex" },
      { site: "The Points Guy", url: "https://thepointsguy.com/guide/chase-freedom-flex-credit-card-review/" },
      { site: "Credit Karma", url: "https://www.creditkarma.com/credit-cards/reviews/chase-freedom-flex" },
    ],
  },
  {
    id: "chase_sapphire_preferred",
    name: "Chase Sapphire Preferred",
    sources: [
      { site: "NerdWallet", url: "https://www.nerdwallet.com/article/credit-cards/chase-sapphire-preferred" },
      { site: "The Points Guy", url: "https://thepointsguy.com/guide/chase-sapphire-preferred/" },
      { site: "Credit Karma", url: "https://www.creditkarma.com/credit-cards/reviews/chase-sapphire-preferred" },
    ],
  },
  {
    id: "amex_gold",
    name: "American Express Gold Card",
    sources: [
      { site: "NerdWallet", url: "https://www.nerdwallet.com/article/credit-cards/amex-gold" },
      { site: "The Points Guy", url: "https://thepointsguy.com/guide/amex-gold-card/" },
      { site: "Credit Karma", url: "https://www.creditkarma.com/credit-cards/reviews/american-express-gold-card" },
    ],
  },
  {
    id: "amex_platinum",
    name: "American Express Platinum Card",
    sources: [
      { site: "NerdWallet", url: "https://www.nerdwallet.com/article/credit-cards/amex-platinum" },
      { site: "The Points Guy", url: "https://thepointsguy.com/guide/amex-platinum-card/" },
      { site: "Credit Karma", url: "https://www.creditkarma.com/credit-cards/reviews/american-express-platinum-card" },
    ],
  },
  {
    id: "capital_one_savor",
    name: "Capital One Savor Cash Rewards",
    sources: [
      { site: "NerdWallet", url: "https://www.nerdwallet.com/article/credit-cards/capital-one-savor" },
      { site: "The Points Guy", url: "https://thepointsguy.com/guide/capital-one-savor-cash-rewards-credit-card-review/" },
      { site: "WalletHub", url: "https://wallethub.com/profile/capital-one-savor-cash-rewards-card" },
    ],
  },
  {
    id: "capital_one_venture_x",
    name: "Capital One Venture X",
    sources: [
      { site: "NerdWallet", url: "https://www.nerdwallet.com/article/credit-cards/capital-one-venture-x" },
      { site: "The Points Guy", url: "https://thepointsguy.com/guide/capital-one-venture-x-card/" },
      { site: "WalletHub", url: "https://wallethub.com/profile/capital-one-venture-x-business-card" },
    ],
  },
];

// Fetch with retry
async function fetchWithRetry(url: string, maxRetries = 2): Promise<string> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
  };

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, { headers, timeout: 10000 });
      if (response.ok) return await response.text();
    } catch (error) {
      if (i < maxRetries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error(`Failed to fetch ${url} after ${maxRetries + 1} attempts`);
}

// Extract rewards from NerdWallet/Credit Karma format
async function extractRewardsFromPage(html: string, cardName: string): Promise<RewardRule[]> {
  const $ = cheerio.load(html);
  const rewards: RewardRule[] = [];

  // Look for reward structures in the HTML
  const text = $.text().toLowerCase();

  // Generic patterns that work across sites
  const patterns = [
    { pattern: /(\d+(?:\.\d+)?)\s*(?:x|%)\s*(?:on\s+)?(?:cash\s+)?(?:back\s+)?(?:points?\s+)?(?:on\s+)?(grocery|groceries|dining|restaurants?|entertainment|streaming|travel|airlines?|hotels?|gas(?:\s+station)?s?|drugstores?)/gi, categoryMap: { grocery: "GROCERY", dining: "DINING", restaurants: "DINING", entertainment: "ENTERTAINMENT", streaming: "STREAMING", travel: "TRAVEL_GENERAL", airlines: "TRAVEL_AIRLINES", hotels: "TRAVEL_HOTELS", gas: "GAS_STATIONS", drugstores: "DRUGSTORES" } },
  ];

  // Try to find reward data in common structures
  const rewardTexts = $("ul li, tr td, div")
    .contents()
    .filter((_, el) => el.type === "text")
    .map((_, el) => (el as any).data)
    .get();

  const foundRules = new Map<string, RewardRule>();

  for (const text of rewardTexts) {
    if (!text || text.length < 10) continue;

    // Match patterns like "5x on dining", "3% cashback on groceries", etc.
    const rateMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:x|%)/);
    const categoryMatch = text.match(/(grocery|groceries|dining|restaurants?|entertainment|streaming|travel|airlines?|hotels?|gas|drugstores?)/i);

    if (rateMatch && categoryMatch) {
      const rate = parseFloat(rateMatch[1]);
      const category = categoryMatch[1].toLowerCase();

      const categoryMap: Record<string, string> = {
        grocery: "GROCERY",
        groceries: "GROCERY",
        dining: "DINING",
        restaurants: "DINING",
        restaurant: "DINING",
        entertainment: "ENTERTAINMENT",
        streaming: "STREAMING",
        travel: "TRAVEL_GENERAL",
        airlines: "TRAVEL_AIRLINES",
        airline: "TRAVEL_AIRLINES",
        hotels: "TRAVEL_HOTELS",
        hotel: "TRAVEL_HOTELS",
        gas: "GAS_STATIONS",
        drugstores: "DRUGSTORES",
      };

      const mappedCategory = categoryMap[category];
      if (mappedCategory && rate > 0 && rate <= 100) {
        const ruleId = `${rate}x_${mappedCategory.toLowerCase()}`;

        if (!foundRules.has(ruleId)) {
          try {
            const rule = RewardRuleSchema.parse({
              rule_id: ruleId,
              categories: [mappedCategory],
              earn_rate: rate,
              earn_type: text.toLowerCase().includes("cashback") ? "cashback_percent" : "points_multiplier",
              notes: `Extracted from ${cardName} rewards page`,
            });
            foundRules.set(ruleId, rule);
          } catch (e) {
            // Validation failed, skip
          }
        }
      }
    }
  }

  return Array.from(foundRules.values());
}

// Refresh rewards from aggregator sites
async function refreshRewards() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("SUPABASE_URL not set");
  if (!supabaseKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`\n📊 Starting reward refresh from aggregator sites...\n`);

  let totalUpserted = 0;
  const results: { card: string; rules: number; success: boolean; source?: string; error?: string }[] = [];

  for (const cardSource of CARD_SOURCES) {
    const cardName = cardSource.name;
    const cardId = cardSource.id;
    let rewards: RewardRule[] = [];
    let successSource = "";

    // Try each source in order
    for (const source of cardSource.sources) {
      try {
        console.log(`🔄 Fetching ${cardName} from ${source.site}...`);
        const html = await fetchWithRetry(source.url);
        const extracted = await extractRewardsFromPage(html, cardName);

        if (extracted.length > 0) {
          rewards = extracted;
          successSource = source.site;
          console.log(`✅ Found ${extracted.length} rewards from ${source.site}`);
          break;
        }
      } catch (error) {
        console.warn(`⚠️  ${source.site} failed, trying next source...`);
      }
    }

    if (rewards.length === 0) {
      console.warn(`❌ ${cardName}: No rewards found from any source`);
      results.push({ card: cardName, rules: 0, success: false, error: "No rewards extracted" });
      continue;
    }

    // Upsert to Supabase
    try {
      let upserted = 0;
      for (const reward of rewards) {
        const { error } = await supabase.from("reward_rules").upsert(
          {
            card_id: cardId,
            rule_id: reward.rule_id,
            categories: reward.categories,
            earn_rate: reward.earn_rate,
            earn_type: reward.earn_type,
            merchant_specific: [],
            quarterly_rotating: false,
            quarterly_config: null,
            excluded_merchants: [],
            excluded_categories: [],
            valid_from: null,
            valid_until: null,
            source_url: `aggregator:${successSource}`,
            source_last_verified: new Date().toISOString(),
            notes: reward.notes || null,
          },
          { onConflict: "card_id,rule_id" }
        );

        if (!error) upserted++;
      }

      console.log(`💾 ${cardName}: ${upserted}/${rewards.length} rules upserted\n`);
      results.push({ card: cardName, rules: upserted, success: true, source: successSource });
      totalUpserted += upserted;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${cardName}: ${errorMsg}\n`);
      results.push({ card: cardName, rules: 0, success: false, error: errorMsg });
    }
  }

  // Summary
  console.log("=".repeat(60));
  console.log("📊 REFRESH SUMMARY");
  console.log("=".repeat(60));
  results.forEach((r) => {
    const status = r.success ? "✅" : "❌";
    const source = r.source ? ` [${r.source}]` : "";
    console.log(`${status} ${r.card}: ${r.rules} rules${source}${r.error ? ` (${r.error})` : ""}`);
  });
  console.log(`\n📈 Total rules upserted: ${totalUpserted}`);
  console.log(`⏰ Last run: ${new Date().toISOString()}`);
  console.log("=".repeat(60) + "\n");
}

refreshRewards().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
