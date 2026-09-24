// @ts-nocheck
// Дашборд ПТО: все запуски стадии «Расчёт» воронки C49 и что с ними стало.
//
// Вопрос, ради которого собрано: правда ли, что к концу месяца в расчёт отдают больше.
//
// ВАЖНО про методику. Первая версия этой страницы вывела на герой одно окно хвоста
// («последние 5 рабочих дней», отношение 1.15x, p=0.061) и получила от ФЕНИКСА veto 5.55:
// это окно оказалось единственным удачным из девяти, то есть подгонкой. Здесь считаются
// ВСЕ окна сразу и показываются таблицей, плюс два сценария очистки данных. Вывод строится
// по таблице, а не по одной клетке.
//
// Два режима сборки:
//   PTO_PUBLIC=1 - публичная версия для GitHub Pages: без названий сделок (в них имена
//                  заказчиков), без бюджетов, без фамилий, без ссылок в CRM. Только даты,
//                  стадии, счётчики и номер сделки. На вопрос ПТО этого хватает.
//   без флага     - полная версия для Ивана, отдаётся файлом, не по ссылке.
//
// Источник: rop.json из ветки rop-dashboard-v1 (тот же снимок, что и РОП-дашборд).
// Запуск: ROP_JSON=/путь/rop.json [PTO_PUBLIC=1] npx tsx src/scripts/b24/build-pto.ts
import { readFileSync, writeFileSync } from "node:fs";

const ROP = process.env.ROP_JSON || "../rop.json";
const TPL = "pto/pto.template.html";
const PUBLIC = process.env.PTO_PUBLIC === "1";
const OUT = PUBLIC ? "public/pto-command.html" : "public/pto-full.html";

const CALC = "C49:UC_OGZUU0";   // стадия «Расчёт» воронки «GG RF Заказы»
const FROM = "2026-04-01";      // март 2026 - месяц переезда из amoCRM, даты переходов искусственные
const REPLUMB = "2026-07-23";   // день, когда из воронки исчезла стадия C49:UC_LRFLH9

const rop = JSON.parse(readFileSync(ROP, "utf-8"));
const ST = rop.refs.dealStages;
const deals = rop.deals.filter((d) => String(d.category) === "49");
const byId = Object.fromEntries(deals.map((d) => [d.id, d]));

// Коды стадий, которых больше нет в воронке: подписываем сроком жизни, а не сырым кодом.
const gone = {};
for (const d of deals) for (const [c, t] of (d.hist || [])) {
  if (ST[c]) continue;
  const day = String(t).slice(0, 10);
  const g = (gone[c] ||= { first: day, last: day, n: 0 });
  g.n++; if (day < g.first) g.first = day; if (day > g.last) g.last = day;
}
const ru = (s) => s.split("-").reverse().join(".");
const nameOf = (c) => !c ? "" : ST[c] ? ST[c] : gone[c] ? `удалённая стадия (была ${ru(gone[c].first)} - ${ru(gone[c].last)})` : c;

// --- запуски -----------------------------------------------------------------
const runs = [];
for (const d of deals) {
  const h = d.hist || [];
  h.forEach(([code, ts], i) => {
    if (code !== CALC) return;
    const day = String(ts).slice(0, 10);
    if (day < FROM) return;
    const nx = h[i + 1];
    runs.push({
      d: day, id: String(d.id),
      title: d.title || "", mgr: d.mgr || "не указан", budget: Number(d.budget) || 0,
      from: nameOf(h[i - 1] ? h[i - 1][0] : null), to: nameOf(nx ? nx[0] : null),
      days: nx ? Math.round((Date.parse(nx[1].slice(0, 10)) - Date.parse(day)) / 864e5) : null,
      cur: d.stage || "", out: d.won ? "won" : d.lost ? "lost" : "open",
    });
  });
}
runs.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));

// Дедуп по (сделка, день): одна сделка может за день заходить в «Расчёт» несколько раз,
// это прокликивание карточки, а не новая работа ПТО. ФЕНИКС: 106 строк из 867, и без
// дедупа эффект хвоста завышен (p 0.061 против 0.240).
const seenKey = new Set();
for (const r of runs.slice().reverse()) { const k = r.id + "|" + r.d; r.dup = seenKey.has(k); seenKey.add(k); }
const dedup = runs.filter((r) => !r.dup);

// --- календарь рабочих дней ---------------------------------------------------
const isWd = (s) => { const w = new Date(s + "T00:00:00Z").getUTCDay(); return w >= 1 && w <= 5; };
const dim = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
const dstr = (m, day) => `${m}-${String(day).padStart(2, "0")}`;
// Нерабочие дни РФ, попавшие на будни в окне анализа. Список собран вручную и с официальным
// производственным календарём не сверялся; в данных у всех трёх ровно ноль запусков, поэтому
// в знаменателе они завышают базу. Показываем сценарии и с ними, и без них.
const HOLIDAYS = new Set(["2026-05-01", "2026-05-11", "2026-06-12"]);

const months = [...new Set(runs.map((r) => r.d.slice(0, 7)))].sort();
const today = String(rop.generated_at || "").slice(0, 10);
const openMonth = today.slice(0, 7);
const closed = months.filter((m) => m < openMonth);

const wdaysOf = (ms, drop) => {
  const out = [];
  for (const m of ms) for (let day = 1; day <= dim(m); day++) {
    const s = dstr(m, day); if (isWd(s) && !(drop && drop.has(s))) out.push(s);
  }
  return out;
};
const tailOf = (ms, n, drop) => {
  const L = new Set();
  for (const m of ms) { let k = 0;
    for (let day = dim(m); day >= 1 && k < n; day--) { const s = dstr(m, day); if (isWd(s) && !(drop && drop.has(s))) { L.add(s); k++; } } }
  return L;
};

// Монте-Карло биномиального: раскидываем те же события случайно по рабочим дням периода.
// Детерминированный mulberry32 на Math.imul - наивный LCG в JS переполняет double и врёт
// (давал p=0.018 вместо 0.063, сверено с Python).
function mc(evDays, pool, L, rounds = 20000, seed = 20260924) {
  const inL = evDays.filter((x) => L.has(x)).length;
  const poolSet = new Set(pool);
  const outL = evDays.filter((x) => poolSet.has(x) && !L.has(x)).length;
  const nL = L.size, nO = pool.length - nL;
  if (!nL || !nO || !(inL + outL)) return null;
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const n = inL + outL; let ge = 0;
  for (let k = 0; k < rounds; k++) {
    let c = 0; for (let j = 0; j < n; j++) if (L.has(pool[Math.floor(rnd() * pool.length)])) c++;
    if (c >= inL) ge++;
  }
  const rL = inL / nL, rO = outL / nO;
  return { inL, outL, nL, nO, rateL: rL, rateO: rO, ratio: rO ? rL / rO : 0, p: ge / rounds };
}

const daysOf = (rows, ms) => rows.filter((r) => ms.includes(r.d.slice(0, 7))).map((r) => r.d);

// Таблица устойчивости: все окна хвоста и три декады, на сырых и на очищенных данных.
function stability(rows, drop) {
  const pool = wdaysOf(closed, drop), ev = daysOf(rows, closed);
  const out = [];
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 10]) {
    const r = mc(ev, pool, tailOf(closed, n, drop));
    if (r) out.push({ kind: "tail", label: `последние ${n} раб. дн`, n, ...r });
  }
  for (const [lo, hi, label] of [[1, 10, "декада 1-10"], [11, 20, "декада 11-20"], [21, 31, "декада 21-конец"]]) {
    const D = new Set(pool.filter((s) => { const d = +s.slice(8, 10); return d >= lo && d <= hi; }));
    const r = mc(ev, pool, D);
    if (r) out.push({ kind: "dec", label, ...r });
  }
  return out;
}
const scenarios = [
  { key: "raw", label: "как есть", rows: runs, drop: null },
  { key: "dedup", label: "дедуп по (сделка, день)", rows: dedup, drop: null },
  { key: "clean", label: "дедуп + без нерабочих дней", rows: dedup, drop: HOLIDAYS },
].map((s) => ({ key: s.key, label: s.label, n: daysOf(s.rows, closed).length, rows: stability(s.rows, s.drop) }));

// Реальная работа ПТО: расчёт, который занял хотя бы сутки. Всё, что уходит со стадии
// в тот же день, это прокликивание карточки.
const realWork = dedup.filter((r) => r.days != null && r.days >= 1);
const sameDay = dedup.filter((r) => r.days === 0);
const realTail = mc(daysOf(realWork, closed), wdaysOf(closed, HOLIDAYS), tailOf(closed, 5, HOLIDAYS));

// Перестройка воронки 23.07: до и после, темп на рабочий день.
const rate = (rows, ms, lo, hi, drop) => {
  const pool = wdaysOf(ms, drop).filter((s) => (!lo || s >= lo) && (!hi || s <= hi));
  const ev = rows.filter((r) => pool.includes(r.d));
  return { n: ev.length, wd: pool.length, perDay: pool.length ? ev.length / pool.length : 0 };
};
const period = {
  before: rate(dedup, months, FROM, REPLUMB, HOLIDAYS),
  after: rate(dedup, months, REPLUMB, today, HOLIDAYS),
  byMonth: months.map((m) => ({ m, ...rate(dedup, [m], null, m === openMonth ? today : null, HOLIDAYS), closed: closed.includes(m) })),
};
// Та самая стадия, чей уход совпал с ростом.
const lrByMonth = {};
for (const d of deals) for (const [c, t] of (d.hist || [])) if (c === "C49:UC_LRFLH9") { const m = String(t).slice(0, 7); lrByMonth[m] = (lrByMonth[m] || 0) + 1; }

// --- календарь ----------------------------------------------------------------
const cal = months.map((m) => {
  const n = dim(m), cnt = Array(n).fill(0);
  for (const r of dedup) if (r.d.slice(0, 7) === m) cnt[+r.d.slice(8, 10) - 1]++;
  return { m, n, cnt,
    wd: Array.from({ length: n }, (_, i) => isWd(dstr(m, i + 1))),
    hol: Array.from({ length: n }, (_, i) => HOLIDAYS.has(dstr(m, i + 1))),
    last5: (() => { const L = tailOf([m], 5, HOLIDAYS); return Array.from({ length: n }, (_, i) => L.has(dstr(m, i + 1))); })(),
    partial: m === openMonth ? +today.slice(8, 10) : 0 };
});

const tally = (rows, key) => {
  const acc = {};
  for (const r of rows) { const k = key(r) || "(не указано)"; acc[k] = (acc[k] || 0) + 1; }
  return Object.entries(acc).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
};
const uniq = new Set(dedup.map((r) => r.id));
const dw = realWork.map((r) => r.days).concat(sameDay.map(() => 0)).sort((a, b) => a - b);
const q = (p) => (dw.length ? dw[Math.min(dw.length - 1, Math.floor(dw.length * p))] : 0);

const DATA = {
  bakedAt: new Date().toISOString(), public: PUBLIC,
  snapshot: rop.generated_at, today, from: FROM, replumb: REPLUMB,
  months, closed, openMonth, holidays: [...HOLIDAYS],
  cal, scenarios, realTail, period, lrByMonth,
  totals: {
    rows: runs.length, events: dedup.length, dup: runs.length - dedup.length,
    deals: uniq.size, sameDay: sameDay.length, realWork: realWork.length,
    dwellMed: q(0.5), dwellP75: q(0.75), dwellP90: q(0.9),
    stuck: dedup.filter((r) => r.days == null).length,
    rub: PUBLIC ? null : [...uniq].reduce((s, id) => s + (Number(byId[id].budget) || 0), 0),
  },
  toStage: tally(dedup, (r) => r.to || "(перехода ещё не было)"),
  fromStage: tally(dedup, (r) => r.from || "(создана сразу здесь)"),
  curStage: tally([...uniq].map((id) => ({ cur: byId[id].stage })), (r) => r.cur),
  mgrs: PUBLIC ? null : tally(dedup, (r) => r.mgr),
  gone: Object.entries(gone).map(([c, g]) => ({ c, ...g })).sort((a, b) => b.n - a.n),
  // Строки таблицы. В публичной версии остаются только дата, номер сделки, стадии и дни:
  // ни названия (в нём имя заказчика), ни суммы, ни фамилии, ни ссылки в CRM.
  runs: dedup.map((r) => PUBLIC
    ? { d: r.d, id: r.id, from: r.from, to: r.to, days: r.days, cur: r.cur, out: r.out }
    : r),
};

const html = readFileSync(TPL, "utf-8").replace("__PTO_DATA__", JSON.stringify(DATA));
writeFileSync(OUT, html);
const bytes = Buffer.byteLength(html, "utf8");
console.log(`-> ${OUT} (${(bytes / 1024).toFixed(0)} КиБ, режим ${PUBLIC ? "ПУБЛИЧНЫЙ" : "полный"})`);
console.log(`   строк истории ${runs.length}, событий после дедупа ${dedup.length}, сделок ${uniq.size}`);
for (const sc of scenarios) {
  const t5 = sc.rows.find((x) => x.kind === "tail" && x.n === 5);
  console.log(`   сценарий «${sc.label}»: хвост 5 раб.дн ratio ${t5.ratio.toFixed(3)} p ${t5.p.toFixed(4)}`);
}
console.log(`   темп до ${REPLUMB}: ${period.before.perDay.toFixed(2)}/дн, после: ${period.after.perDay.toFixed(2)}/дн`);
