// Fetch SEC EDGAR filings for each tracked company.
// SEC EDGAR exposes an Atom feed per company per filing type:
//   https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={CIK}&type={TYPE}&output=atom

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchXML } from './lib/http.js';
import { makeId } from './lib/citation.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = join(SCRIPT_DIR, '..', 'config', 'sources-us.json');

function buildEdgarUrl(cik, type, count = 10) {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${encodeURIComponent(type)}&dateb=&owner=include&count=${count}&output=atom`;
}

function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

export async function fetchSEC(sources) {
  const out = [];
  const { companies, filing_types, user_agent_required } = sources.sec_edgar;
  const limit = sources.limits.sec_filings_per_company;

  for (const company of companies) {
    for (const filingType of filing_types) {
      const url = buildEdgarUrl(company.cik, filingType, limit);
      let parsed;
      try {
        parsed = await fetchXML(url, {
          headers: { 'User-Agent': user_agent_required || 'DailyFintechBrief research@example.com' },
        });
      } catch (err) {
        console.warn(`[sec] ${company.ticker} ${filingType}: ${err.message}`);
        continue;
      }

      const entries = asArray(parsed?.feed?.entry);
      for (const e of entries) {
        const link = e.link?.['@_href'] || e.link?.href || (typeof e.link === 'string' ? e.link : null);
        const titleRaw = typeof e.title === 'string' ? e.title : e.title?.['#text'] || '';
        const updated = e.updated || e.published;
        const summary = (typeof e.summary === 'string' ? e.summary : e.summary?.['#text'] || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 500);

        if (!link || !titleRaw || !updated) continue;
        if (!/^https:\/\/(www\.)?sec\.gov\//.test(link)) continue;

        const accession = (e.id || '').match(/accession-number=([\d-]+)/)?.[1] || '';

        out.push({
          id: makeId(['sec', company.ticker, filingType, accession || updated]),
          title: `${company.name} files ${filingType}${titleRaw.includes(' - ') ? '' : ` — ${titleRaw}`}`.slice(0, 200),
          source_name: 'SEC EDGAR',
          source_tier: 1,
          source_url: link,
          published_at: new Date(updated).toISOString(),
          raw_excerpt: summary || titleRaw,
          region: 'US',
          topics: ['regulatory', filingType.toLowerCase()],
          meta: { ticker: company.ticker, cik: company.cik, filing_type: filingType },
        });
      }
    }
  }
  return out;
}

// CLI: run standalone for smoke-testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const sources = JSON.parse(await readFile(SOURCES_PATH, 'utf-8'));
  const items = await fetchSEC(sources);
  console.log(`[sec] fetched ${items.length} filings`);
  console.log(JSON.stringify(items.slice(0, 3), null, 2));
}
