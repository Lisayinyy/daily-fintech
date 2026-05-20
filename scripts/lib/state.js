// Dedup state — prevents the same SEC filing or press release from showing up twice.
// Pattern follows follow-builders/state-feed.json: a flat map of {id -> firstSeenAt}.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const PRUNE_AFTER_DAYS = 14;

export async function loadState(path) {
  if (!existsSync(path)) return { seen: {} };
  try {
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    return { seen: {} };
  }
}

export async function saveState(path, state) {
  // Prune entries older than PRUNE_AFTER_DAYS to keep the file small.
  const cutoff = Date.now() - PRUNE_AFTER_DAYS * 24 * 3_600_000;
  const pruned = {};
  for (const [id, ts] of Object.entries(state.seen)) {
    if (typeof ts === 'number' && ts >= cutoff) pruned[id] = ts;
  }
  state.seen = pruned;
  await writeFile(path, JSON.stringify(state, null, 2));
}

export function filterUnseen(items, state) {
  const now = Date.now();
  const fresh = [];
  for (const it of items) {
    if (!state.seen[it.id]) {
      state.seen[it.id] = now;
      fresh.push(it);
    }
  }
  return fresh;
}
