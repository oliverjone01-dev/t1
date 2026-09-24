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
import { loadCardMap, kinOfTests, collapseByCard, mapHealth } from "./card-kin.js";
import {
  controlByDay, gapSeries, readiness, loadMoves, loadCpoDays, isExact,
  ARRIVED, FLAT_RANGE, FLAT_DAYS, BASE_DAYS, LATE_AFTER, BACK_TO_BASE,
  type BoostRow, type CoinvRow, type WaveItem,
} from "./boost-readiness.js";
import { KPAGES, navButton } from "./katya-nav.js";
import { gapFiller, coverage } from "./metric-gap.js";
import { seLog, detectable, ordersNeeded } from "./mde.js";
import { pickCtlSrc, CTL_SRC_NAME, type CtlSrc } from "./ctl-src.js";
import {
  readFunnelTests, missingDays, aggDay, FUNNEL_TESTS_FILE,
  type FunnelRow, type FunnelKey, type FunnelRole,
} from "./funnel-tests.js";
import { loadEbSeries, ebOn } from "./eb-level.js";
import {
  readPromoDaily, exitOf, inPromoOn, membersOn, winKey, PROMO_DAILY_FILE,
  type PromoRead, type PromoExit,
} from "./promo.js";
import {
  estOf, EST_NAME, DENSITY_MIN, density, line as estLine, growth as estGrowth,
  type Est, type Matrix,
} from "./estimator.js";

if (!IS_OZON) {
  console.log("build-tests: PLATFORM != ozon, вкладка «Тесты» не собирается (соинвест - механика OZON)");
  process.exit(0);
}

const C_TEST = "#3987e5", C_CTRL = "#d95926";   // проверены validate_palette.js на подложке #12161f
const TODAY = new Date().toISOString().slice(0, 10);

type Row = Record<string, number>;
type PromoDef = { тип: string; от: string; до: string; имя: string; заметка?: string };
type TestDef = {
  id: string; название: string; гипотеза: string; старт?: string; замер?: string;
  горизонт_дней?: number; тест?: string[]; контроль?: string[]; правило?: string; статус?: string;
  стоп?: string;
  этап2?: string; заметка?: string; ответственный?: string;
  /** true - поле «контроль» это группа целиком, а не список пар к тестовым товарам. */
  контроль_группа?: boolean;
  /** Акция, выход из которой меряется. Различается окном дат, а не одним типом. */
  акция?: PromoDef;
  /** Роли внутри теста: кто в рекламе и ждёт плато, кто сосед по карточке. */
  роли?: { test_ad?: string[]; test_sibling?: string[] };
  выход?: string;
  окно_выхода?: { от: string; до: string };
  запасная_ветка?: { условие: string; действие: string; конец_акции: string; контроль: string; замер: string };
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
// ВОРОНКА ТЕСТОВ. Источник с 24.09.2026 один: data/funnel_tests.ndjson. Прежний
// funnel_sku_daily.ndjson был разовой выгрузкой, он кончился 21.09 и вкладка замерла,
// хотя позиция всё это время снималась ежедневно. Ломалась доставка, не сбор.
//
// Файл перекрывает то, что по тем же товарам даёт sku_views: там общий ночной синк, здесь
// срез, собранный специально под тесты, с починенным списком sku и сторожем на охват.
const FT = readFunnelTests(dp(FUNNEL_TESTS_FILE));
/** Имена полей контракта -> имена колонок страницы. */
const FUNNEL_MAP: Array<[FunnelKey, string]> = [
  ["search_position", "pos"], ["search_views", "vsearch"], ["pdp_views", "pdp"],
  ["hits_to_cart", "cart"], ["ordered_units", "units"],
];
const putFunnel = (c: Row, r: FunnelRow): void => {
  for (const [from, to] of FUNNEL_MAP) {
    const v = r[from];
    if (v != null) c[to] = v;          // null у позиции это «не в выдаче», клетку не трогаем
  }
};
for (const [art, byDay] of FT.byArt) for (const [d, r] of byDay) putFunnel(cell(art, d), r);
const HAS_POS = FT.rows.some((r) => r.search_position != null);

// Участие в акциях по дням. Признак участия это запись в acts с нужным окном, а не eb_pct:
// проверка 24.09 показала, что eb_pct описывает другую акцию (см. promo.ts и eb-level.ts).
const PROMO = readPromoDaily(dp(PROMO_DAILY_FILE));
const promoKeyOf = (t: TestDef): string =>
  t.акция ? winKey(t.акция.тип, t.акция.от, t.акция.до) : "";

// Ставка оплаты за заказ по товару: главный риск теста 2 (по закону 3 при выходе из
// рекламы OZON поднимает её с 10 % до 23 %, а это убыток с каждого заказа).
let cpoCount = 0;
/** Последний день, по которому вообще есть позиции в кампании, и максимальная ставка в нём.
 *  Нужно затем, что стоп-сигнал про 23 % нельзя показывать как действующее правило, если
 *  проверять его не на чем: в кампании «выбранные товары» позиций ноль. */
const cpoState = { last: "", positions: 0, maxBid: 0 };
for (const r of readNd(dp("cpo_sku_status.ndjson"))) {
  const art = String(r.art ?? r.offer ?? "").trim();
  const d = String(r.date ?? r.d ?? "").slice(0, 10);
  const v = Number(r.bid_percent);
  if (!art || !d || !Number.isFinite(v)) continue;
  cell(art, d)["cpo"] = v; cpoCount++;
  if (d > cpoState.last) { cpoState.last = d; cpoState.positions = 0; cpoState.maxBid = 0; }
  if (d === cpoState.last) { cpoState.positions += 1; cpoState.maxBid = Math.max(cpoState.maxBid, v); }
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

// Соинвест и цена на витрине. Считаем по цене, которую покупатель реально платит (с картой
// Ozon), а не по витринной: сверка с реестром начислений за август показала, что витрина
// занижает долю Ozon на пять пунктов, потому что скидку по карте платит тоже Ozon.
// Проверка воспроизводится: npm run coinv:calib.
const coinvOf = (r: Record<string, unknown>): number => Number(r["coinv_paid_pct"] ?? r["coinv_pct"] ?? r["coinv"]);
const siteOf = (r: Record<string, unknown>): number => Number(r["site_paid"] ?? r["site_listed"] ?? r["site"] ?? r["price"]);
// День без наблюдения (у Ивана это 19 и 20.09: снимок продублировался) - пробел, а не точка.
// Флага нет в снимках до 23.09, там наблюдение считаем состоявшимся.
const observedOf = (r: Record<string, unknown>): boolean => r["observed"] !== false;

let coinvSkipped = 0;
const panel = new Set<string>();
let panelFixed = false;
for (const r of readNd(dp("coinv_daily.ndjson"))) {
  const art = String(r.art ?? r.offer ?? "").trim();
  const d = String(r.date ?? r.d ?? "").slice(0, 10);
  if (!art || !d) continue;
  if (r.in_panel != null) { panelFixed = true; if (r.in_panel) panel.add(art); }
  if (!observedOf(r)) { coinvSkipped++; continue; }
  const co = coinvOf(r);
  if (Number.isFinite(co)) cell(art, d)["coinv"] = co;
  const site = siteOf(r);
  if (Number.isFinite(site) && site > 0) cell(art, d)["price"] = site;
  if (Number(r.cap) > 0) cell(art, d)["cap"] = Number(r.cap);
}

const priceRows = readNd(dp("prices_daily.ndjson"));
const HAS_COINV = priceRows.length > 0;
for (const r of priceRows) {
  const art = String(r.offer ?? r.art ?? "").trim();
  const d = String(r.d ?? r.date ?? "").slice(0, 10);
  if (!art || !d) continue;
  // Свой снимок: paid это цена по карте, price - витрина. Второе берём только если первого нет.
  const site = Number(r.paid ?? r.price ?? r.site), cap = Number(r.before ?? r.cap);
  const co = r.coinv_paid ?? r.coinv ?? r.coinv_pct;
  if (co != null && Number.isFinite(Number(co))) cell(art, d)["coinv"] = Number(co);
  if (Number.isFinite(site) && site > 0) cell(art, d)["price"] = site;
  if (Number.isFinite(cap) && cap > 0) cell(art, d)["cap"] = cap;
}
const HAS_PRICE = priceRows.length > 0;

let LAST = "";
for (const [, m] of series) for (const d of m.keys()) if (d > LAST) LAST = d;

const rea = JSON.parse(readFileSync(dp("reakciya.json"), "utf-8")) as any;
const measured = (rea.tests || []).filter((t: any) => t.status === "измерен");

const coinvRows = readNd(dp("coinv_daily.ndjson")) as CoinvRow[];
const CARDS = loadCardMap();
const TEST_ARTS = new Set<string>();
for (const t of T.тесты) for (const a of t.тест || []) TEST_ARTS.add(a);
// Панель снимка: товары, по которым соинвест снимается каждый день. Она и есть основа
// контроля, потому что контролю нужен ряд, а не только факт существования в каталоге.
const PANEL = [...new Set(coinvRows.filter((r) => r.in_panel !== false).map((r) => r.art))];
const CATALOG = new Set(coinvRows.map((r) => r.art));

// РОДНЯ СЧИТАЕТСЯ ПО КАЖДОМУ ТЕСТУ ОТДЕЛЬНО (правило Ивана от 23.09). Из контроля теста
// уходит тот, кто делит карточку с артикулом ЭТОГО теста. Родня чужого теста не мешает:
// её товар в этом тесте ничем не тронут, и выбрасывать его значит без нужды сужать группу.
const kinCache = new Map<string, Set<string>>();
function kinOf(t: TestDef): Set<string> {
  const key = t.id || (t.тест || []).join(",");
  let k = kinCache.get(key);
  if (!k) { k = kinOfTests(CATALOG, new Set(t.тест || []), CARDS); kinCache.set(key, k); }
  return k;
}

// Группа контроля для СЧЁТА: панель минус тестовые товары этого теста и минус их родня по
// карточке. Разрыв считается к ней, а не к паре: групповой контроль точнее (размах 11.4
// против 21.5 на тесте 1) и устойчивее, а парный есть лишь у 11 товаров из 21.
const ctlCache = new Map<string, string[]>();
function ctlGroupOf(t: TestDef): string[] {
  const key = t.id || (t.тест || []).join(",");
  let g = ctlCache.get(key);
  if (!g) {
    const own = new Set(t.тест || []);
    const kin = kinOf(t);
    // У теста выхода из акции контроль задан явно: остальные участники той же акции.
    // Панель здесь не годится, в ней 465 товаров, из которых в акции не состоит почти никто,
    // и сравнивать участника акции с неучастником значит мерить саму акцию, а не выход.
    const src = t.контроль_группа && t.контроль?.length ? t.контроль : PANEL;
    g = src.filter((a) => !own.has(a) && !kin.has(a));
    ctlCache.set(key, g);
  }
  return g;
}

// Родня ЛЮБОГО теста: нужна только карточке готовности, где контрольный ряд по дням один
// на всю волну.
const KIN_ANY = kinOfTests(CATALOG, TEST_ARTS, CARDS);

// Уровень акционного бустинга eb_pct: справочная колонка. Признаком участия в акции он не
// является, это выяснилось 24.09 и разобрано в eb-level.ts.
const EB = loadEbSeries();

/** Выход из акции по каждому товару отдельно. Волна выходит не одним днём: карточки режутся
 *  по одной, и у 18 товаров каталога акций две сразу. Поэтому дата считается поартикульно,
 *  а по волне показывается только сводка. */
function exitByArt(t: TestDef): Map<string, PromoExit> {
  const key = promoKeyOf(t);
  const out = new Map<string, PromoExit>();
  if (!key) return out;
  for (const a of t.тест || []) out.set(a, exitOf(PROMO, a, key));
  return out;
}

/** Сводка по волне: сколько вышло, когда первый. Замер по волне целиком не считается, он
 *  поартикульный, поэтому единой даты здесь нет намеренно. */
function exitSummary(t: TestDef): { out: string[]; still: string[]; first: string | null; unseen: string[] } {
  const per = exitByArt(t);
  const out: string[] = [], still: string[] = [], unseen: string[] = [];
  let first: string | null = null;
  for (const [a, e] of per) {
    if (!e.seen) { unseen.push(a); continue; }
    if (e.exit) { out.push(a); if (!first || e.exit < first) first = e.exit; }
    else still.push(a);
  }
  return { out: out.sort(), still: still.sort(), first, unseen: unseen.sort() };
}

/** Стоп-сигнал про ставку оплаты за заказ. Правило действующее только пока его есть на чём
 *  проверять: если в кампании ноль позиций, оно ни к кому не применяется, и выдавать его за
 *  живой контроль нельзя. Позиции появятся - правило вернётся само, из того же файла. */
function stopBlock(text: string): string {
  const watched = cpoState.positions > 0 && cpoState.last >= LAST;
  if (watched) return `<div class="stop"><b>Стоп-сигнал:</b> ${esc(text)}</div>`;
  const why = !cpoState.last
    ? "данных по ставке оплаты за заказ в снимке нет вовсе"
    : cpoState.positions === 0
      ? `в кампании 0 позиций на ${LAST}`
      : `в кампании 0 позиций на ${LAST}: последние ${cpoState.positions} ${plural(cpoState.positions, "позиция", "позиции", "позиций")} сняты ${cpoState.last}, и ставка по ним была ${cpoState.maxBid} %`;
  return `<div class="stop"><b>Стоп-сигнал не проверяется:</b> ${esc(why)}.`
    + ` Правило на бумаге: ${esc(text)} Появятся позиции - правило вернётся, это видно в ежедневном файле.</div>`;
}

/** Состояние выхода из акции в шапке карточки. Фиксировать дату руками не нужно: запись
 *  акции исчезает из acts в тот же день, и это и есть дата выхода. */
function exitMeta(t: TestDef): string {
  if (!t.акция) return "";
  const key = promoKeyOf(t);
  const sum = exitSummary(t);
  const total = (t.тест || []).length;
  const label = esc(t.акция.имя);
  if (!PROMO.exists || !PROMO.days.length) {
    return `<span class="warnv" title="Файл ${PROMO_DAILY_FILE} не доехал">Выход из акции: <b>данных об участии нет</b></span>`;
  }
  const last = PROMO.days[PROMO.days.length - 1]!;
  const inAct = (t.тест || []).filter((a) => inPromoOn(PROMO, a, key, last) === true).length;
  const win = t.окно_выхода ? ` <span class="muted">окно выхода ${esc(t.окно_выхода.от)}..${esc(t.окно_выхода.до)}</span>` : "";
  if (!sum.out.length) {
    return `<span title="${label}">В акции на ${esc(last)}: <b>${inAct} из ${total}</b></span>`
      + `<span>Вышли: <b>никто</b></span>${win}`;
  }
  return `<span title="${label}">В акции на ${esc(last)}: <b>${inAct} из ${total}</b></span>`
    + `<span>Вышли: <b>${sum.out.length}</b>, первый ${esc(sum.first || "-")}</span>${win}`;
}

// Плашка о заражении контроля. Текст согласован с Иваном 23.09 и намеренно не содержит
// множителя: «нижняя граница» это всё, что даёт одно наблюдение на одной линии. Сказать
// «примерно вдвое» значило бы через неделю получить константу, которой никто не мерил.
const KIN_WARN = "Контроль заражён. Реклама одного варианта тянет за собой соседей по"
  + " объединённой карточке, и OZON меряет это сам: в attribution-отчёте у 6 рекламируемых SKU"
  + " продажи карточки больше своих, у sku 3492791902 при расходе 57 363 ₽ своих продаж нет"
  + " вовсе, а карточка продала на 34 362 ₽. Карта карточек с 23.09 есть, и родня из контроля"
  + " теперь вычитается по ней, но величину перетекания карта не измеряет: она говорит, кто"
  + " кому сосед, а не сколько продаж утекло. Сдвиг это нижняя граница, а не измеренная величина.";
const kinBanner = `<div class="stop"><b>Контроль заражён.</b> ${esc(KIN_WARN.replace("Контроль заражён. ", ""))}</div>`;

/** Родственник ли этот контроль тестовому товару ЛЮБОГО теста. Только по настоящей карте
 *  карточек: префикс артикула убран 23.09, а корреляция остатков на уровне панели не
 *  работает (метит роднёй 490 из 493, столько же, сколько случайная двадцатка). Пока карты
 *  нет, функция не помечает никого, и это честнее пометок по догадке. */
const kinCtl = (ctl: string, t: TestDef): boolean => !!ctl && kinOf(t).has(ctl);

/** Ячейка контроля. Родственника НЕ прячем: именно ряды близнецов показывают перетекание,
 *  в июле соседи по карточке занижали базу эталона на 5.1 пункта. Прочерк выбросил бы наблюдение,
 *  которое объясняет, почему цифра занижена. Поэтому родственник остаётся виден, приглушён
 *  и подписан, а в разницу не идёт: она считается к групповому контролю. */
function ctlCell(test: string, ctl: string, t: TestDef): string {
  if (!ctl) return '<span class="muted">пары нет</span>';
  if (!kinCtl(ctl, t)) return esc(ctl);
  return `<span class="kinart" title="Контроль сидит в одной объединённой карточке OZON с тестовым товаром этого теста: он едет за тестом и занижает разницу">${esc(ctl)}</span>`
    + ` <span class="kin">родственник, в расчёт не идёт</span>`;
}

/** Медиана по наблюдениям, а не по артикулам. Варианты одной объединённой карточки OZON это
 *  один товар для покупателя и одна реакция площадки, поэтому в медиану они идут один раз.
 *  В тесте 1 это GGT-35-1-3-100-180 и GGT-35-3-3-100-180: до схлопывания медиана считала их
 *  дважды, то есть тест был не из 11 наблюдений, а из 10. */
function medByCard(items: Array<{ test: string }>, valueOf: (x: any) => number | null): number | null {
  const { values } = collapseByCard(items, (x) => x.test, valueOf, CARDS);
  return median(values);
}


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
// Заказы вернулись линией 24.09. Их не рисовали, потому что медиана дневных индексов на
// 0-2 заказах в день на группу давала шум; индекс суммы по группе такой болезни не имеет,
// и правило в estimator.ts лечит корзину и заказы одинаково.
METRICS.push(["units", "Заказы", "index", ""]);
if (HAS_PRICE) METRICS.push(["price", "Цена на витрине", "raw", " ₽"]);
METRICS.push(["revenue", "Выручка", "raw", " ₽"]);
METRICS.push(["drr", "ДРР", "raw", " %", true]);

// Соинвест - уровень, а не количество: по группе берём среднее по тем артикулам,
// у которых значение есть, а не сумму.
const LEVEL = new Set(["coinv", "pos", "price", "cap", "cpo"]);   // уровни, а не количества: усредняем, не суммируем

// ДЕНЬ БЕЗ СЪЁМА ЭТО НЕ НОЛЬ. Количества (показы, клики, заказы) раньше на любом пустом дне
// давали 0, и пропуск выгрузки рисовался обвалом до нуля: 23.09 график показывал, будто тест
// рухнул в показах, хотя воронка просто доехала только по 21.09. Отличить «ноль показов» от
// «день не снят» можно только по всему снимку разом: если метрику в этот день не отдал НИ ОДИН
// артикул, значит её не снимали. Настоящий ноль по всем пятистам товарам невозможен, а если он
// когда-нибудь случится, разрыв линии это безопасная ошибка, в отличие от нарисованного обвала.
const gapOf = gapFiller(series, (k) => LEVEL.has(k));
const median = (v: number[]): number | null => {
  if (!v.length) return null;
  const a = [...v].sort((x, y) => x - y), m = a.length >> 1;
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
};
// Ряд артикула за дни (пропуск остаётся пропуском только у уровневых метрик).
const artDaily = (art: string, days: string[], key: string): Array<number | null> =>
  days.map((d) => {
    const v = series.get(art)?.get(d)?.[key];
    return v == null ? gapOf(key, d) : v;
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
  if (!vals.length) return gapOf(key, d);   // уровень без данных - пропуск; количество - ноль, но только если день снят
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
const winMean = (a: string, win: string[], key: string) => {
  const v = nums(artDaily(a, win, key));
  return v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0;
};

/** Индексные метрики воронки: их контроль приходит из funnel_tests. */
const FUNNEL_PAGE_KEYS = new Set(["pos", "vsearch", "pdp", "cart", "units"]);

/** Какая агрегатная роль файла соответствует оценщику метрики. */
const aggRoleFor = (key: string): FunnelRole => estOf(key) === "sum" ? "agg_sum" : "agg_median";

/** Значение готового агрегата за день. */
function aggValue(t: TestDef, key: string, day: string): number | null {
  const pair = FUNNEL_MAP.find(([, to]) => to === key);
  if (!pair) return null;
  const r = aggDay(FT, t.id || "", aggRoleFor(key), day);
  if (!r) return null;
  const v = r[pair[0]];
  return v == null ? null : v;
}

/** Доля ненулевых по агрегатной строке. null - плотности в файле нет. */
function aggDensity(t: TestDef, key: string, day: string): number | null {
  const pair = FUNNEL_MAP.find(([, to]) => to === key);
  if (!pair) return null;
  const r = aggDay(FT, t.id || "", aggRoleFor(key), day);
  if (!r || !r.n || !r.n_nonzero) return null;
  const nz = r.n_nonzero[pair[0]];
  return nz == null ? null : nz / r.n;
}

/** Ряд артикулов из funnel_tests с нужной ролью. */
const funnelArts = (role: FunnelRole): string[] =>
  [...FT.roleOf].filter(([, r]) => r === role).map(([a]) => a);

/** Матрица «артикул × день» по нашим рядам. Пропуск остаётся пропуском у уровней, а у
 *  количеств становится нулём только если день вообще снят (см. metric-gap.ts). */
const matrixOf = (arts: string[], days: string[], key: string): Matrix =>
  arts.map((a) => artDaily(a, days, key));

/** Контрольная сторона по приоритету источников. */
function controlSide(t: TestDef, days: string[], key: string): { m: Matrix; src: CtlSrc; n: number; arts: string[] } {
  const ctlArts = FT.exists ? funnelArts("control") : [];
  // Правило выбора и его подписи живут в ctl-src.ts и покрыты тестами: 24.09 страница называла
  // явный список из tests.json «панелью снимка», то есть один источник другим.
  const src = pickCtlSrc({
    funnelMetric: FUNNEL_PAGE_KEYS.has(key),
    funnelFile: FT.exists,
    funnelArts: ctlArts.length,
    funnelAgg: FT.agg.has(t.id || ""),
    explicit: !!(t.контроль_группа && t.контроль?.length),
  });
  if (src === "funnel_arts") return { m: matrixOf(ctlArts, days, key), src, n: ctlArts.length, arts: ctlArts };
  if (src === "funnel_agg") {
    // Готовый агрегат это уже одно число на группу: делить его на карточки нечем и не нужно.
    const row = days.map((d) => aggValue(t, key, d));
    const n = aggDay(FT, t.id || "", aggRoleFor(key), FT.last)?.n ?? 0;
    return { m: [row], src, n, arts: [] };
  }
  const g = ctlGroupOf(t);
  return { m: matrixOf(g, days, key), src, n: g.length, arts: g };
}
/** Индексы окна внутри ряда дней. */
const idxOf = (days: string[], win: Set<string>): number[] =>
  days.map((d, i) => (win.has(d) ? i : -1)).filter((i) => i >= 0);

export interface SideCalc {
  /** Линия в индексах к базе. */
  line: Array<number | null>;
  /** Прирост в процентах тем же оценщиком, что и линия. */
  growth: number | null;
  /** Сколько наблюдений стоит за приростом. */
  n: number;
  est: Est;
  /** Доля ненулевых в матрице: сторож плотности. */
  share: number;
  /** Сколько рядов в группе. */
  rows: number;
}

/** Линия и число одним оценщиком. Разводить их нельзя: 24.09 ровно это и дало пустую линию
 *  корзины под подписью «-18 %». */
function sideOf(m: Matrix, key: string, base: number[], post: number[], groups?: string[]): SideCalc {
  const est = estOf(key);
  const g = estGrowth(m, base, post, est, groups);
  const d = density(m);
  return { line: estLine(m, base, est, groups), growth: g.value, n: g.n, est, share: d.share, rows: m.length };
}

/** Ключи объединённых карточек для рядов матрицы: вариант без карточки сам себе группа. */
const cardKeys = (arts: string[]): string[] => arts.map((a) => CARDS.card.get(a) ?? `art:${a}`);

/** Прирост группового контроля по метрике, тем же оценщиком, что и линия. */
function ctlGrowth(t: TestDef, key: string, base: string[], post: string[]): { d: number; n: number; src: CtlSrc; rows: number } {
  const days = [...base, ...post];
  const { m, src, n, arts } = controlSide(t, days, key);
  const bi = idxOf(days, new Set(base)), pi = idxOf(days, new Set(post));
  const g = estGrowth(m, bi, pi, estOf(key), arts.length ? cardKeys(arts) : undefined);
  return { d: g.value ?? 0, n: g.n, src, rows: n };
}

/** Изменение по каждому тестовому товару против ГРУППОВОГО контроля.
 *  Пара (ctl) остаётся в строке подписью: по ней видно, на кого похож товар, и на ней держатся
 *  проверки мёртвого и грязного контроля. В разницу она больше не входит: у восьми пар из 21
 *  контролем стояла родня, а родня едет за тестом и занижает разницу. */
function pairDeltas(t: TestDef, key: string, base: string[], post: string[]): PairDelta[] {
  const out: PairDelta[] = [];
  const g = ctlGrowth(t, key, base, post);
  for (const test of t.тест || []) {
    const ctl = (log.get(test)?.["контроль"] || "").trim();
    const bT = winMean(test, base, key), pT = winMean(test, post, key);
    if (!bT) continue;
    const dT = (pT / bT - 1) * 100;
    out.push({ test, ctl, bT, pT, bC: 0, pC: 0, dT, dC: g.d, dd: dT - g.d });
  }
  return out;
}

// Разрез по артикулам: что произошло с каждой парой отдельно. Медиана в шапке скрывает,
// что внутри группы товары расходятся, и без этой таблицы нельзя увидеть, кто тянет итог.
const PER_ART: Array<[string, string]> = [["vsearch", "Поиск"], ["views", "Показы"],
  ["pdp", "Карточка"], ["cart", "Корзина"]];
if (HAS_POS) PER_ART.push(["pos", "Позиция"]);
// Колонки «Соинвест» в разрезе по артикулам нет: она показывала разрыв тест минус контроль,
// то есть заявленный эффект, а вывод по нему снят вето ФЕНИКСА 23.09 (окно замера непригодно).
// Ряд и график соинвеста остаются, они описательные.

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
  const cell = (d: PairDelta | undefined, key = "") => {
    if (!d) return '<td class="r muted">-</td>';
    const good = key === "pos" ? d.dd < 0 : d.dd > 0;   // у позиции меньше - лучше
    const cls = Math.abs(d.dd) >= 20 ? (good ? "up" : "dn") : "";
    return `<td class="r ${cls}" title="тест ${d.dT >= 0 ? "+" : ""}${d.dT.toFixed(0)} %, групповой контроль ${d.dC >= 0 ? "+" : ""}${d.dC.toFixed(0)} %">${d.dd >= 0 ? "+" : ""}${d.dd.toFixed(0)}</td>`;
  };
  const roleOf = (a: string): string =>
    (t.роли?.test_ad || []).includes(a) ? "в рекламе"
      : (t.роли?.test_sibling || []).includes(a) ? "сосед по карточке" : "";
  const rows = first.map((p) => {
    const sb = meanOf(p.test, base, "spend"), sp = meanOf(p.test, days, "spend");
    const role = roleOf(p.test);
    return `<tr><td>${esc(p.test)}${role ? ` <span class="muted">${esc(role)}</span>` : ""}</td><td class="muted">${ctlCell(p.test, p.ctl, t)}</td>`
      + cols.map(([k]) => cell(byKey.get(k)!.find((x) => x.test === p.test), k)).join("")
      + `<td class="r sep">${(sb || sp) ? nbsp(sb) + " → " + nbsp(sp) : "-"}</td>`
      + `<td class="r">${ordT(p.test)} / ${ordT(p.ctl)}</td></tr>`;
  }).join("");
  // Итог группы считается ТЕМ ЖЕ оценщиком, что линия и число под графиком. У количеств это
  // прирост суммы по группе, а не медиана поартикульных приростов: иначе низ таблицы спорил
  // бы с графиком ровно так же, как линия спорила с подписью до 24.09.
  const med = cols.map(([k]) => {
    let m: number | null;
    if (estOf(k) === "sum") {
      const all = [...base, ...days];
      const bi = idxOf(all, new Set(base)), pi = idxOf(all, new Set(days));
      const gT = estGrowth(matrixOf(t.тест || [], all, k), bi, pi, "sum").value;
      const gC = ctlGrowth(t, k, base, days).d;
      m = gT == null ? null : gT - gC;
    } else {
      m = medByCard(byKey.get(k)!, (x) => x.dd);
    }
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
    + `<tfoot><tr class="mrow2"><td colspan="2" title="Плотные метрики: медиана индексов по артикулам, варианты одной объединённой карточки OZON идут одним наблюдением. Корзина и заказы: прирост суммы по группе">Итог группы</td>${med}<td class="sep"></td><td></td></tr></tfoot>`
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
  const CTL = ctlGroupOf(t);
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
    // Воронка: контрольная сторона берётся из funnel_tests, если файл доехал, иначе
    // считается по панели. Оценщик у линии и у числа под ней ОДИН, по метрике (estimator.ts).
    const ctlInfo = mode === "index" ? controlSide(t, days, key) : null;
    const rawC = ctlInfo && ctlInfo.src === "funnel_agg" ? ctlInfo.m[0]!
      : key === "cpc"
      ? ratio(groupDaily(CTL, days, "adspend"), groupDaily(CTL, days, "clicks"), 1)
      : key === "drr"
      ? ratio(groupDaily(CTL, days, "spend"), groupDaily(CTL, days, "revenue"))
      : groupDaily(CTL, days, key);
    const bT = avg(t.тест!, base, key);
    const bC = avg(CTL, base, key);
    const pT = avg(t.тест!, post, key);
    const pC = avg(CTL, post, key);
    let a: Pt[] = rawT, b: Pt[] = rawC;
    let sideT: SideCalc | null = null, sideC: SideCalc | null = null;
    if (mode === "index") {
      const bi = idxOf(days, new Set(base)), pi = idxOf(days, new Set(post));
      sideT = sideOf(matrixOf(t.тест!, days, key), key, bi, pi, cardKeys(t.тест!));
      sideC = sideOf(ctlInfo!.m, key, bi, pi, ctlInfo!.arts.length ? cardKeys(ctlInfo!.arts) : undefined);
      a = sideT.line; b = sideC.line;
      if (!nums(a).length || !nums(b).length) continue;
    } else if (!nums(rawT).length && !(testOnly || nums(rawC).length)) continue;
    // СТОРОЖ ПЛОТНОСТИ. Порог не переключает статистику, а останавливает рисование: половина
    // ряда, посчитанная одним способом, и половина другим, это не ряд. Переключение делается
    // правилом по метрике в estimator.ts, один раз и на весь ряд.
    const thinSide = mode === "index" && sideT && sideC && estOf(key) === "median"
      && Math.min(sideT.share, sideC.share) < DENSITY_MIN
      ? { test: sideT.share, ctl: sideC.share } : null;
    if (thinSide) {
      panes[key] = "";
      subs[key] = "линия не построена";
      tip[key] = { t: [], c: [], rt: rawT, rc: rawC, mode, unit };
      reads[key] = `<div class="dyn-alarm"><b>Линия не построена: метрика разредилась.</b> `
        + `${lowerTitle(title)} считается медианой индексов по артикулам, а ненулевое значение в день `
        + `есть лишь у ${(thinSide.test * 100).toFixed(0)} % тестовых и ${(thinSide.ctl * 100).toFixed(0)} % контрольных `
        + `при пороге ${(DENSITY_MIN * 100).toFixed(0)} %. На такой плотности медиана дневных индексов меряет шум и садится в ноль. `
        + `Статистику в середине ряда не меняем: это было бы полряда одним способом и полряда другим.</div>`;
      continue;
    }
    panes[key] = testOnly
      ? pane(days, si, a, a.map(() => null), mode, ["тест", ""], si2, "акция off")
      : pane(days, si, a, b, mode, ["тест", "контроль"], si2, "акция off");
    subs[key] = mode === "index"
      ? `100 = средний день двух недель перед стартом · ${EST_NAME[estOf(key)]}`
      : `по дням, как есть${unit ? ", " + unit.trim() : ""}`;
    tip[key] = { t: a.map((v) => v == null ? null : Math.round(v * 10) / 10), c: b.map((v) => v == null ? null : Math.round(v * 10) / 10), rt: rawT, rc: rawC, mode, unit };
    if (mode === "index") {
      // Число под графиком считается ТЕМ ЖЕ оценщиком, что и линия. До 24.09 линию рисовала
      // медиана дневных индексов, а число считала медиана приростов средних за окно, и на
      // корзине это дало пустую линию под подписью «-18 %».
      const dT = sideT!.growth, dC = sideC!.growth;
      const dd = (dT ?? 0) - (dC ?? 0);
      const bi1 = idxOf(days, new Set(base1)), pi1 = idxOf(days, new Set(post));
      const t1 = sideOf(matrixOf(t.тест!, days, key), key, bi1, pi1, cardKeys(t.тест!)).growth ?? 0;
      const c1 = sideOf(ctlInfo!.m, key, bi1, pi1, ctlInfo!.arts.length ? cardKeys(ctlInfo!.arts) : undefined).growth ?? 0;
      const dd1 = t1 - c1;
      const alarm = Math.abs(dd - dd1) > Math.max(Math.abs(dd), Math.abs(dd1)) * 0.5
        ? `<div class="dyn-alarm">Неделя перед стартом была нетипичной: по ней разница вышла бы <b>${dd1 >= 0 ? "+" : ""}${dd1.toFixed(0)}</b> пунктов вместо <b>${dd >= 0 ? "+" : ""}${dd.toFixed(0)}</b>. Считаем по двум неделям.</div>`
        : "";
      const pc = (x: number | null) => x == null ? "-" : (x >= 0 ? "+" : "") + x.toFixed(0) + " %";
      // У количеств статистика не переключается, но число наблюдений за линией надо называть:
      // прирост суммы на четырёх процентах ненулевых клеток это законная величина и хрупкая.
      const thinNote = estOf(key) === "sum" && sideC!.share < DENSITY_MIN
        ? ` <span class="warnv">Ненулевое значение есть лишь у ${(sideC!.share * 100).toFixed(0)} % наблюдений контроля`
          + ` при пороге ${(DENSITY_MIN * 100).toFixed(0)} %: линия и число стоят на редких событиях.</span>`
        : "";
      reads[key] = `<div class="dyn-read">${EST_NAME[estOf(key)]}, ${lowerTitle(title)}: тест <b>${pc(dT)}</b>, `
        + `групповой контроль <b>${pc(dC)}</b>, разница <b>${dd >= 0 ? "+" : ""}${dd.toFixed(0)} пунктов</b>. `
        + `Контроль: ${CTL_SRC_NAME[ctlInfo!.src]}, ${nbsp(ctlInfo!.n)} ${plural(ctlInfo!.n, "артикул", "артикула", "артикулов")}. `
        + `База - две недели перед стартом, после старта ${post.length} дн, данные по ${LAST}. `
        + `Наблюдений за числом: тест ${nbsp(sideT!.n)}, контроль ${nbsp(sideC!.n)}.`
        + `${thinNote}</div>${alarm}`;
    } else {
      const v = (x: number) => Number.isFinite(x) ? nbsp(x) + unit : "нет данных";
      let extra = "";
      // Соинвест из этого правила исключён: разрыв и сдвиг это заявка на эффект теста,
      // а она снята вето 23.09. График и сам ряд остаются.
      if (LEVEL.has(key) && key !== "coinv") {
        const gb = bT - bC, gp = pT - pC;      // разрыв в базе и после старта, в пунктах
        if (Number.isFinite(gb) && Number.isFinite(gp)) {
          const sgn = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(1);
          // Средний разрыв за весь период после старта размывает момент прихода эффекта:
          // надбавка приходит через двое-трое суток, и первые дни тянут среднее вниз.
          // Поэтому рядом со средним всегда стоит разрыв на последний день ряда.
          let lastTxt = "";
          for (let i = days.length - 1; i >= 0; i--) {
            const x = a[i], y = b[i];
            if (x != null && y != null) {
              lastTxt = ` На последний день ряда (${days[i]}) разрыв <b>${sgn(x - y)}</b>.`;
              break;
            }
          }
          extra = ` Разрыв тест минус контроль: <b>${sgn(gb)}</b> в базе → <b>${sgn(gp)}</b> в среднем после старта,`
            + ` сдвиг <b>${sgn(gp - gb)} пункта</b>.${lastTxt}`;
        }
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
  const uC = nums(groupDaily(CTL, post, "units")).reduce((x, y) => x + y, 0);
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
    + `<span class="lgi ctl"><i style="background:${C_CTRL}"></i>групповой контроль, ${CTL.length} арт.</span></div>`
    + `<svg class="cv" id="${cid}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Динамика по дням, тест против контроля">${panes["vsearch"]}</svg>`
    + `<div class="tip" id="${cid}-tip"></div><div id="${cid}-read">${reads["vsearch"]}</div>`
    + `<div class="dyn-note">Заказов после старта: тест <b>${uT}</b> шт, контроль <b>${uC}</b> шт. Линия заказов и корзины идёт индексом суммы по группе, а не медианой по артикулам: на 0-2 заказах в день медиана меряет шум. ${posNote}${gap}${thin}</div></div>`
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

function pairRow(sku: string, t: TestDef): string {
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
    + `<td class="sep">${ctlCell(sku, ct, t)}</td><td class="r">${vc ? nbsp(vc) : "-"}</td>`
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

/** Контроль, сидящий ещё и в соседней акции того же типа.
 *
 *  ЗАЧЕМ. Из 46 контрольных товаров «Усиления» 18 состоят ещё и в «Максимальном бустинге»
 *  (окно 08.09-06.10). Когда «Усиление» кончится 6 октября, у этих восемнадцати останется
 *  вторая акция, и они поведут себя иначе, чем остальные 28. Для запасной ветки, где замер
 *  идёт после конца акции, это прямо портит контроль, поэтому число видно заранее. */
function ctlPromoNote(t: TestDef): string {
  if (!t.акция || !PROMO.exists || !PROMO.days.length) return "";
  const day = PROMO.days[PROMO.days.length - 1]!;
  const own = promoKeyOf(t);
  const ctl = ctlGroupOf(t);
  const also = new Map<string, string[]>();
  for (const a of ctl) {
    for (const k of PROMO.byArt.get(a)?.get(day) ?? []) {
      if (k === own || !k.startsWith(t.акция.тип + ":")) continue;   // чужие типы акций не считаем
      (also.get(k) ?? also.set(k, []).get(k)!).push(a);
    }
  }
  if (!also.size) return "";
  const parts = [...also].sort((x, y) => y[1].length - x[1].length)
    .map(([k, arts]) => `${esc(k)}: <b>${arts.length}</b> из ${ctl.length}`);
  return `<div class="cov"><b>Часть контроля сидит ещё и в соседней акции того же типа</b> (на ${esc(day)}): `
    + parts.join(", ") + `. Пока идут обе акции, это не мешает: мы меряем выход из одной. `
    + `Но в запасной ветке, где замер идёт после конца «${esc(t.акция.имя)}», у этих товаров останется вторая акция, `
    + `и контроль расслоится. Тогда сравнивать надо с теми, у кого второй акции нет.</div>`;
}

/** Минимально различимая разница по итоговому критерию «предельная цена × заказы в день».
 *
 *  ЗАЧЕМ ЭТО ЧИСЛО НА СТРАНИЦЕ. Иван 24.09: «порог не выдумывай, посчитай минимально
 *  различимую разницу и выведи рядом». Порог, назначенный на глаз, выглядит осмысленным и
 *  ничего не проверяет: если критерий не в силах различить разницу меньше, чем в несколько
 *  раз, то любой «просели не больше чем на 20 %» это решение подбрасыванием монеты.
 *
 *  ШКАЛА. Математика в mde.ts и покрыта тестами. Печатаются ДВА конца в относительных
 *  единицах, а не одно симметричное число: 24.09 ФЕНИКС поймал здесь ровно эту ошибку, порог
 *  выводился как «288 %», хотя падения глубже 100 % не бывает.
 *
 *  ПРО «НЕ ЛУЧШЕ ЭТОГО». Умножение на предельную цену добавляет разброс (товары разной цены),
 *  поэтому настоящий порог по деньгам не мягче порога по штукам, а жёстче. */
function mdeBlock(t: TestDef): string {
  const post = t.горизонт_дней ?? 14;
  const baseDays: string[] = [];
  for (let k = 0; k < 14; k++) baseDays.push(addDays(LAST, -k));
  const ctlArts = (t.контроль || []).length ? t.контроль! : ctlGroupOf(t);
  const sumUnits = (arts: string[]) =>
    arts.reduce((s, a) => s + baseDays.reduce((x, d) => x + (series.get(a)?.get(d)?.["units"] || 0), 0), 0);
  const kTb = sumUnits(t.тест || []), kCb = sumUnits(ctlArts);
  const se = seLog({ kTb, kTp: kTb / 14 * post, kCb, kCp: kCb / 14 * post });
  const nT = (t.тест || []).length;
  const head = `За последние 14 дней тестовая группа набрала <b>${nbsp(kTb)}</b>`
    + ` ${plural(kTb, "заказ", "заказа", "заказов")} на ${nbsp(nT)} ${plural(nT, "артикул", "артикула", "артикулов")},`
    + ` контрольная <b>${nbsp(kCb)}</b> на ${nbsp(ctlArts.length)}.`;
  if (se == null) {
    return `<div class="dyn-alarm"><b>Итоговый критерий посчитать не на чем.</b> ${head}`
      + ` Без заказов хотя бы в одном из четырёх окон ни порог, ни различимая разница не определены.</div>`;
  }
  const d = detectable(se);
  // Сколько заказов нужно в КАЖДОМ из четырёх окон и сколько это артикулов при нынешнем темпе.
  const perArtWin = kTb / Math.max(nT, 1) / 14 * post;
  const artsFor = (k: number | null) => k == null ? null : Math.ceil(k / Math.max(perArtWin, 1e-9));
  const n30 = ordersNeeded(30), n50 = ordersNeeded(50);
  const needTxt = (rel: number, k: number | null) => k == null
    ? ``
    : ` Чтобы различить падение на ${rel} %, в каждом из четырёх окон нужно около ${nbsp(k)}`
      + ` ${plural(k, "заказа", "заказов", "заказов")}, то есть примерно ${nbsp(artsFor(k)!)}`
      + ` ${plural(artsFor(k)!, "такой артикул", "таких артикула", "таких артикулов")}.`;
  return `<div class="dyn-alarm"><b>Итоговый критерий сейчас ничего не различает.</b> ${head}`
    + ` При окне замера ${post} дн различимо только <b>падение глубже ${Math.abs(d.drop).toFixed(0)} %</b>`
    + ` или <b>рост выше ${nbsp(d.rise)} %</b> (Пуассон, 80 % мощности, 5 % двусторонний).`
    + ` Проще говоря, по деньгам мы увидим только практическое исчезновение заказов, и ничего слабее.`
    + ` По деньгам порог не мягче этого, а жёстче: умножение на предельную цену добавляет разброс.`
    + needTxt(30, n30) + needTxt(50, n50)
    + ` В панели снимка ${nbsp(PANEL.length)} ${plural(PANEL.length, "артикул", "артикула", "артикулов")}, то есть нужного объёма нет и не будет.`
    + ` Порог по деньгам поэтому не назначается: решение принимается по быстрому признаку (цена с картой Ozon),`
    + ` а деньги показываются как наблюдение, а не как критерий.</div>`;
}

/** Соинвест при выходе из акции растёт механически, и это надо говорить до замера. */
const COINV_MECH = `<div class="stop"><b>Соинвест из критерия убран.</b> При выходе из акции предельная цена`
  + ` возвращается с «по акции» на «без акций» и растёт, а соинвест считается от неё, поэтому он поднимется`
  + ` арифметически, что бы ни сделал OZON. Правило «соинвест не просел больше чем на 2 пункта» прошло бы само`
  + ` собой. Ряд и график соинвеста остаются описательными.</div>`;

const cards = T.тесты.map((t) => {
  const tst = t.тест || [], ctl = t.контроль || [];
  let body: string;
  if (tst.length || ctl.length) {
    const rows = tst.map((s) => pairRow(s, t)).join("");
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
      + `</thead><tbody>${rows}</tbody></table></div><div class="cov">${cov}</div>${kinBanner}${ctlPromoNote(t)}${dirtyControl(t)}${deadControl(t)}${chart(t, "dyn-" + t.id)}${perArticle(t)}`;
  } else {
    body = '<div class="muted" style="padding:8px 2px">Группы не заданы, тест не запущен.</div>';
  }
  return `<section class="card"><div class="chead"><div class="ctitle">${esc(t.название)} ${statusChip(t)}</div></div>`
    + `<div class="hyp">${esc(t.гипотеза)}</div>`
    + `<div class="meta"><span>Старт: <b>${esc(t.старт || "-")}</b></span><span>Замер: <b>${esc(t.замер || "-")}</b></span>`
    + `<span>Горизонт: <b>${esc(t.горизонт_дней ?? "")} дн</b></span>`
    + (t.акция ? exitMeta(t) : "")
    + `<span>Тест <b>${tst.length}</b> · Контроль <b>${ctl.length}</b></span>`
    + (t.ответственный ? `<span>Ответственный: <b>${esc(t.ответственный)}</b></span>` : "")
    + `</div>`
    + `<div class="rule"><b>Правило:</b> ${esc(t.правило || "")}</div>`
    + (t.акция ? COINV_MECH + mdeBlock(t) : "")
    + (t.стоп ? stopBlock(t.стоп) : "")
    + (t.заметка ? `<div class="cov" style="border-top:none;padding-top:0">${esc(t.заметка)}</div>` : "")
    + `${body}</section>`;
}).join("");

// ---------- карточка «Готовность к выходу из бустинга» ----------
// Формулировки описательные: сдвиг разрыва к контролю, и только. Вето ФЕНИКСА от 23.09 в силе.
const cpoDays = loadCpoDays("tools/tests/cpo_history.psv");
const storeMoves = loadMoves(dp("store_moves.ndjson"), cpoDays);

// Эталон, на котором откалибровано правило. Единственное наблюдение, и подпись под карточкой
// обязана это говорить: по одному случаю пороги проверены, но не подтверждены.
const REF: WaveItem = { art: "GGT-47-3-3-90", on: "2026-07-06", off: "2026-08-05", until: "2026-08-19" };

/** «1 день», «2 дня», «7 дней»: карточку читают люди. */
function plural(n: number, one: string, few: string, many: string): string {
  const d = Math.abs(n) % 100, u = d % 10;
  if (d >= 11 && d <= 14) return many;
  if (u === 1) return one;
  if (u >= 2 && u <= 4) return few;
  return many;
}

const STATUS_CHIP: Record<string, string> = {
  "плато": "chip-done", "едет": "chip-run", "не пришло": "chip-off", "ждём": "chip-off", "нет данных": "chip-off",
};

/** Спарклайн сдвига по дням. Один ряд, поэтому легенды нет: заголовок колонки его и называет.
 *  Пропуски не соединяем - день без наблюдения это пробел, а не прямая между соседями.
 *  Дни общего сдвига магазина помечены засечкой под нулевой линией: форма, а не только цвет. */
function spark(row: BoostRow): string {
  const pts = row.series;
  if (pts.length < 2) return '<span class="muted">-</span>';
  const W = 150, H = 30, PAD = 2;
  const vals = pts.map((p) => p.shift);
  const lo = Math.min(0, ...vals), hi = Math.max(ARRIVED, ...vals);
  const span = hi - lo || 1;
  const d0 = pts[0]!.day, dN = pts[pts.length - 1]!.day || 1;
  const x = (p: { day: number }) => PAD + (W - 2 * PAD) * ((p.day - d0) / (dN - d0 || 1));
  const y = (v: number) => PAD + (H - 2 * PAD) * (1 - (v - lo) / span);
  // Разрыв по календарю больше суток - ряд рвётся.
  const segs: string[] = [];
  let cur: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    if (i && p.day - pts[i - 1]!.day > 1) { if (cur.length > 1) segs.push(cur.join(" ")); cur = []; }
    cur.push(`${cur.length ? "L" : "M"}${x(p).toFixed(1)} ${y(p.shift).toFixed(1)}`);
  }
  if (cur.length > 1) segs.push(cur.join(" "));
  const line = segs.map((d) => `<path d="${d}" fill="none" stroke="${C_TEST}" stroke-width="2" stroke-linejoin="round"/>`).join("");
  const zero = `<line x1="0" x2="${W}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="#2a3441" stroke-width="1" stroke-dasharray="2 3"/>`;
  const gate = `<line x1="0" x2="${W}" y1="${y(ARRIVED).toFixed(1)}" y2="${y(ARRIVED).toFixed(1)}" stroke="#2a3441" stroke-width="1"/>`;
  const marks = pts.filter((p) => p.move).map((p) =>
    `<line x1="${x(p).toFixed(1)}" x2="${x(p).toFixed(1)}" y1="${H - 5}" y2="${H}" stroke="var(--warn)" stroke-width="2"><title>${p.date}: общий сдвиг магазина, ${p.move === "our_cpo" ? "наша смена ставки CPO" : "причина неизвестна"}</title></line>`).join("");
  const last = pts[pts.length - 1]!;
  const dot = `<circle cx="${x(last).toFixed(1)}" cy="${y(last.shift).toFixed(1)}" r="2.5" fill="${C_TEST}" stroke="var(--card)" stroke-width="2"/>`;
  const alt = `Сдвиг по дням с ${pts[0]!.date} по ${last.date}, последний ${last.shift >= 0 ? "+" : ""}${last.shift}`;
  return `<svg class="spk" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(alt)}">${zero}${gate}${line}${marks}${dot}</svg>`;
}

function boostRowHtml(r: BoostRow, label = ""): string {
  const sgn = (v: number | null) => (v == null ? "-" : (v >= 0 ? "+" : "") + v.toFixed(1));
  const chip = STATUS_CHIP[r.status] || "chip-off";
  const plateau = r.plateauFrom
    ? ` · плато с ${r.plateauFrom} (день ${r.plateauDay})`
    : (r.plateauNotBefore ? ` · плато не раньше ${r.plateauNotBefore}` : "");
  const baseNote = r.base == null ? "базы нет"
    : `база ${sgn(r.base)} по ${r.baseDays} чистым дням ${r.baseFrom}..${r.baseTo} (${r.baseSpan} календарных)`
      + (r.baseDirty ? ". ЧИСТЫХ ДНЕЙ НЕ ХВАТИЛО: база посчитана по дням с общим сдвигом магазина" : "");
  // У законченной кампании в колонке «День» стоит её длина, иначе счётчик уехал бы за
  // пределы кампании и читался бы как «идёт 77-й день».
  const dayCell = r.ranDays != null
    ? `<td class="r" title="Кампания шла ${r.ranDays} дн, на графике ещё ${(r.day ?? r.ranDays) - r.ranDays} дн после снятия">${r.ranDays}</td>`
    : `<td class="r">${r.day == null ? "-" : r.day}</td>`;
  return `<tr><td>${esc(r.art)}${label ? ` <span class="muted">${esc(label)}</span>` : ""}</td>`
    + dayCell
    + `<td class="r" title="${esc(baseNote)}">${sgn(r.shift)}</td>`
    + `<td class="spkc">${spark(r)}</td>`
    + `<td><span class="chip ${chip}">${esc(r.status)}</span><span class="muted">${esc(plateau)}</span></td></tr>`;
}

function boostCard(): string {
  const wave = T.тесты.find((t) => t.id === "boost_plus_exit");
  if (!wave || !coinvRows.length) return "";
  const key = promoKeyOf(wave);
  const AD = wave.роли?.test_ad || [];
  const SIB = wave.роли?.test_sibling || [];

  // БАЗА И ПЛАТО СЧИТАЮТСЯ НА ОДНОМ ИСТОЧНИКЕ ЦЕНЫ, И ИСТОЧНИК ПОДПИСАН.
  //
  // До 23.09 цена с картой выводилась из коэффициента, замороженного на 09.09
  // (oa_source = ratio_2026-09-09 у всех 514 строк), с 23.09 она снята с витрины
  // (exact у 498 из 514). Склеивать выведенные и снятые дни в один ряд нельзя: база разная.
  //
  // ПОЧЕМУ НЕ ПРОСТО «ТОЛЬКО exact». Так и было сделано 24.09, и ФЕНИКС показал, что гейт от
  // этого умер: база требует FLAT_DAYS точек СТРОГО РАНЬШЕ старта волны (boost-readiness.ts,
  // baseOf), старт 20.09, а единственный exact-день это 23.09. Будущие дни прошлыми не
  // станут, значит база оставалась бы null навсегда, плато не сложилось бы ни при каком
  // развитии событий, и страница при этом обещала «три дня наберутся не раньше 25.09».
  // Мёртвый гейт хуже отсутствующего: он выглядит работающим.
  //
  // ПОЭТОМУ источник выбирается по наличию данных ДО СТАРТА и называется на странице. Когда
  // снятых дней до старта следующей волны наберётся FLAT_DAYS, переключение произойдёт само.
  const exactDays = [...new Set(coinvRows.filter((r) => r.observed !== false && isExact(r)).map((r) => r.date))].sort();
  const exactFrom = exactDays[0] ?? "";
  const waveOn = (wave.старт || "").slice(0, 10);
  const exactBefore = exactDays.filter((d) => d < waveOn).length;
  const EXACT_ONLY = exactBefore >= FLAT_DAYS;
  const basisNote = EXACT_ONLY
    ? `База и плато считаются по снятой цене покупателя (снятых дней до старта ${exactBefore}).`
    : `<b>База и плато считаются по выведенной цене.</b> Цена с картой Ozon снимается с витрины`
      + ` только с ${esc(exactFrom || "-")}, а база требует ${FLAT_DAYS} дня строго раньше старта`
      + ` ${esc(waveOn)}; таких снятых дней ${exactBefore}. До этой даты цена покупателя выводилась из`
      + ` коэффициента, замороженного на 09.09, поэтому ряд описывает модель цены, а не наблюдение.`
      + ` Величина сдвига на таком ряду смещена неизвестно насколько, и одно это уже основание`
      + ` не принимать решение о выводе по цифре, а смотреть на форму ряда.`
      + ` Переключение на снятую цену произойдёт само, когда её наберётся ${FLAT_DAYS} дня до старта волны.`;
  const ctl = controlByDay(coinvRows, TEST_ARTS, KIN_ANY, EXACT_ONLY);
  const per = exitByArt(wave);
  const mk = (it: WaveItem) => readiness(it, gapSeries(coinvRows, it.art, ctl, EXACT_ONLY), storeMoves);
  const items = (arts: string[]): WaveItem[] => arts.map((a) => ({
    art: a, on: waveOn, off: per.get(a)?.exit ?? undefined,
  }));
  const adRows = items(AD).map(mk);
  const sibRows = items(SIB).map(mk);
  const ref = mk(REF);
  const sum = exitSummary(wave);

  const head = `<tr><th>Артикул</th><th class="r" title="Дней с включения кампании. День включения нулевой">День</th>`
    + `<th class="r" title="Сдвиг разрыва к контролю от базы, в пунктах. Наведите, чтобы увидеть базу">Сдвиг</th>`
    + `<th title="Сдвиг по дням. Пунктир - ноль, сплошная - порог ${ARRIVED} пунктов. Разрыв линии это день без наблюдения, засечка снизу - общий сдвиг магазина">Динамика</th>`
    + `<th>Статус</th></tr>`;
  const tbl = (rs: BoostRow[]) => rs.length
    ? `<div class="tbl-wrap"><table class="gtbl single"><thead>${head}</thead><tbody>${rs.map((r) => boostRowHtml(r)).join("")}</tbody></table></div>`
    : "";

  // ПЛАТО ПОАРТИКУЛЬНОЕ, А НЕ ГРУППОВОЕ (правило Ивана от 24.09). На 23.09 разрыв к медиане
  // панели у пяти рекламных разошёлся от -0.8 до +13.5 при пороге +8: двое похожи на товар с
  // надбавкой, у троих её не видно. Выводим только тех, у кого плато сложилось.
  const ready = adRows.filter((r) => r.plateauFrom);
  // Разрыв на последний день ряда: считается ТЕМ ЖЕ источником цены, что база и плато выше.
  // Брать его по снятой цене, когда база по выведенной, значит показать рядом два числа из
  // разных шкал и предложить читателю сравнить их с порогом.
  const gapsNow = AD.map((a) => {
    const g = gapSeries(coinvRows, a, ctl, EXACT_ONLY);
    const last = g[g.length - 1];
    return { art: a, gap: last?.gap ?? null, on: last?.date ?? "" };
  });
  const gapsTxt = gapsNow.map((g) => `<b>${esc(g.art)}</b> ${g.gap == null ? "нет" : (g.gap >= 0 ? "+" : "") + g.gap.toFixed(1)}`).join(", ");
  const overThr = gapsNow.filter((g) => g.gap != null && g.gap >= ARRIVED).length;
  const withGap = gapsNow.filter((g) => g.gap != null).length;
  const gapDay = gapsNow.find((g) => g.on)?.on ?? "";

  const win = wave.окно_выхода;
  // Когда плато МОЖЕТ сложиться: FLAT_DAYS наблюдаемых дней после старта, считая по тому же
  // источнику, на котором стоит база. Раньше здесь стояла дата, посчитанная от первого
  // снятого дня и не смотревшая на дату старта, и она обещала недостижимое.
  const seriesDays = [...new Set(coinvRows
    .filter((r) => r.observed !== false && (!EXACT_ONLY || isExact(r)) && r.date >= waveOn)
    .map((r) => r.date))].sort();
  const haveAfter = seriesDays.length;
  const earliest = haveAfter >= FLAT_DAYS ? seriesDays[FLAT_DAYS - 1]! : addDays(LAST, FLAT_DAYS - haveAfter);
  const exitPlan = `<div class="hyp"><b>Когда выводим.</b> Плато требует ${FLAT_DAYS} подряд наблюдаемых дня после старта `
    + `${esc(waveOn)}. Наблюдаемых дней после старта уже ${haveAfter}, значит плато может сложиться `
    + (haveAfter >= FLAT_DAYS ? `с ${esc(earliest)}` : `не раньше ${esc(earliest)} и только при чистых прогонах подряд`) + `. `
    + (win ? `Окно выхода: <b>${esc(win.от)}..${esc(win.до)}</b>. ` : "")
    + `Плато ждём по каждому товару отдельно, и выводим только тех, у кого оно сложилось.</div>`
    + `<div class="cov">${basisNote}</div>`;

  const gapNote = `<div class="cov"><b>Разрыв к медиане панели${gapDay ? ` на ${esc(gapDay)}` : ""}:</b> ${gapsTxt}. `
    + `Порог плато +${ARRIVED} пунктов, за него вышли <b>${overThr}</b> из ${withGap}. `
    + `Это довод против группового решения: вывести всех разом значило бы вывести остальных вслепую.</div>`;

  const exitedTbl = sum.out.length
    ? `<div class="sub2">Вышли из акции</div><div class="tbl-wrap"><table class="gtbl single"><thead>`
      + `<tr><th>Артикул</th><th class="r">Дней после выхода</th><th class="r">Сдвиг</th><th>Динамика</th><th>Возврат к базе</th></tr></thead><tbody>`
      + [...adRows, ...sibRows].filter((r) => r.off).map((r) => `<tr><td>${esc(r.art)}</td><td class="r">${r.daysSinceOff ?? "-"}</td>`
        + `<td class="r">${r.shift == null ? "-" : (r.shift >= 0 ? "+" : "") + r.shift.toFixed(1)}</td>`
        + `<td class="spkc">${spark(r)}</td>`
        + `<td>${r.backToBaseOn ? `${esc(r.backToBaseOn)} <span class="muted">держался ${r.heldDays} дн</span>` : '<span class="muted">ещё держится</span>'}</td></tr>`).join("")
      + `</tbody></table></div>`
    : `<div class="sub2">Вышли из акции</div><div class="cov">Из акции «${esc(wave.акция?.имя || "")}» пока не вышел никто.`
      + ` Дата выхода нигде не фиксируется руками: запись акции исчезает из колонки acts в тот же день, и это и есть дата.`
      + (PROMO.exists
          ? ` Снимков участия в репозитории: ${PROMO.days.length} (${esc(PROMO.days[0] || "")}..${esc(PROMO.days[PROMO.days.length - 1] || "")}).`
          : ` Файла ${PROMO_DAILY_FILE} пока нет, участие не отслеживается: это сломанная доставка, а не «никто не вышел».`)
      + `</div>`;

  // ЗАПАСНАЯ ВЕТКА. Её надо держать на виду заранее, а не сочинять 29-го: если плато не
  // сложится ни у кого, акция кончится сама 6 октября сразу у всех участников, и тогда тест
  // меряет не наше решение, а календарь площадки, с другим контролем и другой датой замера.
  const fb = wave.запасная_ветка;
  const fbDays = fb ? daysBetween(TODAY, fb.конец_акции) : 0;
  const fbBlock = fb
    ? `<div class="stop"><b>Если плато не сложится ни у кого к ${esc(win?.до || "-")}:</b> ${esc(fb.действие)}.`
      + ` Акция кончается ${esc(fb.конец_акции)}${fbDays > 0 ? ` (через ${fbDays} дн)` : ""} сразу у всех ${membersOn(PROMO, key, PROMO.days[PROMO.days.length - 1] || "").length || 56} участников,`
      + ` контроль тогда другой (${esc(fb.контроль)}), замер ${esc(fb.замер)}.`
      + ` Это уже не выход по нашему решению, а конец акции по календарю площадки, и вывод будет слабее.</div>`
    : "";

  // Сводка по общим сдвигам. Она же объясняет, почему окно базы растягивается на две недели:
  // чистых дней на нашей частоте сдвигов в календарной семидневке просто не набирается.
  const ours = [...storeMoves.values()].filter((v) => v === "our_cpo").length;
  const obsDays = new Set(coinvRows.filter((r) => r.observed !== false).map((r) => r.date));
  const clean = [...obsDays].filter((d) => !storeMoves.has(d)).length;
  const sep = [...obsDays].filter((d) => d.startsWith("2026-09"));
  const sepClean = sep.filter((d) => !storeMoves.has(d)).length;
  const movesNote = storeMoves.size
    ? `Магазин двигался целиком в ${storeMoves.size} днях из ${obsDays.size} наблюдаемых, чистых осталось ${clean}.`
      + ` В сентябре из ${sep.length} наблюдаемых дней чистых всего ${sepClean}.`
      + ` По логу ставки CPO «все товары» ${ours} из этих дней наши собственные: смена ставки двигает витрину по всему каталогу в тот же день.`
      + ` Такие дни помечены засечкой и днём плато не считаются, а окно базы набирается по чистым дням, а не по календарю, и потому растягивается.`
    : `Файла data/store_moves.ndjson нет, поэтому дни общего сдвига магазина не помечены. Пока его нет, плато может собраться на дне, когда двигался весь каталог.`;

  // Практический вывод, который стоит держать на виду у команды, а не в переписке.
  const cpoNote = cpoDays.size
    ? `<div class="stop"><b>На время тестов:</b> ставку CPO «все товары» держать на 5 % и не трогать.`
      + ` В логе ${cpoDays.size} ${plural(cpoDays.size, "день", "дня", "дней")} смены ставки, последний ${[...cpoDays].sort().pop()};`
      + ` каждая смена двигает витрину по всему каталогу в тот же день и въезжает в середину замера.</div>`
    : "";

  return `<section class="card"><div class="chead"><div class="ctitle">Готовность к выходу из акции «${esc(wave.акция?.имя || "")}»</div></div>`
    + kinBanner
    + `<div class="hyp">Сдвиг разрыва к контролю по дням с включения кампании. Контроль - панель снимка без тестовых артикулов, `
    + `разрыв считается по цене с картой Ozon. База - медиана разрыва за ${BASE_DAYS} ЧИСТЫХ наблюдаемых дней до включения, то есть дней без общего сдвига магазина; на нашей частоте сдвигов такое окно растягивается на две календарные недели.</div>`
    + exitPlan
    + `<div class="rule"><b>Статусы:</b> плато - ${FLAT_DAYS} подряд наблюдаемых дня, размах не больше ${FLAT_RANGE} пунктов, сдвиг не ниже +${ARRIVED}. `
    + `Едет - растёт, плато ещё нет. Не пришло - прошло ${LATE_AFTER}+ дней, сдвиг ниже +${ARRIVED}. Ждём - меньше ${FLAT_DAYS} дней.</div>`
    + `<div class="sub2">В рекламе, ждут плато (${AD.length})</div>`
    + tbl(adRows)
    + (adRows.length ? "" : `<div class="cov">Рекламных товаров в волне нет.</div>`)
    + gapNote
    + `<div class="sub2">Соседи по карточке, рекламы нет (${SIB.length})</div>`
    + tbl(sibRows)
    + `<div class="cov">Соседи едут из акции вместе со своей карточкой, но плато по ним не ждём: рекламы на них нет, и надбавке взяться неоткуда. `
    + `Они нужны, чтобы карточка выходила целиком: иначе половина карточки осталась бы в акции и тянула вторую половину за собой.`
    + (SIB.length ? "" : " В этой волне соседей нет.") + `</div>`
    + `<div class="cov"><b>Готовы к выводу сейчас:</b> ${ready.length ? ready.map((r) => esc(r.art)).join(", ") : "никто"}.</div>`
    + exitedTbl
    + fbBlock
    + `<div class="sub2">Эталон, на котором откалибровано правило</div>`
    + `<div class="tbl-wrap"><table class="gtbl single"><thead>${head}</thead><tbody>${boostRowHtml(ref, "кампания 06.07-05.08")}</tbody></table></div>`
    + `<div class="cov"><b>Правило откалибровано на одном наблюдении.</b> ${esc(REF.art)}: сдвиг вышел за +${ARRIVED} на третий день, `
    + `плато началось на четвёртый и держалось до конца кампании; после снятия бустинга сдвиг прожил ${ref.heldDays ?? "-"} дн и вернулся к базе ${esc(ref.backToBaseOn || "-")}. `
    + `Пороги ${FLAT_DAYS} дня, ${FLAT_RANGE} пункта, +${ARRIVED} и возврат ниже +${BACK_TO_BASE} подобраны под этот случай и на других не проверены. `
    + `Что именно двигает разрыв, карточка не утверждает: вето от 23.09 в силе.</div>`
    + `<div class="cov"><b>База эталона пересчитана 23.09 с чистым контролем.</b> ${esc(REF.art)} сидит в объединённой`
    + ` карточке 5728188877 вместе с двадцатью GGT-03-*-L-80/90, и все двадцать были в контроле, потому что карты`
    + ` карточек не было. База при этом выходила -4.5, а плато +17.4. С исключённой карточкой база -9.3, плато +22.5:`
    + ` заражённый контроль прятал 5.1 пункта, то есть около четверти эффекта.`
    + ` Порог +${ARRIVED} пересчитывать не пришлось, и это не удача, а свойство ряда: сдвиг прыгает с +2.6 сразу на`
    + ` +14.8 за сутки, поэтому любой порог от 3 до 14 даёт одну и ту же дату выхода 2026-07-09. Переехала величина`
    + ` эффекта, а не дата и не правило.</div>`
    + `<div class="cov">${esc(movesNote)}</div>${cpoNote}</section>`;
}


const mblock = measured.length ? `<h2 class="sec">Измеренные тесты</h2>` + measured.map((t: any) =>
  `<div class="mrow"><div class="ctitle">${esc(t.name)} <span class="chip chip-done">измерен</span></div>`
  + `<div class="meta"><span>Старт <b>${esc(t.started)}</b></span><span>Замер <b>${esc(t.read)}</b></span>`
  + `<span>Тест <b>${esc(t.t)}</b> · Контроль <b>${esc(t.c)}</b></span></div>`
  + `<div class="res">${(t.res || []).map(([a, b]: [string, string]) => `${esc(a)}: ${esc(b)}`).join(" · ")}</div>`
  + `<div class="muted">${esc(t.note || "")}</div></div>`).join("") : "";

// Пробелы снимка цен - в заметки страницы: §15 требует подсвечивать их в дашборде, а не
// ждать, пока кто-то заметит расхождение сам.
const gaps: string[] = [];
/** Предупреждения идут выше заметок и отдельной плашкой: заметку прочитают когда-нибудь,
 *  а устаревшая карта портит цифру уже сегодня. */
const warns: string[] = [];
if (coinvSkipped) gaps.push(`Дней без наблюдения в снимке цен: ${nbsp(coinvSkipped)} строк.`
  + ` Такие дни идут пробелом, а не точкой: 19 и 20.09 снимок продублировал вчерашние цены,`
  + ` и рисовать по ним линию значило бы показывать данные, которых нет.`);
if (panelFixed) {
  const outside = [...artSet].filter((a) => !panel.has(a));
  gaps.push(`Состав панели снимка зафиксирован: ${nbsp(panel.size)} артикулов.`
    + (outside.length
      ? ` Вне панели ${outside.length} из ${artSet.size} артикулов тестов: ${outside.slice(0, 6).map(esc).join(", ")}${outside.length > 6 ? " и ещё " + (outside.length - 6) : ""}. По ним соинвеста нет.`
      : ` Все ${artSet.size} артикулов тестов в панель входят.`));
}
{
  const last = [...new Set(coinvRows.map((r) => r.date))].sort().pop() ?? "";
  const day = coinvRows.filter((r) => r.date === last);
  const exact = day.filter((r) => (r as any).oa_source === "exact").length;
  if (exact) {
    gaps.push(`Цена покупателя с картой Ozon за ${last} снята напрямую у ${nbsp(exact)} товаров`
      + ` из ${nbsp(day.length)}; у остальных она выведена коэффициентом от витрины, и поле`
      + ` oa_source это показывает. Выведенная цена годится для уровня, но не для дневного сдвига.`);
  }
}
gaps.push(`Правило отбора контроля зафиксировано 23.09.2026, ДО замеров 2 и 4 октября, и по`
  + ` июльским данным, а не по результату волны: контролем не может быть товар, который делит`
  + ` объединённую карточку OZON с артикулом этого теста. Группа считается по каждому тесту`
  + ` отдельно: ` + T.тесты.map((t) => `${t.id} ${nbsp(ctlGroupOf(t).length)}`).join(", ")
  + ` ${plural(ctlGroupOf(T.тесты[0]!).length, "артикул", "артикула", "артикулов")} из ${nbsp(PANEL.length)} в панели.`);
// Карта карточек лежит в репозитории отдельным файлом и сама себя не обновляет: сырая
// выгрузка в git не едет, а npm run cards запускается руками. Если каталог поедет, а карту
// никто не пересоберёт, родство протухнет молча и разница поедет вместе с ним. Поэтому
// возраст карты и её покрытие стоят прямо в заметках, а расхождение выше порога это
// предупреждение, а не примечание. Пороги и решение в card-kin.ts: mapHealth.
{
  const covered = [...new Set(coinvRows.filter((r) => r.date === LAST).map((r) => r.art))];
  const miss = covered.filter((a) => !CARDS.card.has(a));
  const { age, stale } = mapHealth(CARDS, LAST, covered);
  const share = covered.length ? miss.length / covered.length : 0;
  const head = `Карта объединённых карточек: ${nbsp(CARDS.groups)} ${plural(CARDS.groups, "карточка", "карточки", "карточек")}`
    + `, выгрузка от ${esc(CARDS.importedAt || "неизвестной даты")}`
    + (age == null ? "" : `, это ${nbsp(age)} ${plural(age, "день", "дня", "дней")} назад`)
    + `. Без карточки в снимке на ${LAST} ${nbsp(miss.length)} ${plural(miss.length, "артикул", "артикула", "артикулов")}`
    + ` из ${nbsp(covered.length)} (${(share * 100).toFixed(1)} %).`;
  const why = ` Карта не обновляется сама: сырая выгрузка в репозиторий не едет, её превращает в файл`
    + ` npm run cards. Пока карта не пересобрана, родство считается по старому составу.`;
  if (stale) {
    warns.push(`КАРТА КАРТОЧЕК УСТАРЕЛА. ${head}${why} Пересоберите карту до замера: на устаревшей`
      + ` карте из контроля уходит не та родня, и разница поедет вместе с ней.`);
  } else {
    gaps.push(`${head}${why}`);
  }
}
// Шапка пишет одну дату на всю страницу, а метрики доезжают по-разному: соинвест снимается
// ежедневно, воронка отстаёт. Без этой строки читатель видит «данные по 23.09» и принимает
// конец линии показов за провал, хотя там просто нет дня.
{
  const LABEL: Record<string, string> = {
    coinv: "соинвест", price: "цена на витрине", pos: "позиция в поиске",
    vsearch: "показы в поиске", pdp: "заходы в карточку", units: "заказы",
    adspend: "расход на рекламу",
  };
  const till = coverage(series, Object.keys(LABEL)).map((x) => [LABEL[x.key]!, x.last] as const);
  const behind = till.filter(([, d]) => d < LAST);
  if (till.length) {
    const list = till.map(([l, d]) => `${l} по ${d}`).join(", ");
    const text = `Метрики доезжают до разных дней: ${list}. В шапке стоит самая поздняя дата`
      + ` (${LAST}), поэтому у отстающих метрик линия на графике обрывается раньше правого края.`
      + ` Обрыв это отсутствие дня, а не падение до нуля: день без съёма мы больше не рисуем нулём.`;
    if (behind.length) warns.push(`МЕТРИКИ ОТСТАЮТ ОТ ШАПКИ. ${text}`);
    else gaps.push(text);
  }
}
gaps.push(`Родство считается только по настоящей карточке OZON. Префикс артикула (линия) как`
  + ` признак родства убран 23.09: линия объединяет разные модели, то есть это догадка,`
  + ` выглядящая как данные. Замены на уровне панели нет, и это проверено: правило «родня это`
  + ` корреляция остатков от 0.3 хоть с одним из 21 тестового» метит роднёй 490 артикулов из 493,`
  + ` а случайная двадцатка нетестовых метит 99.6 %, столько же. Корреляция осталась там, где`
  + ` работает: одно сравнение, тест против своего кандидата в пару. Пока карты карточек нет,`
  + ` группа не чистится вовсе, и на число это не влияет: разница по соинвесту равна +9 пунктов`
  + ` и при 232 артикулах контроля, и при 445, и при 493.`);
gaps.push(`Ставка оплаты за заказ «все товары» равна 5 %: подтверждено замерами 20, 21 и 23.09,`
  + ` журнал изменений за 08-19.09 недоступен. Наблюдений три, поэтому слова «непрерывно» здесь`
  + ` нет. Последняя запись журнала 2026-09-07 08:14, «9 % -> 5 %»; в ленте кабинета за 08-19.09`
  + ` лежат 35 событий других типов и ни одного изменения этой ставки, но ленту и журнал`
  + ` собирает один и тот же съём, так что это не независимое подтверждение. Сдвиги магазина`
  + ` в 10 днях из 12 в этом окне на вылазку ставки не указывают: они двигают 513-514 артикулов`
  + ` разом и чередуют направление, то есть это механика скидок OZON, а не смена нашей ставки`
  + ` по подмножеству.`);
gaps.push(`26 артикулов есть в реестре начислений, но цены по ним снимок не отдаёт. Статус:`
  + ` ЖИВЫ, ЦЕНЫ НЕТ. Проверка воронки: живы все 26, у каждого ненулевые показы, последний`
  + ` наблюдаемый день с 20 по 22.09; самый крупный GGT-03-2-5-E-16080-K, 117 878 показов за`
  + ` 207 дней. Слово «архив» к ним не применимо, и ноля показов у них нет. В тесты они не`
  + ` входят, на разницу тест минус контроль не влияют. Срок закрытия дыры конец октября.`);
gaps.push(`Каталог на ${LAST} это ${nbsp(CARDS.card.size)} ${plural(CARDS.card.size, "товар", "товара", "товаров")}`
  + ` по выгрузке кабинета. В снимке соинвеста строк больше (${nbsp(new Set(coinvRows.map((r) => r.art)).size)}):`
  + ` он держит и те артикулы, что из каталога уже ушли, чтобы не терять их историю. Число 514`
  + ` это ширина снимка, а не размер каталога.`);
// Источник воронки: состояние, потери и метод. Пустой файл это не «нет данных», а
// сломанная доставка, и молчать об этом нельзя: вкладка уже один раз замерла так на два дня.
{
  const LOST = ["GGT-48-2-2-100-180", "GGM-17-2-1", "GGK-02-1-5-120", "GGT-03-1-3-S-40"];
  if (!FT.exists) {
    // Перечисляем ровно ту метрику, которой нет. Прежний текст отрицал все пять, и рядом на
    // той же странице стояли графики показов и число заказов: баннер спорил со страницей.
    warns.push(`ВОРОНКА ТЕСТОВ НЕ ПРИЕХАЛА. Файла data/${FUNNEL_TESTS_FILE} в репозитории нет,`
      + ` поэтому позиции в поиске на вкладке нет вовсе, а показы, заходы, корзина и заказы идут`
      + ` из ночного синка data/sku_views.ndjson, то есть из общей выгрузки, а не из среза под тесты.`
      + ` Прежний источник funnel_sku_daily.ndjson отключён: он был разовой выгрузкой, кончился`
      + ` 21.09 и держал вкладку замершей, пока позиция снималась каждый день. Съём кладёт новый`
      + ` файл с 24.09, первый прогон зальёт историю с 12.06.`);
  } else {
    const days = [...new Set(FT.rows.map((r) => r.date))].sort();
    const arts = [...FT.byArt.keys()];
    gaps.push(`Воронка тестов идёт из data/${FUNNEL_TESTS_FILE}: ${nbsp(FT.rows.length)}`
      + ` ${plural(FT.rows.length, "строка", "строки", "строк")}, ${nbsp(days.length)}`
      + ` ${plural(days.length, "день", "дня", "дней")} с ${FT.first} по ${FT.last},`
      + ` ${nbsp(arts.length)} ${plural(arts.length, "артикул", "артикула", "артикулов")}`
      + ` и агрегаты по ${nbsp(FT.agg.size)} ${plural(FT.agg.size, "тесту", "тестам", "тестам")}`
      + ` (${[...new Set(FT.rows.filter((r) => r.n != null).map((r) => r.role))].sort().join(", ") || "агрегатных строк нет"}).`
      + ` Выручки в файле нет намеренно: репозиторий публичный, поартикульная выручка в него не едет.`);
    if (FT.bad.length) {
      warns.push(`ВОРОНКА: контракт не прошли ${nbsp(FT.bad.length)}`
        + ` ${plural(FT.bad.length, "строка", "строки", "строк")}, в расчёт не взяты. Первые: `
        + FT.bad.slice(0, 3).map((b) => `строка ${b.line} (${b.why})`).join("; ") + `.`);
    }
    // Пропажа внутри ряда: товар был до и после, а в этот день его нет. Ровно так 22.09
    // молча выпали четыре тестовых артикула, и заметили это только по числу строк.
    const holes: string[] = [];
    for (const [art, byDay] of FT.byArt) {
      const miss = missingDays(byDay, days);
      if (miss.length) holes.push(`${art}: ${miss.join(", ")}`);
    }
    if (holes.length) {
      warns.push(`ВОРОНКА: у части артикулов пропали дни, которые в файле есть у других.`
        + ` Это не ноль и не конец жизни товара, это потеря съёма. `
        + holes.slice(0, 8).join("; ") + (holes.length > 8 ? ` и ещё ${holes.length - 8}` : "") + `.`);
    }
  }
  gaps.push(`22 и 23 сентября из воронки выпали четыре тестовых товара: ${LOST.join(", ")}.`
    + ` Причина в списке sku запроса, а не в товарах: из 279 выпавших в тот день 146 при этом`
    + ` присутствовали в снимке цен. По 21.09 позиция была у 20 тестовых из 20, с 22.09 стала`
    + ` у 16. В съёме починено (список = снимок цен плюс воронка за 14 дней, сторож на охват`
    + ` и поимённая проверка артикулов тестов), но эти два дня потеряны навсегда.`
    + ` В тесте 1 это один артикул из 11, в тесте 2 три из 10. Динамику за полное окно по ним`
    + ` читать нельзя, только по усечённому.`);
  gaps.push(`Контрольная сторона считается двумя способами, и это не небрежность. Соинвест,`
    + ` цена и ставка: медиана ПРИРОСТОВ по артикулам группы. Воронка: прирост МЕДИАНЫ, потому`
    + ` что медиана приходит из съёма уже посчитанной и очищенной по карте карточек, и по ней`
    + ` восстановить приросты отдельных артикулов невозможно. Величины близкие, но не`
    + ` тождественные, и сравнивать их между собой напрямую нельзя.`);
}
gaps.push(`search_promo_products не собирается, и это не пробел: через seller-proxy ручка`
  + ` отдаёт 405 и 404, настоящие данные лежат на performance.ozon.ru за логином. Единственный`
  + ` доехавший файл (19.09) содержал одну строку, то есть полным не был никогда. Расход, клики`
  + ` и заказы по дням берутся из ads_daily.ndjson: 231 день с 2026-02-04 по 2026-09-22.`);
gaps.push("Соинвест считается по цене, которую покупатель платит с картой Ozon, а не по"
  + " витринной. Сверка с реестром начислений за август (npm run coinv:calib, 274 заказа, цена"
  + " берётся на день заказа): по витрине 51.6 %, по цене с картой 56.4 %, факт 57.4 %."
  + " Отношение «факт к нашей цене по карте» 0.999. Разницу между предельной ценой и тем, что"
  + " заплатил покупатель, оплачивает Ozon.");
const notes = [...(T.заметки || []), ...gaps].map((n) => `<li>${esc(n)}</li>`).join("");
const warnBlock = warns.map((w) => `<div class="stop"><b>${esc(w.split(".")[0] ?? "")}.</b>`
  + `${esc(w.slice((w.split(".")[0] ?? "").length + 1))}</div>`).join("");
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
.kin{color:var(--ink3);font-size:11px;white-space:nowrap}.kinart{color:var(--ink3);text-decoration:line-through;text-decoration-color:var(--ink3)}
.spk{width:150px;height:30px;display:block}.spkc{width:160px}
.stop{font-size:12.5px;color:var(--ink2);background:rgba(255,90,95,.09);border-left:3px solid #FF5A5F;padding:7px 10px;border-radius:6px;margin:8px 0}.stop b{color:#FF7A7E}.dl2{margin:6px 0 6px 18px;padding:0}.dl2 li{margin:2px 0}
.warnv{color:var(--warn)}.muted{color:var(--ink3)}.mrow{background:var(--card);border:1px solid var(--soft);border-radius:12px;padding:12px 16px;margin-bottom:10px}
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
  + `<b>Δ поиска</b> - насколько пара сопоставима по трафику до старта. Сама разница считается не к паре, а к групповому контролю: панель снимка без тестовых товаров и их родни по карточке. Пара осталась подписью и ловушкой для мёртвого и грязного контроля; родство в ней доказано корреляцией остатков, а не карточкой.</p>`
  + cards + boostCard() + mblock
  + `<h2 class="sec">Заметки и предупреждения</h2>${warnBlock}<div class="notes"><ul>${notes}</ul></div></div>`
  + `<script>${JS}</script></body></html>`;

writeFileSync(op("katya-tests.html"), html);
console.log(`katya-tests.html: ${Math.round(html.length / 1024)} KB, тестов ${T.тесты.length}, измеренных ${measured.length}, данные по ${LAST}`);
