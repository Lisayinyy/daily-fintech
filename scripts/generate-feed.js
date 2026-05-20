// Server-side orchestrator. Runs in GitHub Actions on a cron.
// Calls every fetcher in parallel, dedupes via state, verifies citations,
// then writes feed-us.json + state-feed.json.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchSEC } from './fetch-sec.js';
import { fetchRegulators } from './fetch-fed.js';
import { fetchVCBlogs } from './fetch-vc.js';
import { fetchPodcasts } from './fetch-podcasts.js';
import { verifyAll, reportDropped } from './verify-citation.js';
import { loadState, saveState, filterUnseen } from './lib/state.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, '..');
const SOURCES_PATH = join(ROOT, 'config', 'sources-us.json');
const FEED_PATH = join(ROOT, 'feed-us.json');
const STATE_PATH = join(ROOT, 'state-feed.json');

async function main() {
  const sources = JSON.parse(await readFile(SOURCES_PATH, 'utf-8'));
  const state = await loadState(STATE_PATH);

  console.log('[generate] starting US fetch...');

  const [sec, regulators, vc, podcasts] = await Promise.allSettled([
    fetchSEC(sources),
    fetchRegulators(sources),
    fetchVCBlogs(sources),
    fetchPodcasts(sources),
  ]);

  const summarize = (label, r) => {
    if (r.status === 'fulfilled') {
      console.log(`[generate] ${label}: ${r.value.length} items`);
      return r.value;
    }
    console.warn(`[generate] ${label}: FAILED — ${r.reason?.message || r.reason}`);
    return [];
  };

  const all = [
    ...summarize('sec', sec),
    ...summarize('regulators', regulators),
    ...summarize('vc', vc),
    ...summarize('podcasts', podcasts),
  ];

  // Dedup via state (only fresh-to-us items go forward).
  const fresh = filterUnseen(all, state);
  console.log(`[generate] ${fresh.length} fresh items (${all.length - fresh.length} already seen)`);

  // Verify citations — drop anything missing required fields.
  const { kept, dropped } = verifyAll(fresh);
  reportDropped(dropped);

  // Sort newest first.
  kept.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

  const feed = {
    region: 'US',
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

  console.log(`[generate] wrote ${FEED_PATH} (${kept.length} items)`);
}

main().catch((err) => {
  console.error('[generate] FATAL:', err);
  process.exit(1);
});
