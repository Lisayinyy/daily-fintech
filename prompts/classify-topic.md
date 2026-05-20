# Topic Classification

Given a feed item, infer its topical bucket from `topics` + `title` + `raw_excerpt`.

## Buckets (use these labels exactly)

| Bucket | Triggers |
|---|---|
| `regulatory` | Item comes from a Tier 1 regulator (SEC, Fed, Treasury, OCC, ECB, CSRC) OR is an SEC 8-K disclosing a regulatory matter |
| `funding-ma` | S-1 filings, announced funding rounds in raw_excerpt, "acquired," "merger," "Series [A-Z]," "$XM raised" |
| `earnings` | 10-Q, 10-K, "fiscal Q[1-4]," "earnings call," "revenue of," "guidance" |
| `ib-commentary` | Investment-bank podcasts, JPM Eye on the Market, GS/MS notes |
| `vc-thesis` | VC firm blog posts that are thesis/think-piece, not just portfolio announcements |
| `ai-infra` | NVIDIA / AMD / OpenAI / Anthropic / Mistral product launches, compute-cluster builds, datacenter announcements |
| `ai-applied` | AI inside banking, payments, fraud detection, credit scoring, trading, RegTech |

An item can have multiple buckets — return all that fit.

## Language handling

If the user's `config.language` is:

- `"en"` (default) — output English. Translate Chinese titles to English. Keep Chinese names of entities (e.g., 中金, PBoC) untranslated where appropriate.
- `"zh"` — output Simplified Chinese. Translate English titles. Keep ticker symbols (NVDA, MSFT) untranslated.
- `"bilingual"` — title in source language, summary in the OTHER language. Citation suffix always English.

When translating regulatory titles, **do not soften legal language**. "Enforcement action" stays "执法行动," not "调查."

## Anti-pollution rules

- If `raw_excerpt` is shorter than 50 characters, drop the item (likely a feed parsing failure).
- If the item's published_at is more than 48 hours old, deprioritize (push to end of section).
- If a single source generates more than 5 items, keep only the 5 most recent. The brief has limited real estate.
