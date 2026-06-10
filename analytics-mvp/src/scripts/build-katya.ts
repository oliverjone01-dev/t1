// Вторая версия дашборда - "1 в 1" макет Кати (katya/template.html) на наших живых данных OZON.
// Берём её CSS/DOM/JS без изменений, балансной заменой подставляем только константы-данные.
// Реальные числа - канал OZON (наша таксономия/SKU/история). Прочие каналы, клиенты, план - нет данных.
// Запуск: tsx src/scripts/build-katya.ts  (после fetch:live). Источник: data/, не fixtures.
import { readFileSync, writeFileSync } from "node:fs";

type Fact = { date: string; sku: string; name: string; line: string; revenue: number; units: number; returns?: number };
const RUMON = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
const mln = (n: number) => Math.round((n / 1e6) * 1000) / 1000;
const slug = (s: string) => "s_" + s.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 18);

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

// --- агрегаты ---
const z16 = () => new Array(16).fill(0);
const taxOf = (sku: string) => tax[sku] || {};
const catOf = (sku: string) => taxOf(sku).category || (live.sku_table.find((s: any) => String(s.sku) === sku)?.line) || "Прочее";
const subOf = (sku: string) => taxOf(sku).sub || catOf(sku);
const modelOf = (sku: string) => taxOf(sku).model || taxOf(sku).offer || (live.sku_table.find((s: any) => String(s.sku) === sku)?.name) || sku;

// SKU -> помесячная выручка(млн) и заказы(шт)
const skuMonRev: Record<string, number[]> = {}, skuMonOrd: Record<string, number[]> = {};
const skuName: Record<string, string> = {}, skuRet: Record<string, number> = {}, skuUnits: Record<string, number> = {};
for (const f of facts) {
  const i = moIdx[f.date.slice(0, 7)]; if (i == null) continue;
  const sk = String(f.sku);
  const arR = (skuMonRev[sk] ||= z16()); arR[i] = (arR[i] ?? 0) + f.revenue;
  const arO = (skuMonOrd[sk] ||= z16()); arO[i] = (arO[i] ?? 0) + f.units;
  skuName[sk] = f.name; skuUnits[sk] = (skuUnits[sk] || 0) + f.units; skuRet[sk] = (skuRet[sk] || 0) + (f.returns || 0);
}
const allSkus = Object.keys(skuMonRev);
const totRevWin = (sk: string) => (skuMonRev[sk] ?? []).reduce((a, b) => a + b, 0);

// --- CAT_TREE: группа(category) -> подкатегории(sub) ---
const groups = new Map<string, { id: string; name: string; subs: Map<string, string[]> }>();
for (const sk of allSkus) {
  const g = catOf(sk), s = subOf(sk);
  let gr = groups.get(g); if (!gr) { gr = { id: slug("g_" + g), name: g, subs: new Map() }; groups.set(g, gr); }
  if (!gr.subs.has(s)) gr.subs.set(s, []);
  gr.subs.get(s)!.push(sk);
}
const subIdOf = (sub: string) => slug("c_" + sub);
const grIdOf = (g: string) => slug("g_" + g);

// ABC по подкатегориям и моделям
function abcMap(items: { k: string; rev: number }[]): Record<string, string> {
  const s = [...items].sort((a, b) => b.rev - a.rev); const tot = s.reduce((x, y) => x + y.rev, 0) || 1; let c = 0; const o: Record<string, string> = {};
  for (const it of s) { c += it.rev; const sh = c / tot; o[it.k] = sh <= 0.8 ? "A" : sh <= 0.95 ? "B" : "C"; } return o;
}
const subRev: Record<string, number> = {};
for (const [, gr] of groups) for (const [sub, sks] of gr.subs) subRev[subIdOf(sub)] = sks.reduce((a, sk) => a + mln(totRevWin(sk)), 0);
const subAbc = abcMap(Object.entries(subRev).map(([k, rev]) => ({ k, rev })));

const CAT_TREE = [...groups.values()].map((gr) => ({
  id: gr.id, name: gr.name, sub: [...gr.subs.keys()].slice(0, 3).join(" · "),
  children: [...gr.subs.entries()].map(([sub, sks]) => {
    const rev = mln(sks.reduce((a, sk) => a + totRevWin(sk), 0));
    const orders = sks.reduce((a, sk) => a + (skuUnits[sk] || 0), 0);
    const ret = orders ? Math.round((sks.reduce((a, sk) => a + (skuRet[sk] || 0), 0) / orders) * 1000) / 10 : 0;
    return { id: subIdOf(sub), name: sub, sub, rev, prev: rev, orders, otif: null, ret, days: null, abc: subAbc[subIdOf(sub)] || "C" };
  }),
}));

// --- SUBCAT_MARGIN ---
const SUBCAT_MARGIN: Record<string, number> = {};
for (const [, gr] of groups) for (const [sub, sks] of gr.subs) {
  let r = 0, c = 0; for (const sk of sks) { const cu = cogs[sk] || 0; if (cu > 0) { r += totRevWin(sk); c += cu * (skuUnits[sk] || 0); } }
  SUBCAT_MARGIN[subIdOf(sub)] = r > 0 ? Math.round((1 - c / r) * 1000) / 10 : 0;
}

// --- PRODUCTS (по модели) + variants(SKU) ---
const modelMap = new Map<string, string[]>();
for (const sk of allSkus) { const m = modelOf(sk); (modelMap.get(m) || modelMap.set(m, []).get(m)!).push(sk); }
const modelRev = [...modelMap.entries()].map(([m, sks]) => ({ k: m, rev: sks.reduce((a, sk) => a + totRevWin(sk), 0) }));
const modelAbc = abcMap(modelRev);
const cv = (arr: number[]) => { const nz = arr.filter((x) => x > 0); if (nz.length < 2) return 0; const mean = nz.reduce((a, b) => a + b, 0) / nz.length; const sd = Math.sqrt(nz.reduce((a, b) => a + (b - mean) ** 2, 0) / nz.length); return Math.round((sd / mean) * 100) / 100; };
const PRODUCTS = [...modelMap.entries()].map(([model, sks]) => {
  const mr = z16(), mo = z16();
  for (const sk of sks) for (let i = 0; i < 16; i++) { mr[i] += mln((skuMonRev[sk] || z16())[i]); mo[i] += (skuMonOrd[sk] || z16())[i]; }
  const sub = subOf(sks[0]!);
  const variants = sks.map((sk) => ({
    sku: taxOf(sk).offer || sk, sub: skuName[sk] || sk, rev: mln(totRevWin(sk)),
    cost: mln((cogs[sk] || 0) * (skuUnits[sk] || 0)), orders: skuUnits[sk] || 0,
    returns: skuRet[sk] || 0, leadDays: 0, stockQty: stockOf[sk] || 0,
  }));
  return { nm: model, sub, subcatId: subIdOf(sub), groupId: grIdOf(catOf(sks[0]!)), abc: modelAbc[model] || "C", cv: cv(mr), mr: mr.map((x) => Math.round(x * 1000) / 1000), mo, variants };
}).sort((a, b) => b.mr.reduce((s, x) => s + x, 0) - a.mr.reduce((s, x) => s + x, 0));

// --- MONTHS / CHANNELS / MX_DATA / CAT_MONTHLY ---
const MONTHS = WIN.map((m) => ({ m: monLabel(m), r: Math.round(facts.filter((f) => f.date.slice(0, 7) === m).reduce((a, f) => a + f.revenue, 0) / 1e6 * 100) / 100 }));
const ozRev = mln(facts.reduce((a, f) => a + f.revenue, 0));
const ozOrд = facts.reduce((a, f) => a + f.units, 0);
const CHANNELS = [
  { id: "site", name: "Сайт genglass.ru", short: "Сайт", rev: 0, prev: 0, orders: 0 },
  { id: "des", name: "Дизайнеры", short: "Дизайн.", rev: 0, prev: 0, orders: 0 },
  { id: "dil", name: "Дилеры", short: "Дилеры", rev: 0, prev: 0, orders: 0 },
  { id: "ozon", name: "Озон", short: "Озон", rev: ozRev, prev: ozRev, orders: ozOrд },
  { id: "wb", name: "Wildberries", short: "WB", rev: 0, prev: 0, orders: 0 },
  { id: "show", name: "Шоурум Домодедово", short: "Шоурум", rev: 0, prev: 0, orders: 0 },
  { id: "ym", name: "Яндекс Маркет", short: "Я.Маркет", rev: 0, prev: 0, orders: 0 },
];
const allSubIds = [...new Set(CAT_TREE.flatMap((g) => g.children.map((c) => c.id)))];
const MX_DATA: Record<string, Record<string, number>> = {};
for (const ch of CHANNELS) { const row: Record<string, number> = {}; for (const sid of allSubIds) row[sid] = ch.id === "ozon" ? (subRev[sid] || 0) : 0; MX_DATA[ch.id] = row; }
const CAT_MONTHLY: Record<string, { r: number[]; o: number[] }> = {};
for (const [, gr] of groups) for (const [sub, sks] of gr.subs) {
  const r = z16(), o = z16(); for (const sk of sks) for (let i = 0; i < 16; i++) { r[i] += mln((skuMonRev[sk] || z16())[i]); o[i] += (skuMonOrd[sk] || z16())[i]; }
  CAT_MONTHLY[subIdOf(sub)] = { r: r.map((x) => Math.round(x * 1000) / 1000), o };
}
const AVG_PRICE = ozOrд ? Math.round(ozRev / ozOrд * 1000) / 1000 : 0; // средний чек, млн ₽? шаблон в тыс - оставим как наш млн/заказ*1000
const avgCheckThousand = ozOrд ? Math.round(ozRev * 1e6 / ozOrд / 1000) : 0;

// PERIOD_DELTAS: считаем rev/ord по периодам vs предыдущее равное окно (где есть история)
const dates = [...new Set(facts.map((f) => f.date))].sort();
const maxD = dates[dates.length - 1]!;
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
  if (open !== "[" && open !== "{") { // число до ;
    const end = src.indexOf(";", i); return src.slice(0, i) + literal + src.slice(end);
  }
  const close = open === "[" ? "]" : "}";
  let depth = 0, j = i, str = "";
  for (; j < src.length; j++) {
    const ch = src[j];
    if (str) { if (ch === "\\") { j++; continue; } if (ch === str) str = ""; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { str = ch; continue; }
    if (ch === "/" && src[j + 1] === "/") { j = src.indexOf("\n", j); if (j < 0) j = src.length; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) { j++; break; } }
  }
  return src.slice(0, i) + literal + src.slice(j);
}

let html = readFileSync("katya/template.html", "utf-8");
const J = (x: unknown) => JSON.stringify(x);
const repl: [string, string][] = [
  ["MONTHS", J(MONTHS)], ["DAYS_IN_MONTH_2025", J(daysIn)], ["CHANNELS", J(CHANNELS)],
  ["CAT_TREE", J(CAT_TREE)], ["SUBCAT_MARGIN", J(SUBCAT_MARGIN)], ["PRODUCTS", J(PRODUCTS)],
  ["MX_DATA", J(MX_DATA)], ["CAT_MONTHLY", J(CAT_MONTHLY)], ["CLIENTS", "[]"],
  ["PERIOD_DELTAS", J(PERIOD_DELTAS)], ["PLAN_2025", "0"], ["AVG_PRICE", String(avgCheckThousand)],
];
for (const [n, lit] of repl) html = replaceConst(html, n, lit);

// --- баннер источника (вставляем после <body>) ---
const snap = `${MONTHS[11]?.m || ""}-${MONTHS[15]?.m || ""}`;
const banner = `<div style="background:#1a2330;border-bottom:1px solid #22d3ee;color:#cfe8ef;font:13px/1.5 system-ui;padding:8px 18px;text-align:center">Вторая версия · макет Кати на ЖИВЫХ данных OZON (через n8n). Реальные числа - канал <b>Озон</b> (${snap}). Прочие каналы, клиенты и план - нет данных в OZON API. <a style="color:#22d3ee" href="./">← основной дашборд</a></div>`;
html = html.replace(/<body[^>]*>/, (m) => m + "\n" + banner);

writeFileSync("public/katya.html", html);
console.log(`katya.html: ${PRODUCTS.length} моделей, ${allSkus.length} SKU, окно ${WIN[0]}..${WIN[15]}, OZON ${ozRev} млн / ${ozOrд} заказов`);
