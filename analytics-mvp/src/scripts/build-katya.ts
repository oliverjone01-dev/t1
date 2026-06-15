// Версии дашборда "вид Кати" на наших живых данных OZON:
//   katya.html        - обзор (шаблон v55: KPI, план-факт, структура, рентабельность, ABC, сезонность)
//   katya-tovary.html - товары и заказы (шаблон v63: таблица моделей с раскрытием, тепловая карта)
// Берём её CSS/DOM/JS, балансной заменой подставляем только константы-данные.
// Реальные числа - канал OZON. Прочие каналы, клиенты, план - нет данных (честно пусто).
// Запуск: tsx src/scripts/build-katya.ts (после fetch:live). Источник: data/, не fixtures.
import { readFileSync, writeFileSync } from "node:fs";

type Fact = { date: string; sku: string; name: string; line: string; revenue: number; units: number; returns?: number };
const RUMON = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
const mln = (n: number) => Math.round((n / 1e6) * 1000) / 1000;
const slug = (s: string) => "s_" + s.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 60);

// --- данные ---
const facts: Fact[] = readFileSync("data/history.ndjson", "utf-8").trim().split("\n").map((l) => JSON.parse(l));
const live = JSON.parse(readFileSync("data/skus_live_30d.json", "utf-8"));
const tax: Record<string, any> = JSON.parse(readFileSync("data/sku_taxonomy.json", "utf-8"));
const cogs: Record<string, number> = JSON.parse(readFileSync("data/sku_cogs.json", "utf-8"));
const stockOf: Record<string, number> = {};
for (const s of live.sku_table) stockOf[String(s.sku)] = s.stock || 0;

// --- 16-месячное окно, заканчивающееся последним месяцем данных ---
const months = [...new Set(facts.map((f) => f.date.slice(0, 7)))].sort();
const lastMo = months[months.length - 1]!;
const [ly, lm] = lastMo.split("-").map(Number) as [number, number];
const WIN: string[] = [];
for (let i = 15; i >= 0; i--) {
  const d = new Date(Date.UTC(ly, lm - 1 - i, 1));
  WIN.push(d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0"));
}
const moIdx: Record<string, number> = {};
WIN.forEach((m, i) => (moIdx[m] = i));
const monLabel = (m: string) => { const [y, mo] = m.split("-").map(Number) as [number, number]; return RUMON[mo - 1]! + " " + String(y).slice(2); };
const daysIn = WIN.map((m) => { const [y, mo] = m.split("-").map(Number) as [number, number]; return new Date(Date.UTC(y, mo, 0)).getUTCDate(); });

// --- агрегаты по SKU ---
const z16 = () => new Array(16).fill(0);
const taxOf = (sku: string) => tax[sku] || {};
const skuMonRev: Record<string, number[]> = {}, skuMonOrd: Record<string, number[]> = {};
const skuName: Record<string, string> = {}, skuRet: Record<string, number> = {}, skuUnits: Record<string, number> = {}, skuLine: Record<string, string> = {};
for (const f of facts) {
  const i = moIdx[f.date.slice(0, 7)]; if (i == null) continue;
  const sk = String(f.sku);
  const arR = (skuMonRev[sk] ||= z16()); arR[i] = (arR[i] ?? 0) + f.revenue;
  const arO = (skuMonOrd[sk] ||= z16()); arO[i] = (arO[i] ?? 0) + f.units;
  skuName[sk] = f.name; skuLine[sk] = f.line;
  skuUnits[sk] = (skuUnits[sk] || 0) + f.units; skuRet[sk] = (skuRet[sk] || 0) + (f.returns || 0);
}
const allSkus = Object.keys(skuMonRev);
const dates = [...new Set(facts.map((f) => f.date))].sort();
const maxD = dates[dates.length - 1]!;
const totRevWin = (sk: string) => (skuMonRev[sk] ?? []).reduce((a, b) => a + b, 0);

// --- канонизация категорий ---
// Для SKU без таксономии line шёл в категории как есть -> дубли «Зеркала/зеркала», TRUBIS как категория.
// Канон: словарь линия->категория, построенный голосованием по покрытым SKU + семантические правила.
const lineVote: Record<string, Record<string, number>> = {};
for (const sk of allSkus) { const c = taxOf(sk).category; if (!c) continue; const ln = skuLine[sk] || ""; (lineVote[ln] ||= {})[c] = ((lineVote[ln] ||= {})[c] || 0) + 1; }
const LINE_CAT: Record<string, string> = {
  "зеркала": "Зеркала", "NOLVIS": "Зеркала", "OSOLIS": "Зеркала",
  "TRUBIS": "Столы", "VIOLUR (перегородки)": "Столы", "VIOLUR (столы)": "Столы", "столы": "Столы",
  "свет": "Свет", "прочее": "Прочее",
};
for (const [ln, votes] of Object.entries(lineVote)) {
  if (LINE_CAT[ln]) continue;
  const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  if (top) LINE_CAT[ln] = top[0];
}
const NO_TAX_SUB = "Без таксономии";
const catOf = (sku: string) => taxOf(sku).category || LINE_CAT[skuLine[sku] || ""] || "Прочее";
const subOf = (sku: string) => taxOf(sku).sub || NO_TAX_SUB;
const modelOf = (sku: string) => taxOf(sku).model || taxOf(sku).offer || skuName[sku] || sku;

// --- дерево категорий ---
const groups = new Map<string, Map<string, string[]>>();
for (const sk of allSkus) {
  const g = catOf(sk), s = subOf(sk);
  let gr = groups.get(g); if (!gr) { gr = new Map(); groups.set(g, gr); }
  if (!gr.has(s)) gr.set(s, []);
  gr.get(s)!.push(sk);
}
const subIdOf = (g: string, sub: string) => slug("c_" + g + "_" + sub);
{ // защита от коллизий id (раньше slice(0,18) задваивал «Зеркала»)
  const seen = new Set<string>();
  for (const [g, gr] of groups) for (const sub of gr.keys()) {
    const id = slug("c_" + g + "_" + sub);
    if (seen.has(id)) throw new Error("Коллизия id подкатегории: " + id + " (" + g + "/" + sub + ")");
    seen.add(id);
  }
}
const grIdOf = (g: string) => slug("g_" + g);

function abcMap(items: { k: string; rev: number }[]): Record<string, string> {
  const s = [...items].sort((a, b) => b.rev - a.rev); const tot = s.reduce((x, y) => x + y.rev, 0) || 1; let c = 0; const o: Record<string, string> = {};
  for (const it of s) { c += it.rev; const sh = c / tot; o[it.k] = sh <= 0.8 ? "A" : sh <= 0.95 ? "B" : "C"; } return o;
}
const subRev: Record<string, number> = {};
for (const [g, gr] of groups) for (const [sub, sks] of gr) subRev[subIdOf(g, sub)] = sks.reduce((a, sk) => a + totRevWin(sk), 0);
const subAbc = abcMap(Object.entries(subRev).map(([k, rev]) => ({ k, rev: mln(rev) })));

const CAT_TREE = [...groups.entries()].map(([g, gr]) => ({
  id: grIdOf(g), name: g, sub: [...gr.keys()].filter((s) => s !== NO_TAX_SUB).slice(0, 3).join(" · "),
  children: [...gr.entries()].map(([sub, sks]) => {
    const rev = mln(sks.reduce((a, sk) => a + totRevWin(sk), 0));
    const orders = sks.reduce((a, sk) => a + (skuUnits[sk] || 0), 0);
    const ret = orders ? Math.round((sks.reduce((a, sk) => a + (skuRet[sk] || 0), 0) / orders) * 1000) / 10 : 0;
    return { id: subIdOf(g, sub), name: sub, sub, rev, prev: rev, orders, otif: null, ret, days: null, abc: subAbc[subIdOf(g, sub)] || "C" };
  }),
})).sort((a, b) => b.children.reduce((s, c) => s + c.rev, 0) - a.children.reduce((s, c) => s + c.rev, 0));

// --- маржа по подкатегориям: только по покрытым С/С, без покрытия ключ не пишем (в UI - серое «н/д») ---
const SUBCAT_MARGIN: Record<string, number> = {};
for (const [g, gr] of groups) for (const [sub, sks] of gr) {
  let r = 0, c = 0; for (const sk of sks) { const cu = cogs[sk] || 0; if (cu > 0) { r += totRevWin(sk); c += cu * (skuUnits[sk] || 0); } }
  if (r > 0) SUBCAT_MARGIN[subIdOf(g, sub)] = Math.round((1 - c / r) * 1000) / 10;
}

// --- модели (PRODUCTS) ---
const modelMap = new Map<string, string[]>();
for (const sk of allSkus) { const m = modelOf(sk); (modelMap.get(m) || modelMap.set(m, []).get(m)!).push(sk); }
const modelAbc = abcMap([...modelMap.entries()].map(([m, sks]) => ({ k: m, rev: mln(sks.reduce((a, sk) => a + totRevWin(sk), 0)) })));
const cv = (arr: number[]) => { const nz = arr.filter((x) => x > 0); if (nz.length < 2) return 0; const mean = nz.reduce((a, b) => a + b, 0) / nz.length; const sd = Math.sqrt(nz.reduce((a, b) => a + (b - mean) ** 2, 0) / nz.length); return Math.round((sd / mean) * 100) / 100; };

type Variant = { sku: string; sub: string; rev: number; cost: number; costNA: boolean; orders: number; returns: number; leadDays: number; stockQty: number; mr: number[]; mc: number[]; mo: number[] };
const buildModels = () => [...modelMap.entries()].map(([model, sks]) => {
  const mr = z16(), mo = z16(), mc = z16();
  const variants: Variant[] = sks.map((sk) => {
    const vmr = (skuMonRev[sk] || z16()).map((x) => mln(x));
    const vmo = [...(skuMonOrd[sk] || z16())];
    const cu = cogs[sk] || 0;
    const vmc = vmo.map((u) => mln(cu * u));
    for (let i = 0; i < 16; i++) { mr[i] += vmr[i]!; mo[i] += vmo[i]!; mc[i] += vmc[i]!; }
    return { sku: taxOf(sk).offer || sk, sub: skuName[sk] || sk, rev: mln(totRevWin(sk)), cost: mln(cu * (skuUnits[sk] || 0)), costNA: cu <= 0, orders: skuUnits[sk] || 0, returns: skuRet[sk] || 0, leadDays: 0, stockQty: stockOf[sk] || 0, mr: vmr, mc: vmc, mo: vmo };
  });
  const g = catOf(sks[0]!), sub = subOf(sks[0]!);
  const costNA = variants.some((v) => v.costNA);
  const round3 = (a: number[]) => a.map((x) => Math.round(x * 1000) / 1000);
  return {
    nm: model, line: skuLine[sks[0]!] || g, sub: sub + " · " + sks.length + " арт.",
    subcatId: subIdOf(g, sub), groupId: grIdOf(g), abc: modelAbc[model] || "C", cv: cv(mr),
    cost: Math.round(variants.reduce((s, v) => s + v.cost, 0) * 1000) / 1000, costNA,
    mr: round3(mr), mc: round3(mc), mo, variants,
  };
}).sort((a, b) => b.mr.reduce((s, x) => s + x, 0) - a.mr.reduce((s, x) => s + x, 0));
const PRODUCTS = buildModels();

// --- помесячные ряды ---
const MONTHS = WIN.map((m) => ({ m: monLabel(m), r: Math.round(facts.filter((f) => f.date.slice(0, 7) === m).reduce((a, f) => a + f.revenue, 0) / 1e6 * 100) / 100 }));
const ozRev = mln(facts.reduce((a, f) => a + f.revenue, 0));
const ozOrd = facts.reduce((a, f) => a + f.units, 0);
const CHANNELS = [
  { id: "site", name: "Сайт genglass.ru", short: "Сайт", rev: 0, prev: 0, orders: 0 },
  { id: "des", name: "Дизайнеры", short: "Дизайн.", rev: 0, prev: 0, orders: 0 },
  { id: "dil", name: "Дилеры", short: "Дилеры", rev: 0, prev: 0, orders: 0 },
  { id: "ozon", name: "Озон", short: "Озон", rev: ozRev, prev: ozRev, orders: ozOrd },
  { id: "wb", name: "Wildberries", short: "WB", rev: 0, prev: 0, orders: 0 },
  { id: "show", name: "Шоурум Домодедово", short: "Шоурум", rev: 0, prev: 0, orders: 0 },
  { id: "ym", name: "Яндекс Маркет", short: "Я.Маркет", rev: 0, prev: 0, orders: 0 },
];
const allSubIds = CAT_TREE.flatMap((g) => g.children.map((c) => c.id));
const MX_DATA: Record<string, Record<string, number>> = {};
for (const ch of CHANNELS) { const row: Record<string, number> = {}; for (const sid of allSubIds) row[sid] = ch.id === "ozon" ? mln(subRev[sid] || 0) : 0; MX_DATA[ch.id] = row; }
const CAT_MONTHLY: Record<string, { r: number[]; o: number[] }> = {};
const SUBCAT_MONTHLY: Record<string, number[]> = {};
for (const [g, gr] of groups) for (const [sub, sks] of gr) {
  const r = z16(), o = z16();
  for (const sk of sks) for (let i = 0; i < 16; i++) { r[i] += mln((skuMonRev[sk] || z16())[i] ?? 0); o[i] += (skuMonOrd[sk] || z16())[i] ?? 0; }
  const rr = r.map((x) => Math.round(x * 1000) / 1000);
  CAT_MONTHLY[subIdOf(g, sub)] = { r: rr, o };
  SUBCAT_MONTHLY[subIdOf(g, sub)] = rr;
}
const avgCheckThousand = ozOrd ? Math.round(ozRev * 1e6 / ozOrd / 1000) : 0;

// --- РЕАЛЬНЫЕ дневные ряды (вместо синтетической развёртки месяцев шаблона) ---
// День 0 = первое число первого месяца окна. Дни до старта аккаунта (2026-02) - честные нули.
const BASE_Y = Number(WIN[0]!.slice(0, 4)), BASE_M = Number(WIN[0]!.slice(5, 7));
const TOTAL = daysIn.reduce((a, b) => a + b, 0);
const dayIdx = (date: string) => Math.round((Date.parse(date + "T00:00Z") - Date.UTC(BASE_Y, BASE_M - 1, 1)) / 86400000);
const maxIdx = dayIdx(maxD);
const zD = () => new Array(TOTAL).fill(0);
const DAILY_REV_REAL = zD();          // млн ₽/день, весь канал
const SUB_D_R: Record<string, number[]> = {};  // подкатегория -> млн ₽/день
const SUB_D_O: Record<string, number[]> = {};  // подкатегория -> заказов/день
const PRODUCT_DAILY: Record<string, number[]> = {}; // модель(nm)/артикул(label) -> заказов/день
const skuSubId: Record<string, string> = {}, skuModel: Record<string, string> = {}, skuLabel: Record<string, string> = {};
for (const sk of allSkus) { skuSubId[sk] = subIdOf(catOf(sk), subOf(sk)); skuModel[sk] = modelOf(sk); skuLabel[sk] = taxOf(sk).offer || sk; }
for (const f of facts) {
  const i = dayIdx(f.date); if (i < 0 || i >= TOTAL) continue;
  const sk = String(f.sku);
  DAILY_REV_REAL[i] = (DAILY_REV_REAL[i] ?? 0) + f.revenue / 1e6;
  const sid = skuSubId[sk]!;
  const a1 = (SUB_D_R[sid] ||= zD()); a1[i] = (a1[i] ?? 0) + f.revenue / 1e6;
  const a2 = (SUB_D_O[sid] ||= zD()); a2[i] = (a2[i] ?? 0) + f.units;
  const a3 = (PRODUCT_DAILY[skuModel[sk]!] ||= zD()); a3[i] = (a3[i] ?? 0) + f.units;
  const a4 = (PRODUCT_DAILY[skuLabel[sk]!] ||= zD()); a4[i] = (a4[i] ?? 0) + f.units;
}
const r4 = (a: number[]) => a.map((x) => Math.round(x * 10000) / 10000);
for (const k in SUB_D_R) SUB_D_R[k] = r4(SUB_D_R[k]!);

// Патчи дневной достоверности: «сегодня» = последний день данных; день-0 = старт окна;
// дневные ряды KPI/план-факта/хитмапа - реальные, не размазка месяцев.
function patchRealDaily(html: string, opts: { products?: boolean }): string {
  let out = html;
  out = out.replace(/const TODAY_IDX = TOTAL_DAYS - 1;[^\n]*/g, `const TODAY_IDX = ${maxIdx}; // последний день реальных данных ${maxD}`);
  out = out.replace(/Date\.UTC\(2025, ?0, ?1\)/g, `Date.UTC(${BASE_Y},${BASE_M - 1},1)`);
  // Строковая база дня-индекса. Шаблон считал индекс от 2025-01-01, а наши реальные дневные
  // ряды индексируются от начала окна (WIN[0]). Из-за сдвига кастомный выбор даты давал не тот
  // период. Выравниваем строковую базу с дневными рядами.
  const baseDateStr = `${BASE_Y}-${String(BASE_M).padStart(2, "0")}-01`;
  out = out.replace(/2025-01-01T00:00:00Z/g, `${baseDateStr}T00:00:00Z`);
  out = out.replace(/customFrom: ?'2025-01-01'/g, "customFrom: '2026-02-06'");
  // Дефолтные значения дат-пикеров (вне данных 2025-01-01) -> начало реальных данных.
  out = out.replace(/value="2025-01-01"/g, 'value="2026-02-06"');
  out = out.replace(/bFrom: ?'2025-01-01'/g, "bFrom:'2026-02-06'");
  out = out.replace(/const DAILY_REV = buildDailyFromMonths\(MONTHS\.map\(m => m\.r\)\);/g,
    "const DAILY_REV = (window.__DAILY_REV_REAL || buildDailyFromMonths(MONTHS.map(m => m.r)));");
  out = out.replace(/const DAILY_REV_CAT = \{\};/g,
    "const __SUB_D_R = window.__SUB_D_R || {}; const __SUB_D_O = window.__SUB_D_O || {};\nconst DAILY_REV_CAT = {};");
  out = out.replace(/DAILY_REV_CAT\[sub\.id\] = buildDailyFromMonths\(monthlyRev\);/g,
    "DAILY_REV_CAT[sub.id] = __SUB_D_R[sub.id] || buildDailyFromMonths(monthlyRev);");
  out = out.replace(/DAILY_ORD_CAT\[sub\.id\] = DAILY_REV_CAT\[sub\.id\]\.map\(r => Math\.round\(r \* 1000 \/ AVG_PRICE\)\);/g,
    "DAILY_ORD_CAT[sub.id] = __SUB_D_O[sub.id] || DAILY_REV_CAT[sub.id].map(r => Math.round(r * 1000 / AVG_PRICE));");
  // форма v55: из CAT_MONTHLY
  out = out.replace(/DAILY_REV_CAT\[sub\.id\] = buildDailyFromMonths\(cm\.r\);/g,
    "DAILY_REV_CAT[sub.id] = __SUB_D_R[sub.id] || buildDailyFromMonths(cm.r);");
  out = out.replace(/DAILY_ORD_CAT\[sub\.id\] = buildDailyFromMonths\(cm\.o\)\.map\(v => Math\.round\(v\)\);/g,
    "DAILY_ORD_CAT[sub.id] = __SUB_D_O[sub.id] || buildDailyFromMonths(cm.o).map(v => Math.round(v));");
  if (opts.products) {
    out = out.replace(/items\.forEach\(it=> it\.daily=buildDailyFromMonths\(it\.mo\)\);/g,
      "const __PD = window.__PRODUCT_DAILY || {}; items.forEach(it=> it.daily = __PD[it.label] || buildDailyFromMonths(it.mo));");
    out = out.replace(/Источник — помесячные данные\.[^<]*/g,
      "Ячейки - реальные заказы по дням из OZON API (история с 06.02.2026, до этой даты аккаунт не работал - нули честные).");
  }
  return out;
}
const REAL_DAILY_JS = (withProducts: boolean) =>
  `<script>window.__DAILY_REV_REAL=${JSON.stringify(r4(DAILY_REV_REAL))};window.__SUB_D_R=${JSON.stringify(SUB_D_R)};window.__SUB_D_O=${JSON.stringify(SUB_D_O)};${withProducts ? `window.__PRODUCT_DAILY=${JSON.stringify(PRODUCT_DAILY)};` : ""}</script>`;

// --- дельты периодов из истории ---
const ad = (d: string, n: number) => { const t = new Date(d + "T00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const sumBetween = (from: string, to: string, key: "revenue" | "units") => facts.filter((f) => f.date >= from && f.date <= to).reduce((a, f) => a + (f as any)[key], 0);
function delta(days: number) {
  const cf = ad(maxD, -(days - 1)), pf = ad(cf, -days), pt = ad(cf, -1);
  const cr = sumBetween(cf, maxD, "revenue"), pr = sumBetween(pf, pt, "revenue");
  const co = sumBetween(cf, maxD, "units"), po = sumBetween(pf, pt, "units");
  return { rev: pr ? Math.round((cr - pr) / pr * 1000) / 10 : 0, ord: po ? Math.round((co - po) / po * 1000) / 10 : 0 };
}
const d30 = delta(30), d90 = delta(90), d7 = delta(7);
const PERIOD_DELTAS = {
  today: { label: "к вчера", rev: 0, ord: 0, avg: 0, otif: 0, ret: 0, conv: 0 },
  "7d": { label: "к прошлой неделе", rev: d7.rev, ord: d7.ord, avg: 0, otif: 0, ret: 0, conv: 0 },
  "30d": { label: "к прошлым 30 дням", rev: d30.rev, ord: d30.ord, avg: 0, otif: 0, ret: 0, conv: 0 },
  "90d": { label: "к прошлым 90 дням", rev: d90.rev, ord: d90.ord, avg: 0, otif: 0, ret: 0, conv: 0 },
  year: { label: "нет базы за год", rev: 0, ord: 0, avg: 0, otif: 0, ret: 0, conv: 0 },
  all: { label: "за всё время", rev: 0, ord: 0, avg: 0, otif: 0, ret: 0, conv: 0 },
};

// --- балансная замена литерала константы ---
function replaceConst(src: string, name: string, literal: string): string {
  const m = src.indexOf("const " + name + " =");
  if (m < 0) throw new Error("не найдена const " + name);
  let i = src.indexOf("=", m) + 1;
  while (i < src.length && " \t\n".includes(src[i]!)) i++;
  const open = src[i]!;
  if (open !== "[" && open !== "{") {
    const end = src.indexOf(";", i); return src.slice(0, i) + literal + src.slice(end);
  }
  const close = open === "[" ? "]" : "}";
  let depth = 0, j = i, str = "";
  for (; j < src.length; j++) {
    const ch = src[j];
    if (str) { if (ch === "\\") { j++; continue; } if (ch === str) str = ""; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { str = ch as string; continue; }
    if (ch === "/" && src[j + 1] === "/") { j = src.indexOf("\n", j); if (j < 0) j = src.length; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) { j++; break; } }
  }
  return src.slice(0, i) + literal + src.slice(j);
}

// --- честность маржи в шаблоне: непокрытое = «н/д» серым, без выдуманного фоллбэка 35% ---
// Фикс матрицы ABC×XYZ (порт из v57 Кати + поправка по аудиту ФЕНИКСА).
// Абсолютные пороги cv<0.10/0.25 на разреженных данных МП валят почти все в Z.
// НО перцентили по ВСЕМ моделям тоже врут: модели с 1 месяцем продаж имеют cv=0 и забивают X.
// Поэтому: cv=0 (меньше 2 месяцев данных - о стабильности судить нельзя) ИСКЛЮЧАЕМ из матрицы;
// перцентили p33/p67 считаем ТОЛЬКО по моделям с реальной вариативностью (cv>0).
function patchXyzMatrix(html: string): string {
  return html.replace(
    /const classified = classifyABC\(skus\)\.map\(sk => \(\{\.\.\.sk, \.\.\.classifyXYZ\(sk\)\}\)\);/g,
    "const classified = classifyABC(skus).map(sk => ({...sk, ...classifyXYZ(sk)}));\n" +
    "  const _cvS = classified.filter(s=>typeof s.cv==='number'&&s.cv>0).map(s=>s.cv).sort((a,b)=>a-b);\n" +
    "  const _cvQ = q => _cvS.length ? _cvS[Math.min(_cvS.length-1, Math.floor(q*_cvS.length))] : Infinity;\n" +
    "  const _cvP33 = _cvQ(1/3), _cvP67 = _cvQ(2/3);\n" +
    "  for(let _i=classified.length-1;_i>=0;_i--){ const s=classified[_i];\n" +
    "    if(!(typeof s.cv==='number'&&s.cv>0)){ classified.splice(_i,1); continue; }\n" +
    "    s.xyz = (s.cv<=_cvP33)?'X':(s.cv<=_cvP67?'Y':'Z'); }"
  );
}

function patchMarginHonesty(html: string): string {
  let out = html;
  // ячейка без маржи - графит, не «красная低»
  out = out.replace(/const bg = colorByRank\(c\.margin \?\? 0, minM, maxM\);/g,
    "const bg = (c.margin==null) ? 'hsl(220, 8%, 27%)' : colorByRank(c.margin, minM, maxM);");
  // ранжирование цвета - только по реальным маржам
  out = out.replace(/const margs = cells\.map\(c => c\.margin \?\? 0\);/g,
    "const margs = cells.filter(c => c.margin!=null).map(c => c.margin); if(!margs.length) margs.push(0);");
  // взвешенная маржа группы - только по покрытым подкатегориям (без «?? 35»)
  out = out.replace(/const base = g\.children\.reduce\(\(s,c\) => s \+ c\.rev, 0\);\s*\n(\s*)if\(base === 0\) return null;\s*\n\s*return g\.children\.reduce\(\(s,c\) => s \+ c\.rev \* \(SUBCAT_MARGIN\[c\.id\] \?\? 35\), 0\) \/ base;/g,
    "const cov = g.children.filter(c => SUBCAT_MARGIN[c.id] !== undefined);\n$1const base = cov.reduce((s,c) => s + c.rev, 0);\n$1if(base === 0) return null;\n$1return cov.reduce((s,c) => s + c.rev * SUBCAT_MARGIN[c.id], 0) / base;");
  // categoryMargin / categoryMarginForRange: фоллбэк 35 -> null/только покрытые
  out = out.replace(/if\(!g\) return 35;/g, "if(!g) return null;");
  out = out.replace(/return base \? g\.children\.reduce\(\(s,c\) => s \+ c\.rev \* \(SUBCAT_MARGIN\[c\.id\] \?\? 35\), 0\) \/ base : 35;/g,
    "{ const cov = g.children.filter(c => SUBCAT_MARGIN[c.id] !== undefined); const cb = cov.reduce((s,c)=>s+c.rev,0); return cb ? cov.reduce((s,c)=>s+c.rev*SUBCAT_MARGIN[c.id],0)/cb : null; }");
  out = out.replace(/w \+= r; m \+= r \* \(SUBCAT_MARGIN\[c\.id\] \?\? 35\);/g,
    "if(SUBCAT_MARGIN[c.id] !== undefined){ w += r; m += r * SUBCAT_MARGIN[c.id]; }");
  // «Рентабельность» (сравнение А/Б): подкатегории без С/С не включаем в линии cost/margin
  out = out.replace(/const m = SUBCAT_MARGIN\[sub\.id\] \?\? 35;/g,
    "const m = SUBCAT_MARGIN[sub.id]; if(m == null) return;");
  // «Категории × Каналы»: взвешенная маржа группы/итога - только по покрытым; у подкатегорий без С/С margin=null
  out = out.replace(/const margin = groupRevBase > 0\s*\n\s*\? g\.children\.reduce\(\(s, c\) => s \+ c\.rev \* \(SUBCAT_MARGIN\[c\.id\] \?\? 35\), 0\) \/ groupRevBase\s*\n\s*: 0;/g,
    "const covCh = g.children.filter(c => SUBCAT_MARGIN[c.id] !== undefined);\n    const covBase = covCh.reduce((s, c) => s + c.rev, 0);\n    const margin = covBase > 0 ? covCh.reduce((s, c) => s + c.rev * SUBCAT_MARGIN[c.id], 0) / covBase : null;");
  out = out.replace(/s \+ g\.children\.reduce\(\(ss, c\) => ss \+ c\.rev \* \(SUBCAT_MARGIN\[c\.id\] \?\? 35\), 0\), 0/g,
    "s + g.children.reduce((ss, c) => ss + (SUBCAT_MARGIN[c.id] !== undefined ? c.rev * SUBCAT_MARGIN[c.id] : 0), 0), 0");
  out = out.replace(/const grandRevBase = CAT_TREE\.reduce\(\(s, g\) => s \+ g\.children\.reduce\(\(ss, c\) => ss \+ c\.rev, 0\), 0\);/g,
    "const grandRevBase = CAT_TREE.reduce((s, g) => s + g.children.reduce((ss, c) => ss + (SUBCAT_MARGIN[c.id] !== undefined ? c.rev : 0), 0), 0);");
  out = out.replace(/const margin = SUBCAT_MARGIN\[c\.id\] \?\? 35;/g,
    "const margin = SUBCAT_MARGIN[c.id] ?? null;");
  // marginClass и ячейки маржи: null -> «н/д» без класса
  out = out.replace(/const marginClass = m => m >= 45 \? 'good' : \(m >= 30 \? 'warn' : 'bad'\);/g,
    "const marginClass = m => m == null ? '' : (m >= 45 ? 'good' : (m >= 30 ? 'warn' : 'bad'));");
  out = out.replace(/\$\{fmt\(g\.margin,1\)\}%/g, "${g.margin==null?'н/д':fmt(g.margin,1)+'%'}");
  out = out.replace(/\$\{fmt\(s\.margin,1\)\}%/g, "${s.margin==null?'н/д':fmt(s.margin,1)+'%'}");
  return out;
}

// Шапка инструмента: только новые страницы (решение Ивана - старые из шапки убраны).
const KPAGES: [string, string, string][] = [
  ["katya-command.html", "Командный центр", "command"],
  ["katya.html", "Обзор", "obzor"],
  ["katya-tovary.html", "Товары и заказы", "tovary"],
  ["katya-voronka.html", "Воронка", "voronka"],
  ["katya-marketing.html", "Маркетинг", "marketing"],
  ["katya-money.html", "Деньги", "money"],
];
function banner(active: string): string {
  const snap = `${MONTHS[11]?.m || ""}-${MONTHS[15]?.m || ""}`;
  const k = (href: string, label: string, on: boolean) =>
    `<a href="${href}" style="color:${on ? "#0B0F15" : "#22D3EE"};background:${on ? "#22D3EE" : "transparent"};border:1px solid #22D3EE;border-radius:7px;padding:3px 10px;text-decoration:none;white-space:nowrap">${label}</a>`;
  return `<div id="gg-nav" style="background:#1a2330;border-bottom:1px solid #22d3ee;color:#cfe8ef;font:13px/1.6 system-ui;padding:8px 18px">
  <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center">
    ${KPAGES.map(([h, l, key]) => k(h, l, key === active)).join(" ")}
    <span style="color:#5d7484;margin-left:8px">живой OZON (${snap}) · прочие каналы/клиенты/план - нет данных</span>
  </div></div>`;
}

// --- Гуру-виджет: всплывающий ИИ-аналитик на каждой странице ---
// Дёргает n8n «Гуру-аналитик v2»: живой OZON за выбранный период + GPT-4o с памятью диалога.
// Кнопка «ИИ-разбор» у каждого блока шлёт контекст блока и активные фильтры.
const GURU_URL = "https://gen-group.app.n8n.cloud/webhook/gengroup-ozon-guru";
const GURU_JS = `<style>
#gg-guru-btn{position:fixed;right:18px;bottom:18px;z-index:9000;width:56px;height:56px;border-radius:50%;background:#22D3EE;color:#06121a;border:none;font:700 13px/1 system-ui;cursor:pointer;box-shadow:0 6px 24px rgba(34,211,238,.45)}
#gg-guru{position:fixed;right:18px;bottom:84px;z-index:9001;width:400px;max-width:calc(100vw - 24px);height:min(560px,calc(100vh - 120px));display:none;flex-direction:column;background:#10161f;border:1px solid #22D3EE;border-radius:14px;overflow:hidden;font:13.5px/1.55 system-ui;color:#dfe9f0}
#gg-guru.open{display:flex}
#gg-guru .gh{padding:10px 14px;background:#16202c;border-bottom:1px solid #233242;display:flex;justify-content:space-between;align-items:center}
#gg-guru .gm{flex:1;overflow-y:auto;padding:12px 14px;white-space:pre-wrap}
#gg-guru .gm .q{color:#22D3EE;margin:10px 0 4px;font-weight:700}
#gg-guru .gm .a{color:#dfe9f0;margin-bottom:8px}
#gg-guru .gm .w{color:#8aa0b0;font-style:italic}
#gg-guru .gi{display:flex;gap:8px;padding:10px;border-top:1px solid #233242}
#gg-guru .gi input{flex:1;background:#0c1218;border:1px solid #2a3a4a;color:#dfe9f0;border-radius:8px;padding:9px 11px;font:inherit}
#gg-guru .gi button{background:#22D3EE;color:#06121a;border:none;border-radius:8px;padding:9px 14px;font:700 13px system-ui;cursor:pointer}
.gg-ai-btn{margin-left:8px;background:transparent;border:1px solid #22D3EE;color:#22D3EE;border-radius:6px;padding:2px 8px;font:600 11px system-ui;cursor:pointer;vertical-align:middle}
@media (max-width:640px){#gg-guru{right:8px;left:8px;width:auto}}
</style>
<button id="gg-guru-btn" title="Гуру-аналитик: вопрос по живым данным OZON">ИИ</button>
<div id="gg-guru"><div class="gh"><b>Гуру-аналитик · живой OZON</b><button id="gg-guru-x" style="background:none;border:none;color:#8aa0b0;font-size:16px;cursor:pointer">×</button></div>
<div class="gm" id="gg-guru-m"><div class="w">Спроси про продажи, рекламу, воронку, линии - отвечаю по живым данным OZON API за выбранный период. Помню контекст диалога. Кнопка «ИИ-разбор» у блоков даёт аналитику блока с учётом фильтров.</div></div>
<div class="gi"><input id="gg-guru-q" placeholder="Например: что с продажами за неделю?"><button id="gg-guru-s">→</button></div></div>
<script>(function(){
var URL='${GURU_URL}';
var LS=(typeof localStorage!=='undefined')?localStorage:{getItem:function(){return null;},setItem:function(){}};
var sid=LS.getItem('gg_guru_sid');if(!sid){sid='s'+Date.now()+Math.random().toString(36).slice(2,8);LS.setItem('gg_guru_sid',sid);}
var MAXD=window.__GG_MAXD||'', box=document.getElementById('gg-guru'), msgs=document.getElementById('gg-guru-m');
document.getElementById('gg-guru-btn').onclick=function(){box.classList.toggle('open');};
document.getElementById('gg-guru-x').onclick=function(){box.classList.remove('open');};
function ad(d,n){var t=new Date(d+'T00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);}
function period(){
  if(window.__guruPeriod)return window.__guruPeriod;
  var s=null;try{s=JSON.parse(LS.getItem('gg_katya_period')||'null');}catch(e){}
  if(!s||!MAXD)return {};
  if(s.p==='range'&&s.from&&s.to)return {curFrom:s.from,curTo:s.to};
  var days={'today':1,'7d':7,'30d':30,'90d':90}[s.p];
  if(!days)return {curFrom:'2026-02-06',curTo:MAXD};
  return {curFrom:ad(MAXD,-(days-1)),curTo:MAXD};
}
function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML;}
var busy=false;
var TEMP=/сравн|вчера|недел|месяц|квартал|январ|феврал|март|апрел|\\bмая\\b|\\bмай\\b|июн|июл|август|сентябр|октябр|ноябр|декабр|начал|серед|конц|конец|период|динамик/i;
function ask(q,page){
  if(busy||!q)return;busy=true;
  box.classList.add('open');
  msgs.insertAdjacentHTML('beforeend','<div class="q">Вы: '+esc(q)+'</div><div class="w" id="gg-wait">Гуру тянет живые данные OZON и думает (20-60 сек)...</div>');
  msgs.scrollTop=msgs.scrollHeight;
  var body={question:q,sessionId:sid};
  if(!TEMP.test(q)){var p=period();if(p.curFrom){body.curFrom=p.curFrom;body.curTo=p.curTo;}if(p.cmpFrom){body.cmpFrom=p.cmpFrom;body.cmpTo=p.cmpTo;}}
  if(page)body.page=page;
  var ctrl=('AbortController' in window)?new AbortController():null;
  var tid=setTimeout(function(){if(ctrl)ctrl.abort();},90000);
  fetch(URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctrl?ctrl.signal:undefined})
  .then(function(r){clearTimeout(tid);return r.text().then(function(t){if(!r.ok)throw new Error('сервис вернул '+r.status);if(!t)throw new Error('пустой ответ (Гуру не успел вовремя)');var j;try{j=JSON.parse(t);}catch(e){throw new Error('ответ не распознан');}return j;});})
  .then(function(j){var w=document.getElementById('gg-wait');if(w)w.remove();
    var a=(j&&j.analysis)||'(пустой ответ)';
    msgs.insertAdjacentHTML('beforeend','<div class="a">'+esc(a)+(j&&j.curFrom?'<div class="w">период данных: '+j.curFrom+'..'+j.curTo+(j.period?' ('+j.period+')':'')+'</div>':'')+'</div>');
    msgs.scrollTop=msgs.scrollHeight;busy=false;})
  .catch(function(e){clearTimeout(tid);var w=document.getElementById('gg-wait');if(w)w.remove();
    msgs.insertAdjacentHTML('beforeend','<div class="a" style="color:#ff8a8e">Не получилось: '+esc(e.message)+'. Гуру дёргает живой OZON и GPT - это 20-60 сек; попробуй ещё раз или сократи вопрос.</div>');
    busy=false;});
}
window.__guruAsk=ask;
var inp=document.getElementById('gg-guru-q');
document.getElementById('gg-guru-s').onclick=function(){var q=inp.value.trim();inp.value='';ask(q);};
inp.addEventListener('keydown',function(e){if(e.key==='Enter'){var q=inp.value.trim();inp.value='';ask(q);}});
// «ИИ-разбор» у каждого блока: контекст = заголовок блока + активные фильтры страницы
function filtersDigest(){
  var out=[];document.querySelectorAll('select').forEach(function(s){if(s.value&&s.selectedIndex>0)out.push((s.options[s.selectedIndex]||{}).text);});
  document.querySelectorAll('.dd-btn,.pb.act,.chip.on').forEach(function(b){var t=(b.textContent||'').trim();if(t&&t.length<40)out.push(t);});
  return out.filter(Boolean).slice(0,8).join(', ');
}
function attach(){
  document.querySelectorAll('.card-title,h2').forEach(function(h){
    if(h.querySelector('.gg-ai-btn'))return;
    var t=(h.childNodes[0]&&h.childNodes[0].textContent||h.textContent||'').trim();
    if(!t||t.length>60)return;
    var b=document.createElement('button');b.className='gg-ai-btn';b.textContent='ИИ-разбор';b.title='Объективная ИИ-аналитика этого блока по живым данным с учётом фильтров';
    b.onclick=function(ev){ev.stopPropagation();ask('Дай объективную аналитику блока "'+t+'" дашборда: что в нём важно, что хорошо, что плохо, что делать.','Блок: '+t+'. Активные фильтры/период: '+(filtersDigest()||'по умолчанию'));};
    h.appendChild(b);});
}
attach();setInterval(attach,2500);
})();</script>`;

// Проброс периода между katya-страницами: клики по кнопкам периода/диапазона/сравнения
// сохраняются в localStorage и воспроизводятся при загрузке другой страницы.
const PERSIST_JS = `<script>(function(){var K='gg_katya_period';
function save(o){try{localStorage.setItem(K,JSON.stringify(o));}catch(e){}}
function read(){try{return JSON.parse(localStorage.getItem(K)||'null');}catch(e){return null;}}
function gv(id){var el=document.getElementById(id);return el?el.value:'';}
function sv(id,v){var el=document.getElementById(id);if(el&&v)el.value=v;}
document.querySelectorAll('.pb[data-p]').forEach(function(b){b.addEventListener('click',function(){save({p:b.dataset.p});});});
var ra=document.getElementById('range-apply');if(ra)ra.addEventListener('click',function(){save({p:'range',from:gv('range-from'),to:gv('range-to')});});
var ca=document.getElementById('cmp-apply');if(ca)ca.addEventListener('click',function(){var s=read()||{};s.cmp={af:gv('cmp-a-from'),at:gv('cmp-a-to'),bf:gv('cmp-b-from'),bt:gv('cmp-b-to')};save(s);});
var co=document.getElementById('cmp-off');if(co)co.addEventListener('click',function(){var s=read()||{};delete s.cmp;save(s);});
var s=read();if(!s)return;
if(s.p==='range'&&s.from&&s.to){sv('range-from',s.from);sv('range-to',s.to);if(ra)ra.click();}
else if(s.p){var b=document.querySelector('.pb[data-p="'+s.p+'"]');if(b)b.click();}
if(s.cmp&&ca){sv('cmp-a-from',s.cmp.af);sv('cmp-a-to',s.cmp.at);sv('cmp-b-from',s.cmp.bf);sv('cmp-b-to',s.cmp.bt);ca.click();}
})();</script>`;

// --- Универсальный слой подсказок-глоссария (всплывашки до мельчайших деталей) ---
// Наводишь на термин маркетплейса - получаешь человеческое объяснение. Работает на всех страницах.
const GLOSSARY: Record<string, string> = {
  "ДРР": "Доля рекламных расходов: сколько процентов выручки съедает реклама. Главное правило: ДРР должен быть НИЖЕ маржи, иначе реклама работает в минус.",
  "ROAS": "Окупаемость рекламы: сколько рублей выручки приносит 1 рубль рекламы. ROAS 5x = на 1 ₽ рекламы 5 ₽ продаж.",
  "CPO": "Стоимость заказа из рекламы: рекламный расход делить на число заказов с рекламы.",
  "GMV": "Валовый оборот: вся сумма заказов до вычета сборов OZON. Это не прибыль, а верхняя строка.",
  "ABC": "Деление товаров по вкладу в оборот: A - локомотивы (80% выручки), B - середняки, C - длинный хвост. Бьём по A.",
  "XYZ": "Деление по стабильности спроса: X - ровный, Y - сезонный, Z - рваный. AX - идеал, держим на складе всегда.",
  "OTIF": "Доставлено вовремя и в полном объёме (On Time In Full). Падает - страдает рейтинг и буст карточки.",
  "OOS": "Нет на складе (Out Of Stock). Локомотив в OOS - прямая потеря оборота и просадка позиций.",
  "индекс цены": "Наша цена против рынка: меньше 1 - мы дешевле, больше 1 - дороже. Дороже рынка - теряем буст и продажи.",
  "конверсия": "Какая доля посетителей доходит до цели. Показ в корзину, корзина в заказ. Падает - проблема с ценой, карточкой или трафиком.",
  "маржа после сборов": "Что остаётся после комиссии и логистики OZON. Реальная база для прибыли, а не голый оборот.",
  "средний чек": "Оборот делить на заказы. Растёт - продаём дороже или комплектами.",
  "реализация": "Сумма проданного по подписанным Актам OZON за закрытый месяц.",
  "к выплате": "Сколько OZON перечислит после удержания комиссии, логистики и услуг.",
  "возврат": "Покупатель вернул товар. Съедает маржу дважды: логистика туда и обратно.",
  "отмена": "Заказ отменён до выдачи. Высокий процент бьёт по рейтингу продавца.",
};
const HELP_JS = `<style>
.gloss{border-bottom:1px dotted rgba(34,211,238,.6);cursor:help}
#gg-tip{position:fixed;z-index:9500;max-width:280px;background:#0c1520;border:1px solid #22D3EE;border-radius:9px;padding:9px 11px;font:12px/1.5 system-ui;color:#dfe9f0;box-shadow:0 8px 24px rgba(0,0,0,.5);pointer-events:none;display:none}
</style><script>(function(){
var G=${JSON.stringify(GLOSSARY)};
var terms=Object.keys(G).sort(function(a,b){return b.length-a.length;});
var tip=document.createElement('div');tip.id='gg-tip';document.body.appendChild(tip);
function show(e,t){tip.textContent=t;tip.style.display='block';var x=e.clientX+14,y=e.clientY+14;if(x+290>innerWidth)x=e.clientX-290;if(y+120>innerHeight)y=e.clientY-120;tip.style.left=x+'px';tip.style.top=y+'px';}
function hide(){tip.style.display='none';}
var SEL='.kt-k,.card-sub,.card-title,.kt-note,.oh-note,th,.kpi-k,.lab,.sub,.mx-total-h,.pt-filter-lbl';
var seen=0;
function scan(){
  document.querySelectorAll(SEL).forEach(function(el){
    if(el.getAttribute('data-gl'))return;el.setAttribute('data-gl','1');
    var html=el.innerHTML;var changed=false;
    terms.forEach(function(t){
      if(el.querySelector('.gloss'))return;
      var re=new RegExp('(?<![\\\\w>])('+t.replace(/[.*+?^()|[\\]\\\\]/g,'\\\\$&')+')(?![\\\\w<])','');
      if(re.test(html)&&html.indexOf('class="gloss"')<0){html=html.replace(re,'<span class="gloss" data-t="'+t+'">$1</span>');changed=true;}
    });
    if(changed){el.innerHTML=html;seen++;}
  });
  document.querySelectorAll('.gloss[data-t]').forEach(function(s){
    if(s.getAttribute('data-b'))return;s.setAttribute('data-b','1');
    var t=G[s.getAttribute('data-t')];
    s.addEventListener('mousemove',function(e){show(e,t);});
    s.addEventListener('mouseleave',hide);
  });
}
scan();setInterval(scan,2000);
})();</script>`;

// --- Закрепление верхнего фильтра (sticky-фикс) + фильтр по каналам на всех вкладках ---
// 1) body{overflow-x:hidden} ломал position:sticky топбара - меняем на overflow-x:clip.
// 2) В ту же закреплённую панель периодов добавляем селектор канала. Живой только OZON,
//    прочие каналы дают честное «нет данных» (оверлей), выбор пробрасывается между страницами.
const CHANNEL_JS = `<style>
html,body{overflow-x:clip}
#gg-fixedtop{position:fixed;top:0;left:0;right:0;z-index:300;background:#0b0f17}
#gg-fixedtop .topbar{position:static}
.gg-chan{position:relative;display:inline-flex;align-items:center;gap:6px;margin-right:6px}
.gg-chan-lbl{font:12px system-ui;color:#5d7484}
.gg-chan-btn{background:#0c1218;border:1px solid #2a3a4a;color:#dfe9f0;border-radius:7px;padding:5px 11px;font:13px system-ui;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.gg-chan-pan{position:absolute;top:110%;left:0;z-index:320;background:#10161f;border:1px solid #2a3a4a;border-radius:9px;padding:6px;min-width:210px;display:none;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.gg-chan-pan.open{display:block}
.gg-chan-pan label{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;font:13px system-ui;color:#dfe9f0;cursor:pointer}
.gg-chan-pan label:hover{background:rgba(255,255,255,.04)}
.gg-chan-pan .nd{color:#5d7484;font-size:11px;margin-left:auto}
.gg-chan-pan .sep{height:1px;background:#233242;margin:4px 0}
#gg-chan-ovl{position:fixed;inset:0;z-index:250;background:rgba(7,12,18,.9);display:none;align-items:center;justify-content:center;text-align:center;padding:20px}
#gg-chan-ovl .box{max-width:460px;color:#dfe9f0;font:15px/1.7 system-ui}
#gg-chan-ovl b{color:#22D3EE}
#gg-chan-ovl button{margin-top:16px;background:#22D3EE;color:#06121a;border:none;border-radius:8px;padding:10px 18px;font:700 13px system-ui;cursor:pointer}
</style>
<div id="gg-chan-ovl"><div class="box">Выбранные каналы (<b id="gg-chan-name"></b>): <b>нет данных</b>.<br>Живой канал сейчас - только <b>Озон</b> (прочие пока не подключены к API). Добавь Озон в выбор, чтобы увидеть данные.<br><button id="gg-chan-back">← Показать Озон</button></div></div>
<script>(function(){
var CH=[['ozon','Озон',1],['site','Сайт genglass.ru',0],['des','Дизайнеры',0],['dil','Дилеры',0],['wb','Wildberries',0],['show','Шоурум Домодедово',0],['ym','Яндекс Маркет',0]];
var LS=(typeof localStorage!=='undefined')?localStorage:{getItem:function(){return null;},setItem:function(){}};
var sel; try{sel=JSON.parse(LS.getItem('gg_channels')||'null');}catch(e){} if(!sel||!sel.length)sel=['ozon'];
function nameOf(id){for(var i=0;i<CH.length;i++)if(CH[i][0]===id)return CH[i][1];return id;}
function save(){LS.setItem('gg_channels',JSON.stringify(sel));}
// Железобетонное закрепление: nav + панель фильтров в fixed-обёртку, body получает отступ.
function fixTop(){
  if(document.getElementById('gg-fixedtop'))return;
  var nav=document.getElementById('gg-nav'),top=document.querySelector('.topbar');
  if(!top)return;
  var w=document.createElement('div');w.id='gg-fixedtop';
  var first=nav||top;first.parentNode.insertBefore(w,first);
  if(nav)w.appendChild(nav); w.appendChild(top);
  var pad=function(){document.body.style.paddingTop=w.offsetHeight+'px';};
  pad();addEventListener('resize',pad);[120,400,900,1800].forEach(function(t){setTimeout(pad,t);});
}
function label(){
  if(sel.length===CH.length)return 'Все каналы';
  if(sel.length===1)return nameOf(sel[0]);
  return nameOf(sel[0])+' +'+(sel.length-1);
}
function build(){
  var per=document.querySelector('.periods'); if(!per||document.getElementById('gg-chan-wrap'))return;
  var wrap=document.createElement('span');wrap.className='gg-chan';wrap.id='gg-chan-wrap';
  var l=document.createElement('span');l.className='gg-chan-lbl';l.textContent='Канал';wrap.appendChild(l);
  var btn=document.createElement('button');btn.className='gg-chan-btn';btn.id='gg-chan-btn';btn.innerHTML='<span id="gg-chan-cap"></span> ▾';wrap.appendChild(btn);
  var pan=document.createElement('div');pan.className='gg-chan-pan';pan.id='gg-chan-pan';
  var all=document.createElement('label');all.innerHTML='<input type="checkbox" id="gg-chan-all"> <b>Все каналы</b>';pan.appendChild(all);
  var sep=document.createElement('div');sep.className='sep';pan.appendChild(sep);
  CH.forEach(function(c){var lb=document.createElement('label');lb.innerHTML='<input type="checkbox" value="'+c[0]+'"> '+c[1]+(c[2]?'':'<span class="nd">нет данных</span>');pan.appendChild(lb);});
  wrap.appendChild(pan);per.insertBefore(wrap,per.firstChild);
  btn.addEventListener('click',function(e){e.stopPropagation();pan.classList.toggle('open');});
  document.addEventListener('click',function(){pan.classList.remove('open');});
  pan.addEventListener('click',function(e){e.stopPropagation();});
  all.querySelector('input').addEventListener('change',function(e){ sel = e.target.checked ? CH.map(function(c){return c[0];}) : ['ozon']; save();sync();apply(); });
  pan.querySelectorAll('input[value]').forEach(function(i){ i.addEventListener('change',function(){
    var v=i.value; if(i.checked){ if(sel.indexOf(v)<0)sel.push(v); } else { sel=sel.filter(function(x){return x!==v;}); }
    if(!sel.length)sel=['ozon']; save();sync();apply(); }); });
  sync();
}
function sync(){
  var pan=document.getElementById('gg-chan-pan'); if(!pan)return;
  pan.querySelectorAll('input[value]').forEach(function(i){i.checked=sel.indexOf(i.value)>=0;});
  var all=document.getElementById('gg-chan-all'); if(all)all.checked=(sel.length===CH.length);
  var cap=document.getElementById('gg-chan-cap'); if(cap)cap.textContent=label();
}
function apply(){
  var ovl=document.getElementById('gg-chan-ovl');
  var hasLive = sel.indexOf('ozon')>=0; // живые данные только у Озон
  if(!hasLive){ document.getElementById('gg-chan-name').textContent=sel.map(nameOf).join(', '); ovl.style.display='flex'; }
  else ovl.style.display='none';
}
var bk=document.getElementById('gg-chan-back');if(bk)bk.addEventListener('click',function(){sel=['ozon'];save();sync();apply();});
fixTop();build();apply();setInterval(function(){fixTop();build();},2000);
})();</script>`;

const J = (x: unknown) => JSON.stringify(x);

// --- Оболочка новых страниц в дизайн-системе Кати: её CSS + topbar с периодами ---
const KCSS = (readFileSync("katya/template.html", "utf-8").match(/<style>([\s\S]*?)<\/style>/) || ["", ""])[1];
const EXTRA_CSS = `
.kt-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
.kt-kpi .card{padding:12px 14px}.kt-k{font-size:11.5px;color:var(--ink-3);margin-bottom:4px}.kt-v{font-size:21px;font-weight:800;font-variant-numeric:tabular-nums}.kt-d{font-size:11.5px;margin-top:3px}.kt-d.up{color:var(--up)}.kt-d.dn{color:var(--dn)}.kt-d.na{color:var(--ink-3)}
.kt-table{width:100%;border-collapse:collapse;font-size:12.5px}.kt-table th{color:var(--ink-3);font-weight:600;text-align:left;padding:7px 8px;border-bottom:1px solid var(--bg-soft)}.kt-table td{padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.04)}.kt-table .r{text-align:right;font-variant-numeric:tabular-nums}
.kt-scroll{overflow-x:auto}.kt-note{font-size:11.5px;color:var(--ink-3);margin-top:8px}
.kt-fbar{height:30px;border-radius:7px;background:linear-gradient(90deg,#0E7490,#22D3EE);color:#06121a;font:700 12.5px/30px system-ui;padding-left:10px;margin:4px 0;min-width:36px}
.kt-src{display:inline-block;font-size:10.5px;border:1px solid var(--bg-soft);border-radius:6px;padding:2px 7px;color:var(--ink-3);margin-left:8px}.kt-src.live{border-color:#22D3EE;color:#22D3EE}
.kt-wf{display:flex;align-items:flex-end;gap:6px;height:190px;padding:8px 4px}.kt-wf>div{flex:1;text-align:center;font-size:10.5px;color:var(--ink-3)}.kt-wf .bar{border-radius:6px 6px 0 0;margin:0 auto;width:78%}
@media (max-width:700px){.kt-kpi{grid-template-columns:repeat(2,1fr)}.periods{flex-wrap:wrap}.main{padding:10px}}
`;
function kshell(title: string, activeKey: string, body: string, pageJs: string): string {
  const snapTo = maxD;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>GENGLASS · ${title}</title><style>${KCSS}${EXTRA_CSS}</style></head><body>
${banner(activeKey)}
<header class="topbar" style="position:relative">
  <div class="brand"><div class="brand-logo">GG</div><div><div class="brand-name">GENGLASS</div><div class="brand-sub">${title} · живой OZON · данные по ${snapTo}</div></div></div>
  <div class="topbar-spacer"></div>
  <div class="periods" id="periods">
    <button class="pb" data-p="today">Сегодня</button>
    <button class="pb" data-p="7d">7 дн</button>
    <button class="pb act" data-p="30d">30 дн</button>
    <button class="pb" data-p="90d">90 дн</button>
    <button class="pb" data-p="all">Всё время</button>
    <button class="pb range" id="btn-range">Свой</button>
  </div>
  <div class="range-panel" id="range-panel" style="display:none;position:absolute;right:16px;top:58px;background:var(--bg-card);border:1px solid var(--bg-soft);border-radius:10px;padding:12px;z-index:50">
    <div class="range-row" style="margin:4px 0"><label style="margin-right:6px">с</label><input type="date" id="range-from" value="2026-02-06"></div>
    <div class="range-row" style="margin:4px 0"><label style="margin-right:6px">по</label><input type="date" id="range-to" value="${maxD}"></div>
    <button class="pb" id="range-apply" style="margin-top:6px">Применить</button>
  </div>
</header>
<main class="main">${body}</main>
<script>window.__GG_MAXD='${maxD}';
const MAXD='${maxD}', FLOOR='2026-02-06';
const ad=(d,n)=>{const t=new Date(d+'T00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);};
const clampLo=d=>d<FLOOR?FLOOR:d;
const fmtRu=n=>new Intl.NumberFormat('ru-RU').format(Math.round(n));
function esc(t){var dv=document.createElement('div');dv.textContent=(t==null?'':String(t));return dv.innerHTML;}
const fMln=n=>Math.abs(n)>=1e6?(n/1e6).toFixed(2)+' М':fmtRu(n);
const dlt=(c,p,goodUp=true)=>{if(!p)return '<span class="kt-d na">нет базы</span>';const d=(c-p)/p;const up=d>=0;const good=goodUp?up:!up;return '<span class="kt-d '+(good?'up':'dn')+'">'+(up?'▲':'▼')+' '+(Math.abs(d)*100).toFixed(1)+'%</span>';};
function periodDates(p){
  if(p==='range'){const f=document.getElementById('range-from').value,t=document.getElementById('range-to').value;return {from:clampLo(f<t?f:t),to:(f<t?t:f)>MAXD?MAXD:(f<t?t:f)};}
  if(p==='all')return {from:FLOOR,to:MAXD};
  const days={'today':1,'7d':7,'30d':30,'90d':90}[p]||30;
  return {from:clampLo(ad(MAXD,-(days-1))),to:MAXD};
}
function prevEqual(w){const len=Math.round((Date.parse(w.to)-Date.parse(w.from))/86400000)+1;const pt=ad(w.from,-1);return {from:clampLo(ad(pt,-(len-1))),to:pt};}
let CURP=(function(){try{const s=JSON.parse(localStorage.getItem('gg_katya_period')||'null');return s&&s.p?s.p:'30d';}catch(e){return '30d';}})();
function applyPeriod(){
  document.querySelectorAll('.pb[data-p]').forEach(b=>b.classList.toggle('act',b.dataset.p===CURP));
  const cur=periodDates(CURP),cmp=prevEqual(cur);
  window.__guruPeriod={curFrom:cur.from,curTo:cur.to,cmpFrom:cmp.from,cmpTo:cmp.to};
  render(cur,cmp);
}
document.querySelectorAll('.pb[data-p]').forEach(b=>b.addEventListener('click',()=>{CURP=b.dataset.p;try{localStorage.setItem('gg_katya_period',JSON.stringify({p:CURP}));}catch(e){}applyPeriod();}));
document.getElementById('btn-range').addEventListener('click',()=>{const rp=document.getElementById('range-panel');rp.style.display=rp.style.display==='none'?'block':'none';});
document.getElementById('range-apply').addEventListener('click',()=>{CURP='range';try{localStorage.setItem('gg_katya_period',JSON.stringify({p:'range',from:document.getElementById('range-from').value,to:document.getElementById('range-to').value}));}catch(e){}document.getElementById('range-panel').style.display='none';applyPeriod();});
(function(){try{const s=JSON.parse(localStorage.getItem('gg_katya_period')||'null');if(s&&s.p==='range'&&s.from){document.getElementById('range-from').value=s.from;document.getElementById('range-to').value=s.to;}}catch(e){}})();
${pageJs}
applyPeriod();
</script>
${GURU_JS}
${HELP_JS}
${CHANNEL_JS}
</body></html>`;
}

// --- дневные тоталы канала для Воронки (реальные дни) ---
const DAY_T: Record<string, number[]> = { rev: zD(), units: zD(), views: zD(), cart: zD(), deliv: zD(), ret: zD(), canc: zD() };
const lineDayOrd: Record<string, { units: number[]; ret: number[]; rev: number[] }> = {};
for (const f of facts) {
  const i = dayIdx(f.date); if (i < 0 || i >= TOTAL) continue;
  const fx: any = f;
  const bump = (arr: number[], v: number) => { arr[i] = (arr[i] ?? 0) + v; };
  bump(DAY_T.rev!, f.revenue); bump(DAY_T.units!, f.units); bump(DAY_T.views!, fx.views || 0); bump(DAY_T.cart!, fx.to_cart || 0);
  bump(DAY_T.deliv!, fx.delivered || 0); bump(DAY_T.ret!, fx.returns || 0); bump(DAY_T.canc!, fx.cancellations || 0);
  const cat = catOf(String(f.sku));
  const L = (lineDayOrd[cat] ||= { units: zD(), ret: zD(), rev: zD() });
  bump(L.units, f.units); bump(L.ret, fx.returns || 0); bump(L.rev, f.revenue);
}

// --- страница 1: обзор (v55) ---
{
  let html = readFileSync("katya/template.html", "utf-8");
  const repl: [string, string][] = [
    ["MONTHS", J(MONTHS)], ["DAYS_IN_MONTH_2025", J(daysIn)], ["CHANNELS", J(CHANNELS)],
    ["CAT_TREE", J(CAT_TREE)], ["SUBCAT_MARGIN", J(SUBCAT_MARGIN)], ["PRODUCTS", J(PRODUCTS.map(({ mc, cost, costNA, ...p }) => p))],
    ["MX_DATA", J(MX_DATA)], ["CAT_MONTHLY", J(CAT_MONTHLY)], ["CLIENTS", "[]"],
    ["PERIOD_DELTAS", J(PERIOD_DELTAS)], ["PLAN_2025", "0"], ["AVG_PRICE", String(avgCheckThousand)],
  ];
  for (const [n, lit] of repl) html = replaceConst(html, n, lit);
  html = patchMarginHonesty(html);
  html = patchXyzMatrix(html);
  html = patchRealDaily(html, {});
  html = html.replace(/<body[^>]*>/, (m) => m + "\n" + banner("obzor") + REAL_DAILY_JS(false) + `<script>window.__GG_MAXD='${maxD}'</script>`);
  html = html.replace("</body>", PERSIST_JS + "\n" + GURU_JS + "\n" + HELP_JS + "\n" + CHANNEL_JS + "\n</body>");
  writeFileSync("public/katya.html", html);
}

// --- страница 2: товары и заказы (v63) ---
{
  let html = readFileSync("katya/template-tovary.html", "utf-8");
  const repl: [string, string][] = [
    ["MONTHS", J(MONTHS)], ["DAYS_IN_MONTH_2025", J(daysIn)], ["CHANNELS", J(CHANNELS)],
    ["CAT_TREE", J(CAT_TREE)], ["SUBCAT_MARGIN", J(SUBCAT_MARGIN)], ["PRODUCTS", J(PRODUCTS)],
    ["MX_DATA", J(MX_DATA)], ["SUBCAT_MONTHLY", J(SUBCAT_MONTHLY)],
    ["PERIOD_DELTAS", J(PERIOD_DELTAS)], ["PLAN_2025", "0"], ["AVG_PRICE", String(avgCheckThousand)],
  ];
  for (const [n, lit] of repl) html = replaceConst(html, n, lit);
  html = patchMarginHonesty(html);
  html = patchRealDaily(html, { products: true });
  html = html.replace(/<body[^>]*>/, (m) => m + "\n" + banner("tovary") + REAL_DAILY_JS(true) + `<script>window.__GG_MAXD='${maxD}'</script>`);
  html = html.replace("</body>", PERSIST_JS + "\n" + GURU_JS + "\n" + HELP_JS + "\n" + CHANNEL_JS + "\n</body>");
  writeFileSync("public/katya-tovary.html", html);
}

// --- страница 3: Воронка (реальные дни, динамика по периоду) ---
{
  const FACTS_D = { rev: r4(DAY_T.rev!.map((x) => x / 1e6)), units: DAY_T.units, views: DAY_T.views, cart: DAY_T.cart, deliv: DAY_T.deliv, ret: DAY_T.ret, canc: DAY_T.canc };
  const LINES_D = Object.fromEntries(Object.entries(lineDayOrd).map(([k, v]) => [k, { units: v.units, ret: v.ret, rev: r4(v.rev.map((x) => x / 1e6)) }]));
  const body = `
  <section class="kt-kpi" id="kpis"></section>
  <section class="card"><div class="card-h"><div><div class="card-title">Воронка продаж</div><div class="card-sub" id="fsub"></div></div></div><div id="funnel"></div></section>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px" class="kt-two">
    <section class="card"><div class="card-h"><div><div class="card-title">Потери</div><div class="card-sub">возвраты, отмены, брошенные корзины за период</div></div></div><div id="leaks"></div></section>
    <section class="card"><div class="card-h"><div><div class="card-title">Возвраты по категориям</div><div class="card-sub">за период, к заказам категории</div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Категория</th><th class="r">Заказы</th><th class="r">Возвраты</th><th class="r">% возврата</th></tr></thead><tbody id="retl"></tbody></table></div></section>
  </div>
  <style>@media (max-width:900px){.kt-two{grid-template-columns:1fr!important}}</style>`;
  const pageJs = `
const D=${J(FACTS_D)};const LD=${J(LINES_D)};const BASE0=Date.UTC(${BASE_Y},${BASE_M - 1},1);
const idxOf=d=>Math.round((Date.parse(d+'T00:00Z')-BASE0)/86400000);
function sumW(arr,w){let s=0;for(let i=idxOf(w.from);i<=idxOf(w.to);i++)s+=(arr[i]||0);return s;}
function render(cur,cmp){
  const S=k=>sumW(D[k],cur),P=k=>sumW(D[k],cmp);
  const rev=S('rev')*1e6,prev=P('rev')*1e6;
  const kpi=(lab,val,d)=>'<div class="card"><div class="kt-k">'+lab+'</div><div class="kt-v">'+val+'</div>'+d+'</div>';
  const cr=(a,b)=>b?((a/b*100).toFixed(2)+'%'):'0%';
  document.getElementById('kpis').innerHTML=[
    kpi('Оборот, ₽',fMln(rev),dlt(rev,prev)),
    kpi('Заказы, шт',fmtRu(S('units')),dlt(S('units'),P('units'))),
    kpi('Показы',fMln(S('views')),dlt(S('views'),P('views'))),
    kpi('Конверсия показ→заказ',cr(S('units'),S('views')),dlt(S('units')/(S('views')||1),P('units')/(P('views')||1))),
    kpi('Возвраты',fmtRu(S('ret')),dlt(S('ret'),P('ret'),false)),
    kpi('Отмены',fmtRu(S('canc')),dlt(S('canc'),P('canc'),false))
  ].join('');
  document.getElementById('fsub').textContent='период '+cur.from+'..'+cur.to+' · сравнение с '+cmp.from+'..'+cmp.to;
  const stages=[['Показы',S('views')],['В корзину',S('cart')],['Заказы',S('units')],['Доставлено',S('deliv')]];
  const mx=Math.max(1,stages[0][1]);
  document.getElementById('funnel').innerHTML=stages.map((s,i)=>{
    const conv=i>0&&stages[i-1][1]>0?' · CR '+ (s[1]/stages[i-1][1]*100).toFixed(1)+'%':'';
    return '<div style="display:flex;align-items:center;gap:10px"><div style="width:90px;font-size:12px;color:var(--ink-3)">'+s[0]+'</div><div class="kt-fbar" style="width:'+Math.max(4,s[1]/mx*100)+'%" title="'+s[0]+': '+fmtRu(s[1])+conv+'">'+fmtRu(s[1])+conv+'</div></div>';}).join('');
  const cartDrop=S('cart')>0?(100-S('units')/S('cart')*100).toFixed(1):'0';
  document.getElementById('leaks').innerHTML='<div class="kt-kpi">'+
    kpi('Возврат, % заказов',(S('units')?(S('ret')/S('units')*100).toFixed(1):0)+'%','')+
    kpi('Отмена, % заказов',(S('units')?(S('canc')/S('units')*100).toFixed(1):0)+'%','')+
    kpi('Брошено в корзине',cartDrop+'%','')+'</div>';
  const rows=Object.entries(LD).map(([k,v])=>({k,u:sumW(v.units,cur),r:sumW(v.ret,cur)})).filter(x=>x.u>0||x.r>0).sort((a,b)=>b.u-a.u);
  document.getElementById('retl').innerHTML=rows.map(x=>'<tr><td>'+x.k+'</td><td class="r">'+fmtRu(x.u)+'</td><td class="r">'+fmtRu(x.r)+'</td><td class="r" style="color:'+(x.u&&x.r/x.u>0.05?'var(--dn)':'inherit')+'">'+(x.u?(x.r/x.u*100).toFixed(1):'0')+'%</td></tr>').join('')||'<tr><td colspan="4" class="kt-note">нет данных за период</td></tr>';
}`;
  writeFileSync("public/katya-voronka.html", kshell("Воронка", "voronka", body, pageJs));
}

// --- страница 4: Маркетинг (период МГНОВЕННО из запечённых снимков 7/30/90 + живое обновление) ---
{
  const adsSnap = JSON.parse(readFileSync("data/ads_30d.json", "utf-8"));
  let adsPeriods: any;
  try { adsPeriods = JSON.parse(readFileSync("data/ads_periods.json", "utf-8")); }
  catch { adsPeriods = { p7: adsSnap, p30: adsSnap, p90: adsSnap }; }
  const live = JSON.parse(readFileSync("data/skus_live_30d.json", "utf-8"));
  let cheaper = 0, even = 0, pricier = 0, noIdx = 0;
  const worst: any[] = [];
  for (const s of live.sku_table) {
    if (s.pidx == null || s.pidx === 0) noIdx++;
    else { if (s.pidx < 1) cheaper++; else if (s.pidx > 1) { pricier++; worst.push(s); } else even++; }
  }
  worst.sort((a, b) => b.pidx - a.pidx);
  const PRICE = { cheaper, even, pricier, noIdx, worst: worst.slice(0, 10).map((s) => ({ name: s.name, offer: s.offer, pidx: s.pidx, rev: s.rev })) };
  const body = `
  <section class="kt-kpi" id="kpis"></section>
  <section class="card"><div class="card-h"><div><div class="card-title">Кампании: топ расхода</div><div class="card-sub" id="src1"></div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Кампания</th><th>Линия</th><th class="r">Расход</th><th class="r">Заказы</th><th class="r">ДРР</th><th class="r">ROAS</th></tr></thead><tbody id="top"></tbody></table></div></section>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px" class="kt-two">
    <section class="card"><div class="card-h"><div><div class="card-title">Сливы бюджета</div><div class="card-sub">расход от 3000 ₽ при нуле заказов или ДРР от 40%</div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Кампания</th><th class="r">Расход</th><th class="r">Заказы</th><th class="r">ДРР</th></tr></thead><tbody id="burn"></tbody></table></div></section>
    <section class="card"><div class="card-h"><div><div class="card-title">Реклама по линиям</div><div class="card-sub">расход и ДРР за период</div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Линия</th><th class="r">Расход</th><th class="r">ДРР</th></tr></thead><tbody id="lines"></tbody></table></div></section>
  </div>
  <section class="card"><div class="card-h"><div><div class="card-title">Индекс цены против рынка</div><div class="card-sub">live-снимок остатков/цен OZON от ${maxD} (индекс не историчен - всегда текущий)</div></div></div><div id="price"></div></section>
  <style>@media (max-width:900px){.kt-two{grid-template-columns:1fr!important}}</style>`;
  const pageJs = `
const SNAP=${J(adsSnap)};const PRICE=${J(PRICE)};const PERIODS=${J(adsPeriods)};
const ADS_URL='https://gen-group.app.n8n.cloud/webhook/gengroup-ozon-ads';
let lastReq=0;
// Запечённый снимок рекламы под выбранный период - показываем МГНОВЕННО реальные данные.
function bakedFor(){
  if(CURP==='7d'||CURP==='today')return PERIODS.p7||SNAP;
  if(CURP==='90d'||CURP==='all')return PERIODS.p90||SNAP;
  return PERIODS.p30||SNAP;
}
function paint(a,src){
  const t=a.totals||{};
  const kpi=(lab,val)=>'<div class="card"><div class="kt-k">'+lab+'</div><div class="kt-v">'+val+'</div></div>';
  document.getElementById('kpis').innerHTML=[
    kpi('ДРР канала',(t.drr??0)+'%'),kpi('Расход, ₽',fMln(t.spend||0)),kpi('Выручка с рекламы, ₽',fMln(t.adRevenue||0)),
    kpi('Заказы с рекламы',fmtRu(t.orders||0)),kpi('CPO, ₽',fmtRu(t.cpo||0)),kpi('Активных кампаний',(t.active||0)+' / '+(t.campaigns||0))
  ].join('');
  const badge=src==='live'?'<span class="kt-src live">живой запрос за '+a.dateFrom+'..'+a.dateTo+'</span>':src==='baked'?'<span class="kt-src">снимок за период '+a.dateFrom+'..'+a.dateTo+' · обновляю...</span>':'<span class="kt-src">снимок за период '+(a.dateFrom||'')+'..'+(a.dateTo||'')+'</span>';
  document.getElementById('src1').innerHTML='источник: OZON Performance API через n8n '+badge;
  document.getElementById('top').innerHTML=(a.top_spend||[]).map(c=>'<tr><td>'+c.off+'</td><td style="color:var(--ink-3)">'+c.line+'</td><td class="r">'+fmtRu(c.sp)+'</td><td class="r">'+c.o+'</td><td class="r" style="color:'+(c.drr>40?'var(--dn)':c.drr>0&&c.drr<20?'var(--up)':'inherit')+'">'+c.drr+'%</td><td class="r">'+(c.roas??'-')+'x</td></tr>').join('');
  document.getElementById('burn').innerHTML=(a.burners||[]).map(b=>'<tr><td>'+b.off+'</td><td class="r">'+fmtRu(b.sp)+'</td><td class="r">'+b.o+'</td><td class="r" style="color:var(--dn)">'+(b.drr?b.drr+'%':'0 заказов')+'</td></tr>').join('')||'<tr><td colspan="4" class="kt-note">сливов нет</td></tr>';
  document.getElementById('lines').innerHTML=(a.by_line||[]).map(l=>'<tr><td>'+l.line+'</td><td class="r">'+fmtRu(l.sp)+'</td><td class="r" style="color:'+(l.drr>30?'var(--dn)':'inherit')+'">'+l.drr+'%</td></tr>').join('');
  const tot=PRICE.cheaper+PRICE.even+PRICE.pricier+PRICE.noIdx||1;
  const seg=(n,c,t2)=>'<span title="'+t2+': '+n+'" style="width:'+(100*n/tot)+'%;background:'+c+';display:block;height:100%"></span>';
  document.getElementById('price').innerHTML='<div style="display:flex;height:26px;border-radius:8px;overflow:hidden;border:1px solid var(--bg-soft)">'+seg(PRICE.cheaper,'#34D399','дешевле рынка')+seg(PRICE.even,'#6AA8FF','вровень')+seg(PRICE.pricier,'#FF5A5F','дороже рынка')+seg(PRICE.noIdx,'#3a3a40','без индекса')+'</div>'+
   '<div class="kt-note"><span style="color:#34D399">дешевле рынка: '+PRICE.cheaper+'</span> · вровень: '+PRICE.even+' · <span style="color:#FF5A5F">дороже: '+PRICE.pricier+'</span> · без индекса: '+PRICE.noIdx+'</div>'+
   '<div class="kt-scroll" style="margin-top:8px"><table class="kt-table"><thead><tr><th>Дороже рынка (риск)</th><th class="r">Индекс</th><th class="r">Оборот 30д</th></tr></thead><tbody>'+PRICE.worst.map(w=>'<tr><td>'+w.name+' <span style="color:var(--ink-3)">'+(w.offer||'')+'</span></td><td class="r" style="color:var(--dn)">'+w.pidx+'</td><td class="r">'+fMln(w.rev)+'</td></tr>').join('')+'</tbody></table></div>';
}
function render(cur,cmp){
  // 1) мгновенно - запечённый снимок ИМЕННО за выбранный период (реальные числа)
  const baked=bakedFor();paint(baked,'baked');
  if(typeof fetch==='undefined')return;
  // 2) живое уточнение за точные даты периода (для своего диапазона - единственный источник)
  const my=++lastReq;
  var ctrl=('AbortController' in window)?new AbortController():null;
  var tid=setTimeout(function(){if(ctrl)ctrl.abort();},75000);
  fetch(ADS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dateFrom:cur.from,dateTo:cur.to}),signal:ctrl?ctrl.signal:undefined})
    .then(r=>{clearTimeout(tid);if(!r.ok)throw 0;return r.json();})
    .then(a=>{if(my!==lastReq)return;if(a&&a.totals&&(a.totals.spend>0||a.totals.campaigns>0))paint(a,'live');else paint(baked,'baked2');})
    .catch(()=>{clearTimeout(tid);if(my!==lastReq)return;paint(baked,'baked2');});
}`;
  writeFileSync("public/katya-marketing.html", kshell("Маркетинг и реклама", "marketing", body, pageJs));
}

// --- страница 5: Деньги (ЖИВЫЕ P&L-вебхуки по периоду, fallback - снимок) ---
{
  const pnlSnap = JSON.parse(readFileSync("data/pnl_30d.json", "utf-8"));
  const closed = JSON.parse(readFileSync("data/closed_pnl.json", "utf-8"));
  const skuNames: Record<string, string> = {};
  for (const sk of allSkus) skuNames[sk] = (skuName[sk] || sk).slice(0, 70);
  const body = `
  <section class="kt-kpi" id="kpis"></section>
  <section class="card"><div class="card-h"><div><div class="card-title">Водопад P&L канала</div><div class="card-sub" id="src1"></div></div></div><div class="kt-wf" id="wf"></div><div class="kt-note">начислено → комиссия → услуги OZON → к выплате. Канальный P&L по транзакциям; чистая прибыль - только по закрытым месяцам ниже.</div></section>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px" class="kt-two">
    <section class="card"><div class="card-h"><div><div class="card-title">Сборы по статьям</div><div class="card-sub">за период</div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Статья</th><th class="r">Сумма, ₽</th></tr></thead><tbody id="fees"></tbody></table></div></section>
    <section class="card"><div class="card-h"><div><div class="card-title">Закрытые месяцы (Акты OZON)</div><div class="card-sub">чистая прибыль - бухгалтерски разнесено [ДАННЫЕ]</div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Месяц</th><th class="r">Реализация</th><th class="r">Чистая прибыль</th></tr></thead><tbody id="closed"></tbody></table></div></section>
  </div>
  <section class="card"><div class="card-h"><div><div class="card-title">Топ SKU: к выплате после сборов</div><div class="card-sub" id="src2"></div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>SKU</th><th class="r">Начислено</th><th class="r">Комиссия</th><th class="r">К выплате</th><th class="r">Доля выплаты</th></tr></thead><tbody id="tsku"></tbody></table></div></section>
  <style>@media (max-width:900px){.kt-two{grid-template-columns:1fr!important}}</style>`;
  const pageJs = `
const SNAP=${J(pnlSnap)};const CLOSED=${J(closed)};const NAMES=${J(skuNames)};
const PNL_URL='https://gen-group.app.n8n.cloud/webhook/gengroup-ozon-pnl';
const PSK_URL='https://gen-group.app.n8n.cloud/webhook/gengroup-ozon-pnl-sku';
function catSvc(name){const n=name.toLowerCase();
  if(n.includes('brand'))return 'Бренд-комиссия';if(n.includes('acquir'))return 'Эквайринг';if(n.includes('installment'))return 'Рассрочка';if(n.includes('storage'))return 'Хранение';
  if(n.includes('membership')||n.includes('premium')||n.includes('subscription')||n.includes('stars'))return 'Подписки (Stars/Premium/отзывы)';
  if(n.includes('logistic')||n.includes('dropoff')||n.includes('lastmile')||n.includes('deliverytohandover')||n.includes('returnspvz')||n.includes('courier'))return 'Логистика (прямая+возвратная)';
  return 'Прочее';}
function normalize(raw){if(raw.breakdown)return raw;const b={'Комиссия за продажу':Math.round(raw.commission||0)};for(const k in (raw.services||{})){const c=catSvc(k);b[c]=Math.round((b[c]||0)+raw.services[k]);}return {...raw,breakdown:b};}
let lastReq=0;
function paint(p,src){
  p=normalize(p);
  const kpi=(lab,val)=>'<div class="card"><div class="kt-k">'+lab+'</div><div class="kt-v">'+val+'</div></div>';
  const commPct=p.accruals?Math.round(-(p.breakdown['Комиссия за продажу']||0)/p.accruals*1000)/10:0;
  document.getElementById('kpis').innerHTML=[
    kpi('Начислено, ₽',fMln(p.accruals||0)),kpi('Комиссия за продажу',commPct+'%'),kpi('К выплате, ₽',fMln(p.payout||0)),
    kpi('Доля выплаты',(p.accruals?Math.round(p.payout/p.accruals*1000)/10:0)+'%'),kpi('Операций',fmtRu(p.ops||0))
  ].join('');
  const badge=src==='live'?'<span class="kt-src live">живой запрос за '+p.dateFrom+'..'+p.dateTo+'</span>':'<span class="kt-src">снимок '+p.dateFrom+'..'+p.dateTo+'</span>';
  document.getElementById('src1').innerHTML='OZON /v3/finance/transaction/list через n8n '+badge;
  const fees=Object.entries(p.breakdown).sort((a,b)=>a[1]-b[1]);
  const sumFees=fees.reduce((s,f)=>s+f[1],0);
  const steps=[['Начислено',p.accruals,'#22D3EE']].concat(fees.map(f=>[f[0],f[1],'#FF5A5F'])).concat([['К выплате',p.payout,'#34D399']]);
  const mx=Math.max(1,p.accruals||1);
  document.getElementById('wf').innerHTML=steps.map(s=>{const h=Math.max(4,Math.abs(s[1])/mx*150);return '<div title="'+s[0]+': '+fmtRu(s[1])+' ₽"><div class="bar" style="height:'+h+'px;background:'+s[2]+'"></div>'+s[0].split(' ')[0]+'<br><b style="color:var(--ink-1)">'+fMln(s[1])+'</b></div>';}).join('');
  document.getElementById('fees').innerHTML=fees.map(f=>'<tr><td>'+f[0]+'</td><td class="r" style="color:var(--dn)">'+fmtRu(f[1])+'</td></tr>').join('')+'<tr><td><b>Итого сборы</b></td><td class="r"><b>'+fmtRu(sumFees)+'</b></td></tr>';
}
function paintSku(t,src){
  const rows=Object.entries(t.bySku||{}).map(([sku,v])=>({sku,...v})).filter(x=>x.accruals>0).sort((a,b)=>b.amount-a.amount).slice(0,15);
  document.getElementById('src2').innerHTML='операции с одним товаром · '+(src==='live'?'<span class="kt-src live">живой запрос '+t.dateFrom+'..'+t.dateTo+'</span>':'<span class="kt-src">снимок</span>');
  document.getElementById('tsku').innerHTML=rows.map(x=>'<tr><td>'+(NAMES[x.sku]||x.sku)+'</td><td class="r">'+fmtRu(x.accruals)+'</td><td class="r" style="color:var(--dn)">'+fmtRu(x.commission)+'</td><td class="r" style="color:var(--up)">'+fmtRu(x.amount)+'</td><td class="r">'+(x.accruals?Math.round(x.amount/x.accruals*100):0)+'%</td></tr>').join('');
}
document.getElementById('closed').innerHTML=(CLOSED.months||CLOSED||[]).map(m=>'<tr><td>'+(m.label||m.month||'')+'</td><td class="r">'+fMln(m.realization??0)+'</td><td class="r" style="color:'+((m.profit??0)>=0?'var(--up)':'var(--dn)')+'">'+fMln(m.profit??0)+'</td></tr>').join('')||'<tr><td colspan="3" class="kt-note">нет закрытых месяцев</td></tr>';
function render(cur,cmp){
  paint(SNAP,'snap');
  if(typeof fetch==='undefined'){paintSku({bySku:{},dateFrom:'',dateTo:''},'snap');return;}
  const my=++lastReq;
  fetch(PNL_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dateFrom:cur.from,dateTo:cur.to})})
    .then(r=>{if(!r.ok)throw 0;return r.json();}).then(p=>{if(my===lastReq&&p&&p.accruals!=null)paint(p,'live');}).catch(()=>{});
  fetch(PSK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dateFrom:cur.from,dateTo:cur.to})})
    .then(r=>{if(!r.ok)throw 0;return r.json();}).then(t=>{if(my===lastReq&&t&&t.bySku)paintSku(t,'live');}).catch(()=>{paintSku({bySku:${J(Object.fromEntries(Object.entries(JSON.parse(readFileSync("data/pnl_sku_30d.json", "utf-8")).bySku).filter(([, v]: any) => v.accruals > 0).sort((a: any, b: any) => b[1].amount - a[1].amount).slice(0, 15)))},dateFrom:'',dateTo:''},'snap');});
}`;
  writeFileSync("public/katya-money.html", kshell("Деньги", "money", body, pageJs));
}

// --- страница 0: КОМАНДНЫЙ ЦЕНТР (war-room, флагман Pro) ---
{
  const ads = JSON.parse(readFileSync("data/ads_30d.json", "utf-8"));
  // per-SKU разрежённый дневной ряд за окно (для движений по периоду)
  const skuMeta: Record<string, { nm: string; line: string }> = {};
  const tmpR: Record<string, Record<number, number>> = {}, tmpU: Record<string, Record<number, number>> = {};
  for (const f of facts) {
    const i = dayIdx(f.date); if (i < 0 || i >= TOTAL) continue;
    const sk = String(f.sku);
    skuMeta[sk] ||= { nm: (skuName[sk] || sk).replace(/^GENGLASS\s*/, ""), line: catOf(sk) };
    (tmpR[sk] ||= {})[i] = ((tmpR[sk] ||= {})[i] || 0) + f.revenue;
    (tmpU[sk] ||= {})[i] = ((tmpU[sk] ||= {})[i] || 0) + f.units;
  }
  const SKUS = Object.keys(skuMeta).map((sk) => {
    const d: number[][] = [];
    for (const k in tmpR[sk]) d.push([+k, Math.round(tmpR[sk]![+k]!), tmpU[sk]![+k] || 0]);
    return { sku: sk, nm: skuMeta[sk]!.nm, line: skuMeta[sk]!.line, d };
  });
  const LIVE = (live.sku_table || []).map((s: any) => ({ sku: String(s.sku), nm: String(s.name || "").replace(/^GENGLASS\s*/, ""), line: s.line, rev: s.rev, units: s.units, stock: s.stock, oos: s.oos, pidx: s.pidx, pcol: s.pcol, conv: s.convCart, ret: s.retp }));
  const body = `
  <section class="card" id="alerts-card"><div class="card-h"><div><div class="card-title">Что горит прямо сейчас</div><div class="card-sub">алёрты по живому снимку OZON (остатки, индекс цены, реклама за 30 дн). Клик по алёрту - разбор у Гуру</div></div></div><div id="alerts"></div></section>
  <section class="kt-kpi" id="kpis"></section>
  <div style="display:grid;grid-template-columns:1.15fr 1fr;gap:14px" class="kt-two">
    <section class="card"><div class="card-h"><div><div class="card-title">Декомпозиция оборота</div><div class="card-sub" id="bsub"></div></div></div><div id="bridge"></div><div class="kt-note">Оборот = трафик × конверсия в заказ × средний чек. Видно, какой из трёх рычагов дал прирост или просадку - туда и бить.</div></section>
    <section class="card"><div class="card-h"><div><div class="card-title">Движения за период</div><div class="card-sub">кто прибавил и кто просел по обороту против базы сравнения</div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Товар</th><th class="r">Оборот</th><th class="r">Δ к базе</th></tr></thead><tbody id="movers"></tbody></table></div></section>
  </div>
  <section class="card"><div class="card-h"><div><div class="card-title">Локомотивы и риск</div><div class="card-sub">A-товары (дают 80% оборота периода). Красный флаг - есть риск: OOS или дороже рынка</div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Товар</th><th>Линия</th><th class="r">Оборот</th><th class="r">Доля</th><th class="r">Остаток</th><th class="r">Индекс цены</th><th>Риск</th></tr></thead><tbody id="loco"></tbody></table></div></section>
  <style>@media (max-width:900px){.kt-two{grid-template-columns:1fr!important}}</style>`;
  const pageJs = `
const D=${J({ rev: DAY_T.rev, units: DAY_T.units, views: DAY_T.views, cart: DAY_T.cart, deliv: DAY_T.deliv, ret: DAY_T.ret })};
const SKUS=${J(SKUS)};const LIVE=${J(LIVE)};const ADS=${J(ads)};
const BASE0=Date.UTC(${BASE_Y},${BASE_M - 1},1);
const idxOf=dt=>Math.round((Date.parse(dt+'T00:00Z')-BASE0)/86400000);
const sW=(arr,w)=>{let s=0;for(let i=idxOf(w.from);i<=idxOf(w.to);i++)s+=(arr[i]||0);return s;};
const skuW=(sk,w)=>{let r=0,u=0;const a=idxOf(w.from),b=idxOf(w.to);sk.d.forEach(p=>{if(p[0]>=a&&p[0]<=b){r+=p[1];u+=p[2];}});return {r,u};};
function tip(t){return ' title="'+t.replace(/"/g,'&quot;')+'"';}
function render(cur,cmp){
  const v=k=>sW(D[k],cur),p=k=>sW(D[k],cmp);
  const gmv=v('rev'),gmvP=p('rev'),u=v('units'),uP=p('units'),vw=v('views'),vwP=p('views');
  const cro=vw?u/vw:0,croP=vwP?uP/vwP:0,aov=u?gmv/u:0,aovP=uP?gmvP/uP:0;
  // KPI
  const kpi=(lab,val,dd,tp)=>'<div class="card"'+tip(tp)+'><div class="kt-k">'+lab+'</div><div class="kt-v">'+val+'</div>'+dd+'</div>';
  document.getElementById('kpis').innerHTML=[
    kpi('Оборот, ₽',fMln(gmv),dlt(gmv,gmvP),'GMV за период. Дельта к равному предыдущему окну.'),
    kpi('Заказы, шт',fmtRu(u),dlt(u,uP),'Сколько штук заказали за период.'),
    kpi('Конверсия показ→заказ',(cro*100).toFixed(2)+'%',dlt(cro,croP),'Из скольких показов рождается заказ. Падает - проблема с карточкой/ценой/трафиком.'),
    kpi('Средний чек, ₽',fmtRu(aov),dlt(aov,aovP),'Оборот делить на заказы. Растёт - продаём дороже/комплектами.'),
    kpi('ДРР канала',(ADS.totals.drr||0)+'%','<span class="kt-d na">снимок 30 дн</span>','Доля рекламы в выручке за 30 дн. Сравнивай с маржой: ДРР выше маржи - реклама в минус.'),
    kpi('Возвраты, шт',fmtRu(v('ret')),dlt(v('ret'),p('ret'),false),'Возвраты съедают маржу. Рост - смотри качество и описание.')
  ].join('');
  document.getElementById('bsub').textContent='период '+cur.from+'..'+cur.to+' · база '+cmp.from+'..'+cmp.to;
  // Мост: вклад трафика / конверсии / чека в ΔGMV (последовательная декомпозиция)
  const dV=(vw-vwP)*croP*aovP, dC=vw*(cro-croP)*aovP, dA=vw*cro*(aov-aovP);
  const bars=[['Было',gmvP,'#5d7484'],['Трафик',dV,dV>=0?'#34D399':'#FF5A5F'],['Конверсия',dC,dC>=0?'#34D399':'#FF5A5F'],['Чек',dA,dA>=0?'#34D399':'#FF5A5F'],['Стало',gmv,'#22D3EE']];
  const mx=Math.max(gmvP,gmv,1);
  document.getElementById('bridge').innerHTML='<div style="display:flex;align-items:flex-end;gap:8px;height:170px;padding:10px 0">'+bars.map(b=>{const h=Math.max(4,Math.abs(b[1])/mx*130);const sign=(b[0]==='Было'||b[0]==='Стало')?'':(b[1]>=0?'+':'');return '<div style="flex:1;text-align:center;font-size:11px;color:var(--ink-3)"'+tip(b[0]+': '+sign+fMln(b[1])+' ₽')+'><div style="background:'+b[2]+';border-radius:6px 6px 0 0;height:'+h+'px;margin-bottom:4px"></div>'+b[0]+'<br><b style="color:var(--ink-1)">'+sign+fMln(b[1])+'</b></div>';}).join('')+'</div>';
  // Движения
  const mv=SKUS.map(s=>{const c=skuW(s,cur),b=skuW(s,cmp);return {nm:s.nm,line:s.line,r:c.r,d:c.r-b.r};}).filter(x=>x.r>0||x.d!==0);
  const up=mv.slice().sort((a,b)=>b.d-a.d).slice(0,5),dn=mv.slice().sort((a,b)=>a.d-b.d).slice(0,5);
  const row=x=>'<tr><td>'+esc(x.nm.slice(0,46))+'<span style="color:var(--ink-3)"> · '+x.line+'</span></td><td class="r">'+fMln(x.r)+'</td><td class="r" style="color:'+(x.d>=0?'var(--up)':'var(--dn)')+'">'+(x.d>=0?'+':'')+fMln(x.d)+'</td></tr>';
  document.getElementById('movers').innerHTML=up.map(row).join('')+'<tr><td colspan="3" style="height:6px;border:0"></td></tr>'+dn.filter(x=>x.d<0).map(row).join('');
  // Локомотивы (ABC периода) + риск из live
  const liveBy={};LIVE.forEach(l=>liveBy[l.sku]=l);
  const per=SKUS.map(s=>({...s,r:skuW(s,cur).r})).filter(x=>x.r>0).sort((a,b)=>b.r-a.r);
  const tot=per.reduce((s,x)=>s+x.r,0)||1;let cum=0;const A=[];
  for(const x of per){cum+=x.r;A.push(x);if(cum/tot>=0.8)break;}
  document.getElementById('loco').innerHTML=A.slice(0,14).map(x=>{const l=liveBy[x.sku]||{};const oos=l.oos>0||l.stock===0;const pricey=l.pidx>1;const risk=[];if(oos)risk.push('<span style="color:var(--dn)">OOS</span>');if(pricey)risk.push('<span style="color:var(--warn)">дороже рынка</span>');
    return '<tr><td>'+esc(x.nm.slice(0,44))+'</td><td style="color:var(--ink-3)">'+x.line+'</td><td class="r">'+fMln(x.r)+'</td><td class="r">'+(x.r/tot*100).toFixed(1)+'%</td><td class="r"'+tip('остаток на складе, шт (снимок)')+'>'+(l.stock!=null?fmtRu(l.stock):'н/д')+'</td><td class="r"'+tip('индекс цены к рынку: <1 дешевле, >1 дороже')+' style="color:'+(pricey?'var(--dn)':l.pidx?'var(--up)':'inherit')+'">'+(l.pidx||'н/д')+'</td><td>'+(risk.join(' ')||'<span style="color:var(--up)">ок</span>')+'</td></tr>';}).join('');
  // Алёрты
  const al=[];
  const oosLoco=A.map(x=>liveBy[x.sku]).filter(l=>l&&(l.oos>0||l.stock===0));
  if(oosLoco.length)al.push({c:'dn',t:oosLoco.length+' локомотив(ов) в OOS',s:'A-товары без остатка - прямая потеря оборота. '+oosLoco.slice(0,3).map(l=>l.nm.slice(0,30)).join('; '),q:'Какие топовые товары в OOS и сколько оборота я теряю?'});
  const burn=(ADS.burners||[]).filter(b=>b.sp>=3000);
  if(burn.length)al.push({c:'dn',t:burn.length+' рекламных слива',s:'кампании жгут бюджет при нуле заказов или ДРР 40%+: '+burn.slice(0,3).map(b=>b.off).join('; '),q:'Где я сливаю рекламный бюджет и сколько можно сэкономить?'});
  const hotLines=(ADS.by_line||[]).filter(l=>l.drr>30);
  if(hotLines.length)al.push({c:'warn',t:'ДРР выше 30% по '+hotLines.length+' линии(ям)',s:hotLines.map(l=>l.line+' '+l.drr+'%').join(', ')+' - проверь, не выше ли маржи',q:'По каким линиям реклама дороже маржи?'});
  const pricey=LIVE.filter(l=>l.pidx>1.05&&l.rev>0);
  if(pricey.length)al.push({c:'warn',t:pricey.length+' товаров дороже рынка',s:'индекс цены выше 1.05 - рискуем потерять буст и продажи',q:'Какие товары дороже рынка и чем это грозит?'});
  if(!al.length)al.push({c:'ok',t:'Критичных алёртов нет',s:'OOS на локомотивах, рекламных сливов и ценовых рисков сейчас не видно',q:''});
  document.getElementById('alerts').innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px">'+al.map((a,i)=>{const col=a.c==='dn'?'#FF5A5F':a.c==='warn'?'#E0A100':'#34D399';
    return '<div class="alert-card" data-q="'+esc(a.q)+'" style="border:1px solid '+col+'55;border-left:3px solid '+col+';border-radius:10px;padding:10px 12px;background:rgba(255,255,255,.02);cursor:'+(a.q?'pointer':'default')+'"><div style="font-weight:700;color:'+col+';font-size:13px;margin-bottom:3px">'+a.t+'</div><div style="font-size:11.5px;color:var(--ink-2);line-height:1.45">'+esc(a.s)+'</div>'+(a.q?'<div style="font-size:10.5px;color:#22D3EE;margin-top:5px">разобрать у Гуру →</div>':'')+'</div>';}).join('')+'</div>';
  document.querySelectorAll('.alert-card[data-q]').forEach(c=>{const q=c.getAttribute('data-q');if(q)c.onclick=()=>{if(window.__guruAsk)window.__guruAsk(q,'Командный центр, алёрт: '+c.querySelector('div').textContent);};});
}`;
  writeFileSync("public/katya-command.html", kshell("Командный центр", "command", body, pageJs));
}

console.log(`katya: командный центр + 5 страниц · ${PRODUCTS.length} моделей, ${allSkus.length} SKU, категорий ${CAT_TREE.length}, окно ${WIN[0]}..${WIN[15]}, OZON ${ozRev} млн / ${ozOrd} заказов`);
