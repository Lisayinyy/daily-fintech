// Push a brief to Lark (飞书) via the bot API.
// Secrets come from env vars LARK_APP_ID + LARK_APP_SECRET — never embed.
//
// Usage:
//   LARK_APP_ID=cli_xxx LARK_APP_SECRET=xxx node scripts/deliver-lark.js list
//   LARK_APP_ID=cli_xxx LARK_APP_SECRET=xxx node scripts/deliver-lark.js send \
//       --chat_id=oc_xxx [--file=brief.md | --text='...'] [--title='...']

import { readFileSync } from 'node:fs';

const APP_ID = process.env.LARK_APP_ID;
const APP_SECRET = process.env.LARK_APP_SECRET;
if (!APP_ID || !APP_SECRET) {
  console.error('Missing LARK_APP_ID or LARK_APP_SECRET env var');
  process.exit(1);
}

async function getToken() {
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`token failed: ${JSON.stringify(json)}`);
  return json.tenant_access_token;
}

async function listChats(token) {
  const res = await fetch('https://open.feishu.cn/open-apis/im/v1/chats?page_size=50', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`list failed: ${JSON.stringify(json)}`);
  return json.data?.items || [];
}

async function sendCard(token, chatId, markdownBody, title) {
  // Lark interactive card: markdown element renders headings, links, bold, lists.
  // Blockquotes (>) render as gray text but not styled. Total JSON ≤ 30KB.
  const card = {
    config: { wide_screen_mode: true },
    header: {
      template: 'blue',
      title: { tag: 'plain_text', content: title || 'Daily Fintech Brief' },
    },
    elements: [{ tag: 'markdown', content: markdownBody }],
  };
  const res = await fetch(
    'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      }),
    },
  );
  return await res.json();
}

const action = process.argv[2];
const token = await getToken();

if (action === 'list') {
  const chats = await listChats(token);
  if (!chats.length) {
    console.log('Bot is in 0 chats. Add the bot to a Lark chat (or DM yourself) first.');
  } else {
    console.log('chat_id\tname\tmode');
    chats.forEach((c) =>
      console.log(`${c.chat_id}\t${c.name || '(no name)'}\t${c.chat_mode || '?'}`),
    );
  }
} else if (action === 'send') {
  const args = Object.fromEntries(
    process.argv.slice(3).map((a) => {
      const eq = a.indexOf('=');
      return [a.slice(2, eq), a.slice(eq + 1)];
    }),
  );
  if (!args.chat_id) throw new Error('--chat_id=oc_xxx required');
  const body = args.file ? readFileSync(args.file, 'utf-8') : args.text;
  if (!body) throw new Error('--file=path or --text="..." required');
  const result = await sendCard(token, args.chat_id, body, args.title);
  console.log(JSON.stringify(result, null, 2));
} else {
  console.error('Usage: list | send --chat_id=oc_xxx [--file=brief.md | --text=...] [--title=...]');
  process.exit(1);
}
