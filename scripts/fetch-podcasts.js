// Fetch investment-bank thought-leadership podcasts (Goldman Sachs Exchanges,
// Morgan Stanley Thoughts on the Market) and transcribe via pod2txt.
//
// Requires POD2TXT_API_KEY env var. Same service follow-builders uses.
// If the key is missing, this fetcher returns [] (podcast section just won't appear).

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { fetchXML, fetchJSON, fetchText } from './lib/http.js';
import { makeId } from './lib/citation.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = join(SCRIPT_DIR, '..', 'config', 'sources-us.json');
const POD2TXT_BASE = 'https://pod2txt.vercel.app/api';

function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

async function transcribe(audioUrl, apiKey) {
  // Kick off async transcription, then poll. Mirrors follow-builders' fetch-podcasts pattern.
  const submit = await fetchJSON(`${POD2TXT_BASE}/transcribe`, {
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    // fetch() needs method+body manually; we work around via wrapper:
  }).catch(() => null);

  // The minimal flow: POST audio URL, get job id, poll status, return transcript.
  // We use a low-level fetch here so we can POST.
  const startRes = await fetch(`${POD2TXT_BASE}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({ url: audioUrl }),
  });
  if (!startRes.ok) throw new Error(`pod2txt start failed: ${startRes.status}`);
  const { job_id } = await startRes.json();

  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(30_000);
    const poll = await fetch(`${POD2TXT_BASE}/status/${job_id}`, {
      headers: { 'X-Api-Key': apiKey },
    });
    if (poll.ok) {
      const data = await poll.json();
      if (data.status === 'done' && data.transcript) return data.transcript;
      if (data.status === 'failed') throw new Error(`pod2txt failed: ${data.error || 'unknown'}`);
    }
  }
  throw new Error('pod2txt timed out after 5 attempts');
}

export async function fetchPodcasts(sources) {
  const apiKey = process.env.POD2TXT_API_KEY;
  if (!apiKey) {
    console.warn('[podcasts] POD2TXT_API_KEY not set — skipping podcast transcription.');
    return [];
  }

  const out = [];
  const cutoff = Date.now() - sources.limits.podcast_lookback_hours * 3_600_000;

  for (const feed of sources.investment_bank_podcasts.feeds) {
    let parsed;
    try {
      parsed = await fetchXML(feed.url);
    } catch (err) {
      console.warn(`[podcasts] ${feed.name}: ${err.message}`);
      continue;
    }

    const items = asArray(parsed?.rss?.channel?.item || []).slice(0, 3);
    for (const e of items) {
      const title = (typeof e.title === 'string' ? e.title : e.title?.['#text'] || '').trim();
      const dateRaw = e.pubDate;
      const audioUrl = e.enclosure?.['@_url'];
      const itemLink =
        (typeof e.link === 'string' ? e.link : e.link?.['#text']) ||
        e.guid?.['#text'] ||
        e.guid ||
        '';

      if (!title || !dateRaw || !audioUrl) continue;
      const ts = Date.parse(dateRaw);
      if (isNaN(ts) || ts < cutoff) continue;

      let transcript = '';
      try {
        transcript = await transcribe(audioUrl, apiKey);
      } catch (err) {
        console.warn(`[podcasts] transcribe ${title}: ${err.message}`);
        continue;
      }

      out.push({
        id: makeId([feed.name, title, ts]),
        title: title.slice(0, 200),
        source_name: feed.name,
        source_tier: 2,
        source_url: itemLink || feed.url,
        published_at: new Date(ts).toISOString(),
        raw_excerpt: transcript.slice(0, 2000),
        region: 'US',
        topics: ['ib-commentary'],
        meta: { audio_url: audioUrl, full_transcript_length: transcript.length },
      });
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sources = JSON.parse(await readFile(SOURCES_PATH, 'utf-8'));
  const items = await fetchPodcasts(sources);
  console.log(`[podcasts] fetched ${items.length} items`);
  console.log(JSON.stringify(items.slice(0, 1), null, 2));
}
