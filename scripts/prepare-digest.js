// Client side. Runs on YOUR machine (or in Claude Code).
// Downloads feed-us.json from GitHub (the public raw URL), loads the prompts,
// and emits one JSON bundle on stdout that Claude reads.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchJSON, fetchText } from './lib/http.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, '..');

// Public raw URL — the only seam between the server and client pipelines.
const FEED_US_URL = 'https://raw.githubusercontent.com/Lisayinyy/daily-fintech/main/feed-us.json';
const FEED_CN_URL = 'https://raw.githubusercontent.com/Lisayinyy/daily-fintech/main/feed-cn.json';
const PROMPTS_BASE = 'https://raw.githubusercontent.com/Lisayinyy/daily-fintech/main/prompts';

const PROMPT_FILES = ['morning-brief.md', 'classify-topic.md', 'tier-rules.md'];

const userPromptsDir = join(homedir(), '.daily-fintech', 'prompts');
const localPromptsDir = join(ROOT, 'prompts');

async function loadConfig() {
  // Optional user config in ~/.daily-fintech/config.json
  const p = join(homedir(), '.daily-fintech', 'config.json');
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(await readFile(p, 'utf-8'));
  } catch {
    return {};
  }
}

async function loadFeed() {
  // Try remote first; fall back to local feed-us.json (useful when offline / on the actions runner).
  try {
    return await fetchJSON(FEED_US_URL);
  } catch (err) {
    const local = join(ROOT, 'feed-us.json');
    if (existsSync(local)) {
      console.warn(`[digest] remote feed unreachable (${err.message}); using local copy.`);
      return JSON.parse(await readFile(local, 'utf-8'));
    }
    throw err;
  }
}

async function loadFeedCN() {
  // CN feed is optional — return null if both remote and local are missing.
  // P4 status: NBS-only, see config/sources-cn.json `_blocked` for why CSRC/PBoC/HKEX aren't in.
  try {
    return await fetchJSON(FEED_CN_URL);
  } catch {
    const local = join(ROOT, 'feed-cn.json');
    if (existsSync(local)) {
      try { return JSON.parse(await readFile(local, 'utf-8')); } catch { return null; }
    }
    return null;
  }
}

function mergeFeeds(us, cn) {
  // Combine items from both regions and resort by published_at desc.
  // Keep per-region counts as well as a combined total — Claude reads either.
  const items = [...(us?.items || []), ...(cn?.items || [])];
  items.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

  const counts = {
    total: items.length,
    by_region: {
      US: us?.counts?.total || 0,
      CN: cn?.counts?.total || 0,
    },
    by_tier: {
      1: items.filter((k) => k.source_tier === 1).length,
      2: items.filter((k) => k.source_tier === 2).length,
    },
    by_source: items.reduce((acc, k) => ((acc[k.source_name] = (acc[k.source_name] || 0) + 1), acc), {}),
  };

  return {
    regions: cn ? ['US', 'CN'] : ['US'],
    generated_at: new Date().toISOString(),
    counts,
    items,
  };
}

async function loadPrompts() {
  // Waterfall: user dir → GitHub remote → local bundled copy.
  const prompts = {};
  for (const filename of PROMPT_FILES) {
    const key = filename.replace('.md', '').replace(/-/g, '_');
    const userPath = join(userPromptsDir, filename);
    const localPath = join(localPromptsDir, filename);

    if (existsSync(userPath)) {
      prompts[key] = await readFile(userPath, 'utf-8');
      continue;
    }
    try {
      prompts[key] = await fetchText(`${PROMPTS_BASE}/${filename}`);
      continue;
    } catch {
      /* fall through */
    }
    if (existsSync(localPath)) {
      prompts[key] = await readFile(localPath, 'utf-8');
    }
  }
  return prompts;
}

async function main() {
  const config = await loadConfig();
  const [us, cn, prompts] = await Promise.all([loadFeed(), loadFeedCN(), loadPrompts()]);
  const feed = mergeFeeds(us, cn);

  const bundle = {
    status: 'ok',
    generated_at: new Date().toISOString(),
    config: {
      language: config.language || 'en',
      regions: config.regions || feed.regions,
      delivery: config.delivery || { method: 'stdout' },
    },
    prompts,
    feed,
    stats: feed.counts || {},
  };

  // Default: write to stdout so the caller can pipe it into Claude.
  // Optional: write to file if --out=path given.
  const outFlag = process.argv.find((a) => a.startsWith('--out='));
  if (outFlag) {
    const path = outFlag.slice('--out='.length);
    await writeFile(path, JSON.stringify(bundle, null, 2));
    console.error(`[digest] wrote ${path} (${feed.items?.length || 0} items)`);
  } else {
    process.stdout.write(JSON.stringify(bundle, null, 2));
  }
}

main().catch((err) => {
  console.error('[digest] FATAL:', err);
  process.exit(1);
});
