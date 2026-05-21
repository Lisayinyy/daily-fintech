---
name: daily-fintech
description: Daily AI fintech digest from primary sources. Use when the user wants fintech / AI-fintech / regulatory / SEC / Fed / VC investment brief generation, daily digest setup, feed fetching, or summary delivery based on the daily-fintech repo.
---

# Daily Fintech

Use this skill to run or adapt the daily-fintech pipeline in this folder.

## What it does

- Fetches AI + fintech related items from primary and Tier 2 sources
- Verifies citations before keeping items
- Builds US and CN feeds
- Prepares a digest bundle for summarization or delivery

## Key commands

Run from this skill directory:

```bash
npm install
npm run fetch
npm run fetch:cn
npm run fetch:all
npm run digest
npm run verify
```

## Important notes

- `scripts/prepare-digest.js` fetches public JSON feeds from GitHub raw and falls back to local files.
- `scripts/fetch-podcasts.js` optionally uses `POD2TXT_API_KEY`. If absent, podcast items are skipped.
- `scripts/deliver.js` supports stdout, Telegram, and email depending on config.
- `scripts/deliver-lark.js` uses `LARK_APP_ID` and `LARK_APP_SECRET` if you explicitly choose Lark bot delivery.
- Default output style is now **正式中文晨报**. Unless the user explicitly asks for another format, digest output should follow `prompts/morning-brief.md` in formal report style.

## Safety / review summary

This repo was locally reviewed before install. No obvious credential exfiltration or sensitive file access was found. Main risk surface is normal network fetching and optional outbound delivery APIs.

## When customizing

- Put user config under `~/.daily-fintech/config.json`
- Review `config/sources-us.json` and `config/sources-cn.json` before changing source coverage
- Keep citation verification enabled
