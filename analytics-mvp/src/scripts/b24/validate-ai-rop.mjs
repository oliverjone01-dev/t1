// R5 (ФЕНИКС F3): числовой гейт ai-rop.json ДО сборки. Каждое денежное/счётное число
// в текстах ИИ-РОПа обязано находить источник в фактах (досье менеджеров + dept-факты);
// расхождение = FAIL сборки. Без этого регенерация текстов снова внесёт ошибки.
// Запуск: FACTS=... AI=dialog/data/ai-rop.json node src/scripts/b24/validate-ai-rop.mjs
import {readFileSync} from 'node:fs';
const AI = process.env.AI || 'dialog/data/ai-rop.json';
const SHEETS = process.env.SHEETS;   // mgr-sheets.json (обязателен)
const ARGS = process.env.ARGS;       // ai-args.json c dept-фактами (обязателен)
const ai = JSON.parse(readFileSync(AI, 'utf-8'));
const sheets = JSON.parse(readFileSync(SHEETS, 'utf-8'));
const args = JSON.parse(readFileSync(ARGS, 'utf-8'));

let fail = 0;
const bad = (who, msg) => { console.log('FAIL ' + who + ': ' + msg); fail++; };

// --- корпус допустимых чисел: всё из досье, dept-фактов и аннотируемых сделок ---
const allowed = new Set();
const addNum = (n) => {
  if (n == null || isNaN(n)) return;
  n = Math.abs(Math.round(n));
  allowed.add(n);
  // формы округления, которыми пишет человек: тысячи, сотни тысяч, миллионы с 1 знаком
  allowed.add(Math.round(n / 1000));          // «509 тыс» из 509537
  allowed.add(Math.round(n / 100) * 100);
  allowed.add(Math.round(n / 1000) * 1000);
  if (n >= 1e5) { allowed.add(Math.round(n / 1e4)); allowed.add(Math.round(n / 1e4) / 10 * 10); }
  if (n >= 1e6) { allowed.add(Math.round(n / 1e5) / 10); allowed.add(Math.round(n / 1e6 * 100) / 100); }
};
const walk = (v) => {
  if (typeof v === 'number') addNum(v);
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') Object.values(v).forEach(walk);
};
walk(sheets); walk(args.dept || {}); walk(args.topDeals || {});
for (let d = 1; d <= 31; d++) addNum(d);           // даты
for (let y of [2025, 2026]) addNum(y);
for (let p = 0; p <= 100; p++) addNum(p);          // проценты и часы ожидания до 100
for (let h = 0; h <= 200; h++) addNum(h);          // часы/дни в свободном тексте

// --- извлечение чисел из текста ---
const nums = (text) => {
  const out = [];
  for (const m of String(text).matchAll(/\d[\d\s ]*(?:[.,]\d+)?/g)) {
    const raw = m[0].replace(/[\s ]/g, '').replace(',', '.');
    const n = parseFloat(raw);
    if (!isNaN(n)) out.push({ n, at: m.index, raw: m[0].trim() });
  }
  return out;
};
const checkText = (who, text) => {
  for (const { n, raw } of nums(text)) {
    const r = Math.abs(Math.round(n));
    const frac = Math.abs(n) < 10 && String(n).includes('.');
    if (frac) continue;                              // рейтинги 2,5 и дельты 0,1 - отдельная проверка ниже
    if (!allowed.has(r) && !allowed.has(Math.round(n * 10) / 10)) bad(who, 'число без источника в фактах: «' + raw + '»');
  }
};

// --- проверки ---
const tok = (s) => String(s).toLowerCase().split(/\s+/).sort().join('|');
for (const [name, t] of Object.entries(ai.mgrs || {})) {
  const sh = Object.entries(sheets).find(([k]) => tok(k) === tok(name))?.[1];
  if (!sh) { bad(name, 'нет досье'); continue; }
  const all = [t.mini, t.move, t.full].join('\n');
  // продажи недели: любые «N продаж/предоплат(ы) за неделю» обязаны равняться wonWeek
  for (const m of all.matchAll(/(\d+)\s+(?:продаж|предоплат|оплат)[а-яё]*\s+(?:за\s+)?недел/gi))
    if (+m[1] !== (sh.wonWeek || 0)) bad(name, `«${m[0]}» при wonWeek=${sh.wonWeek}`);
  if (/продаж[а-яё]*\s+за\s+неделю\s*[-:]?\s*0|за неделю\s+0(?![0-9])|ноль продаж за неделю/i.test(all) && (sh.wonWeek || 0) > 0)
    bad(name, `текст говорит «0 продаж за неделю», факты: wonWeek=${sh.wonWeek}`);
  // рейтинг в заголовке full = досье (+-0.05)
  const rm = t.full.match(/(\d[.,]\d)\s*[★⭐]/);
  if (rm && sh.rating != null && Math.abs(parseFloat(rm[1].replace(',', '.')) - sh.rating) > 0.051)
    bad(name, `рейтинг в срезе ${rm[1]} vs досье ${sh.rating}`);
  checkText(name, all);
}
if (ai.dept) {
  const dtext = [ai.dept.summary, ai.dept.compare, ai.dept.pulseNote, ai.dept.funnelNote, ai.dept.freezeNote].join('\n');
  checkText('dept', dtext);
  const dr = args.dept?.deptRatingMedian;
  if (dr) {
    const m = dtext.match(/рейтинг[^.\n]*?(\d[.,]\d)\s*(?:→|->)\s*(\d[.,]\d)/i);
    if (m) {
      const a = parseFloat(m[1].replace(',', '.')), b = parseFloat(m[2].replace(',', '.'));
      if ((b - a) * ((dr['30.08'] ?? 0) - (dr['23.08'] ?? 0)) < 0) bad('dept', `направление рейтинга перевёрнуто: «${m[0]}», факты ${dr['23.08']} -> ${dr['30.08']}`);
    }
  }
}
for (const banned of ['молодец', 'холодец', 'гниё']) {
  const s = JSON.stringify(ai).toLowerCase();
  if (s.includes(banned)) bad('corpus', 'запрещённое слово: ' + banned);
}
console.log(fail ? `AI-VALIDATE FAIL: ${fail}` : 'AI-VALIDATE PASS: числа текстов находят источник в фактах');
process.exit(fail ? 1 : 0);
