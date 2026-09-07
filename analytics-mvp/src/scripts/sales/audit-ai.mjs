// ИИ-коучинг поверх детерминированных фактов (Костя-ИИ разбор).
// Вызывает Anthropic API (ключ из ANTHROPIC_API_KEY), пишет связный вывод: сильные/слабые
// по менеджерам, что устранено / что сохраняется, рекомендации РОПу. Накопительно:
// на вход подаётся прошлый вывод + факты этой недели (дельта уже посчитана в фактах).
// В конце считает расход по токенам и печатает строку расхода.
//
// node audit-ai.mjs --facts /tmp/facts.md --prior /tmp/prior-ai.md \
//   --out /tmp/ai.md --spend-log ./srez/spend.json --mode weekly
import fs from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FACTS = fs.readFileSync(arg('facts', '/tmp/facts.md'), 'utf8');
const PRIOR = arg('prior') && fs.existsSync(arg('prior')) ? fs.readFileSync(arg('prior'), 'utf8') : '';
const OUT = arg('out', '/tmp/ai.md');
const SPEND_LOG = arg('spend-log', '');
const MODE = arg('mode', 'weekly');
const MODEL = arg('model', 'claude-sonnet-5');
const RUB = Number(process.env.RUB_PER_USD || 95);
const KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
if (!KEY) { console.error('Нет ANTHROPIC_API_KEY'); process.exit(1); }

// Цены $/млн токенов (Sonnet 5 по умолчанию).
const PRICE = { 'claude-sonnet-5': { in: 2, out: 10 }, 'claude-haiku-4-5': { in: 1, out: 5 }, 'claude-opus-4-8': { in: 5, out: 25 } };

const SYSTEM = `Ты - Костя, внешний аналитик отдела продаж GENGROUP (бренд GENGLASS). Пишешь недельный разбор для РОПа по готовым фактам (они уже посчитаны из CRM, не пересчитывай и не выдумывай цифры - бери из фактов).

Задача: связный вывод по работе отдела и по каждому менеджеру - сильные и слабые стороны, что устранено с прошлой недели, что сохраняется, и конкретные рекомендации РОПу.

Правила:
- Опирайся ТОЛЬКО на переданные факты. Не придумывай сделок, сумм, имён.
- Тон: прямо, по делу, без яда и без канцелярита. Оценивай действие, а не человека. Никаких "выглядит хорошо".
- Обязательно: раздел что УСТРАНЕНО за неделю и что СОХРАНЯЕТСЯ.
- По менеджерам: у кого динамика вверх (молодцы), у кого вниз или стоит (в разбор).
- В конце - блок РЕКОМЕНДАЦИИ РОПу: кого отметить, кого разобрать лично, слабый сегмент недели.
- Запрещён знак тире "—", используй дефис "-".
- Не пояснять методику ("это база для сравнения" и т.п.) - только выводы.
- Кратко. Это сообщение в Telegram, не эссе.`;

const userMsg = (PRIOR ? `ВЫВОД ПРОШЛОЙ НЕДЕЛИ (для преемственности, что проверить):\n${PRIOR}\n\n` : '')
  + `ФАКТЫ ЭТОЙ НЕДЕЛИ (${MODE}):\n${FACTS}\n\nНапиши разбор по правилам.`;

const body = {
  model: MODEL,
  max_tokens: 4000,
  output_config: { effort: 'medium' },
  system: SYSTEM,
  messages: [{ role: 'user', content: userMsg }],
};

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const j = await res.json();
if (!res.ok || j.type === 'error') { console.error('Anthropic error:', JSON.stringify(j)); process.exit(1); }
if (j.stop_reason === 'refusal') { console.error('Отказ модели:', JSON.stringify(j.stop_details || {})); process.exit(1); }

const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
const u = j.usage || {};
const inTok = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
const outTok = u.output_tokens || 0;
const p = PRICE[MODEL] || PRICE['claude-sonnet-5'];
const usd = inTok / 1e6 * p.in + outTok / 1e6 * p.out;
const rub = usd * RUB;

// накопительно за месяц
let monthRub = rub; const monthKey = new Date().toISOString().slice(0, 7);
if (SPEND_LOG) {
  let log = [];
  try { if (fs.existsSync(SPEND_LOG)) log = JSON.parse(fs.readFileSync(SPEND_LOG, 'utf8')); } catch (e) { }
  log.push({ ts: new Date().toISOString(), mode: MODE, model: MODEL, inTok, outTok, usd: +usd.toFixed(4), rub: +rub.toFixed(1) });
  monthRub = log.filter(x => (x.ts || '').slice(0, 7) === monthKey).reduce((s, x) => s + (x.rub || 0), 0);
  fs.writeFileSync(SPEND_LOG, JSON.stringify(log, null, 1));
}

const spendLine = `\n---\n💰 Расход ИИ: вход ${inTok} · выход ${outTok} ток · $${usd.toFixed(3)} (~${rub.toFixed(0)} ₽) · накопительно за месяц ~${monthRub.toFixed(0)} ₽`;
fs.writeFileSync(OUT, text + spendLine);
console.log('ai →', OUT, '| in', inTok, 'out', outTok, '| ~', rub.toFixed(0), '₽');
