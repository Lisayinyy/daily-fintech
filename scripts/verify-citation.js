// The differentiator. Every feed entry runs through validateCitation();
// failures are dropped + logged. This is what makes the brief trustworthy.

import { validateCitation } from './lib/citation.js';

export function verifyAll(items) {
  const kept = [];
  const dropped = [];
  for (const it of items) {
    const { valid, errors } = validateCitation(it);
    if (valid) kept.push(it);
    else dropped.push({ id: it.id || '(no id)', title: it.title || '(no title)', errors });
  }
  return { kept, dropped };
}

export function reportDropped(dropped) {
  if (!dropped.length) {
    console.log('[verify] 0 items dropped — all citations valid.');
    return;
  }
  console.log(`[verify] DROPPED ${dropped.length} item(s) for failing citation rules:`);
  for (const d of dropped.slice(0, 20)) {
    console.log(`  - ${d.id} :: ${d.title}`);
    for (const e of d.errors) console.log(`      • ${e}`);
  }
  if (dropped.length > 20) console.log(`  ... and ${dropped.length - 20} more.`);
}

// CLI: validate an existing feed-us.json
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFile } = await import('node:fs/promises');
  const path = process.argv[2] || 'feed-us.json';
  const feed = JSON.parse(await readFile(path, 'utf-8'));
  const items = feed.items || feed;
  const { kept, dropped } = verifyAll(items);
  reportDropped(dropped);
  console.log(`[verify] kept ${kept.length} / ${items.length}`);
}
