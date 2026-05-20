# Source Tier Rules — Reference

The whole project lives or dies by these tier definitions. They are enforced in code (`scripts/lib/citation.js` → `TIER_DOMAINS`) and reiterated here in plain English so that humans reviewing the brief and Claude writing it share the same mental model.

## Tier 1 — Primary, regulatory, official

A document published by:

- A securities regulator (SEC, ESMA, CSRC, FCA, SFC)
- A central bank (Federal Reserve, ECB, Bank of England, PBoC, BoJ)
- A treasury or finance ministry
- A bank supervisor (OCC, FDIC, BaFin, CBIRC)
- A public company's own Investor Relations team (8-K, press release on the company's `.com/investor` page)

**Why Tier 1 is the gold standard:** these are the *originating documents.* Every "Bloomberg breaking" story about an SEC enforcement action is downstream of the SEC's own press release, which is Tier 1. Skip the middleman.

## Tier 2 — Investment bank / top-tier VC publications

A document published by:

- A bulge-bracket investment bank's public-facing thought leadership (Goldman Sachs Exchanges, Morgan Stanley Thoughts on the Market, JPM Eye on the Market, BlackRock Investment Institute)
- A top-tier VC firm's official blog with a named author (a16z, Sequoia, Bessemer, Lightspeed, Index, Founders Fund, Benchmark)
- An exchange operator's market notes (Nasdaq, NYSE, CME, HKEX research)

**Why Tier 2 is high-trust:** named author, professional reputation on the line, the firm has its own compliance/legal review chain. Not perfect, but vastly better than aggregator content.

## Tier 3 — Top-tier financial media (EXPLICITLY EXCLUDED from this brief)

Bloomberg, Reuters, FT, WSJ, Nikkei, Caixin, 财新, 36kr, The Information, Axios Pro.

These are excellent publications. They are excluded **on purpose**, because:

1. They are usually paywalled — you cannot link to a source the reader can actually open.
2. Their value is in *commentary* and *synthesis*, which conflicts with this brief's purpose (deliver the raw facts).
3. Their reporting is downstream of Tier 1/2 — by waiting one hop, we lose nothing the reader couldn't get from the original document.

If you find yourself wanting to write "according to FT..." that's a signal to look for the underlying Tier 1 or Tier 2 source and link to that instead.

## Tier 4 — Everything else (NEVER cited)

Reddit, Twitter without verified institutional handles, anonymous Substacks, "industry analysts say," Crypto Twitter speculation, leaked screenshots, "sources familiar with the matter."

These never appear in the brief. Not even as "we hear..." Not even quoted. If a fact is only available from Tier 4, the fact does not exist for our purposes.

## Domain whitelist (the actual enforcement)

The full machine-readable list lives in `scripts/lib/citation.js`. To extend it, add the domain pattern there AND update this document. Code and docs must agree.

```
Tier 1 domains:
  US:
    sec.gov, federalreserve.gov, home.treasury.gov, treasury.gov,
    occ.gov, occ.treas.gov, fdic.gov
  CN (P4 — see config/sources-cn.json for which are working vs blocked):
    stats.gov.cn  (NBS — only confirmed working RSS as of 2026-05-20)
    csrc.gov.cn, pbc.gov.cn, hkex.com.hk, hkexnews.hk,
    sse.com.cn, szse.cn, nfra.gov.cn, safe.gov.cn, gov.cn
    (whitelisted but feeds currently blocked — see notes below)

Tier 2 domains:
  US:
    goldmansachs.com, morganstanley.com, jpmorgan.com, am.jpmorgan.com,
    a16z.com, sequoiacap.com, bvp.com, lsvp.com, foundersfund.com,
    feeds.megaphone.fm, player.megaphone.fm,
    rss.art19.com, content.art19.com,
    *.simplecast.com
  CN (no working public RSS confirmed as of 2026-05-20):
    cicc.com, citicsf.com, htsec.com  (whitelisted for future)
```

**Source-acquisition notes (last verified 2026-05-20):**

US:

- a16z's WordPress blog RSS (`a16z.com/feed/`) is offline; their content now reaches us via the a16z Podcast (simplecast.com). The a16z.com domain is still whitelisted in case the blog feed comes back.
- Bessemer's Atlas RSS (`bvp.com/atlas/rss`) is offline with no announced replacement. The domain remains whitelisted; if any working feed turns up it will be added back to `config/sources-us.json`.
- OCC migrated from `occ.gov` to `occ.treas.gov` in late 2025. Both domains are whitelisted so old links don't break.

CN (P4 — first cut):

- **NBS (国家统计局)** is the *only* PRC regulator with a verified working RSS endpoint as of 2026-05-20. Both `stats.gov.cn/sj/zxfb/rss.xml` (数据发布) and `stats.gov.cn/sj/sjjd/rss.xml` (数据解读) return real `text/xml` and update on data-release days. We treat NBS as Tier 1 because it is the *originating publisher* of macro data series (CPI, PPI, GDP, IIP) — exactly what AI Fintech investors want before any commentary.
- **CSRC, PBoC, HKEX, SSE, SZSE, NFRA, SAFE** all dropped public RSS or moved to JS-rendered SPA + WAF (HKEX is on Akamai bot-protection and returns 503 even with full Chrome User-Agent + Accept headers). Their list pages return HTTP 200 with `text/html` but the actual article list is loaded via AJAX after page render. Re-enabling them would require headless-browser scraping, which breaks the project's "every link goes back to a primary RSS/Atom document" guarantee. They stay in the whitelist so that if/when their feeds return, items validate without code changes.
- **Xinhua 新华社** politics RSS (`xinhuanet.com/politics/news_politics.xml`) is technically still 200/text-xml but has not been updated since 2022-12-14. Treated as dead.
- **CICC research / CITIC / Huatai** — no public RSS confirmed (most CN investment-bank research is paywalled or tencent-mp-only). Domains whitelisted for future.

Re Xinhua specifically: even when it was live, it's a *gray-zone* source. Xinhua publishes verbatim PRC State Council policy releases and would normally count as Tier 1 for those (it's effectively the official-record publisher of cabinet-level policy in the PRC). For non-policy stories Xinhua is more like a wire service, where Tier 3 rules apply. The decision rule: if a Xinhua story directly reproduces a State Council / NDRC / MOF release, treat as Tier 1; if it's beat reporting or commentary, drop it.
