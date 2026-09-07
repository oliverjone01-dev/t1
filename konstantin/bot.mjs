// «Константин» - живой бот отдела продаж GENGLASS в Telegram.
// Отвечает в рабочем чате на @упоминание или reply, используя ключ Claude и данные дашбордов
// (снимки rop.json + dialog.json). Дневной лимит запросов + лог расхода. Long-polling (getUpdates),
// публичный URL не нужен - подходит для запуска на VPS через systemd/pm2.
//
// ENV: BOT_TOKEN, CHAT_ID, ANTHROPIC_API_KEY, ROP_PATH, DIALOG_PATH,
//      DAILY_LIMIT (по умолч. 30), MODEL (claude-sonnet-5), RUB_PER_USD (95), LOG_DIR (./log)
import fs from 'node:fs';
import path from 'node:path';
import { loadSnaps, buildFacts, detectManager } from './context.mjs';

const TOKEN = (process.env.BOT_TOKEN || '').trim();
const CHAT = String(process.env.CHAT_ID || '').trim();
const KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
const ROP_PATH = process.env.ROP_PATH || './data/rop.json';
const DIALOG_PATH = process.env.DIALOG_PATH || './data/dialog.json';
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 30);
const MODEL = process.env.MODEL || 'claude-sonnet-5';
const RUB = Number(process.env.RUB_PER_USD || 95);
const LOG_DIR = process.env.LOG_DIR || './log';
const PRICE = { 'claude-sonnet-5': { in: 2, out: 10 }, 'claude-haiku-4-5': { in: 1, out: 5 }, 'claude-opus-4-8': { in: 5, out: 25 } };
if (!TOKEN || !CHAT || !KEY) { console.error('Нужны BOT_TOKEN, CHAT_ID, ANTHROPIC_API_KEY'); process.exit(1); }
fs.mkdirSync(LOG_DIR, { recursive: true });

const api = (m, body) => fetch(`https://api.telegram.org/bot${TOKEN}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());

let BOT_USER = '';
const today = () => new Date().toISOString().slice(0, 10);
const counterFile = () => path.join(LOG_DIR, 'count-' + today() + '.txt');
function bumpCounter() { const f = counterFile(); let n = 0; try { n = Number(fs.readFileSync(f, 'utf8')) || 0; } catch (e) { } n++; fs.writeFileSync(f, String(n)); return n; }
function usedToday() { try { return Number(fs.readFileSync(counterFile(), 'utf8')) || 0; } catch (e) { return 0; } }
function logSpend(rec) { const f = path.join(LOG_DIR, today().slice(0, 7) + '.jsonl'); fs.appendFileSync(f, JSON.stringify(rec) + '\n'); }
function monthSpend() { const f = path.join(LOG_DIR, today().slice(0, 7) + '.jsonl'); try { return fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).reduce((s, l) => { try { return s + (JSON.parse(l).rub || 0); } catch (e) { return s; } }, 0); } catch (e) { return 0; } }

const SYSTEM = `Ты - аналитик отдела продаж GENGLASS (воронка «GG Заказы РФ»). Отвечаешь на вопросы РОПа и менеджеров в рабочем чате, опираясь ТОЛЬКО на переданные факты из дашборда (снимок Bitrix). Не выдумывай сделок, сумм и имён - если данных нет, скажи прямо.
Правила: коротко и по делу (это чат, не эссе); оценивай действие, а не человека; без канцелярита; знак тире "—" запрещён, используй дефис "-". Числа бери из фактов. Если вопрос не про отдел продаж или данных для ответа нет - скажи об этом.`;

async function answer(question) {
  const { rop, dlg } = loadSnaps(ROP_PATH, DIALOG_PATH);
  const manager = detectManager(question);
  const facts = buildFacts(rop, dlg, { manager });
  const body = {
    model: MODEL, max_tokens: 1500, output_config: { effort: 'medium' },
    system: SYSTEM,
    messages: [{ role: 'user', content: `ФАКТЫ ИЗ ДАШБОРДА:\n${facts}\n\nВОПРОС: ${question}` }],
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json();
  if (!res.ok || j.type === 'error') throw new Error('Anthropic: ' + JSON.stringify(j).slice(0, 300));
  if (j.stop_reason === 'refusal') return { text: 'Не могу ответить на этот запрос.', usd: 0, rub: 0 };
  const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  const u = j.usage || {}; const inTok = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0); const outTok = u.output_tokens || 0;
  const p = PRICE[MODEL] || PRICE['claude-sonnet-5']; const usd = inTok / 1e6 * p.in + outTok / 1e6 * p.out; const rub = usd * RUB;
  return { text, inTok, outTok, usd, rub };
}

function extractQuestion(msg) {
  let t = msg.text || msg.caption || ''; if (!t) return null;
  const ents = msg.entities || msg.caption_entities || [];
  let mentioned = false;
  for (const e of ents) { if (e.type === 'mention') { const at = t.slice(e.offset, e.offset + e.length); if (at.toLowerCase() === '@' + BOT_USER.toLowerCase()) { mentioned = true; t = (t.slice(0, e.offset) + t.slice(e.offset + e.length)).trim(); } } }
  const isReplyToBot = msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.username && msg.reply_to_message.from.username.toLowerCase() === BOT_USER.toLowerCase();
  if (!mentioned && !isReplyToBot) return null;
  return t.trim();
}

async function handle(msg) {
  if (String(msg.chat.id) !== CHAT) return;
  const q = extractQuestion(msg); if (!q) return;
  const who = msg.from ? ('@' + (msg.from.username || msg.from.first_name || msg.from.id)) : '?';
  if (usedToday() >= DAILY_LIMIT) { await api('sendMessage', { chat_id: CHAT, reply_to_message_id: msg.message_id, text: `Лимит запросов на сегодня исчерпан (${DAILY_LIMIT}). Вернёмся завтра.` }); return; }
  const n = bumpCounter();
  try {
    const a = await answer(q);
    logSpend({ ts: new Date().toISOString(), user: who, q: q.slice(0, 200), inTok: a.inTok, outTok: a.outTok, usd: +(+a.usd).toFixed(4), rub: +(+a.rub).toFixed(1) });
    const foot = `\n---\n💰 ${(+a.rub).toFixed(0)} ₽ за ответ · за месяц ~${monthSpend().toFixed(0)} ₽ · запрос ${n}/${DAILY_LIMIT} сегодня`;
    await api('sendMessage', { chat_id: CHAT, reply_to_message_id: msg.message_id, text: a.text + foot, disable_web_page_preview: true });
  } catch (e) {
    console.error('ошибка ответа:', e.message);
    await api('sendMessage', { chat_id: CHAT, reply_to_message_id: msg.message_id, text: 'Не смог собрать ответ: ' + e.message.slice(0, 200) });
  }
}

async function main() {
  const me = await api('getMe', {}); if (!me.ok) { console.error('getMe:', JSON.stringify(me)); process.exit(1); }
  BOT_USER = me.result.username; console.log('Константин запущен как @' + BOT_USER + ', чат', CHAT, '· лимит', DAILY_LIMIT + '/день');
  let offset = 0;
  for (;;) {
    try {
      const upd = await api('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] });
      if (upd.ok) for (const u of upd.result) { offset = u.update_id + 1; if (u.message) await handle(u.message); }
    } catch (e) { console.error('poll:', e.message); await new Promise(r => setTimeout(r, 3000)); }
  }
}
main();
