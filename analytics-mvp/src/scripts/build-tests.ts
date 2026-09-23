// Вкладка «Тесты» (OZON): A/B по рекламе - ставка и соинвест.
// Источники:
//   tools/tests/tests.json           - определения тестов (гипотеза, группы, правило, даты);
//   tools/tests/tests_campaigns.psv  - лог кампаний кабинета: ставка, старт, пара тест-контроль;
//   data/sku_views.ndjson            - посуточная воронка по SKU (показы, карточка, корзина, заказы);
//   data/ads_sku_daily.ndjson        - рекламный расход по SKU и дню;
//   data/prices_daily.ndjson         - соинвест по артикулу и дню (копится с 22.09, может не быть);
//   data/reakciya.json               - измеренные тесты и дневные ряды по группам магазина.
//
// Позиция в поиске есть только в разрезе групп магазина (data/reakciya.json -> daily), по
// отдельным артикулам её никто не собирает. Поэтому она живёт в блоке «Магазин целиком», а не
// в карточках тестов: рисовать её по тест/контролю было бы враньём.
//
// Запуск: npm run tests:page (или npm run katya, он зовёт этот скрипт).
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { dp, op, IS_OZON } from "../paths.js";
import { KPAGES, navButton } from "./katya-nav.js";

if (!IS_OZON) {
  console.log("build-tests: PLATFORM != ozon, вкладка «Тесты» не собирается (соинвест - механика OZON)");
  process.exit(0);
}

const C_TEST = "#3987e5", C_CTRL = "#d95926";   // проверены validate_palette.js на подложке #12161f
const TODAY = new Date().toISOString().slice(0, 10);

type Row = Record<string, number>;
type TestDef = {
  id: string; название: string; гипотеза: string; старт?: string; замер?: string;
  горизонт_дней?: number; тест?: string[]; контроль?: string[]; правило?: string; статус?: string;
  стоп?: string;
  этап2?: string; заметка?: string;
};

const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const nbsp = (n: number): string => {
  const s = Math.round(n).toString();
  let out = "";
  for (let i = 0; i < s.length; i++) out += s[i] + (((s.length - i - 1) % 3 === 0 && i < s.length - 1) ? " " : "");
  return out;
};
const addDays = (d: string, k: number): string => {
  const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
const readNd = (f: string): any[] => (existsSync(f)
  ? readFileSync(f, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : []);

// ---------- источники ----------
const T = JSON.parse(readFileSync("tools/tests/tests.json", "utf-8")) as
  { обновлено?: string; метрики?: string[]; тесты: TestDef[]; заметки?: string[] };

const psv = readFileSync("tools/tests/tests_campaigns.psv", "utf-8").trim().split("\n");
const head = psv[0]!.split("|");
const log = new Map<string, Record<string, string>>();
for (const line of psv.slice(1)) {
  const c = line.split("|"); const r: Record<string, string> = {};
  head.forEach((h, i) => { r[h] = c[i] ?? ""; });
  if (r["товар"]) log.set(r["товар"], r);
}

const sku2art = JSON.parse(readFileSync(dp("sku_offer.json"), "utf-8")) as Record<string, string>;
const series = new Map<string, Map<string, Row>>();
const cell = (art: string, d: string): Row => {
  let m = series.get(art); if (!m) { m = new Map(); series.set(art, m); }
  let c = m.get(d); if (!c) { c = {}; m.set(d, c); }
  return c;
};
for (const r of readNd(dp("sku_views.ndjson"))) {
  const art = sku2art[String(r.sku)]; if (!art) continue;
  const c = cell(art, r.date);
  for (const k of ["views", "vsearch", "pdp", "cart", "units"]) c[k] = (c[k] || 0) + (r[k] || 0);
}
for (const r of readNd(dp("ads_sku_daily.ndjson"))) {
  const art = sku2art[String(r.sku)]; if (!art) continue;
  const c = cell(art, r.d); c["spend"] = (c["spend"] || 0) + (r.sp || 0);
}
for (const r of readNd(dp("history.ndjson"))) {
  const art = r.offer_id && r.offer_id !== "__empty__" ? r.offer_id : sku2art[String(r.sku)];
  if (!art) continue;
  const c = cell(art, r.date); c["revenue"] = (c["revenue"] || 0) + (r.revenue || 0);
}
// Позиция в поиске по артикулу и дню. Файла может ещё не быть: ряд появится, когда
// выгрузку положат в data/position_daily.ndjson. Принимаем оба написания полей.
let posCount = 0;
for (const r of [...readNd(dp("funnel_sku_daily.ndjson")), ...readNd(dp("position_daily.ndjson"))]) {
  const art = String(r.art ?? r.offer ?? r.артикул ?? "").trim();
  const d = String(r.date ?? r.d ?? r.дата ?? "").slice(0, 10);
  if (!art || !d) continue;
  const v = Number(r.search_position ?? r.pos ?? r.position ?? r.позиция);
  if (Number.isFinite(v) && v > 0) { cell(art, d)["pos"] = v; posCount++; }
}
const HAS_POS = posCount > 0;

// Ставка оплаты за заказ по товару: главный риск теста 2 (по закону 3 при выходе из
// рекламы OZON поднимает её с 10 % до 23 %, а это убыток с каждого заказа).
let cpoCount = 0;
for (const r of readNd(dp("cpo_sku_status.ndjson"))) {
  const art = String(r.art ?? r.offer ?? "").trim();
  const d = String(r.date ?? r.d ?? "").slice(0, 10);
  const v = Number(r.bid_percent);
  if (!art || !d || !Number.isFinite(v)) continue;
  cell(art, d)["cpo"] = v; cpoCount++;
}
const HAS_CPO = cpoCount > 0;

const artSet = new Set<string>();
for (const t of (JSON.parse(readFileSync("tools/tests/tests.json", "utf-8")).тесты || []) as TestDef[])
  for (const a of [...(t.тест || []), ...(t.контроль || [])]) artSet.add(a);
for (const r of readNd(dp("ads_daily.ndjson"))) {
  const art = String(r.off || "").trim();
  if (!artSet.has(art)) continue;              // кампания названа не артикулом - мимо
  const c = cell(art, r.d);
  c["clicks"] = (c["clicks"] || 0) + (r.cl || 0);
  c["adspend"] = (c["adspend"] || 0) + (r.sp || 0);
  c["adviews"] = (c["adviews"] || 0) + (r.vw || 0);
}

// Цена на витрине: тот же ряд, что и соинвест (prices-daily.ts пишет обе цены).
const priceRows = readNd(dp("prices_daily.ndjson"));
const HAS_COINV = priceRows.length > 0;
for (const r of priceRows) {
  const art = String(r.offer ?? r.art ?? "").trim();
  const d = String(r.d ?? r.date ?? "").slice(0, 10);
  if (!art || !d) continue;
  const site = Number(r.price ?? r.site), cap = Number(r.before ?? r.cap);
  const co = r.coinv ?? r.coinv_pct;
  if (co != null && Number.isFinite(Number(co))) cell(art, d)["coinv"] = Number(co);
  if (Number.isFinite(site) && site > 0) cell(art, d)["price"] = site;
  if (Number.isFinite(cap) && cap > 0) cell(art, d)["cap"] = cap;
}
const HAS_PRICE = priceRows.length > 0;

let LAST = "";
for (const [, m] of series) for (const d of m.keys()) if (d > LAST) LAST = d;

const rea = JSON.parse(readFileSync(dp("reakciya.json"), "utf-8")) as any;
const measured = (rea.tests || []).filter((t: any) => t.status === "измерен");

// ---------- метрики графика ----------
// index - обе линии приводятся к своему уровню до старта (уровни групп разные);
// raw   - как есть: обе группы в одной единице и сравнимы напрямую.
// testOnly - метрика рисуется одной линией: у контроля рекламы нет по построению,
// и вторая линия была бы плоским нулём, который только мешает.
const METRICS: Array<[string, string, "index" | "raw", string, boolean?]> = [];
if (HAS_COINV) METRICS.push(["coinv", "Соинвест", "raw", " %"]);          // предмет теста
METRICS.push(["adspend", "Расход на клики", "raw", " ₽", true]);          // цена эффекта
METRICS.push(["cpc", "CPC", "raw", " ₽", true]);
METRICS.push(["clicks", "Клики", "raw", "", true]);
if (HAS_CPO) METRICS.push(["cpo", "Ставка CPO", "raw", " %"]);
if (HAS_POS) METRICS.push(["pos", "Позиция в поиске", "raw", ""]);
METRICS.push(["vsearch", "Показы в поиске", "index", ""]);
METRICS.push(["views", "Показы всего", "index", ""]);
METRICS.push(["pdp", "Карточка", "index", ""]);
METRICS.push(["cart", "Корзина", "index", ""]);
if (HAS_PRICE) METRICS.push(["price", "Цена на витрине", "raw", " ₽"]);
METRICS.push(["revenue", "Выручка", "raw", " ₽"]);
METRICS.push(["drr", "ДРР", "raw", " %", true]);

// Соинвест - уровень, а не количество: по группе берём среднее по тем артикулам,
// у которых значение есть, а не сумму.
const LEVEL = new Set(["coinv", "pos", "price", "cap", "cpo"]);   // уровни, а не количества: усредняем, не суммируем
const median = (v: number[]): number | null => {
  if (!v.length) return null;
  const a = [...v].sort((x, y) => x - y), m = a.length >> 1;
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
};
// Ряд артикула за дни (пропуск остаётся пропуском только у уровневых метрик).
const artDaily = (art: string, days: string[], key: string): Array<number | null> =>
  days.map((d) => {
    const v = series.get(art)?.get(d)?.[key];
    return v == null ? (LEVEL.has(key) ? null : 0) : v;
  });
// «Общее» по группе для индексных метрик: медиана поартикульных индексов.
// Артикул с нулевой базой в медиану не входит: его нельзя привести к 100.
const groupIndexed = (grp: string[], days: string[], key: string, base: string[]): Array<number | null> => {
  const idx: Array<Array<number | null>> = [];
  for (const a of grp) {
    const bv = nums0(artDaily(a, base, key));
    const bm = bv.length ? bv.reduce((x, y) => x + y, 0) / bv.length : 0;
    if (!bm) continue;
    idx.push(artDaily(a, days, key).map((v) => v == null ? null : v / bm * 100));
  }
  return days.map((_, i) => median(idx.map((r) => r[i]).filter((v): v is number => v != null)));
};
const groupDaily = (grp: string[], days: string[], key: string): Array<number | null> => days.map((d) => {
  const vals = grp.map((a) => series.get(a)?.get(d)?.[key]).filter((v): v is number => v != null);
  if (!vals.length) return LEVEL.has(key) ? null : 0;   // уровень без данных - пропуск, количество - ноль
  return LEVEL.has(key) ? vals.reduce((x, y) => x + y, 0) / vals.length : vals.reduce((x, y) => x + y, 0);
});
const nums = (arr: Array<number | null>): number[] => arr.filter((v): v is number => v != null);
const nums0 = nums;
const wkSearch = (art: string, end: string, n = 14): number => {
  let s = 0; for (let k = 0; k < n; k++) s += series.get(art)?.get(addDays(end, -k))?.["vsearch"] || 0;
  return s;
};

// ---------- геометрия графика ----------
const W = 620, H = 170, L = 40, R = 62, TP = 14, B = 24;
const niceStep = (span: number): number =>
  [1, 2, 5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000].find((s) => span / s <= 4) || 20000;

type Pt = number | null;

// Пропуск в ряду - это пропуск, а не «как вчера»: линия рвётся. Протягивать последнее
// значение вперёд значит рисовать данные, которых нет (ряды соинвеста и позиции из
// среза кабинета обрываются на несколько дней раньше воронки).
function pane(days: string[], si: number, a: Pt[], b: Pt[], mode: "index" | "raw",
              labels: [string, string] = ["тест", "контроль"], si2 = -1, lbl2 = "") {
  const all = [...a, ...b].filter((v): v is number => v != null);
  if (!all.length) return "";
  const lo0 = Math.min(...all), hi0 = Math.max(...all);
  const anchor = mode === "index" ? 100 : lo0;
  const lo = Math.min(lo0, anchor) * 0.92, hi = (Math.max(hi0, anchor) * 1.06) || 1;
  const x = (i: number) => L + i * (W - L - R) / Math.max(days.length - 1, 1);
  const y = (v: number) => TP + (hi - v) / (hi - lo || 1) * (H - TP - B);
  const step = niceStep(hi - lo);
  const ticks: number[] = [];
  for (let v = 0; v <= hi + step; v += step) if (v > 0 && v >= lo && v <= hi) ticks.push(v);
  if (mode === "index" && !ticks.includes(100) && lo <= 100 && hi >= 100) { ticks.push(100); ticks.sort((p, q) => p - q); }
  const path = (arr: Pt[]) => {
    const seg: string[] = []; let cur: string[] = [];
    arr.forEach((v, i) => {
      if (v == null) { if (cur.length) { seg.push("M" + cur.join(" L")); cur = []; } return; }
      cur.push(`${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
    });
    if (cur.length) seg.push("M" + cur.join(" L"));
    return seg.join(" ");
  };
  const lastOf = (arr: Pt[]): number | null => {
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i] as number;
    return null;
  };
  const grid = ticks.map((v) =>
    `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"`
    + `${v === 100 && mode === "index" ? ' stroke-dasharray="3 3"' : ""}/>`
    + `<text class="ax" x="${L - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${nbsp(v)}</text>`).join("");
  const stepX = Math.max(1, Math.floor(days.length / 6));
  const xt = days.map((d, i) => i % stepX ? "" :
    `<text class="ax" x="${x(i).toFixed(1)}" y="${H - 7}" text-anchor="middle">${d.slice(8, 10)}.${d.slice(5, 7)}</text>`).join("");
  return grid + xt
    + `<line class="st" x1="${x(si).toFixed(1)}" x2="${x(si).toFixed(1)}" y1="${TP}" y2="${H - B}"/>`
    + `<text class="ax st-t" x="${(x(si) + 4).toFixed(1)}" y="${TP + 9}">старт</text>`
    + (si2 >= 0 ? `<line class="st2" x1="${x(si2).toFixed(1)}" x2="${x(si2).toFixed(1)}" y1="${TP}" y2="${H - B}"/>`
        + `<text class="ax st-t" x="${(x(si2) + 4).toFixed(1)}" y="${TP + 20}">${lbl2}</text>` : "")
    + `<path d="${path(b)}" fill="none" stroke="${C_CTRL}" stroke-width="2" stroke-linejoin="round"/>`
    + `<path d="${path(a)}" fill="none" stroke="${C_TEST}" stroke-width="2" stroke-linejoin="round"/>`
    + (lastOf(a) != null ? `<text class="dl" x="${W - R + 6}" y="${(y(lastOf(a)!) + 3.5).toFixed(1)}">${labels[0]}</text>` : "")
    + (lastOf(b) != null ? `<text class="dl" x="${W - R + 6}" y="${(y(lastOf(b)!) + 3.5).toFixed(1)}">${labels[1]}</text>` : "")
    + `<line class="ch" x1="0" x2="0" y1="${TP}" y2="${H - B}" style="display:none"/>`
    + `<rect class="hit" x="${L}" y="${TP}" width="${W - L - R}" height="${H - TP - B}" fill="transparent"/>`;
}

type PairDelta = { test: string; ctl: string; bT: number; pT: number; bC: number; pC: number;
                   dT: number; dC: number; dd: number };

// Изменение по каждой паре отдельно: сколько прибавил тест, сколько контроль, и разница
// между ними в пунктах. Из этих чисел собирается и медиана группы, и таблица по артикулам.
function pairDeltas(t: TestDef, key: string, base: string[], post: string[]): PairDelta[] {
  const out: PairDelta[] = [];
  const mean = (a: string, win: string[]) => {
    const v = nums(artDaily(a, win, key));
    return v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0;
  };
  for (const test of t.тест || []) {
    const ctl = (log.get(test)?.["контроль"] || "").trim(); if (!ctl) continue;
    const bT = mean(test, base), pT = mean(test, post);
    const bC = mean(ctl, base), pC = mean(ctl, post);
    if (!bT || !bC) continue;
    const dT = (pT / bT - 1) * 100, dC = (pC / bC - 1) * 100;
    out.push({ test, ctl, bT, pT, bC, pC, dT, dC, dd: dT - dC });
  }
  return out;
}

// Разрез по артикулам: что произошло с каждой парой отдельно. Медиана в шапке скрывает,
// что внутри группы товары расходятся, и без этой таблицы нельзя увидеть, кто тянет итог.
const PER_ART: Array<[string, string]> = [["vsearch", "Поиск"], ["views", "Показы"],
  ["pdp", "Карточка"], ["cart", "Корзина"]];
if (HAS_POS) PER_ART.push(["pos", "Позиция"]);
if (HAS_COINV) PER_ART.push(["coinv", "Соинвест"]);

function deadControl(t: TestDef): string {
  const st = t.старт!;
  const last7 = Array.from({ length: 7 }, (_, k) => addDays(st, -(k + 1)));
  const post: string[] = [];
  for (let k = 0; k <= 40; k++) { const d = addDays(st, k); if (d <= LAST) post.push(d); }
  const sv = (a: string, ds: string[]) => ds.reduce((x, d) => x + (series.get(a)?.get(d)?.["vsearch"] || 0), 0);
  const bad: string[] = [];
  for (const test of t.тест || []) {
    const c = (log.get(test)?.["контроль"] || "").trim(); if (!c) continue;
    const a = sv(c, last7), b = sv(c, post);
    if (!a || !b) bad.push(`<b>${esc(c)}</b> (пара к ${esc(test)}): ${a ? "" : "нет показов за 7 дней до старта"}${(!a && !b) ? ", " : ""}${b ? "" : "нет показов после старта"}`);
  }
  if (!bad.length) return "";
  return `<div class="dyn-alarm"><b>Мёртвый контроль.</b> Эти артикулы не получают показов, значит сдвинуться не могут, и разница тест минус контроль на них завышается:<ul class="dl2">`
    + bad.map((x) => `<li>${x}</li>`).join("") + `</ul>Пару надо переподобрать до замера.</div>`;
}

function levelGap(test: string, ctl: string, key: string): { v: number; d: string } | null {
  const a = series.get(test), b = series.get(ctl);
  if (!a || !b) return null;
  const days = [...a.keys()].filter((d) => a.get(d)?.[key] != null && b.get(d)?.[key] != null).sort();
  const d = days[days.length - 1];
  if (!d) return null;
  return { v: (a.get(d)![key] as number) - (b.get(d)![key] as number), d };
}

function perArticle(t: TestDef): string {
  const st = t.старт!;
  const base = Array.from({ length: 14 }, (_, k) => addDays(st, -(k + 1)));
  const days: string[] = [];
  for (let k = 0; k <= 40; k++) { const d = addDays(st, k); if (d <= LAST) days.push(d); }
  if (!days.length) return "";
  const cols = PER_ART.filter(([k]) => k === "vsearch" || true);
  const byKey = new Map<string, PairDelta[]>();
  for (const [k] of cols) byKey.set(k, pairDeltas(t, k, base, days));
  // Расход берём напрямую по тестовому артикулу: через пару он бы выпал, потому что
  // у контроля рекламы нет по построению и база пары равна нулю.
  const meanOf = (a: string, win: string[], key: string) => {
    const v = nums(artDaily(a, win, key));
    return v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0;
  };
  const ordT = (a: string) => nums(artDaily(a, days, "units")).reduce((x, y) => x + y, 0);
  const first = byKey.get("vsearch") || [];
  if (!first.length) return "";
  const gapCell = (test: string, ctl: string, key: string) => {
    const g = levelGap(test, ctl, key);
    if (!g) return '<td class="r muted">-</td>';
    const cls = Math.abs(g.v) >= 2 ? (g.v > 0 ? "up" : "dn") : "";
    return `<td class="r ${cls}" title="Разрыв уровней на ${g.d}: у соинвеста нет базы «до», ряд начался 19.09">${g.v >= 0 ? "+" : ""}${g.v.toFixed(1)}</td>`;
  };
  const cell = (d: PairDelta | undefined, key = "") => {
    if (!d) return '<td class="r muted">-</td>';
    const good = key === "pos" ? d.dd < 0 : d.dd > 0;   // у позиции меньше - лучше
    const cls = Math.abs(d.dd) >= 20 ? (good ? "up" : "dn") : "";
    return `<td class="r ${cls}" title="тест ${d.dT >= 0 ? "+" : ""}${d.dT.toFixed(0)} %, контроль ${d.dC >= 0 ? "+" : ""}${d.dC.toFixed(0)} %">${d.dd >= 0 ? "+" : ""}${d.dd.toFixed(0)}</td>`;
  };
  const rows = first.map((p) => {
    const sb = meanOf(p.test, base, "spend"), sp = meanOf(p.test, days, "spend");
    return `<tr><td>${esc(p.test)}</td><td class="muted">${esc(p.ctl)}</td>`
      + cols.map(([k]) => k === "coinv" ? gapCell(p.test, p.ctl, k) : cell(byKey.get(k)!.find((x) => x.test === p.test), k)).join("")
      + `<td class="r sep">${(sb || sp) ? nbsp(sb) + " → " + nbsp(sp) : "-"}</td>`
      + `<td class="r">${ordT(p.test)} / ${ordT(p.ctl)}</td></tr>`;
  }).join("");
  const med = cols.map(([k]) => {
    if (k === "coinv") {
      const g = first.map((p) => levelGap(p.test, p.ctl, k)).filter((x): x is { v: number; d: string } => !!x);
      const m = median(g.map((x) => x.v));
      return `<td class="r"><b>${m == null ? "-" : (m >= 0 ? "+" : "") + m.toFixed(1)}</b></td>`;
    }
    const m = median(byKey.get(k)!.map((x) => x.dd));
    return `<td class="r"><b>${m == null ? "-" : (m >= 0 ? "+" : "") + m.toFixed(0)}</b></td>`;
  }).join("");
  return `<div class="sub2">Показатели по артикулам</div><div class="tbl-wrap"><table class="gtbl single">`
    + `<thead><tr><th>Артикул</th><th>Контроль</th>`
    + cols.map(([k, n]) => {
      const hint = k === "coinv"
        ? "Разрыв уровней в пунктах: соинвест теста минус соинвест его контроля на последний общий день. Прироста к базе здесь нет: ряд цен начался 19.09, а тесты стартовали 18 и 20.09"
        : k === "pos"
          ? "Разница в пунктах: прирост теста минус прирост контроля. У позиции меньше - лучше, поэтому рост числа здесь это ухудшение"
          : "Разница в пунктах: прирост теста минус прирост контроля. Наведите на ячейку, чтобы увидеть оба прироста";
      return `<th class="r" title="${hint}">${n}${k === "pos" ? " ↓" : ""}</th>`;
    }).join("")
    + `<th class="r sep" title="Расход на рекламу по тестовому артикулу, ₽ в день: две недели до старта → после старта">Расход т., ₽/дн</th>`
    + `<th class="r" title="Заказано штук после старта: тест / контроль">Заказы т/к</th></tr></thead>`
    + `<tbody>${rows}</tbody>`
    + `<tfoot><tr class="mrow2"><td colspan="2">Медиана по парам</td>${med}<td class="sep"></td><td></td></tr></tfoot>`
    + `</table></div><div class="cov">Числа в колонках метрик - разница в пунктах: на сколько процентов вырос тест минус на сколько вырос его контроль. Жёлтым и зелёным отмечены расхождения от 20 пунктов; у позиции цвет перевёрнут, потому что меньше - лучше. Медиана внизу - это и есть итог группы, тот же, что в сводке под графиком.</div>`;
}

// Аббревиатуры внутри названия остаются как есть: «ставка cpo» читается как опечатка.
const lowerTitle = (t: string) => t.split(' ')
  .map((w) => w === w.toUpperCase() && w.length > 1 ? w : w.toLowerCase()).join(' ');

function chart(t: TestDef, cid: string): string {
  const st = t.старт!;
  const days: string[] = [];
  for (let k = -14; k <= 40; k++) { const d = addDays(st, k); if (d <= LAST) days.push(d); }
  const si = days.indexOf(st);
  if (si < 0 || !days.length) return "";
  const base = Array.from({ length: 14 }, (_, k) => addDays(st, -(k + 1)));
  const base1 = Array.from({ length: 7 }, (_, k) => addDays(st, -(k + 1)));
  const post = days.filter((d) => d >= st);
  if (!post.length) return "";
  const avg = (g: string[], win: string[], key: string) => {
    if (key === "drr" || key === "cpc") {
      const [n, d, k] = key === "drr" ? ["spend", "revenue", 100] as const : ["adspend", "clicks", 1] as const;
      const sn = nums(groupDaily(g, win, n)).reduce((x, y) => x + y, 0);
      const sd = nums(groupDaily(g, win, d)).reduce((x, y) => x + y, 0);
      return sd ? sn / sd * k : NaN;      // отношение периода - из сумм, а не среднее дневных долей
    }
    const v = nums(groupDaily(g, win, key));
    if (v.length) return v.reduce((x, y) => x + y, 0) / v.length;
    return LEVEL.has(key) ? NaN : 0;
  };

  const panes: Record<string, string> = {}, reads: Record<string, string> = {};
  const subs: Record<string, string> = {}, tip: Record<string, any> = {};
  const si2 = t.этап2 ? days.indexOf(t.этап2) : -1;
  const ratio = (num: Array<number | null>, den: Array<number | null>, k = 100): Array<number | null> =>
    num.map((v, i) => { const d = den[i]; return (v == null || !d) ? null : v / d * k; });
  for (const [key, title, mode, unit, testOnly] of METRICS) {
    const rawT = key === "cpc"
      ? ratio(groupDaily(t.тест!, days, "adspend"), groupDaily(t.тест!, days, "clicks"), 1)
      : key === "drr"
      ? ratio(groupDaily(t.тест!, days, "spend"), groupDaily(t.тест!, days, "revenue"))
      : groupDaily(t.тест!, days, key);
    const rawC = key === "cpc"
      ? ratio(groupDaily(t.контроль!, days, "adspend"), groupDaily(t.контроль!, days, "clicks"), 1)
      : key === "drr"
      ? ratio(groupDaily(t.контроль!, days, "spend"), groupDaily(t.контроль!, days, "revenue"))
      : groupDaily(t.контроль!, days, key);
    const bT = avg(t.тест!, base, key), bC = avg(t.контроль!, base, key);
    const pT = avg(t.тест!, post, key), pC = avg(t.контроль!, post, key);
    let a: Pt[] = rawT, b: Pt[] = rawC;
    if (mode === "index") {
      a = groupIndexed(t.тест!, days, key, base);
      b = groupIndexed(t.контроль!, days, key, base);
      if (!nums(a).length || !nums(b).length) continue;
    } else if (!nums(rawT).length && !(testOnly || nums(rawC).length)) continue;
    panes[key] = testOnly
      ? pane(days, si, a, a.map(() => null), mode, ["тест", ""], si2, "акция off")
      : pane(days, si, a, b, mode, ["тест", "контроль"], si2, "акция off");
    subs[key] = mode === "index" ? "100 = средний день двух недель перед стартом"
      : `по дням, как есть${unit ? ", " + unit.trim() : ""}`;
    tip[key] = { t: a.map((v) => v == null ? null : Math.round(v * 10) / 10), c: b.map((v) => v == null ? null : Math.round(v * 10) / 10), rt: rawT, rc: rawC, mode, unit };
    if (mode === "index") {
      // Вердикт тоже по медиане: считаем изменение у каждой пары отдельно и берём
      // середину. Средним по группе один крупный артикул перетянул бы весь итог.
      const per = pairDeltas(t, key, base, post);
      const mT = median(per.map((x) => x.dT)), mC = median(per.map((x) => x.dC));
      const dd = median(per.map((x) => x.dd)) ?? 0;
      const per1 = pairDeltas(t, key, base1, post);
      const dd1 = median(per1.map((x) => x.dd)) ?? dd;
      const alarm = Math.abs(dd - dd1) > Math.max(Math.abs(dd), Math.abs(dd1)) * 0.5
        ? `<div class="dyn-alarm">Неделя перед стартом была нетипичной: по ней медиана разницы вышла бы <b>${dd1 >= 0 ? "+" : ""}${dd1.toFixed(0)}</b> пунктов вместо <b>${dd >= 0 ? "+" : ""}${dd.toFixed(0)}</b>. Считаем по двум неделям.</div>`
        : "";
      reads[key] = `<div class="dyn-read">Медиана по парам, ${lowerTitle(title)}: тест <b>${mT == null ? "-" : (mT >= 0 ? "+" : "") + mT.toFixed(0) + " %"}</b>, контроль <b>${mC == null ? "-" : (mC >= 0 ? "+" : "") + mC.toFixed(0) + " %"}</b>, разница <b>${dd >= 0 ? "+" : ""}${dd.toFixed(0)} пунктов</b> (пар в счёте ${per.length}). База - две недели перед стартом, после старта ${post.length} дн, данные по ${LAST}.</div>${alarm}`;
    } else {
      const v = (x: number) => Number.isFinite(x) ? nbsp(x) + unit : "нет данных";
      let extra = "";
      if (key === "coinv") {
        const g = (t.тест || []).map((a) => {
          const c = (log.get(a)?.["контроль"] || "").trim();
          return c ? levelGap(a, c, "coinv") : null;
        }).filter((x): x is { v: number; d: string } => !!x);
        const m = median(g.map((x) => x.v));
        extra = m == null ? ""
          : ` Медиана разрыва по парам на ${g[0]!.d}: <b>${m >= 0 ? "+" : ""}${m.toFixed(1)} пункта</b>.`
            + " Прироста к базе здесь нет: ряд цен начался 19.09, а тесты стартовали 18 и 20.09.";
      }
      reads[key] = `<div class="dyn-read">${testOnly ? "Тестовая группа" : "Средний день"}, ${lowerTitle(title)}: `
        + (testOnly
          ? `<b>${v(bT)} → ${v(pT)}</b> за день. У контроля рекламы нет по построению, поэтому вторая линия не рисуется.`
          : `тест <b>${v(bT)} → ${v(pT)}</b>, контроль <b>${v(bC)} → ${v(pC)}</b>.`)
        + (key === "pos" ? " Меньше - лучше." : "")
        + ` Слева две недели перед стартом, справа ${post.length} дн после старта. Данные по ${LAST}.${extra}</div>`;
    }
  }
  if (!panes["vsearch"]) return "";
  const uT = nums(groupDaily(t.тест!, post, "units")).reduce((x, y) => x + y, 0);
  const uC = nums(groupDaily(t.контроль!, post, "units")).reduce((x, y) => x + y, 0);
  const solo = JSON.stringify(METRICS.filter(([k, , , , to]) => panes[k] && to).map(([k]) => k));
  const btns = METRICS.filter(([k]) => panes[k]).map(([k, n]) =>
    `<button class="mb${k === "vsearch" ? " on" : ""}" data-m="${k}">${n}</button>`).join("");
  const gap = HAS_COINV ? "" : " Соинвест по артикулам начнёт собираться ночным снимком, задним числом он не восстанавливается.";
  // Магазин продаёт 4-16 штук в день на весь ассортимент, поэтому выручка и ДРР по группе
  // из десятка артикулов почти двоичные: день с заказом или без. Молчать об этом нельзя,
  // иначе «выручка упала до нуля» прочитается как провал теста.
  const posNote = HAS_POS ? "" : " Позиция в поиске пока не показана: посуточного ряда по артикулам нет.";
  const thin = " Выручка и ДРР по группе рваные: магазин продаёт 4-16 штук в день на весь ассортимент, так что день без заказа у десятка артикулов - обычное дело, а не провал.";
  return `<div class="dyn"><div class="dyn-h">Динамика по дням. <span class="dyn-sub" id="${cid}-sub">${subs["vsearch"]}</span></div>`
    + `<div class="mrow-b">${btns}</div>`
    + `<div class="lg" id="${cid}-lg"><span class="lgi"><i style="background:${C_TEST}"></i>тест, ${t.тест!.length} арт.</span>`
    + `<span class="lgi ctl"><i style="background:${C_CTRL}"></i>контроль, ${t.контроль!.length} арт.</span></div>`
    + `<svg class="cv" id="${cid}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Динамика по дням, тест против контроля">${panes["vsearch"]}</svg>`
    + `<div class="tip" id="${cid}-tip"></div><div id="${cid}-read">${reads["vsearch"]}</div>`
    + `<div class="dyn-note">Заказов после старта: тест <b>${uT}</b> шт, контроль <b>${uC}</b> шт. Линией не рисуем: заказы идут по 0-2 в день на группу, посуточный график был бы шумом. ${posNote}${gap}${thin}</div></div>`
    + `<script>window.DYN=window.DYN||{};window.DYN[${JSON.stringify(cid)}]=${JSON.stringify({ d: days, m: tip, panes, reads, subs })};window.SOLO=window.SOLO||{};window.SOLO[${JSON.stringify(cid)}]=${solo};</script>`;
}

// ---------- карточки тестов ----------
function statusChip(t: TestDef): string {
  if (t.статус && t.статус.includes("не запущен")) return '<span class="chip chip-off">не запущен</span>';
  if (!t.замер) return '<span class="chip chip-off">не запущен</span>';
  const dm = daysBetween(TODAY, t.замер);
  if (dm > 0) return `<span class="chip chip-run">идёт · замер через ${dm} дн</span>`;
  return '<span class="chip chip-done">пора мерить</span>';
}

function pairRow(sku: string): string {
  const r = log.get(sku);
  if (!r) return `<tr><td>${esc(sku)}</td><td colspan="4" class="muted">нет в логе кампаний</td><td class="sep muted" colspan="2">пара не зафиксирована</td><td class="r muted">-</td></tr>`;
  const ct = (r["контроль"] || "").trim();
  const start = (r["старт"] || "").slice(0, 10);
  const prev = start ? addDays(start, -1) : "";
  const vt = prev ? wkSearch(sku, prev) : 0;
  const vc = prev && ct ? wkSearch(ct, prev) : 0;
  const delta = vc ? (vt - vc) / vc * 100 : null;
  const cls = delta != null && Math.abs(delta) > 20 ? "warn" : "";
  return `<tr><td>${esc(sku)}</td><td class="r">${nbsp(vt)}</td>`
    + `<td class="r">${esc(r["соинвест_%"] || "-")}</td>`
    + `<td class="r">${esc(r["ставка_рекоменд"] || "-")} → <b>${esc(r["ставка_финальная"] || "-")}</b></td>`
    + `<td class="nw">${esc((r["старт"] || "").slice(0, 16).replace("T", " "))}</td>`
    + `<td class="sep">${ct ? esc(ct) : "-"}</td><td class="r">${vc ? nbsp(vc) : "-"}</td>`
    + `<td class="r ${cls}">${delta == null ? "-" : (delta >= 0 ? "+" : "") + delta.toFixed(0) + " %"}</td></tr>`;
}

// Контроль обязан быть без рекламы, иначе это не контроль, а вторая тестовая группа.
function dirtyControl(t: TestDef): string {
  if (!t.старт || !t.контроль?.length) return "";
  const win: string[] = [];
  for (let k = -14; k <= 40; k++) win.push(addDays(t.старт, k));
  const bad: Array<[string, number, number, boolean]> = [];
  for (const a of t.контроль) {
    const ds = win.filter((d) => (series.get(a)?.get(d)?.["spend"] || 0) > 0);
    if (!ds.length) continue;
    bad.push([a, ds.reduce((s, d) => s + (series.get(a)!.get(d)!["spend"] || 0), 0), ds.length, ds.some((d) => d >= t.старт!)]);
  }
  if (!bad.length) return "";
  bad.sort((x, y) => y[1] - x[1]);
  const hot = bad.some((x) => x[3]);
  return `<div class="dyn-alarm"><b>Контроль под рекламой.</b> По этим артикулам в окне теста шёл рекламный расход, значит контрольной группой они не являются:<ul class="dl2">`
    + bad.map(([a, tot, n, aft]) => `<li><b>${esc(a)}</b>: ${nbsp(tot)} ₽ за ${n} дн${aft ? ", в том числе после старта теста" : ", только до старта"}</li>`).join("")
    + `</ul>${hot ? "Пока реклама крутится по контролю, разницу тест-контроль читать нельзя: сравниваются две рекламируемые группы." : "Расход был до старта, на замер он влияет только через базу."}</div>`;
}

const cards = T.тесты.map((t) => {
  const tst = t.тест || [], ctl = t.контроль || [];
  let body: string;
  if (tst.length || ctl.length) {
    const rows = tst.map(pairRow).join("");
    const paired = tst.filter((s) => log.has(s)).length;
    const used = new Set(tst.map((s) => log.get(s)?.["контроль"]).filter(Boolean));
    const orphan = ctl.filter((c) => !used.has(c));
    const cov = `Пар: <b>${paired}</b> из ${tst.length}. `
      + (orphan.length ? `Контроль без пары: ${esc(orphan.join(", "))}.` : "Весь контроль разобран по парам.")
      + (HAS_COINV ? "" : " Соинвест контроля появится, когда накопится посуточный ряд цен.");
    body = `<div class="tbl-wrap"><table class="gtbl"><thead>`
      + `<tr class="grp"><th colspan="5">Тест</th><th class="sep" colspan="2">Контроль</th><th></th></tr>`
      + `<tr><th>Артикул</th><th class="r" title="Показы в поиске за 14 дней до старта пары, из посуточного снимка OZON. Окно то же, что у базы замера">Поиск/2нед</th>`
      + `<th class="r" title="Соинвест на момент запуска, из лога кабинета">Соинвест %</th>`
      + `<th class="r">Ставка рек.→фин.</th><th>Старт</th>`
      + `<th class="sep">Артикул</th><th class="r">Поиск/2нед</th>`
      + `<th class="r" title="Насколько трафик теста расходится с контролем до старта. Больше 20 % - пара плохо сопоставима">Δ поиска</th></tr>`
      + `</thead><tbody>${rows}</tbody></table></div><div class="cov">${cov}</div>${dirtyControl(t)}${deadControl(t)}${chart(t, "dyn-" + t.id)}${perArticle(t)}`;
  } else {
    body = '<div class="muted" style="padding:8px 2px">Группы не заданы, тест не запущен.</div>';
  }
  return `<section class="card"><div class="chead"><div class="ctitle">${esc(t.название)} ${statusChip(t)}</div></div>`
    + `<div class="hyp">${esc(t.гипотеза)}</div>`
    + `<div class="meta"><span>Старт: <b>${esc(t.старт || "-")}</b></span><span>Замер: <b>${esc(t.замер || "-")}</b></span>`
    + `<span>Горизонт: <b>${esc(t.горизонт_дней ?? "")} дн</b></span>`
    + (t.этап2 !== undefined ? `<span>Выход из акции: <b>${esc(t.этап2 || "не зафиксирован")}</b></span>` : "")
    + `<span>Тест <b>${tst.length}</b> · Контроль <b>${ctl.length}</b></span></div>`
    + `<div class="rule"><b>Правило:</b> ${esc(t.правило || "")}</div>`
    + (t.стоп ? `<div class="stop"><b>Стоп-сигнал:</b> ${esc(t.стоп)}</div>` : "")
    + (t.заметка ? `<div class="cov" style="border-top:none;padding-top:0">${esc(t.заметка)}</div>` : "")
    + `${body}</section>`;
}).join("");

const mblock = measured.length ? `<h2 class="sec">Измеренные тесты</h2>` + measured.map((t: any) =>
  `<div class="mrow"><div class="ctitle">${esc(t.name)} <span class="chip chip-done">измерен</span></div>`
  + `<div class="meta"><span>Старт <b>${esc(t.started)}</b></span><span>Замер <b>${esc(t.read)}</b></span>`
  + `<span>Тест <b>${esc(t.t)}</b> · Контроль <b>${esc(t.c)}</b></span></div>`
  + `<div class="res">${(t.res || []).map(([a, b]: [string, string]) => `${esc(a)}: ${esc(b)}`).join(" · ")}</div>`
  + `<div class="muted">${esc(t.note || "")}</div></div>`).join("") : "";

const notes = (T.заметки || []).map((n) => `<li>${esc(n)}</li>`).join("");
const nav = KPAGES.map(([h, l, key]) => navButton(h, l, key === "tests")).join(" ");

const CSS = `:root{--bg:#0b0f17;--card:#12161f;--soft:#232B36;--ink:#e8eef2;--ink2:#9fb2c0;--ink3:#5d7484;--cy:#22D3EE;--up:#34D399;--warn:#E5B567;--s1:${C_TEST};--s2:${C_CTRL}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 system-ui,Segoe UI,Roboto,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:18px 16px 60px}
h1{font-size:20px;margin:8px 2px 4px}.sub{color:var(--ink3);margin:0 2px 16px}
.sec{font-size:15px;color:var(--cy);margin:22px 2px 10px;border-bottom:1px solid var(--soft);padding-bottom:6px}
.card{background:var(--card);border:1px solid var(--soft);border-radius:12px;padding:14px 16px;margin-bottom:14px}
.chead{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.ctitle{font-weight:700;font-size:15px}
.chip{font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:20px;white-space:nowrap}
.chip-run{background:rgba(34,211,238,.15);color:var(--cy)}.chip-off{background:rgba(93,116,132,.2);color:var(--ink3)}.chip-done{background:rgba(52,211,153,.16);color:var(--up)}
.hyp{color:var(--ink2);margin:8px 0}.meta{display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--ink3);margin:6px 0}.meta b{color:var(--ink)}
.rule{font-size:12.5px;color:var(--ink2);background:rgba(229,181,103,.08);border-left:3px solid var(--warn);padding:7px 10px;border-radius:6px;margin:8px 0}
.tbl-wrap{overflow-x:auto;margin-top:8px;max-height:340px;overflow-y:auto}
.gtbl{width:100%;border-collapse:collapse;font-size:12px}
.gtbl th{color:var(--ink3);text-align:left;font-weight:600;padding:5px 7px;border-bottom:1px solid var(--soft);position:sticky;background:var(--card);z-index:1}
.gtbl thead tr.grp th{top:0;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--ink2);border-bottom:none;padding-bottom:1px}
.gtbl thead tr:not(.grp) th{top:19px}
.gtbl.single thead tr th{top:0}
.gtbl td{padding:5px 7px;border-bottom:1px solid rgba(255,255,255,.04)}.gtbl .r{text-align:right}.gtbl .nw{white-space:nowrap}
.gtbl .sep{border-left:1px solid var(--soft)}
.gtbl tbody td.sep,.gtbl tbody td.sep~td{background:rgba(93,116,132,.06)}
.gtbl tbody tr:hover td{background:rgba(34,211,238,.06)}
.warn{color:var(--warn);font-weight:700}
.up{color:var(--up);font-weight:700}
.dn{color:var(--warn);font-weight:700}
.sub2{font-size:12.5px;color:var(--ink2);font-weight:600;margin:16px 2px 0}
.gtbl tfoot td{padding:6px 7px;border-top:1px solid var(--soft);color:var(--ink2);font-size:12px;position:sticky;bottom:0;background:var(--card)}
.cov{font-size:12px;color:var(--ink3);margin:8px 2px 0;border-top:1px dashed var(--soft);padding-top:7px}.cov b{color:var(--ink2)}
.dyn{margin-top:14px;position:relative}
.dyn-h{font-size:12.5px;color:var(--ink2);font-weight:600;margin:0 2px 2px}.dyn-sub{color:var(--ink3);font-weight:400}
.mrow-b{display:flex;gap:6px;flex-wrap:wrap;margin:6px 2px 2px}
.mb{background:transparent;border:1px solid var(--soft);color:var(--ink3);border-radius:7px;padding:3px 10px;font:12px system-ui;cursor:pointer}
.mb:hover{color:var(--ink2);border-color:var(--ink3)}
.mb.on{background:rgba(57,135,229,.16);border-color:var(--s1);color:var(--ink)}
.lg{display:flex;gap:14px;font-size:11.5px;color:var(--ink2);margin:4px 2px}
.lgi{display:flex;align-items:center;gap:5px}.lgi i{width:9px;height:9px;border-radius:50%;display:inline-block}
.cv{width:100%;height:170px;display:block;overflow:visible}
.cv .gl{stroke:var(--soft);stroke-width:1}.cv .ax{fill:var(--ink3);font:10px system-ui}
.cv .dl{fill:var(--ink2);font:10.5px system-ui}
.cv .st{stroke:var(--ink3);stroke-width:1;stroke-dasharray:2 3}
.cv .st2{stroke:var(--warn);stroke-width:1;stroke-dasharray:2 3}.cv .st-t{fill:var(--ink3)}
.cv .ch{stroke:var(--ink2);stroke-width:1}
.tip{position:absolute;pointer-events:none;display:none;background:#0b0f17;border:1px solid var(--soft);border-radius:7px;padding:6px 9px;font-size:11.5px;color:var(--ink);white-space:nowrap;z-index:5;box-shadow:0 4px 14px rgba(0,0,0,.5)}
.tip .k{color:var(--ink3)}.tip i{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px}
.dyn-read{font-size:12px;color:var(--ink2);margin:6px 2px 0}.dyn-read b{color:var(--ink)}
.dyn-note{font-size:11.5px;color:var(--ink3);margin:4px 2px 0}
.dyn-alarm{font-size:12px;color:var(--ink2);background:rgba(229,181,103,.08);border-left:3px solid var(--warn);padding:7px 10px;border-radius:6px;margin:8px 2px 0}
.dyn-alarm b{color:var(--warn)}
.stop{font-size:12.5px;color:var(--ink2);background:rgba(255,90,95,.09);border-left:3px solid #FF5A5F;padding:7px 10px;border-radius:6px;margin:8px 0}.stop b{color:#FF7A7E}.dl2{margin:6px 0 6px 18px;padding:0}.dl2 li{margin:2px 0}
.muted{color:var(--ink3)}.mrow{background:var(--card);border:1px solid var(--soft);border-radius:12px;padding:12px 16px;margin-bottom:10px}
.res{font-weight:700;color:var(--up);margin:6px 0}.notes{background:var(--card);border:1px solid var(--soft);border-radius:12px;padding:10px 16px}
.notes li{color:var(--ink2);margin:4px 0}.legend{font-size:12px;color:var(--ink3);margin:2px 2px 14px}.legend b{color:var(--ink2)}`;

// Страничный JS. Регулярок здесь нет намеренно: внутри backtick-шаблона \d и \s теряют
// бэкслеш (грабля build-katya.ts), поэтому разряды считаются руками.
const JS = `
(function(){
  var C1=${JSON.stringify(C_TEST)}, C2=${JSON.stringify(C_CTRL)};
  var NAMES={vsearch:'показов в поиске',views:'показов всего',pdp:'заходов в карточку',cart:'в корзину',revenue:'выручка',drr:'ДРР',spend:'расход',
             coinv:'%',search_position:'позиция',search_views:'показов в поиске',pdp_views:'заходов',ordered_units:'шт'};
  function fin(x){ var s=String(Math.round(x)), o='', n=s.length;
    for(var i=0;i<n;i++){ o+=s[i]; if((n-i-1)%3===0 && i<n-1) o+='\\u00a0'; } return o; }
  Object.keys(window.DYN||{}).forEach(function(id){
    var svg=document.getElementById(id); if(!svg) return;
    var D=window.DYN[id], tip=document.getElementById(id+'-tip'),
        read=document.getElementById(id+'-read'), sub=document.getElementById(id+'-sub');
    var keys=Object.keys(D.panes), cur=keys[0];
    function wire(){
      var ch=svg.querySelector('.ch'), hit=svg.querySelector('.hit'); if(!hit) return;
      var L=parseFloat(hit.getAttribute('x')), Wi=parseFloat(hit.getAttribute('width'));
      hit.addEventListener('mouseleave', function(){ ch.style.display='none'; tip.style.display='none'; });
      hit.addEventListener('mousemove', function(e){
        var box=svg.getBoundingClientRect();
        var i=Math.round(((e.clientX-box.left)/box.width*620-L)/Wi*(D.d.length-1));
        if(i<0) i=0; if(i>D.d.length-1) i=D.d.length-1;
        var gx=L+i*Wi/(D.d.length-1);
        ch.setAttribute('x1',gx); ch.setAttribute('x2',gx); ch.style.display='';
        var d=D.d[i], M=D.m[cur], u=NAMES[cur]||'', raw=(M.mode==='raw');
        function val(idx, rawv){
          if(rawv===null||rawv===undefined) return '<span class="k">нет данных</span>';
          return raw ? fin(rawv)+(M.unit||'') : idx+' <span class="k">('+fin(rawv)+' '+u+')</span>';
        }
        tip.innerHTML='<b>'+d.slice(8,10)+'.'+d.slice(5,7)+'</b><br>'+
          '<i style="background:'+C1+'"></i>'+val(M.t[i],M.rt[i])+'<br>'+
          '<i style="background:'+C2+'"></i>'+val(M.c[i],M.rc[i]);
        tip.style.display='block';
        var hb=svg.parentNode.getBoundingClientRect(), px=box.left-hb.left+gx/620*box.width;
        tip.style.left=Math.min(Math.max(px-tip.offsetWidth/2,0),hb.width-tip.offsetWidth)+'px';
        tip.style.top=(box.top-hb.top+6)+'px';
      });
    }
    wire();
    var host=svg.parentNode.querySelector('.mrow-b');
    if(host) host.addEventListener('click', function(e){
      var b=e.target.closest('.mb'); if(!b) return;
      var k=b.getAttribute('data-m'); if(!D.panes[k]) return;
      cur=k;
      host.querySelectorAll('.mb').forEach(function(x){ x.classList.toggle('on', x===b); });
      svg.innerHTML=D.panes[k]; read.innerHTML=D.reads[k];
      if(sub&&D.subs&&D.subs[k]) sub.textContent=D.subs[k];
      var lg=document.getElementById(id+'-lg'), solo=(window.SOLO||{})[id]||[];
      if(lg){ var one=solo.indexOf(k)>=0; var c=lg.querySelector('.ctl'); if(c) c.style.display=one?'none':''; }
      tip.style.display='none'; wire();
    });
  });
})();`;

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">`
  + `<meta name="viewport" content="width=device-width,initial-scale=1">`
  + `<title>GENGLASS · Тесты</title><style>${CSS}</style></head><body>`
  + `<div id="gg-nav" style="background:#1a2330;border-bottom:1px solid #22d3ee;color:#cfe8ef;font:13px/1.6 system-ui;padding:8px 18px">`
  + `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center">${nav}`
  + `<span style="color:#5d7484;margin-left:8px">тесты по ${esc(T.обновлено || "")} · воронка по ${esc(LAST)}</span></div></div>`
  + `<div class="wrap"><h1>Тесты · A/B по рекламе</h1>`
  + `<p class="sub">Проверяем гипотезы по соинвесту и ставке. Метрики замера: ${esc((T.метрики || []).join(" · "))}.</p>`
  + `<p class="legend">Одна строка таблицы - одна пара: слева артикул из теста, справа его контроль. `
  + `<b>Δ поиска</b> - насколько пара сопоставима по трафику до старта, окно то же, что у базы замера.</p>`
  + cards + mblock
  + `<h2 class="sec">Заметки и предупреждения</h2><div class="notes"><ul>${notes}</ul></div></div>`
  + `<script>${JS}</script></body></html>`;

writeFileSync(op("katya-tests.html"), html);
console.log(`katya-tests.html: ${Math.round(html.length / 1024)} KB, тестов ${T.тесты.length}, измеренных ${measured.length}, данные по ${LAST}`);
