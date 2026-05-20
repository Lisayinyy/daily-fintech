// Tiny HTTP helper: user-agent + retry + timeout.
// SEC EDGAR explicitly requires a descriptive User-Agent — anonymous requests get 403.

import { setTimeout as sleep } from 'node:timers/promises';
import { XMLParser } from 'fast-xml-parser';

const USER_AGENT =
  process.env.DAILY_FINTECH_UA ||
  'DailyFintechBrief/0.1 (research; github.com/Lisayinyy/daily-fintech)';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
});

export async function fetchText(url, { retries = 3, timeout = 30_000, headers = {} } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: '*/*', ...headers },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} @ ${url}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(1000 * attempt); // 1s, 2s back-off
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}

export async function fetchJSON(url, opts = {}) {
  const txt = await fetchText(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers || {}) } });
  return JSON.parse(txt);
}

export async function fetchXML(url, opts = {}) {
  const txt = await fetchText(url, { ...opts, headers: { Accept: 'application/atom+xml, application/rss+xml, application/xml', ...(opts.headers || {}) } });
  return xmlParser.parse(txt);
}
