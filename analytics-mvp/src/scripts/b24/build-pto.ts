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

// Снимок смарт-процесса «Расчёт» (1060). Он появляется после прогона pto-cron.yml;
// пока его нет, единицы «изделия» и «штуки» в календаре недоступны, и страница об этом говорит,
// вместо того чтобы молча показывать нули.
let SMART = null;
try { SMART = JSON.parse(readFileSync("pto/data/pto.json", "utf-8")); }
catch { console.log("   снимка смарта «Расчёт» ещё нет - единицы «изделия» и «штуки» будут недоступны"); }
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
// Статистическая часть (тесты на «конец месяца», таблица устойчивости, разрез до и после
// перестройки воронки) убрана из страницы по решению Ивана 2026-09-24: дашборд ПТО это
// инструмент, а не отчёт. Сами выводы и цифры остались в отчёте ФЕНИКСА
// knowledge/episodes/2026-09/feniks-audit-pto-dashboard-20260924.md и в переписке.

// --- ряды для календаря ------------------------------------------------------
// Три единицы измерения. «Сделки» считаются по воронке C49 (вход на стадию «Расчёт»),
// «изделия» и «штуки» по смарт-процессу «Расчёт»: карточка = изделие, товарные строки = штуки.
// Это РАЗНЫЕ объекты, а не разрезы одного, поэтому переключатель меняет источник, и страница
// подписывает, что именно сейчас на экране.
const addDay = (acc, day, v) => { if (day) acc[day] = (acc[day] || 0) + v; };

const seriesDeals = {};
for (const r of dedup) addDay(seriesDeals, r.d, 1);

const seriesItems = {}, seriesQty = {};
let smartStats = null;
if (SMART && Array.isArray(SMART.items)) {
  // Дата запуска для карточки смарта - дата создания. Именно она отвечает на вопрос
  // «когда расчёт запустили», в отличие от даты смены стадии.
  let noQty = 0, noDate = 0, preMig = 0;
  for (const it of SMART.items) {
    const day = it.created;
    if (!day) { noDate++; continue; }
    // Тот же отсчёт, что и у сделок: март 2026 это месяц переезда из amoCRM. Без этого
    // фильтра календарь рисовал март, а клик по нему давал пустую таблицу, потому что
    // строки под таблицу отсекались по FROM, а ряды календаря нет.
    if (day < FROM) { preMig++; continue; }
    addDay(seriesItems, day, 1);
    // Штуки: приоритет у товарных строк, поле «Кол-во товара» это ручной ввод и расходится.
    const q = it.qty != null ? it.qty : (it.qtyText != null ? it.qtyText : null);
    if (q == null) noQty++; else addDay(seriesQty, day, q);
  }
  smartStats = {
    items: SMART.items.length - preMig, itemsRaw: SMART.items.length, preMig, noDate, noQty,
    fromProductRows: SMART.items.filter((i) => i.created >= FROM && i.qty != null).length,
    fromText: SMART.items.filter((i) => i.created >= FROM && i.qty == null && i.qtyText != null).length,
    qtySum: Math.round(Object.values(seriesQty).reduce((a, b) => a + b, 0)),
    stages: (SMART.refs && SMART.refs.stageOrder || []).map((c) => ({ c, n: SMART.refs.stageName[c] })),
    snapshot: SMART.generated_at,
  };
}

// Диапазон дат календаря: объединение всех рядов, но не раньше FROM.
const allDays = [...new Set([...Object.keys(seriesDeals), ...Object.keys(seriesItems)])].filter((d) => d >= FROM).sort();
const minDay = allDays[0] || FROM, maxDay = allDays[allDays.length - 1] || today;

const units = [
  { key: "deals", label: "по сделкам", hint: "вход сделки на стадию «Расчёт» воронки C49, дубли за день схлопнуты", series: seriesDeals, available: true },
  { key: "items", label: "по изделиям", hint: "карточки смарт-процесса «Расчёт», дата создания карточки", series: seriesItems, available: !!smartStats },
  { key: "qty", label: "по штукам", hint: "товарные строки карточек смарта; где их нет, берётся поле «Кол-во товара»", series: seriesQty, available: !!smartStats },
];

// Строки изделий для второго уровня таблицы. Публичная версия отдаёт техническую часть
// (название изделия это спецификация продукта с внутренним номером заказа, имён заказчиков
// в ней нет) и убирает то, что относится к людям и деньгам: название сделки, бюджет,
// менеджера, конструктора, исполнителя.
const itemRow = (i) => {
  const base = {
    d: i.created, id: String(i.id), dealId: i.dealId || null,
    t: i.title || "", stage: i.stage, stageCode: i.stageCode,
    qty: i.qty != null ? i.qty : i.qtyText, qtySrc: i.qty != null ? "строки" : i.qtyText != null ? "поле" : null,
    kind: i.calcKind || null, draw: i.drawApproval || null,
    type: i.productType !== "не указано" ? i.productType : null,
    assort: i.assort !== "не указано" ? i.assort : null,
    dir: i.dirSp !== "не указано" ? i.dirSp : (i.dir !== "не указано" ? i.dir : null),
    moved: i.moved, toProd: i.dateToProd, contract: i.contractDate,
    verbal: i.verbalDeadline, ready: i.readyByContract, close: i.close,
  };
  return PUBLIC ? base : { ...base, constructor: i.constructor, executor: i.executor,
    mgr: i.dealMgr, dealTitle: i.dealTitle, opportunity: i.opportunity, dealBudget: i.dealBudget };
};
const smartRows = SMART && Array.isArray(SMART.items)
  ? SMART.items.filter((i) => i.created && i.created >= FROM).map(itemRow)
  : [];

// Индекс первого уровня: сделка. Собирается из ОБЪЕДИНЕНИЯ двух источников, потому что
// часть сделок заходила в «Расчёт» без карточки смарта, а часть карточек висит на сделках,
// которых в выборке «Расчёт» нет. Молча терять ни те, ни другие нельзя.
const dealIdx = {};
const touch = (id) => (dealIdx[id] ||= { id, runs: [], items: [] });
for (const r of dedup) touch(r.id).runs.push(r.d);
for (const it of smartRows) if (it.dealId) touch(it.dealId).items.push(it.id);
const dealsTable = Object.values(dealIdx).map((x) => {
  const d = byId[x.id];
  const its = smartRows.filter((i) => i.dealId === x.id);
  const qty = its.reduce((s, i) => s + (i.qty || 0), 0);
  const base = {
    id: x.id,
    runs: x.runs.sort(), items: its.length, qty,
    stage: d ? d.stage : null, out: d ? (d.won ? "won" : d.lost ? "lost" : "open") : null,
    created: d ? String(d.created || "").slice(0, 10) : null,
    firstItem: its.length ? its.map((i) => i.d).sort()[0] : null,
    lastItem: its.length ? its.map((i) => i.d).sort().slice(-1)[0] : null,
    stages: [...new Set(its.map((i) => i.stage))],
  };
  return PUBLIC ? base : { ...base, title: d ? d.title : (its[0] ? its[0].dealTitle : ""),
    mgr: d ? d.mgr : (its[0] ? its[0].mgr : null), budget: d ? Number(d.budget) || 0 : (its[0] ? its[0].dealBudget : 0) };
});

const DATA = {
  bakedAt: new Date().toISOString(), public: PUBLIC,
  snapshot: rop.generated_at, smartSnapshot: smartStats ? smartStats.snapshot : null,
  today, from: FROM, minDay, maxDay,
  units: units.map((u) => ({ key: u.key, label: u.label, hint: u.hint, available: u.available, series: u.series })),
  smart: smartStats,
  holidays: [...HOLIDAYS],
  // Строки для таблицы «Все запуски, по датам». Показываются по клику на ячейку календаря.
  runs: dedup.map((r) => PUBLIC
    ? { d: r.d, id: r.id, from: r.from, to: r.to, days: r.days, cur: r.cur, out: r.out }
    : r),
  smartRows, dealsTable,
  totals: {
    rows: runs.length, events: dedup.length, dup: runs.length - dedup.length,
    deals: new Set(dedup.map((r) => r.id)).size,
  },
  gone: Object.entries(gone).map(([c, g]) => ({ c, ...g })).sort((a, b) => b.n - a.n),
};

const html = readFileSync(TPL, "utf-8").replace("__PTO_DATA__", JSON.stringify(DATA));
writeFileSync(OUT, html);
const bytes = Buffer.byteLength(html, "utf8");
console.log(`-> ${OUT} (${(bytes / 1024).toFixed(0)} КиБ, режим ${PUBLIC ? "ПУБЛИЧНЫЙ" : "полный"})`);
console.log(`   сделки: строк истории ${runs.length}, после дедупа ${dedup.length}, уникальных сделок ${DATA.totals.deals}`);
if (smartStats) {
  console.log(`   смарт «Расчёт»: карточек ${smartStats.items} с ${FROM} (в снимке ${smartStats.itemsRaw}, до переезда отсечено ${smartStats.preMig}), штук ${smartStats.qtySum}`);
  console.log(`   штуки: из товарных строк ${smartStats.fromProductRows}, из поля «Кол-во товара» ${smartStats.fromText}, без количества ${smartStats.noQty}`);
  console.log(`   стадии смарта: ${smartStats.stages.map((x) => x.n).join(" · ")}`);
} else {
  console.log(`   смарт «Расчёт» не подключён: единицы «изделия» и «штуки» недоступны`);
}
console.log(`   диапазон календаря ${minDay} .. ${maxDay}`);
