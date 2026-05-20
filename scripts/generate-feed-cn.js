// Server-side orchestrator for the China region.
// Mirrors generate-feed.js exactly but reads sources-cn.json + writes feed-cn.json.
// Kept as a separate file (rather than parameterizing generate-feed.js) so:
//   1. The US pipeline continues to work without changes;
//   2. CI can run them independently — if CN fetchers are flaky, US still ships.
//
// Run via:  npm run fetch:cn

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchCNRegulators } from './fetch-cn.js';
import { verifyAll, reportDropped } from './verify-citation.js';
import { loadState, saveState, filterUnseen } from './lib/state.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, '..');
const SOURCES_PATH = join(ROOT, 'config', 'sources-cn.json');
const FEED_PATH = join(ROOT, 'feed-cn.json');
const STATE_PATH = join(ROOT, 'state-feed-cn.json');

async function main() {
  const sources = JSON.parse(await readFile(SOURCES_PATH, 'utf-8'));
  const state = await loadState(STATE_PATH);

  console.log('[generate-cn] starting CN fetch...');

  const [regulators] = await Promise.allSettled([fetchCNRegulators(sources)]);

  const summarize = (label, r) => {
    if (r.status === 'fulfilled') {
      console.log(`[generate-cn] ${label}: ${r.value.length} items`);
      return r.value;
    }
    console.warn(`[generate-cn] ${label}: FAILED — ${r.reason?.message || r.reason}`);
    return [];
  };

  const all = [...summarize('regulators', regulators)];

  const fresh = filterUnseen(all, state);
  console.log(`[generate-cn] ${fresh.length} fresh items (${all.length - fresh.length} already seen)`);

  const { kept, dropped } = verifyAll(fresh);
  reportDropped(dropped);

  kept.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

  const feed = {
    region: 'CN',
    generated_at: new Date().toISOString(),
    counts: {
      total: kept.length,
      by_tier: { 1: kept.filter((k) => k.source_tier === 1).length, 2: kept.filter((k) => k.source_tier === 2).length },
      by_source: kept.reduce((acc, k) => ((acc[k.source_name] = (acc[k.source_name] || 0) + 1), acc), {}),
    },
    items: kept,
  };

  await writeFile(FEED_PATH, JSON.stringify(feed, null, 2));
  await saveState(STATE_PATH, state);

  console.log(`[generate-cn] wrote ${FEED_PATH} (${kept.length} items)`);
}

main().catch((err) => {
  console.error('[generate-cn] FATAL:', err);
  process.exit(1);
});
