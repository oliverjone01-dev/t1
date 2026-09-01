// Версии дашборда "вид Кати" на наших живых данных OZON:
//   katya.html        - обзор (шаблон v55: KPI, план-факт, структура, рентабельность, ABC, сезонность)
//   katya-tovary.html - товары и заказы (шаблон v63: таблица моделей с раскрытием, тепловая карта)
// Берём её CSS/DOM/JS, балансной заменой подставляем только константы-данные.
// Реальные числа - канал OZON. Прочие каналы, клиенты, план - нет данных (честно пусто).
// Запуск: tsx src/scripts/build-katya.ts (после fetch:live). Источник: data/, не fixtures.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

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
// --- автоген таксономии по названию товара (только канал OZON) ---
// 167 SKU размечены вручную (data/sku_taxonomy.json), но в продажах 345 SKU -> 178 без подкатегории.
// Достраиваем категорию/подкатегорию из названия (OZON-нейминг богат типом товара), словарь
// подкатегорий совпадает с ручной разметкой. Это «автоген только для фильтра вверху Озон»:
// прочие каналы пусты (нет данных) и не затрагиваются. Когда n8n вернёт дерево категорий
// OZON (/v2/category/tree) - заменить эвристику на официальные категории.
const _autoCache: Record<string, { category: string | null; sub: string | null }> = {};
function autoTax(name: string): { category: string | null; sub: string | null } {
  if (name in _autoCache) return _autoCache[name]!;
  const n = (name || "").toLowerCase();
  let category: string | null = null, sub: string | null = null;
  if (/зеркал/.test(n)) {
    category = "Зеркала";
    if (/безрамн|без рамы/.test(n)) sub = "Зеркала безрамные";
    else if (/в раме|в рамке/.test(n)) sub = "Зеркала в раме";
    else if (/напольн/.test(n)) sub = "Зеркала напольные";
    else if (/подсветк|led/.test(n)) sub = "Зеркала с подсветкой";
    else sub = "Зеркала настенные";
  } else if (/столешниц/.test(n)) { category = "Комплектующие"; sub = "Столешницы"; }
  else if (/подстолье|опор[аы]|ножк/.test(n)) { category = "Комплектующие"; sub = "Подстолье"; }
  else if (/перегородк|ширма/.test(n)) { category = "Перегородки"; sub = "Перегородки"; }
  else if (/вешалк/.test(n)) { category = "Хранение"; sub = "Вешалки"; }
  else if (/пуф|банкетк/.test(n)) { category = "Пуфы"; sub = "Пуфы"; } // вытащены из Хранение - отдельная категория
  else if (/консол|тумб/.test(n)) { category = "Консоли/тумбы"; sub = "Консоли"; }
  else if (/маркерн|доска/.test(n)) { category = "Маркерные доски"; sub = "Маркерные доски"; }
  else if (/журнальн|кофейн/.test(n)) { category = "Столы"; sub = "Столы журнальные"; }
  else if (/стол/.test(n)) { category = "Столы"; sub = "Столы обеденные"; }
  return (_autoCache[name] = { category, sub });
}
const catOf = (sku: string) => taxOf(sku).category || autoTax(skuName[sku] || "").category || LINE_CAT[skuLine[sku] || ""] || "Прочее";
const subOf = (sku: string) => taxOf(sku).sub || autoTax(skuName[sku] || "").sub || NO_TAX_SUB;
const modelOf = (sku: string) => taxOf(sku).model || taxOf(sku).offer || skuName[sku] || sku;

// Канон линии для per-line представлений (heatmap, топ-SKU). OZON часто отдаёт line="прочее" у
// перегородок/столешниц/подстолий, из-за чего они сваливались в «прочее» на «Товарах», хотя на
// «Обзоре» по таксономии считаются в своей категории (Перегородки и т.д.) - отсюда рассинхрон.
// Если line пуст/«прочее», но по названию определяется категория - подставляем категорию как линию.
for (const sk of allSkus) {
  const ln = skuLine[sk];
  if (ln && ln !== "прочее") continue;
  const c = autoTax(skuName[sk] || "").category;
  if (c) skuLine[sk] = c;
}

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

// --- комиссия за продажу OZON по подкатегориям из снимка pnl-sku (как на листе Деньги) ---
// Ставка % от выручки на подкатегорию; на странице Обзор взвешивается выручкой бакета за период.
let pnlBySkuComm: Record<string, { accruals?: number; commission?: number }> = {};
try { pnlBySkuComm = JSON.parse(readFileSync("data/pnl_sku_30d.json", "utf-8")).bySku || {}; } catch { pnlBySkuComm = {}; }
const SUBCAT_COMM: Record<string, number> = {};
for (const [g, gr] of groups) for (const [sub, sks] of gr) {
  let acc = 0, comm = 0;
  for (const sk of sks) { const x = pnlBySkuComm[sk]; if (x && (x.accruals || 0) > 0) { acc += x.accruals!; comm += Math.abs(x.commission || 0); } }
  if (acc > 0) SUBCAT_COMM[subIdOf(g, sub)] = Math.round((comm / acc) * 1000) / 10;
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
const PRODUCT_DAILY_REV: Record<string, number[]> = {}; // модель(nm)/артикул(label) -> млн ₽/день
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
  const a5 = (PRODUCT_DAILY_REV[skuModel[sk]!] ||= zD()); a5[i] = (a5[i] ?? 0) + f.revenue / 1e6;
  const a6 = (PRODUCT_DAILY_REV[skuLabel[sk]!] ||= zD()); a6[i] = (a6[i] ?? 0) + f.revenue / 1e6;
}
const r4 = (a: number[]) => a.map((x) => Math.round(x * 10000) / 10000);
for (const k in SUB_D_R) SUB_D_R[k] = r4(SUB_D_R[k]!);
for (const k in PRODUCT_DAILY_REV) PRODUCT_DAILY_REV[k] = r4(PRODUCT_DAILY_REV[k]!);

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
  // «Сегодня» -> «Вчера»: за сегодня OZON ещё не отдал данные, кнопка показывает последний день (вчера).
  out = out.replace(/>Сегодня</g, ">Вчера<");
  out = out.replace(/label:'Сегодня'/g, "label:'Вчера'");
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
  `<script>window.__DAILY_REV_REAL=${JSON.stringify(r4(DAILY_REV_REAL))};window.__SUB_D_R=${JSON.stringify(SUB_D_R)};window.__SUB_D_O=${JSON.stringify(SUB_D_O)};window.__SUBCAT_COMM=${JSON.stringify(SUBCAT_COMM)};window.__PRODUCT_DAILY=${JSON.stringify(PRODUCT_DAILY)};window.__PRODUCT_DAILY_REV=${JSON.stringify(PRODUCT_DAILY_REV)};window.__DAILY_RET_REAL=${JSON.stringify(DAY_T.ret)};window.__DAILY_ORD_REAL=${JSON.stringify(DAY_T.units)};</script>`;

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
  ["katya-competitors.html", "Конкуренты", "competitors"],
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
// ВРЕМЕННО ОТКЛЮЧЁН (Этап 4 миграции с n8n): бэкенд чата жил на n8n-вебхуке с исчерпанной квотой.
// Кнопка и виджет остаются на месте (решение Ивана), но запрос не идёт - показываем понятное
// «временно недоступно». Вернём отдельным сервисом (Cloudflare Worker) как отдельный проект.
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
<div class="gm" id="gg-guru-m"><div class="w">Гуру-аналитик временно отключён: идёт миграция аналитики с n8n на прямые клиенты OZON. Все числа на дашборде - из свежих ночных снимков напрямую. Интерактивный чат вернём отдельным сервисом.</div></div>
<div class="gi"><input id="gg-guru-q" placeholder="Например: что с продажами за неделю?"><button id="gg-guru-s">→</button></div></div>
<script>(function(){
var box=document.getElementById('gg-guru'), msgs=document.getElementById('gg-guru-m');
document.getElementById('gg-guru-btn').onclick=function(){box.classList.toggle('open');};
document.getElementById('gg-guru-x').onclick=function(){box.classList.remove('open');};
function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML;}
// Чат отключён на время миграции с n8n: запрос не уходит, показываем понятное уведомление.
function ask(q,page){
  if(!q)return;
  box.classList.add('open');
  msgs.insertAdjacentHTML('beforeend','<div class="q">Вы: '+esc(q)+'</div><div class="a" style="color:#E5B567">Гуру-аналитик временно отключён: идёт миграция с n8n на прямые клиенты OZON. Числа на дашборде - из свежих ночных снимков напрямую. Интерактивный чат вернём отдельным сервисом.</div>');
  msgs.scrollTop=msgs.scrollHeight;
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

// Снимок рекламы с полями id/status/skus: data/ обновляет только fetch:live на деплое и
// может устареть (тогда в таблице кампаний «undefined»), а fixtures/ обновляет ежедневный
// cron. Берём источник, где id есть; иначе что есть. Чинит «undefined»/пустую разбивку.
const _adsHasId = (x: any): boolean => !!x && (
  ((x.top_spend || [])[0] || {}).id !== undefined ||
  (((x.p30 || {}).top_spend || [])[0] || {}).id !== undefined
);
function freshAds(name: string): any {
  const rd = (p: string): any => { try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return null; } };
  const d = rd(`data/${name}`), f = rd(`fixtures/${name}`);
  if (_adsHasId(d)) return d;
  if (_adsHasId(f)) return f;
  return d || f;
}

// Мягкий страж свежести: пишет ::warning:: в лог сборки, если снимок устарел (>=2 дн от вчера).
// Деплой НЕ валит - просто заметно в CI. Прошлые регрессии были из-за ТИХОГО устаревания снимков.
function warnStale(): void {
  const now = new Date();
  const ystd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); ystd.setUTCDate(ystd.getUTCDate() - 1);
  const daysOld = (d?: string): number | null => { if (!d || !/^\d{4}-\d\d-\d\d/.test(d)) return null; return Math.round((ystd.getTime() - new Date(d.slice(0, 10) + "T00:00:00Z").getTime()) / 86400000); };
  // Дата снимка из data/: dateTo (окно) или generated_at (когда снят). Не валим, если файла нет.
  const snapDate = (file: string): string | undefined => {
    try { const j = JSON.parse(readFileSync(`data/${file}`, "utf-8")); return j.dateTo || (j.generated_at ? String(j.generated_at).slice(0, 10) : undefined); }
    catch { return undefined; }
  };
  const checks: [string, string | undefined][] = [
    ["дневная история", maxD],
    ["реклама 30д", (freshAds("ads_30d.json") || {}).dateTo],
    ["реклама по периодам (p30)", ((freshAds("ads_periods.json") || {}).p30 || {}).dateTo],
    ["P&L канал", snapDate("pnl_30d.json")],
    ["P&L по SKU", snapDate("pnl_sku_30d.json")],
    ["товары (skus)", snapDate("skus_live_30d.json")],
    ["кэш per-SKU отчётов", snapDate("ads_reports.json")],
  ];
  let stale = 0;
  for (const [name, d] of checks) { const n = daysOld(d); if (n != null && n >= 2) { stale++; console.log(`::warning::снимок «${name}» устарел: последний день ${d} (${n} дн от вчера). Проверь ночной синк ozon-snapshots.yml.`); } }
  console.log(stale ? `Страж свежести: устаревших снимков ${stale} (см. warnings выше).` : "Страж свежести: снимки актуальны (по вчера).");
}
warnStale();

// --- Оболочка новых страниц в дизайн-системе Кати: её CSS + topbar с периодами ---
const KCSS = (readFileSync("katya/template.html", "utf-8").match(/<style>([\s\S]*?)<\/style>/) || ["", ""])[1];
const EXTRA_CSS = `
.kt-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
.kt-kpi .card{padding:14px 16px;position:relative;overflow:hidden}.kt-k{font-size:11px;color:var(--ink-3);margin-bottom:7px;text-transform:uppercase;letter-spacing:.04em;font-weight:600}.kt-v{font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.01em}.kt-d{font-size:11.5px;margin-top:8px;display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:7px;font-weight:700}.kt-d.up{color:var(--up);background:rgba(16,185,129,.22)}.kt-d.dn{color:var(--dn);background:rgba(244,63,94,.22)}.kt-d.na{color:var(--ink-3);background:var(--bg-soft)}.kt-cap{font-size:11px;color:var(--ink-3);margin-left:7px;font-variant-numeric:tabular-nums}
.kt-kpi .card::before{content:"";position:absolute;left:0;right:0;top:0;bottom:auto;width:auto;height:2px;border-radius:0;background:linear-gradient(90deg,var(--accent),transparent)}
.kt-kpi .card:nth-child(2)::before{background:linear-gradient(90deg,var(--d2),transparent)}
.kt-kpi .card:nth-child(3)::before{background:linear-gradient(90deg,var(--d4),transparent)}
.kt-kpi .card:nth-child(4)::before{background:linear-gradient(90deg,var(--d6),transparent)}
.kt-kpi .card:nth-child(5)::before{background:linear-gradient(90deg,var(--d5),transparent)}
.kt-kpi .card:nth-child(6)::before{background:linear-gradient(90deg,var(--up),transparent)}
.kt-table{width:100%;border-collapse:collapse;font-size:12.5px}.kt-table th{color:var(--ink-3);font-weight:600;text-align:left;padding:7px 8px;border-bottom:1px solid var(--bg-soft)}.kt-table td{padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.04)}.kt-table .r{text-align:right;font-variant-numeric:tabular-nums}
.kt-scroll{overflow-x:auto}.kt-note{font-size:11.5px;color:var(--ink-3);margin-top:8px}
.kt-fbar{height:30px;border-radius:7px;background:linear-gradient(90deg,#0E7490,#22D3EE);color:#06121a;font:700 12.5px/30px system-ui;padding-left:10px;margin:4px 0;min-width:36px}
.kt-src{display:inline-block;font-size:10.5px;border:1px solid var(--bg-soft);border-radius:6px;padding:2px 7px;color:var(--ink-3);margin-left:8px}.kt-src.live{border-color:#22D3EE;color:#22D3EE}
.kt-wf{display:flex;align-items:flex-end;gap:6px;height:190px;padding:8px 4px}.kt-wf>div{flex:1;text-align:center;font-size:10.5px;color:var(--ink-3)}.kt-wf .bar{border-radius:6px 6px 0 0;margin:0 auto;width:78%}
.vf{display:flex;flex-direction:column;gap:2px;padding:8px 0}
.vf-row{display:grid;grid-template-columns:minmax(140px,230px) 1fr;align-items:center;gap:14px}
.vf-name{font-size:14px;font-weight:700;color:var(--ink);text-align:right;line-height:1.15}
.vf-cv{font-size:11.5px;font-weight:600;color:var(--ink-3);text-align:right;line-height:1.1}
.vf-track{display:flex;justify-content:flex-start}
.vf-bar{height:26px;border-radius:0 7px 7px 0;background:linear-gradient(90deg,#0E7490,#22D3EE);color:#06121a;font:800 13px/26px system-ui;text-align:left;padding:0 12px;min-width:90px;max-width:100%;box-shadow:0 1px 8px rgba(34,211,238,.16);white-space:nowrap;overflow:hidden}
.vf-bar.nd{background:transparent;border:1px dashed var(--bg-soft);color:var(--ink-3);font-weight:500;box-shadow:none;line-height:24px}
.vf-conv{font-size:11.5px;color:#8aa0b0;padding:2px 0}
.vf-conv b{color:#cfe8ef;font-size:12.5px}
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
    <button class="pb" data-p="today">Вчера</button>
    <button class="pb" data-p="7d">7 дн</button>
    <button class="pb act" data-p="30d">30 дн</button>
    <button class="pb" data-p="90d">90 дн</button>
    <button class="pb" data-p="year">Год</button>
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
const capRu=()=>({today:'к пред. дню','7d':'к пред. 7 дням','30d':'к пред. 30 дням','90d':'к пред. 90 дням',year:'к пред. году',all:'к пред. периоду',range:'к пред. периоду'}[CURP]||'к пред. периоду');
const dlt=(c,p,goodUp=true,unit)=>{if(!p){if(c&&unit){return '<span class="kt-d '+(goodUp?'up':'dn')+'">'+(c>0?'+':'')+fmtRu(c)+' '+unit+' (с нуля)</span>';}return '<span class="kt-d na">нет базы</span>';}const d=(c-p)/p;const up=d>=0;const good=goodUp?up:!up;return '<span class="kt-d '+(good?'up':'dn')+'">'+(up?'▲':'▼')+' '+(Math.abs(d)*100).toFixed(1)+'%</span><span class="kt-cap">'+capRu()+'</span>';};
function periodDates(p){
  if(p==='range'){const f=document.getElementById('range-from').value,t=document.getElementById('range-to').value;return {from:clampLo(f<t?f:t),to:(f<t?t:f)>MAXD?MAXD:(f<t?t:f)};}
  if(p==='all')return {from:FLOOR,to:MAXD};
  const days={'today':1,'7d':7,'30d':30,'90d':90,'year':365}[p]||30;
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
// Воронка канала (показы/корзина/заказы/доставка/возвраты/отмены) - из дневных тоталов
// data/daily_totals.ndjson (полные показы/возвраты, не только дни-с-продажей). Если файла нет -
// фолбэк на сумму per-SKU истории (как раньше). Разрез по линиям - из истории продаж.
const DAY_T: Record<string, number[]> = { rev: zD(), units: zD(), views: zD(), vsearch: zD(), pdp: zD(), cart: zD(), deliv: zD(), ret: zD(), canc: zD() };
const lineDayOrd: Record<string, { units: number[]; ret: number[]; canc: number[]; cart: number[]; rev: number[] }> = {};
// Воронка в разрезе категорий и подкатегорий: показы/корзина/заказы/доставка по дням.
// Источник - полные показы SKU×день (data/sku_views.ndjson, включая дни без продажи),
// иначе фолбэк на историю продаж (показы только в дни-с-продажей -> разрез занижен).
type Fun = { views: number[]; vsearch: number[]; pdp: number[]; cart: number[]; units: number[]; deliv: number[]; ret: number[]; canc: number[] };
const newFun = (): Fun => ({ views: zD(), vsearch: zD(), pdp: zD(), cart: zD(), units: zD(), deliv: zD(), ret: zD(), canc: zD() });
const catFun: Record<string, Fun> = {};
const subFun: Record<string, Fun & { name: string; cat: string }> = {};
const catSubs: Record<string, Set<string>> = {};
let viewRows: any[] = [];
try { viewRows = readFileSync("data/sku_views.ndjson", "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { viewRows = []; }
const fromViews = viewRows.length > 0;
const funSrc: any[] = fromViews ? viewRows : facts;
for (const r of funSrc) {
  const i = dayIdx(r.date); if (i < 0 || i >= TOTAL) continue;
  const sk = String(r.sku);
  if (!skuName[sk]) skuName[sk] = r.name || ""; // имя нужно автогену таксономии для SKU без продаж
  if (!skuLine[sk] && r.line) skuLine[sk] = r.line;
  const views = r.views || 0;
  const vsearch = fromViews ? (r.vsearch || 0) : 0; // показы в поиске per-SKU (только из sku_views)
  const pdp = fromViews ? (r.pdp || 0) : 0; // посещения карточки (сессии) per-SKU
  const cart = fromViews ? (r.cart || 0) : (r.to_cart || 0);
  const units = r.units || 0;
  const deliv = fromViews ? (r.deliv || 0) : (r.delivered || 0);
  const ret = fromViews ? (r.ret || 0) : (r.returns || 0);
  const canc = fromViews ? (r.canc || 0) : (r.cancellations || 0);
  const rev = fromViews ? 0 : (r.revenue || 0); // rev в LINES_D не используется (показываем шт), но поле сохраняем
  const cat = catOf(sk), sub = subOf(sk), sid = subIdOf(cat, sub);
  const L = (lineDayOrd[cat] ||= { units: zD(), ret: zD(), canc: zD(), cart: zD(), rev: zD() });
  L.units[i] = (L.units[i] ?? 0) + units; L.ret[i] = (L.ret[i] ?? 0) + ret;
  L.canc[i] = (L.canc[i] ?? 0) + canc; L.cart[i] = (L.cart[i] ?? 0) + cart; L.rev[i] = (L.rev[i] ?? 0) + rev;
  const cf = (catFun[cat] ||= newFun());
  cf.views[i] += views; cf.vsearch[i] += vsearch; cf.pdp[i] += pdp; cf.cart[i] += cart; cf.units[i] += units; cf.deliv[i] += deliv; cf.ret[i] += ret; cf.canc[i] += canc;
  const sf = (subFun[sid] ||= Object.assign(newFun(), { name: sub, cat }));
  sf.views[i] += views; sf.vsearch[i] += vsearch; sf.pdp[i] += pdp; sf.cart[i] += cart; sf.units[i] += units; sf.deliv[i] += deliv; sf.ret[i] += ret; sf.canc[i] += canc;
  (catSubs[cat] ||= new Set()).add(sid);
}
let dailyTotals: any[] = [];
try { dailyTotals = readFileSync("data/daily_totals.ndjson", "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { dailyTotals = []; }
if (dailyTotals.length) {
  for (const t of dailyTotals) {
    const i = dayIdx(t.date); if (i < 0 || i >= TOTAL) continue;
    DAY_T.rev![i] = t.revenue || 0; DAY_T.units![i] = t.units || 0; DAY_T.views![i] = t.views || 0; DAY_T.cart![i] = t.to_cart || 0;
    DAY_T.vsearch![i] = t.views_search || 0; DAY_T.pdp![i] = t.pdp_views || 0;
    DAY_T.deliv![i] = t.delivered || 0; DAY_T.ret![i] = t.returns || 0; DAY_T.canc![i] = t.cancellations || 0;
  }
} else { // фолбэк: суммируем per-SKU историю
  for (const f of facts) {
    const i = dayIdx(f.date); if (i < 0 || i >= TOTAL) continue; const fx: any = f;
    DAY_T.rev![i] += f.revenue; DAY_T.units![i] += f.units; DAY_T.views![i] += fx.views || 0; DAY_T.cart![i] += fx.to_cart || 0;
    DAY_T.deliv![i] += fx.delivered || 0; DAY_T.ret![i] += fx.returns || 0; DAY_T.canc![i] += fx.cancellations || 0;
  }
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
  const FACTS_D = { rev: r4(DAY_T.rev!.map((x) => x / 1e6)), units: DAY_T.units, views: DAY_T.views, vsearch: DAY_T.vsearch, pdp: DAY_T.pdp, cart: DAY_T.cart, deliv: DAY_T.deliv, ret: DAY_T.ret, canc: DAY_T.canc };
  const LINES_D = Object.fromEntries(Object.entries(lineDayOrd).map(([k, v]) => [k, { units: v.units, ret: v.ret, canc: v.canc, cart: v.cart, rev: r4(v.rev.map((x) => x / 1e6)) }]));
  const CATFUN = Object.fromEntries(Object.entries(catFun).map(([k, v]) => [k, { views: v.views, vsearch: v.vsearch, pdp: v.pdp, cart: v.cart, units: v.units, deliv: v.deliv, ret: v.ret, canc: v.canc }]));
  const SUBFUN = Object.fromEntries(Object.entries(subFun).map(([k, v]) => [k, { name: v.name, cat: v.cat, views: v.views, vsearch: v.vsearch, pdp: v.pdp, cart: v.cart, units: v.units, deliv: v.deliv, ret: v.ret, canc: v.canc }]));
  const CATSUBS = Object.fromEntries(Object.entries(catSubs).map(([k, v]) => [k, [...v]]));
  const body = `
  <section class="kt-kpi" id="kpis"></section>
  <section class="card"><div class="card-h"><div><div class="card-title">Воронка продаж</div><div class="card-sub" id="fsub"></div></div></div><div id="funnel"></div></section>
  <section class="card"><div class="card-h"><div><div class="card-title">Воронка по категориям</div><div class="card-sub">те же метрики и конверсии, что в воронке продаж, но в разрезе категорий/подкатегорий за период (клик по категории - раскрыть). ${fromViews ? "Показы/в поиске/корзина - по всем дням (полный разрез)." : "Показы/корзина - по товарам в дни продаж (неполно)."} Посещения карточки - сессии per-SKU, между товарами пересекаются, поэтому сумма по категориям выше канального уникального. CV, % (серые шапки) - конверсия между соседними шагами: <span style="color:var(--up)">зелёный</span> - категория конвертит выше канала на этом шаге, <span style="color:var(--dn)">красный</span> - ниже. Строка «Итого» = сумма по категориям (она же бенчмарк для раскраски CV). Показы всего и «Посещения карточки» по категориям не сходятся с «Воронкой продаж»: последняя берёт дедуплицированные канальные итоги OZON, а тут - сумма per-SKU (одна сессия на нескольких карточках считается несколько раз).</div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Категория / подкатегория</th><th class="r">Показы всего</th><th class="r cf-cv">CV, %</th><th class="r">Показы в поиске</th><th class="r cf-cv">CV, %</th><th class="r">Посещения карточки</th><th class="r cf-cv">CV, %</th><th class="r">В корзину</th><th class="r cf-cv">CV, %</th><th class="r">Заказано</th><th class="r cf-cv">CV, %</th><th class="r" title="Выкуплено = Заказано − Отмены (формула OZON; возврат происходит после выкупа, отдельно)">Выкуплено</th></tr></thead><tbody id="catfun"></tbody></table></div></section>
  <section class="card"><div class="card-h"><div><div class="card-title">Потери и возвраты</div><div class="card-sub">возвраты, отмены, брошенные корзины за период - сводно и по категориям. Меняется по периоду и фильтрам вверху.</div></div></div>
    <div id="leaks"></div>
    <div class="kt-scroll" style="margin-top:14px"><table class="kt-table"><thead><tr><th>Категория</th><th class="r">Заказы</th><th class="r">Возвраты</th><th class="r">% возв.</th><th class="r">Отмены</th><th class="r">% отмен</th><th class="r">Брошено в корзине</th><th class="r">% брош.</th></tr></thead><tbody id="retl"></tbody></table></div>
  </section>
  <style>@media (max-width:900px){.kt-two{grid-template-columns:1fr!important}}.cf-cat td{font-weight:600}.cf-cat:hover{background:rgba(255,255,255,.03)}.cf-nd{color:var(--ink-3);font-size:11px}.kt-table td.cf-cv,.kt-table th.cf-cv{color:var(--ink-3);font-size:11.5px}.cf-cat td.cf-cv{font-weight:500}.cf-total td{font-weight:700;background:rgba(255,255,255,.03);border-top:1px solid var(--bg-soft);border-bottom:2px solid var(--accent-deep)}.cf-total td.cf-cv{color:var(--ink-3);font-weight:600}</style>`;
  const pageJs = `
const D=${J(FACTS_D)};const LD=${J(LINES_D)};const CF=${J(CATFUN)};const SF=${J(SUBFUN)};const CS=${J(CATSUBS)};const BASE0=Date.UTC(${BASE_Y},${BASE_M - 1},1);
const idxOf=d=>Math.round((Date.parse(d+'T00:00Z')-BASE0)/86400000);
function sumW(arr,w){let s=0;for(let i=idxOf(w.from);i<=idxOf(w.to);i++)s+=(arr[i]||0);return s;}
function renderCatFunnel(cur){
  const pct=(a,b)=>b?((a/b*100).toFixed(2)+'%'):'—';
  const sm=(o,k)=>sumW(o[k],cur);
  const cats=Object.keys(CF).map(c=>{const o=CF[c];return {c,views:sm(o,'views'),vsearch:sm(o,'vsearch'),pdp:sm(o,'pdp'),cart:sm(o,'cart'),units:sm(o,'units'),deliv:sm(o,'deliv'),ret:sm(o,'ret'),canc:sm(o,'canc')};}).filter(x=>x.units>0||x.cart>0).sort((a,b)=>b.units-a.units);
  const ndc='<td class="r cf-nd">нет данных</td>'; // для старых дней без vsearch/pdp в sku_views
  // Канальный бенчмарк конверсии по каждому шагу (сумма по всем категориям периода).
  // Цвет CV: зелёный - категория конвертит выше канала на этом шаге, красный - ниже.
  const T={};['views','vsearch','pdp','cart','units','deliv','ret','canc'].forEach(k=>T[k]=cats.reduce((s,x)=>s+(x[k]||0),0));
  const BM={vs:T.views?T.vsearch/T.views:0,pd:T.vsearch?T.pdp/T.vsearch:0,ct:T.pdp?T.cart/T.pdp:0,un:T.cart?T.units/T.cart:0,dl:T.units?(T.units-T.canc)/T.units:0};
  const cv=(a,b,bm)=>{if(a==null||b==null||b<=0)return '<td class="r cf-cv">—</td>';const r=a/b;const col=(bm&&bm>0)?(r>=bm?'var(--up)':'var(--dn)'):'var(--ink-3)';return '<td class="r cf-cv" style="color:'+col+'">'+(r*100).toFixed(2)+'%</td>';};
  const cell=x=>{const vs=x.vsearch>0?x.vsearch:null,pd=x.pdp>0?x.pdp:null;
    return '<td class="r">'+fmtRu(x.views)+'</td>'+cv(vs,x.views,BM.vs)
      +(vs!=null?'<td class="r">'+fmtRu(vs)+'</td>':ndc)+cv(pd,vs,BM.pd)
      +(pd!=null?'<td class="r">'+fmtRu(pd)+'</td>':ndc)+cv(x.cart,pd,BM.ct)
      +'<td class="r">'+fmtRu(x.cart)+'</td>'+cv(x.units,x.cart,BM.un)
      +'<td class="r">'+fmtRu(x.units)+'</td>'+cv(Math.max(0,x.units-(x.canc||0)),x.units,BM.dl)
      +'<td class="r">'+fmtRu(Math.max(0,x.units-(x.canc||0)))+'</td>';};
  let h='';
  cats.forEach((x,ci)=>{
    h+='<tr class="cf-cat" data-i="'+ci+'"><td>▸ '+esc(x.c)+'</td>'+cell(x)+'</tr>';
    (CS[x.c]||[]).forEach(sid=>{const o=SF[sid];if(!o)return;const s={views:sm(o,'views'),vsearch:sm(o,'vsearch'),pdp:sm(o,'pdp'),cart:sm(o,'cart'),units:sm(o,'units'),deliv:sm(o,'deliv'),ret:sm(o,'ret'),canc:sm(o,'canc')};if(s.units<=0&&s.cart<=0)return;
      h+='<tr class="cf-sub" data-p="'+ci+'" style="display:none"><td style="padding-left:24px;color:var(--ink-3)">'+esc(o.name)+'</td>'+cell(s)+'</tr>';});
  });
  // Итоговая строка = сумма по категориям (T). CV в ней нейтральный (серый) - это и есть бенчмарк.
  const cvP=(a,b)=>'<td class="r cf-cv">'+(b>0?(a/b*100).toFixed(2)+'%':'—')+'</td>';
  const totRow='<tr class="cf-total"><td>Итого по категориям</td>'
    +'<td class="r">'+fmtRu(T.views)+'</td>'+cvP(T.vsearch,T.views)
    +'<td class="r">'+fmtRu(T.vsearch)+'</td>'+cvP(T.pdp,T.vsearch)
    +'<td class="r">'+fmtRu(T.pdp)+'</td>'+cvP(T.cart,T.pdp)
    +'<td class="r">'+fmtRu(T.cart)+'</td>'+cvP(T.units,T.cart)
    +'<td class="r">'+fmtRu(T.units)+'</td>'+cvP(Math.max(0,T.units-T.canc),T.units)
    +'<td class="r">'+fmtRu(Math.max(0,T.units-T.canc))+'</td></tr>';
  document.getElementById('catfun').innerHTML=h?(totRow+h):'<tr><td colspan="12" class="kt-note">нет данных за период</td></tr>';
  document.querySelectorAll('#catfun .cf-cat').forEach(tr=>tr.onclick=function(){var i=tr.getAttribute('data-i');var open=false;document.querySelectorAll('#catfun .cf-sub[data-p="'+i+'"]').forEach(function(s){s.style.display=s.style.display==='none'?'':'none';open=s.style.display!=='none';});tr.querySelector('td').textContent=(open?'▾ ':'▸ ')+tr.querySelector('td').textContent.replace(/^[▸▾]\\s*/,'');});
}
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
    kpi('Возвраты',fmtRu(S('ret')),dlt(S('ret'),P('ret'),false,'шт')),
    kpi('Отмены',fmtRu(S('canc')),dlt(S('canc'),P('canc'),false,'шт'))
  ].join('');
  document.getElementById('fsub').textContent='период '+cur.from+'..'+cur.to+' · сравнение с '+cmp.from+'..'+cmp.to;
  renderCatFunnel(cur);
  // Вертикальная воронка OZON, сужается вниз, конверсия между шагами (зависит от периода).
  // «Показы в поиске» (vsearch) и «Посещения карточки» (pdp) тянем день-уровнем OZON (dimension=day).
  // Если за период их нет (старые дни до правки workflow) -> null -> «нет данных».
  const nz=k=>{const s=S(k);return s>0?s:null;};
  const lv=[
    {n:'Показы, всего', v:S('views'), c:'из показов в поиск'},
    {n:'Показы в поиске и каталоге', v:nz('vsearch'), c:'из поиска в карточку'},
    {n:'Посещения карточки товара', v:nz('pdp'), c:'из карточки в корзину'},
    {n:'Добавления в корзину', v:S('cart'), c:'из корзины в заказ'},
    {n:'Заказано товаров', v:S('units'), c:'из заказа в выкуп'},
    {n:'Выкуплено', v:Math.max(0,S('units')-S('canc')), c:''}
  ];
  // Форма воронки ФИКСИРОВАННАЯ - ровное сужение вниз, не зависит от значений (меняются только числа).
  const w=lv.map((x,i)=>100-i*(58/(lv.length-1)));
  // Односторонняя воронка: подпись уровня слева, плашка сужается вправо, между ними - только CV%.
  let fh='<div class="vf">';
  lv.forEach((x,i)=>{
    const nd=x.v==null;
    const val=nd?'нет данных':fmtRu(x.v);
    fh+='<div class="vf-row"><div class="vf-name">'+x.n+'</div><div class="vf-track"><div class="vf-bar'+(nd?' nd':'')+'" style="width:'+w[i].toFixed(1)+'%" title="'+x.n+': '+val+'">'+val+'</div></div></div>';
    if(i<lv.length-1){
      const nv=lv[i+1].v; const cv=(x.v!=null&&nv!=null&&x.v>0)?(nv/x.v*100).toFixed(2)+'%':'—';
      fh+='<div class="vf-row"><div class="vf-cv">CV '+cv+'</div><div class="vf-track"></div></div>';
    }
  });
  fh+='</div>';
  document.getElementById('funnel').innerHTML=fh;
  const cartDrop=S('cart')>0?(100-S('units')/S('cart')*100).toFixed(1):'0';
  document.getElementById('leaks').innerHTML='<div class="kt-kpi">'+
    kpi('Возврат, % заказов',(S('units')?(S('ret')/S('units')*100).toFixed(1):0)+'%','')+
    kpi('Отмена, % заказов',(S('units')?(S('canc')/S('units')*100).toFixed(1):0)+'%','')+
    kpi('Брошено в корзине',cartDrop+'%','')+'</div>';
  const rows=Object.entries(LD).map(([k,v])=>({k,u:sumW(v.units,cur),r:sumW(v.ret,cur),c:sumW(v.canc,cur),ct:sumW(v.cart,cur)})).filter(x=>x.u>0||x.r>0||x.c>0||x.ct>0).sort((a,b)=>b.u-a.u);
  const p1=(a,b)=>b?(a/b*100).toFixed(1):'0'; // брошено = добавили в корзину, но не заказали
  document.getElementById('retl').innerHTML=rows.map(x=>{const drop=Math.max(0,x.ct-x.u);return '<tr><td>'+x.k+'</td><td class="r">'+fmtRu(x.u)+'</td><td class="r">'+fmtRu(x.r)+'</td><td class="r" style="color:'+(x.u&&x.r/x.u>0.05?'var(--dn)':'inherit')+'">'+p1(x.r,x.u)+'%</td><td class="r">'+fmtRu(x.c)+'</td><td class="r" style="color:'+(x.u&&x.c/x.u>0.1?'var(--dn)':'inherit')+'">'+p1(x.c,x.u)+'%</td><td class="r">'+fmtRu(drop)+'</td><td class="r" style="color:'+(x.ct&&drop/x.ct>0.9?'var(--dn)':'inherit')+'">'+p1(drop,x.ct)+'%</td></tr>';}).join('')||'<tr><td colspan="8" class="kt-note">нет данных за период</td></tr>';
}`;
  writeFileSync("public/katya-voronka.html", kshell("Воронка", "voronka", body, pageJs));
}

// --- страница 4: Маркетинг (период МГНОВЕННО из запечённых снимков 7/30/90 + живое обновление) ---
{
  const adsSnap = freshAds("ads_30d.json");
  let adsPeriods: any = freshAds("ads_periods.json");
  if (!_adsHasId(adsPeriods)) {
    // Снимок по периодам устарел без id/skus, но per-period числа (расход/выручка по 7/30/90)
    // в нём ЕСТЬ. Не схлопываем всё в 30д: сохраняем периодные числа, доливаем id/skus из
    // свежего ads_30d по названию кампании (off). Иначе данные не меняются от периода.
    // Полные мета-поля кампании (id/status/instr/place/skus) из свежего ads_30d - и по кампаниям,
    // и по сливам - чтобы у периодного снимка были ID, статусы, инструменты и разбивка.
    const metaByOff: Record<string, any> = {};
    const addMeta = (arr: any[]) => (arr || []).forEach((c: any) => { if (c && c.off && c.id && !metaByOff[c.off]) metaByOff[c.off] = { id: String(c.id), status: c.status, instr: c.instr, place: c.place, skus: c.skus || [] }; });
    addMeta(adsSnap.top_spend); addMeta(adsSnap.burners);
    const fix = (c: any) => { const m = metaByOff[c.off]; if (!m) return c; return { ...c, id: c.id || m.id, status: c.status || m.status, instr: c.instr || m.instr, place: c.place || m.place, skus: (c.skus && c.skus.length) ? c.skus : m.skus }; };
    const hydrate = (p: any): any => {
      if (!p) return null;
      let any = false;
      if (Array.isArray(p.top_spend)) p.top_spend = p.top_spend.map((c: any) => { const f = fix(c); if (f !== c) any = true; return f; });
      if (Array.isArray(p.burners)) p.burners = p.burners.map(fix);
      return any ? p : null;
    };
    const hp7 = hydrate(adsPeriods && adsPeriods.p7), hp30 = hydrate(adsPeriods && adsPeriods.p30), hp90 = hydrate(adsPeriods && adsPeriods.p90);
    adsPeriods = (hp7 || hp30 || hp90) ? { p7: hp7 || adsSnap, p30: hp30 || adsSnap, p90: hp90 || adsSnap } : { p7: adsSnap, p30: adsSnap, p90: adsSnap };
  }
  let adsReports: any = {};
  try { adsReports = JSON.parse(readFileSync("data/ads_reports.json", "utf-8")); } catch { adsReports = {}; }
  // Объединённые карточки (карта из Google-таблицы): sku -> {модель, состав др. SKU}.
  // Состыковка кампания -> карточка: в развороте показываем состав карточки (факт),
  // ad-attributed дробление не выдумываем (его в прямом API нет).
  let cardBySku: Record<string, { model: string; others: Array<{ sku: string; offer: string }> }> = {};
  try {
    const cg = JSON.parse(readFileSync("data/card_groups.json", "utf-8"));
    for (const g of cg.groups || []) {
      for (const s of g.skus || []) {
        cardBySku[String(s.sku)] = {
          model: g.model,
          others: (g.skus || []).filter((x: any) => String(x.sku) !== String(s.sku)).map((x: any) => ({ sku: String(x.sku), offer: x.offer || "" })),
        };
      }
    }
  } catch { cardBySku = {}; }
  // Кампания -> продвигаемый SKU из снимка. Живой запрос иногда отдаёт skus:[] (лимит OZON
  // на /objects), и тогда Юнит-эк пустеет. Подстраховка: берём SKU кампании из снимка по id.
  const skuByCamp: Record<string, string> = {};
  const collectSkus = (ts: any[]) => (ts || []).forEach((c: any) => { if (c && c.id && c.skus && c.skus[0] && !skuByCamp[String(c.id)]) skuByCamp[String(c.id)] = String(c.skus[0]); });
  collectSkus(adsSnap.top_spend);
  for (const k of ["p7", "p30", "p90"]) collectSkus((adsPeriods[k] || {}).top_spend);
  // Фаза 1b: дневной ряд рекламы (ads_daily.ndjson) + мета кампаний (line/instr/place/status
  // из снимка - в дневном ряду их нет). Дашборд агрегирует ЛЮБОЙ период из дневного ряда.
  let adsDaily: any[] = [];
  try { adsDaily = readFileSync("data/ads_daily.ndjson", "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { adsDaily = []; }
  // Дневной ряд per-SKU атрибуции (основная/объединённая), индекс по кампании -> точная разбивка за любой период.
  let adsAttrByCamp: Record<string, any[]> = {};
  try { for (const l of readFileSync("data/ads_attr_daily.ndjson", "utf-8").trim().split("\n").filter(Boolean)) { const r = JSON.parse(l); (adsAttrByCamp[String(r.id)] || (adsAttrByCamp[String(r.id)] = [])).push({ d: r.d, sku: String(r.sku), nm: r.nm, sp: r.sp, sold: r.sold, om: r.om, soldM: r.soldM, omM: r.omM }); } } catch { adsAttrByCamp = {}; }
  const campMeta: Record<string, { off: string; line: string; instr: string; place: string; status: string }> = {};
  const addMeta = (list: any[]) => (list || []).forEach((c: any) => { if (c && c.id && !campMeta[String(c.id)]) campMeta[String(c.id)] = { off: c.off || "", line: c.line || "прочее", instr: c.instr || "", place: c.place || "-", status: c.status || "" }; });
  addMeta(adsSnap.top_spend); addMeta(adsSnap.burners);
  for (const k of ["p7", "p30", "p90"]) { addMeta((adsPeriods[k] || {}).top_spend); addMeta((adsPeriods[k] || {}).burners); }
  const live = JSON.parse(readFileSync("data/skus_live_30d.json", "utf-8"));
  let cheaper = 0, even = 0, pricier = 0, noIdx = 0;
  const worst: any[] = [];
  for (const s of live.sku_table) {
    if (s.pidx == null || s.pidx === 0) noIdx++;
    else { if (s.pidx < 1) cheaper++; else if (s.pidx > 1) { pricier++; worst.push(s); } else even++; }
  }
  worst.sort((a, b) => b.pidx - a.pidx);
  const PRICE = { cheaper, even, pricier, noIdx, worst: worst.slice(0, 10).map((s) => ({ name: s.name, offer: s.offer, pidx: s.pidx, rev: s.rev })) };
  // Кампания -> карточка (SKU+имя) через offer кампании (title=offer_id для SKU-кампаний).
  // Даёт «Основную карточку» в развороте за ЛЮБОЙ период из дневного ряда, без снимка RCACHE.
  const offerToCard: Record<string, { sku: string; name: string }> = {};
  for (const s of live.sku_table) if (s.offer) offerToCard[String(s.offer)] = { sku: String(s.sku), name: String(s.name || "") };
  const campCard: Record<string, { sku: string; name: string }> = {};
  for (const [id, m] of Object.entries(campMeta)) { const c = offerToCard[(m as any).off]; if (c) campCard[id] = c; }
  // --- Юнит-экономика рекламы (модель Романа): безубыточная ДРР по SKU из комиссий+с/с ---
  // ECON[sku] = {com: комиссия% OZON, cogs: с/с%, be: безубыточная ДРР%, accr: выручка}. be=null если нет с/с/продаж.
  const econCogs: Record<string, number> = JSON.parse(readFileSync("data/sku_cogs.json", "utf-8"));
  let econPnl: Record<string, any> = {};
  try { econPnl = JSON.parse(readFileSync("data/pnl_sku_30d.json", "utf-8")).bySku || {}; } catch { econPnl = {}; }
  const econUnits: Record<string, number> = {};
  for (const s of live.sku_table) econUnits[String(s.sku)] = s.units || 0;
  const priceLive: Record<string, number> = {}; // текущая цена с витрины OZON, ₽ (live-снимок)
  for (const s of live.sku_table) if ((s as any).price != null) priceLive[String(s.sku)] = (s as any).price;
  const SKU_ECON: Record<string, any> = {};
  for (const sku of Object.keys(econPnl)) {
    const p = econPnl[sku]; const accr = p.accruals || 0; if (accr <= 0) continue;
    // FENIX G1: take-rate OZON = ВСЕ сборы = (начислено − к выплате amount), а не поле commission
    // (оно = только комиссия за продажу, без логистики/эквайринга/хранения). amount = реальный payout.
    const com = Math.round(((accr - (p.amount || 0)) / accr) * 1000) / 10;
    const cu = econCogs[sku] || 0; const units = econUnits[sku] || 0;
    const ops = p.ops || 0;
    const lowN = ops < 5; // FENIX G3: малая выборка ломает безубыток (с/с по брутто-units vs нетто-accruals)
    const noCogs = !(cu > 0 && units > 0);
    const cogsNA = noCogs || lowN;
    const cogsPct = cogsNA ? null : Math.round((cu * units / accr) * 1000) / 10;
    const be = cogsNA ? null : Math.round((100 - com - (cogsPct as number)) * 10) / 10;
    const why = lowN ? "мало данных (<5 операций)" : (noCogs ? "нет себестоимости" : null);
    // Per-unit (₽): средняя цена = выручка/штуки, комиссия ₽/шт = цена×com%, себестоимость ₽/шт = с/с за штуку.
    const price = units > 0 ? Math.round(accr / units) : null;
    const comRub = units > 0 ? Math.round((accr * com) / 100 / units) : null;
    const cogsRub = cu > 0 ? Math.round(cu) : null;
    SKU_ECON[sku] = { com, cogs: cogsPct, be, accr: Math.round(accr), why, price, comRub, cogsRub };
  }
  const body = `
  <div id="ads-status" style="display:flex;align-items:center;gap:8px;padding:7px 12px;margin-bottom:10px;border-radius:9px;background:var(--bg-soft);font-size:12.5px;color:var(--ink-2)"><span id="ads-dot" style="width:9px;height:9px;border-radius:50%;background:#E5B567;display:inline-block"></span><span id="ads-msg">подгружаю данные рекламы…</span></div>
  <section class="kt-kpi" id="kpis"></section>
  <section class="card"><div class="card-h"><div><div class="card-title">Кампании: топ расхода</div><div class="card-sub" id="src1"></div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Кампания</th><th>Инструмент</th><th>Место размещения</th><th class="r">Расход</th><th class="r">Выручка</th><th class="r">Заказы</th><th class="r">ДРР</th></tr></thead><tbody id="top"></tbody></table></div></section>
  <section class="card"><div class="card-h"><div><div class="card-title">Юнит-экономика рекламы: ДРР vs безубыток</div><div class="card-sub">Лимит РК (безубыточная ДРР) = 100% − все сборы OZON (комиссия+логистика+эквайринг+хранение) − себестоимость продвигаемого SKU. Запас = Лимит РК − фактическая ДРР кампании. Решение: 🟢 запас ≥30% лимита · 🟡 0…30% · 🔴 &lt;0. Расход/выручка/ДРР - по всей кампании. Ср. цена, С/с (₽/%) и Комис.,₽ - ЗА ВЫБРАННЫЙ ПЕРИОД по заказам кампании: цена = Выручка рекл. ÷ заказы, Комис.,₽ и С/с,₽ - ПОЛНЫЕ суммы за весь заказанный товар (комиссия = выручка × ставку, с/с = с/с единицы × заказы), С/с% = с/с ÷ выручку. Ставка Комис.% - снимок 30 дней (стабильна по категории). Цена с витрины - текущая цена SKU на OZON (live-снимок). Приб. до рекл., ₽ = Выручка рекл. − сборы OZON − себестоимость (если ≥ Расхода - кампания в плюс). Светофор приоритизации «газ/режь», не P&amp;L до копейки.</div></div></div><div class="kt-kpi" id="uecon-kpi" style="margin-bottom:10px"></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Кампания / SKU</th><th class="r" title="Расход кампании на рекламу за выбранный период. Источник: OZON Performance (дневной ряд statistics/daily или снимок).">Расход</th><th class="r" title="Выручка, атрибутированная рекламе кампании за период (заказы из продвижения). Источник: OZON Performance.">Выручка рекл.</th><th class="r" title="ДРР = Расход ÷ Выручка рекл. × 100. Источник: OZON Performance.">ДРР</th><th class="r" title="Ср. цена за выбранный период = Выручка рекл. ÷ заказы. Источник: OZON Performance (дневной ряд за период).">Ср. цена</th><th class="r" title="Текущая цена на карточке OZON сейчас (live-снимок, с учётом акций) - то, что видит клиент. Источник: Seller API product/info/prices.">Цена с витрины</th><th class="r" title="ПОЛНАЯ комиссия OZON за период (за весь заказанный товар) = Выручка рекл. × Комис.%. Ставка - снимок 30д.">Комис., ₽</th><th class="r" style="color:var(--ink-3)" title="Комис.% = ставка всех сборов OZON = (начислено − к выплате) ÷ начислено × 100. Снимок 30 дней (стабильна по категории), не за период. Источник: pnl_sku.">Комис., %</th><th class="r" title="ПОЛНАЯ себестоимость заказанного за период = себестоимость единицы (sku_cogs) × заказы периода.">С/с, ₽</th><th class="r" style="color:var(--ink-3)" title="С/с% за период = Полная с/с ÷ Выручка рекл. × 100.">С/с, %</th><th class="r" title="Прибыль ДО рекламы за период = Выручка рекл. − все сборы OZON − себестоимость. Если ≥ Расхода на рекламу - кампания в плюс.">Приб. до рекл., ₽</th><th class="r" title="Прибыль ПОСЛЕ рекламы = Приб. до рекл. − Расход на рекламу. Итоговые деньги кампании за период (плюс/минус).">Приб. после рекл., ₽</th><th class="r" title="Лимит РК (безубыточная ДРР) = 100 − Комис.% − С/с%. Сколько можно тратить на рекламу, не уходя в минус.">Лимит РК</th><th class="r" title="Запас = Лимит РК − фактическая ДРР, в процентных пунктах. >0 - реклама в плюс.">Запас, п.п.</th><th>Решение</th></tr></thead><tbody id="uecon"></tbody></table></div></section>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px" class="kt-two">
    <section class="card"><div class="card-h"><div><div class="card-title">Сливы бюджета</div><div class="card-sub">расход от 3000 ₽ при нуле заказов или ДРР от 40% · клик - разбивка по SKU</div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Кампания</th><th class="r">Расход</th><th class="r">Выручка</th><th class="r">Заказы</th><th class="r">ДРР</th></tr></thead><tbody id="burn"></tbody></table></div></section>
    <section class="card"><div class="card-h"><div><div class="card-title">Реклама по категориям</div><div class="card-sub">расход/выручка/заказы/ДРР за период (по категории продвигаемого SKU, топ-кампании)</div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Категория</th><th class="r">Расход</th><th class="r">Выручка</th><th class="r">Заказы</th><th class="r">ДРР</th></tr></thead><tbody id="lines"></tbody></table></div></section>
  </div>
  <section class="card"><div class="card-h"><div><div class="card-title">Индекс цены против рынка</div><div class="card-sub">Индекс цены - на дату снимка <b>${maxD}</b> (всегда текущий, не историчен). Оборот - за 30 дней: <b>${live.dateFrom || ""} – ${live.dateTo || maxD}</b>.</div></div></div><div id="price"></div></section>
  <style>@media (max-width:900px){.kt-two{grid-template-columns:1fr!important}}.ad-exp{cursor:pointer}.ad-exp:hover{background:rgba(255,255,255,.03)}.ad-art{display:inline-block;background:var(--bg-soft);border-radius:5px;padding:1px 7px;margin:2px 3px 2px 0;font-size:11.5px;color:var(--ink-2)}</style>`;
  const skuMap: Record<string, string> = {};
  const skuCat: Record<string, string> = {};
  for (const s of live.sku_table) { if (s.sku != null) { const sk = String(s.sku); skuMap[sk] = s.offer || s.name || sk; skuCat[sk] = taxOf(sk).category || autoTax(s.name || "").category || "Прочее"; } }
  const pageJs = `
const SNAP=${J(adsSnap)};const PRICE=${J(PRICE)};const PERIODS=${J(adsPeriods)};const RCACHE=${J(adsReports)};const SKU_MAP=${J(skuMap)};const SKU_CAT=${J(skuCat)};const ECON=${J(SKU_ECON)};const PRICE_LIVE=${J(priceLive)};const SKUS_BY_CAMP=${J(skuByCamp)};const CARDG=${J(cardBySku)};const ADS_DAILY=${J(adsDaily)};const ATTR_DAILY=${J(adsAttrByCamp)};const CAMP_META=${J(campMeta)};const CAMP_CARD=${J(campCard)};
// Per-SKU «Основная карточка» за период из кампании (без снимка RCACHE): SKU кампании + её
// суммы за выбранное окно (они уже точные из aggFromDaily). Синхронно, без async-загрузки.
function cardRep(c){var cd=CAMP_CARD[String(c.id)];return cd?[{sku:cd.sku,name:cd.name,sp:c.sp||0,om:c.om||0,sold:c.o||0,omModel:0,soldModel:0}]:[];}
// Фаза 1b: агрегат рекламы за ПРОИЗВОЛЬНЫЙ период из дневного ряда (как продажи из history).
// Форма 1:1 со снимком (totals/top_spend/burners/by_line), чтобы paint/renderTop/renderBurn не менять.
function aggFromDaily(from,to){
  var m={};
  for(var i=0;i<ADS_DAILY.length;i++){var r=ADS_DAILY[i];if(r.d<from||r.d>to)continue;var a=m[r.id]||(m[r.id]={id:r.id,off:r.off,sp:0,o:0,om:0});a.sp+=r.sp;a.o+=r.o;a.om+=r.om;}
  var list=Object.keys(m).map(function(k){var c=m[k];var meta=CAMP_META[k]||{};var sp=Math.round(c.sp),om=Math.round(c.om);
    return {id:c.id,off:meta.off||c.off,line:meta.line||'прочее',instr:meta.instr||'',place:meta.place||'-',status:meta.status||'',sp:sp,o:c.o,om:om,drr:om?Math.round(sp/om*1000)/10:0,cpo:c.o?Math.round(sp/c.o):0,roas:sp?Math.round(om/sp*10)/10:0};});
  var spend=0,om=0,orders=0,active=0;list.forEach(function(c){spend+=c.sp;om+=c.om;orders+=c.o;if(c.sp>0)active++;});
  var totals={spend:spend,adRevenue:om,orders:orders,drr:om?Math.round(spend/om*1000)/10:0,cpo:orders?Math.round(spend/orders):0,active:active,campaigns:list.length};
  var top_spend=list.slice().sort(function(x,y){return y.sp-x.sp;}).slice(0,10);
  var burners=list.filter(function(c){return !isCPO(c)&&c.sp>=3000&&(c.o===0||c.drr>=40);}).sort(function(x,y){return y.sp-x.sp;}).slice(0,8);
  var lm={};list.forEach(function(c){var g=lm[c.line]||(lm[c.line]={line:c.line,sp:0,om:0});g.sp+=c.sp;g.om+=c.om;});
  var by_line=Object.keys(lm).map(function(k){var g=lm[k];return {line:k,sp:g.sp,om:g.om,drr:g.om?Math.round(g.sp/g.om*1000)/10:0};}).sort(function(x,y){return y.sp-x.sp;});
  return {dateFrom:from,dateTo:to,totals:totals,top_spend:top_spend,burners:burners,by_line:by_line,daily:true};
}
function campSku(c){return (c.skus&&c.skus[0])?String(c.skus[0]):(SKUS_BY_CAMP[String(c.id)]||null);}
// Пометка устаревания снимка (мягкий страж): если конец периода старше вчера на >=2 дн.
function staleMark(to){try{if(!to)return '';var t=new Date(String(to).slice(0,10)+'T00:00Z'),n=new Date();var y=new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()));y.setUTCDate(y.getUTCDate()-1);var dd=Math.round((y-t)/864e5);return dd>=2?' <span style="color:#FF8A5A;font-weight:700" title="Снимок не обновлялся. Свежесть держит ночной синк OZON.">⚠ устарело '+dd+' дн</span>':'';}catch(e){return '';}}
const MREV=${J(DAY_T.rev)};const MBASE0=Date.UTC(${BASE_Y},${BASE_M - 1},1);
function mGmv(w){if(!w)return 0;var a=Math.round((Date.parse(w.from+'T00:00Z')-MBASE0)/864e5),b=Math.round((Date.parse(w.to+'T00:00Z')-MBASE0)/864e5),s=0;for(var i=a;i<=b;i++)s+=(MREV[i]||0);return s;}
var mCur=null;
// Комиссия по SKU - из снимка 30 дней (ECON). Раньше уточнялась живым pnl-sku через n8n за окно
// фильтра; после миграции живого источника нет - просто перерисовываем юнит-эк по снимку.
function loadCommission(cur){renderUecon(lastA);}
// --- per-SKU разбивка кампаний: только из кэша снимка (RCACHE). Живой отчёт жил на n8n; после
// миграции его нет - разворот строки берёт кэш или показывает «разбивка недоступна». ---
var REPORTS={};var lastA=null;var expanded={};
function rptKey(id){return String(id)+'@'+(mCur?(mCur.from+'_'+mCur.to):'');}
function curLabel(){if(CURP==='7d'||CURP==='today')return 'p7';if(CURP==='90d'||CURP==='all')return 'p90';if(CURP==='range'){var rd=periodDates('range');var d=Math.round((Date.parse(rd.to)-Date.parse(rd.from))/864e5)+1;return d<=10?'p7':d<=45?'p30':'p90';}return 'p30';}
// Дата кэша per-SKU отчётов: показываем рядом с разбивкой, чтобы устаревший кэш не выглядел свежим.
var RCACHE_D=(RCACHE&&RCACHE.generated_at)?String(RCACHE.generated_at).slice(0,10):'';
function cacheStats(id){if(!RCACHE)return null;var order=[curLabel(),'p30','p7','p90'];for(var i=0;i<order.length;i++){var lb=order[i];if(lb&&RCACHE[lb]&&RCACHE[lb].reports){var v=RCACHE[lb].reports[String(id)];if(v!==undefined)return v;}}return null;} // кэш: предпочтит. окно, иначе ближайшее доступное
function repOf(id){var v=REPORTS[rptKey(id)];if(v!==undefined)return v;var c=cacheStats(id);return c===null?null:c;} // живая загрузка > кэш
function dShort(s){return s?(String(s).slice(8,10)+'.'+String(s).slice(5,7)):'';}
function repWin(id){if(!RCACHE)return null;var order=[curLabel(),'p30','p7','p90'];for(var i=0;i<order.length;i++){var lb=order[i];if(lb&&RCACHE[lb]&&RCACHE[lb].reports&&RCACHE[lb].reports[String(id)]!==undefined)return {from:RCACHE[lb].dateFrom,to:RCACHE[lb].dateTo};}return null;} // окно отчёта, использованное для id
// per-SKU атрибуция ТОЧНО за выбранный период из дневного ряда (ATTR_DAILY)
function attrFor(id){var arr=ATTR_DAILY[String(id)];if(!arr||!arr.length)return null;var pd=periodDates(CURP);var by={},any=false;
  for(var i=0;i<arr.length;i++){var r=arr[i];if(r.d<pd.from||r.d>pd.to)continue;any=true;var o=by[r.sku]||(by[r.sku]={sku:r.sku,name:r.nm,sp:0,sold:0,om:0,soldModel:0,omModel:0,drr:0});o.sp+=r.sp;o.sold+=r.sold;o.om+=r.om;o.soldModel+=r.soldM;o.omModel+=r.omM;}
  if(!any)return null;var out=[];for(var k in by){var o=by[k];o.drr=o.om?Math.round(o.sp/o.om*1000)/10:0;out.push(o);}return out;}
// разбивка: точный дневной ряд > снимок RCACHE. {rows, exact, from, to}
function repInfo(id){var a=attrFor(id);if(a){var pd=periodDates(CURP);return {rows:a,exact:true,from:pd.from,to:pd.to};}var c=cacheStats(id);if(c!==null){var w=repWin(id);return {rows:c,exact:false,from:w?w.from:'',to:w?w.to:''};}return null;}
function loadReport(id,cb){var k=rptKey(id);if(REPORTS[k]!==undefined){if(cb)cb(REPORTS[k]);return;}var c=cacheStats(id);if(c!==null){REPORTS[k]=c;if(cb)cb(c);return;} // из кэша мгновенно
  // Живой per-SKU отчёт жил на n8n; после миграции - только кэш снимка (RCACHE) выше, иначе пусто.
  REPORTS[k]=[];if(cb)cb([]);}
var iLabel=function(v){var M={ALL_SKU_PROMO:'Оплата за заказ (все товары)',SKU:'Трафареты',CPC:'Оплата за клик',CPO:'Оплата за заказ'};return M[v]||v||'-';};
var drrCol=function(d){return d>40?'var(--dn)':(d>0&&d<20?'var(--up)':'inherit');};
// CPO «Оплата за заказ»: OZON не отдаёт выручку/заказы по API (daily/json=0, attribution запрещён) -
// показываем «н/д», а не вводящий в заблуждение 0. Расход по ним реальный.
function isCPO(c){return /за заказ/i.test(String((c&&c.instr)||''));}
var CPO_NA='<span style="color:var(--ink-3)" title="OZON не отдаёт выручку и заказы по кампаниям «Оплата за заказ» через API - смотри их в кабинете OZON. Расход - реальный.">н/д</span>';
var stBadge=function(s){if(!s)return '';return s==='активна'?'<span style="font-size:10.5px;color:#34D399;background:rgba(52,211,153,.14);border-radius:4px;padding:1px 6px;margin-left:7px">активна</span>':'<span style="font-size:10.5px;color:var(--ink-3);background:var(--bg-soft);border-radius:4px;padding:1px 6px;margin-left:7px">закрыта</span>';};
function renderTop(){var a=lastA;if(!a)return;
  var html=(a.top_spend||[]).map(function(c,ci){
    var ri=repInfo(c.id);var rep=ri?ri.rows:[];var loaded=ri!==null;var open=!!expanded[ci];var disp=open?'':'display:none';
    var main='<tr class="ad-exp" data-i="'+ci+'" data-id="'+(c.id||'')+'"><td><span class="cf-tg">'+(open?'▾ ':'▸ ')+'</span><b>'+(c.id||c.off||'-')+'</b>'+stBadge(c.status)+'</td><td style="font-size:12px">'+iLabel(c.instr)+'</td><td style="color:var(--ink-3);font-size:12px">'+(c.place||'-')+'</td><td class="r">'+fmtRu(c.sp)+'</td><td class="r">'+(isCPO(c)?CPO_NA:fmtRu(c.om||0))+'</td><td class="r">'+(isCPO(c)?CPO_NA:c.o)+'</td><td class="r" style="color:'+(isCPO(c)?'var(--ink-3)':drrCol(c.drr))+'">'+(isCPO(c)?CPO_NA:(c.drr+'%'))+'</td></tr>';
    var sub='';
    if(loaded&&rep.length){
      var winTxt=ri.from?('за '+dShort(ri.from)+'–'+dShort(ri.to)):'';
      var noteTxt=ri.exact?('разбивка: «продажи в продвижении» (атрибуция OZON) '+winTxt+' - ТОЧНО за выбранный период. Основные складываются в итог кампании; «объединённая» = продажи модели, приписанные этой рекламе, пересекается с основными других SKU и в сумму НЕ входит.'):('разбивка: «продажи в продвижении» (атрибуция OZON) '+winTxt+' (ближайшее окно). Итог кампании — за выбранный период, поэтому суммы не совпадают. «Объединённая» пересекается с основными других SKU, в сумму НЕ входит.');
      sub+='<tr class="ad-sub" data-i="'+ci+'" style="'+disp+'"><td colspan="7" style="padding-left:26px;color:#E5B567;font-size:11px">'+noteTxt+'</td></tr>';
      rep.forEach(function(s){var art=SKU_MAP[s.sku]||s.sku;var dr=s.om?Math.round(s.sp/s.om*1000)/10:0;
        sub+='<tr class="ad-sub" data-i="'+ci+'" style="'+disp+'"><td style="padding-left:26px" title="'+String(s.name||'').replace(/"/g,'&quot;')+'">Основная карточка <span style="color:var(--ink-3)">'+art+'</span></td><td style="color:var(--ink-3);font-size:11px">'+iLabel(c.instr)+'</td><td style="color:var(--ink-3);font-size:11px">'+(c.place||'-')+'</td><td class="r">'+fmtRu(s.sp)+'</td><td class="r">'+fmtRu(s.om)+'</td><td class="r">'+(s.sold||0)+'</td><td class="r" style="color:'+drrCol(dr)+'">'+dr+'%</td></tr>';
        var omO=(s.omModel||0),soO=(s.soldModel||0);
        if(omO>0||soO>0){sub+='<tr class="ad-sub" data-i="'+ci+'" style="'+disp+'"><td style="padding-left:26px;color:var(--ink-3)" title="продажи в продвижении с заказов модели (другие SKU объединённой карточки)">Объединённая карточка (др. SKU)</td><td></td><td></td><td class="r">—</td><td class="r">'+fmtRu(omO)+'</td><td class="r">'+soO+'</td><td class="r">—</td></tr>';}
        var cg=CARDG[String(s.sku)];if(cg&&cg.others&&cg.others.length){sub+='<tr class="ad-sub" data-i="'+ci+'" style="'+disp+'"><td colspan="7" style="padding-left:40px;color:var(--ink-3);font-size:11px">↳ объединённая «'+esc(cg.model)+'» · др. SKU: '+cg.others.map(function(o){return esc(o.offer||o.sku);}).join(", ")+'</td></tr>';}});
    } else {sub='<tr class="ad-sub" data-i="'+ci+'" style="'+disp+'"><td colspan="7" style="padding-left:26px;color:var(--ink-3);font-size:12px">разбивка по SKU недоступна (каталожная кампания или нет в отчёте продвижения)</td></tr>';}
    return main+sub;
  }).join('');
  document.getElementById('top').innerHTML=html;
  document.querySelectorAll('#top .ad-exp').forEach(function(tr){tr.onclick=function(){var i=tr.getAttribute('data-i');var id=tr.getAttribute('data-id');expanded[i]=!expanded[i];
    document.querySelectorAll('#top .ad-sub[data-i="'+i+'"]').forEach(function(s){s.style.display=expanded[i]?'':'none';});
    var tg=tr.querySelector('.cf-tg');if(tg)tg.textContent=expanded[i]?'▾ ':'▸ ';
  };});
}
// Per-SKU теперь синхронный (дневной ряд) - дозагрузки нет, просто отмечаем готовность.
function loadAllReports(){setAds('ok','готов к работе');renderUecon(lastA);}
var bexpanded={};
function renderBurn(a){
  // Статус кампании: из слива, иначе из top_spend по id (бёрнеры в снимке могли отстать
  // от поля status, а у кампаний оно есть) - бейдж активна/закрыта виден сразу.
  var stMap={};(a.top_spend||[]).forEach(function(c){if(c.id)stMap[String(c.id)]=c.status;});
  var html=(a.burners||[]).map(function(b,bi){
    var bstatus=b.status||stMap[String(b.id)];
    var ri=b.id?repInfo(b.id):null;var rep=ri?ri.rows:[];var loaded=ri!==null;var open=!!bexpanded[bi];var disp=open?'':'display:none';
    var main='<tr class="ad-exp" data-bi="'+bi+'" data-id="'+(b.id||'')+'"><td>'+(b.id?'<span class="cf-tg">'+(open?'▾ ':'▸ ')+'</span>':'')+'<b>'+(b.id||b.off)+'</b>'+stBadge(bstatus)+'</td><td class="r">'+fmtRu(b.sp)+'</td><td class="r">'+fmtRu(b.om||0)+'</td><td class="r">'+b.o+'</td><td class="r" style="color:var(--dn)">'+(b.drr?b.drr+'%':'0 заказов')+'</td></tr>';
    var sub='';if(!b.id)return main;
    if(!loaded){sub='<tr class="bn-sub" data-bi="'+bi+'" style="'+disp+'"><td colspan="5" style="padding-left:24px;color:var(--ink-3)">загрузка разбивки…</td></tr>';}
    else if(rep.length){
      rep.forEach(function(s){
        sub+='<tr class="bn-sub" data-bi="'+bi+'" style="'+disp+'"><td style="padding-left:24px">Основная карточка <span style="color:var(--ink-3)">'+(SKU_MAP[s.sku]||s.sku)+'</span></td><td class="r">'+fmtRu(s.sp)+'</td><td class="r">'+fmtRu(s.om)+'</td><td class="r">'+(s.sold||0)+'</td><td class="r"></td></tr>';
        var omO=(s.omModel||0),soO=(s.soldModel||0);
        if(omO>0||soO>0){sub+='<tr class="bn-sub" data-bi="'+bi+'" style="'+disp+'"><td style="padding-left:24px;color:var(--ink-3)">Объединённая карточка (др. SKU)</td><td class="r">—</td><td class="r">'+fmtRu(omO)+'</td><td class="r">'+soO+'</td><td class="r">—</td></tr>';}
        var cg=CARDG[String(s.sku)];if(cg&&cg.others&&cg.others.length){sub+='<tr class="bn-sub" data-bi="'+bi+'" style="'+disp+'"><td colspan="5" style="padding-left:38px;color:var(--ink-3);font-size:11px">↳ объединённая «'+esc(cg.model)+'» · др. SKU: '+cg.others.map(function(o){return esc(o.offer||o.sku);}).join(", ")+'</td></tr>';}});
    } else {sub='<tr class="bn-sub" data-bi="'+bi+'" style="'+disp+'"><td colspan="5" style="padding-left:24px;color:var(--ink-3);font-size:12px">разбивка по SKU недоступна (каталожная или нет в отчёте продвижения)</td></tr>';}
    return main+sub;
  }).join('')||'<tr><td colspan="5" class="kt-note">сливов нет</td></tr>';
  document.getElementById('burn').innerHTML=html;
  document.querySelectorAll('#burn .ad-exp').forEach(function(tr){var id=tr.getAttribute('data-id');if(!id)return;tr.onclick=function(){var i=tr.getAttribute('data-bi');bexpanded[i]=!bexpanded[i];document.querySelectorAll('#burn .bn-sub[data-bi="'+i+'"]').forEach(function(s){s.style.display=bexpanded[i]?'':'none';});var tg=tr.querySelector('.cf-tg');if(tg)tg.textContent=bexpanded[i]?'▾ ':'▸ ';};});
}
// Запечённый снимок рекламы под выбранный период - показываем МГНОВЕННО реальные данные.
function bakedFor(){
  if(CURP==='7d'||CURP==='today')return PERIODS.p7||SNAP;
  if(CURP==='90d'||CURP==='all')return PERIODS.p90||SNAP;
  return PERIODS.p30||SNAP;
}
function paint(a,src){
  const t=a.totals||{};
  const gmv=mGmv(mCur); const odrr=gmv?Math.round((t.spend||0)/gmv*1000)/10:(t.drr??0);
  const kpi=(lab,val)=>'<div class="card"><div class="kt-k">'+lab+'</div><div class="kt-v">'+val+'</div></div>';
  document.getElementById('kpis').innerHTML=[
    kpi('ДРР',odrr+'%'),kpi('Расход, ₽',fMln(t.spend||0)),kpi('Выручка с рекламы, ₽',fMln(t.adRevenue||0)),
    kpi('Заказы с рекламы',fmtRu(t.orders||0)),kpi('CPO, ₽',fmtRu(t.cpo||0)),kpi('Активных кампаний',(t.active||0)+' / '+(t.campaigns||0))
  ].join('');
  // Фаза 1b: при дневном ряде период точный (a.daily). Иначе - ближайший снимок 7/30/90.
  var exact=a.daily||(CURP==='7d'||CURP==='30d'||CURP==='90d');
  var near=exact?'':' <span style="color:#E5B567" title="Снимки есть для 7/30/90 дней. Для выбранного периода показан ближайший.">· ближайший снимок</span>';
  const badge='<span class="kt-src">'+(a.daily?'за период ':'снимок за ')+(a.dateFrom||'')+'..'+(a.dateTo||'')+'</span>'+staleMark(a.dateTo)+near;
  document.getElementById('src1').innerHTML='источник: OZON Performance API (прямой'+(a.daily?', дневной ряд':'')+') '+badge;
  lastA=a;renderTop();
  renderBurn(a);
  // Реклама по категориям: группируем топ-кампании по категории продвигаемого SKU
  var catAgg={};(a.top_spend||[]).forEach(function(c){var sk=campSku(c);var cat=(sk&&SKU_CAT[sk])||'Прочее';var g=catAgg[cat]||(catAgg[cat]={cat:cat,sp:0,om:0,o:0});g.sp+=c.sp||0;g.om+=c.om||0;g.o+=c.o||0;});
  var catRows=Object.keys(catAgg).map(function(k){var g=catAgg[k];return {cat:k,sp:g.sp,om:g.om,o:g.o,drr:g.om?Math.round(g.sp/g.om*1000)/10:0};}).sort(function(x,y){return y.sp-x.sp;});
  document.getElementById('lines').innerHTML=catRows.map(function(l){return '<tr><td>'+l.cat+'</td><td class="r">'+fmtRu(l.sp)+'</td><td class="r">'+fmtRu(l.om)+'</td><td class="r">'+l.o+'</td><td class="r" style="color:'+(l.drr>30?'var(--dn)':'inherit')+'">'+l.drr+'%</td></tr>';}).join('')||'<tr><td colspan="5" class="kt-note">нет данных</td></tr>';
  renderUecon(a);
  const tot=PRICE.cheaper+PRICE.even+PRICE.pricier+PRICE.noIdx||1;
  const seg=(n,c,t2)=>'<span title="'+t2+': '+n+'" style="width:'+(100*n/tot)+'%;background:'+c+';display:block;height:100%"></span>';
  document.getElementById('price').innerHTML='<div style="display:flex;height:26px;border-radius:8px;overflow:hidden;border:1px solid var(--bg-soft)">'+seg(PRICE.cheaper,'#34D399','дешевле рынка')+seg(PRICE.even,'#6AA8FF','вровень')+seg(PRICE.pricier,'#FF5A5F','дороже рынка')+seg(PRICE.noIdx,'#3a3a40','без индекса')+'</div>'+
   '<div class="kt-note"><span style="color:#34D399">дешевле рынка: '+PRICE.cheaper+'</span> · вровень: '+PRICE.even+' · <span style="color:#FF5A5F">дороже: '+PRICE.pricier+'</span> · без индекса: '+PRICE.noIdx+'</div>'+
   '<div class="kt-scroll" style="margin-top:8px"><table class="kt-table"><thead><tr><th>Дороже рынка (риск)</th><th class="r" title="индекс цены к рынку на ${maxD}: <1 дешевле, >1 дороже">Индекс (${maxD})</th><th class="r" title="оборот за 30 дней: ${live.dateFrom || ""}–${live.dateTo || maxD}">Оборот, 30д</th></tr></thead><tbody>'+PRICE.worst.map(w=>'<tr><td>'+w.name+' <span style="color:var(--ink-3)">'+(w.offer||'')+'</span></td><td class="r" style="color:var(--dn)">'+w.pidx+'</td><td class="r">'+fMln(w.rev)+'</td></tr>').join('')+'</tbody></table></div>';
}
function renderUecon(a){
  // По КАМПАНИИ (не по отдельному SKU): расход/выручка/ДРР всей кампании, эконо-показатели
  // продвигаемого SKU (комиссия+с/с -> лимит РК). Не зависит от per-SKU отчётов (429).
  var rows=[];var naSp=0,total=0;
  (a.top_spend||[]).forEach(function(c){
    var sku=campSku(c);if(!sku)return;total++;
    var art=c.off||SKU_MAP[sku]||sku;var e=ECON[sku];var sp=c.sp||0,om=c.om||0,drr=c.drr||0; // артикул = название кампании (оффер промо-SKU)
    if(!e||e.be==null){naSp+=sp;rows.push({camp:c.id,art:art,status:c.status,sp:sp,om:om,drr:drr,na:true,why:e?(e.why||'нет данных'):'нет продаж за период'});return;}
    var com=e.com; // комиссия% - ставка из снимка 30 дней (стабильна по категории)
    var cu=e.cogsRub; // себестоимость ЕДИНИЦЫ, ₽ (снимок sku_cogs)
    var ord=c.o||0; // заказы кампании ЗА ВЫБРАННЫЙ ПЕРИОД (дневной ряд)
    var price=ord>0?Math.round(om/ord):null; // ср цена за период = выручка ÷ заказы
    var comRub=Math.round(om*com/100); // ПОЛНАЯ комиссия за период = выручка × ставка
    var cogsRub=(cu!=null&&ord>0)?cu*ord:null; // ПОЛНАЯ с/с за период = с/с единицы × заказы
    var cogsPct=(cogsRub!=null&&om>0)?Math.round(cogsRub/om*1000)/10:e.cogs; // с/с% за период (fallback снимок)
    var be=Math.round((100-com-cogsPct)*10)/10; // Лимит РК = 100 − комиссия% − с/с%(период)
    var head=Math.round((be-drr)*10)/10;var gt=Math.max(0,Math.round(be*0.3*10)/10); // FENIX G6: порог относительный (30% лимита)
    var v=head>=gt?'go':(head>=0?'edge':'cut');
    var priceClient=PRICE_LIVE[String(sku)]!=null?PRICE_LIVE[String(sku)]:null; // текущая цена с витрины
    var profit=Math.round(om*(1-com/100)-(cogsRub||0)); // прибыль до рекламы = выручка − сборы OZON − с/с
    var profitAds=profit-sp; // прибыль ПОСЛЕ рекламы = до рекламы − расход на рекламу
    rows.push({camp:c.id,art:art,status:c.status,sp:sp,om:om,drr:drr,ord:ord,com:com,cogs:cogsPct,price:price,priceClient:priceClient,comRub:comRub,cogsRub:cogsRub,profit:profit,profitAds:profitAds,be:be,head:head,v:v});
  });
  var el=document.getElementById('uecon');var elk=document.getElementById('uecon-kpi');if(!el)return;
  if(!total){el.innerHTML='<tr><td colspan="15" class="kt-note">нет кампаний с продвигаемым SKU за период</td></tr>';if(elk)elk.innerHTML='';return;}
  var calc=rows.filter(function(r){return !r.na;});
  var nGo=calc.filter(function(r){return r.v==='go';}).length,nEdge=calc.filter(function(r){return r.v==='edge';}).length,nCut=calc.filter(function(r){return r.v==='cut';}).length;
  var profit=0,burn=0;calc.forEach(function(r){var p=Math.round((r.om||0)*r.head/100);if(p>=0)profit+=p;else burn+=p;});
  var kc=function(lab,val,col){return '<div class="card"><div class="kt-k">'+lab+'</div><div class="kt-v" style="color:'+(col||'inherit')+'">'+val+'</div></div>';};
  if(elk)elk.innerHTML=kc('🟢 в плюс',nGo,'var(--up)')+kc('🟡 на грани',nEdge,'#E5B567')+kc('🔴 в минус',nCut,'var(--dn)')+kc('Потенциал зелёных, ₽',(profit>=0?'+':'')+fMln(profit),'var(--up)')+kc('Перерасход по минусовым, ₽',fMln(burn),'var(--dn)')+kc('Покрытие',calc.length+' из '+total+(naSp>0?' · н/д расход '+fMln(naSp):''),'inherit');
  rows.sort(function(x,y){if(x.na!==y.na)return x.na?1:-1;return (x.head==null?999:x.head)-(y.head==null?999:y.head);});
  var vlab={go:'🟢 жать газ',edge:'🟡 держать',cut:'🔴 резать'};var vact={go:'поднять ставку/бюджет',edge:'не масштабировать; ставка/цена',cut:'пауза/резать ставку 48ч'};
  el.innerHTML=rows.map(function(r){
    var act=r.status==='активна';var rowS=act?' style="border-left:3px solid #34D399"':'';
    var nm='<td'+(act?' style="border-left:3px solid #34D399"':'')+'>'+r.camp+stBadge(r.status)+' <span style="color:var(--ink-3)">'+r.art+'</span></td>';
    if(r.na)return '<tr style="opacity:.65">'+nm+'<td class="r">'+fmtRu(r.sp)+'</td><td class="r">'+fmtRu(r.om)+'</td><td class="r">'+(r.drr||0)+'%</td><td class="r" colspan="10" style="color:var(--ink-3)">⚪ н/д: '+r.why+'</td><td>не считаем</td></tr>';
    var hc=r.head>=7?'var(--up)':(r.head>=0?'#E5B567':'var(--dn)');
    var bec=r.be<0?'<span style="color:var(--dn)">убыток до рекл.</span>':'<b>'+r.be+'%</b>'; // FENIX N1: be<0 словом, не сырым %
    return '<tr>'+nm+'<td class="r">'+fmtRu(r.sp)+'</td><td class="r">'+fmtRu(r.om)+'</td><td class="r">'+(r.drr||0)+'%</td><td class="r">'+(r.price==null?'—':fmtRu(r.price))+'</td><td class="r">'+(r.priceClient==null?'—':fmtRu(r.priceClient))+'</td><td class="r">'+(r.comRub==null?'—':fmtRu(r.comRub))+'</td><td class="r" style="color:var(--ink-3)">'+r.com+'%</td><td class="r">'+(r.cogsRub==null?'—':fmtRu(r.cogsRub))+'</td><td class="r" style="color:var(--ink-3)">'+r.cogs+'%</td><td class="r" style="color:'+(r.profit>=0?'var(--up)':'var(--dn)')+'">'+(r.profit==null?'—':fmtRu(r.profit))+'</td><td class="r" style="color:'+(r.profitAds>=0?'var(--up)':'var(--dn)')+'"><b>'+(r.profitAds==null?'—':fmtRu(r.profitAds))+'</b></td><td class="r">'+bec+'</td><td class="r" style="color:'+hc+'"><b>'+(r.head>0?'+':'')+r.head+'</b></td><td style="color:'+hc+'">'+vlab[r.v]+' <span style="color:var(--ink-3);font-size:11px">· '+vact[r.v]+'</span></td></tr>';
  }).join('');
}
function setAds(s,msg){var d=document.getElementById('ads-dot'),m=document.getElementById('ads-msg');if(!d||!m)return;d.style.background=s==='ok'?'#34D399':(s==='warn'?'#FF5A5F':'#E5B567');m.textContent=msg;}
function render(cur,cmp){
  mCur=cur; // окно периода
  setAds('load','считаю рекламу за период…');
  // Фаза 1b: агрегат за ТОЧНЫЙ период из дневного ряда. Фолбэк на снимок, если ряда нет.
  var a=(ADS_DAILY&&ADS_DAILY.length)?aggFromDaily(cur.from,cur.to):bakedFor();
  paint(a,a.daily?'daily':'baked');
  loadCommission(cur); // комиссия по SKU из снимка -> юнит-экономика
  setAds('ok','готов к работе');
  loadAllReports(); // per-SKU разбивка из кэша снимка (ближайший 7/30/90)
}`;
  writeFileSync("public/katya-marketing.html", kshell("Маркетинг и реклама", "marketing", body, pageJs));
}

// --- страница 5: Деньги (ЖИВЫЕ P&L-вебхуки по периоду, fallback - снимок) ---
{
  const pnlSnap = JSON.parse(readFileSync("data/pnl_30d.json", "utf-8"));
  // Фаза 2b: дневной ряд P&L канала (pnl_daily.ndjson) - агрегат за ЛЮБОЙ период.
  let pnlDaily: any[] = [];
  try { pnlDaily = readFileSync("data/pnl_daily.ndjson", "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { pnlDaily = []; }
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
const SNAP=${J(pnlSnap)};const PNL_DAILY=${J(pnlDaily)};const CLOSED=${J(closed)};const NAMES=${J(skuNames)};
// Фаза 2b: P&L канала за ПРОИЗВОЛЬНЫЙ период из дневного ряда. breakdown коарсе (комиссия/
// логистика/прочие услуги) - детальная разбивка по статьям остаётся в снимке 30 дн.
function aggPnlDaily(from,to){
  var accr=0,comm=0,deliv=0,fees=0,pay=0,ops=0;
  for(var i=0;i<PNL_DAILY.length;i++){var r=PNL_DAILY[i];if(r.d<from||r.d>to)continue;accr+=r.accruals;comm+=r.commission;deliv+=r.delivery;fees+=r.fees;pay+=r.payout;ops+=r.ops;}
  var other=-fees-comm-deliv; // прочие услуги = -(все сборы) - комиссия - логистика
  var breakdown={'Комиссия за продажу':comm};if(deliv)breakdown['Логистика']=deliv;if(other)breakdown['Прочие услуги OZON']=other;
  return {accruals:accr,commission:comm,payout:pay,ops:ops,fees:fees,breakdown:breakdown,dateFrom:from,dateTo:to,daily:true};
}
const SKU_SNAP=${J(Object.fromEntries(Object.entries(JSON.parse(readFileSync("data/pnl_sku_30d.json", "utf-8")).bySku).filter(([, v]: any) => v.accruals > 0).sort((a: any, b: any) => b[1].amount - a[1].amount).slice(0, 15)))};
function catSvc(name){const n=name.toLowerCase();
  if(n.includes('brand'))return 'Бренд-комиссия';if(n.includes('acquir'))return 'Эквайринг';if(n.includes('installment'))return 'Рассрочка';if(n.includes('storage'))return 'Хранение';
  if(n.includes('membership')||n.includes('premium')||n.includes('subscription')||n.includes('stars'))return 'Подписки (Stars/Premium/отзывы)';
  if(n.includes('logistic')||n.includes('dropoff')||n.includes('lastmile')||n.includes('deliverytohandover')||n.includes('returnspvz')||n.includes('courier'))return 'Логистика (прямая+возвратная)';
  return 'Прочее';}
function normalize(raw){if(raw.breakdown)return raw;const b={'Комиссия за продажу':Math.round(raw.commission||0)};for(const k in (raw.services||{})){const c=catSvc(k);b[c]=Math.round((b[c]||0)+raw.services[k]);}return {...raw,breakdown:b};}
function paint(p,src){
  p=normalize(p);
  const kpi=(lab,val)=>'<div class="card"><div class="kt-k">'+lab+'</div><div class="kt-v">'+val+'</div></div>';
  const commPct=p.accruals?Math.round(-(p.breakdown['Комиссия за продажу']||0)/p.accruals*1000)/10:0;
  document.getElementById('kpis').innerHTML=[
    kpi('Начислено, ₽',fMln(p.accruals||0)),kpi('Комиссия за продажу',commPct+'%'),kpi('К выплате, ₽',fMln(p.payout||0)),
    kpi('Доля выплаты',(p.accruals?Math.round(p.payout/p.accruals*1000)/10:0)+'%'),kpi('Операций',fmtRu(p.ops||0))
  ].join('');
  // Фаза 2b: при дневном ряде P&L точный за период (p.daily). Иначе - снимок 30 дн.
  var note=p.daily?'':((CURP==='30d')?'':' <span style="color:#E5B567" title="P&L канала по снимку 30 дней.">· снимок 30 дн</span>');
  const badge='<span class="kt-src">'+(p.daily?'за период ':'снимок ')+p.dateFrom+'..'+p.dateTo+'</span>'+note;
  document.getElementById('src1').innerHTML='OZON /v3/finance/transaction/list (прямой) '+badge;
  const fees=Object.entries(p.breakdown).sort((a,b)=>a[1]-b[1]);
  const sumFees=fees.reduce((s,f)=>s+f[1],0);
  const steps=[['Начислено',p.accruals,'#22D3EE']].concat(fees.map(f=>[f[0],f[1],'#FF5A5F'])).concat([['К выплате',p.payout,'#34D399']]);
  const mx=Math.max(1,p.accruals||1);
  document.getElementById('wf').innerHTML=steps.map(s=>{const h=Math.max(4,Math.abs(s[1])/mx*150);return '<div title="'+s[0]+': '+fmtRu(s[1])+' ₽"><div class="bar" style="height:'+h+'px;background:'+s[2]+'"></div>'+s[0].split(' ')[0]+'<br><b style="color:var(--ink-1)">'+fMln(s[1])+'</b></div>';}).join('');
  document.getElementById('fees').innerHTML=fees.map(f=>'<tr><td>'+f[0]+'</td><td class="r" style="color:var(--dn)">'+fmtRu(f[1])+'</td></tr>').join('')+'<tr><td><b>Итого сборы</b></td><td class="r"><b>'+fmtRu(sumFees)+'</b></td></tr>';
}
function paintSku(t,src){
  const rows=Object.entries(t.bySku||{}).map(([sku,v])=>({sku,...v})).filter(x=>x.accruals>0).sort((a,b)=>b.amount-a.amount).slice(0,15);
  document.getElementById('src2').innerHTML='операции с одним товаром · <span class="kt-src">снимок 30 дн</span>';
  document.getElementById('tsku').innerHTML=rows.map(x=>'<tr><td>'+(NAMES[x.sku]||x.sku)+'</td><td class="r">'+fmtRu(x.accruals)+'</td><td class="r" style="color:var(--dn)">'+fmtRu(x.commission)+'</td><td class="r" style="color:var(--up)">'+fmtRu(x.amount)+'</td><td class="r">'+(x.accruals?Math.round(x.amount/x.accruals*100):0)+'%</td></tr>').join('');
}
document.getElementById('closed').innerHTML=(CLOSED.months||CLOSED||[]).map(m=>'<tr><td>'+(m.label||m.month||'')+'</td><td class="r">'+fMln(m.realization??0)+'</td><td class="r" style="color:'+((m.profit??0)>=0?'var(--up)':'var(--dn)')+'">'+fMln(m.profit??0)+'</td></tr>').join('')||'<tr><td colspan="3" class="kt-note">нет закрытых месяцев</td></tr>';
function render(cur,cmp){
  // Фаза 2b: P&L канала за выбранный период из дневного ряда. Фолбэк на снимок 30 дн.
  var p=(PNL_DAILY&&PNL_DAILY.length)?aggPnlDaily(cur.from,cur.to):SNAP;
  paint(p,p.daily?'daily':'snap');
  paintSku({bySku:SKU_SNAP,dateFrom:'',dateTo:''},'snap'); // топ SKU - снимок 30 дн
}`;
  writeFileSync("public/katya-money.html", kshell("Деньги", "money", body, pageJs));
}

// --- страница 0: КОМАНДНЫЙ ЦЕНТР (war-room, флагман Pro) ---
{
  const ads = freshAds("ads_30d.json");
  let adsPeriodsCC: any = freshAds("ads_periods.json");
  if (!_adsHasId(adsPeriodsCC)) adsPeriodsCC = { p7: ads, p30: ads, p90: ads };
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
    <section class="card"><div class="card-h"><div><div class="card-title">Движения за период</div><div class="card-sub" id="movers-sub">кто прибавил и кто просел по обороту против предыдущего равного периода</div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Товар</th><th class="r">Оборот</th><th class="r">Δ к базе</th></tr></thead><tbody id="movers"></tbody></table></div></section>
  </div>
  <section class="card"><div class="card-h"><div><div class="card-title">Локомотивы и риск</div><div class="card-sub">A-товары (дают 80% оборота периода). Красный флаг - есть риск: OOS или дороже рынка</div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Товар</th><th>Линия</th><th class="r">Оборот</th><th class="r">Доля</th><th class="r">Остаток</th><th class="r">Индекс цены</th><th>Риск</th></tr></thead><tbody id="loco"></tbody></table></div></section>
  <style>@media (max-width:900px){.kt-two{grid-template-columns:1fr!important}}</style>`;
  const pageJs = `
const D=${J({ rev: DAY_T.rev, units: DAY_T.units, views: DAY_T.views, cart: DAY_T.cart, deliv: DAY_T.deliv, ret: DAY_T.ret })};
const SKUS=${J(SKUS)};const LIVE=${J(LIVE)};const ADS=${J(ads)};const ADSP=${J(adsPeriodsCC)};
// Общая ДРР - из запечённого снимка рекламы за период (расход÷оборот). Живого уточнения через
// n8n больше нет (миграция): берём ближайший снимок 7/30/90 через adsForPeriod().
// ДРР за выбранный период (из запечённых снимков 7/30/90), а не статичный 30-дн.
function adsForPeriod(){ if(CURP==='7d'||CURP==='today')return ADSP.p7||ADS; if(CURP==='90d'||CURP==='all')return ADSP.p90||ADS; if(CURP==='range'){var d=Math.round((Date.parse(periodDates('range').to)-Date.parse(periodDates('range').from))/864e5)+1; return d<=10?(ADSP.p7||ADS):d<=45?(ADSP.p30||ADS):(ADSP.p90||ADS);} return ADSP.p30||ADS; }
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
    kpi('ДРР',(gmv?(Math.round(((adsForPeriod().totals||{}).spend||0)/gmv*1000)/10):0)+'%','<span class="kt-d na">снимок · за период</span>','Расход рекламы ÷ ВЕСЬ оборот за период (как ДРР в выгрузке OZON). Из ближайшего снимка 7/30/90.'),
    kpi('Возвраты, шт',fmtRu(v('ret')),dlt(v('ret'),p('ret'),false,'шт'),'Возвраты съедают маржу. Рост - смотри качество и описание.')
  ].join('');
  document.getElementById('bsub').textContent='период '+cur.from+'..'+cur.to+' · база '+cmp.from+'..'+cmp.to;
  // Мост: вклад трафика / конверсии / чека в ΔGMV (последовательная декомпозиция)
  const dV=(vw-vwP)*croP*aovP, dC=vw*(cro-croP)*aovP, dA=vw*cro*(aov-aovP);
  const bars=[['Было',gmvP,'#5d7484'],['Трафик',dV,dV>=0?'#34D399':'#FF5A5F'],['Конверсия',dC,dC>=0?'#34D399':'#FF5A5F'],['Чек',dA,dA>=0?'#34D399':'#FF5A5F'],['Стало',gmv,'#22D3EE']];
  const mx=Math.max(gmvP,gmv,1);
  document.getElementById('bridge').innerHTML='<div style="display:flex;align-items:flex-end;gap:8px;height:170px;padding:10px 0">'+bars.map(b=>{const h=Math.max(4,Math.abs(b[1])/mx*130);const sign=(b[0]==='Было'||b[0]==='Стало')?'':(b[1]>=0?'+':'');return '<div style="flex:1;text-align:center;font-size:11px;color:var(--ink-3)"'+tip(b[0]+': '+sign+fMln(b[1])+' ₽')+'><div style="background:'+b[2]+';border-radius:6px 6px 0 0;height:'+h+'px;margin-bottom:4px"></div>'+b[0]+'<br><b style="color:var(--ink-1)">'+sign+fMln(b[1])+'</b></div>';}).join('')+'</div>';
  // Движения: сравнение с предыдущим равным окном. Если база до старта продаж (период сравнения
  // целиком пустой, напр. «Всё время») - честно «нет базы», а не фейковая дельта = полный оборот.
  const baseHasData = gmvP > 0;
  const mv=SKUS.map(s=>{const c=skuW(s,cur),b=skuW(s,cmp);return {nm:s.nm,line:s.line,r:c.r,d:c.r-b.r};}).filter(x=>x.r>0||x.d!==0);
  const dcell=x=>baseHasData?('<span style="color:'+(x.d>=0?'var(--up)':'var(--dn)')+'">'+(x.d>=0?'+':'')+fMln(x.d)+'</span>'):'<span class="kt-d na">нет базы</span>';
  const row=x=>'<tr><td>'+esc(x.nm.slice(0,46))+'<span style="color:var(--ink-3)"> · '+x.line+'</span></td><td class="r">'+fMln(x.r)+'</td><td class="r">'+dcell(x)+'</td></tr>';
  let mrows;
  if(baseHasData){const up=mv.slice().sort((a,b)=>b.d-a.d).slice(0,5),dn=mv.slice().sort((a,b)=>a.d-b.d).slice(0,5);mrows=up.map(row).join('')+'<tr><td colspan="3" style="height:6px;border:0"></td></tr>'+dn.filter(x=>x.d<0).map(row).join('');}
  else{mrows=mv.slice().sort((a,b)=>b.r-a.r).slice(0,10).map(row).join('');}
  document.getElementById('movers').innerHTML=mrows;
  var msub=document.getElementById('movers-sub'); if(msub)msub.textContent=baseHasData?('оборот за '+cur.from+'..'+cur.to+' против '+cmp.from+'..'+cmp.to):('период сравнения '+cmp.from+'..'+cmp.to+' до старта продаж - базы нет, показан топ по обороту');
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

// --- страница 7: Конкуренты (ДЕМО-заглушка) ---
// ВНИМАНИЕ: цифры на этой странице - ДЕМО (заглушка для оценки вида), НЕ реальные.
// Решение Ивана: проставить облачными/демо-данными только тут, чтобы увидеть вёрстку,
// потом переделать на реальный снимок пилота (data/competitors/*.json).
// Демо детерминировано выводится из SKU (без Math.random - воспроизводимость), имена/пары
// товаров - настоящие из input.json, чтобы вид был правдоподобным. Все числа помечены ДЕМО.
{
  let compInput: any[] = [];
  try { compInput = JSON.parse(readFileSync("src/scripts/competitors/input.json", "utf-8")).items || []; } catch { compInput = []; }
  // Реальный снимок пилота (data/competitors/competitors_*.json). Как только появится хоть одна
  // собранная карточка (ok+price) - берём реальные цену/рейтинг/отзывы/наличие вместо демо.
  // Пилот из облака (Actions/контейнер) OZON блокирует (анти-бот) - снимок кладётся локальным прогоном.
  const compReal: Record<string, any> = {}; let compRealDate = ""; let compRealOk = 0;
  try {
    const files = readdirSync("data/competitors").filter((f) => /^competitors_.*\.json$/.test(f)).sort();
    if (files.length) {
      const snap = JSON.parse(readFileSync(`data/competitors/${files[files.length - 1]}`, "utf-8"));
      compRealDate = snap.date || "";
      for (const r of (snap.rows || [])) if (r.ok && r.price != null) { compReal[String(r.sku)] = r; compRealOk++; }
    }
  } catch { /* нет снимка - демо */ }
  const hasReal = compRealOk > 0;
  // Чистим имя стола конкурента от ведущего бренда (он дублирует продавца): "Лайфмебель Стол ..." -> "Стол ...".
  const normБ = (s: string) => s.toLowerCase().replace(/ё/g, "е");
  const stripBrand = (name: string, seller: string) => {
    let n = (name || "").trim();
    const fw = n.split(/\s+/)[0] || "";
    if (seller && fw && normБ(fw).startsWith(normБ(seller).slice(0, 5))) n = n.slice(fw.length).trim();
    return n || (name || "");
  };
  const demo = compInput.map((it: any, idx: number) => {
    const seed = Number(String(it.sku).slice(-4)) || (1000 + idx);
    const real = compReal[String(it.sku)];
    const dCompPrice = 12000 + (seed % 9000);                      // ДЕМО-цена конкурента (fallback)
    const compPrice = real ? real.price : dCompPrice;              // реальная цена конкурента если есть
    const ggPrice = Math.round((dCompPrice * (90 + (seed % 21))) / 100); // наша цена - демо-оценка (привязка к прайсу отдельно)
    const rating = (real && real.rating != null) ? real.rating : Math.round((40 + (seed % 10))) / 10;
    const reviews = (real && real.reviews != null) ? real.reviews : (5 + (seed % 140));
    const available = (real && real.available != null) ? real.available : (seed % 7 !== 0);
    return { sku: String(it.sku), seller: it.seller || "", stol: stripBrand(it.competitor_name || "", it.seller || ""), gg: it.gg_product || "", cat: it.category || "", qual: it.qualification || "", compPrice, ggPrice, rating, reviews, available, src: real ? "real" : "demo" };
  });
  const catList = [...new Set(demo.map((d) => d.cat).filter(Boolean))];        // категории для фильтра
  const srcBadge = hasReal
    ? `<span class="kt-src" style="background:#34D39922;color:#34D399">OZON ${compRealDate}</span>`
    : `<span class="kt-src" style="background:#E0A10022;color:#E0A100">ДЕМО</span>`;
  const compBanner = hasReal
    ? `<section class="card" style="border:1px solid #34D39988;border-left:3px solid #34D399;background:rgba(52,211,153,.06)">
    <div class="card-title" style="color:#34D399">● Живые данные OZON · снимок ${compRealDate}</div>
    <div class="card-sub">Цена / рейтинг / отзывы / наличие конкурентов - <b>реальные</b> с публичных карточек OZON (собрано ${compRealOk}/${demo.length}; остальные - демо-заглушка). Наша цена в сравнении (Δ) - оценочная до привязки к прайсу. Заказы/выручку конкурента OZON не отдаёт - их здесь нет.</div>
  </section>`
    : `<section class="card" style="border:1px solid #E0A10088;border-left:3px solid #E0A100;background:rgba(224,161,0,.06)">
    <div class="card-title" style="color:#E0A100">⚠ ДЕМО-данные · не для решений</div>
    <div class="card-sub">Цены/рейтинги/отзывы на этом листе - <b>заглушка</b> для оценки вида, а не реальные продажи конкурентов. Конкуренты и пары столов - настоящие (из <code>input.json</code>). Заменим на живой снимок пилота OZON (цена / база / рейтинг / отзывы / наличие), как только он отработает. Заказы и выручку конкурента OZON не отдаёт - их здесь не будет даже на реальных данных.</div>
  </section>`;

  const body = `
  ${compBanner}
  <section class="card"><div class="card-h"><div><div class="card-title">Сводка по категориям ${srcBadge}</div><div class="card-sub">ключевые цифры в разрезе категорий (общий итог - нижней строкой). Клик по категории - фильтр таблицы ниже.</div></div></div>
    <div class="kt-scroll"><table class="kt-table"><thead><tr><th>Категория</th><th class="r">Пар</th><th class="r">Конкурентов</th><th class="r">Ср. цена конкур., ₽</th><th class="r">Ср. рейтинг</th><th class="r">Где мы дороже</th></tr></thead><tbody id="catsum"></tbody><tfoot id="catsumtot"></tfoot></table></div>
  </section>
  <section class="card"><div class="card-h"><div><div class="card-title">Мы против конкурентов ${srcBadge}</div><div class="card-sub">выбери товар GG - соберём по нему конкурентов. <span style="color:var(--up)">зелёный</span> Δ - мы дешевле (хорошо), <span style="color:var(--dn)">красный</span> - дороже (риск). Период вверху на демо не влияет.</div></div></div>
    <div style="margin:2px 0 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <label class="pt-filter-lbl" style="color:var(--ink-2)">Категория:</label>
      <select id="fCat" style="background:#0c1218;border:1px solid #2a3a4a;color:#dfe9f0;border-radius:8px;padding:7px 11px;font:inherit;min-width:170px"></select>
      <label class="pt-filter-lbl" style="color:var(--ink-2);margin-left:6px">Товар GG:</label>
      <select id="fGG" style="background:#0c1218;border:1px solid #2a3a4a;color:#dfe9f0;border-radius:8px;padding:7px 11px;font:inherit;min-width:240px"></select>
      <span class="kt-note" id="fcount"></span>
    </div>
    <div class="kt-scroll"><table class="kt-table"><thead><tr><th>Конкурент</th><th>Стол конкурента</th><th>Артикул</th><th>Кв.</th><th class="r">Наша цена ₽</th><th class="r">Цена конкур. ₽</th><th class="r">Δ</th><th class="r">Рейтинг</th><th class="r">Отзывы</th><th>Наличие</th></tr></thead><tbody id="ctab"></tbody><tfoot id="ctot"></tfoot></table></div>
    <div class="kt-note">⚠ всё в таблице - ДЕМО. &#8599; ведёт на реальную карточку OZON. «Артикул» - SKU конкурента на OZON. «Кв.» - квалификация из input.json. «Товар GG» вынесен в фильтр. Нижняя строка - итоги/средние по отфильтрованному.</div>
  </section>`;

  const pageJs = `
const DEMO=${J(demo)};
const CATLIST=${J(catList)};
function ggFor(cat){return [...new Set(DEMO.filter(d=>!cat||d.cat===cat).map(d=>d.gg).filter(Boolean))];}
function rebuildGG(){
  const fc=document.getElementById('fCat').value;
  const pairs=DEMO.filter(d=>!fc||d.cat===fc).length;
  const sel=document.getElementById('fGG');
  sel.innerHTML='<option value="">Все товары GG ('+pairs+' пар)</option>'+ggFor(fc).map(g=>'<option value="'+esc(g)+'">'+esc(g)+'</option>').join('');
}
function paintTable(){
  const fc=document.getElementById('fCat').value, fg=document.getElementById('fGG').value;
  const rows=DEMO.filter(d=>(!fc||d.cat===fc)&&(!fg||d.gg===fg));
  const sl=new Set(rows.map(d=>d.seller));
  document.getElementById('fcount').textContent='пар: '+rows.length+' · конкурентов: '+sl.size;
  const qpill=q=>{const c=/горяч/i.test(q)?'#FF5A5F':/тёпл|тепл/i.test(q)?'#E0A100':'#5d7484';return q?'<span style="color:'+c+';font-weight:700;font-size:11px">'+esc(q)+'</span>':'';};
  document.getElementById('ctab').innerHTML=rows.map(d=>{
    const up=d.ggPrice>d.compPrice; const diff=Math.abs(d.ggPrice-d.compPrice);
    const delta='<span style="color:'+(up?'var(--dn)':'var(--up)')+'">'+(up?'▲ +':'▼ -')+fmtRu(diff)+'</span>';
    const av=d.available?'<span style="color:var(--up)">в наличии</span>':'<span style="color:var(--dn)">нет</span>';
    return '<tr><td><b>'+esc(d.seller)+'</b></td>'+
      '<td><a href="https://www.ozon.ru/product/'+esc(d.sku)+'" target="_blank" rel="noopener" style="color:#22D3EE;text-decoration:none">'+esc(d.stol.slice(0,60))+' &#8599;</a></td>'+
      '<td><span style="color:#9fb3c0;font-variant-numeric:tabular-nums">'+esc(d.sku)+'</span></td>'+
      '<td>'+qpill(d.qual)+'</td>'+
      '<td class="r">'+fmtRu(d.ggPrice)+'</td><td class="r">'+fmtRu(d.compPrice)+'</td><td class="r">'+delta+'</td>'+
      '<td class="r">'+d.rating.toFixed(1)+'</td><td class="r">'+fmtRu(d.reviews)+'</td><td>'+av+'</td></tr>';
  }).join('')||'<tr><td colspan="10" class="kt-note">нет пар по выбранному фильтру</td></tr>';
  // Итоговая строка: средние цены/рейтинг, сумма отзывов, счёт по отфильтрованному.
  const tot=document.getElementById('ctot');
  if(rows.length){
    const n=rows.length;
    const avgGG=Math.round(rows.reduce((s,d)=>s+d.ggPrice,0)/n);
    const avgC=Math.round(rows.reduce((s,d)=>s+d.compPrice,0)/n);
    const pricier=rows.filter(d=>d.ggPrice>d.compPrice).length, cheaper=rows.filter(d=>d.ggPrice<d.compPrice).length;
    const avgR=Math.round(rows.reduce((s,d)=>s+d.rating,0)/n*10)/10;
    const sumRev=rows.reduce((s,d)=>s+d.reviews,0), inAv=rows.filter(d=>d.available).length;
    tot.innerHTML='<tr style="border-top:2px solid #2a3a4a;font-weight:700;background:rgba(255,255,255,.03)">'+
      '<td>Итого / среднее</td><td>'+n+' пар · '+sl.size+' конкур.</td><td></td><td></td>'+
      '<td class="r">'+fmtRu(avgGG)+'</td><td class="r">'+fmtRu(avgC)+'</td>'+
      '<td class="r"><span style="color:var(--dn)">▲'+pricier+'</span> / <span style="color:var(--up)">▼'+cheaper+'</span></td>'+
      '<td class="r">'+avgR.toFixed(1)+'</td><td class="r">'+fmtRu(sumRev)+'</td><td>'+inAv+' в наличии</td></tr>';
  } else { tot.innerHTML=''; }
}
// Агрегаты по набору строк: пар, конкурентов, средняя цена/рейтинг, где мы дороже.
function agg(rows){
  const n=rows.length||0;
  const sellers=new Set(rows.map(d=>d.seller));
  const avgC=n?Math.round(rows.reduce((s,d)=>s+d.compPrice,0)/n):0;
  const avgR=n?Math.round(rows.reduce((s,d)=>s+d.rating,0)/n*10)/10:0;
  const pricier=rows.filter(d=>d.ggPrice>d.compPrice).length;
  return {n,sellers:sellers.size,avgC,avgR,pricier};
}
function paintCatSummary(){
  const fc=document.getElementById('fCat').value;
  const cats=CATLIST.length?CATLIST:[...new Set(DEMO.map(d=>d.cat||'(без категории)'))];
  const cell=a=>'<td class="r">'+a.n+'</td><td class="r">'+a.sellers+'</td><td class="r">'+fmtRu(a.avgC)+'</td><td class="r">'+a.avgR.toFixed(1)+'</td><td class="r">'+a.pricier+' из '+a.n+'</td>';
  document.getElementById('catsum').innerHTML=cats.map(c=>{
    const a=agg(DEMO.filter(d=>(d.cat||'(без категории)')===c));
    const on=fc===c;
    return '<tr data-cat="'+esc(c)+'" style="cursor:pointer'+(on?';background:rgba(34,211,238,.10)':'')+'"><td>'+(on?'▸ ':'')+'<b>'+esc(c)+'</b></td>'+cell(a)+'</tr>';
  }).join('');
  const t=agg(DEMO);
  document.getElementById('catsumtot').innerHTML='<tr style="border-top:2px solid #2a3a4a;font-weight:700;background:rgba(255,255,255,.03)"><td>Итого (все категории)</td>'+cell(t)+'</tr>';
  document.querySelectorAll('#catsum tr[data-cat]').forEach(function(tr){
    tr.addEventListener('click',function(){
      const c=tr.getAttribute('data-cat'); const sel=document.getElementById('fCat');
      sel.value=(sel.value===c)?'':c; rebuildGG(); paintTable(); paintCatSummary();
    });
  });
}
function render(cur,cmp){
  const fcat=document.getElementById('fCat');
  if(fcat && !fcat.options.length){
    fcat.innerHTML='<option value="">Все категории</option>'+CATLIST.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
    fcat.addEventListener('change',()=>{rebuildGG();paintTable();paintCatSummary();});
    rebuildGG();
    document.getElementById('fGG').addEventListener('change',paintTable);
  }
  paintCatSummary();
  paintTable();
}`;
  writeFileSync("public/katya-competitors.html", kshell("Конкуренты", "competitors", body, pageJs));
}

console.log(`katya: командный центр + 5 страниц + конкуренты(ДЕМО) · ${PRODUCTS.length} моделей, ${allSkus.length} SKU, категорий ${CAT_TREE.length}, окно ${WIN[0]}..${WIN[15]}, OZON ${ozRev} млн / ${ozOrd} заказов`);
