// Multi-channel delivery. Reads the final brief on stdin (text), routes by config.delivery.method.
// Ported from follow-builders/scripts/deliver.js with the same chunking + Markdown fallback pattern.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

async function loadConfig() {
  const p = join(homedir(), '.daily-fintech', 'config.json');
  if (!existsSync(p)) return { delivery: { method: 'stdout' } };
  try {
    return JSON.parse(await readFile(p, 'utf-8'));
  } catch {
    return { delivery: { method: 'stdout' } };
  }
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf-8');
}

async function sendTelegram(text, { bot_token, chat_id }) {
  const MAX_LEN = 4000;
  const chunks = [];
  if (text.length <= MAX_LEN) chunks.push(text);
  else {
    let remaining = text;
    while (remaining.length > MAX_LEN) {
      let splitAt = remaining.lastIndexOf('\n\n', MAX_LEN);
      if (splitAt < MAX_LEN / 2) splitAt = MAX_LEN;
      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }
    if (remaining) chunks.push(remaining);
  }

  for (const chunk of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text: chunk, parse_mode: 'Markdown' }),
    });
    if (!res.ok) {
      // Retry without Markdown — content matters more than formatting.
      await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text: chunk }),
      });
    }
  }
}

async function sendEmail(text, { to, from, subject, api_key }) {
  const html = text
    .split('\n\n')
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api_key}` },
    body: JSON.stringify({ from, to, subject: subject || `Daily Fintech · ${new Date().toISOString().slice(0, 10)}`, html }),
  });
}

async function main() {
  const config = await loadConfig();
  const text = await readStdin();
  if (!text.trim()) {
    console.error('[deliver] stdin empty — nothing to send.');
    process.exit(0);
  }

  const { method } = config.delivery || { method: 'stdout' };

  switch (method) {
    case 'telegram': {
      const bot_token = process.env.TELEGRAM_BOT_TOKEN || config.delivery.bot_token;
      const chat_id = process.env.TELEGRAM_CHAT_ID || config.delivery.chat_id;
      if (!bot_token || !chat_id) {
        console.error('[deliver] telegram needs TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID');
        process.exit(1);
      }
      await sendTelegram(text, { bot_token, chat_id });
      console.error('[deliver] sent via telegram.');
      return;
    }
    case 'email': {
      const api_key = process.env.RESEND_API_KEY || config.delivery.api_key;
      if (!api_key) {
        console.error('[deliver] email needs RESEND_API_KEY');
        process.exit(1);
      }
      await sendEmail(text, {
        to: config.delivery.to,
        from: config.delivery.from || 'brief@daily-fintech.local',
        subject: config.delivery.subject,
        api_key,
      });
      console.error('[deliver] sent via email.');
      return;
    }
    case 'stdout':
    default:
      process.stdout.write(text);
      return;
  }
}

main().catch((err) => {
  console.error('[deliver] FATAL:', err);
  process.exit(1);
});
