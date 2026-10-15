// Блок «План с 15.10: как идём к цели» - первый на странице «Тесты» (Иван 15.10, прототип одобрен).
//
// ЧТО ЭТО. План «10 карточек + цена» (Excel 15.10): главному товару карточки клик 20 000 ₽/нед,
// остальным товарам минимальный клик 8 ₽, 11 дорогих кампаний на минимум, у 25 артикулов (v2, Иван 15.10) цена вниз.
// 29.10 по каждой карточке: заказов за 15-28.10 не меньше порога - оставляем, меньше - откат.
// Блок каждый день показывает, как идём: спидометры к плану, заказы карточек и магазина к порогу
// и цели, воронку «как на тестах», рекламу по неделям чт-ср и цену артикулов плана.
//
// ОТКУДА ПЛАН. data/plan_2026-10-15_v3.json: заморозка Excel (ozon-testy-scripts/v7/freeze_plan.py),
// корректировка Ивана 15.10 (v8/correct_plan_1510.py) и V3 (v8/withdraw_base_1510.py: 27 выводимых артикулов
// вне счёта карточки, пороги пересчитаны правилом 15%). Прибыли по артикулам в нём нет (репозиторий публичный).
// Пороги и цели в коде не пересчитываются: план зафиксирован 15.10.
//
// ОПРЕДЕЛЕНИЯ (Иван 15.10, ответы «да» на 6 вопросов + «меньше - зеленее» везде у рекламы):
//  - Заказы: orders_daily, шт без отмен, все товары объединённой карточки (card_groups.json), кроме выводимых
//    (plan.withdrawn, Иван 15.10 «б»): их нет ни в базе порога, ни в окне, ни в воронке и рекламе карточки; в магазине есть.
//    День - по Москве: t (полное время) + 3 ч, без t - UTC-дата d. Выгрузка идёт до 23:59 UTC последнего дня d,
//    поэтому полный последний день по Москве = последний d; заказы позже него ждут следующего сбора. Последние 3 дня бледные.
//  - Магазин: цель октября «средне» 355 заказов / 24,2 млн; путь цели - база ровно по дням
//    («плохо» = без прироста), прирост равномерно с 17.10 по 31.10. Коридор - «плохо»...«хорошо».
//  - Воронка: sku_views (ночной синк, день OZON). Магазин - сумма всех товаров того же синка:
//    daily_totals не берём, у него «карточка» другого определения (14.09: 2 940 против 5 959).
//  - Реклама: ads_sku_daily без «Оплаты за заказ», неделя чт-ср. Это расход: меньше плана - зелёный,
//    до 120% - жёлтый, больше - красный (Иван 15.10 «везде меньше-зеленее»). Неделя до плана серая.
//  - Цена: prices_daily.price (наша цена) против целевой; скидка OZON - gap_daily.gap_pct, ниже 10% -
//    товар, похоже, выпал из Эластичного бустинга.
// Пропуск - не ноль: дня нет в источнике - null, график рвётся, а не падает в ноль.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dp as dpDefault } from "../paths.js";

export const PLAN_FILE = "plan_2026-10-15_v3.json";   // v3: v2 (27 арт. из минимального клика, TRUBIS 160 вместо GGT-12-2) + выводимые вне карточек, пороги 5 карточек (Иван 15.10 «б»), v8/withdraw_base_1510.py
export const CAB_FILE = "cabinet_orders_check.ndjson";   // сверка «Заказано, шт» с кабинетом, съём чата (Иван 15.10)
const CPO_ID = "28753239";                                     // «Оплата за заказ - все товары»: не клик
const BASE: [string, string] = ["2026-09-14", "2026-10-11"];   // база порогов и плана (4 недели)
const HERE = dirname(fileURLToPath(import.meta.url));

export type Tri = { mid: number; lo: number; hi: number };
export interface PlanCard { main_art: string; short: string; name: string; u_wk_base: number; click_new: number; n_min: number;
  threshold: number; threshold_price: number | null; min_arts: string[] }
export interface Plan { start: string; check: string; window: [string, string]; min_budget_sku: number; min_campaign_budget: number;
  cards: PlanCard[]; withdrawn?: string[]; to_min: Array<{ cid: string; art: string }>;
  price: Array<{ art: string; name: string; when: string; price_new: number; step: string }>;
  goal: { units: { oct: Tri; nov: Tri }; turn_mln: { oct: Tri; nov: Tri }; pay_mln: { oct: Tri; nov: Tri }; nov_rollback: { units: number; pay_mln: number } } }

// ---------- чистые функции (тесты в plan-tab.test.ts)
const D0 = (s: string): number => Date.parse(s + "T00:00:00Z");
export const iso = (t: number): string => new Date(t).toISOString().slice(0, 10);
export const addDays = (s: string, k: number): string => iso(D0(s) + k * 864e5);
export function drange(a: string, b: string): string[] { const out: string[] = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; }
export const DM = (s: string): string => `${s.slice(8, 10)}.${s.slice(5, 7)}`;

/** Цель накопительно на день месяца d (1..31): база («плохо») ровно по дням, прирост к сценарию равномерно с 17.10 (15 дней). */
export function goalPath(g: Tri, d: number, sc: keyof Tri): number {
  return g.lo / 31 * d + (g[sc] - g.lo) * Math.max(0, Math.min(15, d - 16)) / 15;
}
/** День решения без последнего дня окна (ФЕНИКС N8, Codex P1): сегодня не раньше проверки, а заказы в данных
 *  ещё не дошли до конца окна. Решать по 13 дням нельзя - текст заметного предупреждения, иначе пусто. */
export function decisionWarn(today: string, check: string, odLast: string, w1: string): string {
  if (today < check || (odLast && odLast >= w1)) return "";
  return `Заказы по ${odLast ? DM(odLast) : "-"}: за ${DM(w1)} данных ещё нет. Решение по карточкам - только по полным 14 дням, после прихода заказов за ${DM(w1)}.`;
}

/** Определение эталонов спеки (golden_rows): шт без отмен по дню d (UTC) в [from, to], по товарам skus или всему магазину. */
export function netUnits(rows: Array<{ d: string; status: string; sku: string | number; units: number }>, from: string, to: string, skus?: Set<string>): number {
  return rows.filter((r) => r.d >= from && r.d <= to && r.status !== "cancelled" && (!skus || skus.has(String(r.sku))))
    .reduce((a, r) => a + (Number(r.units) || 0), 0);
}

/** Сверка «Заказано, шт» (с отменами) с кабинетом ПО КАЖДОЙ карточке (решение 29.10 - по карточке, ФЕНИКС S1).
 *  ours: sku|день -> шт по отправлениям; cardSkus[i] - товары карточки i. Допуск на карточку - 2% и не меньше 1 шт.
 *  Охват: все пары «товар карточки + день» за КАЖДЫЙ день from..конец выгрузки (ФЕНИКС B1c), а не только за дни,
 *  которые в выгрузке есть: пропущенный день - не «в допуске». Конец выгрузки - вчера от времени съёма ts по МСК
 *  (инструкция чату: «дни с 15.10 по вчера»), без ts - последний день строк; не позже to (последний день заказов). */
export interface CabCard { cab: number; ours: number; ok: boolean; have: number; need: number }
export function cabinetCheck(cab: Array<{ date: string; sku: string; units: number; ts?: string }>, ours: Map<string, number>, from: string, to: string,
  cardSkus: string[][]): { days: string[]; cards: CabCard[]; ok: boolean; full: boolean } | null {
  // повтор «дата + товар» в выгрузке чата заменяет прежнюю строку (правило файлов чата), иначе двойной счёт (К4)
  const last = new Map<string, { date: string; sku: string; units: number }>();
  let end = "";
  for (const r of cab) {
    if (r.date < from || r.date > to) continue;
    const k = `${r.sku}|${r.date}`; last.delete(k); last.set(k, r);
    const t = r.ts ? Date.parse(r.ts) : NaN;
    const e = Number.isFinite(t) ? addDays(iso(t + 3 * 3600e3), -1) : r.date;
    if (e > end) end = e;
  }
  if (!last.size) return null;
  const days = drange(from, end < to ? end : to);
  if (!days.length) return null;   // в окне только незакрытый день съёма - сверять нечего
  const cards = cardSkus.map((skus): CabCard => {
    let c = 0, o = 0, have = 0;
    for (const d of days) for (const s of skus) {
      const r = last.get(`${s}|${d}`); if (!r) continue;
      have++; c += r.units; o += ours.get(`${s}|${d}`) ?? 0;
    }
    return { cab: c, ours: o, ok: Math.abs(c - o) <= Math.max(1, 0.02 * c), have, need: skus.length * days.length };
  });
  const full = cards.every((x) => x.have === x.need);
  return { days, cards, ok: full && cards.every((x) => x.ok), full };
}

/** Цена на день: последняя известная не позже дня. */
export function priceAt(h: Map<string, number> | undefined, d: string): number | null {
  if (!h) return null; let best = "", v: number | null = null;
  for (const [k, x] of h) if (k <= d && k > best) { best = k; v = x; }
  return v;
}
/** Колонки цены: база (14.10) и каждый день после неё, когда цена хоть одного артикула сменилась к прошлому наблюдению. */
export function priceColumns(hist: Map<string, Map<string, number>>, base: string): string[] {
  const out = new Set<string>([base]);
  for (const h of hist.values()) {
    let prev: number | null = priceAt(h, base);
    for (const d of [...h.keys()].filter((k) => k > base).sort()) { const v = h.get(d)!; if (prev != null && v !== prev) out.add(d); prev = v; }
  }
  return [...out].sort();
}
export const PRICE_BASE = "2026-10-14";

/** Статус карточки к порогу: нет данных / рано (меньше 3 дней) / идём / отстаём. Путь - порог × дни / 14. */
export function cardStatus(got: number | null, need: number, nIn: number): "нет данных" | "рано" | "идём" | "отстаём" {
  if (got == null) return "нет данных";
  if (nIn < 3) return "рано";
  return got >= need * nIn / 14 ? "идём" : "отстаём";
}
/** Статус расхода к плану: меньше - лучше (Иван 15.10). */
export function spendStatus(pct: number | null): "нет данных" | "в плане" | "выше плана" | "перерасход" {
  if (pct == null) return "нет данных";
  return pct > 120 ? "перерасход" : pct > 100 ? "выше плана" : "в плане";
}
/** Сумма за неделю по дням, обрезанная последним днём источника; null - неделя ещё не началась в данных. */
export function weekSum(byDay: Map<string, number>, a: string, b: string, last: string): [number, number] | null {
  if (!last || a > last) return null;
  const end = b < last ? b : last; const days = drange(a, end);
  return [Math.round(days.reduce((s, d) => s + (byDay.get(d) ?? 0), 0)), days.length];
}
/** Последний день, за который отчёт по товарам собран у ВСЕХ кампаний с расходом в этот день (ФЕНИКС G1).
 *  ads_sku_daily доливается по кампаниям несколько ночей: state[cid] - дата сбора, данные по вчера от неё.
 *  День, где у части кампаний строк ещё нет, - не «расход упал», а «досчитывается». */
export function adsFullDay(adsDaily: Array<{ d: string; id: string; sp: number }>, state: Record<string, string>, skip: string, from = "",
  skuSp?: Map<string, number>): string {
  // проверяем только окно блока (с первой недели сравнения): старые дни давно не собираемых кампаний не в счёт
  const days = [...new Set(adsDaily.map((a) => a.d))].filter((d) => d >= from).sort();
  let full = "";
  for (const d of days) {
    const ok = adsDaily.filter((a) => a.d === d && a.sp > 0 && String(a.id) !== skip)
      .every((a) => state[String(a.id)] && addDays(state[String(a.id)]!, -1) >= d
        // сбой отчёта ставит дату сбора, но строк нет: день полный, только если по товарам собрано от 95% расхода кампании (ФЕНИКС N2)
        && (!skuSp || (skuSp.get(`${a.id}|${d}`) ?? 0) >= 0.95 * a.sp));
    if (!ok) break;
    full = d;
  }
  return full;
}
/** Окно спидометра «Реклама» - месяц, а не неделя (Иван 15.10): с 1-го числа месяца последнего полного дня рекламы,
 *  но не раньше старта плана. До первого дня плана в данных - тот же месяц до плана, серым, для сравнения. */
export function adsMonthWindow(adLast: string, start: string): { from: string; to: string; pre: boolean } | null {
  if (!adLast) return null;
  const m1 = adLast.slice(0, 8) + "01";
  if (adLast < start) return { from: m1, to: adLast, pre: true };
  return { from: m1 > start ? m1 : start, to: adLast, pre: false };
}
/** Сколько заказов магазину нужно к дню n плана (1..14): отрезок пути цели октября «средне», а не прямая (ФЕНИКС G3). */
export function storeNeed(g: Tri, n: number): number {
  return goalPath(g, 14 + n, "mid") - goalPath(g, 14, "mid");
}
/** Цель магазина на последний день заказов: октябрь - путь цели октября, с ноября - цель ноября ровно по дням (ФЕНИКС G2). */
export function monthGoal(goal: Plan["goal"], last: string): { month: "oct" | "nov"; from: string; units: number; turn: number; unitsMonth: number; turnMonth: number } | null {
  if (!last || last < "2026-10-01" || last > "2026-11-30") return null;
  const d = Number(last.slice(8, 10));
  if (last < "2026-11-01") return { month: "oct", from: "2026-10-01", units: goalPath(goal.units.oct, d, "mid"), turn: goalPath(goal.turn_mln.oct, d, "mid"),
    unitsMonth: goal.units.oct.mid, turnMonth: goal.turn_mln.oct.mid };
  return { month: "nov", from: "2026-11-01", units: goal.units.nov.mid / 30 * d, turn: goal.turn_mln.nov.mid / 30 * d,
    unitsMonth: goal.units.nov.mid, turnMonth: goal.turn_mln.nov.mid };
}
/** День заказа по Москве из полного времени UTC (Иван 15.10: «по Москве»). Нет времени - UTC-дата d как была. */
export function orderDay(o: { d: string; t?: string | null }): string {
  const t = o.t ? Date.parse(o.t) : NaN;
  return Number.isFinite(t) ? iso(t + 3 * 3600e3) : o.d;
}
/** Дней плана с данными (0..14). */
export function daysIn(start: string, last: string): number {
  if (!last) return 0;
  return Math.max(0, Math.min(Math.round((D0(last) - D0(start)) / 864e5) + 1, 14));
}

// ---------- сборка
const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const F = (x: number | null | undefined, nd = 0): string => x == null || !Number.isFinite(x) ? "-"
  : x.toFixed(nd).replace(/\B(?=(\d{3})+(?!\d))/g, " ").replace(".", ",");
const readNd = (f: string): any[] => existsSync(f)
  ? readFileSync(f, "utf-8").split(/\r?\n/).filter((l) => l.trim()).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } })
  : [];
const add = (m: Map<string, number>, k: string, v: number): void => { m.set(k, (m.get(k) ?? 0) + v); };
const chip = (st: string): string => `<span class="chip ${st === "идём" ? "chip-done" : st === "отстаём" ? "chip-bad" : "chip-off"}">${st}</span>`;

export interface PlanBlock { html: string; css: string; js: string; warnings: string[] }

/** Блок целиком. null - плана нет (файл не положен), страница собирается без блока. */
export function planBlock(today: string, dp: (f: string) => string = dpDefault): PlanBlock | null {
  if (!existsSync(dp(PLAN_FILE))) return null;
  const P = JSON.parse(readFileSync(dp(PLAN_FILE), "utf-8")) as Plan;
  const START = P.start, W1 = P.window[1];
  const END = today > "2026-10-31" ? today : "2026-10-31";
  const DAYS = drange(BASE[0], END);
  const warnings: string[] = [];

  // карточки: все товары объединённой карточки, кроме выводимых (Иван 15.10 «б»: порог посчитан без них)
  const G = (JSON.parse(readFileSync(dp("card_groups.json"), "utf-8")).groups ?? []) as Array<{ skus: Array<{ sku: string; offer: string }> }>;
  const off2sku = new Map<string, string>();
  for (const g of G) for (const s of g.skus) off2sku.set(s.offer, String(s.sku));
  const OUT = new Set((P.withdrawn ?? []).map((a) => off2sku.get(a) ?? ""));
  for (const a of P.withdrawn ?? []) if (!off2sku.has(a)) warnings.push(`выводимого ${a} нет в card_groups.json`);
  const cards = P.cards.map((c) => {
    const ms = off2sku.get(c.main_art);
    const g = G.find((g) => g.skus.some((s) => String(s.sku) === ms));
    if (!ms || !g) warnings.push(`карточка ${c.short}: главного ${c.main_art} нет в card_groups.json`);
    if (ms && OUT.has(ms)) warnings.push(`карточка ${c.short}: главный ${c.main_art} в списке выводимых`);
    return { ...c, main_sku: ms ?? "", skus: g ? g.skus.map((s) => String(s.sku)).filter((s) => !OUT.has(s)) : [], min_skus: c.min_arts.map((a) => off2sku.get(a) ?? "").filter(Boolean) };
  });
  const SKU_CARD = new Map<string, number>();
  cards.forEach((c, i) => c.skus.forEach((s) => {
    if (SKU_CARD.has(s)) warnings.push(`товар ${s} в двух карточках плана`);
    SKU_CARD.set(s, i);
  }));
  const N = cards.length;
  const mk = () => Array.from({ length: N }, () => new Map<string, number>());

  // воронка: sku_views
  const FK = ["views", "vsearch", "pdp", "cart", "units"] as const;
  const fv: Record<string, Map<string, number>[]> = {}; const fst: Record<string, Map<string, number>> = {};
  for (const k of FK) { fv[k] = mk(); fst[k] = new Map(); }
  const svDays = new Set<string>();
  for (const r of readNd(dp("sku_views.ndjson"))) {
    if (r.date < DAYS[0]!) continue;
    svDays.add(r.date); const i = SKU_CARD.get(String(r.sku));
    for (const k of FK) { const v = Number(r[k]) || 0; add(fst[k]!, r.date, v); if (i != null) add(fv[k]![i]!, r.date, v); }
  }
  const SV_LAST = [...svDays].sort().pop() ?? "";
  // позиция главного - съём тестов
  const mainIdx = new Map(cards.map((c, i) => [c.main_art, i]));
  const pos = mk();
  for (const r of readNd(dp("funnel_tests.ndjson"))) {
    const i = mainIdx.get(r.art); if (i != null && Number(r.search_position) > 0) pos[i]!.set(r.date, Number(r.search_position));
  }
  // заказы
  const skuDayAll = new Map<string, number>();   // с отменами, для сверки с кабинетом
  const od = mk(); const stU = new Map<string, number>(), stRev = new Map<string, number>(); let OD_LAST = "", nMsk = 0, nAll = 0;
  const ordRows = readNd(dp("orders_daily.ndjson"));
  const OD_RAW_LAST = ordRows.reduce((m, o) => o.d > m ? o.d : m, "");
  const canc = new Map<string, [number, number]>();
  for (const o of ordRows) {
    o.d = orderDay(o); nAll++; if (o.t) nMsk++;
    // выгрузка кончается в 23:59 UTC последнего дня = 02:59 МСК следующего: тот день по Москве - обрывок, ждёт сбора (ФЕНИКС N1)
    if (o.d > OD_RAW_LAST) continue;
    if (o.d > OD_LAST) OD_LAST = o.d;
    const cc = canc.get(o.d) ?? [0, 0]; cc[0] += Number(o.units) || 0; if (o.status === "cancelled") cc[1] += Number(o.units) || 0; canc.set(o.d, cc);
    add(skuDayAll, `${o.sku}|${o.d}`, Number(o.units) || 0);
    if (o.status === "cancelled") continue;
    const u = Number(o.units) || 0, i = SKU_CARD.get(String(o.sku));
    if (i != null) add(od[i]!, o.d, u);
    add(stU, o.d, u); add(stRev, o.d, Number(o.revenue) || 0);
  }
  // реклама
  const asd = readNd(dp("ads_sku_daily.ndjson"));
  const campDay = new Map<string, number>();
  for (const a of asd) { add(campDay, `${a.cid}|${a.d}`, Number(a.sp) || 0); }
  const cl = new Map<string, number>(); const adsDaily = readNd(dp("ads_daily.ndjson"));
  const campDaily = new Map<string, Map<string, number>>(), stSp = new Map<string, number>(), stClk = new Map<string, number>(); let AD_CAMP_LAST = "";
  for (const a of adsDaily) {
    cl.set(`${a.id}|${a.d}`, Number(a.cl) || 0); if (a.d > AD_CAMP_LAST) AD_CAMP_LAST = a.d;
    if (String(a.id) === CPO_ID) continue;
    const m = campDaily.get(String(a.id)) ?? new Map<string, number>(); add(m, a.d, Number(a.sp) || 0); campDaily.set(String(a.id), m);
    add(stSp, a.d, Number(a.sp) || 0); add(stClk, a.d, Number(a.cl) || 0);   // магазин: расход и клики из одного источника (ФЕНИКС G5)
  }
  const adsState = existsSync(dp("ads_sku_state.json")) ? JSON.parse(readFileSync(dp("ads_sku_state.json"), "utf-8")) as Record<string, string> : {};
  const ADS_FULL = adsFullDay(adsDaily.map((a) => ({ d: a.d, id: String(a.id), sp: Number(a.sp) || 0 })), adsState, CPO_ID, "2026-10-08", campDay);
  const TO_MIN = new Set(P.to_min.map((k) => String(k.cid)));
  const sp = mk(), spm = mk(), spmin = mk(), clk = mk(), acart = mk();
  for (const a of asd) {
    if (String(a.cid) === CPO_ID) continue;
    const v = Number(a.sp) || 0;
    const i = SKU_CARD.get(String(a.sku)); if (i == null) continue;
    const c = cards[i]!; add(sp[i]!, a.d, v); add(acart[i]!, a.d, Number(a.ca) || 0);
    // клик главного - без кампаний, которые 15.10 ушли на минимум: их рубли уже в своей строке (ФЕНИКС G6)
    if (String(a.sku) === c.main_sku && !TO_MIN.has(String(a.cid))) add(spm[i]!, a.d, v);
    if (c.min_skus.includes(String(a.sku))) add(spmin[i]!, a.d, v);
    const tot = campDay.get(`${a.cid}|${a.d}`) ?? 0;
    if (tot) add(clk[i]!, a.d, (cl.get(`${a.cid}|${a.d}`) ?? 0) * v / tot);
  }

  const ser = (m: Map<string, number>, last: string, has?: Set<string>) =>
    DAYS.map((d) => d > last || !last || (has && !has.has(d)) ? null : Math.round((m.get(d) ?? 0) * 100) / 100);
  const SER = cards.map((_, i) => ({
    views: ser(fv.views![i]!, SV_LAST, svDays), vsearch: ser(fv.vsearch![i]!, SV_LAST, svDays), pdp: ser(fv.pdp![i]!, SV_LAST, svDays),
    cart: ser(fv.cart![i]!, SV_LAST, svDays), units: ser(fv.units![i]!, SV_LAST, svDays),
    pos: DAYS.map((d) => pos[i]!.get(d) ?? null), orders: ser(od[i]!, OD_LAST),
    sp: ser(sp[i]!, ADS_FULL).map((x) => x == null ? x : Math.round(x)), clk: ser(clk[i]!, ADS_FULL).map((x) => x == null ? x : Math.round(x)),
    acart: ser(acart[i]!, ADS_FULL),
  }));
  const STORE = {
    views: ser(fst.views!, SV_LAST, svDays), vsearch: ser(fst.vsearch!, SV_LAST, svDays), pdp: ser(fst.pdp!, SV_LAST, svDays),
    cart: ser(fst.cart!, SV_LAST, svDays), units: ser(fst.units!, SV_LAST, svDays), pos: DAYS.map(() => null),
    orders: ser(stU, OD_LAST), sp: ser(stSp, AD_CAMP_LAST).map((x) => x == null ? x : Math.round(x)), clk: ser(stClk, AD_CAMP_LAST), acart: DAYS.map(() => null),
  };
  // инвариант: сумма карточек не больше магазина (одно семейство источника)
  for (const k of ["views", "pdp", "orders"] as const) DAYS.forEach((d, j) => {
    const s = SER.reduce((a, x) => a + (x[k][j] ?? 0), 0), m = STORE[k][j];
    if (m != null && s > m * 1.001 + 1) warnings.push(`${k} ${d}: сумма 10 карточек ${s} больше магазина ${m}`);
  });

  const wsum = (s: Array<number | null>, a: string, b: string): number | null => {
    let t = 0, n = 0; DAYS.forEach((d, j) => { if (d >= a && d <= b && s[j] != null) { t += s[j]!; n++; } }); return n ? t : null;
  };
  const perWk = (s: Array<number | null>, a: string, b: string): number | null => {
    let t = 0, n = 0; DAYS.forEach((d, j) => { if (d >= a && d <= b && s[j] != null) { t += s[j]!; n++; } }); return n ? t / n * 7 : null;
  };
  const nIn = daysIn(START, OD_LAST >= START ? OD_LAST : "");
  const gU = P.goal.units.oct;

  // ---------- 1. заказы: 10 карточек и весь магазин
  const rows2: string[] = [];
  cards.forEach((c, i) => {
    const got = wsum(SER[i]!.orders, START, W1), pre = wsum(SER[i]!.orders, "2026-10-01", "2026-10-14");
    const thrP = c.threshold_price ? ` <span class="muted" title="Порог с поправкой на снижение цены">/ ${c.threshold_price}</span>` : "";
    rows2.push(`<tr class="crow" data-i="${i}"><td><b><span class="tw">▸</span> ${esc(c.short)}</b><div class="muted s">${esc(c.main_art)}</div></td>`
      + `<td class="r">${c.threshold}${thrP}</td><td class="r">${F(got)}</td><td class="r">${F(Math.max(0, c.threshold - (got ?? 0)))}</td>`
      + `<td class="r">${F(2 * c.u_wk_base, 1)}</td><td class="r">${F(pre)}</td><td>${chip(cardStatus(got, c.threshold, nIn))}</td></tr>`
      + `<tr class="cdet" id="pt-cdet${i}" hidden><td colspan="7"><div id="pt-mc${i}"></div></td></tr>`);
  });
  const sNeed = Math.round(goalPath(gU, 28, "mid") - goalPath(gU, 14, "mid")), sBase = goalPath(gU, 28, "lo") - goalPath(gU, 14, "lo");
  const sGot = wsum(STORE.orders, START, W1), sPre = wsum(STORE.orders, "2026-10-01", "2026-10-14");
  rows2.push(`<tr class="crow total" data-i="S"><td><b><span class="tw">▸</span> Весь магазин</b><div class="muted s">цель октября, 15-28.10</div></td>`
    + `<td class="r">${sNeed}</td><td class="r">${F(sGot)}</td><td class="r">${F(Math.max(0, sNeed - (sGot ?? 0)))}</td>`
    + `<td class="r">${F(sBase, 1)}</td><td class="r">${F(sPre)}</td><td>${chip(sGot == null ? "нет данных" : nIn < 3 ? "рано" : sGot >= storeNeed(gU, nIn) ? "идём" : "отстаём")}</td></tr>`
    + `<tr class="cdet" id="pt-cdetS" hidden><td colspan="7"><div id="pt-mcS"></div></td></tr>`);
  const tbl2 = `<div class="tbl-wrap full"><table class="gtbl single"><thead><tr><th>Карточка</th><th class="r">Порог</th><th class="r">С 15.10</th>`
    + `<th class="r">Осталось</th><th class="r" title="2 недели × заказов в неделю за 14.09-11.10">Без эффекта</th>`
    + `<th class="r" title="Те же 14 дней до старта">01-14.10</th><th>Статус</th></tr></thead><tbody>${rows2.join("")}</tbody></table></div>`;

  // ---------- 2. воронка: обзор
  const dchip = (b: number | null, a: number | null): string => {
    if (!b || a == null) return `<span class="muted">-</span>`;
    const x = (a / b - 1) * 100; return `<span class="${x >= 0 ? "up" : "dn"}">${x >= 0 ? "+" : ""}${x.toFixed(0)}%</span>`;
  };
  const funRow = (name: string, s: Record<string, Array<number | null>>): string => {
    let h = `<tr><td>${name}</td>`;
    for (const k of ["vsearch", "pdp", "cart", "units"]) {
      const b = perWk(s[k]!, BASE[0], BASE[1]), a = perWk(s[k]!, START, W1);
      h += `<td class="r sep">${F(b)}</td><td class="r">${F(a)}</td><td class="r">${dchip(b, a)}</td>`;
    }
    const vb = wsum(s.views!, BASE[0], BASE[1]), ub = wsum(s.units!, BASE[0], BASE[1]), va = wsum(s.views!, START, W1), ua = wsum(s.units!, START, W1);
    return h + `<td class="r sep">${F(vb && ub != null ? ub / vb * 1000 : null, 2)}</td><td class="r">${F(va && ua != null ? ua / va * 1000 : null, 2)}</td></tr>`;
  };
  const tot: Record<string, Array<number | null>> = {};
  for (const k of FK) tot[k] = DAYS.map((_, j) => SER.every((x) => x[k][j] == null) ? null : SER.reduce((a, x) => a + (x[k][j] ?? 0), 0));
  const tbl3 = `<div class="tbl-wrap"><table class="gtbl"><thead><tr class="grp"><th></th><th colspan="3" class="sep">Показы в поиске</th><th colspan="3" class="sep">Карточка</th>`
    + `<th colspan="3" class="sep">Корзина</th><th colspan="3" class="sep">Заказано (OZON, с отменами)</th><th colspan="2" class="sep">На 1 000 показов</th></tr>`
    + `<tr><th>Карточка</th>${`<th class="r sep">база</th><th class="r">с 15.10</th><th class="r">Δ</th>`.repeat(4)}<th class="r sep">база</th><th class="r">с 15.10</th></tr></thead><tbody>`
    + cards.map((c, i) => funRow(`<b>${esc(c.short)}</b>`, SER[i] as any)).join("") + funRow("<b>Все 10</b>", tot)
    + funRow(`<span class="muted">Весь магазин</span>`, STORE as any) + `</tbody></table></div>`;

  // ---------- 4. реклама по неделям чт-ср
  const WEEKS: Array<[string, string, string]> = [["08-14.10 (до плана)", "2026-10-08", "2026-10-14"], ["15-21.10", "2026-10-15", "2026-10-21"], ["22-28.10", "2026-10-22", "2026-10-28"]];
  const SPEND = [
    { g: "Клик главного товара", note: "Расход на главный товар без 11 кампаний ниже - их рубли считаются там.",
      rows: cards.map((c, i) => ({ n: c.short, sub: c.main_art, plan: c.click_new, w: WEEKS.map(([, a, b]) => weekSum(spm[i]!, a, b, ADS_FULL)) })) },
    { g: "Минимальный клик 8 ₽ (≈1 500 на товар)", rows: cards.flatMap((c, i) => c.n_min ? [{ n: c.short, sub: `${c.n_min} тов.`, plan: c.n_min * P.min_budget_sku, w: WEEKS.map(([, a, b]) => weekSum(spmin[i]!, a, b, ADS_FULL)) }] : []) },
    { g: "11 кампаний переводим на минимум", note: "Реклама на неглавных товарах карточек: тратила больше 2 500 ₽ в неделю, заказов почти не давала. С 15.10 ставим минимум - не больше 2 000 ₽ в неделю на кампанию. Здесь проверяем, что расход упал.",
      rows: P.to_min.map((k) => ({ n: k.cid, sub: String(k.art), plan: P.min_campaign_budget, w: WEEKS.map(([, a, b]) => weekSum(campDaily.get(String(k.cid)) ?? new Map(), a, b, AD_CAMP_LAST)) })) },
  ];
  // спидометр «Реклама»: клик главного + минимальный клик за месяц, план - недельный план × дней / 7
  const AMW = adsMonthWindow(ADS_FULL, START);
  let amF = 0, amP = 0;
  if (AMW) cards.forEach((c, i) => {
    const a = weekSum(spm[i]!, AMW.from, AMW.to, ADS_FULL), b = weekSum(spmin[i]!, AMW.from, AMW.to, ADS_FULL);
    if (a) { amF += a[0]; amP += c.click_new * a[1] / 7; }
    if (b && c.n_min) { amF += b[0]; amP += c.n_min * P.min_budget_sku * b[1] / 7; }
  });
  const r5: string[] = [];
  for (const g of SPEND) {
    r5.push(`<tr class="grp"><td colspan="5">${esc(g.g)}</td></tr>`);
    for (const r of g.rows) r5.push(`<tr><td>${esc(r.n)} <span class="muted s">${esc(r.sub)}</span></td><td class="r">${F(r.plan)}</td>`
      + r.w.map((v) => v ? `<td class="r">${F(v[0])}${v[1] < 7 ? ` <span class="muted">(${v[1]} из 7 дн)</span>` : ""}</td>` : `<td class="r muted">нет данных</td>`).join("") + `</tr>`);
  }
  const tbl5 = `<div class="tbl-wrap tall"><table class="gtbl single"><thead><tr><th>Что</th><th class="r">План, ₽/нед</th>${WEEKS.map(([w]) => `<th class="r">${w}</th>`).join("")}</tr></thead><tbody>${r5.join("")}</tbody></table></div>`;

  // ---------- 5. цена артикулов плана
  const prLast = new Map<string, [string, number]>(), gapLast = new Map<string, [string, number]>();
  const prHist = new Map<string, Map<string, number>>();   // артикул -> день -> цена (Иван 15.10: колонка 14.10 и колонка на каждую смену цены)
  const priceArts = new Set(P.price.map((p) => p.art));
  for (const r of readNd(dp("prices_daily.ndjson"))) {
    if (r.d >= (prLast.get(r.offer)?.[0] ?? "")) prLast.set(r.offer, [r.d, Number(r.price)]);
    if (priceArts.has(r.offer) && Number.isFinite(Number(r.price))) (prHist.get(r.offer) ?? prHist.set(r.offer, new Map()).get(r.offer)!).set(r.d, Number(r.price));
  }
  const PCOLS = priceColumns(prHist, PRICE_BASE);
  for (const r of readNd(dp("gap_daily.ndjson"))) if (r.date >= (gapLast.get(r.art)?.[0] ?? "")) gapLast.set(r.art, [r.date, Number(r.gap_pct)]);
  const pst: Record<string, number> = {}; const r6: string[] = [];
  for (const p of [...P.price].sort((a, b) => (a.when + a.art).localeCompare(b.when + b.art))) {
    const [d0, now] = prLast.get(p.art) ?? ["", null as number | null]; const when = `2026-${p.when.slice(3, 5)}-${p.when.slice(0, 2)}`;
    const [gd, gp] = gapLast.get(p.art) ?? ["", null as number | null];
    const st = now == null ? "нет цены" : d0 < when || (d0 === when && today <= when) ? `ждём ${p.when}` : now <= p.price_new * 1.005 ? "снижена" : "не снижена";
    const key = st.startsWith("ждём") ? "ждём" : st === "снижена" ? "снижена" : "не снижена";
    pst[key] = (pst[key] ?? 0) + 1; if (gp != null && gp < 10) pst.eb = (pst.eb ?? 0) + 1;
    r6.push(`<tr><td>${esc(p.when)}</td><td>${esc(p.art)}<div class="muted s">${esc(String(p.name).slice(0, 46))}</div></td>`
      + PCOLS.map((d) => `<td class="r">${F(priceAt(prHist.get(p.art), d))}</td>`).join("")
      + `<td class="r">${F(now)}<div class="muted s">${d0 ? DM(d0) : ""}</div></td><td class="r">${F(p.price_new)} <span class="muted">${esc(p.step)}</span></td>`
      + `<td><span class="chip ${st === "снижена" ? "chip-done" : st.startsWith("ждём") ? "chip-off" : "chip-bad"}">${esc(st)}</span></td>`
      + `<td class="r">${F(gp)}%<div class="muted s">${gd ? DM(gd) : ""}</div></td><td>${gp != null && gp < 10 ? `<span class="chip chip-bad">выпал из бустинга?</span>` : ""}</td></tr>`);
  }
  const tbl6 = `<div class="tbl-wrap tall"><table class="gtbl single"><thead><tr><th>С</th><th>Артикул</th>${PCOLS.map((d, k) => `<th class="r"${k ? ` title="цена сменилась ${DM(d)}"` : ""}>${DM(d)}</th>`).join("")}<th class="r">Сейчас, ₽</th><th class="r">Целевая, ₽</th><th>Статус</th>`
    + `<th class="r" title="На сколько цена на сайте ниже нашей (gap_daily). Ниже 10% - похоже, выпал из Эластичного бустинга">Скидка OZON</th><th></th></tr></thead><tbody>${r6.join("")}</tbody></table></div>`;

  const DATA = {
    days: DAYS, start: START, w1: W1, sv_last: SV_LAST, od_last: OD_LAST, ad_last: ADS_FULL, ad_camp_last: AD_CAMP_LAST, today, n_in: nIn, mgoal: monthGoal(P.goal, OD_LAST),
    cards: cards.map((c) => ({ short: c.short, art: c.main_art, thr: c.threshold, thrp: c.threshold_price, base2: Math.round(2 * c.u_wk_base * 100) / 100 })),
    ser: SER, store: STORE, store_rev: ser(stRev, OD_LAST), goal: P.goal, base_win: BASE,
    store_card: { short: "Весь магазин", thr: sNeed, thrp: null, base2: Math.round(sBase * 10) / 10,
      path: Array.from({ length: 14 }, (_, k) => Math.round(storeNeed(gU, k + 1) * 10) / 10) },
    ads_month: AMW ? { ...AMW, fact: Math.round(amF), plan: Math.round(amP) } : null,
    spend: SPEND, weeks: WEEKS.map((w) => w[0]), week_start: WEEKS.map((w) => w[1]),
    price_st: pst, price_n: P.price.length, price_first: P.price.filter((p) => p.when === "15.10").length,
  };
  const cancShare = (a: string, b: string): string => {
    let u = 0, c = 0; for (const [d, [uu, cc]] of canc) if (d >= a && d <= b) { u += uu; c += cc; }
    return u ? `${(c / u * 100).toFixed(1).replace(".", ",")}%` : "-";
  };
  const cancTxt = OD_LAST ? `${DM(addDays(OD_LAST, -12))}-${DM(addDays(OD_LAST, -3))} отменено ${cancShare(addDays(OD_LAST, -12), addDays(OD_LAST, -3))}, за последние 3 дня пока ${cancShare(addDays(OD_LAST, -2), OD_LAST)}` : "-";
  const noPos = cards.filter((_, i) => !pos[i]!.size).map((c) => c.short);
  // сверка с кабинетом: съём чата по четвергам и 29.10 (Иван 15.10), другое семейство, чем отправления
  const cabRows = existsSync(dp(CAB_FILE)) ? readNd(dp(CAB_FILE)).map((r) => ({ date: String(r.date).slice(0, 10), sku: String(r.sku), units: Number(r.ordered_units), ts: r.ts ? String(r.ts) : undefined }))
    .filter((r) => r.date && r.sku && Number.isFinite(r.units)) : [];
  const cardSkus = cards.map((_, i) => [...SKU_CARD].filter(([, j]) => j === i).map(([sku]) => sku));
  const cab = cabinetCheck(cabRows, skuDayAll, START, OD_LAST || START, cardSkus);
  let cabTxt = "";
  if (cab) {
    const span = `${DM(cab.days[0]!)}-${DM(cab.days[cab.days.length - 1]!)}`;
    const off = cab.cards.map((x, i) => x.ok ? "" : `${cards[i]!.short} кабинет ${x.cab} / отправления ${x.ours}`).filter(Boolean);
    const have = cab.cards.reduce((a, x) => a + x.have, 0), need = cab.cards.reduce((a, x) => a + x.need, 0);
    if (!cab.full) warnings.push(`сверка с кабинетом ${span}: выгрузка неполная, ${have} из ${need} пар «товар + день»`);
    if (off.length) warnings.push(`сверка с кабинетом ${span} не в допуске: ${off.join("; ")}`);
    cabTxt = `<li>Сверка с кабинетом («Заказано, шт» с отменами, ${span}, охват ${F(have)} из ${F(need)} пар «товар + день»): `
      + (!cab.full ? `<b>выгрузка неполная - сверка не пройдена</b>${off.length ? `; расхождения: ${esc(off.join("; "))}` : ""}`
        : off.length ? `<b>расхождение по ${off.length} из ${cards.length} карточек</b> - ${esc(off.join("; "))}` : `все ${cards.length} карточек в допуске (2%, не меньше 1 шт)`)
      + `.</li>`;
  }
  const dWarn = decisionWarn(today, P.check, OD_LAST, W1);
  const day = Math.max(0, Math.min(14, Math.round((D0(today) - D0(START)) / 864e5) + 1));
  const warn = warnings.length ? `<div class="pt-warn">Проверка данных: ${warnings.slice(0, 5).map(esc).join("; ")}${warnings.length > 5 ? ` и ещё ${warnings.length - 5}` : ""}</div>` : "";
  const html = `<details class="card tcard" open id="pt-plan"><summary><div class="chead"><span class="ctitle">План с 15.10: как идём к цели</span>`
    + `<span class="chip chip-run">день ${day} из 14 · заказы по ${OD_LAST ? DM(OD_LAST) : "-"} · проверка ${DM(P.check)}</span></div></summary>${dWarn ? `<div class="pt-warn pt-decide">${esc(dWarn)}</div>` : ""}${warn}
<div class="pt-gauges" id="pt-gauges"></div>
<div class="pt-plaque"><span class="pt-pl-l">Цель К выплате</span> октябрь ${F(P.goal.pay_mln.oct.mid, 1)} млн · ноябрь ${F(P.goal.pay_mln.nov.mid, 1)} млн, с откатами 29.10 ${F(P.goal.nov_rollback.pay_mln, 1)} · факт по «Отчету» раз в месяц</div>
<details class="pt-sec"><summary class="sec">1. Заказы: 10 карточек и весь магазин</summary>
${tbl2}
<p class="legend">Нажми на строку - откроется график. <span class="lg c1"></span>с 15.10 <span class="lg c3"></span>порог <span class="lg c3p"></span>порог с ценой <span class="lg cpath"></span>нужный темп <span class="lg cprev"></span>01-14.10</p>
</details>
<details class="pt-sec"><summary class="sec">2. Воронка</summary>
${tbl3}
<div class="pt-dyn"><div class="mrow-b" id="pt-cardsel"></div><div class="mrow-b" id="pt-metsel"></div><div id="pt-dynchart"></div><div id="pt-dyntbl"></div></div>
</details>
<details class="pt-sec"><summary class="sec">3. Магазин к цели октября</summary>
<div class="pt-two"><div id="pt-stU"></div><div id="pt-stT"></div></div>
</details>
<details class="pt-sec"><summary class="sec">4. Реклама по неделям</summary>
<div id="pt-pills"></div>
<details class="fold"><summary>Таблица</summary>${tbl5}</details>
</details>
<details class="pt-sec"><summary class="sec">5. Цена ${P.price.length} артикулов</summary>
<div id="pt-pricepills"></div>
<details class="fold"><summary>Все ${P.price.length} артикулов</summary>${tbl6}</details>
</details>
<details class="fold"><summary>Как считаем</summary><div class="fold-b"><ul class="pt-notes">
<li>Заказы - шт без отмен, все товары карточки. Последние 3 дня бледные - досчитываются. ${nMsk === nAll && nAll ? "День заказа - по Москве." : nMsk === 0 ? "День заказа пока по UTC: время заказа появится после ночного сбора, дальше - по Москве." : `День заказа по Москве у ${nMsk} из ${nAll} заказов, у остальных пока UTC (до ночного сбора).`}</li>
<li>Порог - заказов за 15-28.10; ниже - откат карточки. Магазин - цель октября «средне» на 15-28.10.</li>
<li>Воронка - ночной синк OZON. База 14.09-11.10.</li>
<li>Реклама - неделя чт-ср. Меньше плана - зелёный, до 120% - жёлтый, больше - красный. По товарам - отчёт кабинета, он доливается несколько ночей: считаем по последний полный день (${ADS_FULL ? DM(ADS_FULL) : "-"}). 11 кампаний - по дням кампаний (${AD_CAMP_LAST ? DM(AD_CAMP_LAST) : "-"}).</li>
<li>Оборот к цели: цель посчитана от базы 20,4 млн (модель 13.10), а заказы за ту же базу дают больше - факт выглядит примерно на 3,5% лучше цели.</li>
<li>Отмены приходят с опозданием (за ${cancTxt}): заказы за свежие дни потом немного уменьшатся.</li>
${noPos.length ? `<li>Позиции в поиске нет у ${noPos.map(esc).join(", ")}: их нет в съёме тестов.</li>` : ""}
${cabTxt}
<li>Данные: воронка по ${SV_LAST ? DM(SV_LAST) : "-"}, заказы по ${OD_LAST ? DM(OD_LAST) : "-"}, реклама по товарам по ${ADS_FULL ? DM(ADS_FULL) : "-"}. План - Excel 15.10 с корректировкой Ивана 15.10: ${(P.withdrawn ?? []).length} выводимых артикулов не входят в карточки ни в базе порога, ни в факте (в магазине входят), TRUBIS 160 в снижении цены с 15.10 вместо GGT-12-2.</li>
</ul></div></details>
</details>`;
  const css = readFileSync(join(HERE, "plan-tab", "plan-tab.css"), "utf-8");
  const js = `window.PD=${JSON.stringify(DATA).replace(/</g, "\\u003c")};\n` + readFileSync(join(HERE, "plan-tab", "plan-tab.client.js"), "utf-8");
  return { html, css, js, warnings };
}
