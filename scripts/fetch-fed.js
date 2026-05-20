// Fetch RSS press releases from US regulators: Fed, Treasury, OCC, SEC Press.
// All are public Tier 1 sources — no auth, no key.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchXML } from './lib/http.js';
import { makeId } from './lib/citation.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = join(SCRIPT_DIR, '..', 'config', 'sources-us.json');

function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function extractItems(parsed) {
  // Try Atom first, then RSS 2.0
  if (parsed?.feed?.entry) {
    return asArray(parsed.feed.entry).map((e) => ({
      title: typeof e.title === 'string' ? e.title : e.title?.['#text'] || '',
      link: e.link?.['@_href'] || e.link?.href || (typeof e.link === 'string' ? e.link : ''),
      date: e.updated || e.published,
      summary: (typeof e.summary === 'string' ? e.summary : e.summary?.['#text'] || '') ||
               (typeof e.content === 'string' ? e.content : e.content?.['#text'] || ''),
    }));
  }
  if (parsed?.rss?.channel?.item) {
    return asArray(parsed.rss.channel.item).map((e) => ({
      title: typeof e.title === 'string' ? e.title : e.title?.['#text'] || '',
      link: typeof e.link === 'string' ? e.link : e.link?.['#text'] || '',
      date: e.pubDate || e['dc:date'],
      summary: typeof e.description === 'string' ? e.description : e.description?.['#text'] || '',
    }));
  }
  return [];
}

export async function fetchRegulators(sources) {
  const out = [];
  const cutoff = Date.now() - sources.limits.regulator_lookback_hours * 3_600_000;

  for (const feed of sources.regulators.feeds) {
    let parsed;
    try {
      parsed = await fetchXML(feed.url);
    } catch (err) {
      console.warn(`[regulators] ${feed.name}: ${err.message}`);
      continue;
    }

    for (const it of extractItems(parsed)) {
      if (!it.title || !it.link || !it.date) continue;
      const ts = Date.parse(it.date);
      if (isNaN(ts) || ts < cutoff) continue;

      const summary = (it.summary || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);

      out.push({
        id: makeId([feed.name, it.title, ts]),
        title: it.title.trim().slice(0, 200),
        source_name: feed.name,
        source_tier: 1,
        source_url: it.link.trim(),
        published_at: new Date(ts).toISOString(),
        raw_excerpt: summary || it.title.trim(),
        region: 'US',
        topics: ['regulatory'],
      });
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sources = JSON.parse(await readFile(SOURCES_PATH, 'utf-8'));
  const items = await fetchRegulators(sources);
  console.log(`[regulators] fetched ${items.length} items`);
  console.log(JSON.stringify(items.slice(0, 3), null, 2));
}
