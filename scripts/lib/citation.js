// Citation schema — the heart of "no rumor, no hallucination".
// Every feed entry MUST satisfy validateCitation() or it is dropped before write.

export const TIER_RULES = {
  1: 'Primary regulatory filing, central bank press release, or official corporate disclosure (SEC, Fed, Treasury, OCC, FDIC, company IR).',
  2: 'Investment bank or top-tier VC publication (GS / MS / JPM / a16z / Sequoia / Lightspeed / Founders Fund).',
};

// Domains we trust as Tier 1 or Tier 2 ORIGINS.
// A source_url MUST match one of these patterns or it's rejected.
// Smoke-tested 2026-05-20 — dead domains (bvp.com Atlas RSS, a16z.com blog RSS) removed from feeds
// but kept in the whitelist below in case they come back online.
export const TIER_DOMAINS = {
  1: [
    // === US ===
    /^https:\/\/(www\.)?sec\.gov\//,
    /^https:\/\/(www\.)?federalreserve\.gov\//,
    /^https:\/\/home\.treasury\.gov\//,
    /^https:\/\/(www\.)?treasury\.gov\//,
    /^https:\/\/(www\.)?occ\.gov\//,
    /^https:\/\/(www\.)?occ\.treas\.gov\//,
    /^https:\/\/(www\.)?fdic\.gov\//,
    // === CN === (P4 — see config/sources-cn.json for current working / blocked status)
    // Working as of 2026-05-20:
    /^https?:\/\/(www\.)?stats\.gov\.cn\//,
    // Whitelisted-but-blocked (kept here so hand-edited URLs from blocked sources
    // still validate if/when their feeds come back online):
    /^https?:\/\/(www\.)?csrc\.gov\.cn\//,
    /^https?:\/\/(www\.)?pbc\.gov\.cn\//,
    /^https?:\/\/(www\.)?hkex\.com\.hk\//,
    /^https?:\/\/(www\d?\.)?hkexnews\.hk\//,
    /^https?:\/\/(www\.)?sse\.com\.cn\//,
    /^https?:\/\/(www\.)?szse\.cn\//,
    /^https?:\/\/(www\.)?nfra\.gov\.cn\//,
    /^https?:\/\/(www\.)?safe\.gov\.cn\//,
    /^https?:\/\/(www\.)?gov\.cn\//,
  ],
  2: [
    /^https:\/\/(www\.)?goldmansachs\.com\//,
    /^https:\/\/(www\.)?morganstanley\.com\//,
    /^https:\/\/(www\.)?jpmorgan\.com\//,
    /^https:\/\/(am\.)?jpmorgan\.com\//,
    /^https:\/\/(www\.)?a16z\.com\//,
    /^https:\/\/(www\.)?sequoiacap\.com\//,
    /^https:\/\/(www\.)?bvp\.com\//,
    /^https:\/\/(www\.)?lsvp\.com\//,
    /^https:\/\/(www\.)?foundersfund\.com\//,
    // Podcast hosts used by GS / MS / a16z — accepted because their RSS items link to those CDNs:
    /^https:\/\/(feeds|player)\.megaphone\.fm\//,
    /^https:\/\/(rss|content)\.art19\.com\//,
    /^https:\/\/[a-z0-9.-]*\.simplecast\.com\//,
    // CN Tier 2 candidates (no public RSS confirmed yet — kept whitelisted for future):
    /^https?:\/\/(www\.|research\.)?cicc\.com\//,
    /^https?:\/\/(www\.)?citicsf\.com\//,
    /^https?:\/\/(www\.)?htsec\.com\//,
  ],
};

const REQUIRED_FIELDS = ['id', 'title', 'source_name', 'source_tier', 'source_url', 'published_at', 'region'];

export function validateCitation(entry) {
  const errors = [];

  for (const f of REQUIRED_FIELDS) {
    if (entry[f] === undefined || entry[f] === null || entry[f] === '') {
      errors.push(`missing ${f}`);
    }
  }
  if (errors.length) return { valid: false, errors };

  if (![1, 2].includes(entry.source_tier)) {
    errors.push(`source_tier must be 1 or 2 (got ${entry.source_tier})`);
  }

  if (!/^https:\/\//.test(entry.source_url)) {
    errors.push(`source_url must start with https:// (got ${entry.source_url})`);
  } else {
    const patterns = TIER_DOMAINS[entry.source_tier] || [];
    const match = patterns.some((re) => re.test(entry.source_url));
    if (!match) {
      errors.push(`source_url does not match any whitelisted Tier ${entry.source_tier} domain`);
    }
  }

  const ts = Date.parse(entry.published_at);
  if (isNaN(ts)) {
    errors.push(`published_at not ISO8601-parseable (got ${entry.published_at})`);
  } else {
    const ageHours = (Date.now() - ts) / 3_600_000;
    if (ageHours < -24) errors.push(`published_at is in the future (${ageHours.toFixed(1)}h)`);
    if (ageHours > 30 * 24) errors.push(`published_at too old (${(ageHours / 24).toFixed(1)} days)`);
  }

  if (!['US', 'EU', 'CN'].includes(entry.region)) {
    errors.push(`region must be one of US, EU, CN (got ${entry.region})`);
  }

  return { valid: errors.length === 0, errors };
}

export function makeId(parts) {
  return parts
    .filter(Boolean)
    .map((p) => String(p).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .join('-')
    .slice(0, 120);
}
