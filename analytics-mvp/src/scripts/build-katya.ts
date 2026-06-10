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

// --- дельты периодов из истории ---
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

function banner(active: "obzor" | "tovary"): string {
  const snap = `${MONTHS[11]?.m || ""}-${MONTHS[15]?.m || ""}`;
  const lnk = (href: string, label: string, on: boolean) =>
    on ? `<b style="color:#22D3EE">${label}</b>` : `<a style="color:#22D3EE" href="${href}">${label}</a>`;
  return `<div style="background:#1a2330;border-bottom:1px solid #22d3ee;color:#cfe8ef;font:13px/1.5 system-ui;padding:8px 18px;text-align:center">Вид Кати на ЖИВЫХ данных OZON (через n8n) · реальные числа - канал <b>Озон</b> (${snap}), прочие каналы/клиенты/план - нет данных · ${lnk("katya.html", "Обзор", active === "obzor")} · ${lnk("katya-tovary.html", "Товары и заказы", active === "tovary")} · <a style="color:#22D3EE" href="./">← основной дашборд</a></div>`;
}

const J = (x: unknown) => JSON.stringify(x);

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
  html = html.replace(/<body[^>]*>/, (m) => m + "\n" + banner("obzor"));
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
  html = html.replace(/<body[^>]*>/, (m) => m + "\n" + banner("tovary"));
  writeFileSync("public/katya-tovary.html", html);
}

console.log(`katya: обзор + товары · ${PRODUCTS.length} моделей, ${allSkus.length} SKU, категорий ${CAT_TREE.length} (${CAT_TREE.map(g => g.name).join(", ")}), окно ${WIN[0]}..${WIN[15]}, OZON ${ozRev} млн / ${ozOrd} заказов`);
