import { execSync, execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Load .env from scripts directory (same pattern as refresh-rewards.ts)
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
    if (key && value && !process.env[key]) process.env[key] = value;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RewardRule {
  rule_id: string;
  categories: string[];
  earn_rate: number;
  earn_type: string;
  merchant_specific?: string[];
  quarterly_rotating?: boolean;
  quarterly_config?: Record<string, unknown>;
  excluded_merchants?: string[];
  excluded_categories?: string[];
  valid_from?: string;
  valid_until?: string;
  spend_limit_amount?: number;
  spend_limit_reset_period?: string;
  source_url?: string;
  source_last_verified?: string;
  notes?: string;
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

// ─── Source pages ─────────────────────────────────────────────────────────────
// NerdWallet category list pages — these load correctly without bot-detection
// redirects. Individual /review/ pages are blocked. Each page is scraped once
// and may cover multiple cards in the table.

const SOURCE_PAGES = [
  "/credit-cards/best/rewards",
  "/credit-cards/best/travel",
  "/credit-cards/best/cash-back",
  "/credit-cards/best/american-express",
  "/credit-cards/best/capital-one",
  "/credit-cards/best/bank-of-america",
  "/credit-cards/best/wells-fargo",
];

// ─── Card name fragments for matching ────────────────────────────────────────
// Each entry is a list of substrings; any match against a cell's text wins.
// Longer / more specific strings should come first to avoid false positives.

const CARD_LOOKUP: Record<string, string[]> = {
  chase_freedom_flex: ["Chase Freedom Flex"],
  chase_freedom_unlimited: ["Chase Freedom Unlimited"],
  chase_sapphire_preferred: ["Chase Sapphire Preferred"],
  chase_sapphire_reserve: ["Chase Sapphire Reserve"],
  amex_gold: ["American Express Gold Card", "Amex Gold"],
  amex_platinum: ["Platinum Card from American Express", "Amex Platinum"],
  amex_blue_cash_preferred: ["Blue Cash Preferred"],
  amex_blue_cash_everyday: ["Blue Cash Everyday"],
  amex_green: ["American Express Green", "Amex Green"],
  capital_one_savor: ["Capital One Savor Cash Rewards"],
  capital_one_savorone: ["Capital One SavorOne"],
  capital_one_venture_x: ["Capital One Venture X"],
  capital_one_venture: ["Capital One Venture Rewards"],
  capital_one_quicksilver: ["Capital One Quicksilver"],
  bofa_premium_rewards: ["Bank of America® Premium Rewards", "Bank of America Premium Rewards"],
  bofa_customized_cash: ["Bank of America® Customized Cash", "Bank of America Customized Cash"],
  bofa_travel_rewards: ["Bank of America® Travel Rewards", "Bank of America Travel Rewards"],
  wells_fargo_active_cash: ["Wells Fargo Active Cash"],
  wells_fargo_autograph: ["Wells Fargo Autograph℠", "Wells Fargo Autograph"],
  wells_fargo_autograph_journey: ["Wells Fargo Autograph Journey"],
};

// ─── Keyword → category mapping ───────────────────────────────────────────────
// Order matters: more-specific patterns must precede broad ones (e.g. portal
// before general travel, wholesale before grocery).
//
// Validation notes (cards each entry was verified against):
//   TRAVEL_PORTAL  — Chase Sapphire Preferred/Reserve, CFU, Venture X, Quicksilver
//   TRAVEL_AIRLINES— WF Autograph Journey ("with airlines"), CSR ("flights")
//   TRAVEL_HOTELS  — Venture X, Quicksilver, WF Autograph Journey
//   TRANSIT        — WF Autograph ("transit"), Amex Blue Cash ("transit")
//   TRAVEL_GENERAL — WF Autograph ("travel"), CSP ("all other travel")
//   WHOLESALE_CLUBS— Amex Gold/BCE (excluded), BofA Customized Cash
//   GROCERY        — Amex BCE/BCP (U.S. supermarkets), CSP (online groceries)
//   DINING         — Most cards
//   STREAMING      — CSP, WF Autograph, Freedom Flex
//   ENTERTAINMENT  — Capital One Savor (8x Capital One Entertainment)
//   GAS_STATIONS   — Amex BCE, WF Autograph
//   DRUGSTORES     — Chase Freedom Unlimited, Freedom Flex
//   PHONE_WIRELESS — WF Autograph ("phone plans")
//   GENERAL        — All cards (base catch-all)

const KEYWORD_MAP: Array<{ pattern: RegExp; categories: string[] }> = [
  // TRAVEL_PORTAL: named issuer portals must precede generic "travel" match.
  {
    pattern: /chase travel|capital one travel|amex travel|citi travel|\btravel portal\b|booked through.{0,30}travel/i,
    categories: ["TRAVEL_PORTAL"],
  },
  // TRAVEL_AIRLINES: "with airlines" covers WF Autograph Journey phrasing.
  { pattern: /\bairline\b|airfare|\bflight\b|air travel|with airlines/i, categories: ["TRAVEL_AIRLINES"] },
  // TRAVEL_HOTELS: "with hotels" covers WF Autograph Journey phrasing.
  { pattern: /\bhotel\b|resort|lodging|vacation rental|with hotels/i, categories: ["TRAVEL_HOTELS"] },
  {
    pattern: /\btransit\b|rideshare|lyft|uber|\bparking\b|\btoll\b|\btrain\b|\bbus\b|subway|commut/i,
    categories: ["TRANSIT"],
  },
  { pattern: /\btravel\b|car rental/i, categories: ["TRAVEL_GENERAL"] },
  // WHOLESALE_CLUBS before GROCERY — Costco/Sam's must not fall into GROCERY.
  {
    pattern: /wholesale|costco|sam'?s club|warehouse club/i,
    categories: ["WHOLESALE_CLUBS"],
  },
  {
    pattern: /grocer|supermarket|grocery store|food store|u\.s\. supermarket/i,
    categories: ["GROCERY"],
  },
  {
    pattern: /\bdining\b|restaurant|food delivery|takeout|doordash|grubhub|ubereats/i,
    categories: ["DINING"],
  },
  {
    pattern: /streaming|netflix|spotify|hulu|disney\+|apple tv|\bsubscription/i,
    categories: ["STREAMING"],
  },
  { pattern: /\bentertainment\b|movie|concert|\bevent\b|\bticket\b|\blive\b/i, categories: ["ENTERTAINMENT"] },
  // GAS_STATIONS: "gas" alone would false-positive on "gas-tronomic" etc; require context.
  { pattern: /gas station|\bfuel\b|gas purchase|ev charging|\bgas\b/i, categories: ["GAS_STATIONS"] },
  { pattern: /drugstore|pharmacy|cvs|walgreens|rite aid/i, categories: ["DRUGSTORES"] },
  { pattern: /home improvement|hardware|home depot|lowe'?s/i, categories: ["HOME_IMPROVEMENT"] },
  { pattern: /department store/i, categories: ["DEPARTMENT_STORES"] },
  // PHONE_WIRELESS: require "phone" as a whole word or explicit "wireless plan/bill/service"
  // to avoid "wireless charging" (gas stations) triggering this.
  { pattern: /\bphone\b|wireless (?:plan|bill|service)|cellular (?:plan|bill|service)/i, categories: ["PHONE_WIRELESS"] },
  // GENERAL: catch-all — must be last. "every day" is scoped to avoid false positives
  // on marketing copy like "every day deals".
  {
    pattern: /all other|every(?:thing)? else|all purchases|on (?:all )?purchases|every purchase|on every|every day[.,]/i,
    categories: ["GENERAL"],
  },
];

// ─── Scraping ─────────────────────────────────────────────────────────────────

const PAGE_TIMEOUT_MS = 30_000;

function scrapePageOnce(nwPath: string): string {
  const url = `https://www.nerdwallet.com${nwPath}`;
  // execFileSync avoids the shell entirely — URL never touches a shell interpreter.
  execFileSync("agent-browser", ["open", url], { stdio: "pipe", timeout: PAGE_TIMEOUT_MS });
  // Fixed 2-second wait for JS rendering — avoids forking a shell process.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  const snapshot = execFileSync("agent-browser", ["snapshot"], {
    stdio: "pipe",
    maxBuffer: 10 * 1024 * 1024,
    timeout: PAGE_TIMEOUT_MS,
  }).toString();
  execFileSync("agent-browser", ["close"], { stdio: "pipe", timeout: PAGE_TIMEOUT_MS });
  return snapshot;
}

function scrapePage(nwPath: string): string {
  try {
    return scrapePageOnce(nwPath);
  } catch (firstErr) {
    // Single retry — NerdWallet rate limiting is transient.
    console.warn(`  ⚠️  First attempt failed, retrying in 5s...`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
    return scrapePageOnce(nwPath);
  }
}

// ─── Snapshot parsing ─────────────────────────────────────────────────────────

// Extract all "cell" text strings from an accessibility-tree snapshot.
// Returns them in document order.
function extractCells(snapshot: string): string[] {
  const cells: string[] = [];
  // Cells appear as: - cell "..." [ref=eN]
  // Multi-word cell content is double-quoted; we capture the full quoted value.
  const re = /- cell "([^"]+)"\s+\[ref=e\d+\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(snapshot)) !== null) {
    cells.push(m[1]);
  }
  return cells;
}

const CARD_BRAND_PATTERN =
  /chase|american express|amex|capital one|bank of america|wells fargo|citi|discover|united|marriott/i;
const RATE_PATTERN = /\d+(?:\.\d+)?[x%]/;
// CTA / utility cells that contain a brand name but are NOT card name cells
const CTA_PATTERN =
  /apply now|view rates|view fees|sign up|sign in|learn more|see details|on.*website|read nerdwallet/i;

// Walk extracted cells and pair card-name cells with their reward-rate cells.
// Returns a map: raw card name cell text → reward rate cell text
function buildCardRewardMap(cells: string[]): Map<string, string> {
  const result = new Map<string, string>();
  let pendingCardCell: string | null = null;

  for (const cell of cells) {
    const hasRate = RATE_PATTERN.test(cell);
    const hasBrand = CARD_BRAND_PATTERN.test(cell);
    const isCta = CTA_PATTERN.test(cell);
    // A genuine card name cell: has a brand, no rate pattern, not a CTA, not too long
    const looksLikeCardName =
      hasBrand && !hasRate && !isCta && cell.length > 10 && cell.length < 200;

    if (looksLikeCardName) {
      pendingCardCell = cell;
    } else if (hasRate && pendingCardCell) {
      // Only store if this cell looks like a rewards description
      if (/\bon\b|cash back|points|miles/i.test(cell)) {
        result.set(pendingCardCell, cell);
        pendingCardCell = null;
      }
    }
  }
  return result;
}

interface CardEntry {
  rewardText: string;
  sourcePage: string;
}

// Find a card's reward entry given its lookup fragments.
function findCardEntry(
  cardMap: Map<string, CardEntry>,
  fragments: string[]
): CardEntry | null {
  for (const [nameCell, entry] of cardMap) {
    for (const fragment of fragments) {
      if (nameCell.toLowerCase().includes(fragment.toLowerCase())) {
        return entry;
      }
    }
  }
  return null;
}

// ─── Reward text → RewardRule[] ───────────────────────────────────────────────

function splitClauses(text: string): string[] {
  return (
    text
      // Split on comma before a rate ("...travel, 3x on...").
      // Intentionally comma-only: periods are handled by the sentence split below.
      // Using period here also matches decimal points inside rates like "1.5%",
      // which splits "1.5%" into "1" + "5% cash back on..." causing wrong rates.
      .split(/(?<=,)\s*(?=\d+(?:\.\d+)?[x%])/i)
      // Within each piece, also split on ". Earn/Plus [optional words] N"
      // Handles "Earn 8%", "Earn unlimited 5%", "Plus, earn 3%", etc.
      .flatMap((c) =>
        c.split(/\.\s+(?:earn|plus),?\s+(?:\w+\s+){0,2}(?=\d+(?:\.\d+)?[x%])/i)
      )
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function extractRate(clause: string): number | null {
  // Match "Nx on", "N% cash back on", "Nx points on", "Nx miles with", etc.
  // The optional middle group handles "cash back", "points", "miles", "rewards"
  // (with an optional "total" prefix). Also handles "with" for WF Autograph-style.
  // This skips leading summary ranges like "1x-5x" at the start of NerdWallet cells.
  const onMatch = clause.match(
    /(\d+(?:\.\d+)?)[x%]\s+(?:(?:total\s+)?(?:cash back|points|miles|rewards)\s+)?(?:on|at|with)\b/i
  );
  if (onMatch) return parseFloat(onMatch[1]);
  // Fallback for simple cases like "2% flat"
  const m = clause.match(/(\d+(?:\.\d+)?)[x%]/i);
  return m ? parseFloat(m[1]) : null;
}

function extractSpendLimit(text: string): { amount: number; period: string } | null {
  const m = text.match(
    /up\s+to\s+\$?([\d,]+)\s+(?:per|a|each)\s+(year|quarter|month)/i
  );
  if (!m) return null;
  return { amount: parseFloat(m[1].replace(/,/g, "")), period: m[2].toLowerCase() };
}

function extractExclusions(clause: string): string[] {
  const excluded: string[] = [];
  if (/exclud|except|not\s+includ/i.test(clause)) {
    if (/wholesale|costco|sam'?s|warehouse/i.test(clause)) excluded.push("WHOLESALE_CLUBS");
    if (/superstore|walmart|target/i.test(clause)) excluded.push("GROCERY");
  }
  return excluded;
}

// Remove redundant categories:
// - TRAVEL_PORTAL supersedes TRAVEL_GENERAL (portal is a specific subset of travel)
// - Any specific category supersedes GENERAL (which is only for true catch-alls)
// TRANSIT, TRAVEL_AIRLINES, TRAVEL_HOTELS do NOT supersede TRAVEL_GENERAL — a card
// can genuinely earn the same rate on both specific and general travel.
function deduplicateCategories(cats: string[]): string[] {
  const set = new Set(cats);
  if (set.has("TRAVEL_PORTAL")) set.delete("TRAVEL_GENERAL");
  if ([...set].some((c) => c !== "GENERAL")) set.delete("GENERAL");
  return [...set];
}

function formatRate(rate: number): string {
  // Produce "5x" not "5.0x", "1_5x" not "1.5x" for IDs.
  return Number.isInteger(rate)
    ? `${rate}x`
    : `${rate}`.replace(".", "_") + "x";
}

function makeRuleId(rate: number, categories: string[], existing: Set<string>): string {
  const base = `${formatRate(rate)}_${categories[0].toLowerCase()}`;
  let id = base;
  let n = 2;
  while (existing.has(id)) id = `${base}_${n++}`;
  existing.add(id);
  return id;
}

function parseRewards(
  rewardText: string,
  card: Card,
  sourceUrl: string
): RewardRule[] {
  const earnType =
    card.reward_unit === "cashback_percent" ? "cashback_percent" : "points_multiplier";
  const clauses = splitClauses(rewardText);
  const rules: RewardRule[] = [];
  const usedIds = new Set<string>();

  for (const clause of clauses) {
    const rate = extractRate(clause);
    if (rate === null) continue;

    // Split on commas to find per-category sub-clauses, then collect all matches.
    // e.g. "3x on dining, select streaming services and online groceries"
    //   → ["3x on dining", "select streaming services and online groceries"]
    //   → [DINING, STREAMING, GROCERY]
    const subClauses = clause.split(/,\s*/);
    const rawCategories: string[] = [];
    for (const sub of subClauses) {
      for (const { pattern, categories } of KEYWORD_MAP) {
        if (pattern.test(sub)) rawCategories.push(...categories);
      }
    }
    const uniqueCategories = deduplicateCategories(rawCategories);
    if (uniqueCategories.length === 0) continue;

    const spendLimit = extractSpendLimit(clause);
    const excluded = extractExclusions(clause);

    const rule: RewardRule = {
      rule_id: makeRuleId(rate, uniqueCategories, usedIds),
      categories: uniqueCategories,
      earn_rate: rate,
      earn_type: earnType,
      source_url: `https://www.nerdwallet.com${sourceUrl}`,
      source_last_verified: new Date().toISOString(),
    };

    if (excluded.length) rule.excluded_categories = excluded;
    if (spendLimit) {
      rule.spend_limit_amount = spendLimit.amount;
      rule.spend_limit_reset_period = spendLimit.period;
    }

    rules.push(rule);
  }

  // Deduplicate rules with identical rate + category signature (same content, different IDs)
  const seen = new Set<string>();
  const deduped: RewardRule[] = [];
  for (const rule of rules) {
    const sig = `${rule.earn_rate}|${[...rule.categories].sort().join(",")}`;
    if (!seen.has(sig)) {
      seen.add(sig);
      deduped.push(rule);
    }
  }
  const dedupedRules = deduped;

  // Ensure a GENERAL base rule always exists
  if (!dedupedRules.some((r) => r.categories.includes("GENERAL") || r.categories.length === 0)) {
    dedupedRules.push({
      rule_id: `base_${formatRate(card.base_earn_rate)}`,
      categories: ["GENERAL"],
      earn_rate: card.base_earn_rate,
      earn_type: earnType,
      source_url: `https://www.nerdwallet.com${sourceUrl}`,
      source_last_verified: new Date().toISOString(),
    });
  }

  return dedupedRules;
}

// ─── Diff helper (dry-run display) ────────────────────────────────────────────

function diffRules(oldRules: RewardRule[], newRules: RewardRule[]): string {
  const lines: string[] = [];
  const oldMap = Object.fromEntries(oldRules.map((r) => [r.rule_id, r]));
  const newMap = Object.fromEntries(newRules.map((r) => [r.rule_id, r]));

  for (const id of new Set([...Object.keys(oldMap), ...Object.keys(newMap)])) {
    const o = oldMap[id];
    const n = newMap[id];
    if (!o) {
      lines.push(`  + ${id}: ${n.earn_rate}x on ${n.categories.join(", ")}`);
    } else if (!n) {
      lines.push(`  - ${id}: ${o.earn_rate}x on ${o.categories.join(", ")}`);
    } else if (
      o.earn_rate !== n.earn_rate ||
      JSON.stringify(o.categories) !== JSON.stringify(n.categories)
    ) {
      lines.push(
        `  ~ ${id}: ${o.earn_rate}x [${o.categories.join(",")}] → ${n.earn_rate}x [${n.categories.join(",")}]`
      );
    }
  }
  return lines.length ? lines.join("\n") : "  (no changes)";
}

// ─── Output validation ────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set([
  "GROCERY", "DINING", "TRAVEL_GENERAL", "TRAVEL_HOTELS", "TRAVEL_AIRLINES",
  "TRAVEL_PORTAL", "STREAMING", "ENTERTAINMENT", "GAS_STATIONS", "DRUGSTORES",
  "HOME_IMPROVEMENT", "TRANSIT", "DEPARTMENT_STORES", "WHOLESALE_CLUBS",
  "PHONE_WIRELESS", "GENERAL",
]);
const VALID_EARN_TYPES = new Set(["cashback_percent", "points_multiplier"]);

function validateRules(card: Card): string[] {
  const errors: string[] = [];
  if (!card.reward_rules.length) {
    errors.push(`${card.id}: no reward_rules`);
    return errors;
  }
  for (const rule of card.reward_rules) {
    if (!rule.rule_id) errors.push(`${card.id}: rule missing rule_id`);
    if (!(rule.earn_rate > 0)) errors.push(`${card.id}/${rule.rule_id}: earn_rate must be > 0 (got ${rule.earn_rate})`);
    if (!VALID_EARN_TYPES.has(rule.earn_type))
      errors.push(`${card.id}/${rule.rule_id}: invalid earn_type "${rule.earn_type}"`);
    if (!rule.categories.length)
      errors.push(`${card.id}/${rule.rule_id}: empty categories array`);
    for (const cat of rule.categories) {
      if (!VALID_CATEGORIES.has(cat))
        errors.push(`${card.id}/${rule.rule_id}: unknown category "${cat}"`);
    }
  }
  return errors;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const cardFilter = args.includes("--card")
    ? args[args.indexOf("--card") + 1]
    : null;

  const cardsPath = path.resolve(import.meta.dirname ?? ".", "../data/seed/cards.json");
  const cards: Card[] = JSON.parse(fs.readFileSync(cardsPath, "utf-8"));

  const targets = cardFilter
    ? cards.filter((c) => c.id === cardFilter)
    : cards.filter((c) => CARD_LOOKUP[c.id]);

  if (cardFilter && targets.length === 0) {
    console.error(`Card "${cardFilter}" not found. Available IDs:`);
    console.error(Object.keys(CARD_LOOKUP).join(", "));
    process.exit(1);
  }

  console.log(`\n🔍 Scraping NerdWallet for ${targets.length} card(s)${dryRun ? " [DRY RUN]" : ""}...\n`);

  // Phase 1: Scrape all source pages and build a unified card→reward map.
  // Only scrape pages needed for the requested cards when --card is set.
  console.log("📡 Phase 1: Fetching NerdWallet category pages...\n");
  const cardMap = new Map<string, CardEntry>(); // nameCell → { rewardText, sourcePage }

  // When filtering to a single card, only scrape pages likely to have it.
  const pagesToScrape = cardFilter ? SOURCE_PAGES : SOURCE_PAGES;

  for (const page of pagesToScrape) {
    console.log(`  Scraping ${page}...`);
    try {
      const snapshot = scrapePage(page);
      const cells = extractCells(snapshot);
      const pageMap = buildCardRewardMap(cells);
      for (const [name, reward] of pageMap) {
        if (!cardMap.has(name)) {
          cardMap.set(name, { rewardText: reward, sourcePage: page });
        }
      }
      console.log(`  ✓ Found ${pageMap.size} card(s) on this page`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Failed to scrape ${page}: ${msg}`);
    }

    // Stop early if we already found everything we need.
    if (cardFilter) {
      const fragments = CARD_LOOKUP[cardFilter] ?? [];
      if (findCardEntry(cardMap, fragments)) {
        console.log(`  ✓ Found target card — skipping remaining pages\n`);
        break;
      }
    }

    console.log();
  }

  console.log(`📊 Total unique cards found across all pages: ${cardMap.size}\n`);

  // Phase 2: Match each target card and parse its reward rules.
  console.log("🔄 Phase 2: Parsing rewards for each card...\n");

  const results: { id: string; success: boolean; rulesCount: number; found: boolean; error?: string }[] = [];

  for (const card of targets) {
    const fragments = CARD_LOOKUP[card.id] ?? [];
    console.log(`📄 ${card.name}`);

    const entry = findCardEntry(cardMap, fragments);

    if (!entry) {
      console.warn(`  ⚠️  Not found on any scraped page — keeping existing rules`);
      results.push({ id: card.id, success: true, rulesCount: card.reward_rules.length, found: false });
      console.log();
      continue;
    }

    console.log(`  Reward text: "${entry.rewardText.slice(0, 120)}..."`);

    const newRules = parseRewards(entry.rewardText, card, entry.sourcePage);
    const diff = diffRules(card.reward_rules, newRules);
    console.log(`  Changes:\n${diff}`);

    card.reward_rules = newRules;
    results.push({ id: card.id, success: true, rulesCount: newRules.length, found: true });
    console.log();
  }

  // Phase 3: Validate, then write atomically with a backup.
  if (!dryRun) {
    const outputCards = Object.values(
      Object.fromEntries(cards.map((c) => [c.id, c]))
    );

    // Validate all updated cards before touching the file.
    const validationErrors = outputCards.flatMap((c) =>
      results.find((r) => r.id === c.id && r.found) ? validateRules(c) : []
    );
    if (validationErrors.length) {
      console.error("\n❌ Validation failed — cards.json was NOT modified:");
      validationErrors.forEach((e) => console.error(`   ${e}`));
      process.exit(1);
    }

    // Backup existing file, then write atomically via tmp + rename.
    const backupPath = `${cardsPath}.bak`;
    const tmpPath = `${cardsPath}.tmp`;
    fs.copyFileSync(cardsPath, backupPath);
    fs.writeFileSync(tmpPath, JSON.stringify(outputCards, null, 2) + "\n");
    fs.renameSync(tmpPath, cardsPath);
    console.log(`✅ Written to ${cardsPath} (backup at ${backupPath})`);
  }

  // Summary
  console.log("=".repeat(60));
  const found = results.filter((r) => r.found);
  const notFound = results.filter((r) => !r.found);
  const failed = results.filter((r) => !r.success);
  console.log(`✅ ${found.length} card(s) updated from live data`);
  if (notFound.length) {
    console.log(`⚠️  ${notFound.length} card(s) not found on scraped pages (kept existing):`);
    notFound.forEach((r) => console.log(`   ${r.id}`));
  }
  if (failed.length) {
    console.log(`❌ ${failed.length} card(s) errored:`);
    failed.forEach((r) => console.log(`   ${r.id}: ${r.error}`));
  }
  if (dryRun) console.log("\n⚠️  Dry run — cards.json was NOT modified");
  console.log("=".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
