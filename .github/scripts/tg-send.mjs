// Отправка md-файла в Telegram простым текстом, кусками <=3800 символов по границам строк.
import fs from 'node:fs';
const TOKEN = (process.env.BOT_TOKEN || process.env.BOT_TOKEN_ALT || '').trim();
const CHAT = process.env.CHAT_ID;
const fp = process.argv[2];
if (!TOKEN) { console.error('Нет токена бота'); process.exit(1); }
if (!fp) { console.error('Нет файла'); process.exit(1); }
const txt = fs.readFileSync(fp, 'utf8');
const lines = txt.split('\n'); const chunks = []; let cur = '';
for (const l of lines) { if ((cur + l + '\n').length > 3800) { chunks.push(cur); cur = ''; } cur += l + '\n'; }
if (cur.trim()) chunks.push(cur);
for (let i = 0; i < chunks.length; i++) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT, text: chunks[i], disable_web_page_preview: true }) });
  const j = await res.json();
  if (!j.ok) { console.error('Telegram error:', JSON.stringify(j)); process.exit(1); }
  console.log('часть', (i + 1) + '/' + chunks.length, '→', CHAT);
  if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 800));
}
