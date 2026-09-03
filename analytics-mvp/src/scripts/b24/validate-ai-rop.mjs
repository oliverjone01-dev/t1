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

// --- п.2 (ФЕНИКС iter-2): согласованность самих входов ДО сверки текстов.
// Сумма funnelAug по досье обязана равняться dept.augustFunnel - иначе тексты
// сверяются с внутренне противоречивым бандлом и валидатор слеп по построению.
{
  const sum = Object.values(sheets).reduce((a, sh) => { const f = sh.funnelAug || {}; a.created += f.created || 0; a.kp += f.kp || 0; a.sold += f.sold || 0; return a; }, { created: 0, kp: 0, sold: 0 });
  const af = args.dept?.augustFunnel || {};
  for (const k of ['created', 'kp', 'sold'])
    if (sum[k] !== (af[k] ?? sum[k])) bad('inputs', `sum(sheets.funnelAug.${k})=${sum[k]} != dept.augustFunnel.${k}=${af[k]} - входы противоречат друг другу`);
  const ws = args.dept?.weekSales;
  if (ws) { const bySum = Object.values(ws.byMgr || {}).reduce((a, x) => a + x.n, 0);
    if (bySum !== ws.total.n) bad('inputs', `weekSales.byMgr сумма ${bySum} != total ${ws.total.n}`); }
}

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
  if (n >= 1e6) { allowed.add(Math.round(n / 1e5) / 10); allowed.add(Math.round(n / 1e6 * 100) / 100); allowed.add(Math.round(n / 1e5) * 1e5); allowed.add(Math.round(n / 1e6) * 1e6); }
};
const walk = (v) => {
  if (typeof v === 'number') addNum(v);
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') Object.values(v).forEach(walk);
};
walk(sheets); walk(args.dept || {}); walk(args.topDeals || {});
for (let d = 1; d <= 31; d++) addNum(d);           // даты
for (let y of [2025, 2026]) addNum(y);
for (let p = 0; p <= 100; p++) addNum(p);          // проценты, часы ожидания, дни - до 100

const fmtHuman = (n) => { n = Math.round(n || 0); if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' млн'; if (n >= 1e3) return Math.round(n / 1e3) + ' тыс'; return String(n); };

// --- извлечение чисел из текста ---
const nums = (text) => {
  const out = [];
  const str = String(text);
  for (const m of str.matchAll(/\d[\d\s ]*(?:[.,]\d+)?/g)) {
    // артикулы из названий сделок («2508.4_Блогер...»): число, приклеенное БЕЗ пробела
    // к '_' или букве - не метрика; «14 сделок» (пробел между) проверяется как раньше
    const glued = !/\s$/.test(m[0]) && m[0].slice(-1) !== ' ';
    const after = str[m.index + m[0].length] || '';
    // G2 ФЕНИКСА: скип по букве дыряв (пропускал бы «99999тыс», «7777x») - буквы НЕ освобождают
    if (glued && after === '_') continue;
    const raw = m[0].replace(/[\s ]/g, '').replace(',', '.');
    const n = parseFloat(raw);
    if (!isNaN(n)) out.push({ n, at: m.index, raw: m[0].trim() });
  }
  return out;
};
const checkText = (who, text) => {
  for (const { n, raw } of nums(text)) {
    if (/^\d{8,}$/.test(raw)) continue; // телефон/ID = слитные 8+ цифр; деньги всегда с разделителями (N1)
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
  // G12 ФЕНИКСА: длинная цитата в «ёлочках» обязана дословно (по нормализации) найтись
  // в досье менеджера - модель не имеет права выдумывать «цитаты из переписки»
  // нормализация: ё->е (модель восстанавливает ё), сверка по первым 40 знакам -
  // заголовки в досье обрезаны на 50, хвост цитаты может быть длиннее
  // N3 ФЕНИКСА: корпус цитируемого - только то, что реально можно цитировать
  // (улики pamyatka.top + названия и next-шаги сделок), а не весь JSON досье
  const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[«»"…]/g, '').replace(/[\s ]+/g, ' ').trim();
  const quotable = norm([
    ...((sh.pamyatka && sh.pamyatka.top) || []).map((x) => x.quote + ' ' + x.deal),
    ...((sh.badDeals || []).map((x) => x.title + ' ' + (x.next || ''))),
  ].join(' \n '));
  for (const qm of all.matchAll(/«([^»]{35,220})»/g)) {
    const q = norm(qm[1]).slice(0, 40);
    if (q.length >= 30 && !quotable.includes(q)) bad(name, 'цитата не из досье (выдумана или искажена): «' + qm[1].slice(0, 80) + '…»');
  }
  // продажи недели: любые «N продаж/предоплат(ы) за неделю» обязаны равняться wonWeek
  const weekClaims=[...all.matchAll(/(\d+)\s+(?:продаж|предоплат|оплат)[а-яё]*(?:\s+нед|[а-яё\s]{0,14}?\s+(?:за\s+)?недел)/gi)];
  for (const m of weekClaims)
    if (+m[1] !== (sh.wonWeek || 0)) bad(name, `«${m[0]}» при wonWeek=${sh.wonWeek}`);
  // покрытие: у продавца с продажами недели каноническая форма обязана присутствовать
  const flat=all.replace(/[\s ]+/g,' ');
  const wordOne=(sh.wonWeek===1)&&/(продаж|предоплат|оплат)[а-яё]*\s+недели?\s*(?:-|:)?\s*одн/i.test(flat);
  if (sh.role !== 'office' && (sh.wonWeek || 0) > 0 && !weekClaims.length && !wordOne && !all.replace(/[\s ]/g,'').includes(String(sh.wonWeekRub)) && !all.includes(fmtHuman(sh.wonWeekRub)))
    bad(name, `wonWeek=${sh.wonWeek}, но каноническое «N продаж/предоплат недели» в тексте отсутствует`);
  // безцифровые нули: «продаж нет / ни одной / без продаж» при wonWeek>0
  if ((sh.wonWeek || 0) > 0 && /(продаж|предоплат|оплат)[а-яё]*\s+(?:за\s+недел[а-яё]*\s+)?(?:нет|не\s+было)|ни\s+одной\s+(?:продажи|предоплаты|оплаты)|без\s+продаж|ноль\s+продаж/i.test(all))
    bad(name, `текст отрицает продажи недели, факты: wonWeek=${sh.wonWeek}`);
  // рейтинг в заголовке full = досье (+-0.05)
  const rm = t.full.match(/(\d[.,]\d)\s*[★⭐]/);
  if (rm && sh.rating != null && Math.abs(parseFloat(rm[1].replace(',', '.')) - sh.rating) > 0.051)
    bad(name, `рейтинг в срезе ${rm[1]} vs досье ${sh.rating}`);
  checkText(name, all);
}
if (ai.dept) {
  const dtext = [ai.dept.summary, ai.dept.compare, ai.dept.pulseNote, ai.dept.funnelNote, ai.dept.freezeNote].join('\n');
  checkText('dept', dtext);
  // недельный итог отдела в текстах = weekSales.total.n
  const ws = args.dept?.weekSales;
  if (ws) for (const m of dtext.matchAll(/(\d+)\s+(?:продаж|предоплат|оплат|вход)[а-яё]*(?:\s+нед|[а-яё\s]{0,14}?\s+(?:за\s+)?недел|\s+в\s+оплат)/gi))
    if (+m[1] !== ws.total.n && !Object.values(ws.byMgr||{}).some(x=>x.n===+m[1])) bad('dept', `«${m[0]}» - недельный итог не равен ${ws.total.n} и не является личным числом`);
  // августовская воронка: если рядом с «август» стоят счётчики воронки - только из augustFunnel
  const af = args.dept?.augustFunnel;
  if (af && /август/i.test(dtext)) {
    for (const m of dtext.matchAll(/создано\s+(\d+)|(\d+)\s+продаж(?![а-яё]*\s*(?:нед|за нед))/gi)) {
      const v = +(m[1] || m[2]);
      const wf = args.dept?.weekCohortFunnel || {};
      const okvals = new Set([af.created, af.tz, af.kp, af.sold, af.mk ?? -1, wf.created, wf.tz, wf.kp, wf.sold, wf.mk ?? -1, ws?ws.total.n:-1, ...Object.values(sheets).flatMap(sh=>[sh.funnelAug?.created??-1, sh.funnelAug?.sold??-1, sh.wonWeek??-1])]);
      if (!okvals.has(v)) bad('dept', `воронка августа: «${m[0]}» не из augustFunnel/досье (ждали ${af.created}/${af.tz}/${af.kp}/${af.sold})`);
    }
  }
  // N2: недельный итог отдела - требуем каноническую строку с точным числом
  if (ws) {
    const canon = new RegExp('Продажи\\s+недели[^0-9]{0,10}' + ws.total.n + '\\s+сдел', 'i');
    if (!canon.test(dtext)) bad('dept', `нет канонической строки «Продажи недели: ${ws.total.n} сделок...»`);
    for (const m of dtext.matchAll(/Продажи\s+недели[^0-9]{0,10}(\d+)\s+сдел/gi))
      if (+m[1] !== ws.total.n) bad('dept', `«${m[0]}» != ${ws.total.n}`);
  }
  const dr = args.dept?.deptRatingMedian;
  if (dr) {
    // направление проверяем только там, где речь про ОТДЕЛ - личные движения менеджеров не трогаем
    let m = null;
    for (const sent of dtext.split('\n')) { /* только переносы: точка внутри дат 23.08 */
      if (!/отдел/i.test(sent) || !/рейтинг/i.test(sent)) continue;
      m = sent.match(/(\d(?:[.,]\d)?)\s*(?:\([^)]*\))?\s*(?:→|->|до)\s+?(\d(?:[.,]\d)?)/)
        || sent.match(/с\s+(\d(?:[.,]\d)?)\s*(?:\([^)]*\))?\s*до\s+(\d(?:[.,]\d)?)/i);
      if (m) break;
    }
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
