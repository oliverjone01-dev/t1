// Версии дашборда "вид Кати" на наших живых данных OZON:
//   katya.html        - обзор (шаблон v55: KPI, план-факт, структура, рентабельность, ABC, сезонность)
//   katya-tovary.html - товары и заказы (шаблон v63: таблица моделей с раскрытием, тепловая карта)
// Берём её CSS/DOM/JS, балансной заменой подставляем только константы-данные.
// Реальные числа - канал OZON. Прочие каналы, клиенты, план - нет данных (честно пусто).
// Запуск: tsx src/scripts/build-katya.ts (после fetch:live). Источник: data/, не fixtures.
import { readFileSync, writeFileSync as _writeFileSync, readdirSync } from "node:fs";
import { dp, fp, op, IS_OZON, KEEP_OZON, platformize } from "../paths.js";
import { KPAGES } from "./katya-nav.js";
import { coverageStrip, GAPS_JS } from "../coverage.js";
// Запись страниц через platformize: для OZON - identity (байт-в-байт), для Маркета - подписи платформы.
const writeFileSync = (path: string, html: string): void => _writeFileSync(path, platformize(html));

// Иван 18.09.2026: «вообще отключи озон, оставь только маркет, объединим потом». OZON он правит
// в другом месте, и сборка отсюда затирала бы его работу. Выход без ошибки, а не падение:
// иначе упал бы весь деплой, включая Маркет. Страницы OZON остаются теми, что закоммичены в
// public/ - сайт их и раздаёт, просто они перестают обновляться из этой ветки.
// Снять отключение = убрать этот блок; ни строки кода OZON не тронуто.
if (IS_OZON) {
  console.log("katya: сборка OZON временно отключена (Иван, 18.09.2026). Ветка ведёт только Маркет: PLATFORM=ym DATA_DIR=data-ym OUT_DIR=public/market");
  process.exit(0);
}

type Fact = { date: string; sku: string; name: string; line: string; revenue: number; units: number; returns?: number;
  // Поля Маркета: деньги и штуки ДОСТАВЛЕННОГО, ОТМЕНЁННОГО и ещё летящего. У OZON их нет,
  // поэтому все они опциональные и читаются только при DELIVERED_BASIS.
  accruals?: number; delivered?: number; cancellations?: number; flying?: number; rev_canc?: number; rev_fly?: number };
const RUMON = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
const mln = (n: number) => Math.round((n / 1e6) * 1000) / 1000;
const slug = (s: string) => "s_" + s.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 60);

// --- данные ---
// БАЗИС ПРОДАЖ. У OZON «Товары» считают заказанное (как было). У Маркета заказанное и проданное
// расходятся в полтора раза: за окно заказано 85,3 млн / 1742 шт, а доставлено 51,1 млн / 1067 шт -
// разницу дают отмены (Маркет отменяет до трети заказов) и то, что ещё едет. Свод по заказам
// считает только доставленное, поэтому «Товары» обязаны считать так же, иначе две страницы одного
// дашборда называют продажами разные числа. Отменённое и летящее не прячем - показываем колонками.
const DELIVERED_BASIS = !IS_OZON;

const VSEARCH_STEP = IS_OZON
  ? `{n:'Показы в поиске и каталоге', v:nz('vsearch'), c:'из поиска в карточку'},\n`
  : "";
const FUN_UNITS_KPI = IS_OZON
  ? `kpi('Заказы, шт',fmtRu(S('units')),dlt(S('units'),P('units')))`
  : `kpi('Заказы, шт',fmtRu(S('units')-S('canc')),dlt(S('units')-S('canc'),P('units')-P('canc')))`;
const FUN_REV_LINE = IS_OZON
  ? `const rev=S('rev')*1e6,prev=P('rev')*1e6;`
  : `const rev=(S('rev')-S('rcanc'))*1e6,prev=(P('rev')-P('rcanc'))*1e6;`;
const facts: Fact[] = readFileSync(dp("history.ndjson"), "utf-8").trim().split("\n").map((l) => JSON.parse(l));

// ПРОДАЖИ БЕРУТСЯ ИЗ САМОГО СВОДА, а не пересчитываются по второму разу из истории заказов.
// Правило свода нетривиально (только статус DELIVERED, позиции-услуги вне товара, прайс нетто
// возвратов, разнесение доставки по позициям) и уже один раз обошлось в расхождение: повторив его
// «по смыслу», я получил 48 941 007 ₽ против 49 306 385 ₽ у свода и 1061 шт против 1067. Вторая
// реализация того же правила расходится с первой всегда, вопрос только когда это заметят.
// Поэтому: продажи и «в пути» - из svod_orders.json, отменённое - из истории (в своде его нет
// по построению: свод считает доставленное).
type SaleRow = { d: string; sku: string; rev: number; units: number; ret: number };
const salesRows: SaleRow[] = [];
const flyRows: SaleRow[] = [];
if (DELIVERED_BASIS) {
  let sv: any = null;
  try { sv = JSON.parse(readFileSync(dp("svod_orders.json"), "utf-8")); } catch { sv = null; }
  const months = (sv && (sv.months || sv)) || [];
  if (!Array.isArray(months) || !months.length) {
    throw new Error("Маркет: нет data-ym/svod_orders.json - «Товары» считаются из свода, без него страница была бы враньём. Запустить npm run ym:derive");
  }
  for (const m of months) {
    for (const r of m.rows || []) {
      const d = r.units_delivered || 0, n = r.units_net || 0;
      // Тот же нетто-прайс, что на листе свода: цена строки относится ко всем доставленным
      // штукам, вернувшуюся долю снимаем пропорционально.
      salesRows.push({ d: String(r.d || ""), sku: String(r.sku), rev: d > 0 ? (r.price || 0) * n / d : (r.price || 0), units: n, ret: r.units_returned || 0 });
    }
    for (const r of m.inflight_rows || []) flyRows.push({ d: String(r.d || ""), sku: String(r.sku), rev: r.price || 0, units: r.units || 0, ret: 0 });
  }
} else {
  for (const f of facts) salesRows.push({ d: f.date, sku: String(f.sku), rev: f.revenue, units: f.units, ret: f.returns || 0 });
}
const live = JSON.parse(readFileSync(dp("skus_live_30d.json"), "utf-8"));
const tax: Record<string, any> = JSON.parse(readFileSync(dp("sku_taxonomy.json"), "utf-8"));
const cogs: Record<string, number> = JSON.parse(readFileSync(dp("sku_cogs.json"), "utf-8"));
// null - остаток НЕ известен (Маркет его не отдал), 0 - известен и равен нулю.
// У OZON поле остаётся прежним (нет значения = 0): его снимок собирается другим пайплайном,
// «неизвестно» там не различается, и страницы OZON обязаны остаться байт-в-байт. Без этой
// развилки правка меняла OZON: у части артикулов stockQty становился null вместо 0.
const stockOf: Record<string, number | null> = {};
for (const s of live.sku_table) stockOf[String(s.sku)] = IS_OZON ? (s.stock || 0) : (s.stock ?? null);

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
// Маркет: отменённое и летящее помесячно - те же 16 колонок окна, что у продаж, чтобы на
// странице их можно было резать выбранным периодом, а не размазывать долей.
const skuMonCancU: Record<string, number[]> = {}, skuMonCancR: Record<string, number[]> = {};
const skuMonFlyU: Record<string, number[]> = {}, skuMonFlyR: Record<string, number[]> = {};
// Имена, линии и сам список артикулов - из истории заказов: там есть и те, что за окно ничего
// не продали, и без них выпал бы каталог. Деньги и штуки - из salesRows (Маркет: свод).
for (const f of facts) {
  const i = moIdx[f.date.slice(0, 7)]; if (i == null) continue;
  const sk = String(f.sku);
  skuMonRev[sk] ||= z16(); skuMonOrd[sk] ||= z16();
  skuName[sk] = f.name; skuLine[sk] = f.line;
  if (DELIVERED_BASIS) {
    // Отменённое в своде отсутствует по построению - берём из истории заказов.
    const cU = (skuMonCancU[sk] ||= z16()); cU[i] = (cU[i] ?? 0) + (f.cancellations || 0);
    const cR = (skuMonCancR[sk] ||= z16()); cR[i] = (cR[i] ?? 0) + (f.rev_canc || 0);
  }
}
for (const r of salesRows) {
  const i = moIdx[r.d.slice(0, 7)]; if (i == null) continue;
  const sk = r.sku;
  const arR = (skuMonRev[sk] ||= z16()); arR[i] = (arR[i] ?? 0) + r.rev;
  const arO = (skuMonOrd[sk] ||= z16()); arO[i] = (arO[i] ?? 0) + r.units;
  skuUnits[sk] = (skuUnits[sk] || 0) + r.units; skuRet[sk] = (skuRet[sk] || 0) + r.ret;
  if (!skuName[sk]) skuName[sk] = sk;
}
for (const r of flyRows) {
  const i = moIdx[r.d.slice(0, 7)]; if (i == null) continue;
  const sk = r.sku;
  skuMonRev[sk] ||= z16(); skuMonOrd[sk] ||= z16();
  const fU = (skuMonFlyU[sk] ||= z16()); fU[i] = (fU[i] ?? 0) + r.units;
  const fR = (skuMonFlyR[sk] ||= z16()); fR[i] = (fR[i] ?? 0) + r.rev;
  if (!skuName[sk]) skuName[sk] = sk;
}
const allSkus = Object.keys(skuMonRev);
const dates = [...new Set(facts.map((f) => f.date))].sort();
const maxD = dates[dates.length - 1]!;
// Время сборки дашборда (= последнее обновление) в МСК. Дашборд пересобирается после ночного
// синка и после ручного «Обновить данные», поэтому это и есть отметка «когда обновлено».
const BUILD_TS = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "") + " МСК";
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
// Правила упорядочены: более узкий признак раньше более общего.
function _autoRules(n: string): { category: string | null; sub: string | null } {
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
  return { category, sub };
}
// Тип товара стоит в начале названия, а описание дальше по строке называет материалы и детали.
// Из-за этого поиск по всей строке уводил товар в чужую категорию: «Стол обеденный овальный
// 200х90 TRUBIS Wood, столешница ЛДСП» попадал в «Комплектующие/Столешницы» (38 из 79 артикулов
// мебельного кабинета за июль 2026), «Стол на металлических опорах» - туда же по слову «опоры».
// Поэтому сначала классифицируем по «голове» названия (бренд отброшен, первые 5 слов), и только
// если она ничего не дала - по всей строке.
function autoTax(name: string): { category: string | null; sub: string | null } {
  if (name in _autoCache) return _autoCache[name]!;
  const n = (name || "").toLowerCase();
  const head = n.replace(/^(gen group|gengroup|genglass|valonti|gentero|metal-gm|glass-memory)[\s,:-]*/, "").split(/\s+/).slice(0, 5).join(" ");
  const rh = _autoRules(head);
  if (!rh.category) return (_autoCache[name] = _autoRules(n));
  // Категорию решает голова, а подкатегорию - вся строка, если она согласна с категорией. Иначе
  // правка головы обнуляла бы уточнение, стоящее дальше пятого слова: «Зеркало настенное ... LED»
  // теряло подкатегорию «Зеркала с подсветкой» (5 SKU OZON и 7 SKU Маркета).
  const rf = _autoRules(n);
  return (_autoCache[name] = { category: rh.category, sub: (rf.category === rh.category && rf.sub) ? rf.sub : rh.sub });
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
try { pnlBySkuComm = JSON.parse(readFileSync(dp("pnl_sku_30d.json"), "utf-8")).bySku || {}; } catch { pnlBySkuComm = {}; }
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

type Variant = { sku: string; sub: string; rev: number; cost: number; costNA: boolean; orders: number; returns: number; retCnt: number; leadDays: number; stockQty: number | null; mr: number[]; mc: number[]; mo: number[]; mcu?: number[]; mcr?: number[]; mfu?: number[]; mfr?: number[] };
const buildModels = () => [...modelMap.entries()].map(([model, sks]) => {
  const mr = z16(), mo = z16(), mc = z16();
  const mcu = z16(), mcr = z16(), mfu = z16(), mfr = z16(); // отменённое и летящее (только Маркет)
  const variants: Variant[] = sks.map((sk) => {
    const vmr = (skuMonRev[sk] || z16()).map((x) => mln(x));
    const vmo = [...(skuMonOrd[sk] || z16())];
    const cu = cogs[sk] || 0;
    const vmc = vmo.map((u) => mln(cu * u));
    const vcu = [...(skuMonCancU[sk] || z16())], vfu = [...(skuMonFlyU[sk] || z16())];
    const vcr = (skuMonCancR[sk] || z16()).map((x) => mln(x)), vfr = (skuMonFlyR[sk] || z16()).map((x) => mln(x));
    for (let i = 0; i < 16; i++) { mr[i] += vmr[i]!; mo[i] += vmo[i]!; mc[i] += vmc[i]!; mcu[i] += vcu[i]!; mcr[i] += vcr[i]!; mfu[i] += vfu[i]!; mfr[i] += vfr[i]!; }
    const vo = skuUnits[sk] || 0, vr = skuRet[sk] || 0;
    const extra = DELIVERED_BASIS ? { mcu: vcu, mcr: vcr, mfu: vfu, mfr: vfr } : {};
    return { sku: taxOf(sk).offer || sk, sub: skuName[sk] || sk, rev: mln(totRevWin(sk)), cost: mln(cu * vo), costNA: cu <= 0, orders: vo, returns: vo > 0 ? Math.round((vr / vo) * 1000) / 10 : 0, retCnt: vr, leadDays: 0, stockQty: IS_OZON ? (stockOf[sk] || 0) : (stockOf[sk] ?? null), mr: vmr, mc: vmc, mo: vmo, ...extra };
  });
  const g = catOf(sks[0]!), sub = subOf(sks[0]!);
  const costNA = variants.some((v) => v.costNA);
  const round3 = (a: number[]) => a.map((x) => Math.round(x * 1000) / 1000);
  // Возврат-ставка модели, % = сумма возвратов / сумма заказов по вариантам (окно данных).
  const mOrd = variants.reduce((s, v) => s + v.orders, 0), mRet = variants.reduce((s, v) => s + v.retCnt, 0);
  return {
    nm: model, line: skuLine[sks[0]!] || g, sub: sub + " · " + sks.length + " арт.",
    subcatId: subIdOf(g, sub), groupId: grIdOf(g), abc: modelAbc[model] || "C", cv: cv(mr),
    cost: Math.round(variants.reduce((s, v) => s + v.cost, 0) * 1000) / 1000, costNA,
    returns: mOrd > 0 ? Math.round((mRet / mOrd) * 1000) / 10 : 0, retCnt: mRet,
    mr: round3(mr), mc: round3(mc), mo, variants,
    ...(DELIVERED_BASIS ? { mcu, mcr: round3(mcr), mfu, mfr: round3(mfr) } : {}),
  };
}).sort((a, b) => b.mr.reduce((s, x) => s + x, 0) - a.mr.reduce((s, x) => s + x, 0));
const PRODUCTS = buildModels();

// --- помесячные ряды ---
const MONTHS = WIN.map((m) => ({ m: monLabel(m), r: Math.round(salesRows.filter((r) => r.d.slice(0, 7) === m).reduce((a, r) => a + r.rev, 0) / 1e6 * 100) / 100 }));
const ozRev = mln(salesRows.reduce((a, r) => a + r.rev, 0));
const ozOrd = salesRows.reduce((a, r) => a + r.units, 0);
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
for (const r of salesRows) {
  const i = dayIdx(r.d); if (i < 0 || i >= TOTAL) continue;
  const sk = r.sku;
  const fr = r.rev, fu = r.units;
  DAILY_REV_REAL[i] = (DAILY_REV_REAL[i] ?? 0) + fr / 1e6;
  const sid = skuSubId[sk]; if (!sid) continue;
  const a1 = (SUB_D_R[sid] ||= zD()); a1[i] = (a1[i] ?? 0) + fr / 1e6;
  const a2 = (SUB_D_O[sid] ||= zD()); a2[i] = (a2[i] ?? 0) + fu;
  const a3 = (PRODUCT_DAILY[skuModel[sk]!] ||= zD()); a3[i] = (a3[i] ?? 0) + fu;
  const a4 = (PRODUCT_DAILY[skuLabel[sk]!] ||= zD()); a4[i] = (a4[i] ?? 0) + fu;
  const a5 = (PRODUCT_DAILY_REV[skuModel[sk]!] ||= zD()); a5[i] = (a5[i] ?? 0) + fr / 1e6;
  const a6 = (PRODUCT_DAILY_REV[skuLabel[sk]!] ||= zD()); a6[i] = (a6[i] ?? 0) + fr / 1e6;
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
// «Товары» на базисе доставленного (только Маркет): две колонки правды рядом с продажами.
// Шаблон один на обе площадки, поэтому патч применяется ТОЛЬКО при DELIVERED_BASIS - страницы
// OZON обязаны остаться байт-в-байт (гейт в ym-snapshots.yml это проверяет).
// Каждая замена обязана сработать: молча не применившийся патч дал бы страницу со старыми
// подписями и новыми числами, то есть ложь без единой ошибки в логе.
function patchDeliveredColumns(html: string): string {
  let out = html;
  const must = (re: RegExp, to: string, what: string) => {
    const before = out;
    out = out.replace(re, to);
    if (out === before) throw new Error("патч «Товары/доставлено» не применился: " + what);
  };

  // Период для отменённого и летящего: те же помесячные ряды, порезанные долей дней месяца,
  // что и запасной путь productPeriod. Дневных рядов по ним нет - и не нужно: колонки справочные.
  must(/function productPeriod\(p, range\)\{/,
    "function productExtra(p, range){\n" +
    "  const f = monthDayOverlap(range);\n" +
    "  let cu = 0, cr = 0, fu = 0, fr = 0;\n" +
    "  const mcu = p.mcu || [], mcr = p.mcr || [], mfu = p.mfu || [], mfr = p.mfr || [];\n" +
    "  for(let m = 0; m < NMONTHS; m++){ cu += (mcu[m]||0)*f[m]; cr += (mcr[m]||0)*f[m]; fu += (mfu[m]||0)*f[m]; fr += (mfr[m]||0)*f[m]; }\n" +
    "  return { cancU: cu, cancR: cr, flyU: fu, flyR: fr };\n" +
    "}\n" +
    "function productPeriod(p, range){",
    "productExtra");

  // Ячейка колонки: деньги крупно, штуки мелко. Ноль - прочерк, чтобы глаз цеплялся за ненулевое.
  must(/const barPct = \(val, max\) => /,
    "const xCell = (rub, units, cls) => units > 0 || rub > 0\n" +
    "    ? `<td class=\"right ${cls}\"><span class=\"num\">${fmt(rub,2)}</span><span class=\"u\">млн ₽</span><div class=\"pt-name-sub\">${fmt0(Math.round(units))} шт</div></td>`\n" +
    "    : `<td class=\"right ${cls}\"><span class=\"num\" style=\"color:var(--ink-3)\">—</span></td>`;\n" +
    "  const barPct = (val, max) => ",
    "xCell");

  // Заголовки: продажи названы доставленными, отменённое и летящее - своими колонками.
  must(/<th class="right \$\{sortClass\('rev'\)\}" data-sort="rev">Выручка<\/th>/,
    '<th class="right ${sortClass(\'rev\')}" data-sort="rev">Продано</th>', "th:rev");
  must(/<th class="right \$\{sortClass\('orders'\)\}" data-sort="orders">Заказы<\/th>/,
    '<th class="right ${sortClass(\'orders\')}" data-sort="orders">Доставлено</th>', "th:orders");
  must(/<th class="right \$\{sortClass\('stockq'\)\}" data-sort="stockq">На складе<\/th>/,
    '<th class="right ${sortClass(\'canc\')}" data-sort="canc">Отменено</th>\n' +
    '            <th class="right ${sortClass(\'fly\')}" data-sort="fly">В пути</th>\n' +
    '            <th class="right ${sortClass(\'stockq\')}" data-sort="stockq">На складе</th>', "th:canc+fly");

  // Сортировка по новым колонкам.
  must(/else if\(sortCol === 'stockq'\) \{ av = a\.stockQty; bv = b\.stockQty; \}/,
    "else if(sortCol === 'canc')   { av = a.cancR; bv = b.cancR; }\n" +
    "    else if(sortCol === 'fly')    { av = a.flyR; bv = b.flyR; }\n" +
    "    else if(sortCol === 'stockq') { av = a.stockQty; bv = b.stockQty; }", "sort");

  // Значения периода на строке модели.
  must(/      stockQty: agg\.stockQty,\n    \};/,
    "      stockQty: agg.stockQty,\n" +
    "      cancU: _px.cancU, cancR: _px.cancR, flyU: _px.flyU, flyR: _px.flyR,\n" +
    "    };", "model:extra-fields");
  must(/    const pa = productPeriod\(p, _rangeA\);/,
    "    const pa = productPeriod(p, _rangeA);\n    const _px = productExtra(p, _rangeA);", "model:productExtra");

  // Ячейки: модель, размер, лист.
  must(/        <td class="right pt-ret \$\{p\.returns==null\?'':retClass\}">\$\{p\.returns==null\?ND:`<span class="num">\$\{fmt\(p\.returns,1\)\}%<\/span>`\}<\/td>\n        <td class="right pt-stock-cell">\$\{ND\}<\/td>/,
    '        <td class="right pt-ret ${p.returns==null?\'\':retClass}">${p.returns==null?ND:`<span class="num">${fmt(p.returns,1)}%</span>`}</td>\n' +
    '        ${xCell(p.cancR, p.cancU, \'pt-canc\')}\n' +
    '        ${xCell(p.flyR, p.flyU, \'pt-fly\')}\n' +
    '        <td class="right pt-stock-cell">${ND}</td>', "row:model");

  must(/      <td class="right pt-ret \$\{retClass\}"><span class="num">\$\{fmt\(v\.returns,1\)\}%<\/span><\/td>\n      \$\{renderStockCell\(v\.stockQty, v\.stk\)\}/,
    '      <td class="right pt-ret ${retClass}"><span class="num">${fmt(v.returns,1)}%</span></td>\n' +
    '      ${xCell(_vx.cancR, _vx.cancU, \'pt-canc\')}\n' +
    '      ${xCell(_vx.flyR, _vx.flyU, \'pt-fly\')}\n' +
    '      ${renderStockCell(v.stockQty, v.stk)}', "row:size");
  must(/    const arts = buildArticles\(v\);/, "    const _vx = productExtra(v, _rangeA);\n    const arts = buildArticles(v);", "size:productExtra");

  must(/      <td class="right pt-ret \$\{a\.returns==null\?'':retClass\}">\$\{a\.returns==null\?ND:`<span class="num">\$\{fmt\(a\.returns,1\)\}%<\/span>`\}<\/td>\n      <td class="right pt-stock-cell">\$\{ND\}<\/td>/,
    '      <td class="right pt-ret ${a.returns==null?\'\':retClass}">${a.returns==null?ND:`<span class="num">${fmt(a.returns,1)}%</span>`}</td>\n' +
    '      ${xCell(_ax.cancR, _ax.cancU, \'pt-canc\')}\n' +
    '      ${xCell(_ax.flyR, _ax.flyU, \'pt-fly\')}\n' +
    '      <td class="right pt-stock-cell">${ND}</td>', "row:leaf");
  must(/    const retClass = a\.returns <= 1 \? 'good' : \(a\.returns <= 2 \? 'warn' : 'bad'\);/,
    "    const _ax = productExtra(a, _rangeA);\n    const retClass = a.returns <= 1 ? 'good' : (a.returns <= 2 ? 'warn' : 'bad');", "leaf:productExtra");

  // Пустая таблица растягивалась на 9 колонок - стало 11.
  must(/<tr><td colspan="9">/, '<tr><td colspan="11">', "colspan");

  // «На складе»: остаток, которого Маркет не отдал, - это «нет данных», а не «нет на складе».
  // По снимку Маркет называет остаток у 34 артикулов из 148; прежний код ставил ноль всем
  // остальным, и страница объявляла 114 артикулов закончившимися, ничего о них не зная.
  must(/const stockClass = stockQty === 0 \? 'OOS' : \(stockQty <= 20 \? 'LOW' : 'OK'\);/,
    "if(stockQty == null) return `<td class=\"right pt-stock-cell\">${ND}</td>`;\n" +
    "    const stockClass = stockQty === 0 ? 'OOS' : (stockQty <= 20 ? 'LOW' : 'OK');", "stock:нет данных");

  // Подпись карточки: базис назван словами прямо на странице.
  must(/клик по модели → артикулы · цвет точки = ранг по выручке/,
    "продажи = ДОСТАВЛЕННОЕ за вычетом возвратов, по дате заказа (тот же базис, что у свода) · отменённое и то, что ещё едет - в отдельных колонках · клик по модели → артикулы · цвет точки = ранг по выручке",
    "card-sub");
  return out;
}

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
// Список вкладок переехал в katya-nav.ts: его же читает build-reakciya.ts, чтобы шапка
// «Реакции» не расходилась с шапкой основных вкладок.
// Переключатель площадки. Дашборды OZON и Яндекс Маркета собираются одним кодом, но из разных
// данных и лежат рядом: OZON в public/, Маркет в public/market/. Ссылки ведут на ТУ ЖЕ страницу
// другой площадки, поэтому «выбрал Маркет - видишь данные Маркета» работает на любой вкладке.
// Выбранный период не теряется: он хранится в localStorage и общий для обеих площадок.
// Полоса навигации при этом раньше на ВСЕХ страницах писала «живой OZON», включая Маркет.
function marketplaceSwitch(active: string): string {
  const here = KPAGES.find(([, , key]) => key === active);
  if (!here) return "";
  const file = here[0];
  const chip = (label: string, href: string, on: boolean) =>
    `<a href="${href}" title="Показать данные площадки «${label}»" style="color:${on ? "#0B0F15" : "#cfe8ef"};background:${on ? "#8AA0FF" : "transparent"};border:1px solid #8AA0FF;border-radius:7px;padding:3px 10px;text-decoration:none;white-space:nowrap;font-weight:600">${label}</a>`;
  return `<span style="margin-left:14px;display:inline-flex;gap:6px;align-items:center">`
    + `<span style="color:#5d7484">площадка:</span>`
    // KEEP_OZON, а не строка «OZON»: platformize() в сборке Маркета меняет КАЖДОЕ вхождение
    // «OZON» на «Яндекс Маркет», и без сторожа обе кнопки подписывались одинаково.
    + chip(KEEP_OZON, IS_OZON ? file : `../${file}`, IS_OZON)
    + chip("Яндекс Маркет", IS_OZON ? `market/${file}` : file, !IS_OZON)
    + `</span>`;
}

// Вкладка «Реакция» собирается отдельным скриптом build-reakciya.ts и только для OZON (данные
// снимаются из кабинета под живой сессией, у Маркета аналога нет). В шапке Маркета её быть не
// должно: файла katya-reakciya.html в public/market/ нет, ссылка вела в 404. Подставлять туда
// OZON-страницу нельзя - это ровно та подмена площадки, от которой избавляет переключатель.
function banner(active: string): string {
  const snap = `${MONTHS[11]?.m || ""}-${MONTHS[15]?.m || ""}`;
  const k = (href: string, label: string, on: boolean) =>
    `<a href="${href}" style="color:${on ? "#0B0F15" : "#22D3EE"};background:${on ? "#22D3EE" : "transparent"};border:1px solid #22D3EE;border-radius:7px;padding:3px 10px;text-decoration:none;white-space:nowrap">${label}</a>`;
  return `<div id="gg-nav" style="background:#1a2330;border-bottom:1px solid #22d3ee;color:#cfe8ef;font:13px/1.6 system-ui;padding:8px 18px">
  <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center">
    ${KPAGES.filter(([, , key]) => key !== "reakciya" || IS_OZON).map(([h, l, key]) => k(h, l, key === active)).join(" ")}
    ${marketplaceSwitch(active)}
    <span style="color:#5d7484;margin-left:8px">живой ${IS_OZON ? "OZON" : "Яндекс Маркет"} (${snap}) · прочие каналы/клиенты/план - нет данных</span>
  </div></div>${coverageStrip()}`;
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
  const d = rd(dp(name)), f = rd(fp(name));
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
    try { const j = JSON.parse(readFileSync(dp(file), "utf-8")); return j.dateTo || (j.generated_at ? String(j.generated_at).slice(0, 10) : undefined); }
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
  <div class="brand"><div class="brand-logo">GG</div><div><div class="brand-name">GENGLASS</div><div class="brand-sub">${title} · живой OZON · данные по ${snapTo}</div><div class="brand-sub" style="font-size:11px;opacity:.75">обновлено ${BUILD_TS}</div></div></div>
  <a class="kt-refresh" href="https://github.com/oliverjone01-dev/t1/actions/workflows/${IS_OZON ? "ozon-snapshots.yml" : "ym-snapshots.yml"}" target="_blank" rel="noopener" title="Открыть GitHub Actions и нажать «Run workflow» - синк соберёт свежий день. Дашборд обновится сам после автосборки (обычно 10-15 мин). Нужен вход в GitHub как владелец." style="align-self:center;margin-left:12px;padding:6px 12px;border:1px solid var(--bd,#2a2f3a);border-radius:8px;color:#22D3EE;font-weight:600;font-size:12.5px;text-decoration:none;white-space:nowrap">🔄 Обновить данные</a>
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
${CHANNEL_JS}${GAPS_JS}
</body></html>`;
}

// --- дневные тоталы канала для Воронки (реальные дни) ---
// Воронка канала (показы/корзина/заказы/доставка/возвраты/отмены) - из дневных тоталов
// data/daily_totals.ndjson (полные показы/возвраты, не только дни-с-продажей). Если файла нет -
// фолбэк на сумму per-SKU истории (как раньше). Разрез по линиям - из истории продаж.
const DAY_T: Record<string, number[]> = { rev: zD(), units: zD(), views: zD(), vsearch: zD(), pdp: zD(), cart: zD(), deliv: zD(), ret: zD(), canc: zD(), rcanc: zD(), racc: zD(), rfly: zD(), rret: zD(), rsvc: zD() };
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
try { viewRows = readFileSync(dp("sku_views.ndjson"), "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { viewRows = []; }
// АГРЕГАТНАЯ СТРОКА - ЭТО СВЁРНУТОЕ ОКНО, А НЕ ДЕНЬ. У Маркета 4 504 такие строки помечены датой
// 06.09 с period_from 31.08, то есть несут в себе всю неделю разом. derive их отбрасывает
// (`if (v.aggregate) continue`), а воронка по категориям складывала их с дневными и считала
// неделю дважды: 386 868 показов дневных + 316 600 агрегата = 703 468 на экране против 386 868
// в воронке продаж. У OZON таких строк нет ни одной, поэтому фильтр там ничего не меняет.
viewRows = viewRows.filter((r) => !r.aggregate);
const fromViews = viewRows.length > 0;
// ШАГИ ПОСЛЕ КОРЗИНЫ СЧИТАЕМ ИЗ ЗАКАЗОВ, А НЕ ИЗ ОТЧЁТА ПОКАЗОВ. У Маркета в отчёте показов
// deliv и canc нули по ВСЕМ 10 751 строкам, поэтому «Выкуплено = Заказано − Отмены» давало
// Выкуплено = Заказано и конверсию ровно 100%, а units знает меньше заказов, чем наша выгрузка
// (151 против 162 за 01-16.09). У OZON отчёт полный - там источник остаётся прежним.
const ORDERS_FUNNEL = !IS_OZON;
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
  const units = ORDERS_FUNNEL ? 0 : (r.units || 0);
  const deliv = ORDERS_FUNNEL ? 0 : (fromViews ? (r.deliv || 0) : (r.delivered || 0));
  const ret = ORDERS_FUNNEL ? 0 : (fromViews ? (r.ret || 0) : (r.returns || 0));
  const canc = ORDERS_FUNNEL ? 0 : (fromViews ? (r.canc || 0) : (r.cancellations || 0));
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
// Второй проход - по заказам. Только здесь берутся заказано / выкуплено / возвраты / отмены,
// поэтому таблица по категориям и воронка продаж считают эти шаги из ОДНОГО источника и сходятся.
if (ORDERS_FUNNEL) for (const f of facts) {
  const i = dayIdx(f.date); if (i < 0 || i >= TOTAL) continue;
  const sk = String(f.sku); if (sk === "__empty__") continue;
  const units = f.units || 0, deliv = f.delivered || 0, ret = f.returns || 0, canc = f.cancellations || 0;
  if (!units && !deliv && !ret && !canc) continue;
  const cat = catOf(sk), sub = subOf(sk), sid = subIdOf(cat, sub);
  const L = (lineDayOrd[cat] ||= { units: zD(), ret: zD(), canc: zD(), cart: zD(), rev: zD() });
  L.units[i] = (L.units[i] ?? 0) + units; L.ret[i] = (L.ret[i] ?? 0) + ret;
  L.canc[i] = (L.canc[i] ?? 0) + canc; L.rev[i] = (L.rev[i] ?? 0) + (f.revenue || 0);
  const cf = (catFun[cat] ||= newFun());
  // `?? 0` не украшение: соседний цикл берёт значения из `any`-строк отчёта и потому компилируется
  // без него, а здесь источник типизован, и строгий режим справедливо требует защиты от дыры.
  cf.units[i] = (cf.units[i] ?? 0) + units; cf.deliv[i] = (cf.deliv[i] ?? 0) + deliv;
  cf.ret[i] = (cf.ret[i] ?? 0) + ret; cf.canc[i] = (cf.canc[i] ?? 0) + canc;
  const sf = (subFun[sid] ||= Object.assign(newFun(), { name: sub, cat }));
  sf.units[i] = (sf.units[i] ?? 0) + units; sf.deliv[i] = (sf.deliv[i] ?? 0) + deliv;
  sf.ret[i] = (sf.ret[i] ?? 0) + ret; sf.canc[i] = (sf.canc[i] ?? 0) + canc;
  (catSubs[cat] ||= new Set()).add(sid);
}
let dailyTotals: any[] = [];
try { dailyTotals = readFileSync(dp("daily_totals.ndjson"), "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { dailyTotals = []; }
const MONEY_FIELDS_OK = !dailyTotals.length || dailyTotals.some((t: any) => "accruals" in t && "rev_canc" in t);
if (dailyTotals.length) {
  for (const t of dailyTotals) {
    const i = dayIdx(t.date); if (i < 0 || i >= TOTAL) continue;
    DAY_T.rev![i] = t.revenue || 0; DAY_T.units![i] = t.units || 0; DAY_T.views![i] = t.views || 0; DAY_T.cart![i] = t.to_cart || 0;
    DAY_T.vsearch![i] = t.views_search || 0; DAY_T.pdp![i] = t.pdp_views || 0;
    DAY_T.deliv![i] = t.delivered || 0; DAY_T.ret![i] = t.returns || 0; DAY_T.canc![i] = t.cancellations || 0;
    DAY_T.rcanc![i] = t.rev_canc || 0; DAY_T.racc![i] = t.accruals || 0;
    DAY_T.rfly![i] = t.rev_fly || 0; DAY_T.rret![i] = t.rev_ret || 0; DAY_T.rsvc![i] = t.rev_service || 0;
  }
} else { // фолбэк: суммируем per-SKU историю
  for (const f of facts) {
    const i = dayIdx(f.date); if (i < 0 || i >= TOTAL) continue; const fx: any = f;
    DAY_T.rev![i] += f.revenue; DAY_T.units![i] += f.units; DAY_T.views![i] += fx.views || 0; DAY_T.cart![i] += fx.to_cart || 0;
    DAY_T.deliv![i] += fx.delivered || 0; DAY_T.ret![i] += fx.returns || 0; DAY_T.canc![i] += fx.cancellations || 0;
    DAY_T.rcanc![i] = (DAY_T.rcanc![i] ?? 0) + (fx.rev_canc || 0); DAY_T.racc![i] = (DAY_T.racc![i] ?? 0) + (fx.accruals || 0);
    DAY_T.rfly![i] = (DAY_T.rfly![i] ?? 0) + (fx.rev_fly || 0); DAY_T.rret![i] = (DAY_T.rret![i] ?? 0) + (fx.rev_ret || 0); DAY_T.rsvc![i] = (DAY_T.rsvc![i] ?? 0) + (fx.rev_service || 0);
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
  html = html.replace("</body>", PERSIST_JS + "\n" + GURU_JS + "\n" + HELP_JS + "\n" + CHANNEL_JS + GAPS_JS + "\n</body>");
  writeFileSync(op("katya.html"), html);
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
  if (DELIVERED_BASIS) html = patchDeliveredColumns(html);
  html = html.replace(/<body[^>]*>/, (m) => m + "\n" + banner("tovary") + REAL_DAILY_JS(true) + `<script>window.__GG_MAXD='${maxD}'</script>`);
  html = html.replace("</body>", PERSIST_JS + "\n" + GURU_JS + "\n" + HELP_JS + "\n" + CHANNEL_JS + GAPS_JS + "\n</body>");
  writeFileSync(op("katya-tovary.html"), html);
}

// --- страница 3: Воронка (реальные дни, динамика по периоду) ---
{
  const FACTS_D = { rev: r4(DAY_T.rev!.map((x) => x / 1e6)), rcanc: r4(DAY_T.rcanc!.map((x) => x / 1e6)), units: DAY_T.units, views: DAY_T.views, vsearch: DAY_T.vsearch, pdp: DAY_T.pdp, cart: DAY_T.cart, deliv: DAY_T.deliv, ret: DAY_T.ret, canc: DAY_T.canc };
  const LINES_D = Object.fromEntries(Object.entries(lineDayOrd).map(([k, v]) => [k, { units: v.units, ret: v.ret, canc: v.canc, cart: v.cart, rev: r4(v.rev.map((x) => x / 1e6)) }]));
  const CATFUN = Object.fromEntries(Object.entries(catFun).map(([k, v]) => [k, { views: v.views, vsearch: v.vsearch, pdp: v.pdp, cart: v.cart, units: v.units, deliv: v.deliv, ret: v.ret, canc: v.canc }]));
  const SUBFUN = Object.fromEntries(Object.entries(subFun).map(([k, v]) => [k, { name: v.name, cat: v.cat, views: v.views, vsearch: v.vsearch, pdp: v.pdp, cart: v.cart, units: v.units, deliv: v.deliv, ret: v.ret, canc: v.canc }]));
  const CATSUBS = Object.fromEntries(Object.entries(catSubs).map(([k, v]) => [k, [...v]]));
  // Фильтр строк таблицы. Прежний прятал категории, у которых за период есть показы, но нет
  // заказов и корзины: после починки задвоения именно эти 410 показов из 386 868 мешали
  // таблице сойтись с воронкой шаг в шаг. У OZON оставлен прежним - страницы байт-в-байт.
  // Дельта конверсии показ→заказ. У Маркета знаменатель падал на «или единица» и превращал
  // «показов не было» в «был один показ»: за 01-16.09 сравнивались 162/386 868 = 0,0004
  // против 171/1 = 171, и карточка честно рисовала ровно −100%. Теперь пустая база
  // называется пустой, как в соседней карточке «Показы». У OZON выражение прежнее -
  // его страницы эта ветка не трогает, и комментарий сюда вынесен, чтобы не уехать
  // текстом внутрь собранной страницы (уже ловилось сверкой байтов).
  // Хвост подписи под воронкой. «Выкуплено» у Маркета считается по РЕАЛЬНО доставленному,
  // поэтому разрыв с «Заказано» надо объяснить числом, а не оставить читаться потерей:
  // часть заказов периода ещё едет. У OZON хвоста нет, и он обязан быть ПУСТОЙ СТРОКОЙ
  // без переноса - иначе в его странице остаётся лишний перевод строки (5 байт, поймано).
  const FSUB_TAIL = IS_OZON ? "" : "+(function(){var fly=Math.max(0,S('units')-S('deliv')-S('canc')-S('ret'));"
    + "return fly?' · ещё в пути '+fmtRu(fly)+' шт: выкуп по ним дорастёт задним числом':'';})()";
  const CONV_DELTA = IS_OZON
    ? "S('units')/(S('views')||1),P('units')/(P('views')||1)"
    : "S('views')?(S('units')-S('canc'))/S('views'):0,P('views')?(P('units')-P('canc'))/P('views'):0";
  const CAT_KEEP = IS_OZON ? "x.units>0||x.cart>0" : "x.units>0||x.cart>0||x.views>0";
  const body = `
  <section class="kt-kpi" id="kpis"></section>
  <section class="card"><div class="card-h"><div><div class="card-title">Воронка продаж</div><div class="card-sub" id="fsub"></div></div></div><div id="funnel"></div></section>
  <section class="card"><div class="card-h"><div><div class="card-title">Воронка по категориям</div><div class="card-sub">те же метрики и конверсии, что в воронке продаж, но в разрезе категорий/подкатегорий за период (клик по категории - раскрыть). ${fromViews ? "Показы/в поиске/корзина - по всем дням (полный разрез)." : "Показы/корзина - по товарам в дни продаж (неполно)."} Посещения карточки - сессии per-SKU, между товарами пересекаются, поэтому сумма по категориям выше канального уникального. CV, % (серые шапки) - конверсия между соседними шагами: <span style="color:var(--up)">зелёный</span> - категория конвертит выше канала на этом шаге, <span style="color:var(--dn)">красный</span> - ниже. Строка «Итого» = сумма по категориям (она же бенчмарк для раскраски CV).${IS_OZON ? ` Показы всего и «Посещения карточки» по категориям не сходятся с «Воронкой продаж»: последняя берёт дедуплицированные канальные итоги OZON, а тут - сумма per-SKU (одна сессия на нескольких карточках считается несколько раз).` : ` Итоги этой таблицы сходятся с «Воронкой продаж» шаг в шаг: показы, поиск и карточка берутся из одного отчёта показов, а заказы, выкуп, возвраты и отмены - из одной выгрузки заказов. До 17.09 не сходились по двум причинам, обе починены: таблица складывала дневные строки отчёта с агрегатом за 31.08-06.09 и считала неделю дважды (386 868 показов против 703 468 на экране), а заказы и выкуп брала из отчёта показов, где отмены и доставки нули - отсюда «выкуплено = заказано» и конверсия ровно 100%.`}</div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Категория / подкатегория</th><th class="r">Показы всего</th>${IS_OZON ? `<th class="r cf-cv">CV, %</th><th class="r">Показы в поиске</th>` : ``}<th class="r cf-cv">CV, %</th><th class="r">Посещения карточки</th><th class="r cf-cv">CV, %</th><th class="r">В корзину</th><th class="r cf-cv">CV, %</th><th class="r">Заказано</th><th class="r cf-cv">CV, %</th><th class="r" title="${IS_OZON ? "Выкуплено = Заказано − Отмены (формула OZON; возврат происходит после выкупа, отдельно)" : "Выкуплено = реально доставленное за вычетом возвратов, по дате заказа. Заказы периода, которые ещё едут, сюда не попадают - они дорастут задним числом, когда доедут."}">Выкуплено</th></tr></thead><tbody id="catfun"></tbody></table></div></section>
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
  const cats=Object.keys(CF).map(c=>{const o=CF[c];return {c,views:sm(o,'views'),vsearch:sm(o,'vsearch'),pdp:sm(o,'pdp'),cart:sm(o,'cart'),units:sm(o,'units'),deliv:sm(o,'deliv'),ret:sm(o,'ret'),canc:sm(o,'canc')};}).filter(x=>${CAT_KEEP}).sort((a,b)=>b.units-a.units);
  const ndc='<td class="r cf-nd">нет данных</td>'; // для старых дней без vsearch/pdp в sku_views
  // Канальный бенчмарк конверсии по каждому шагу (сумма по всем категориям периода).
  // Цвет CV: зелёный - категория конвертит выше канала на этом шаге, красный - ниже.
  const T={};['views','vsearch','pdp','cart','units','deliv','ret','canc'].forEach(k=>T[k]=cats.reduce((s,x)=>s+(x[k]||0),0));
  const BM={vs:T.views?T.vsearch/T.views:0,pd:T.vsearch?T.pdp/T.vsearch:0,ct:T.pdp?T.cart/T.pdp:0,un:T.cart?T.units/T.cart:0,dl:T.units?${IS_OZON ? "(T.units-T.canc)" : "T.deliv"}/T.units:0};
  const cv=(a,b,bm)=>{if(a==null||b==null||b<=0)return '<td class="r cf-cv">—</td>';const r=a/b;const col=(bm&&bm>0)?(r>=bm?'var(--up)':'var(--dn)'):'var(--ink-3)';return '<td class="r cf-cv" style="color:'+col+'">'+(r*100).toFixed(2)+'%</td>';};
  const cell=x=>{const vs=x.vsearch>0?x.vsearch:null,pd=x.pdp>0?x.pdp:null;
    return '<td class="r">'+fmtRu(x.views)+'</td>'+${IS_OZON
      ? "cv(vs,x.views,BM.vs)+(vs!=null?'<td class=\"r\">'+fmtRu(vs)+'</td>':ndc)+cv(pd,vs,BM.pd)"
      : "cv(pd,x.views,BM.pd)"}
      +(pd!=null?'<td class="r">'+fmtRu(pd)+'</td>':ndc)+cv(x.cart,pd,BM.ct)
      +'<td class="r">'+fmtRu(x.cart)+'</td>'+cv(x.units,x.cart,BM.un)
      +'<td class="r">'+fmtRu(x.units)+'</td>'+cv(${IS_OZON ? "Math.max(0,x.units-(x.canc||0))" : "x.deliv"},x.units,BM.dl)
      +'<td class="r">'+fmtRu(${IS_OZON ? "Math.max(0,x.units-(x.canc||0))" : "x.deliv"})+'</td>';};
  let h='';
  cats.forEach((x,ci)=>{
    h+='<tr class="cf-cat" data-i="'+ci+'"><td>▸ '+esc(x.c)+'</td>'+cell(x)+'</tr>';
    (CS[x.c]||[]).forEach(sid=>{const o=SF[sid];if(!o)return;const s={views:sm(o,'views'),vsearch:sm(o,'vsearch'),pdp:sm(o,'pdp'),cart:sm(o,'cart'),units:sm(o,'units'),deliv:sm(o,'deliv'),ret:sm(o,'ret'),canc:sm(o,'canc')};if(s.units<=0&&s.cart<=0)return;
      h+='<tr class="cf-sub" data-p="'+ci+'" style="display:none"><td style="padding-left:24px;color:var(--ink-3)">'+esc(o.name)+'</td>'+cell(s)+'</tr>';});
  });
  // Итоговая строка = сумма по категориям (T). CV в ней нейтральный (серый) - это и есть бенчмарк.
  const cvP=(a,b)=>'<td class="r cf-cv">'+(b>0?(a/b*100).toFixed(2)+'%':'—')+'</td>';
  const totRow='<tr class="cf-total"><td>Итого по категориям</td>'
    +'<td class="r">'+fmtRu(T.views)+'</td>'+${IS_OZON
      ? "cvP(T.vsearch,T.views)+'<td class=\"r\">'+fmtRu(T.vsearch)+'</td>'+cvP(T.pdp,T.vsearch)"
      : "cvP(T.pdp,T.views)"}
    +'<td class="r">'+fmtRu(T.pdp)+'</td>'+cvP(T.cart,T.pdp)
    +'<td class="r">'+fmtRu(T.cart)+'</td>'+cvP(T.units,T.cart)
    +'<td class="r">'+fmtRu(T.units)+'</td>'+cvP(${IS_OZON ? "Math.max(0,T.units-T.canc)" : "T.deliv"},T.units)
    +'<td class="r">'+fmtRu(${IS_OZON ? "Math.max(0,T.units-T.canc)" : "T.deliv"})+'</td></tr>';
  document.getElementById('catfun').innerHTML=h?(totRow+h):'<tr><td colspan="12" class="kt-note">нет данных за период</td></tr>';
  document.querySelectorAll('#catfun .cf-cat').forEach(tr=>tr.onclick=function(){var i=tr.getAttribute('data-i');var open=false;document.querySelectorAll('#catfun .cf-sub[data-p="'+i+'"]').forEach(function(s){s.style.display=s.style.display==='none'?'':'none';open=s.style.display!=='none';});tr.querySelector('td').textContent=(open?'▾ ':'▸ ')+tr.querySelector('td').textContent.replace(/^[▸▾]\\s*/,'');});
}
function render(cur,cmp){
  const S=k=>sumW(D[k],cur),P=k=>sumW(D[k],cmp);
  ${FUN_REV_LINE}
  const kpi=(lab,val,d)=>'<div class="card"><div class="kt-k">'+lab+'</div><div class="kt-v">'+val+'</div>'+d+'</div>';
  const cr=(a,b)=>b?((a/b*100).toFixed(2)+'%'):'0%';
  document.getElementById('kpis').innerHTML=[
    kpi('Оборот, ₽',fMln(rev),dlt(rev,prev)),
    ${FUN_UNITS_KPI},
    kpi('Показы',fMln(S('views')),dlt(S('views'),P('views'))),
    kpi('Конверсия показ→заказ',${IS_OZON ? "cr(S('units'),S('views'))" : "cr(S('units')-S('canc'),S('views'))"},dlt(${CONV_DELTA})),
    kpi('Возвраты',fmtRu(S('ret')),dlt(S('ret'),P('ret'),false,'шт')),
    kpi('Отмены',fmtRu(S('canc')),dlt(S('canc'),P('canc'),false,'шт'))
  ].join('');
  document.getElementById('fsub').textContent='период '+cur.from+'..'+cur.to+' · сравнение с '+cmp.from+'..'+cmp.to${FSUB_TAIL};
  renderCatFunnel(cur);
  // Вертикальная воронка OZON, сужается вниз, конверсия между шагами (зависит от периода).
  // «Показы в поиске» (vsearch) и «Посещения карточки» (pdp) тянем день-уровнем OZON (dimension=day).
  // Если за период их нет (старые дни до правки workflow) -> null -> «нет данных».
  const nz=k=>{const s=S(k);return s>0?s:null;};
  const lv=[
    {n:'Показы, всего', v:S('views'), c:'из показов в поиск'},
    ${VSEARCH_STEP}    {n:'Посещения карточки товара', v:nz('pdp'), c:'из карточки в корзину'},
    {n:'Добавления в корзину', v:S('cart'), c:'из корзины в заказ'},
    {n:'Заказано товаров', v:S('units'), c:'из заказа в выкуп'},
    ${IS_OZON
      ? `{n:'Выкуплено', v:Math.max(0,S('units')-S('canc')), c:''}`
      // Маркет: «Заказано − Отмены» - это «пока не отменили», а не выкуп. За 01-16.09 такая формула
      // давала 125 при 38 реально доставленных: остальные 85 штук ещё едут. Решение Ивана 17.09 -
      // считать по доставленному, а сколько ещё в пути, сказать подписью под воронкой.
      : `{n:'Выкуплено', v:S('deliv'), c:''}`}
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
  writeFileSync(op("katya-voronka.html"), kshell("Воронка", "voronka", body, pageJs));
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
  try { adsReports = JSON.parse(readFileSync(dp("ads_reports.json"), "utf-8")); } catch { adsReports = {}; }
  // Объединённые карточки (карта из Google-таблицы): sku -> {модель, состав др. SKU}.
  // Состыковка кампания -> карточка: в развороте показываем состав карточки (факт),
  // ad-attributed дробление не выдумываем (его в прямом API нет).
  let cardBySku: Record<string, { model: string; others: Array<{ sku: string; offer: string }> }> = {};
  try {
    const cg = JSON.parse(readFileSync(dp("card_groups.json"), "utf-8"));
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
  try { adsDaily = readFileSync(dp("ads_daily.ndjson"), "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { adsDaily = []; }
  // Дневной ряд per-SKU атрибуции (основная/объединённая), индекс по кампании -> точная разбивка за любой период.
  let adsAttrByCamp: Record<string, any[]> = {};
  try { for (const l of readFileSync(dp("ads_attr_daily.ndjson"), "utf-8").trim().split("\n").filter(Boolean)) { const r = JSON.parse(l); (adsAttrByCamp[String(r.id)] || (adsAttrByCamp[String(r.id)] = [])).push({ d: r.d, sku: String(r.sku), nm: r.nm, sp: r.sp, sold: r.sold, om: r.om, soldM: r.soldM, omM: r.omM }); } } catch { adsAttrByCamp = {}; }
  // Второй per-SKU источник по кампаниям: ads_sku_daily (накопительный коллектор ad-sku-daily.ts,
  // те же attribution-отчёты, но своё окно). Фолбэк для кампаний, которых нет в ads_attr_daily.
  // Строка {d,cid,sku,sp,om}; единиц (sold) в нём нет. CPO «Оплата за заказ» здесь тоже нет -
  // OZON не отдаёт атрибуцию по SKU для них.
  const adsSkuByCamp: Record<string, any[]> = {};
  try { for (const l of readFileSync(dp("ads_sku_daily.ndjson"), "utf-8").trim().split("\n").filter(Boolean)) { const r = JSON.parse(l); (adsSkuByCamp[String(r.cid)] || (adsSkuByCamp[String(r.cid)] = [])).push({ d: r.d, sku: String(r.sku), sp: r.sp, om: r.om, ca: r.ca }); } } catch { /* нет файла - пропуск */ }
  const campMeta: Record<string, { off: string; line: string; instr: string; place: string; status: string }> = {};
  const addMeta = (list: any[]) => (list || []).forEach((c: any) => { if (c && c.id && !campMeta[String(c.id)]) campMeta[String(c.id)] = { off: c.off || "", line: c.line || "прочее", instr: c.instr || "", place: c.place || "-", status: c.status || "" }; });
  // База: полная мета ВСЕХ кампаний из снимка (ads_30d.camp_meta) - чтобы хвостовые/закрытые
  // кампании (их нет в top_spend/burners) тоже показывали инструмент и статус, а не прочерк.
  const cm = (adsSnap && adsSnap.camp_meta) || {};
  for (const id in cm) { const m = cm[id]; campMeta[String(id)] = { off: m.off || "", line: m.line || "прочее", instr: m.instr || "", place: m.place || "-", status: m.status || "" }; }
  addMeta(adsSnap.top_spend); addMeta(adsSnap.burners);
  for (const k of ["p7", "p30", "p90"]) { addMeta((adsPeriods[k] || {}).top_spend); addMeta((adsPeriods[k] || {}).burners); }
  const live = JSON.parse(readFileSync(dp("skus_live_30d.json"), "utf-8"));
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
  const econCogs: Record<string, number> = JSON.parse(readFileSync(dp("sku_cogs.json"), "utf-8"));
  let econPnl: Record<string, any> = {};
  try { econPnl = JSON.parse(readFileSync(dp("pnl_sku_30d.json"), "utf-8")).bySku || {}; } catch { econPnl = {}; }
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
  <section class="card"><div class="card-h"><div><div class="card-title">Кампании: расход и статистика</div><div class="card-sub" id="src1"></div></div><div style="display:flex;align-items:center;gap:14px;font-size:12px;color:var(--ink-2);white-space:nowrap">Статус:<label style="cursor:pointer;display:inline-flex;align-items:center;gap:4px"><input type="checkbox" id="top-fa" checked onchange="renderTop()"> активные</label><label style="cursor:pointer;display:inline-flex;align-items:center;gap:4px"><input type="checkbox" id="top-fi" checked onchange="renderTop()"> неактивные</label></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Кампания</th><th>Инструмент</th><th>Место размещения</th><th class="r">Расход</th><th class="r">Выручка</th><th class="r">Заказы</th><th class="r">ДРР</th><th class="r" title="Показы за выбранный период (OZON Performance).">Показы</th><th class="r" title="Клики за период (OZON Performance).">Клики</th><th class="r" title="Рекламные добавления в корзину за период - из детального отчёта продвижения OZON (per-SKU, суммируется в кампанию). «—» - по кампании отчёт ещё не собран или это CPO.">В корзину</th><th class="r" title="CTR = Клики ÷ Показы × 100.">CTR</th><th class="r" title="Средняя стоимость клика = Расход ÷ Клики.">Ср. цена клика</th></tr></thead><tbody id="top"></tbody></table></div></section>
  <section class="card"><div class="card-h"><div><div class="card-title">Юнит-экономика рекламы</div><div class="card-sub">Экономика кампании за выбранный период. Ставка сборов OZON и с/с единицы - средневзвешенно по SKU кампании из реальной атрибуции OZON (веса - выручка/заказы по SKU за период), применяются к полной выручке/заказам кампании (OZON Performance). Где атрибуции по SKU нет (CPO/не собрано) - по основному SKU. «Выручка кампании» - полная выручка РК; «Выручка осн. карт.» - выручка только продвигаемой (основной) карточки за период. С/с произв. - производственная себестоимость (нет данных - «—» / причина в строке).</div></div><div style="display:flex;align-items:center;gap:14px;font-size:12px;color:var(--ink-2);white-space:nowrap">Статус:<label style="cursor:pointer;display:inline-flex;align-items:center;gap:4px"><input type="checkbox" id="ue-fa" checked onchange="renderUecon(lastA)"> активные</label><label style="cursor:pointer;display:inline-flex;align-items:center;gap:4px"><input type="checkbox" id="ue-fi" checked onchange="renderUecon(lastA)"> неактивные</label></div></div><div class="kt-kpi" id="uecon-kpi" style="margin-bottom:10px"></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Кампания / SKU</th><th class="r" title="Расход кампании на рекламу за выбранный период. Источник: OZON Performance.">Расход</th><th class="r" title="Полная выручка кампании за период. Источник: OZON Performance.">Выручка кампании</th><th class="r" title="Выручка только основной (продвигаемой) карточки за период - атрибуция осн. SKU. Нет атрибуции - равна выручке кампании.">Выручка осн. карт.</th><th class="r" title="Заказано штук в рамках кампании за выбранный период (OZON Performance).">Заказано, шт</th><th class="r" title="ДРР = Расход ÷ Выручка кампании × 100.">ДРР</th><th class="r" title="Ср. цена за период = Выручка кампании ÷ заказы.">Ср. цена</th><th class="r" title="Комиссия = Выручка кампании × средневзвешенную ставку сборов OZON.">Комис., ₽</th><th class="r" style="color:var(--ink-3)" title="Средневзвешенная ставка всех сборов OZON по SKU кампании (веса - выручка по SKU). ⚖ - взвешено по атрибуции; иначе - по осн. SKU.">Комис., %</th><th class="r" title="Производственная себестоимость = средневзвешенная с/с единицы × заказы кампании. Нет данных - «—» / причина в строке.">С/с произв., ₽</th><th class="r" title="Прибыль ДО рекламы = Выручка кампании − сборы OZON − себестоимость.">Приб. до рекл., ₽</th><th class="r" title="Прибыль ПОСЛЕ рекламы = Приб. до рекл. − расход на рекламу.">Приб. после рекл., ₽</th></tr></thead><tbody id="uecon"></tbody></table></div></section>
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
const SNAP=${J(adsSnap)};const PRICE=${J(PRICE)};const PERIODS=${J(adsPeriods)};const RCACHE=${J(adsReports)};const SKU_MAP=${J(skuMap)};const SKU_CAT=${J(skuCat)};const ECON=${J(SKU_ECON)};const PRICE_LIVE=${J(priceLive)};const SKUS_BY_CAMP=${J(skuByCamp)};const CARDG=${J(cardBySku)};const ADS_DAILY=${J(adsDaily)};const ATTR_DAILY=${J(adsAttrByCamp)};const ADS_SKU_CAMP=${J(adsSkuByCamp)};const CAMP_META=${J(campMeta)};const CAMP_CARD=${J(campCard)};
// Per-SKU «Основная карточка» за период из кампании (без снимка RCACHE): SKU кампании + её
// суммы за выбранное окно (они уже точные из aggFromDaily). Синхронно, без async-загрузки.
function cardRep(c){var cd=CAMP_CARD[String(c.id)];return cd?[{sku:cd.sku,name:cd.name,sp:c.sp||0,om:c.om||0,sold:c.o||0,omModel:0,soldModel:0}]:[];}
// Фаза 1b: агрегат рекламы за ПРОИЗВОЛЬНЫЙ период из дневного ряда (как продажи из history).
// Форма 1:1 со снимком (totals/top_spend/burners/by_line), чтобы paint/renderTop/renderBurn не менять.
function aggFromDaily(from,to){
  var m={};
  for(var i=0;i<ADS_DAILY.length;i++){var r=ADS_DAILY[i];if(r.d<from||r.d>to)continue;var a=m[r.id]||(m[r.id]={id:r.id,off:r.off,sp:0,o:0,om:0,vw:0,cl:0,ca:0});a.sp+=r.sp;a.o+=r.o;a.om+=r.om;a.vw+=(r.vw||0);a.cl+=(r.cl||0);a.ca+=(r.ca||0);}
  var list=Object.keys(m).map(function(k){var c=m[k];var meta=CAMP_META[k]||{};var sp=Math.round(c.sp),om=Math.round(c.om);
    return {id:c.id,off:meta.off||c.off,line:meta.line||'прочее',instr:meta.instr||'',place:meta.place||'-',status:meta.status||'',sp:sp,o:c.o,om:om,vw:c.vw,cl:c.cl,ca:c.ca,ctr:c.vw?Math.round(c.cl/c.vw*1000)/10:null,cpc:c.cl?Math.round(sp/c.cl):null,drr:om?Math.round(sp/om*1000)/10:0,cpo:c.o?Math.round(sp/c.o):0,roas:sp?Math.round(om/sp*10)/10:0};});
  var spend=0,om=0,orders=0,active=0;list.forEach(function(c){spend+=c.sp;om+=c.om;orders+=c.o;if(c.sp>0)active++;});
  var totals={spend:spend,adRevenue:om,orders:orders,drr:om?Math.round(spend/om*1000)/10:0,cpo:orders?Math.round(spend/orders):0,active:active,campaigns:list.length};
  var top_spend=list.slice().sort(function(x,y){return y.sp-x.sp;}).slice(0,10);
  var all=list.slice().sort(function(x,y){return y.sp-x.sp;}); // все РК за период (для юнит-экономики)
  var burners=list.filter(function(c){return !isCPO(c)&&c.sp>=3000&&(c.o===0||c.drr>=40);}).sort(function(x,y){return y.sp-x.sp;}).slice(0,8);
  var lm={};list.forEach(function(c){var g=lm[c.line]||(lm[c.line]={line:c.line,sp:0,om:0});g.sp+=c.sp;g.om+=c.om;});
  var by_line=Object.keys(lm).map(function(k){var g=lm[k];return {line:k,sp:g.sp,om:g.om,drr:g.om?Math.round(g.sp/g.om*1000)/10:0};}).sort(function(x,y){return y.sp-x.sp;});
  return {dateFrom:from,dateTo:to,totals:totals,top_spend:top_spend,all:all,burners:burners,by_line:by_line,daily:true};
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
// Фолбэк per-SKU из ads_sku_daily (мой коллектор). Единиц (sold) в нём нет -> sold:null (показываем «—»).
function attrForSku(id){var arr=ADS_SKU_CAMP[String(id)];if(!arr||!arr.length)return null;var pd=periodDates(CURP);var by={},any=false;
  for(var i=0;i<arr.length;i++){var r=arr[i];if(r.d<pd.from||r.d>pd.to)continue;any=true;var o=by[r.sku]||(by[r.sku]={sku:r.sku,name:SKU_MAP[r.sku]||'',sp:0,sold:null,om:0,soldModel:0,omModel:0,drr:0});o.sp+=r.sp||0;o.om+=r.om||0;}
  if(!any)return null;var out=[];for(var k in by){var o=by[k];o.drr=o.om?Math.round(o.sp/o.om*1000)/10:0;out.push(o);}return out;}
// разбивка: точный дневной ряд (ads_attr) > снимок RCACHE > мой ads_sku (фолбэк). {rows, exact, from, to}
function repInfo(id){var a=attrFor(id);if(a){var pd=periodDates(CURP);return {rows:a,exact:true,from:pd.from,to:pd.to};}var c=cacheStats(id);if(c!==null){var w=repWin(id);return {rows:c,exact:false,from:w?w.from:'',to:w?w.to:''};}var b=attrForSku(id);if(b){var pd2=periodDates(CURP);return {rows:b,exact:true,from:pd2.from,to:pd2.to};}return null;}
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
// «Добавления в корзину» по кампании: суммируем per-SKU из отчёта продвижения (ADS_SKU_CAMP)
// за период. Реальные рекламные добавления в корзину. Есть только по собранным кампаниям (не CPO).
function cartOf(cid){var arr=ADS_SKU_CAMP[String(cid)];if(!arr||!arr.length)return null;var pd=periodDates(CURP);var s=0,any=false;for(var i=0;i<arr.length;i++){var r=arr[i];if(r.d<pd.from||r.d>pd.to)continue;if(r.ca!=null){s+=r.ca;any=true;}}return any?s:null;}
function renderTop(){var a=lastA;if(!a)return;
  // Фильтр по статусу (множественный выбор) + ВСЕ РК за период.
  var _fa=document.getElementById('top-fa'),_fi=document.getElementById('top-fi');
  var _sa=_fa?_fa.checked:true,_si=_fi?_fi.checked:true;
  var list=(a.all||a.top_spend||[]).filter(function(c){var ac=(c.status==='активна');return (ac&&_sa)||(!ac&&_si);});
  var html=list.map(function(c,ci){
    var ri=repInfo(c.id);var rep=ri?ri.rows:[];var loaded=ri!==null;var open=!!expanded[ci];var disp=open?'':'display:none';
    var cart=cartOf(c.id); // добавления в корзину из отчёта продвижения (per-SKU -> кампания)
    var st='<td class="r">'+(c.vw==null?'—':fmtRu(c.vw))+'</td><td class="r">'+(c.cl==null?'—':fmtRu(c.cl))+'</td><td class="r" title="рекламные добавления в корзину из отчёта продвижения; «—» если по кампании отчёт ещё не собран (или CPO)">'+(cart==null?'—':fmtRu(cart))+'</td><td class="r">'+(c.ctr==null?'—':(c.ctr+'%'))+'</td><td class="r">'+(c.cpc==null?'—':fmtRu(c.cpc))+'</td>';
    var main='<tr class="ad-exp" data-i="'+ci+'" data-id="'+(c.id||'')+'"><td><span class="cf-tg">'+(open?'▾ ':'▸ ')+'</span><b>'+(c.id||c.off||'-')+'</b>'+stBadge(c.status)+'</td><td style="font-size:12px">'+iLabel(c.instr)+'</td><td style="color:var(--ink-3);font-size:12px">'+(c.place||'-')+'</td><td class="r">'+fmtRu(c.sp)+'</td><td class="r">'+(isCPO(c)?CPO_NA:fmtRu(c.om||0))+'</td><td class="r">'+(isCPO(c)?CPO_NA:c.o)+'</td><td class="r" style="color:'+(isCPO(c)?'var(--ink-3)':drrCol(c.drr))+'">'+(isCPO(c)?CPO_NA:(c.drr+'%'))+'</td>'+st+'</tr>';
    var sub='';
    if(loaded&&rep.length){
      var _osp=0,_oom=0,_oso=0;rep.forEach(function(s){_osp+=s.sp||0;_oom+=s.om||0;_oso+=s.sold||0;});
      rep.forEach(function(s){var art=SKU_MAP[s.sku]||s.sku;var dr=s.om?Math.round(s.sp/s.om*1000)/10:0;
        sub+='<tr class="ad-sub" data-i="'+ci+'" style="'+disp+'"><td style="padding-left:26px" title="'+String(s.name||'').replace(/"/g,'&quot;')+'">Основная карточка <span style="color:var(--ink-3)">'+art+'</span></td><td style="color:var(--ink-3);font-size:11px">'+iLabel(c.instr)+'</td><td style="color:var(--ink-3);font-size:11px">'+(c.place||'-')+'</td><td class="r">'+fmtRu(s.sp)+'</td><td class="r">'+fmtRu(s.om)+'</td><td class="r">'+(s.sold==null?'—':(s.sold||0))+'</td><td class="r" style="color:'+drrCol(dr)+'">'+dr+'%</td><td></td><td></td><td></td><td></td><td></td></tr>';});
      // Остаток кампании, который отчёт продвижения не разнёс по SKU (другой отчёт, чем статистика
      // кампании). Основные + этот остаток = итог кампании - чтобы расход/выручка/заказы сходились.
      if(!isCPO(c)){var rsp=Math.round((c.sp||0)-_osp),rom=Math.round((c.om||0)-_oom),ro=(c.o||0)-_oso;
        if(rsp>1||rom>1||ro>0){sub+='<tr class="ad-sub" data-i="'+ci+'" style="'+disp+'"><td style="padding-left:26px;color:var(--ink-3)" title="Часть расхода/выручки/заказов кампании, которую отчёт продвижения OZON не распределил по конкретным SKU. Основные + эта строка = итог кампании.">Атрибуцией не распределено</td><td></td><td></td><td class="r" style="color:var(--ink-3)">'+fmtRu(rsp)+'</td><td class="r" style="color:var(--ink-3)">'+fmtRu(rom)+'</td><td class="r" style="color:var(--ink-3)">'+ro+'</td><td class="r">—</td><td></td><td></td><td></td><td></td><td></td></tr>';}}
    } else {var naTxt=isCPO(c)?'разбивка по SKU недоступна: OZON не отдаёт атрибуцию по SKU для кампаний «Оплата за заказ» (CPO) - расход реальный, но по каким SKU, API не сообщает':'разбивка по SKU недоступна (каталожная кампания или ещё не собрана в отчёте продвижения)';sub='<tr class="ad-sub" data-i="'+ci+'" style="'+disp+'"><td colspan="12" style="padding-left:26px;color:var(--ink-3);font-size:12px">'+naTxt+'</td></tr>';}
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
        sub+='<tr class="bn-sub" data-bi="'+bi+'" style="'+disp+'"><td style="padding-left:24px">Основная карточка <span style="color:var(--ink-3)">'+(SKU_MAP[s.sku]||s.sku)+'</span></td><td class="r">'+fmtRu(s.sp)+'</td><td class="r">'+fmtRu(s.om)+'</td><td class="r">'+(s.sold==null?'—':(s.sold||0))+'</td><td class="r"></td></tr>';});
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
  // Фильтр по статусу (множественный выбор активна/неактивна). По умолчанию - оба.
  var _fa=document.getElementById('ue-fa'),_fi=document.getElementById('ue-fi');
  var showA=_fa?_fa.checked:true, showI=_fi?_fi.checked:true;
  (a.all||a.top_spend||[]).forEach(function(c){ // ВСЕ РК за период
    var sku=campSku(c);if(!sku)return;
    var isAct=(c.status==='активна');if((isAct&&!showA)||(!isAct&&!showI))return; // фильтр статуса
    total++;
    var art=c.off||SKU_MAP[sku]||sku;var e=ECON[sku];var sp=c.sp||0,om=c.om||0,drr=c.drr||0,ordC=c.o||0; // артикул = название кампании (оффер промо-SKU)
    if(!e||e.be==null){naSp+=sp;rows.push({camp:c.id,art:art,status:c.status,sp:sp,om:om,drr:drr,ord:ordC,na:true,why:e?(e.why||'нет данных'):'нет продаж за период'});return;}
    // Средневзвешенно по SKU кампании из РЕАЛЬНОЙ атрибуции (выручка/заказы per-SKU из отчёта
    // продвижения): эфф. ставка сборов = Σ(выручка_sku×ставка_sku)/Σвыручка_sku; с/с ед. =
    // Σ(с/с_sku×заказы_sku)/Σзаказы_sku. Веса реальные, применяются к ПОЛНЫМ итогам кампании
    // (выручка/заказы Performance). omMain = выручка ОСНОВНОЙ карточки (атрибуция осн. SKU) - отд.
    // столбец. Нет атрибуции (CPO/не собрано) - ставка/с/с по осн. SKU, omMain = выручка кампании.
    var com=e.com, cu=e.cogsRub, wSrc='по осн. SKU (нет атрибуции по SKU)';
    var omMain=null, omMainSrc='';
    var _ar=attrFor(c.id)||[];
    if(_ar.length){var sOm=0,sOmR=0,sSold=0,sSoldC=0;
      _ar.forEach(function(s){var es=ECON[String(s.sku)];
        if(es&&s.om>0&&es.com!=null){sOm+=s.om;sOmR+=s.om*es.com;}
        if(es&&s.sold!=null&&s.sold>0&&es.cogsRub!=null){sSold+=s.sold;sSoldC+=s.sold*es.cogsRub;}
        if(String(s.sku)===String(sku)){omMain=Math.round(s.om||0);omMainSrc='атрибуция осн. SKU за период';}});
      if(sOm>0){com=Math.round(sOmR/sOm*10)/10;wSrc='средневзвешенно по SKU из атрибуции OZON';}
      if(sSold>0){cu=Math.round(sSoldC/sSold);}}
    if(omMain==null){omMain=om;omMainSrc='= выручка кампании (нет атрибуции осн. SKU)';}
    var ord=c.o||0; // заказы кампании за период
    var price=ord>0?Math.round(om/ord):null; // ср цена = выручка кампании ÷ заказы
    var comRub=Math.round(om*com/100); // комиссия = выручка кампании × взвеш. ставка
    var cogsRub=(cu!=null&&ord>0)?cu*ord:null; // с/с = взвеш. с/с единицы × заказы кампании
    var cogsPct=(cogsRub!=null&&om>0)?Math.round(cogsRub/om*1000)/10:e.cogs;
    var be=Math.round((100-com-cogsPct)*10)/10;
    var head=Math.round((be-drr)*10)/10;var gt=Math.max(0,Math.round(be*0.3*10)/10);
    var v=head>=gt?'go':(head>=0?'edge':'cut');
    var profit=Math.round(om*(1-com/100)-(cogsRub||0)); // прибыль до рекламы = выручка − сборы − с/с
    var profitAds=profit-sp;
    rows.push({camp:c.id,art:art,status:c.status,sp:sp,om:om,omMain:omMain,omMainSrc:omMainSrc,drr:drr,ord:ord,com:com,cogs:cogsPct,price:price,comRub:comRub,cogsRub:cogsRub,profit:profit,profitAds:profitAds,be:be,head:head,v:v,wSrc:wSrc});
  });
  var el=document.getElementById('uecon');var elk=document.getElementById('uecon-kpi');if(!el)return;
  if(!total){el.innerHTML='<tr><td colspan="12" class="kt-note">нет кампаний за период под выбранный фильтр статуса</td></tr>';if(elk)elk.innerHTML='';return;}
  var calc=rows.filter(function(r){return !r.na;});
  var nGo=calc.filter(function(r){return r.v==='go';}).length,nEdge=calc.filter(function(r){return r.v==='edge';}).length,nCut=calc.filter(function(r){return r.v==='cut';}).length;
  var profit=0,burn=0;calc.forEach(function(r){var p=Math.round((r.om||0)*r.head/100);if(p>=0)profit+=p;else burn+=p;});
  var kc=function(lab,val,col){return '<div class="card"><div class="kt-k">'+lab+'</div><div class="kt-v" style="color:'+(col||'inherit')+'">'+val+'</div></div>';};
  if(elk)elk.innerHTML=kc('🟢 в плюс',nGo,'var(--up)')+kc('🟡 на грани',nEdge,'#E5B567')+kc('🔴 в минус',nCut,'var(--dn)')+kc('Потенциал зелёных, ₽',(profit>=0?'+':'')+fMln(profit),'var(--up)')+kc('Перерасход по минусовым, ₽',fMln(burn),'var(--dn)');
  rows.sort(function(x,y){if(x.na!==y.na)return x.na?1:-1;return (x.head==null?999:x.head)-(y.head==null?999:y.head);});
  var vlab={go:'🟢 жать газ',edge:'🟡 держать',cut:'🔴 резать'};var vact={go:'поднять ставку/бюджет',edge:'не масштабировать; ставка/цена',cut:'пауза/резать ставку 48ч'};
  el.innerHTML=rows.map(function(r){
    var act=r.status==='активна';var rowS=act?' style="border-left:3px solid #34D399"':'';
    var nm='<td'+(act?' style="border-left:3px solid #34D399"':'')+'>'+r.camp+stBadge(r.status)+' <span style="color:var(--ink-3)">'+r.art+'</span></td>';
    if(r.na)return '<tr style="opacity:.75">'+nm+'<td class="r">'+fmtRu(r.sp)+'</td><td class="r">'+(r.om?fmtRu(r.om):'—')+'</td><td class="r">—</td><td class="r">'+(r.ord?fmtRu(r.ord):'—')+'</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r" style="color:var(--dn)" title="нет продаж/себестоимости за период - расход на рекламу целиком в минус"><b>'+fmtRu(-(r.sp||0))+'</b></td></tr>';
    var hc=r.head>=7?'var(--up)':(r.head>=0?'#E5B567':'var(--dn)');
    var bec=r.be<0?'<span style="color:var(--dn)">убыток до рекл.</span>':'<b>'+r.be+'%</b>'; // FENIX N1: be<0 словом, не сырым %
    return '<tr>'+nm+'<td class="r">'+fmtRu(r.sp)+'</td><td class="r" title="полная выручка кампании (OZON Performance)">'+fmtRu(r.om)+'</td><td class="r" style="color:var(--ink-2)" title="выручка основной карточки: '+(r.omMainSrc||'')+'">'+(r.omMain==null?'—':fmtRu(r.omMain))+'</td><td class="r">'+(r.ord?fmtRu(r.ord):'—')+'</td><td class="r">'+(r.drr||0)+'%</td><td class="r">'+(r.price==null?'—':fmtRu(r.price))+'</td><td class="r">'+(r.comRub==null?'—':fmtRu(r.comRub))+'</td><td class="r" style="color:var(--ink-3)" title="ставка сборов: '+(r.wSrc||'')+'">'+r.com+'%'+(/взвешенно/.test(r.wSrc||'')?' <span style="color:#22D3EE" title="средневзвешенно по SKU из атрибуции OZON">⚖</span>':'')+'</td><td class="r">'+(r.cogsRub==null?'—':fmtRu(r.cogsRub))+'</td><td class="r" style="color:'+(r.profit>=0?'var(--up)':'var(--dn)')+'">'+(r.profit==null?'—':fmtRu(r.profit))+'</td><td class="r" style="color:'+(r.v==='edge'?'#E5B567':(r.profitAds>=0?'var(--up)':'var(--dn)'))+'" title="'+(r.profitAds>=0?'в плюс после рекламы':'в минус после рекламы')+(r.v==='edge'?' · на грани безубытка по ДРР':'')+'"><b>'+(r.profitAds==null?'—':fmtRu(r.profitAds))+'</b></td></tr>';
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
  // У Маркета лист рекламы собирается заново: модель площадки другая, лист OZON туда не
  // переносится. Кампаний, ставок и кликов у Маркета нет, поэтому нет и юнит-экономики клика,
  // сливов бюджета и «активных кампаний» - показывать их нулями значило бы врать про канал.
  if (IS_OZON) writeFileSync(op("katya-marketing.html"), kshell("Маркетинг и реклама", "marketing", body, pageJs));
  else { const p = promoYm(); writeFileSync(op("katya-marketing.html"), kshell("Продвижение", "marketing", p.body, p.js)); }
}

// --- страница 5: Деньги (ЖИВЫЕ P&L-вебхуки по периоду, fallback - снимок) ---
{
  const pnlSnap = JSON.parse(readFileSync(dp("pnl_30d.json"), "utf-8"));
  // Фаза 2b: дневной ряд P&L канала (pnl_daily.ndjson) - агрегат за ЛЮБОЙ период.
  let pnlDaily: any[] = [];
  try { pnlDaily = readFileSync(dp("pnl_daily.ndjson"), "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { pnlDaily = []; }
  const skuNames: Record<string, string> = {};
  for (const sk of allSkus) skuNames[sk] = (skuName[sk] || sk).slice(0, 70);

  // === данные раздела «Аналитика по SKU» (за выбранный период) ===
  // Продажи по SKU/день (history), реклама по SKU/день (ads_attr_daily, сумма по кампаниям),
  // финансы по SKU/день (pnl_sku_daily). Компактно {sku:[[d,...],...]}. Клиент суммирует за период.
  const anSales: Record<string, any[]> = {};
  for (const f of facts) {
    const sk = String(f.sku); if (!sk || sk === "__empty__" || sk === "0") continue;
    const rev = Math.round(f.revenue || 0), u = f.units || 0, dv = f.delivered || 0, rt = f.returns || 0, cn = f.cancellations || 0;
    if (!rev && !u && !dv && !rt && !cn) continue;
    (anSales[sk] ||= []).push([f.date, rev, u, dv, rt, cn]);
  }
  const anAdsMap: Record<string, Record<string, number[]>> = {};
  try {
    for (const l of readFileSync(dp("ads_attr_daily.ndjson"), "utf-8").trim().split("\n").filter(Boolean)) {
      const r = JSON.parse(l); const sk = String(r.sku); if (!sk) continue;
      const dm = (anAdsMap[sk] ||= {}); const a = dm[r.d] || (dm[r.d] = [0, 0, 0, 0, 0]);
      a[0]! += r.sp || 0; a[1]! += r.sold || 0; a[2]! += r.om || 0; a[3]! += r.soldM || 0; a[4]! += r.omM || 0;
    }
  } catch { /* нет файла - реклама по SKU пустая */ }
  const anAds: Record<string, any[]> = {};
  for (const sk in anAdsMap) { anAds[sk] = []; for (const d in anAdsMap[sk]) { const a = anAdsMap[sk]![d]!; anAds[sk]!.push([d, Math.round(a[0]!), a[1], Math.round(a[2]!), a[3], Math.round(a[4]!)]); } }
  const anFin: Record<string, any[]> = {};
  try {
    for (const l of readFileSync(dp("pnl_sku_daily.ndjson"), "utf-8").trim().split("\n").filter(Boolean)) {
      const r = JSON.parse(l); const sk = String(r.sku);
      // Софинансирование скидок идёт ОТДЕЛЬНОЙ ногой, не сливается в «Прочие»: на Маркете это
      // крупнейшая статья расходов канала, и в общей куче она нечитаема.
      // Индексы ряда: 0 дата, 1 начислено, 2 комиссия, 3 доставка, 4 приём/перевод платежа,
      // 5 хранение, 6 прочее, 7 к выплате, 8 софинансирование скидок, 9 буст продаж.
      // Софинансирование и буст раньше сидели в «прочем» одним комом: на Маркете это две
      // крупнейшие статьи (за 30 дней 4 505 686 ₽ и 119 411 ₽ против нуля прочего).
      (anFin[sk] ||= []).push([r.d, r.accruals, r.commission, r.delivery, r.acquiring, r.storage, r.otherSvc || 0, r.amount, r.cofin || 0, r.promo || 0]);
    }
  } catch { /* нет файла - финансы по SKU пустые */ }
  // Артикул (offer_id) не всегда есть в таксономии - добираем из каталожного маппинга (sku_offer,
  // накопительный снимок /product/info/stocks по всему каталогу), живого снимка и card_groups,
  // иначе в подписи оставался бы числовой SKU (внутренний ID OZON) вместо артикула.
  const offerAlt: Record<string, string> = {};
  try {
    const cat = JSON.parse(readFileSync(dp("sku_offer.json"), "utf-8")); // {sku: offer}
    for (const sk in cat) { if (cat[sk]) offerAlt[String(sk)] ||= String(cat[sk]); }
  } catch { /* нет sku_offer - соберётся ночным offer:sku */ }
  for (const s of (live.sku_table || [])) { if (s.sku != null && s.offer) offerAlt[String(s.sku)] ||= String(s.offer); }
  try {
    const cg = JSON.parse(readFileSync(dp("card_groups.json"), "utf-8"));
    for (const g of (cg.groups || cg)) for (const x of (g.skus || [])) { if (x.sku != null && x.offer) offerAlt[String(x.sku)] ||= String(x.offer); }
  } catch { /* нет card_groups - пропуск */ }
  // Артикул из УПД-отчёта о реализации (data/upd_sku_offer.json): у части SKU каталожный снимок
  // артикул не отдал, и в подписи стоял числовой SKU, а доставка по артикулу не сшивалась с такой
  // строкой. УПД - источник правды по связке SKU<->артикул: заполняем пробелы (не переопределяем
  // уже известный код).
  try {
    const upd = JSON.parse(readFileSync(dp("upd_sku_offer.json"), "utf-8"));
    for (const sk in upd) { if (upd[sk]) offerAlt[String(sk)] ||= String(upd[sk]); }
  } catch { /* нет upd_sku_offer - пропуск */ }
  // Гомоглифы кириллицы в коде артикула -> латиница (GGTP-20-3х2 -> GGTP-20-3x2), чтобы совпадало
  // с таксономией и ведомостью доставки. Реальные коды - латиница+цифры, кириллица там опечатка.
  const HOMO: Record<string, string> = { "А": "A", "В": "B", "С": "C", "Е": "E", "Н": "H", "К": "K", "М": "M", "О": "O", "Р": "P", "Т": "T", "Х": "X", "У": "Y", "а": "a", "в": "b", "с": "c", "е": "e", "н": "h", "к": "k", "м": "m", "о": "o", "р": "p", "т": "t", "х": "x", "у": "y" };
  const nrmOff = (s: string) => String(s).replace(/[А-Яа-я]/g, (c) => HOMO[c] ?? c);
  const offerOf = (sk: string) => nrmOff(taxOf(sk).offer || offerAlt[sk] || sk);
  const anMeta: Record<string, any> = {};
  for (const sk of new Set([...Object.keys(anSales), ...Object.keys(anAds), ...Object.keys(anFin)])) {
    anMeta[sk] = { off: offerOf(sk), nm: (skuName[sk] || sk).slice(0, 58), cat: catOf(sk) };
  }
  // Сборы уровня заказа/кабинета по дням (реклама/штрафы/realFBS/подписки/доставка от покупателя).
  const anAcct: any[] = [];
  try {
    for (const l of readFileSync(dp("pnl_account_daily.ndjson"), "utf-8").trim().split("\n").filter(Boolean)) {
      const r = JSON.parse(l); anAcct.push([r.d, r.adv || 0, r.fines || 0, r.realfbs || 0, r.badge || 0, r.delivery || 0, r.other || 0]);
    }
  } catch { /* нет файла - блок сборов уровня заказа пустой */ }
  // Последний день с данными по сборам уровня заказа (для отсечки факт/прогноз). Fallback - maxD.
  const anAcctMaxD = anAcct.length ? anAcct.map((r) => r[0]).sort().slice(-1)[0] : maxD;
  // Месячная реализация по SKU (data/realization_monthly.ndjson) -> {sku:[[ym,sold,ret],...]}.
  // Это бухгалтерская реализация (основа УПД). «Реализовано» в таблице = продано − возвраты
  // по этому отчёту за закрытые месяцы; для текущего/частичного месяца (отчёта ещё нет) -
  // фолбэк на дневной ряд (доставлено − возвраты).
  const anRealSku: Record<string, any[]> = {};
  try {
    for (const l of readFileSync(dp("realization_monthly.ndjson"), "utf-8").trim().split("\n").filter(Boolean)) {
      const r = JSON.parse(l); const sk = String(r.sku); if (!sk || sk === "0") continue;
      (anRealSku[sk] ||= []).push([r.ym, r.sold || 0, r.ret || 0]);
    }
  } catch { /* нет файла - реализация по SKU пустая */ }
  // Глобальный список месяцев, по которым ЕСТЬ отчёт о реализации (для решения «месяц закрыт
  // отчётом» на уровне месяца, а не отдельного SKU - иначе SKU без строки в отчёте ошибочно
  // добавлял бы дневные штуки поверх УПД-итога).
  const anRealYm = Array.from(new Set(([] as any[]).concat(...Object.values(anRealSku)).map((r) => r[0]))).sort();
  // План по месяцам (data/plan_monthly.json) - цели для блока «План на месяц».
  let planMonthly: any = {};
  try { planMonthly = JSON.parse(readFileSync(dp("plan_monthly.json"), "utf-8")); } catch { planMonthly = {}; }
  // Реклама по SKU (data/ads_sku_daily.ndjson) - собранная per-SKU часть (накопительно). Агрегируем
  // расход sp по (sku, день) поверх кампаний. Что собрано - разносим в колонку «Реклама»; остаток
  // (несобранные кампании) остаётся в блоке «Сборы уровня заказа». Схема строки {d,cid,sku,sp,om}.
  const anAdsSkuMap: Record<string, Record<string, number>> = {};
  try {
    for (const l of readFileSync(dp("ads_sku_daily.ndjson"), "utf-8").trim().split("\n").filter(Boolean)) {
      const r = JSON.parse(l); const sk = String(r.sku || ""); if (!sk) continue;
      (anAdsSkuMap[sk] ||= {})[r.d] = (anAdsSkuMap[sk]![r.d] || 0) + (r.sp || 0);
    }
  } catch { /* нет файла - реклама по SKU пустая, вся реклама в сборах */ }
  const anAdsSku: Record<string, any[]> = {};
  for (const sk in anAdsSkuMap) { anAdsSku[sk] = []; for (const d in anAdsSkuMap[sk]) anAdsSku[sk]!.push([d, Math.round(anAdsSkuMap[sk]![d]!)]); }
  // Реклама «Оплата за заказ» (CPO) по SKU/день из ручных выгрузок кабинета (data/cpo_sku_daily.ndjson,
  // схема {d,sku,offer,sp,n}). OZON НЕ отдаёт атрибуцию CPO по SKU через API, поэтому CPO целиком сидел
  // в «Общих расходах» (adv). Ручной per-order отчёт даёт разбивку по заказу -> разносим в колонку
  // «Реклама» по SKU и на ту же сумму уменьшаем «Общие» (adv в account_daily уже содержит этот CPO).
  // Файл есть только за ЗАКРЫТЫЕ месяцы, где отчёт снят (июнь-август 2026). Для текущего месяца файла
  // нет -> CPO по нему остаётся в «Общих», настройка не меняется (по требованию Ивана).
  const anCpoSku: Record<string, any[]> = {};
  try {
    for (const l of readFileSync(dp("cpo_sku_daily.ndjson"), "utf-8").trim().split("\n").filter(Boolean)) {
      const r = JSON.parse(l); const sk = String(r.sku || ""); if (!sk) continue;
      (anCpoSku[sk] ||= []).push([r.d, Math.round(r.sp || 0)]);
    }
  } catch { /* нет файла - CPO по SKU не разнесён, остаётся в «Общих» */ }
  // CPO-SKU, которых нет в продажах/финансах периода, тоже должны получить строку - иначе их CPO
  // не попадёт в «Реклама» и не вычтется из «Общих» (потеря разнесения, не задвоение).
  for (const sk of Object.keys(anCpoSku)) if (!anMeta[sk]) anMeta[sk] = { off: offerOf(sk), nm: (skuName[sk] || sk).slice(0, 58), cat: catOf(sk) };
  // «Наша доставка» - наш расход на отправку (счёт перевозчика ПЭК/СДЭК) по АРТИКУЛУ/день из ручной
  // ведомости (data/delivery_sku_daily.ndjson, {d,offer,ship,deliv,n}; разбор ПО НОМЕРУ ЗАКАЗА -
  // стоимость раз на заказ, мультиартикул делится поровну). OZON показывает лишь свой сбор за
  // логистику (в 4-6 раз меньше), наш реальный счёт перевозчика в дашборде не отражался - прибыль
  // была завышена. Ключ - offer (артикул), т.к. в ведомости SKU нет. Только ЗАКРЫТЫЕ месяцы
  // (генератор исключает текущий). deliv (клиент платит) в файле только для сверки, в дашборд не идёт.
  const anDeliv: Record<string, any[]> = {};      // offer -> [[d, ship], ...] (наш расход)
  const anDelivInc: Record<string, any[]> = {};   // offer -> [[d, deliv], ...] (доход: платит клиент)
  try {
    for (const l of readFileSync(dp("delivery_sku_daily.ndjson"), "utf-8").trim().split("\n").filter(Boolean)) {
      const r = JSON.parse(l); const off = String(r.offer || ""); if (!off) continue;
      (anDeliv[off] ||= []).push([r.d, Math.round(r.ship || 0)]);
      (anDelivInc[off] ||= []).push([r.d, Math.round(r.deliv || 0)]);
    }
  } catch { /* нет файла - доставка пустая */ }
  let delivCities: Record<string, any> = {};
  try { delivCities = JSON.parse(readFileSync(dp("delivery_cities.json"), "utf-8")); } catch { delivCities = {}; }

  // Свод по дате заказа - только у Маркета: у OZON закрытие месяца идёт из подписанных Актов,
  // а базис «по дате оформления заказа» там не строится. Ключ добавляется условно, чтобы страница
  // OZON осталась прежней.
  let svodJson: any = null;
  if (!IS_OZON) { try { svodJson = JSON.parse(readFileSync(dp("svod_orders.json"), "utf-8")); } catch { svodJson = null; } }
  const svodSection = IS_OZON ? "" : `
  <section class="card"><div class="card-h"><div><div class="card-title">Свод по дате заказа</div><div class="card-sub">доставлено минус отмены и возвраты &middot; все кабинеты &middot; период берётся из фильтра наверху страницы, по дате оформления заказа</div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <span id="sv-rates"><label style="color:var(--ink-2);font-size:12.5px">АДМ % <input id="sv-adm" type="number" value="30" min="0" max="100" style="width:54px;background:var(--bg-2,#12151c);color:var(--ink-1);border:1px solid var(--bd);border-radius:6px;padding:4px 6px;font:inherit"></label>
      <label style="color:var(--ink-2);font-size:12.5px;margin-left:8px">Налоги % <input id="sv-tax" type="number" value="15" min="0" max="100" style="width:54px;background:var(--bg-2,#12151c);color:var(--ink-1);border:1px solid var(--bd);border-radius:6px;padding:4px 6px;font:inherit"></label></span>
    </div></div>
    <div id="sv-cov" class="kt-note" style="padding:2px 0 8px"></div>
    <div id="sv-gaps" class="kt-note" style="display:none;margin:2px 0 8px;padding:6px 10px;border-left:3px solid #E5B567;background:rgba(229,181,103,.08)"></div>
    <div class="kt-scroll"><table class="kt-table" id="sv-t"></table></div>
    <div id="sv-note" class="kt-note" style="margin-top:8px"></div>
  </section>`;
  const body = `
  ${svodSection}
  <section class="card"><div class="card-h"><div><div class="card-title">План на месяц и выполнение</div><div class="card-sub">${IS_OZON
    ? `<a href="https://docs.google.com/spreadsheets/d/1Mt7UDX9sfVaVxb-c4u0Nno2dOWOZG7AIxlwTMYGAFCY/edit" target="_blank" rel="noopener" style="color:#22D3EE;font-weight:600">✎ заполнить план (Google-таблица, лист OZON)</a>`
    : `Факт берётся из свода по дате заказа - того же источника, что таблица выше. Плана по Маркету пока нет: отдельного листа в Google-таблице под эту площадку не заведено, поэтому во всех колбах стоит «задай план». Ссылку на лист OZON тут ставить нельзя - цели там по другой площадке.`}</div></div><select id="plan-month" style="background:var(--bg-2,#12151c);color:var(--ink-1);border:1px solid var(--bd);border-radius:8px;padding:6px 10px;font:inherit"></select></div><div id="plan" style="display:flex;flex-wrap:wrap;gap:20px;justify-content:space-around;padding:16px 4px 6px"></div></section>
  <section class="card"><div class="card-h"><div><div class="card-title">Водопад P&L канала</div><div class="card-sub" id="src1"></div></div></div><div class="kt-wf" id="wf"></div><div class="kt-note" style="display:none">начислено → комиссия → услуги OZON → к выплате (канал) → −доставка от покупателя (компенсируется, в расчёт не входит) → −СС произв. → −(АДМ 30% + Налоги 15%) → чистая прибыль. Канальный «к выплате» = к выплате по SKU + доставка от покупателя; СС, база АДМ/налогов и чистая - из аналитики по SKU за тот же период (совпадают с ИТОГО таблицы).</div></section>
  ${IS_OZON ? `<section class="card"><div class="card-h"><div><div class="card-title">Аналитика по артикулам (за выбранный период)</div><div class="card-sub" style="display:none">Сводка по каждому артикулу за период из верхнего фильтра: реализация с учётом возвратов + финансы по транзакциям OZON с разбивкой сборов. «Реализовано» = продано − возвраты по отчёту о реализации OZON (бухгалтерская реализация, основа УПД) за закрытые месяцы периода; для текущего/частичного месяца, где отчёта ещё нет, - по дневному ряду (доставлено − возвраты). «СС произв.» = производственная себестоимость за период = СС/шт × реализовано (прямой ключ по SKU из листа СС; где данных нет - «—»). «Наша доставка» - наш реальный расход на отправку заказа (счёт перевозчика ПЭК/СДЭК и т.п.) из ручной ведомости доставки; разбор по номеру заказа (дедуп по уникальной отправке, чтобы не задвоить: одна отправка = заказ+дата+сумма, повторные строки по товарам схлопнуты, а возврат и повторная доставка одного заказа считаются раздельно как реальные затраты); включены все статусы, где отправка>0 (доставлен/возврат/обратная нога); только ЗАКРЫТЫЕ месяцы (в текущем месяце отчёта нет - столбец пуст). OZON в своих сборах показывает лишь свой сбор за логистику (в 4-6 раз меньше), поэтому этот расход в дашборде раньше не отражался и прибыль была завышена. «Доставка покупателя» - доход: сколько за доставку заплатил клиент (из той же ведомости, по артикулу, закрытые месяцы), ПЛЮСУЕТСЯ в прибыль (раньше учитывалась только наша доставка-расход, приход игнорировался - это была асимметрия). «Города доставки» - последний справочный столбец: куда возили этот артикул (полный список - в подсказке ячейки). Расход и приход по заказам, чей артикул не сошёлся с каталогом, собраны строкой «Общие расходы» (в ИТОГО входят). «Валовая прибыль» = К выплате − СС произв. − Наша доставка + Доставка покупателя; «АДМ 30%» и «Налоги 15%» - от К выплате (сборы кабинета входят в базу, доставка - нет); по позициям с реализовано=0 не начисляются; «Чистая прибыль» = Валовая − АДМ − Налоги; «Рентаб.» = Чистая прибыль / К выплате. Для артикулов без СС валовая прибыль и рентабельность завышены (СС не вычтена). Строки сгруппированы по категориям - клик по категории раскрывает артикулы. Сборы (комиссия/логистика/эквайринг/хранение/прочие) показаны положительными; «Всего сборов» = Начислено − К выплате. Финансы - только по операциям с одним артикулом (комплекты из разных SKU не разносятся). «Реклама» - расход на продвижение по SKU: «Оплата за клик» (CPC, из Performance API, где собрано) + «Оплата за заказ» (CPO) за ЗАКРЫТЫЕ месяцы из ручного per-order отчёта кабинета (июнь-август 2026). CPO OZON не отдаёт по SKU через API, поэтому раньше он целиком лежал в «Общих расходах»; ручной отчёт разносит его по артикулу, и ровно на эту сумму уменьшаются «Общие» (баланс P&L не меняется). Для текущего/незакрытого месяца отчёта ещё нет - CPO по нему остаётся в «Общих». Реклама вычтена из «К выплате». Несобранная реклама и прочие сборы, которые OZON списывает не по одному SKU (штрафы/realFBS/бейдж/эквайринг), - в отдельной строке «Сборы уровня заказа/кабинета» и в ИТОГО (realFBS - в «Логистику», остаток рекламы и прочее - в «Прочие»). «Доставка от покупателя» в расчёт НЕ входит (компенсируется) - она только в информационном блоке ниже.</div></div></div><div id="skuan-warn" class="kt-note" style="display:none;margin:2px 0 8px;padding:6px 10px;border-left:3px solid #E5B567;background:rgba(229,181,103,.08)"></div>${IS_OZON ? `` : `<div class="kt-note" style="margin:2px 0 8px;padding:8px 12px;border-left:3px solid #8AA0FF;background:rgba(138,160,255,.08)">Из чего сложились сборы Маркета по каждому артикулу: те же статьи, что в своде выше, и тот же источник, поэтому числа сходятся. Свод отвечает на вопрос «сколько заработали», эта таблица - «за что заплатили». Клик по категории раскрывает артикулы.</div>`}<div class="kt-scroll"><table class="kt-table" id="skuan-t"><thead id="skuan-h">${IS_OZON ? `<tr>
    <th>Категория / Артикул</th>
    <th class="r">Реализовано</th>
    <th class="r">Начислено</th><th class="r">Комиссия</th>${IS_OZON
      ? `<th class="r">Логистика</th><th class="r">Эквайринг</th><th class="r">Хранение</th><th class="r">Прочие</th><th class="r">Реклама</th>`
      : `<th class="r">Доставка</th><th class="r">Приём и перевод платежа</th><th class="r">Хранение</th><th class="r">Софинансирование скидок</th><th class="r">Буст продаж</th><th class="r">Прочие</th>`}${IS_OZON ? `<th class="r" title="Наш расход на отправку заказа (счёт перевозчика ПЭК/СДЭК и т.п.) из ведомости доставки, разбор по номеру заказа, реальный расход, закрытые месяцы. Вычитается из прибыли.">Наша доставка</th><th class="r" title="Доход: сколько за доставку заплатил клиент (из ведомости), по артикулу, закрытые месяцы. Плюсуется в прибыль.">Доставка покупателя</th>` : ``}<th class="r">Всего сборов</th><th class="r">К выплате</th><th class="r">СС произв.</th><th class="r">Валовая прибыль</th><th class="r">АДМ 30%</th><th class="r">Налоги 15%</th><th class="r">Чистая прибыль</th><th class="r">Рентаб.</th>${IS_OZON ? `<th title="Города доставки по нашей отправке этого артикула (справочно)">Города доставки</th>` : ``}
  </tr>` : ``}<tbody id="skuan"></tbody></table></div></section>` : ``}
  <section class="card"><div class="card-h"><div><div class="card-title">Общие расходы</div><div class="card-sub"${IS_OZON ? ` style="display:none"` : ``}>${IS_OZON ? `За выбранный период. Это то, что OZON списывает отдельными операциями, не привязанными к одному артикулу - поэтому их нет в таблице по артикулам. «Сумма по артикулам (К выплате) + Итого этого блока = P&L канала». Источник - транзакции OZON (operation_type_name). Прогноз до конца периода - <b>[ГИПОТЕЗА]</b>: реклама/realFBS/подписки/доставка экстраполируются по дневному run-rate, штрафы и прочее - по факту (не прогнозируются). За закрытый прошлый месяц прогноз = факт.` : `Расходы кабинета, не привязанные к заказу: полки, подписки, баннеры, буст за показы. Период задаётся фильтром наверху страницы, разбивка - та же, что в своде, и ровно эта сумма вычтена в его строке «Общие расходы кабинета». Прогноза тут нет: часть расходов приходит месячным актом одной датой, и растягивать её по дневному run-rate значило бы придумывать числа.`}</div></div></div><div class="kt-scroll"><table class="kt-table" id="acct-t"><thead id="acct-h">${IS_OZON ? `<tr><th></th><th class="r">Реклама (клик+заказ)</th><th class="r">Штрафы + гибкий график</th><th class="r">realFBS + сервис + страховка</th><th class="r">Бейдж/сеть/отзывы/Premium</th><th class="r">Доставка от покупателя</th><th class="r">Прочее (компенс./эквайринг)</th><th class="r">Итого сборов</th></tr>` : ``}</thead><tbody id="acct"></tbody></table></div></section>
  <style>@media (max-width:900px){.kt-two{grid-template-columns:1fr!important}}#skuan-t th,#skuan-t td{white-space:nowrap}#acct-t th,#acct-t td{white-space:nowrap}.an-cat{cursor:pointer;font-weight:700}.an-cat:hover{background:rgba(255,255,255,.03)}.an-sku td:first-child{padding-left:24px;color:var(--ink-2)}</style>`;
  const pageJs = `
const SNAP=${J(pnlSnap)};const PNL_DAILY=${J(pnlDaily)};const NAMES=${J(skuNames)};
const AN_SALES=${J(anSales)};const AN_ADS=${J(anAds)};const AN_FIN=${J(anFin)};const AN_META=${J(anMeta)};
const AN_ACCT=${J(anAcct)};const AN_MAXD=${J(anAcctMaxD)};const AN_REALSKU=${J(anRealSku)};const AN_REALYM=${J(anRealYm)};const AN_COGS=${J(cogs)};const AN_PLAN=${J(planMonthly)};const AN_ADSSKU=${J(anAdsSku)};const AN_CPOSKU=${J(anCpoSku)};const AN_DELIV=${J(anDeliv)};const AN_DELIV_INC=${J(anDelivInc)};const AN_DELIV_CITY=${J(delivCities)};
// Фаза 2b: P&L канала за ПРОИЗВОЛЬНЫЙ период из дневного ряда. breakdown коарсе (комиссия/
// логистика/прочие услуги) - детальная разбивка по статьям остаётся в снимке 30 дн.
function aggPnlDaily(from,to){
  var accr=0,comm=0,deliv=0,fees=0,pay=0,ops=0;
  for(var i=0;i<PNL_DAILY.length;i++){var r=PNL_DAILY[i];if(r.d<from||r.d>to)continue;accr+=r.accruals;comm+=r.commission;deliv+=r.delivery;fees+=r.fees;pay+=r.payout;ops+=r.ops;}
  var other=-fees-comm-deliv; // прочие услуги = -(все сборы) - комиссия - логистика
  var breakdown={'Комиссия за продажу':comm};if(deliv)breakdown['Логистика']=deliv;if(other)breakdown['Прочие услуги OZON']=other;
  return {accruals:accr,commission:comm,payout:pay,ops:ops,fees:fees,breakdown:breakdown,dateFrom:from,dateTo:to,daily:true};
}
function catSvc(name){const n=name.toLowerCase();
  if(n.includes('brand'))return 'Бренд-комиссия';if(n.includes('acquir'))return 'Эквайринг';if(n.includes('installment'))return 'Рассрочка';if(n.includes('storage'))return 'Хранение';
  if(n.includes('membership')||n.includes('premium')||n.includes('subscription')||n.includes('stars'))return 'Подписки (Stars/Premium/отзывы)';
  if(n.includes('logistic')||n.includes('dropoff')||n.includes('lastmile')||n.includes('deliverytohandover')||n.includes('returnspvz')||n.includes('courier'))return 'Логистика (прямая+возвратная)';
  return 'Прочее';}
function normalize(raw){if(raw.breakdown)return raw;const b={'Комиссия за продажу':Math.round(raw.commission||0)};for(const k in (raw.services||{})){const c=catSvc(k);b[c]=Math.round((b[c]||0)+raw.services[k]);}return {...raw,breakdown:b};}
function paint(p,src){
  p=normalize(p);
  const kpi=(lab,val)=>'<div class="card"><div class="kt-k">'+lab+'</div><div class="kt-v">'+val+'</div></div>';
  // Карточки «Начислено / Комиссия / К выплате / Доля выплаты / Операций» с этой страницы убраны
  // по просьбе Ивана: они считаются по ПРОВОДКАМ реестра платежей (по дате проводки), а свод ниже -
  // по дате оформления заказа. Базы разные, поэтому числа и не совпадали, а рядом на одной
  // странице это читалось как ошибка. Узла #kpis здесь больше нет, поэтому и не рисуем.
  var kpisEl=document.getElementById('kpis');
  if(kpisEl){
    const commPct=p.accruals?Math.round(-(p.breakdown['Комиссия за продажу']||0)/p.accruals*1000)/10:0;
    kpisEl.innerHTML=[
      kpi('Начислено, ₽',fMln(p.accruals||0)),kpi('Комиссия за продажу',commPct+'%'),kpi('К выплате, ₽',fMln(p.payout||0)),
      kpi('Доля выплаты',(p.accruals?Math.round(p.payout/p.accruals*1000)/10:0)+'%'),kpi('Операций',fmtRu(p.ops||0))
    ].join('');
  }
  // Фаза 2b: при дневном ряде P&L точный за период (p.daily). Иначе - снимок 30 дн.
  var note=p.daily?'':((CURP==='30d')?'':' <span style="color:#E5B567" title="P&L канала по снимку 30 дней.">· снимок 30 дн</span>');
  const badge='<span class="kt-src">'+(p.daily?'за период ':'снимок ')+p.dateFrom+'..'+p.dateTo+'</span>'+note;
  // Подпись источника платформенная. У Маркета метода /v3/finance/transaction/list нет вовсе -
  // раньше здесь стояло имя озоновского эндпоинта, и на странице Маркета оно читалось как
  // «Яндекс Маркет /v3/finance/transaction/list», то есть ссылалось на несуществующий метод.
  document.getElementById('src1').innerHTML=${JSON.stringify(IS_OZON
    ? "OZON /v3/finance/transaction/list (прямой) "
    : "Яндекс Маркет: свод по дате заказа (stats/orders + отчёт по платежам reports/united-netting + акт по стоимости услуг). Бары складываются в цепочку: каждый следующий начинается там, где кончился предыдущий, поэтому последний бар совпадает с «Чистая прибыль» в ИТОГО свода ")}+badge;
  const fees=Object.entries(p.breakdown).sort((a,b)=>a[1]-b[1]);
  // Продолжаем водопад до чистой прибыли по данным аналитики по SKU (один источник правды).
  // Канальный «К выплате» = К выплате по SKU + «Доставка от покупателя» (она компенсируется и в
  // расчёт НЕ входит) -> вычитаем её мостом. Далее: −СС произв. −(АДМ 30% + Налоги 15%) = Чистая,
  // совпадающая с ИТОГО таблицы по SKU (расхождение с суммой баров - в пределах округления).
  // Водопад Маркета строится из СВОДА - того же источника, что таблица ниже. Пока он считался по
  // проводкам реестра и pnl_sku_daily, страница давала два ответа на один вопрос: за июль здесь
  // выходила чистая -294 510 ₽, а в таблице свода 140 942 ₽. Шаги подобраны так, чтобы бары
  // складывались точно: выручка − услуги = поступление по артикулам, затем мостом снимается
  // непокрытая С\С часть, и дальше всё считается к покрытой базе, как в ИТОГО таблицы.
  var wfSteps=null;
  if(!${IS_OZON}){
    var t=svTotals({from:p.dateFrom,to:p.dateTo});
    if(t&&!t.empty){
      // Цепочка повторяет колонки таблицы слева направо, в том же порядке и теми же числами:
      // Продажи + Доставка покупателя − статьи − общие расходы − баллы = Поступление, дальше мост
      // на покрытую С\С базу, себестоимость, АДМ с налогами и чистая. Ни одного своего расчёта.
      var uncov=(t.T.net-t.T.cover);   // поступление артикулов без известной С\С
      wfSteps=[['Продажи (за вычетом возвратов)',t.T.priceNet,'#22D3EE','Продажи']];
      if(Math.round(t.T.ship))wfSteps.push(['Доставка покупателя',t.T.ship,'#22D3EE','Доставка покуп.']);
      var feeParts=Object.keys(t.TC).map(function(k){return [k,t.TC[k]];}).filter(function(x){return x[1];})
        .sort(function(a,b){return b[1]-a[1];});
      var feeSum=feeParts.reduce(function(a,x){return a+x[1];},0)+(t.ohTot||0);
      if(Math.round(feeSum)){
        var tip='Расходы Маркета: '+feeParts.map(function(x){return x[0]+' '+svRub(x[1]);}).join(', ')
          +(Math.round(t.ohTot)?', расходы кабинета '+svRub(t.ohTot):'');
        wfSteps.push([tip,-feeSum,'#FF5A5F','Расходы Маркета']);
      }
      if(Math.round(t.T.sp))wfSteps.push(['Баллы Маркета (услуги, оплаченные баллами)',-t.T.sp,'#FF5A5F','Баллы']);
      wfSteps.push(['Поступление по артикулам',t.T.net,'#34D399','Поступление']);
      if(Math.round(uncov))wfSteps.push(['Поступление артикулов без известной С\\С (дальше не считается)',-uncov,'#8AA0B0','без С\\С']);
      wfSteps.push(['СС произв.',-t.cogs,'#F59E0B','СС'],['АДМ+Налоги',-(t.adm+t.tax),'#F59E0B','АДМ+Налоги']);
      wfSteps.push(['Чистая прибыль',t.np,t.np>=0?'#34D399':'#FF5A5F','Чистая']);
    }
  }
  // На Маркете фолбэка на periodTotals НЕТ. Он давал ровно то противоречие, ради устранения
  // которого водопад и переводили на свод: за 28.02 таблица пуста, а водопад заявлял «Чистая
  // прибыль 147 464 ₽» по дате проводки. Пустое окно - это «нет доставленных заказов», а не
  // прибыль: молчим тем же текстом, что и таблица. Таких дней в снимке 11.
  if(!wfSteps&&!${IS_OZON}){
    document.getElementById('wf').innerHTML='<div class="kt-note" style="padding:14px 4px">За выбранный период доставленных заказов в снимке нет, поэтому водопад не строится. Это не нулевая прибыль: просто нечего раскладывать. Период задаётся фильтром наверху страницы.</div>';
    return;
  }
  if(!wfSteps){
    var pt=periodTotals(p.dateFrom,p.dateTo);var deliv=pt.delivery,ccv=pt.cc,shipv=pt.ship||0,incv=pt.dinc||0,admtax=0.45*pt.amtS,netv=pt.net;
    var tail=[['К выплате',p.payout,'#34D399']];
    if(deliv)tail.push(['Доставка от покупателя (комп.)',-deliv,'#F59E0B']);
    tail.push(['СС произв.',-ccv,'#F59E0B']);
    if(shipv)tail.push(['Наша доставка',-shipv,'#F59E0B']);
    if(incv)tail.push(['Доставка покупателя',incv,'#34D399']);
    tail.push(['АДМ+Налоги',-admtax,'#F59E0B'],['Чистая прибыль',netv,netv>=0?'#34D399':'#FF5A5F']);
    wfSteps=[['Начислено',p.accruals,'#22D3EE']].concat(fees.map(f=>[f[0],f[1],'#FF5A5F'])).concat(tail);
  }
  const steps=wfSteps;
  const mx=Math.max(1,Math.abs(steps[0][1])||1);
  document.getElementById('wf').innerHTML=steps.map(s=>{const h=Math.max(4,Math.abs(s[1])/mx*150);var lab=s[3]||((s[0]==='АДМ+Налоги')?s[0]:s[0].split(' ')[0]);return '<div title="'+s[0]+': '+fmtRu(s[1])+' ₽"><div class="bar" style="height:'+h+'px;background:'+s[2]+'"></div>'+lab+'<br><b style="color:var(--ink-1)">'+fMln(s[1])+'</b></div>';}).join('');
}
// === раздел «Аналитика по SKU» за выбранный период ===
var anOpen={}; // категория -> раскрыта ли
function anSum(rows,from,to,n){var s=[];for(var k=0;k<n;k++)s.push(0);if(!rows)return s;for(var i=0;i<rows.length;i++){var r=rows[i];if(r[0]<from||r[0]>to)continue;for(var k2=0;k2<n;k2++)s[k2]+=r[k2+1]||0;}return s;}
// «Реализовано с учётом возвратов» по SKU за период: за ЦЕЛЫЕ закрытые месяцы (есть отчёт о
// реализации) - продано − возвраты по отчёту (=УПД); дни вне таких месяцев (текущий/частичный
// месяц, где отчёта ещё нет) - по дневному ряду (доставлено − возвраты). Без двойного счёта.
// Множество «закрытых отчётом» месяцев ЦЕЛИКОМ внутри периода - считается один раз на рендер.
function coveredMonths(from,to){
  var c={};for(var i=0;i<AN_REALYM.length;i++){var ym=AN_REALYM[i],yy=+ym.slice(0,4),mm=+ym.slice(5,7);
    var mS=ym+'-01',mE=ym+'-'+String(new Date(Date.UTC(yy,mm,0)).getUTCDate()).padStart(2,'0');
    if(mS>=from&&mE<=to)c[ym]=1;}
  return c;
}
function realUnits(sk,covM,from,to){
  var u=0;var rr=AN_REALSKU[sk]||[];
  for(var i=0;i<rr.length;i++){if(covM[rr[i][0]])u+=(rr[i][1]-rr[i][2]);} // закрытый месяц - только по отчёту (SKU без строки = 0)
  var sd=AN_SALES[sk]||[];
  for(var j=0;j<sd.length;j++){var d=sd[j];if(d[0]<from||d[0]>to)continue;if(covM[d[0].slice(0,7)])continue;u+=(d[3]||0)-(d[4]||0);} // дни вне закрытых месяцев - дневной ряд
  return u;
}
function anCells(x){
  var fees=x.acc-x.amt;
  // Валовая прибыль = К выплате − СС произв.; АДМ = 30% К выплате; Налоги = 15% К выплате;
  // Чистая = Валовая − АДМ − Налоги; Рентабельность = Чистая / Выручка.
  // АДМ и налоги - только с К выплате по SKU, где ЕСТЬ продажи (amtS). По чистым расходам
  // (SKU без продаж, сборы кабинета) АДМ/налоги не начисляем. Рентаб = чистая / К выплате.
  // «Наша доставка» (наш расход на отправку, ПЭК/СДЭК) вычитается из Валовой (как СС).
  // «Доставка от покупателя» (приход, платит клиент) - ПЛЮСУЕТСЯ в Валовую (доход). Обе по артикулу
  // из ведомости, закрытые месяцы, только OZON. Для Маркета x.ship=x.dinc=0 (данных нет).
  var gp=(x.amt||0)-(x.cc||0)-(x.ship||0)+(x.dinc||0), adm=0.30*(x.amtS||0), tax=0.15*(x.amtS||0), net=gp-adm-tax;
  var rent=(x.amt>0)?net/x.amt*100:null; // база «К выплате»<=0 -> рентаб не определена (не считаем ложный плюс)
  var R=function(v){return '<td class="r">'+(v?fmtRu(Math.round(v)):'—')+'</td>';};
  var RD=function(v,tip){var t=tip?' title="'+String(tip).replace(/"/g,'&quot;')+'"':'';return '<td class="r"'+t+'>'+(v?fmtRu(Math.round(v)):'—')+'</td>';};
  var P2=function(v){return '<td class="r"'+(v>0?' style="color:var(--up)"':'')+'>'+(v?fmtRu(Math.round(v)):'—')+'</td>';}; // приход (зелёный)
  var shipCell=${IS_OZON}?RD(x.ship,x.shipTip):'';
  var incCell=${IS_OZON}?P2(x.dinc):'';
  var cityCell=${IS_OZON}?('<td title="'+String(x.citiesTip||'').replace(/"/g,'&quot;')+'" style="color:var(--ink-2);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(x.citiesTxt||'')+'</td>'):'';
  var I=function(v){return '<td class="r">'+(v?fmtRu(v):'—')+'</td>';};
  var P=function(v){var c=v<0?'var(--dn)':(v>0?'var(--up)':'');return '<td class="r"'+(c?' style="color:'+c+'"':'')+'>'+(v?fmtRu(Math.round(v)):'—')+'</td>';};
  var PC=function(v){if(v==null)return '<td class="r">—</td>';var c=v<0?'var(--dn)':'var(--up)';return '<td class="r" style="color:'+c+'">'+(Math.round(v*10)/10)+'%</td>';};
  // Статьи расходов платформенные. У Маркета крупнейшая - софинансирование скидок (за 30 дней
  // 4 505 686 ₽), а рекламы за клик нет вовсе: вместо неё буст продаж. Пока обе сидели в «Прочих»,
  // колонка «Реклама» стояла пустой, а «Прочие» держали 92% всех сборов и ничего не объясняли.
  var mid=${IS_OZON}
    ? R(x.del)+R(x.acq)+R(x.sto)+R(x.oth)+R(x.adv)
    : R(x.del)+R(x.acq)+R(x.sto)+R(x.cof)+R(x.promo)+R(x.oth);
  return I(x.units)+R(x.acc)+R(x.com)+mid+shipCell+incCell+R(fees)+R(x.amt)+R(x.cc)+P(gp)+R(adm)+R(tax)+P(net)+PC(rent)+cityCell;
}
function renderSkuAnalytics(cur){
  var el=document.getElementById('skuan');if(!el)return;var from=cur.from,to=cur.to;var groups={};var covM=coveredMonths(from,to);var miss=[];
  for(var sk in AN_META){
    var sa=anSum(AN_SALES[sk],from,to,5),ad=anSum(AN_ADS[sk],from,to,5),fi=anSum(AN_FIN[sk],from,to,9);
    // cpo = разнесённая реклама «за заказ» по SKU (ручной per-order отчёт, закрытые месяцы).
    var cpo=anSum(AN_CPOSKU[sk],from,to,1)[0]||0;
    // ship = наш расход на отправку; dinc = доход от покупателя за доставку (ведомость, закрытые мес).
    var _off=AN_META[sk].off;
    var ship=anSum(AN_DELIV[_off],from,to,1)[0]||0;
    var dinc=anSum(AN_DELIV_INC[_off],from,to,1)[0]||0;
    if(!sa[0]&&!sa[1]&&!sa[2]&&!sa[3]&&!sa[4]&&!ad[0]&&!fi[0]&&!fi[6]&&!cpo&&!ship&&!dinc)continue;
    var m=AN_META[sk];
    // units = «Реализовано с учётом возвратов» по отчёту о реализации (УПД); cc = СС/шт × реализовано
    var ru=realUnits(sk,covM,from,to);
    // noCs: реализован, но производственной СС нет в листе -> СС/валовая/чистая/рентаб неполные
    var noCs=(ru>0 && (AN_COGS[sk]==null));
    // adv = собранная реклама по SKU за период (положит. расход); вычитается из К выплате (amt).
    // CPC (AN_ADSSKU) + CPO «за заказ» (AN_CPOSKU, ручной отчёт закрытых месяцев).
    var adv=(anSum(AN_ADSSKU[sk],from,to,1)[0]||0)+cpo;
    var amtNet=fi[6]-adv; // К выплате после разнесённой рекламы
    // amtS = К выплате как база АДМ/налогов; по позициям с реализовано=0 не начисляем (amtS=0)
    var _cl=AN_DELIV_CITY[_off]||[];
    var citiesTxt=_cl.slice(0,3).map(function(c){return c[0]+' ('+c[1]+')';}).join(', ')+(_cl.length>3?' …':'');
    var citiesTip=_cl.map(function(c){return c[0]+' ('+c[1]+')';}).join('\\n');
    var x={sk:sk,nm:m.nm,off:m.off,cat:m.cat||'Прочее',rev:sa[0],units:ru,deliv:sa[2],ret:sa[3],canc:sa[4],sp:ad[0],soldO:ad[1],omO:ad[2],comb:ad[2]+ad[4],acc:fi[0],com:-fi[1],del:-fi[2],acq:-fi[3],sto:-fi[4],oth:-fi[5],cof:-fi[7],promo:-fi[8],adv:adv,amt:amtNet,amtS:(ru>0?amtNet:0),cc:(AN_COGS[sk]||0)*ru,ship:ship,dinc:dinc,citiesTxt:citiesTxt,citiesTip:citiesTip,noCs:noCs};
    if(noCs)miss.push(x);
    (groups[x.cat]||(groups[x.cat]=[])).push(x);
  }
  // cof и promo - маркетные статьи (софинансирование скидок и буст продаж). Без них в этом
  // списке категория и ИТОГО показывали по ним прочерк, хотя у артикулов суммы были.
  var SUMK=['rev','units','deliv','ret','canc','sp','soldO','omO','comb','acc','com','del','acq','sto','cof','promo','oth','adv','amt','amtS','cc','ship','dinc'];
  var cats=Object.keys(groups).map(function(c){var arr=groups[c];var t={};SUMK.forEach(function(k){t[k]=0;});arr.forEach(function(x){SUMK.forEach(function(k){t[k]+=x[k]||0;});});arr.sort(function(a,b){return b.rev-a.rev;});return {cat:c,arr:arr,t:t};}).sort(function(a,b){return b.t.rev-a.t.rev;});
  if(!cats.length){el.innerHTML='<tr><td colspan="20" class="kt-note">нет данных за период</td></tr>';return;}
  var grand={};SUMK.forEach(function(k){grand[k]=0;});var html='';
  cats.forEach(function(g){SUMK.forEach(function(k){grand[k]+=g.t[k]||0;});var op=!!anOpen[g.cat];var ck=g.cat.replace(/"/g,'');
    html+='<tr class="an-cat" data-cat="'+ck+'"><td>'+(op?'▾ ':'▸ ')+g.cat+' <span style="color:var(--ink-3);font-weight:400">('+g.arr.length+')</span></td>'+anCells(g.t)+'</tr>';
    g.arr.forEach(function(x){var badge=x.noCs?' <span style="color:#E5B567" title="Нет производственной СС в листе - СС/прибыль/рентабельность по этому артикулу неполные">⚠ нет СС</span>':'';html+='<tr class="an-sku'+(x.noCs?' an-nocs':'')+'" data-cat="'+ck+'" style="'+(op?'':'display:none')+'"><td title="'+String(x.nm).replace(/"/g,'&quot;')+'">'+(x.off||x.sk)+badge+'</td>'+anCells(x)+'</tr>';});
  });
  // Сборы уровня заказа/кабинета (не по SKU) за период - отдельной строкой и в ИТОГО, разнесены
  // по колонкам по смыслу: realFBS+сервис+страхование -> «Логистика»; реклама/штрафы/бейдж/
  // эквайринг/компенсации -> «Прочие». ИСКЛЮЧЕНИЕ: «Доставка от покупателя» в расчёт НЕ входит
  // (компенсируется) - её нет в ИТОГО, только в информационном блоке ниже. Значения в AN_ACCT
  // signed (сборы < 0), колонки показывают сбор положительным -> берём со знаком минус.
  var aB={adv:0,fines:0,realfbs:0,badge:0,delivery:0,other:0};
  for(var ai=0;ai<AN_ACCT.length;ai++){var ar=AN_ACCT[ai];if(ar[0]<from||ar[0]>to)continue;aB.adv+=ar[1];aB.fines+=ar[2];aB.realfbs+=ar[3];aB.badge+=ar[4];aB.delivery+=ar[5];aB.other+=ar[6];}
  // Реклама: собранная per-SKU часть (grand.adv) уже разнесена в колонку «Реклама» и вычтена из
  // К выплате артикулов -> в «Прочие» кабинета оставляем ТОЛЬКО остаток (aB.adv отрицателен + собранное).
  var aDel=aB.realfbs,aOth=(aB.adv+grand.adv)+aB.fines+aB.badge+aB.other,at=aDel+aOth; // delivery исключена
  // «Наша доставка», не разнесённая по артикулу: у части отправок артикул из ведомости не сходится
  // с каталогом дашборда (старые варианты/брак в коде артикула). Чтобы ИТОГО отражал ВЕСЬ реальный
  // расход на доставку, остаток (весь период − разнесённое по строкам grand.ship) добавляем строкой.
  var totalDeliv=0;for(var _o in AN_DELIV){totalDeliv+=anSum(AN_DELIV[_o],from,to,1)[0]||0;}
  var totalInc=0;for(var _i in AN_DELIV_INC){totalInc+=anSum(AN_DELIV_INC[_i],from,to,1)[0]||0;}
  var unmDeliv=Math.max(0,Math.round(totalDeliv-(grand.ship||0)));
  var unmInc=Math.max(0,Math.round(totalInc-(grand.dinc||0)));
  if(at||unmDeliv||unmInc){var acct={rev:0,units:0,deliv:0,ret:0,canc:0,sp:0,soldO:0,omO:0,comb:0,acc:0,com:0,del:-aDel,acq:0,sto:0,cof:0,promo:0,oth:-aOth,adv:0,ship:unmDeliv,dinc:unmInc,amt:at,amtS:at};
    grand.del+=acct.del;grand.oth+=acct.oth;grand.amt+=acct.amt;grand.amtS+=acct.amtS;grand.ship+=unmDeliv;grand.dinc+=unmInc; // сборы кабинета - в базе АДМ/налогов; доставка вне артикулов - в ИТОГО
    html+='<tr style="cursor:default;font-weight:600" title="realFBS/сервис/страхование -> Логистика; реклама/штрафы/бейдж/эквайринг/компенсации -> Прочие. «Наша доставка» и «Доставка покупателя» здесь - по заказам, чей артикул не сошёлся с каталогом."><td>Общие расходы</td>'+anCells(acct)+'</tr>';
  }
  html+='<tr style="font-weight:700;border-top:2px solid var(--bd);background:rgba(255,255,255,.03)"><td>ИТОГО</td>'+anCells(grand)+'</tr>';
  el.innerHTML=html;
  // Сводка-предупреждение о пробелах в данных (нет производственной СС) - чтобы дырка была видна
  var warn=document.getElementById('skuan-warn');
  if(warn){
    if(miss.length){
      var mu=0;miss.forEach(function(x){mu+=x.units;});miss.sort(function(a,b){return b.units-a.units;});
      var lst=miss.slice(0,10).map(function(x){return (x.off||x.sk)+' ('+x.units+' шт)';}).join(', ');
      var sh=grand.units?Math.round(mu/grand.units*100):0;
      warn.innerHTML='<b style="color:#E5B567">⚠ Нет производственной СС по '+miss.length+' SKU</b> ('+mu+' шт, '+sh+'% реализации периода) - по ним СС, валовая и чистая прибыль, рентабельность неполные. Добавьте СС в лист «СС GEN - OZON»: '+lst+(miss.length>10?' и ещё '+(miss.length-10):'');
      warn.style.display='';
    } else warn.style.display='none';
  }
  el.querySelectorAll('.an-cat').forEach(function(tr){tr.onclick=function(){var c=tr.getAttribute('data-cat');anOpen[c]=!anOpen[c];var td=tr.querySelector('td');td.innerHTML=td.innerHTML.replace(anOpen[c]?'▸':'▾',anOpen[c]?'▾':'▸');el.querySelectorAll('.an-sku[data-cat="'+(window.CSS&&CSS.escape?CSS.escape(c):c)+'"]').forEach(function(s){s.style.display=anOpen[c]?'':'none';});};});
}
// === блок «Сборы уровня заказа/кабинета» за выбранный период (факт + прогноз [ГИПОТЕЗА]) ===
// AN_ACCT: [d, adv, fines, realfbs, badge, delivery, other]. Значения signed как в транзакциях
// OZON (сборы отрицательны, доставка от покупателя положительна). Прогноз до конца периода -
// «Гибрид по статьям»: реклама/realFBS/бейдж/доставка экстраполируем run-rate по прошедшим дням;
// штрафы и прочее - по факту (не прогнозируем). Данные есть только до AN_MAXD.
// Общие расходы кабинета на Маркете. Прежние колонки этого блока описывали статьи другой
// площадки (реклама за клик, гибкий график, realFBS, подписочный бейдж, доставка от покупателя);
// у Маркета таких услуг нет, поэтому пять колонок из шести стояли пустыми, а вся сумма падала в
// «Прочее». Источник - свод, тот же, что у таблицы и водопада, разбитый по дням и статьям.
function renderAccountFeesYm(cur){
  var el=document.getElementById('acct'),hd=document.getElementById('acct-h');if(!el)return;
  // Окно берём из cur, а не из глобального __guruPeriod: render вызывают и напрямую, и тогда
  // блок считал бы за другой период, чем остальная страница.
  var w=(cur&&cur.from&&cur.to)?{from:cur.from,to:cur.to}:svWin(), ms=svPick(w), oh=svOverhead(ms,w);
  // Разбивка приходит именами услуг из отчёта; сводим их в те же 7 групп, что колонки таблицы
  // выше. Услугу, не попавшую ни в одну группу, не прячем - она уедет в «вне групп», иначе
  // сумма строк разошлась бы с итогом молча.
  var cols=SV_COLS.map(function(p){return p[0];}), M={};
  SV_COLS.forEach(function(p){p[1].forEach(function(n){M[n]=p[0];});});
  var agg={},other=[0,0],known=0;
  cols.forEach(function(c){agg[c]=[0,0];});
  Object.keys(oh.c).forEach(function(n){var v=oh.c[n]||[0,0];var g=M[n];
    if(g){agg[g][0]+=v[0]||0;agg[g][1]+=v[1]||0;}else{other[0]+=v[0]||0;other[1]+=v[1]||0;}
    known+=(v[0]||0)+(v[1]||0);});
  // Снимок прежней версии derive нёс сумму без разбивки. Не выдаём это за ноль: показываем
  // остаток отдельной колонкой, чтобы итог строки всегда сходился с итогом свода.
  var rest=(oh.m+oh.p)-known; if(Math.round(rest))other[0]+=rest;
  var hasOther=!!(Math.round(other[0])||Math.round(other[1]));
  var H=cols.concat(hasOther?['Вне групп']:[]);
  if(hd)hd.innerHTML='<tr><th></th>'+H.map(function(x){return '<th class="r">'+x+'</th>';}).join('')+'<th class="r">Итого</th></tr>';
  var cell=function(v){return '<td class="r"'+(v?' style="color:var(--dn)"':'')+'>'+(v?fmtRu(Math.round(v)):'—')+'</td>';};
  var line=function(lab,idx,hint){
    var tot=0,tds=cols.map(function(c){tot+=agg[c][idx];return cell(agg[c][idx]);}).join('');
    if(hasOther){tot+=other[idx];tds+=cell(other[idx]);}
    return '<tr'+(hint?' title="'+hint+'"':'')+'><td>'+lab+'</td>'+tds+'<td class="r"><b>'+fmtRu(Math.round(tot))+'</b></td></tr>';
  };
  if(!ms.length||!Math.round(oh.m+oh.p)){
    el.innerHTML='<tr><td colspan="'+(H.length+2)+'" class="kt-note">За выбранный период расходов кабинета нет. Это не обязательно ноль: по незакрытым месяцам акт по стоимости услуг ещё не выставлен, и тогда видны только проводки реестра.</td></tr>';
    return;
  }
  var totAll=oh.m+oh.p;
  el.innerHTML=line('<b>Деньгами</b>',0,'оплачено рублями со счёта продавца')
    +line('<b>Баллами</b>',1,'закрыто баллами Маркета, живых денег не списано')
    +'<tr style="border-top:2px solid var(--bd)"><td><b>Всего</b></td>'
      +cols.map(function(c){return cell(agg[c][0]+agg[c][1]);}).join('')
      +(hasOther?cell(other[0]+other[1]):'')
      +'<td class="r"><b style="color:var(--dn)">'+fmtRu(Math.round(totAll))+'</b></td></tr>'
    +'<tr><td colspan="'+(H.length+2)+'" class="kt-note">Источник: '
      +(oh.act&&oh.ledger?('акт по стоимости услуг по '+oh.act+' кабинето-месяцам, отчёт о платежах по '+oh.ledger+' - по ним полки, подписки и буст за показы ещё не видны')
        :(oh.act?'акт по стоимости услуг':'отчёт о платежах: акт за этот период ещё не собран, поэтому полки, подписки и буст за показы сюда не попали'))
      +'.</td></tr>';
}
function renderAccountFees(cur){
  if(!${IS_OZON}){renderAccountFeesYm(cur);return;}
  var el=document.getElementById('acct');if(!el)return;var from=cur.from,to=cur.to;
  var f={adv:0,fines:0,realfbs:0,badge:0,delivery:0,other:0},any=false;
  for(var i=0;i<AN_ACCT.length;i++){var r=AN_ACCT[i];if(r[0]<from||r[0]>to)continue;any=true;f.adv+=r[1]||0;f.fines+=r[2]||0;f.realfbs+=r[3]||0;f.badge+=r[4]||0;f.delivery+=r[5]||0;f.other+=r[6]||0;}
  var day=864e5,parse=function(s){return Date.parse(s+'T00:00Z');};
  var dataEnd=(to<AN_MAXD)?to:AN_MAXD; // последний день периода, по который есть данные
  var totalDays=Math.round((parse(to)-parse(from))/day)+1;
  var elapsed=Math.round((parse(dataEnd)-parse(from))/day)+1;
  var k=(elapsed>0&&totalDays>elapsed)?(totalDays/elapsed):1; // множитель run-rate
  var fc={adv:Math.round(f.adv*k),fines:f.fines,realfbs:Math.round(f.realfbs*k),badge:Math.round(f.badge*k),delivery:Math.round(f.delivery*k),other:f.other};
  var money=function(v){var c=v<0?'var(--dn)':(v>0?'var(--up)':'');return '<td class="r"'+(c?' style="color:'+c+'"':'')+'>'+(v?fmtRu(Math.round(v)):'—')+'</td>';};
  var cells=function(o){var tot=o.adv+o.fines+o.realfbs+o.badge+o.delivery+o.other;return money(o.adv)+money(o.fines)+money(o.realfbs)+money(o.badge)+money(o.delivery)+money(o.other)+'<td class="r"><b>'+fmtRu(Math.round(tot))+'</b></td>';};
  if(!any){el.innerHTML='<tr><td colspan="8" class="kt-note">нет данных за период (нужен бэкфилл pnl_account_daily)</td></tr>';return;}
  var html='<tr><td><b>Факт</b> <span style="color:var(--ink-3);font-weight:400">'+from+'..'+dataEnd+'</span></td>'+cells(f)+'</tr>';
  if(k>1)html+='<tr style="color:var(--ink-2)"><td><b>Прогноз</b> <span style="color:#E5B567;font-weight:400">[ГИПОТЕЗА] до '+to+'</span></td>'+cells(fc)+'</tr>';
  el.innerHTML=html;
}
// === блок «План на месяц и выполнение» (независим от верхнего фильтра, свой выбор месяца) ===
function planFmtMon(ym){var n=['','янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];return n[+ym.slice(5,7)]+' '+ym.slice(0,4);}
function planCurMon(){return AN_MAXD?String(AN_MAXD).slice(0,7):new Date().toISOString().slice(0,7);} // текущий месяц по данным
function planMonthList(){var cm=planCurMon();var s={};for(var i=0;i<AN_ACCT.length;i++)s[AN_ACCT[i][0].slice(0,7)]=1;for(var k in AN_PLAN)if(/^[0-9]{4}-[0-9]{2}$/.test(k))s[k]=1;return Object.keys(s).filter(function(m){return m>=cm;}).sort();} // только текущий и будущие месяцы
// Факт за месяц (те же формулы, что ИТОГО таблицы): реклама (финансовая), рентабельность и пр.
// Итоги за период по ТОЙ ЖЕ логике, что ИТОГО таблицы по SKU (renderSkuAnalytics): К выплате
// после разнесённой рекламы, база АДМ/налогов amtS (только по SKU с реализовано>0 + сборы
// кабинета), доставка от покупателя - отдельно (в расчёт НЕ входит). Один источник правды для
// плана, водопада и таблицы - одна «Чистая прибыль» на странице.
function periodTotals(from,to){
  // amtReal = «К выплате» для прибыли: у позиций с реализовано=0 берём ТОЛЬКО отрицательное
  // (возвраты/расходы), а положительные «висящие» заказы (начислены, но ещё не выкуплены -
  // типично для последних дней открытого месяца) в прибыль НЕ считаем, иначе чистая/рентаб
  // раздуваются (АДМ/налоги-то берутся только с реализованных). Для закрытых месяцев amtReal=amt.
  var covM=coveredMonths(from,to);var rev=0,accr=0,amt=0,amtReal=0,amtS=0,cc=0,realized=0,gadv=0;
  for(var sk in AN_META){var sa=anSum(AN_SALES[sk],from,to,5),fi=anSum(AN_FIN[sk],from,to,7);var ru=realUnits(sk,covM,from,to);
    var adv=(anSum(AN_ADSSKU[sk],from,to,1)[0]||0)+(anSum(AN_CPOSKU[sk],from,to,1)[0]||0);var amtNet=(fi[6]||0)-adv; // К выплате после разнесённой рекламы (CPC + CPO за заказ)
    rev+=sa[0]||0;accr+=(fi[0]||0);realized+=ru;amt+=amtNet;amtReal+=(ru>0?amtNet:Math.min(0,amtNet));if(ru>0)amtS+=amtNet;cc+=(AN_COGS[sk]||0)*ru;gadv+=adv;}
  var aB={adv:0,fines:0,realfbs:0,badge:0,delivery:0,other:0};
  for(var i=0;i<AN_ACCT.length;i++){var r=AN_ACCT[i];if(r[0]<from||r[0]>to)continue;aB.adv+=r[1];aB.fines+=r[2];aB.realfbs+=r[3];aB.badge+=r[4];aB.delivery+=r[5];aB.other+=r[6];}
  var aDel=aB.realfbs,aOth=(aB.adv+gadv)+aB.fines+aB.badge+aB.other,at=aDel+aOth; // доставка от покупателя исключена
  amt+=at;amtReal+=at;amtS+=at; // сборы кабинета - в базе АДМ/налогов
  // «Наша доставка» (наш расход на отправку, ПЭК/СДЭК) за период - реальный расход, вычитается из
  // прибыли (как СС). Весь по всем артикулам (разнесённое + нераспределённое) = сумма по AN_DELIV.
  var ship=0;for(var _o in AN_DELIV){ship+=anSum(AN_DELIV[_o],from,to,1)[0]||0;}
  var dinc=0;for(var _i in AN_DELIV_INC){dinc+=anSum(AN_DELIV_INC[_i],from,to,1)[0]||0;} // доход от покупателя за доставку - плюсуется
  var net=(amtReal-cc-ship+dinc)-0.45*amtS,rent=(amtReal>0)?net/amtReal*100:null; // прибыль/рентаб - на реализованной базе (без висящих заказов)
  return {ad:-aB.adv,rev:rev,accr:accr,realized:realized,amt:amt,amtReal:amtReal,amtS:amtS,cc:cc,ship:ship,dinc:dinc,delivery:aB.delivery,net:net,rent:rent};
}
function monthTotals(ym){
  var yy=+ym.slice(0,4),mm=+ym.slice(5,7),from=ym+'-01',to=ym+'-'+String(new Date(Date.UTC(yy,mm,0)).getUTCDate()).padStart(2,'0');
  return periodTotals(from,to);
}
// «Колбочка»: SVG-флакон, залитый снизу до уровня выполнения (0-100% визуально), с цветом статуса.
function planFlask(i,lvl,color){
  var L=Math.max(0,Math.min(100,lvl||0));
  var top=8,bot=86,H=bot-top;var px=L/100*H;var ly=bot-px; // высота заливки
  var d='M26,8 L38,8 L38,34 L53,80 Q53,86 47,86 L17,86 Q11,86 11,80 L26,34 Z';
  return '<svg viewBox="0 0 64 96" width="66" height="98" style="overflow:visible">'
    +'<defs><clipPath id="fc'+i+'"><path d="'+d+'"/></clipPath>'
    +'<linearGradient id="fg'+i+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+color+'" stop-opacity="0.95"/><stop offset="1" stop-color="'+color+'" stop-opacity="0.6"/></linearGradient></defs>'
    +'<path d="'+d+'" fill="rgba(255,255,255,.04)"/>'
    +'<rect x="0" y="'+ly.toFixed(1)+'" width="64" height="'+px.toFixed(1)+'" fill="url(#fg'+i+')" clip-path="url(#fc'+i+')"/>'
    +'<path d="'+d+'" fill="none" stroke="var(--bd)" stroke-width="2"/>'
    +'<rect x="22" y="4" width="20" height="4.5" rx="2.25" fill="var(--ink-3)"/>'
    +'</svg>';
}
// Факт за месяц для плана. На Маркете берётся из СВОДА - того же источника, что таблица и
// водопад на этой же странице. Раньше он считался из history/pnl_sku_daily и расходился с
// таблицей ниже: на данных 16.09.2026 за июль план давал выручку 15 287 504 ₽ и чистую
// -294 510 ₽, а свод - выручку деньгами 5 067 076 ₽ и чистую 140 942 ₽ (9 722 328 ₽ - это
// справочная колонка «Продажи», а не выручка). Статьи тоже свои: «начислено» у Маркета нет,
// а вместо рекламы за клик - продвижение (буст продаж).
function planRows(ym){
  var p=(AN_PLAN[ym]||{});
  if(!${IS_OZON}){
    var yy=+ym.slice(0,4),mm=+ym.slice(5,7);
    var to=ym+'-'+String(new Date(Date.UTC(yy,mm,0)).getUTCDate()).padStart(2,'0');
    var t=svTotals({from:ym+'-01',to:to});
    if(t&&!t.empty)return [
      ['Выручка деньгами',p.revenue,t.rev,'up','₽'],
      ['Реализация',p.realized,t.units,'up','шт'],
      ['Продвижение',p.adSpend,(t.TC['Продвижение']||0)+svOhGroup(t.oh,'Продвижение'),'cap','₽'],
      ['Валовая прибыль',p.grossProfit,t.gp,'up','₽'],
      ['Чистая прибыль',p.netProfit,t.np,'up','₽'],
      ['Рентабельность',p.rentab,t.rent,'pct','%']];
    // Месяц без доставленных заказов показываем пустым, а не по дате проводки: иначе в плане
    // снова стояли бы числа из источника, которого нет в таблице под ним.
    return [['Выручка деньгами',p.revenue,null,'up','₽'],['Реализация',p.realized,null,'up','шт'],
      ['Продвижение',p.adSpend,null,'cap','₽'],['Валовая прибыль',p.grossProfit,null,'up','₽'],
      ['Чистая прибыль',p.netProfit,null,'up','₽'],['Рентабельность',p.rentab,null,'pct','%']];
  }
  var a=monthTotals(ym);
  return [['Выручка',p.revenue,a.rev,'up','₽'],['Начислено',p.accrued,a.accr,'up','₽'],['Реализация',p.realized,a.realized,'up','шт'],['Реклама',p.adSpend,a.ad,'cap','₽'],['Чистая прибыль',p.netProfit,a.net,'up','₽'],['Рентабельность',p.rentab,a.rent,'pct','%']];
}
function renderPlan(ym){
  var el=document.getElementById('plan');if(!el)return;
  var rows=planRows(ym);
  el.innerHTML=rows.map(function(r,i){var lab=r[0],plan=r[1],fact=r[2],kind=r[3],unit=r[4],isPct=(unit==='%');
    var planS=(plan==null||plan==='')?'—':(isPct?plan+'%':fmtRu(Math.round(plan)));
    var noFact=(fact==null); // рентаб не определена (база «К выплате»<=0, месяц убыточный)
    var factS=noFact?'—':(isPct?(Math.round(fact*10)/10)+'%':fmtRu(Math.round(fact)));
    var pct=null,color='var(--ink-3)',lvl=0;
    if(noFact){color='var(--dn)';lvl=0;}
    else if(plan!=null&&plan!==''&&plan!=0){pct=fact/plan*100;lvl=pct;
      if(kind==='cap')color=(pct<=100?'var(--up)':'var(--dn)');
      else color=(pct>=100?'var(--up)':(pct>=80?'#E5B567':'var(--dn)'));}
    var pctTxt=noFact?'<b style="color:var(--dn);font-size:18px">—</b>':((pct==null)?'<span style="color:var(--ink-3)">задай план</span>':'<b style="color:'+color+';font-size:18px">'+Math.round(pct)+'%</b>');
    return '<div style="width:132px;text-align:center">'
      +planFlask(i,lvl,color)
      +'<div style="margin-top:2px">'+pctTxt+'</div>'
      +'<div style="font-weight:600;font-size:12.5px;margin-top:4px">'+lab+'</div>'
      +'<div style="color:var(--ink-2);font-size:11px;margin-top:2px">факт '+factS+'</div>'
      +'<div style="color:var(--ink-3);font-size:11px">план '+planS+'</div>'
      +'</div>';}).join('');
}
var planInited=false;
function initPlan(){
  if(planInited)return;var sel=document.getElementById('plan-month');if(!sel)return;var ms=planMonthList();if(!ms.length)return;planInited=true;
  sel.innerHTML=ms.map(function(m){return '<option value="'+m+'">'+planFmtMon(m)+'</option>';}).join('');
  var cm=planCurMon();var def=(ms.indexOf(cm)>=0)?cm:ms[0];sel.value=def;sel.onchange=function(){renderPlan(sel.value);};renderPlan(def); // по умолчанию - текущий месяц
}
function render(cur,cmp){
  // Фаза 2b: P&L канала за выбранный период из дневного ряда. Фолбэк на снимок 30 дн.
  var p=(PNL_DAILY&&PNL_DAILY.length)?aggPnlDaily(cur.from,cur.to):SNAP;
  paint(p,p.daily?'daily':'snap');
  initPlan(); // блок плана - один раз, со своим выбором месяца
  if(${IS_OZON})renderSkuAnalytics(cur); // аналитика по SKU за период (на Маркете - svSkuTable из свода)
  renderAccountFees(cur); // сборы уровня заказа/кабинета за период (+прогноз)
}`;
  writeFileSync(op("katya-money.html"), kshell("Деньги", "money", body, pageJs + svodJs(svodJson)));
}

// Лист продвижения Яндекс Маркета. Считается из того же свода, что и вкладка Деньги, поэтому
// цифры двух листов не могут разойтись: один источник, один базис - дата оформления заказа.
//
// Почему лист не повторяет лист OZON. У Маркета нет рекламных кампаний за клик: нет ставок,
// кликов, показов рекламы, а значит нет ни CPC, ни CTR, ни CPO по кликам, ни «активных кампаний».
// Продвижение здесь - буст продаж, который списывается ПРОЦЕНТОМ С ПРОДАЖИ и привязан к номеру
// заказа (1990 строк реестра из 1990 несут ORDER_ID). Именно поэтому ДРР считается по заказам, а
// не оценивается ориентиром: расход и выручка относятся к одним и тем же заказам.
function promoYm(): { body: string; js: string } {
  let svod: any = null;
  try { svod = JSON.parse(readFileSync(dp("svod_orders.json"), "utf-8")); } catch { svod = null; }
  const head = `
  <div class="card" style="border-color:#22D3EE;background:rgba(34,211,238,.05);padding:12px 14px;margin-bottom:10px">
    <b>У Яндекс Маркета нет рекламных кампаний за клик.</b>
    <div class="kt-note" style="margin-top:6px">Кнопки периода в шапке к этому листу не применяются: расход и выручка тут считаются ПО МЕСЯЦАМ ДАТЫ ЗАКАЗА, а не произвольным диапазоном. Месяц выбирается в таблице ниже.<br>На листе нет ставок, кликов, показов рекламы, CPC, CTR и «активных кампаний»: таких сущностей у площадки нет. Продвижение Маркета - это <b>буст продаж, который списывается за продажу</b>, плюс отзывы за баллы и общие расходы кабинета (подписка, полки, баннеры). Буст привязан к номеру заказа, поэтому <b>ДРР здесь считается по заказам, а не оценивается</b>. Базис - дата оформления заказа, тот же, что у свода на вкладке Деньги.</div>
  </div>`;
  if (!svod || !svod.months || !svod.months.length) {
    return { body: head + `<div class="card"><b>Свод по заказам не собран.</b><div class="kt-note" style="margin-top:8px">Лист продвижения считается из него: нет <code>data-ym/svod_orders.json</code> - нечего показывать. Запустить <code>npm run ym:derive</code>.</div></div>`, js: "" };
  }
  const body = head + `
  <section class="kt-kpi" id="pm-kpi"></section>
  <section class="card"><div class="card-h"><div><div class="card-title">Расход на продвижение по месяцам заказа</div><div class="card-sub">буст оплачивается и деньгами, и баллами Маркета - обе половины реальный расход</div></div>
    <select id="pm-b" style="background:var(--bg-2,#12151c);color:var(--ink-1);border:1px solid var(--bd);border-radius:8px;padding:6px 10px;font:inherit"></select></div>
    <div class="kt-scroll"><table class="kt-table" id="pm-mon"></table></div>
    <div class="kt-note" style="margin-top:8px">Выручка взята как деньги плюс начисленные баллы - та же база, что у маржи на вкладке Деньги. К неполной выручке ДРР завышался бы.</div>
  </section>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px" class="kt-two">
    <section class="card"><div class="card-h"><div><div class="card-title">ДРР по линиям</div><div class="card-sub" id="pm-lab1"></div></div></div><div class="kt-scroll"><table class="kt-table" id="pm-line"></table></div></section>
    <section class="card"><div class="card-h"><div><div class="card-title">Где буст съедает маржу</div><div class="card-sub" id="pm-lab2"></div></div></div><div id="pm-hungry" style="padding:4px 2px"></div></section>
  </div>
  <section class="card"><div class="card-h"><div><div class="card-title">По артикулам</div><div class="card-sub" id="pm-lab3"></div></div></div><div class="kt-scroll"><table class="kt-table" id="pm-sku"></table></div></section>
  <style>@media (max-width:900px){.kt-two{grid-template-columns:1fr!important}}#pm-mon th,#pm-mon td,#pm-sku th,#pm-sku td{white-space:nowrap}</style>`;
  const js = `
var PM=${JSON.stringify(svod)};
var PM_ART=${JSON.stringify(["Буст продаж", "Программа лояльности и отзывы"])};
var PM_NAMES={"74986385":"GEN GROUP (мебель)","1023124":"GENGLASS (зеркала)"};
function pmN(b){return PM_NAMES[b]||('кабинет '+b);}
function pmRub(n){return fmtRu(Math.round(n||0));}
function pmRow(m){
  var sm=0,sp=0,rev=0,pts=0;
  m.rows.forEach(function(r){PM_ART.forEach(function(a){sm+=(r.svc||{})[a]||0;sp+=(r.svc_pts||{})[a]||0;});rev+=r.revenue_money;pts+=r.points_accrued;});
  var ohM=0,ohP=0;PM_ART.concat(['Прочие услуги']).forEach(function(a){ohM+=(m.overhead||{})[a]||0;ohP+=(m.overhead_pts||{})[a]||0;});
  var spend=sm+sp+ohM+ohP, base=rev+pts;
  return {ym:m.ym,business:m.business,sm:sm,sp:sp,oh:ohM+ohP,spend:spend,base:base,
    drr:base>0?Math.round(spend/base*1000)/10:null,
    settled:!!m.svc_settled, partial:(m.orders_inflight||0)>0};
}
function pmDraw(){
  var b=document.getElementById('pm-b').value;
  var ms=(PM.months||[]).filter(function(m){return (b==='all'||m.business===b)&&m.rows.length;});
  var rows=ms.map(pmRow).filter(function(r){return r.spend||r.base;})
    .sort(function(x,y){return x.ym===y.ym?String(x.business).localeCompare(String(y.business)):(x.ym<y.ym?1:-1);});
  // карточки - по последнему ЗАКРЫТОМУ месяцу: незакрытый выдавать за итог нельзя
  var closed=rows.filter(function(r){return r.settled&&!r.partial;});
  var lastYm=closed.length?closed[0].ym:'';
  var headRows=closed.filter(function(r){return r.ym===lastYm;});
  var S=function(f){return headRows.reduce(function(a,r){return a+f(r);},0);};
  var hSpend=S(function(r){return r.spend;}),hBase=S(function(r){return r.base;});
  var card=function(lab,val,sub,col){return '<div class="card kpi"><div class="lab">'+lab+'</div><div class="val num"'+(col?' style="color:'+col+'"':'')+'>'+val+'</div><div class="sub">'+sub+'</div></div>';};
  document.getElementById('pm-kpi').innerHTML=lastYm
    ? [card('Расход на продвижение',pmRub(hSpend)+' ₽','последний закрытый месяц: '+lastYm),
       card('ДРР по заказам',(hBase>0?Math.round(hSpend/hBase*1000)/10:0)+'%','расход к выручке тех же заказов'),
       card('Буст деньгами',pmRub(S(function(r){return r.sm;}))+' ₽','списано со счёта'),
       card('Буст баллами',pmRub(S(function(r){return r.sp;}))+' ₽','оплачено баллами Маркета','#E5B567'),
       card('Общие расходы',pmRub(S(function(r){return r.oh;}))+' ₽','подписка, полки, баннеры')].join('')
    : '<div class="card"><b>Закрытых месяцев в снимке нет.</b><div class="kt-note" style="margin-top:6px">Месяц закрыт, когда пришёл акт за следующий и период доставки завершён. Пока таких нет, карточки не показываются: незакрытый месяц выдавать за итог нельзя.</div></div>';
  var mh='<thead><tr><th>Месяц заказа</th><th>Кабинет</th><th class="r">Буст деньгами</th><th class="r">Буст баллами</th><th class="r">Общие</th><th class="r">Всего</th><th class="r">Выручка (деньги+баллы)</th><th class="r">ДРР</th></tr></thead><tbody>';
  rows.forEach(function(r){
    var flag=r.partial?' <span style="color:#E5B567;font-size:11px">период не завершён</span>':(!r.settled?' <span style="color:#E5B567;font-size:11px">акт не закрыт</span>':'');
    mh+='<tr><td>'+r.ym+flag+'</td><td style="color:var(--ink-2)">'+pmN(r.business)+'</td>'
      +'<td class="r">'+pmRub(r.sm)+'</td><td class="r" style="color:#E5B567">'+pmRub(r.sp)+'</td>'
      +'<td class="r">'+pmRub(r.oh)+'</td><td class="r"><b>'+pmRub(r.spend)+'</b></td>'
      +'<td class="r">'+pmRub(r.base)+'</td>'
      +'<td class="r"'+(r.drr!=null&&r.drr>30?' style="color:var(--dn)"':'')+'>'+(r.drr==null?'нет базы':r.drr+'%')+'</td></tr>';});
  document.getElementById('pm-mon').innerHTML=mh+'</tbody>';
  // по SKU за последний закрытый месяц
  var agg={};
  ms.forEach(function(m){ if(m.ym!==lastYm)return;
    if(!headRows.some(function(h){return h.business===m.business;}))return;
    m.rows.forEach(function(r){var sp=0;PM_ART.forEach(function(a){sp+=((r.svc||{})[a]||0)+((r.svc_pts||{})[a]||0);});
      var o=agg[r.sku]||(agg[r.sku]={sku:r.sku,name:r.name,line:r.line||'прочее',sp:0,rev:0,un:0});
      o.sp+=sp;o.rev+=r.revenue_money+r.points_accrued;o.un+=r.units_net;});});
  var list=Object.keys(agg).map(function(k){return agg[k];}).filter(function(x){return x.sp>0;}).sort(function(x,y){return y.sp-x.sp;});
  var lab=lastYm?('за '+lastYm):'закрытых месяцев нет';
  document.getElementById('pm-lab1').textContent=lab;
  document.getElementById('pm-lab3').textContent=lab+(list.length>40?' · топ-40 из '+list.length:'');
  var lines={};list.forEach(function(x){var c=lines[x.line]||(lines[x.line]={sp:0,rev:0});c.sp+=x.sp;c.rev+=x.rev;});
  var lh='<thead><tr><th>Линия</th><th class="r">Расход</th><th class="r">Выручка</th><th class="r">ДРР</th></tr></thead><tbody>';
  Object.keys(lines).sort(function(a,b){return lines[b].sp-lines[a].sp;}).forEach(function(l){var v=lines[l];
    var d=v.rev>0?Math.round(v.sp/v.rev*1000)/10:null;
    lh+='<tr><td>'+l+'</td><td class="r">'+pmRub(v.sp)+'</td><td class="r">'+pmRub(v.rev)+'</td>'
      +'<td class="r"'+(d!=null&&d>30?' style="color:var(--dn)"':'')+'>'+(d==null?'—':d+'%')+'</td></tr>';});
  document.getElementById('pm-line').innerHTML=lh+'</tbody>';
  var hungry=list.filter(function(x){return x.rev>0&&x.sp/x.rev>0.3;});
  var hSum=hungry.reduce(function(a,x){return a+x.sp;},0);
  document.getElementById('pm-lab2').textContent=lab;
  document.getElementById('pm-hungry').innerHTML=hungry.length
    ? '<b style="font-size:15px">'+hungry.length+' SKU с ДРР выше 30%</b> на '+pmRub(hSum)+' ₽ расхода.<div class="kt-note" style="margin-top:8px">Буст Маркета списывается процентом с продажи, поэтому высокий ДРР тут значит высокую ставку буста, а не «плохие клики». Снижать его надо ставкой буста в кабинете, а не отключением кампании: отключать нечего.</div>'
    : '<b>SKU с ДРР выше 30% нет.</b><div class="kt-note" style="margin-top:8px">Ни один артикул не отдал больше 30% выручки на продвижение.</div>';
  var sh='<thead><tr><th>Артикул</th><th>Название</th><th class="r">Расход</th><th class="r">Выручка</th><th class="r">Штук</th><th class="r">ДРР</th></tr></thead><tbody>';
  list.slice(0,40).forEach(function(x){var d=x.rev>0?Math.round(x.sp/x.rev*1000)/10:null;
    sh+='<tr><td>'+x.sku+'</td><td>'+(x.name||'').slice(0,44)+'</td><td class="r">'+pmRub(x.sp)+'</td>'
      +'<td class="r">'+pmRub(x.rev)+'</td><td class="r">'+x.un+'</td>'
      +'<td class="r"'+(d!=null&&d>30?' style="color:var(--dn)"':'')+'>'+(d==null?'нет выручки':d+'%')+'</td></tr>';});
  document.getElementById('pm-sku').innerHTML=sh+'</tbody>';
}
// Шелл Кати дёргает render(cur,cmp) на каждой смене периода в шапке - функция обязана быть на
// любом листе. Этому листу период из шапки не применим: свод живёт месяцами по дате оформления
// заказа, а не произвольным диапазоном. Поэтому render ничего не делает, а в шапке листа прямо
// сказано, по какому периоду он считается - иначе кнопки периода молча врали бы.
function render(cur,cmp){}
function pmInit(){
  var bs={};(PM.months||[]).forEach(function(m){if(m.rows.length)bs[m.business]=1;});
  var sel=document.getElementById('pm-b');if(!sel)return;
  sel.innerHTML='<option value="all">все кабинеты</option>'+Object.keys(bs).sort().map(function(x){return '<option value="'+x+'">'+pmN(x)+'</option>';}).join('');
  sel.onchange=pmDraw;pmDraw();
}
pmInit();
`;
  return { body, js };
}

// JS свода по дате заказа для katya-money. Пустая строка у OZON: секции там нет, и вешать на
// несуществующие узлы нечего.
// В браузер уходит компактная копия свода: имена товаров там не нужны (в таблице их нет по
// просьбе Ивана, а категорию считаем здесь же), суммы округляем до копейки. Без этого дневные
// строки раздували страницу: полный свод весит 2.3 МБ, из них больше половины - названия.
function svodLite(svod: any): any {
  const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
  const NUM = ["units_delivered", "units_returned", "units_net", "price", "ship_buyer", "disc_mp", "disc_plus",
    "buyer_pay", "refunds", "revenue_money", "points_accrued", "svc_money", "svc_points", "svc_total",
    "result_money", "result_points", "cogs"];
  return {
    ...svod,
    months: (svod.months || []).map((m: any) => ({
      ...m,
      rows: (m.rows || []).map((row: any) => {
        const o: any = { business: row.business, ym: row.ym, d: row.d, sku: row.sku, cogs_known: row.cogs_known };
        for (const k of NUM) if (row[k]) o[k] = r2(row[k]);
        const svc: Record<string, number> = {};
        for (const [k, v] of Object.entries(row.svc || {})) if (v) svc[k] = r2(v as number);
        if (Object.keys(svc).length) o.svc = svc;
        return o;
      }),
    })),
  };
}

function svodJs(svod: any): string {
  if (IS_OZON || !svod || !svod.months || !svod.months.length) return "";
  // Категория артикула: сперва размеченная таксономия, затем эвристика по названию - та же, что
  // работает для OZON. На данных Маркета связка закрывает 100% выручки (в самой таксономии
  // размечено только 55%), поэтому строки «Без категории» в своде не появляется.
  // Блокеры реконсилятора - это пробелы СБОРА, а не расчёта, и по §15 п.3 они должны быть видны
  // пользователю. Без них страница молчала про то, что отчёт о реализации за август добран на
  // 1 магазин из 7, то есть штуки закрытого месяца не сверены ни с чем.
  let rec: string[] = [];
  try {
    const rj = JSON.parse(readFileSync(dp("reconcile.json"), "utf-8"));
    if (rj && rj.verdict !== "ok") rec = (rj.blockers || []).map((x: any) => String(x));
  } catch { rec = []; }
  const cat: Record<string, string> = {};
  const nameOf: Record<string, string> = {};
  for (const m of svod.months) for (const r of m.rows) {
    if (cat[r.sku]) continue;
    nameOf[r.sku] = r.name || "";
    cat[r.sku] = taxOf(r.sku).category || autoTax(r.name || "").category || "Без категории";
  }
  const COLS: Array<[string, string[]]> = [
    // Порядок и состав - как в файле Ивана «свод июль». Штрафы он складывает в «Размещение», и
    // здесь так же. Приём и перевод платежа, подписка, обработка и хранение сведены в «Прочее»
    // по просьбе Ивана: по отдельности это копейки (37 ₽ приёма платежа за июль против 281 129 ₽
    // перевода), а четыре колонки ради них разгоняли таблицу вширь. Внутри «Прочего» ничего не
    // теряется: имена статей перечислены здесь, сумма статей по-прежнему равна денежной ноге услуг.
    ["Размещение", ["Размещение (комиссия)", "Штрафы (не вовремя)"]],
    ["Программа лояльности и отзывы", ["Программа лояльности и отзывы"]],
    ["Продвижение", ["Буст продаж", "Полка", "Товарные баннеры"]],
    ["Доставка", ["Доставка покупателю", "Доставка (средняя миля)", "Доставка невыкупов и возвратов"]],
    ["Прочее", ["Приём платежа покупателя", "Перевод платежа покупателя", "Подписка",
                "Обработка в СЦ/ПВЗ", "Хранение", "Прочие услуги"]],
  ];
  return `
var SV=${JSON.stringify(svodLite(svod))};
var SV_COLS=${JSON.stringify(COLS)};
var SV_CAT=${JSON.stringify(cat)};
var SV_OPEN={};
var SV_REC=${JSON.stringify(rec)};
var SV_NAMES={"74986385":"GEN GROUP (мебель)","1023124":"GENGLASS (зеркала)"};
function svN(b){return SV_NAMES[b]||('кабинет '+b);}
function svRub(n){return fmtRu(Math.round(n||0));}
// Период свод берёт из ЕДИНОГО фильтра наверху страницы: своих выпадашек у него больше нет.
// window.__guruPeriod шелл проставляет перед каждым вызовом render, поэтому здесь всегда свежее
// окно. Кабинеты не фильтруются - показываются все сразу.
function svWin(){var p=(window.__guruPeriod||{});return {from:p.curFrom||'0000-01-01',to:p.curTo||'9999-12-31'};}
// Окно передаётся аргументом, а не только берётся из фильтра: план на месяц спрашивает у свода
// ДРУГОЙ период (выбранный месяц), и без параметра ему пришлось бы считать своей копией логики.
// Копия и была причиной того, что план и таблица на одной странице давали разную чистую прибыль.
function svPick(w){w=w||svWin();
  // месяц берём, если он ПЕРЕСЕКАЕТСЯ с окном: строки внутри отфильтруются по своей дате
  return (SV.months||[]).filter(function(x){return x.ym>=w.from.slice(0,7)&&x.ym<=w.to.slice(0,7);});}
function svInWin(d,w){w=w||svWin();return d>=w.from&&d<=w.to;}
function svAgg(ms,w){
  w=w||svWin();
  var a={};ms.forEach(function(m){m.rows.forEach(function(r){if(!svInWin(r.d,w))return;var k=r.sku,o=a[k];
    if(!o){o=a[k]={sku:r.sku,name:r.name,un:0,price:0,priceNet:0,ship:0,dmp:0,rev:0,pts:0,sm:0,sp:0,cogs:0,ck:r.cogs_known,svc:{}};}
    // ||0 обязателен: в страницу уходит компактная копия свода, где нулевые поля просто не
    // записаны. Без защиты первая же строка с нулевыми штуками давала NaN во всём итоге.
    // «Продажи» с вычетом возвратов. Прайс строки относится ко ВСЕМ доставленным штукам, поэтому
    // вернувшуюся долю снимаем пропорционально: у полностью возвращённого артикула остаётся ноль,
    // как и у штук с выручкой. Раньше колонка показывала прайс целиком, и два полностью
    // возвращённых артикула июля стояли с продажами 71 820 и 24 897 при нуле проданных штук.
    var _d=r.units_delivered||0,_n=r.units_net||0;
    o.priceNet+=_d>0?((r.price||0)*_n/_d):(r.price||0);
    o.un+=r.units_net||0;o.price+=r.price||0;o.ship+=r.ship_buyer||0;o.dmp+=r.disc_mp||0;o.rev+=r.revenue_money||0;
    o.pts+=r.points_accrued||0;o.sm+=r.svc_money||0;o.sp+=r.svc_points||0;o.cogs+=r.cogs||0;o.ck=o.ck&&r.cogs_known;
    SV_COLS.forEach(function(p){var v=0;p[1].forEach(function(n){v+=(r.svc||{})[n]||0;});o.svc[p[0]]=(o.svc[p[0]]||0)+v;});});});
  // Недоставленные заказы периода, по артикулам. В расчёт не идут ни одной строкой: свод считает
  // только доставленное. Артикул, у которого доставок нет вовсе, заводится отдельной строкой с
  // нулями - по сентябрю таких 51 из 61, и без них колонка «в пути» показывала бы меньшинство.
  // ck=true у пустой строки нарочно: она не «без себестоимости», а «ещё не продана», и в счётчик
  // «N без С\\С» у категории попадать не должна. Нули в расчёт ничего не вносят.
  ms.forEach(function(m){(m.inflight_rows||[]).forEach(function(r){
    if(!svInWin(r.d,w))return;
    var o=a[r.sku]||(a[r.sku]={sku:r.sku,name:r.sku,un:0,price:0,priceNet:0,ship:0,dmp:0,rev:0,pts:0,sm:0,sp:0,cogs:0,ck:true,svc:{},fly:0,flyP:0,flyOnly:true});
    o.fly=(o.fly||0)+(r.units||0); o.flyP=(o.flyP||0)+(r.price||0);});});
  return Object.keys(a).map(function(k){return a[k];}).sort(function(x,y){return y.rev-x.rev;});
}
// Общие расходы кабинета за окно: сумма деньгами/баллами И разбивка по статьям.
// Берутся ПО ДНЯМ, попавшим в окно. Раньше этот цикл жил внутри svDraw месячным итогом, и при
// периоде короче месяца в него попадали расходы дней, которых в периоде нет: за «7 дн» подписка
// за весь месяц вычиталась целиком. У акта есть дата оказания услуги, у реестра - дата проводки,
// поэтому день известен у обоих источников. Одна функция на таблицу, водопад, план и блок
// «Общие расходы»: второй похожий цикл гарантированно разошёлся бы с первым.
function svOverhead(ms,w){
  w=w||svWin();
  var o={m:0,p:0,c:{},act:0,ledger:0,shrink:0,shrinkN:0,ptsRep:0,ptsRepN:0,ptsNoAct:0};
  ms.forEach(function(mm){
    if(mm.overhead_src==='act')o.act++;else o.ledger++;
    // Акт замещает реестр целиком. Где он МЕНЬШЕ реестра, расходы на экране уменьшаются не
    // потому, что кабинет меньше списал, а потому, что сменился источник. Копим разницу, чтобы
    // сказать это вслух, а не оставить пользователя с необъяснимо подешевевшим месяцем.
    if(mm.overhead_src==='act'){
      var led=mm.overhead_ledger||0, got=(mm.overhead_money||0)+(mm.overhead_points||0);
      if(led-got>0.5){o.shrink+=(led-got);o.shrinkN++;}
    }
    // Третий источник тех же расходов: списания баллов уровня кабинета по отчёту о баллах.
    // Он не всегда сходится с актом, а там, где акта ещё нет, он вообще единственный. Не
    // складываем (двойной счёт), а копим для честного текста о расхождении.
    var rep=mm.overhead_points_report||0, gotP=mm.overhead_points||0;
    if(rep-gotP>0.5){o.ptsRep+=(rep-gotP);o.ptsRepN++;if(mm.overhead_src!=='act')o.ptsNoAct+=(rep-gotP);}
    var od=mm.overhead_daily||{};
    Object.keys(od).forEach(function(dd){
      if(!svInWin(dd,w))return;
      o.m+=od[dd].m||0;o.p+=od[dd].p||0;
      // c может не быть у снимка, собранного прежней версией derive - тогда сумма есть,
      // а разбивки нет, и блок статей честно покажет остаток строкой «без разбивки».
      var cc=od[dd].c||{};
      Object.keys(cc).forEach(function(col){var v=cc[col]||[0,0];var t=o.c[col]||(o.c[col]=[0,0]);t[0]+=v[0]||0;t[1]+=v[1]||0;});
    });
  });
  return o;
}
function svDraw(){
  var ms=svPick();
  var cov=document.getElementById('sv-cov'),gapsEl=document.getElementById('sv-gaps'),noteEl=document.getElementById('sv-note');
  if(!ms.length){document.getElementById('sv-t').innerHTML='';cov.textContent='За выбранный период доставленных заказов в снимке нет. Период задаётся фильтром наверху страницы.';gapsEl.style.display='none';noteEl.textContent='';return;}
  var orders=0,periodOrd=0,inflight=0,noLed=0,acts={},outSt=0,outMi=0,outMiN=0,ptsDel=0,ptsOrd=0,ptsDed=0,ptsRepSpent=0,missAcc=0,missOrd=0;
  var oh=svOverhead(ms),ohM=oh.m,ohP=oh.p,ohAct=oh.act,ohLed=oh.ledger;
  ms.forEach(function(m){orders+=m.orders;periodOrd+=m.orders_period||0;inflight+=m.orders_inflight||0;noLed+=m.orders_without_ledger||0;
    outSt+=m.ledger_status||0;outMi+=m.ledger_missing||0;outMiN+=m.ledger_missing_orders||0;ptsDel+=m.points_on_delivery||0;
    if(m.points_src!=='report')ptsOrd++;ptsDed+=m.points_ded||0;ptsRepSpent+=m.points_spent_report||0;missAcc+=m.missing_accrued||0;missOrd+=m.missing_accrued_orders||0;
    (m.svc_months||[]).forEach(function(x){acts[x]=1;});});
  var partial=inflight>0;
  var w=svWin();
  cov.innerHTML='период: <b>'+w.from+' .. '+w.to+'</b> · все кабинеты'
    +' · заказов за месяцы периода: <b>'+orders+(periodOrd>orders?' из '+periodOrd+' оформленных':'')+'</b>'
    +' · услуги из актов: <b>'+(Object.keys(acts).sort().join(', ')||'нет')+'</b>'
    +(partial?' · <span style="color:#E5B567">период не завершён: '+inflight+' заказов ещё в пути</span>':'');
  var gaps=[];
  // Зрелость месяца. Услуги по заказам месяца Маркет списывает и в СЛЕДУЮЩЕМ месяце: по замеру за
  // февраль-август в свой месяц приходит около двух третей суммы, остальное в следующий, после +2
  // практически ничего. Поэтому месяц, следующий за которым ещё не прожит, показывает неполные
  // расходы и завышенную прибыль. Признак берём из данных: докуда собран реестр платежей.
  var lgTo=SV.ledger_to||'';
  if(lgTo){
    var young=ms.map(function(m){return m.ym;}).filter(function(ym,i,arr){return arr.indexOf(ym)===i;})
      .filter(function(ym){
        var y=+ym.slice(0,4), mo=+ym.slice(5,7);            // конец следующего месяца
        var end=new Date(Date.UTC(mo===12?y+1:y, mo===12?1:mo+1, 0)).toISOString().slice(0,10);
        return lgTo<end;
      }).sort();
    if(young.length)gaps.push('<b>Месяц ещё дозревает: '+young.join(', ')+'.</b> '
      +'Услуги по заказам месяца Маркет списывает и в следующем месяце - по закрытым месяцам в свой месяц приходит около двух третей суммы, остальное в следующий. '
      +'Реестр платежей собран по '+lgTo+', поэтому расходы этих месяцев НЕПОЛНЫЕ, а прибыль завышена. '
      +'Досчитается само: свод пересчитывается целиком на каждом прогоне, и месяц дорастёт задним числом.');
  }
  // Пробел выгрузки заказов. Самый крупный на странице, поэтому идёт первым: это не «неточность»,
  // а целые заказы, которых в своде нет ни выручкой, ни услугами.
  if(missOrd)gaps.push('<b>'+missOrd+' заказов на '+svRub(missAcc)+' ₽ начислений не попали в свод вовсе.</b> '
    +'Реестр платежей их знает, а карточки заказа (дата, статус, штуки) в выгрузке нет, поэтому свод по доставленным заказам их не видит: '
    +'ни выручки, ни услуг, ни себестоимости по ним в цифрах выше НЕТ. '
    +'Известная причина - кампании кабинета, закрытые Маркетом для API по неактивности: их заказы вытянуть нечем. '
    +'Месяц такого заказа взят по первой проводке реестра, даты заказа у нас про него не существует.');
  if(partial)gaps.push('период не завершён: '+inflight+' заказов месяца ещё в пути, выручка и услуги по ним добавятся позже');
  if(noLed)gaps.push(noLed+' заказов периода ещё нет в отчёте по платежам: их услуги равны нулю, результат по ним завышен');
  // Показываем не мнимый пробел, а реальную величину возврата начисления, которую пользователь
  // иначе не увидит. Комментарий про «отдельного отчёта по баллам в API нет вовсе» был неверен и
  // снят: отчёт есть, это reports/united-netting с телом monthOfYear, и месячный итог берётся
  // из него (points_src="report").
  if(ptsDed)gaps.push('из баллов за скидку '+svRub(ptsDed)+' ₽ Маркет забрал обратно при невыкупе и возврате: в своде баллы показаны за вычетом списания');
  // Когда выбраны оба кабинета, у одного расходы могут идти из акта, у другого из реестра.
  // Текст «показаны только по отчёту о платежах» в этом случае врёт наполовину, поэтому говорим,
  // по скольким кабинетам акта не хватает.
  // Сторож третьего источника: отчёт о баллах знает о кабинетных тратах больше, чем акт.
  if(oh.ptsRepN)gaps.push('отчёт о баллах Маркета показывает на '+svRub(oh.ptsRep)+' ₽ больше кабинетных списаний баллами (Полки, Буст за показы), чем видно в расходах'
    +(oh.ptsNoAct>0.5?', из них '+svRub(oh.ptsNoAct)+' ₽ за месяцы без акта - в цифрах выше их нет вовсе':'')
    +'. В расчёт они не добавлены намеренно: акт и отчёт о баллах не сводятся друг к другу (в части месяцев баллы есть у обоих и расходятся, в части - только у одного), поэтому ни сложить, ни заменить нельзя без отчёта об исполнении поручения из кабинета');
  // Сторож смены источника: сумма упала не по делу, а по замене реестра актом.
  if(oh.shrinkN)gaps.push('по '+oh.shrinkN+' кабинето-месяцам акт по стоимости услуг оказался меньше отчёта о платежах на '+svRub(oh.shrink)+' ₽: акт замещает реестр целиком, поэтому эта разница ушла из расходов вместе со сменой источника, а не потому, что кабинет меньше списал');
  if(ohLed)gaps.push(ohAct
    ? 'по '+ohLed+' из '+(ohAct+ohLed)+' кабинетов общие расходы взяты только из отчёта о платежах: акт по стоимости услуг за этот месяц по ним ещё не собран, поэтому полки, подписки и буст за показы там не учтены'
    : 'общие расходы показаны только по отчёту о платежах: полки, подписки и буст за показы берутся из акта по стоимости услуг, а он за этот месяц ещё не собран');
  if(outSt)gaps.push(svRub(outSt)+' ₽ сборов акта относятся к заказам периода с другим статусом (возвраты, отмены в доставке)');
  if(outMi)gaps.push(svRub(outMi)+' ₽ сборов акта относятся к '+outMiN+' заказам, которых нет в выгрузке заказов - это пробел сбора');
  if(ptsDel)gaps.push(svRub(ptsDel)+' ₽ начисленных баллов осели на строке доставки и в свод не попали');
  SV_PTS_REP=ptsRepSpent;
  var list=svAgg(ms);
  var noCogs=list.filter(function(x){return !x.ck;}).length;
  if(noCogs)gaps.push('у '+noCogs+' SKU нет себестоимости: валовая прибыль по ним не считается, а не равна выручке');
  // Пробелы сбора из реконсилятора. Деньги он сверяет с отчётом о платежах (расхождение 0.01%),
  // а штуки - с отчётом о реализации, и вот там покрытие неполное. Молчать об этом нельзя:
  // пользователь видел бы штуки закрытого месяца как сверенные.
  SV_REC.forEach(function(x){gaps.push(x);});
  // Иван 18.09.2026: «вот такие приписки скрой». Пробел в данных прятать нельзя (§15 п.3),
  // но и разворачивать простынёй поверх таблицы незачем: сворачиваем в одну строку.
  gapsEl.innerHTML=gaps.length?'<details><summary style="cursor:pointer;color:#a78a4a;list-style:none">чего не хватает в данных ('+gaps.length+')</summary><div style="padding-top:5px"><b>Чего не хватает:</b> '+gaps.join('; ')+'.</div></details>':'';
  gapsEl.style.display=gaps.length?'':'none';
  // Окно без ДОСТАВЛЕННЫХ заказов таблицей не рисуется, даже если в нём есть заказы в пути.
  // Иначе вернулся бы дефект, который ФЕНИКС нашёл раньше: за 28.02 таблица пуста, а водопад
  // заявлял «Чистая прибыль 147 464 ₽». Заказы в пути - это не продажи, это ожидание, и
  // показывать их строками P&L нельзя. Сколько их - говорим текстом.
  var soldRows=list.filter(function(x){return !x.flyOnly;}).length;
  if(!soldRows){
    document.getElementById('sv-t').innerHTML='';
    var fu=0,fp=0; list.forEach(function(x){fu+=x.fly||0;fp+=x.flyP||0;});
    cov.innerHTML='За выбранный период доставленных заказов в снимке нет. Период задаётся фильтром наверху страницы.'
      +(fu?' <span style="color:#E5B567">Заказано, но ещё не доставлено: '+fu+' шт на '+svRub(fp)+' ₽ - попадут в продажи этого периода, когда доедут.</span>':'');
    noteEl.textContent='';
    return;
  }
  svTabPnl(list,ohM,ohP,noteEl);
}
// Группировка по категориям и итоги свода - ОДНА реализация на всех потребителей: таблицу
// P&L, водопад, план на месяц и блок общих расходов. Пока каждый считал по-своему, страница
// сама себе противоречила: за июль план показывал чистую -294 510 ₽, а таблица ниже 140 942 ₽.
// Возвращает calc (расчёт одной строки), groups (категории), T (итоги), TC (итоги по услугам),
// gpT/npT (валовая и чистая с уже вычтенными общими расходами кабинета).
// Тождества, на которых стоит водопад: T.gp = T.cover - T.cogs и T.np = T.gp - T.adm - T.tax
// (непокрытая категория даёт cov=0 и cogs=0 в обе части, поэтому равенства точные).
var SV_PTS_REP=0;   // сколько баллов Маркет списал за месяцы окна ПО СВОЕМУ ОТЧЁТУ (справочно)
function svCalcAll(list,ohM,ohP,adm,tax){
  // Раскладка Ивана (его файл «свод июль», сверена с ним до копейки на артикуле GGT-35-1-3-100-180):
  //   Поступление = Продажи + Доставка покупателя − сборы по статьям − общие расходы − Баллы Маркета
  //   Валовая = Поступление − СС;  АДМ и Налоги − от Поступления;  Чистая = Валовая − АДМ − Налоги
  // Отличия от прежней базы: доход берётся ПРАЙСОМ, а не платежом покупателя (скидку Маркета он
  // возвращает баллами, поэтому она и доход, и расход одновременно), услуги, оплаченные баллами,
  // входят в расход, а общие расходы кабинета разносятся по артикулам ПО ШТУКАМ - так же, как у
  // Ивана: 41 298,43 по мебели на 108 штук дают 1 911,96 на артикул с пятью штуками.
  var unAll=0; list.forEach(function(a){unAll+=a.un||0;});
  var ohPer=unAll>0?((ohM||0)+(ohP||0))/unAll:0;
  function calc(a){
    var fee=0;SV_COLS.forEach(function(p){fee+=a.svc[p[0]]||0;});
    var oh=ohPer*(a.un||0);
    var net=(a.priceNet||0)+(a.ship||0)-fee-oh-(a.sp||0);
    var isG=(a.netCov!=null);                            // строка категории, а не артикула
    var cov=isG?a.netCov:(a.ck?net:0);                   // поступление по покрытым С\С артикулам
    var covered=isG?(a.rows.length>a.noCogs):a.ck;
    var gp=covered?cov-a.cogs:null, av=cov*adm, tv=cov*tax;
    return {fee:fee,oh:oh,net:net,cov:cov,covered:covered,gp:gp,adm:av,tax:tv,np:(gp===null)?null:gp-av-tv};
  }
  // группировка по категориям
  var cats={};
  list.forEach(function(a){var c=SV_CAT[a.sku]||'Без категории';
    var g=cats[c]||(cats[c]={cat:c,rows:[],un:0,price:0,priceNet:0,ship:0,dmp:0,rev:0,sp:0,cogs:0,ck:true,netCov:0,noCogs:0,svc:{},fly:0,flyP:0});
    SV_COLS.forEach(function(p){g.svc[p[0]]=(g.svc[p[0]]||0)+(a.svc[p[0]]||0);});
    g.rows.push(a);g.un+=a.un;g.price+=a.price;g.priceNet+=a.priceNet||0;g.ship+=a.ship;g.dmp+=a.dmp;g.rev+=a.rev;g.sp+=a.sp||0;g.fly+=a.fly||0;g.flyP+=a.flyP||0;
    if(a.ck){g.cogs+=a.cogs;g.netCov+=calc(a).net;} else {g.ck=false;g.noCogs++;}});
  var groups=Object.keys(cats).map(function(k){return cats[k];}).sort(function(x,y){return calc(y).net-calc(x).net;});
  var T={un:0,price:0,priceNet:0,ship:0,dmp:0,rev:0,sp:0,cogs:0,net:0,gp:0,adm:0,tax:0,np:0,cover:0,fee:0,oh:0,fly:0,flyP:0},TC={};
  SV_COLS.forEach(function(p){TC[p[0]]=0;});
  groups.forEach(function(g){
    var c=calc(g);
    T.un+=g.un;T.price+=g.price;T.priceNet+=g.priceNet;T.ship+=g.ship;T.dmp+=g.dmp;T.rev+=g.rev;T.sp+=g.sp;
    T.net+=c.net;T.adm+=c.adm;T.tax+=c.tax;T.fee+=c.fee;T.oh+=c.oh;T.fly+=g.fly||0;T.flyP+=g.flyP||0;
    SV_COLS.forEach(function(p){TC[p[0]]+=g.svc[p[0]]||0;});
    T.cogs+=g.cogs;if(c.gp!==null){T.gp+=c.gp;T.np+=c.np;}T.cover+=c.cov;});
  // Общие расходы уже сидят внутри net каждой строки, поэтому второй раз их не вычитаем.
  // Строки, у которых есть доставки. Окно без них - это «нет доставленных заказов», и водопад с
  // планом обязаны молчать. Без этого счётчика добавление колонок «в пути» сделало бы пустое окно
  // непустым и вернуло бы дефект, который ФЕНИКС нашёл раньше: за 28.02 таблица пуста, а водопад
  // заявлял «Чистая прибыль 147 464 ₽».
  var sold=0; list.forEach(function(a){if(!a.flyOnly)sold++;});
  return {calc:calc,groups:groups,T:T,TC:TC,ohPer:ohPer,gpT:T.gp,npT:T.np,sold:sold};
}
// Итоги свода за ЛЮБОЕ окно - единая точка входа для водопада, плана и блока общих расходов.
// Ставки АДМ/налогов берутся из тех же полей страницы, что и у таблицы, чтобы правка ставки
// меняла все блоки разом. Возвращает null, когда за окно нет ни одного месяца свода.
// Общие расходы кабинета по ОДНОЙ группе SV_COLS (деньги плюс баллы). Раньше план складывал
// одно сырое имя услуги «Буст продаж» и поэтому занижал продвижение: полка и товарные баннеры
// в него не попадали, и на экране «Продвижение» жило тремя разными числами.
function svOhGroup(oh,group){
  var names=null; SV_COLS.forEach(function(p){if(p[0]===group)names=p[1];});
  if(!names)return 0;
  var v=0; names.forEach(function(n){var c=(oh.c||{})[n]||[0,0];v+=(c[0]||0)+(c[1]||0);});
  return v;
}
// Таблицы «Аналитика по артикулам» на Маркете больше нет: Иван убрал её 17.09 - она
// отвечала на «за что заплатили» теми же статьями свода и дублировала его. Функция
// svSkuTable удалена вместе с блоком, а не оставлена «на всякий случай»: код, который
// рисует в несуществующий элемент, однажды оживает по ошибке и тихо расходится с данными.
function svTotals(w){
  w=w||svWin();
  var ms=svPick(w); if(!ms.length)return null;
  var list=svAgg(ms,w), oh=svOverhead(ms,w);
  var ae=document.getElementById('sv-adm'), te=document.getElementById('sv-tax');
  var adm=Number((ae&&ae.value)||30)/100, tax=Number((te&&te.value)||15)/100;
  var R=svCalcAll(list,oh.m,oh.p,adm,tax), T=R.T;
  var ohTot=oh.m+oh.p;
  return {
    win:w, months:ms, list:list, oh:oh, ohTot:ohTot, R:R, T:T, TC:R.TC,
    units:T.un,                       // штук нетто (доставлено − возвраты)
    rev:T.rev,                        // выручка деньгами: платёж покупателя − возвраты
    fee:T.fee,                        // услуги Маркета по заказам
    net:T.net,                        // поступление: общие расходы уже внутри строк (разнесены по штукам)
    cover:T.cover,                    // база с известной С\С
    cogs:T.cogs, gp:R.gpT, adm:T.adm, tax:T.tax, np:R.npT,
    rent:(T.cover>0)?R.npT/T.cover*100:null,
    marg:(T.cover>0)?R.gpT/T.cover*100:null,
    empty:R.sold===0
  };
}
function svTabPnl(list,ohM,ohP,noteEl){
  var adm=Number(document.getElementById('sv-adm').value||30)/100, tax=Number(document.getElementById('sv-tax').value||15)/100;
  // Раскладка колонок - как в файле Ивана «свод июль». Строка любого уровня считается одинаково:
  // категория это сумма своих артикулов, поэтому раскрытие не может дать другую арифметику.
  var R=svCalcAll(list,ohM,ohP,adm,tax), calc=R.calc, groups=R.groups, ohPer=R.ohPer;
  var FEE=SV_COLS.map(function(p){return p[0];});
  // Отдельной колонки «Общие расходы» больше нет: расходы кабинета (полки, подписки, баннеры,
  // буст за показы) входят в «Прочее». Они и раньше вычитались из Поступления, просто стояли
  // своим столбцом; спрятать их совсем нельзя - строка перестала бы сходиться.
  // «Поступление на штуку» и «С\С за штуку» убраны: обе получаются делением соседних колонок.
  var H=['Категория / Артикул','Продажи','Доставка покупателя'].concat(FEE)
    .concat(['Баллы Маркета','Штуки','Поступление','С\\С произв.',
             'Валовая прибыль','Маржа','АДМ','Налоги','Чистая прибыль','Рентаб.',
             'В пути, шт','В пути, ₽']);
  var h='<thead><tr>'+H.map(function(x,i){return '<th'+(i?' class="r"':'')+'>'+x+'</th>';}).join('')+'</tr></thead><tbody>';
  var T=R.T,TC=R.TC;
  function svBase(c){return (c.gp===null||c.cov<=0||Math.round(c.cov)===Math.round(c.net))?'':' title="база: поступление по артикулам с известной С\\С, '+svRub(c.cov)+' ₽ из '+svRub(c.net)+' ₽"';}
  function money(v){return '<td class="r">'+(Math.round(v)?svRub(v):'—')+'</td>';}
  function per(v,u){return '<td class="r" style="color:var(--ink-3)">'+(u>0&&Math.round(v)?svRub(v/u):'—')+'</td>';}
  function cells(a,c){
    return '<td class="r"><b>'+svRub(a.priceNet||0)+'</b></td>'+money(a.ship)
      +FEE.map(function(n){return money((a.svc[n]||0)+(n==='Прочее'?c.oh:0));}).join('')
      +money(a.sp||0)
      +'<td class="r">'+a.un+'</td>'
      +'<td class="r"><b>'+svRub(c.net)+'</b></td>'
      +'<td class="r">'+(c.covered?svRub(a.cogs):'нет С\\С')+'</td>'
      +'<td class="r" style="color:'+(c.gp===null?'var(--ink-3)':(c.gp>=0?'var(--up)':'var(--dn)'))+'">'+(c.gp===null?'не считается':svRub(c.gp))+'</td>'
      +'<td class="r"'+svBase(c)+'>'+((c.gp===null||c.cov<=0)?'—':(Math.round(c.gp/c.cov*1000)/10)+'%')+'</td>'
      +money(c.adm)+money(c.tax)
      +'<td class="r" style="color:'+(c.np===null?'var(--ink-3)':(c.np>=0?'var(--up)':'var(--dn)'))+'">'+(c.np===null?'не считается':svRub(c.np))+'</td>'
      +'<td class="r"'+svBase(c)+'>'+((c.np===null||c.cov<=0)?'—':(Math.round(c.np/c.cov*1000)/10)+'%')+'</td>'
      +'<td class="r" style="color:var(--ink-3)">'+(a.fly?a.fly:'—')+'</td>'
      +'<td class="r" style="color:var(--ink-3)">'+(a.flyP?svRub(a.flyP):'—')+'</td>';
  }
  groups.forEach(function(g,gi){
    var c=calc(g), open=!!SV_OPEN[g.cat];
    h+='<tr class="sv-cat" data-cat="'+gi+'" style="cursor:pointer"><td><b>'+(open?'▾':'▸')+' '+g.cat+'</b> <span style="color:var(--ink-3)">('+g.rows.length+')</span>'+(g.noCogs?' <span style="color:#E5B567;font-size:11px">'+g.noCogs+' без С\\С</span>':'')+'</td>'+cells(g,c)+'</tr>';
    if(open) g.rows.forEach(function(a){var ac=calc(a);
      h+='<tr style="background:rgba(255,255,255,.02)"><td style="padding-left:22px;color:var(--ink-2)">'+a.sku+'</td>'+cells(a,ac)+'</tr>';});
  });
  // Месяц без строк - это не убыток: валовой прибылью и рентабельностью пустоту не называем.
  var some=groups.length>0, gpT=R.gpT, npT=R.npT;
  var mS=function(v){return (some&&T.cover>0)?(Math.round(v/T.cover*1000)/10)+'%':'—';};
  h+='</tbody><tfoot><tr style="border-top:2px solid var(--bd)"><td><b>ИТОГО</b></td>'
    +'<td class="r"><b>'+svRub(T.priceNet)+'</b></td><td class="r"><b>'+svRub(T.ship)+'</b></td>'
    +FEE.map(function(n){var v=(TC[n]||0)+(n==='Прочее'?(ohM+ohP):0);
        return '<td class="r"><b>'+(Math.round(v)?svRub(v):'—')+'</b></td>';}).join('')
    +'<td class="r"><b>'+svRub(T.sp)+'</b></td>'
    +'<td class="r"><b>'+T.un+'</b></td>'
    +'<td class="r"><b>'+svRub(T.net)+'</b></td>'
    +'<td class="r"><b>'+svRub(T.cogs)+'</b></td>'
    +'<td class="r"><b>'+(some?svRub(gpT):'—')+'</b></td>'
    +'<td class="r"'+svBase({gp:some?gpT:null,cov:T.cover,net:T.net})+'><b>'+mS(gpT)+'</b></td>'
    +'<td class="r"><b>'+svRub(T.adm)+'</b></td><td class="r"><b>'+svRub(T.tax)+'</b></td>'
    +'<td class="r"><b>'+(some?svRub(npT):'—')+'</b></td>'
    +'<td class="r"'+svBase({gp:some?npT:null,cov:T.cover,net:T.net})+'><b>'+mS(npT)+'</b></td>'
    +'<td class="r" style="color:var(--ink-3)"><b>'+(T.fly?T.fly:'—')+'</b></td>'
    +'<td class="r" style="color:var(--ink-3)"><b>'+(T.flyP?svRub(T.flyP):'—')+'</b></td></tr></tfoot>';
  var el=document.getElementById('sv-t');el.innerHTML=h;
  Array.prototype.forEach.call(el.querySelectorAll('.sv-cat'),function(tr){
    tr.onclick=function(){var g=groups[+tr.getAttribute('data-cat')];SV_OPEN[g.cat]=!SV_OPEN[g.cat];svDraw();};});
  noteEl.innerHTML='<b>Клик по категории раскрывает артикулы.</b> Категория берётся из таксономии, а где её нет - по названию товара.<br>'
    +'<b>Поступление</b> = Продажи + Доставка покупателя − сборы по статьям − Баллы Маркета. '
    +'Доход взят ПРАЙСОМ, а не платежом покупателя: часть цены Маркет закрывает своей скидкой и возвращает её баллами, поэтому скидка одновременно и доход, и расход. '
    +'Ровно поэтому услуги, оплаченные баллами, стоят расходом в колонке «Баллы Маркета».<br>'
    +'<b>Продажи с вычетом возвратов:</b> вернувшаяся штука дохода не принесла, и её доля прайса снята - так же, как сняты штуки и выручка.<br>'
    +'<b>Колонка «Баллы Маркета» сгруппирована по МЕСЯЦУ ЗАКАЗА, а кабинет группирует по месяцу списания.</b> '
    +'За выбранные месяцы здесь '+svRub(T.sp)+' ₽ услуг по заказам этих месяцев, а в отчёте «О баллах Маркета» за те же месяцы списано '+svRub(SV_PTS_REP)+' ₽ - по заказам любых месяцев. '
    +'Это два разных среза одних и тех же рублей: буст и комиссию по июльскому заказу Маркет может списать в августе. Сверять с кабинетом надо по номеру заказа, а не по итогу месяца.<br>'
    +'<b>Источник балльных чисел</b> - отчёт по баллам Маркета (reports/united-netting с телом monthOfYear, в кабинете «Финансы - Финансовые отчёты - О баллах Маркета»). '
    +'Услуги, оплаченные баллами, сверены с ним по номеру заказа и артикулу: по всем 1008 ключам кабинет+день+артикул расхождение ноль.<br>'
    +'<b>«Прочее»</b> - приём и перевод платежа, подписка, обработка и хранение, ПЛЮС расходы кабинета ('+svRub(ohM+ohP)+' ₽): полки, подписки, баннеры, буст за показы. '
    +'Расходы кабинета к товару не привязаны, поэтому разнесены по артикулам ПО ШТУКАМ ('+(T.un>0?svRub(ohPer):'0')+' ₽ на штуку) - прятать их из строки нельзя, иначе Поступление перестанет сходиться с колонками. Их разбивка по статьям - в блоке «Общие расходы» ниже.<br>'
    +'<b>Валовая прибыль</b> = Поступление − С\\С. АДМ и Налоги считаются от Поступления, Чистая = Валовая − АДМ − Налоги, Маржа и Рентабельность - к Поступлению.<br>'
    +'<b>«В пути»</b> - заказы периода, которые ещё не доставлены: штуки заказанные и цена по заказу. В расчёт НЕ входят ничем, свод считает только доставленное. Колонки справочные и показывают, чем месяц ещё дорастёт: заказ попадёт в продажи своего месяца задним числом, когда доедет, и вместе с ним придут его услуги и баллы - Маркет списывает их в день доставки.<br>'
    +'Итог по валовой прибыли, АДМ, налогам и чистой считается только по SKU с известной себестоимостью ('+(T.net>0?(Math.round(T.cover/T.net*1000)/10):0)+'% поступления) - наведите на процент, чтобы увидеть базу. Колонки DBS нет: собственный расход на доставку Partner API не отдаёт.';
}
function svInit(){
  if(!document.getElementById('sv-t'))return;
  ['sv-adm','sv-tax'].forEach(function(id){var e=document.getElementById(id);if(e)e.onchange=svDraw;});
  // Свод перерисовывается вместе со всей страницей: шелл зовёт render(cur,cmp) на каждой смене
  // периода, а window.__guruPeriod к этому моменту уже обновлён. Своего состояния периода у
  // свода нет - один фильтр на всю страницу, как и просил Иван.
  var base=(typeof render==='function')?render:null;
  render=function(cur,cmp){if(base)base(cur,cmp);svDraw();};
  svDraw();
}
svInit();
`;
}

// --- страница 0: КОМАНДНЫЙ ЦЕНТР (war-room, флагман Pro) ---
// Карточка оборота. У Маркета «оборот» одним числом врал: за 01-16.09 это 10,28 млн заказанного
// против 2,33 млн реально доставленного, потому что треть заказов отменяется, а половина ещё летит.
// Поэтому у Маркета карточка двузначная: слева заказано минус отменено, справа доставленное
// (accruals - деньги доставленного за вычетом возврата, ровно базис свода). Дельта считается по
// доставленному: это единственная из двух цифр, которая уже деньги, а не намерение.
// У OZON отчёт о заказах даёт нули в отменах, двух честных чисел не собрать - карточка прежняя.
// Та же база, что на командном центре: заказано минус отменено. У OZON отмены в отчёте нули,
// вычитать нечего - остаётся валовое.
const NET_BASE_LINE = IS_OZON
  ? `const gmv=v('rev'),gmvP=p('rev'),u=v('units'),uP=p('units'),vw=v('views'),vwP=p('views');`
  : `const gmv=v('rev')-v('rcanc'),gmvP=p('rev')-p('rcanc'),u=v('units')-v('canc'),uP=p('units')-p('canc'),vw=v('views'),vwP=p('views');`;
const NET_TIP = IS_OZON ? "" : " База - заказано минус отменено, то есть левое число карточки «Оборот»; оборот ÷ заказы сходится со средним чеком. Не доставленное: оно дозревает неделями, на свежем окне доставлена лишь малая часть заказов, и чек с ДРР скакали бы на ровном месте.";
const MONEY_GAP_CONST = IS_OZON ? "" : `const MONEY_GAP=${!MONEY_FIELDS_OK};`;
const KPI2_FN = IS_OZON ? "" : `
  const kpi2=(lab,v1,c1,v2,c2,dd,note,tp)=>'<div class="card"'+tip(tp)+'><div class="kt-k">'+lab+'</div><div style="display:flex;gap:16px;flex-wrap:wrap"><div><div class="kt-v" style="font-size:22px">'+v1+'</div><div class="kt-k" style="margin:3px 0 0;text-transform:none;letter-spacing:0;font-weight:500">'+c1+'</div></div><div><div class="kt-v" style="font-size:22px">'+v2+'</div><div class="kt-k" style="margin:3px 0 0;text-transform:none;letter-spacing:0;font-weight:500">'+c2+'</div></div></div>'+(note||'')+dd+'</div>';
  // Разрыв между числами - не только «в пути»: на закрытом месяце это возвраты и услуги
  // (в июле в пути 0 ₽, а разрыв 741 595 ₽). Поэтому строка под числами называет то, что
  // реально в разрыве за период, и живёт в разметке, а не в title: на телефоне подсказки
  // по наведению нет вовсе.
  function gapNote(cur){
    var f=function(k){return sW(D[k]||[],cur);},parts=[];
    if(Math.round(f('rfly')))parts.push('в пути '+fMln(f('rfly'))+' ₽');
    if(Math.round(f('rret')))parts.push('возвраты '+fMln(f('rret'))+' ₽');
    if(Math.round(f('rsvc')))parts.push('услуги '+fMln(f('rsvc'))+' ₽');
    return parts.length?'<div class="kt-k" style="margin:9px 0 0;text-transform:none;letter-spacing:0;font-weight:500">разрыв: '+parts.join(' · ')+'</div>':'';
  }
  // Дельта по доставленному честна только на дозревшем окне. Пока большинство заказов ещё
  // летит, доставленное физически не догонит базу: за 10-16.09 это давало бы ▼91.9% при
  // реальном движении бизнеса −13.8%. Красная стрелка такого размера на командном центре -
  // готовый ложный триггер Protocol 8, поэтому вместо неё честная пометка.
  function delivDelta(cur,cmp){
    var net=sW(D.rev,cur)-sW(D.rcanc,cur),fly=sW(D.rfly||[],cur);
    if(net>0&&fly/net>0.5)return '<span class="kt-d na">окно не дозрело: доставка ещё идёт</span>';
    return dlt(sW(D.racc,cur),sW(D.racc,cmp));
  }
`;
const GMV_KPI = IS_OZON
  ? `kpi('Оборот, ₽',fMln(gmv),dlt(gmv,gmvP),'GMV за период. Дельта к равному предыдущему окну.')`
  : `kpi2('Оборот, ₽',fMln(gmv),'заказано \u2212 отменено',fMln(v('racc')),'доставлено',delivDelta(cur,cmp),MONEY_GAP?'<div class="kt-d dn" style="margin-top:9px">снимок без полей о доставке: слева показано заказанное целиком</div>':gapNote(cur),'Слева заказано за вычетом отменённого, справа доставленное за вычетом возвратов. Разрыв - заказы в пути, возвраты и услуги доставки; услуги в правое число не попадут никогда. Доставленное сходится со сводом помесячно, кроме февраля: свод берёт только статус DELIVERED, здесь ещё PARTIALLY_DELIVERED, расхождение 65 940 ₽.')`;
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
    <section class="card"><div class="card-h"><div><div class="card-title">Декомпозиция оборота</div><div class="card-sub" id="bsub"></div></div></div><div id="bridge"></div><div class="kt-note">Оборот = трафик × конверсия в заказ × средний чек. Видно, какой из трёх рычагов дал прирост или просадку - туда и бить.${IS_OZON ? "" : " Все три множителя на той же базе, что левое число карточки «Оборот»: заказано минус отменено."}</div></section>
    <section class="card"><div class="card-h"><div><div class="card-title">Движения за период</div><div class="card-sub" id="movers-sub">кто прибавил и кто просел по обороту против предыдущего равного периода</div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Товар</th><th class="r">Оборот</th><th class="r">Δ к базе</th></tr></thead><tbody id="movers"></tbody></table></div></section>
  </div>
  <section class="card"><div class="card-h"><div><div class="card-title">Локомотивы и риск</div><div class="card-sub">A-товары (дают 80% оборота периода). Красный флаг - есть риск: OOS или дороже рынка</div></div></div><div class="kt-scroll"><table class="kt-table"><thead><tr><th>Товар</th><th>Линия</th><th class="r">Оборот</th><th class="r">Доля</th><th class="r">Остаток</th><th class="r">Индекс цены</th><th>Риск</th></tr></thead><tbody id="loco"></tbody></table></div></section>
  <style>@media (max-width:900px){.kt-two{grid-template-columns:1fr!important}}</style>`;
  const pageJs = `
const D=${J({ rev: DAY_T.rev, units: DAY_T.units, views: DAY_T.views, cart: DAY_T.cart, deliv: DAY_T.deliv, ret: DAY_T.ret, ...(IS_OZON ? {} : { rcanc: DAY_T.rcanc, racc: DAY_T.racc, rfly: DAY_T.rfly, rret: DAY_T.rret, rsvc: DAY_T.rsvc, canc: DAY_T.canc }) })};
const SKUS=${J(SKUS)};const LIVE=${J(LIVE)};${MONEY_GAP_CONST}const ADS=${J(ads)};const ADSP=${J(adsPeriodsCC)};
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
  ${NET_BASE_LINE}
  const cro=vw?u/vw:0,croP=vwP?uP/vwP:0,aov=u?gmv/u:0,aovP=uP?gmvP/uP:0;
  // KPI
  const kpi=(lab,val,dd,tp)=>'<div class="card"'+tip(tp)+'><div class="kt-k">'+lab+'</div><div class="kt-v">'+val+'</div>'+dd+'</div>';${KPI2_FN}
  document.getElementById('kpis').innerHTML=[
    ${GMV_KPI},
    kpi('Заказы, шт',fmtRu(u),dlt(u,uP),'${IS_OZON ? "Сколько штук заказали за период." : "Сколько штук заказали за период за вычетом отменённых. Та же база, что у левого числа карточки «Оборот», поэтому оборот ÷ заказы сходится со средним чеком."}'),
    kpi('Конверсия показ→заказ',(cro*100).toFixed(2)+'%',dlt(cro,croP),'Из скольких показов рождается заказ. Падает - проблема с карточкой/ценой/трафиком.'),
    kpi('Средний чек, ₽',fmtRu(aov),dlt(aov,aovP),'Оборот делить на заказы. Растёт - продаём дороже/комплектами.${NET_TIP}'),
    kpi('ДРР',(gmv?(Math.round(((adsForPeriod().totals||{}).spend||0)/gmv*1000)/10):0)+'%','<span class="kt-d na">снимок · за период</span>','Расход рекламы ÷ ВЕСЬ оборот за период (как ДРР в выгрузке OZON). Из ближайшего снимка 7/30/90.${NET_TIP}'),
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
  writeFileSync(op("katya-command.html"), kshell("Командный центр", "command", body, pageJs));
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
    const files = readdirSync(dp("competitors")).filter((f) => /^competitors_.*\.json$/.test(f)).sort();
    if (files.length) {
      const snap = JSON.parse(readFileSync(`${dp("competitors")}/${files[files.length - 1]}`, "utf-8"));
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
      ${IS_OZON ? `'<td><a href="https://www.ozon.ru/product/'+esc(d.sku)+'" target="_blank" rel="noopener" style="color:#22D3EE;text-decoration:none">'+esc(d.stol.slice(0,60))+' &#8599;</a></td>'+` : `'<td>'+esc(d.stol.slice(0,60))+'</td>'+`}
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
  writeFileSync(op("katya-competitors.html"), kshell("Конкуренты", "competitors", body, pageJs));
}

console.log(`katya: командный центр + 5 страниц + конкуренты(ДЕМО) · ${PRODUCTS.length} моделей, ${allSkus.length} SKU, категорий ${CAT_TREE.length}, окно ${WIN[0]}..${WIN[15]}, ${IS_OZON ? "OZON" : "Маркет"} ${ozRev} млн / ${ozOrd} шт (${DELIVERED_BASIS ? "доставлено, базис свода" : "заказано"})`);
