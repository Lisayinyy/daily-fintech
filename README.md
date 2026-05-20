# Daily Fintech

Your morning brief on AI Fintech — built from **primary sources only**. No rumor mill, no 3-hop reblogs, no "sources say." Every item is traceable to its original document with a clickable URL.

## What this is

A daily 20-minute read covering:
- **AI infrastructure investments** (NVDA / OpenAI / Anthropic / Mistral funding rounds and earnings)
- **AI applied to financial services** (robo-advisors, fraud AI, AI in banking)
- **Regulatory developments** (SEC + Fed today; ECB / CSRC planned)
- **Investment bank views** (GS Exchanges, MS Thoughts on the Market, a16z Podcast — public RSS only)
- **VC announcements** (Sequoia, Lightspeed, Founders Fund — see Source notes below)

## What this is NOT

- Not Bloomberg / Reuters / FT / WSJ summaries (Tier 3 — explicitly excluded)
- Not "industry analysts say"
- Not Reddit, Twitter rumors, or unattributed posts
- Not AI-paraphrased news without a verifiable original link

## How trust works

Every feed entry is required to have:
1. **source_name** — e.g., "SEC EDGAR" or "Goldman Sachs Exchanges"
2. **source_tier** — 1 (primary regulatory/corporate filing) or 2 (investment bank/VC publication)
3. **source_url** — a working HTTPS link to the original document
4. **published_at** — ISO8601 timestamp from the source

Items lacking any of these are dropped before they reach you. See `scripts/verify-citation.js`.

## Architecture (mirrors follow-builders)

```
                        GitHub Actions (10:30 UTC daily)
                                    │
                                    ▼
     ┌────────────────────────────────────────────────┐
     │  generate-feed.js                              │
     │  ├─ fetch-sec.js     (SEC EDGAR 8-K/10-Q/10-K) │
     │  ├─ fetch-fed.js     (Fed + SEC Press RSS)     │
     │  ├─ fetch-vc.js      (Sequoia / LSVP / FF)     │
     │  └─ fetch-podcasts.js (GS / MS / a16z pod2txt) │
     └────────────────────────────────────────────────┘
                                    │
                                    ▼
                         verify-citation.js
                                    │
                                    ▼
                        feed-us.json  (committed to repo)
                                    │
                  ── public raw URL ──
                                    │
                                    ▼
              ┌─────────────────────────────────────┐
              │  Your laptop                        │
              │  prepare-digest.js                  │
              │   ↓                                 │
              │  Claude (strict morning-brief.md)   │
              │   ↓                                 │
              │  deliver.js → Telegram / email      │
              └─────────────────────────────────────┘
```

## Source notes (smoke-tested 2026-05-20)

The "Tier 1+2 only" rule is hard, but several once-public RSS endpoints have gone dark in 2025-2026. Here's what's currently working:

| Source | Region | Tier | Status |
|---|---|---|---|
| SEC EDGAR (12 tickers, 8-K/10-Q/10-K/S-1) | US | 1 | ✅ Working — Atom feeds, requires UA header |
| Federal Reserve press releases | US | 1 | ✅ Working |
| SEC Press releases | US | 1 | ✅ Working |
| U.S. Treasury press releases | US | 1 | ❌ RSS discontinued — no replacement found |
| OCC news releases | US | 1 | ❌ RSS discontinued (occ.gov → occ.treas.gov, but no new feed) |
| FDIC press releases | US | 1 | ❌ RSS discontinued |
| Sequoia Capital | US | 2 | ✅ Working at `sequoiacap.com/feed/` (no www) |
| Lightspeed | US | 2 | ✅ Working |
| Founders Fund | US | 2 | ✅ Working (low post frequency) |
| a16z blog | US | 2 | ❌ WordPress RSS gone — content now flows via a16z Podcast |
| Bessemer Atlas | US | 2 | ❌ RSS gone, no replacement |
| GS Exchanges / MS TOTM / a16z Podcast | US | 2 | ⚠ Requires `POD2TXT_API_KEY` |
| **NBS 国家统计局 (数据发布 + 数据解读)** | **CN** | **1** | **✅ Working — `stats.gov.cn/sj/{zxfb,sjjd}/rss.xml`** |
| CSRC 证监会 | CN | 1 | ❌ SPA + AJAX list — RSS endpoints serve HTML homepage |
| PBoC 人民银行 | CN | 1 | ❌ SPA + AJAX list — RSS endpoints 404 |
| HKEX 港交所 | CN | 1 | ❌ Akamai/WAF 503 even with Chrome UA |
| SSE 上交所 / SZSE 深交所 | CN | 1 | ❌ Listing pages HTML-only, RSS 404 |
| NFRA / SAFE | CN | 1 | ❌ No RSS published |
| Xinhua 新华社 时政 | CN | 1.5 | ❌ Feed not updated since 2022-12 |
| CICC / CITIC / Huatai 中资投行研究 | CN | 2 | ❌ No public RSS confirmed |

**Latest run (2026-05-20)**: 50 items total — 38 US (34 Tier 1 + 4 Tier 2) + 12 CN (12 Tier 1 NBS). All 50 pass `verify-citation.js` strict validation — zero dropped.

## Quickstart

```bash
git clone https://github.com/Lisayinyy/daily-fintech.git
cd daily-fintech
npm install

# Test one fetcher locally (no secrets needed for SEC / Fed / VC RSS / NBS):
node scripts/fetch-sec.js
node scripts/fetch-fed.js
node scripts/fetch-vc.js
node scripts/fetch-cn.js          # NBS macro data + commentary

# Then run the full pipeline:
npm run fetch                     # writes feed-us.json
npm run fetch:cn                  # writes feed-cn.json
npm run fetch:all                 # both, sequentially
npm run digest                    # bundles US + CN feeds for Claude
```

## Language modes

Set `~/.daily-fintech/config.json` to switch the brief output language:

```json
{ "language": "zh" }            // Simplified Chinese — translates English titles, keeps tickers
{ "language": "bilingual" }     // Title in source language, summary in the other language
{ "language": "en" }            // Default — translates Chinese titles to English
```

Translation rules are enforced by `prompts/classify-topic.md`. Regulatory legal language (e.g.
"enforcement action" / "执法行动") is *never* softened — that rule survives all three modes.

## Secrets (GitHub Actions)

| Secret | Used by | Required? |
|---|---|---|
| `POD2TXT_API_KEY` | fetch-podcasts.js | Optional (skip podcasts if absent) |
| `TELEGRAM_BOT_TOKEN` | deliver.js | Only if you want Telegram delivery |
| `TELEGRAM_CHAT_ID` | deliver.js | Same |
| `RESEND_API_KEY` | deliver.js | Only if you want email delivery |

No X API key, no Bloomberg API, no paid data feeds. Everything is public-web.

## Status

- [x] P0 scaffold
- [x] P1 US sources (SEC + Fed + VC + podcasts)
- [x] P2 citation verification
- [x] P4 CN sources — v0 NBS-only (CSRC / PBoC / HKEX known-blocked, see source notes above)
- [ ] P3 EU (ECB / ESMA / BoE)
- [ ] P5 codebase-to-course version of this repo

## License

MIT
