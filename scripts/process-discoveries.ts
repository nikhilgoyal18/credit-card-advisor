/**
 * process-discoveries.ts
 *
 * Reads the merchant_discovery_queue table and exports pending entries
 * so Claude Code can classify them and suggest additions to merchants.json.
 *
 * Usage:
 *   npx tsx process-discoveries.ts --export
 *   npx tsx process-discoveries.ts --mark-done added   name1 "name2" ...
 *   npx tsx process-discoveries.ts --mark-done rejected name1 "name2" ...
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Load env from scripts/.env
function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '.env'), 'utf-8');
    for (const line of raw.split('\n')) {
      const [k, ...v] = line.split('=');
      if (k?.trim() && !process.env[k.trim()]) {
        process.env[k.trim()] = v.join('=').trim();
      }
    }
  } catch { /* .env optional if vars already set */ }
}

loadEnv();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function exportDiscoveries() {
  const { data, error } = await supabase
    .from('merchant_discovery_queue')
    .select('osm_name, normalized_name, osm_category, seen_count')
    .eq('status', 'pending')
    .gte('seen_count', 1)
    .order('seen_count', { ascending: false });

  if (error) { console.error('Supabase error:', error.message); process.exit(1); }
  if (!data?.length) { console.log('No pending discoveries.'); return; }

  const outPath = resolve(ROOT, 'data/seed/discovery-raw-list.json');
  writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`✓ Exported ${data.length} merchants → ${outPath}`);
  console.log('\nNext step: ask Claude Code to "process my discoveries"');
}

async function markDone(status: 'added' | 'rejected', names: string[]) {
  if (!names.length) { console.error('Provide at least one normalized_name'); process.exit(1); }

  const { error } = await supabase
    .from('merchant_discovery_queue')
    .update({ status })
    .in('normalized_name', names);

  if (error) { console.error('Supabase error:', error.message); process.exit(1); }
  console.log(`✓ Marked ${names.length} entries as "${status}"`);
}

const [,, mode, ...rest] = process.argv;

if (mode === '--export' || !mode) {
  exportDiscoveries();
} else if (mode === '--mark-done') {
  const status = rest[0] as 'added' | 'rejected';
  if (status !== 'added' && status !== 'rejected') {
    console.error('Status must be "added" or "rejected"');
    process.exit(1);
  }
  markDone(status, rest.slice(1));
} else {
  console.error('Usage: --export | --mark-done <added|rejected> <name1> <name2> ...');
  process.exit(1);
}
