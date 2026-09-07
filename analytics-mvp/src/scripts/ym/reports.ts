// Отчёты Маркета через generate -> poll -> download (только чтение). Три продьюсера:
//   realization [YYYY-MM ...]  goods-realization по кампаниям за месяц -> data-ym/realization_monthly.ndjson
//                              (аналог OZON /v2/finance/realization = основа сверки штук по §15).
//   netting [from] [to]        united-netting по кабинетам -> data-ym/netting.ndjson + netting_summary.json
//                              (выплаты ЛК: сумма платежей по датам п/п = эталон для «к выплате» по §15).
//   shows [days]               shows-sales по кабинетам ПО ДНЯМ -> data-ym/sku_views.ndjson (показы/корзина per-SKU).
// Колонки ищутся по regex из report-columns.json; сырые заголовки + 3 строки каждого отчёта пишутся
// в data-ym/_probe/<type>.json для первичной настройки. Не найдена ключевая колонка -> warning,
// файл не трогаем, exit 0 (мягкий продьюсер: не валит ночной синк).
// Запуск: npm run ym:realization | ym:netting | ym:shows
import { readFileSync } from "node:fs";
import { loadEnv } from "../../env.js";
import { accounts, resolveTargets, resolveBusinesses, campaignUnavailable, ensureDir, readNdjson, writeNdjson, writeJson, readJson, yp, yesterday, addDays, monthBounds, FLOOR, pad, type YmAccount } from "./common.js";
import { toTable, findCol, cellNumStrict, cellDate, maskCell } from "../../util/table.js";
import { type YmPartner } from "../../connector/ym-partner.js";
import { realizationRole, isRateLimit, dedupeNetting } from "./reports-lib.js";
import { retryOnRateLimit, RATE_LIMITED } from "./reports-wait.js";
import { DELIVERED_STATUSES } from "./derive-lib.js";

type ColMap = Record<string, string[]>;
const COLS: Record<string, ColMap> = JSON.parse(readFileSync(new URL("./report-columns.json", import.meta.url), "utf-8"));

// Probe: заголовки + МАСКИРОВАННЫЕ образцы строк (цифры -> 9, буквы -> x): для настройки колонок достаточно,
// а номера заказов / п/п / суммы в git не уезжают (ФЕНИКС G10).
function probe(type: string, headers: string[], rows: string[][], extra: any = {}) {
  writeJson(yp(`_probe/${type}.json`), { type, at: new Date().toISOString(), headers, sample_masked: rows.slice(0, 3).map((r) => r.map(maskCell)), ...extra });
}

// Битые числовые ячейки (не разобрались) - считаем, пишем в _probe/bad_cells.json, reconcile поднимает в полосу.
const BAD: Record<string, number> = {};
function num(type: string, s: string | undefined): number {
  const v = cellNumStrict(s);
  if (v == null) { BAD[type] = (BAD[type] || 0) + 1; return 0; }
  return v;
}
function flushBad() {
  const total = Object.values(BAD).reduce((a, b) => a + b, 0);
  const prev = readJson<any>(yp("_probe/bad_cells.json"), { byType: {} });
  const byType: Record<string, number> = { ...(prev.byType || {}), ...BAD };
  writeJson(yp("_probe/bad_cells.json"), { at: new Date().toISOString(), byType, total: Object.values(byType).reduce((a, b) => a + Number(b), 0) });
  if (total) console.warn(`::warning::неразобранных числовых ячеек за прогон: ${total} (${JSON.stringify(BAD)})`);
}

// Версия парсера взаиморасчётов. Поднимать, когда меняется состав полей строки или правила дедупа:
// это и есть сигнал «снимок надо пересобрать от FLOOR», ровно один раз.
export const NETTING_SCHEMA = 2;

// Бюджет отчётов на прогон (ФЕНИКС G9): каждый generate+poll до 15 мин; без потолка первый бэкфилл
// упирается в timeout job и теряет всё. По умолчанию 10 отчётов, переопределяется YM_REPORT_BUDGET.
const BUDGET = Math.max(1, Number(process.env.YM_REPORT_BUDGET || 10) || 10);
let used = 0;
let budgetSpent = false;
function budgetLeft(): boolean { if (used >= BUDGET) { budgetSpent = true; console.warn(`::warning::бюджет отчётов исчерпан (${BUDGET}) - остальное доберёт следующий прогон`); return false; } used++; return true; }

// Живой факт 2026-09-04: Маркет режет ГЕНЕРАЦИЮ отчётов до 1 запроса на 2 минуты на кабинет
// (goods-realization, united-netting) и 1 на 6 минут (shows-sales). Полный бэкфилл (8 месяцев x 14
// кампаний) в один прогон физически не влезает. Поэтому лимит - это не ошибка: продьюсер
// останавливается мягко, СОХРАНЯЕТ уже разобранное, а остаток добирает следующий прогон.
let rateLimited = false;
// Ждём окно лимита и повторяем. Сдаёмся только когда до дедлайна прогона уже не хватает на ожидание -
// тогда мягкая остановка отрабатывает как раньше и собранное сохраняется.
function stopOnRateLimit(e: unknown, what: string): boolean {
  if (!isRateLimit(e)) return false;
  rateLimited = true;
  console.warn(`::warning::${what}: лимит генерации отчётов Маркета - сохраняю собранное, остальное доберёт следующий прогон`);
  return true;
}

function cols(type: string, headers: string[], required: string[]): Record<string, number> | null {
  const map = COLS[type] || {};
  const idx: Record<string, number> = {};
  for (const [k, pats] of Object.entries(map)) idx[k] = findCol(headers, pats);
  const missing = required.filter((k) => idx[k] == null || idx[k]! < 0);
  if (missing.length) { console.warn(`::warning::отчёт ${type}: не найдены колонки ${missing.join(", ")} в заголовках [${headers.join(" | ")}] - см. data-ym/_probe/${type}.json и поправь report-columns.json`); return null; }
  return idx;
}

type Tbl = { name: string; headers: string[]; rows: string[][] };
// Все таблицы отчёта (zip может нести несколько CSV: доставки + возвраты). null = нет данных/ошибка.
// Лимит Маркета - это ОЖИДАНИЕ, а не отказ: 1 генерация на 2 минуты на кабинет. Раньше первый же 420
// приводил к выходу из продьюсера, и прогон использовал 10 минут из 120 доступных (живой факт
// 2026-09-07: шаг реализации отработал 1 мин 49 с и сдался, собрав один отчёт). Теперь ждём окно и
// повторяем, пока не упрёмся в дедлайн прогона.
const WAIT_MS = Number(process.env.YM_REPORT_WAIT_MS || 125_000);
const DEADLINE_MS = Number(process.env.YM_REPORT_DEADLINE_MS || 95 * 60 * 1000);
const startedAt = Date.now();
const timeLeft = () => DEADLINE_MS - (Date.now() - startedAt);


async function fetchReportAll(api: YmPartner, type: string, body: any): Promise<Tbl[] | null> {
  if (!budgetLeft()) return null;
  const r = await retryOnRateLimit(() => api.report(type, body, { timeoutMs: Number(process.env.YM_REPORT_TIMEOUT_MS || 15 * 60 * 1000) }), type, { waitMs: WAIT_MS, timeLeft });
  if (r === RATE_LIMITED) throw new Error("HTTP 420: лимит генерации отчётов Маркета, дедлайн прогона исчерпан");
  if (r.status !== "DONE" || !r.files.length) { console.warn(`::warning::отчёт ${type} ${JSON.stringify(body)}: status ${r.status}${r.subStatus ? "/" + r.subStatus : ""} - данных нет`); return null; }
  const out: Tbl[] = [];
  for (const f of r.files) { const t = toTable(f.text); console.log(`  ${type}: ${f.name} строк ${t.rows.length}, разделитель '${t.delimiter}'`); out.push({ name: f.name, headers: t.headers, rows: t.rows }); }
  return out;
}
async function fetchReport(api: YmPartner, type: string, body: any): Promise<{ headers: string[]; rows: string[][] } | null> {
  const all = await fetchReportAll(api, type, body);
  return all && all[0] ? { headers: all[0].headers, rows: all[0].rows } : null;
}


// ---- goods-realization: {campaignId, year, month} -> {ym, sku, sold, ret} ----
async function realization(months: string[]) {
  const OUT = yp("realization_monthly.ndjson");
  const targets = await resolveTargets();
  const existing = readNdjson<any>(OUT);
  const fresh: any[] = [];
  // Возобновляемость: бэкфилл 8 месяцев x 14 кампаний не влезает в лимит генерации (1 / 2 мин на
  // кабинет), поэтому помним разобранные пары (месяц, кампания) в realization_state.json и каждый
  // прогон двигаем бэкфилл дальше, а не начинаем с нуля.
  const STATE = yp("realization_state.json");
  const state = readJson<{ pairs: string[]; by_month?: Record<string, any> }>(STATE, { pairs: [] });
  const donePairs = new Set(state.pairs || []);
  // ПЕРЕОТКРЫТИЯ ПАР БОЛЬШЕ НЕТ. Две итерации подряд оно оказывалось небезопасным, и оба раза по
  // одной причине: признак «магазин ничего не дал» выводился косвенно, а разбор складывает поверх
  // накопленного (a.sold += ...), поэтому любая ошибка вывода превращается во второй слой.
  //   итерация 1: признак читался из состояния (shops_with_rows), пустого у старых месяцев;
  //   итерация 2: признак читался из поля from, а писатель проставляет from ВСЕМ строкам, включая
  //   поднятые из файла с пустым множеством - через один прогон from: [] стоял у всех 177 строк,
  //   и переоткрылись бы 14 пар на 4 830 709 ₽ реализации.
  // Косвенный признак тут в принципе не годится. Оставляем один явный и идемпотентный путь:
  // ПЕРЕСБОР МЕСЯЦА С НУЛЯ по прямой команде оператора (`ym:realization -- 2026-02 --rebuild`).
  // Он не складывает, а заменяет: строки месяца выбрасываются, пары месяца открываются, месяц
  // собирается заново. Задвоение невозможно по построению, а не по выводу из данных.
  // Магазины, ответившие NO_DATA, в переоткрытии не нуждаются: новый код такие пары не закрывает.
  const rebuild = process.argv.includes("--rebuild");
  // Пересбор без явно названного месяца брал бы [прошлый, текущий] по умолчанию и стирал их молча.
  // Разрушительная команда обязана называть цель словами (ФЕНИКС iter4).
  if (rebuild && !process.argv.slice(3).some((a) => /^\d{4}-\d{2}$/.test(a))) {
    console.error("::error::--rebuild требует явно названный месяц: ym:realization -- 2026-02 --rebuild");
    process.exit(1);
  }
  if (rebuild) {
    for (const ym of months) {
      for (const p of [...donePairs]) if (p.startsWith(`${ym}/`)) donePairs.delete(p);
    }
    console.log(`realization: ПЕРЕСБОР месяцев ${months.join(", ")} с нуля - накопленные строки этих месяцев отброшены, пары открыты`);
  }
  // Сколько штук по каждому (месяц, магазин) мы САМИ насчитали по заказам. Нужно для двух вещей:
  // не тратить генерацию отчёта на магазин без продаж (лимит 1 отчёт / 2 мин, он дорог) и не
  // закрывать пару по NO_DATA там, где продажи были - у Маркета отчёт появляется после выпуска УПД,
  // и «пусто» на свежем месяце значит «ещё не готов», а не «не продавали».
  const soldBy: Record<string, number> = {};
  for (const r of readNdjson<any>(yp("orders.ndjson"))) {
    if (r.fake || !DELIVERED_STATUSES.has(r.status) || !r.delivered) continue;
    const k = `${String(r.fin).slice(0, 7)}/${r.campaign}`;
    soldBy[k] = (soldBy[k] || 0) + r.delivered;
  }
  const withRows: Record<string, Set<string>> = {}, noDataDespiteSales: Record<string, Set<string>> = {};
  const mark = (m: Record<string, Set<string>>, ym: string, c: string) => (m[ym] ||= new Set()).add(c);
  const byMonth: Record<string, Record<string, { sold: number; ret: number; amount: number; from: Set<string> }>> = {};
  // При пересборе месяц НЕ засеваем накопленным (иначе свежий разбор ляжет поверх старого), но
  // старые строки НЕ выбрасываем: держим их в теневом слое и заменяем только при успешном сборе.
  // ФЕНИКС iter4: удаление шло безусловно, а запись условно - при пустом ответе Маркета месяц
  // просто исчезал. Веток в пустой ответ шесть: нечитаемый список кампаний, все NO_DATA (2026-08 -
  // пять из семи), API_DISABLED (три кампании 1023124), исчерпанный бюджет, лимит генерации,
  // отсутствие продаж. Предупреждение «месяц не трогаю» при этом было прямой ложью.
  const shadow: Record<string, any[]> = {};
  for (const r of existing) {
    if (rebuild && months.includes(r.ym)) { (shadow[r.ym] ||= []).push(r); continue; }
    const b = byMonth[r.ym] || (byMonth[r.ym] = {});
    b[r.sku] = { sold: r.sold || 0, ret: r.ret || 0, amount: r.amount || 0, from: new Set<string>(r.from || []) };
  }
  outer:
  for (const ym of months) {
    const [y, m] = ym.split("-").map(Number) as [number, number];
    const bySku: Record<string, { sold: number; ret: number; amount: number; from: Set<string> }> = byMonth[ym] || (byMonth[ym] = {});
    let ok = 0;
    for (const { campaign: c, account } of targets) {
      const pair = `${ym}/${c.id}`;
      if (donePairs.has(pair)) continue;
      // Магазин без наших продаж за месяц: отчёт заведомо пуст, генерацию не тратим.
      if (!soldBy[pair]) { donePairs.add(pair); continue; }
      let tables: Tbl[] | null = null;
      try { tables = await fetchReportAll(account.api, "goods-realization", { campaignId: Number(c.id), year: y, month: m }); }
      catch (e) {
        if (stopOnRateLimit(e, `реализация ${ym}`)) break outer;
        const why = campaignUnavailable(e); if (!why) throw e;
        console.warn(`::warning::реализация ${ym}: кампания ${c.id} пропущена (${why})`); donePairs.add(pair); continue;
      }
      // Сюда попадаем только когда продажи по магазину БЫЛИ. Значит NO_DATA - это «отчёт ещё не
      // выпущен», а не «нечего собирать»: пару НЕ закрываем, следующий прогон попробует снова.
      // Раньше она закрывалась навсегда, и месяц оставался недобранным при зелёном бейдже.
      if (!tables) {
        if (budgetSpent) break outer;
        if (!rateLimited) { mark(noDataDespiteSales, ym, c.id); console.warn(`::warning::реализация ${ym}: магазин ${c.id} продал ${soldBy[pair]} шт, но отчёт пуст (УПД ещё не выпущен) - повторю в следующий прогон`); }
        continue;
      }
      let parsed = false;
      for (const t of tables) {
        probe(`goods-realization${tables.length > 1 ? "-" + t.name.replace(/[^a-z0-9_]/gi, "_") : ""}`, t.headers, t.rows, { campaign: c.id, ym, file: t.name });
        // Живой факт 2026-09-04: zip несёт 5 CSV по ролям. Реализация (аналог УПД) = delivered.csv;
        // возвраты = returned.csv. transferred_to_delivery/unredeemed/lost_items - надмножества и
        // отдельные события: суммировать их в «продано» значит считать одну штуку по три раза.
        const role = realizationRole(t.name, t.headers);
        if (!role) { console.log(`  goods-realization: ${t.name} - роль не учитывается в штуках реализации`); continue; }
        const ix = cols("goods-realization", t.headers, role === "returned" ? ["sku", "returned"] : ["sku", "sold"]);
        if (!ix) continue;
        parsed = true;
        for (const r of t.rows) {
          const sku = (r[ix.sku!] || "").trim(); if (!sku) continue;
          const a = bySku[sku] || (bySku[sku] = { sold: 0, ret: 0, amount: 0, from: new Set<string>() });
          a.from.add(c.id); // какой магазин дал строку - пишем В ДАННЫЕ, а не только в состояние прогона
          if (role === "returned") {
            a.ret += num("goods-realization", r[ix.returned!]);
            if (ix.amount_returned! >= 0) a.amount -= num("goods-realization", r[ix.amount_returned!]);
          } else {
            a.sold += num("goods-realization", r[ix.sold!]);
            if (ix.amount! >= 0) a.amount += num("goods-realization", r[ix.amount!]);
          }
        }
      }
      if (parsed) { ok++; donePairs.add(pair); mark(withRows, ym, c.id); }
    }
    if (!ok && !Object.keys(bySku).length) {
      // Ничего не собрали. При обычном прогоне месяц и так на месте; при пересборе возвращаем
      // теневой слой, иначе «не трогаю» означало бы «стёр».
      if (rebuild && shadow[ym]?.length) {
        for (const r of shadow[ym]!) (byMonth[ym] ||= {})[r.sku] = { sold: r.sold || 0, ret: r.ret || 0, amount: r.amount || 0, from: new Set<string>(r.from || []) };
        console.warn(`::warning::realization ${ym}: пересбор ничего не дал - вернул ${shadow[ym]!.length} ранее собранных строк, месяц не потерян`);
      } else console.warn(`::warning::realization ${ym}: ни один отчёт не разобран - месяц не трогаю`);
      continue;
    }
    console.log(`realization ${ym}: SKU ${Object.keys(bySku).length}, реализовано нетто ${Object.values(bySku).reduce((s, a) => s + a.sold - a.ret, 0)} шт${ok ? "" : " (из ранее собранного)"}`);
  }
  // Последняя сеть перед записью: любой месяц пересбора, оставшийся пустым, возвращается из теневого
  // слоя. Покрывает ВСЕ ранние выходы разом, включая `break outer` по лимиту Маркета, после которого
  // до месяцев очереди управление уже не доходит. Проверка «пусто -> верни» надёжнее перечисления
  // веток: веток шесть, и седьмую я бы снова не увидел.
  for (const [ym, rows] of Object.entries(shadow)) {
    if (Object.keys(byMonth[ym] || {}).length) continue;
    for (const r of rows) (byMonth[ym] ||= {})[r.sku] = { sold: r.sold || 0, ret: r.ret || 0, amount: r.amount || 0, from: new Set<string>(r.from || []) };
    console.warn(`::warning::realization ${ym}: пересбор не дал строк - месяц восстановлен из ранее собранного (${rows.length} строк)`);
  }
  for (const ym of Object.keys(byMonth)) for (const [sku, a] of Object.entries(byMonth[ym]!)) fresh.push({ ym, sku, sold: Math.round(a.sold), ret: Math.round(a.ret), amount: Math.round(a.amount), from: [...a.from].sort(), platform: "ym", source: "goods-realization" });
  const merged = fresh.sort((a, b) => (a.ym < b.ym ? -1 : a.ym > b.ym ? 1 : a.sku < b.sku ? -1 : 1));
  writeNdjson(OUT, merged);
  // Покрытие по месяцам: какие магазины реально дали строки, а какие продавали, но отчёт ещё пуст.
  // Без этого сверка штук объявляет расхождением обычную недобранность отчёта.
  const shopsSold: Record<string, string[]> = {};
  for (const k of Object.keys(soldBy)) { const [ym, c] = k.split("/") as [string, string]; (shopsSold[ym] ||= []).push(c); }
  const byMonthCov: Record<string, { shops_sold: string[]; shops_with_rows: string[]; shops_no_data: string[]; shops_pending: string[] }> = {};
  for (const [ym, shops] of Object.entries(shopsSold)) {
    const rowsSet = withRows[ym] || new Set<string>(), ndSet = noDataDespiteSales[ym] || new Set<string>();
    const prev = readJson<any>(STATE, {}).by_month?.[ym];
    // Магазины, давшие строки, берём ИЗ ДАННЫХ. Раньше источником было только то, что разобрал этот
    // прогон, плюс перенос из состояния - а пары, собранные до появления поля, не отмечались никогда
    // и не могли отметиться потом (donePairs их пропускает). Месяц с данными вечно показывал
    // «0 магазинов добрано» при непустом файле: живой факт 2026-09-07 - 2026-08 имел 22 SKU и 26 шт
    // при shops_with_rows = [].
    const fromData = new Set<string>(merged.filter((r: any) => r.ym === ym).flatMap((r: any) => r.from || []));
    const keptRows = new Set<string>([...(prev?.shops_with_rows || []), ...rowsSet, ...fromData]);
    byMonthCov[ym] = {
      shops_sold: shops.sort(),
      shops_with_rows: [...keptRows].filter((c) => shops.includes(c)).sort(),
      shops_no_data: [...ndSet].sort(),
      shops_pending: shops.filter((c) => !keptRows.has(c) && !ndSet.has(c)).sort(),
    };
  }
  writeJson(STATE, { at: new Date().toISOString(), pairs: [...donePairs].sort(), by_month: byMonthCov, note: "разобранные пары месяц/магазин отчёта о реализации и покрытие по месяцам; лимит генерации Маркета не даёт собрать бэкфилл за один прогон" });
  const total = targets.length * months.length;
  console.log(`realization: всего ${merged.length} строк (${new Set(merged.map((r) => r.ym)).size} мес), пар месяц/кампания ${donePairs.size}/${total}${rateLimited ? " - упёрлись в лимит Маркета, продолжу в следующий прогон" : ""} -> ${OUT}`);
}

// ---- united-netting: {businessId, dateFrom, dateTo} -> платежи по датам ----
async function netting(from: string, to: string) {
  const OUT = yp("netting.ndjson");
  const STATE = yp("netting_state.json");
  const fresh: any[] = [];
  // Пары, которые в ЭТОТ прогон реально запрошены и разобраны. Чистить старое можно только по ним.
  const purged = new Set<string>();
  let ok = 0;
  // Возобновляемость по паре (кабинет, месяц). Полный пересбор девяти месяцев в лимит Маркета
  // (1 генерация / 2 мин) за один прогон не влезает: раньше он обрывался, версия схемы не
  // проставлялась, и следующий прогон начинал сначала - бесконечный цикл, съедавший весь бюджет
  // генераций, из-за чего бэкфилл реализации не двигался. Теперь каждый прогон доносит свою часть.
  const prevState = readJson<{ schema?: number; months_done?: string[] }>(STATE, {});
  const doneMonths = new Set(prevState.schema === NETTING_SCHEMA ? prevState.months_done || [] : []);
  // Свежее окно всегда перезабираем: проводки по недавним месяцам ещё меняются.
  const freshWindow = addDays(to, -59).slice(0, 7);
  for (const { businessId: b, account } of await resolveBusinesses()) {
    // помесячно (лимит диапазона отчёта)
    let s = from;
    while (s <= to) {
      const mb = monthBounds(s.slice(0, 7));
      const e = mb.dateTo < to ? mb.dateTo : to;
      const pair = `${b}/${s.slice(0, 7)}`;
      if (doneMonths.has(pair) && s.slice(0, 7) < freshWindow) { s = addDays(e, 1); continue; }
      let t: { headers: string[]; rows: string[][] } | null = null;
      try { t = await fetchReport(account.api, "united-netting", { businessId: Number(b), dateFrom: s, dateTo: e }); }
      catch (err) { if (stopOnRateLimit(err, `взаиморасчёты ${s}..${e}`)) break; throw err; }
      if (t) {
        probe("united-netting", t.headers, t.rows, { business: b, from: s, to: e });
        const ix = cols("united-netting", t.headers, ["date", "amount"]);
        if (ix) {
          ok++; doneMonths.add(pair); purged.add(pair);
          for (const r of t.rows) {
            const d = cellDate(r[ix.date!]); if (!d) continue;
            fresh.push({ d, business: b, tx: ix.transaction! >= 0 ? (r[ix.transaction!] || "").trim() : "", shop_order: ix.shop_order! >= 0 ? (r[ix.shop_order!] || "").trim() : "", type: ix.type! >= 0 ? (r[ix.type!] || "").trim() : "", service: ix.service! >= 0 ? (r[ix.service!] || "").trim() : "", amount: num("united-netting", r[ix.amount!]), order: ix.order! >= 0 ? (r[ix.order!] || "").trim() : "", sku: ix.sku! >= 0 ? (r[ix.sku!] || "").trim() : "", po: ix.payment_order! >= 0 ? (r[ix.payment_order!] || "").trim() : "", platform: "ym" });
          }
        }
      }
      s = addDays(e, 1);
    }
    if (rateLimited) break;
  }
  // Ничего не забрали, но прогресс есть - значит история уже собрана, а свежее окно не дало строк.
  // Это не ошибка: файлы не трогаем, состояние оставляем как есть.
  if (!ok && !fresh.length && doneMonths.size) { console.log(`netting: все ${doneMonths.size} пар кабинет/месяц уже собраны, новых строк нет`); return; }
  if (!ok) { console.warn("::warning::netting: ни один отчёт не разобран - файлы не трогаю"); return; }
  // При мягком стопе по лимиту часть периода не добрана: старые строки этого периода не выкидываем,
  // иначе один упёршийся в лимит прогон обнулит уже собранные месяцы.
  // Из старого снимка выкидываем только те месяцы, которые в ЭТОТ прогон реально перезабрали.
  // Возобновляемый бэкфилл трогает лишь часть диапазона, и обнулять остальное нельзя.
  // КЛЮЧ ЧИСТКИ ОБЯЗАН СОВПАДАТЬ С КЛЮЧОМ ВОЗОБНОВЛЯЕМОСТИ. Возобновляемся по паре (кабинет, месяц),
  // а чистили по одному месяцу - и перезабор одного кабинета сносил строки ДРУГОГО за тот же месяц.
  // Живой факт 2026-09-07: прогон перезабрал 1023124/2026-04 и 1023124/2026-05 и уничтожил
  // 74986385 за 2026-03..2026-06 - реестр упал с 11 407 строк (27 932 124 ₽) до 6 509 (18 577 394 ₽),
  // минус 4 898 строк и 9 354 730 ₽. Дельта-гейт этого не увидел: он смотрит только 30-дневные
  // производные. Чистим строго ту пару, которую в этот прогон реально перезабрали.
  // Список «что чистим» строится из ЗАПРОШЕННЫХ пар, а не из полученных строк. Отчёт отдаёт
  // проводки за пределами запрошенного окна (см. комментарий про дедуп ниже: в выгрузке за февраль
  // приходят январские). Прошлая версия брала месяцы из ответа, поэтому запрос июля помечал
  // «перезабранными» май и июнь, приносил оттуда десяток строк - и сносил остальные две тысячи.
  // Живой факт 2026-09-07, прогон 17: 2026-05 упал с 2380 строк до 568, 2026-06 с 1652 до 441.
  // Гейт накопительного слоя это поймал и остановил публикацию.
  const keep = readNdjson<any>(OUT).filter((r) => !purged.has(`${r.business}/${r.d.slice(0, 7)}`));
  // Живой факт 2026-09-04: отчёт отдаёт проводки и за пределами запрошенного окна (в выгрузке за
  // февраль пришли январские), поэтому соседние месячные запросы ПЕРЕСЕКАЮТСЯ. Без дедупа одна и та
  // же проводка попадает дважды: на первом прогоне так задвоилось 2935 строк на 17.6 млн ₽, и сверка
  // денег показала расхождение -26 млн. Дедуп строго по TRANSACTION_ID.
  const merged = dedupeNetting(fresh.concat(keep)).sort((a, b) => (a.d < b.d ? -1 : 1));
  writeNdjson(OUT, merged);
  const byDate: Record<string, number> = {}, byMonth: Record<string, number> = {};
  for (const r of merged) { byDate[r.d] = Math.round(((byDate[r.d] || 0) + r.amount) * 100) / 100; const m = r.d.slice(0, 7); byMonth[m] = Math.round(((byMonth[m] || 0) + r.amount) * 100) / 100; }
  writeJson(yp("netting_summary.json"), { platform: "ym", generated_at: new Date().toISOString(), rows: merged.length, byDate, byMonth, note: "сумма строк отчёта по взаиморасчётам по дате; знак как в отчёте (выплаты +, удержания -). [ГИПОТЕЗА] до сверки колонок" });
  // Состояние пишем ВСЕГДА: прогресс помесячный, поэтому оборванный лимитом прогон сохраняет то,
  // что успел, и следующий продолжает с места остановки, а не начинает заново.
  const txSeen = merged.filter((r: any) => r.tx && String(r.tx).trim()).length;
  writeJson(STATE, { at: new Date().toISOString(), schema: NETTING_SCHEMA, rows: merged.length, months_done: [...doneMonths].sort(), tx_present: txSeen, note: txSeen ? "дедуп по TRANSACTION_ID" : "Маркет отдаёт TRANSACTION_ID пустым - дедуп идёт по составному ключу (дата, заказ, SKU, тип, услуга, сумма, п/п)" });
  console.log(`netting: строк ${merged.length} (${from}..${to} получено ${fresh.length}, дублей отброшено ${fresh.length + keep.length - merged.length}, пар кабинет/месяц собрано ${doneMonths.size}, строк с TRANSACTION_ID ${txSeen})${rateLimited ? " - упёрлись в лимит, продолжу в следующий прогон" : ""} -> ${OUT}`);
}

// ---- shows-sales: {businessId, dateFrom, dateTo, grouping:"OFFERS"} -> sku_views.ndjson ----
// Живой факт 2026-09-04: Маркет режет генерацию shows-sales до 1 отчёта на 6 минут (HTTP 420), поэтому
// ОДИН отчёт за всё недостающее окно на кабинет, не по дням. Если в отчёте есть колонка даты - строки
// дневные; иначе агрегат за окно помечается period_from/aggregate и используется только для
// окна skus_live (derive), а не для дневной воронки.
async function shows(days: number) {
  const OUT = yp("sku_views.ndjson");
  const existing = readNdjson<any>(OUT);
  const have = new Set(existing.map((r) => r.date));
  const to = yesterday();
  let from = addDays(to, -(days - 1)); if (from < FLOOR) from = FLOOR;
  while (from <= to && have.has(from)) from = addDays(from, 1);
  if (from > to) { console.log("shows: окно уже собрано"); return; }
  console.log(`shows: окно ${from}..${to}, по одному отчёту на кабинет (лимит Маркета 1 генерация / 6 мин)`);
  const fresh: any[] = [];
  for (const { businessId: b, account } of await resolveBusinesses()) {
    let t: { headers: string[]; rows: string[][] } | null = null;
    try { t = await fetchReport(account.api, "shows-sales", { businessId: Number(b), dateFrom: from, dateTo: to, grouping: "OFFERS" }); }
    catch (e) { console.warn(`::warning::shows ${from}..${to} ${b}: ${(e as Error).message.slice(0, 200)}`); continue; }
    if (!t) continue;
    probe("shows-sales", t.headers, t.rows, { business: b, from, to });
    const ix = cols("shows-sales", t.headers, ["sku", "shows"]);
    if (!ix) continue;
    // Живой факт 2026-09-04: даты в sales_funnel_report.csv разложены на DAY / MONTH / YEAR,
    // отдельной колонки даты нет - собираем ISO из трёх, иначе воронка схлопывается в агрегат.
    const hasParts = ix.day! >= 0 && ix.month! >= 0 && ix.year! >= 0;
    const hasDate = ix.date! >= 0 || hasParts;
    // Живой факт 2026-09-07: колонка DAY несёт НЕ номер дня, а полную дату DD-MM-YYYY (MONTH -
    // MM-YYYY, YEAR - YYYY). Number("07-09-2026") = NaN, поэтому дата не собиралась, все строки
    // помечались агрегатом и 30 дневных строк на SKU схлопывались на одну дату: 20 388 строк на
    // 733 уникальных ключа, воронка «1 день из 30» и нули показов в daily_totals. Сначала пробуем
    // прочитать DAY как дату целиком, и только потом - как номер дня.
    const partsDate = (r: string[]) => {
      const whole = cellDate(r[ix.day!]);
      if (whole) return whole;
      const y = Number(r[ix.year!]), m = Number(r[ix.month!]), dd = Number(r[ix.day!]);
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(dd) || y < 2000 || m < 1 || m > 12 || dd < 1 || dd > 31) return "";
      return `${y}-${pad(m)}-${pad(dd)}`;
    };
    for (const r of t.rows) {
      const sku = (r[ix.sku!] || "").trim(); if (!sku) continue;
      const d = ix.date! >= 0 ? cellDate(r[ix.date!]) : hasParts ? partsDate(r) : "";
      fresh.push({ date: d || to, ...(d ? {} : { period_from: from, aggregate: true }), sku, name: ix.name! >= 0 ? (r[ix.name!] || "").trim() : "", line: "", views: Math.round(num("shows-sales", r[ix.shows!])), vsearch: 0, pdp: ix.clicks! >= 0 ? Math.round(num("shows-sales", r[ix.clicks!])) : 0, cart: ix.cart! >= 0 ? Math.round(num("shows-sales", r[ix.cart!])) : 0, units: ix.units! >= 0 ? Math.round(num("shows-sales", r[ix.units!])) : 0, deliv: 0, ret: 0, canc: 0, business: b, platform: "ym" });
    }
  }
  if (!fresh.length) { console.log("shows: новых строк нет"); return; }
  // агрегаты за пересекающееся окно заменяем свежим
  const kept = existing.filter((r) => !(r.aggregate && r.date >= from && r.date <= to) && !(fresh.some((f) => !f.aggregate && f.date === r.date && f.sku === r.sku && f.business === r.business)));
  const merged = kept.concat(fresh).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  writeNdjson(OUT, merged);
  console.log(`shows: +${fresh.length} строк (${fresh[0].aggregate ? "агрегат за окно" : "по дням"}), всего ${merged.length} -> ${OUT}`);
}

async function main() {
  loadEnv(); ensureDir();
  accounts(); // ранняя проверка, что хотя бы один ключ задан
  const cmd = process.argv[2];
  const now = new Date();
  if (cmd === "realization") {
    const args = process.argv.slice(3);
    let months = args.filter((a) => /^\d{4}-\d{2}$/.test(a));
    if (!months.length) { // текущий + предыдущий (доначисления), как у OZON pnl-realization
      const cur = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
      const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      months = [`${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}`, cur];
      if (!readNdjson(yp("realization_monthly.ndjson")).length) { // первый прогон - все месяцы от FLOOR
        months = []; let d = new Date(Date.UTC(Number(FLOOR.slice(0, 4)), Number(FLOOR.slice(5, 7)) - 1, 1));
        while (d.getTime() <= now.getTime()) { months.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); }
      }
    }
    await realization(months);
  } else if (cmd === "netting") {
    const to = process.argv[4] || yesterday();
    // Обычный прогон добирает последние 60 дней; полный пересбор от FLOOR нужен один раз - когда
    // снимок собран парсером старой версии.
    //
    // Живой факт 2026-09-07: признаком «старого снимка» стояло «есть строка без TRANSACTION_ID». Но
    // Маркет отдаёт эту колонку ПУСТОЙ во всех 11 407 строках, поэтому признак срабатывал КАЖДЫЙ
    // прогон: взаиморасчёты пересобирались от января заново, девять генераций по одной на две минуты
    // съедали весь лимит, и бэкфилл реализации не двигался (0 из 7 магазинов за август). Признаком
    // теперь служит версия парсера в netting_state.json, а не содержимое строк.
    const have = readNdjson<any>(yp("netting.ndjson"));
    const st = readJson<{ schema?: number; months_done?: string[] }>(yp("netting_state.json"), {});
    // Бэкфилл идёт от FLOOR, пока схема не та или прогресс ещё не покрыл историю. Прогресс
    // помесячный, поэтому «полный» диапазон каждый прогон стоит дёшево: собранные пары пропускаются.
    const needFull = have.length === 0 || st.schema !== NETTING_SCHEMA || !(st.months_done || []).length;
    if (needFull && have.length) console.warn(`::warning::netting: снимок собран парсером версии ${st.schema ?? "?"}, текущая ${NETTING_SCHEMA} - бэкфилл от ${FLOOR} (возобновляемый, по парам кабинет/месяц)`);
    const from = process.argv[3] || FLOOR;
    await netting(from, to);
  } else if (cmd === "shows") {
    await shows(Number(process.argv[3] || process.env.YM_SHOWS_DAYS || 7) || 7);
  } else { console.error("usage: reports.ts realization [YYYY-MM...] | netting [from] [to] | shows [days]"); process.exit(2); }
  flushBad();
}

main().catch((e) => { console.error("ym-reports FAILED:", (e as Error).message); process.exit(0); }); // мягкий продьюсер
