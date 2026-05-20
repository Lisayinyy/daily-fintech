// Fetch top-tier VC blog posts (a16z, Sequoia, Bessemer, Lightspeed).
// These are Tier 2 sources — investment-thesis posts and portfolio announcements with named authors.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchXML } from './lib/http.js';
import { makeId } from './lib/citation.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = join(SCRIPT_DIR, '..', 'config', 'sources-us.json');

const AI_FINTECH_KEYWORDS = [
  'ai', 'llm', 'gpt', 'model', 'agent', 'inference', 'gpu', 'training',
  'fintech', 'banking', 'payment', 'capital', 'invest', 'fund', 'round',
  'series ', 'seed', 'valuation', 'crypto', 'stablecoin', 'defi',
  'openai', 'anthropic', 'mistral', 'nvidia', 'palantir',
];

function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function looksRelevant(title, summary) {
  const hay = `${title} ${summary}`.toLowerCase();
  return AI_FINTECH_KEYWORDS.some((kw) => hay.includes(kw));
}

export async function fetchVCBlogs(sources) {
  const out = [];
  const cutoff = Date.now() - sources.limits.vc_lookback_hours * 3_600_000;

  for (const feed of sources.vc_blogs.feeds) {
    let parsed;
    try {
      parsed = await fetchXML(feed.url);
    } catch (err) {
      console.warn(`[vc] ${feed.name}: ${err.message}`);
      continue;
    }

    const items = asArray(parsed?.rss?.channel?.item || parsed?.feed?.entry || []);

    for (const e of items) {
      const title = (typeof e.title === 'string' ? e.title : e.title?.['#text'] || '').trim();
      const link =
        (typeof e.link === 'string' ? e.link : null) ||
        e.link?.['@_href'] ||
        e.link?.href ||
        '';
      const dateRaw = e.pubDate || e['dc:date'] || e.updated || e.published;
      const summaryRaw =
        (typeof e.description === 'string' ? e.description : e.description?.['#text']) ||
        (typeof e.summary === 'string' ? e.summary : e.summary?.['#text']) ||
        (typeof e['content:encoded'] === 'string' ? e['content:encoded'] : '') ||
        '';

      if (!title || !link || !dateRaw) continue;
      const ts = Date.parse(dateRaw);
      if (isNaN(ts) || ts < cutoff) continue;

      const summary = summaryRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);

      // Topic-filter: only AI / fintech-relevant posts.
      if (!looksRelevant(title, summary)) continue;

      out.push({
        id: makeId([feed.name, title, ts]),
        title: title.slice(0, 200),
        source_name: feed.name,
        source_tier: 2,
        source_url: link.trim(),
        published_at: new Date(ts).toISOString(),
        raw_excerpt: summary || title,
        region: 'US',
        topics: ['vc-thesis'],
      });
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sources = JSON.parse(await readFile(SOURCES_PATH, 'utf-8'));
  const items = await fetchVCBlogs(sources);
  console.log(`[vc] fetched ${items.length} items`);
  console.log(JSON.stringify(items.slice(0, 3), null, 2));
}
