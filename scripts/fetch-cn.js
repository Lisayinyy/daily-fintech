// Fetch RSS press releases from PRC regulators.
// As of 2026-05-20, only NBS (国家统计局) publishes a valid public RSS feed in the PRC
// regulator landscape. CSRC / PBoC / HKEX / SSE / SZSE / NFRA / SAFE all dropped RSS
// or moved to JS-rendered SPA + WAF protection — see config/sources-cn.json `_blocked`
// for the full list and the reason each is excluded.
//
// This fetcher mirrors fetch-fed.js exactly (Atom + RSS dual-format parsing). It is
// deliberately *not* a scraper — the project's whole guarantee is "every link goes back
// to a primary RSS/Atom document the reader can open." If you add HTML scraping here
// you break that guarantee, so resist the temptation.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchXML } from './lib/http.js';
import { makeId } from './lib/citation.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = join(SCRIPT_DIR, '..', 'config', 'sources-cn.json');

function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function extractItems(parsed) {
  // NBS feeds are RSS 2.0 with non-standard <pubTime> alongside <pubDate>.
  // Prefer pubDate if both exist.
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
      date: e.pubDate || e['dc:date'] || e.pubTime,
      summary: typeof e.description === 'string' ? e.description : e.description?.['#text'] || '',
    }));
  }
  return [];
}

// NBS uses "2026-05-18 10:00:05" (local Beijing time, no zone). Tag it as +08:00 explicitly
// so Date.parse gives a real timestamp instead of a NaN or treating-as-UTC.
function normalizeDate(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  // If it already has a timezone or looks ISO with T, leave it.
  if (/[Tt]/.test(trimmed) || /[+-]\d{2}:?\d{2}|Z$/.test(trimmed)) return trimmed;
  // Pattern: YYYY-MM-DD HH:MM:SS  →  YYYY-MM-DDTHH:MM:SS+08:00
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(:(\d{2}))?$/);
  if (m) {
    const [, y, mo, d, h, mi, , s = '00'] = m;
    return `${y}-${mo}-${d}T${h}:${mi}:${s}+08:00`;
  }
  return trimmed;
}

export async function fetchCNRegulators(sources) {
  const out = [];
  const cutoff = Date.now() - sources.limits.regulator_lookback_hours * 3_600_000;

  for (const feed of sources.regulators.feeds) {
    let parsed;
    try {
      parsed = await fetchXML(feed.url);
    } catch (err) {
      console.warn(`[cn-regulators] ${feed.name}: ${err.message}`);
      continue;
    }

    for (const it of extractItems(parsed)) {
      if (!it.title || !it.link || !it.date) continue;
      const ts = Date.parse(normalizeDate(it.date));
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
        region: 'CN',
        topics: ['regulatory', feed.topic_hint || 'macro'].filter(Boolean),
      });
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sources = JSON.parse(await readFile(SOURCES_PATH, 'utf-8'));
  const items = await fetchCNRegulators(sources);
  console.log(`[cn-regulators] fetched ${items.length} items`);
  console.log(JSON.stringify(items.slice(0, 3), null, 2));
}
