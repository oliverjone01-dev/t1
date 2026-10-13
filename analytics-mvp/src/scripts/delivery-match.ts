// Сопоставление строк ведомости доставки с отправлениями OZON ПО НОМЕРУ ЗАКАЗА.
//
// ПРАВИЛО (Иван 28.09.2026, knowledge/semantic/rule-find-order-no-spread.md): расход по заказу
// ищется по номеру этого заказа и встаёт на его дату заказа. Не нашёлся - НЕ раскладывается по
// другим заказам, артикулу или месяцу, а выводится списком над таблицей, как нехватка СС.
//
// Раньше (22.09-28.09) несошедшийся остаток ведомости раскладывался по заказам артикула, и доставка
// одного заказа попадала в чужой месяц второй раз (46952822-0108-1: 3 559 ₽ при 2 948 ₽ в ведомости).
//
// Как номер записан в ведомости руками и как он читается:
//   «46952822-0108-1»                              - номер отправления, точное совпадение;
//   «0198044483-0090»                              - номер заказа без хвоста отправления: все
//                                                   отправления этого заказа;
//   «46027676-0255-1 46027676-0255-3»              - два отправления в одной строке;
//   «39351709-0446-1 бывш. 39351709-0445-1»       - заказ переоформлен: действует номер ДО «бывш.»,
//                                                   старый (отменённый) берём, только если нового нет.
// Если номер указал несколько отправлений, сумма делится по штукам (остаток - на последнее), а
// отменённые отбрасываются, когда есть неотменённые. Числа не придумываются: делится только сумма
// одной строки ведомости между отправлениями, которые эта строка сама назвала.

export interface LedgerRow { order: string; ship: number; deliv: number; d_ship?: string; d_fact?: string; city?: string }
export interface Posting { order: string; d: string; status?: string; units?: number; sd?: string | null; sku?: string }
export interface PostingShip { ship: number; deliv: number; dShip?: string; dFact?: string; cities?: string[] }
export interface Unmatched { raw: string; ship: number; deliv: number; why: string }
export interface MatchResult {
  byPosting: Map<string, PostingShip>;
  unmatched: Unmatched[];
  /** Как нашлась каждая строка: exact / base / multi / renamed. Для сверки и тестов. */
  how: Map<string, string>;
}

const TOKEN = /\d{6,10}-\d{3,4}(?:-\d{1,2})?/g;
const base = (o: string) => o.split("-").slice(0, 2).join("-");

export function matchLedger(rows: LedgerRow[], postings: Posting[]): MatchResult {
  const byOrder = new Map<string, Posting>();
  const byBase = new Map<string, Posting[]>();
  for (const p of postings) {
    byOrder.set(p.order, p);
    const b = base(p.order);
    (byBase.get(b) ?? byBase.set(b, []).get(b)!).push(p);
  }
  const resolve = (tok: string): Posting[] => {
    const p = byOrder.get(tok);
    if (p) return [p];
    if (tok.split("-").length === 2) return byBase.get(tok) ?? [];
    return [];
  };
  const byPosting = new Map<string, PostingShip>();
  const unmatched: Unmatched[] = [];
  const how = new Map<string, string>();
  for (const r of rows) {
    const raw = String(r.order || "").trim();
    const ship = Number(r.ship) || 0, deliv = Number(r.deliv) || 0;
    const exact = byOrder.get(raw);
    let found: Posting[] = [];
    let kind = "";
    if (exact) { found = [exact]; kind = "exact"; }
    else {
      const renamed = /бывш/i.test(raw);
      const [cur, old] = renamed ? raw.split(/бывш\.?/i) : [raw, ""];
      const toks = (s: string) => [...new Set(s.match(TOKEN) ?? [])];
      for (const t of toks(cur!)) found.push(...resolve(t));
      if (!found.length && old) for (const t of toks(old)) found.push(...resolve(t));
      found = [...new Map(found.map((p) => [p.order, p])).values()];
      const live = found.filter((p) => p.status !== "cancelled");
      if (live.length) found = live;
      kind = renamed ? "renamed" : found.length > 1 ? "multi" : "base";
    }
    if (!found.length) {
      if (ship || deliv) unmatched.push({ raw, ship, deliv, why: (raw.match(TOKEN) ?? []).length ? "номера нет в выгрузке заказов OZON" : "в ячейке нет номера заказа" });
      continue;
    }
    how.set(raw, kind);
    const w = found.map((p) => Math.max(0, Number(p.units) || 0));
    const ws = w.reduce((a, b) => a + b, 0);
    let accS = 0, accD = 0;
    found.forEach((p, i) => {
      const last = i === found.length - 1;
      const k = ws > 0 ? w[i]! / ws : 1 / found.length;
      const s = last ? Math.round((ship - accS) * 100) / 100 : Math.round(ship * k * 100) / 100;
      const d = last ? Math.round((deliv - accD) * 100) / 100 : Math.round(deliv * k * 100) / 100;
      accS += s; accD += d;
      const cur = byPosting.get(p.order) ?? { ship: 0, deliv: 0 };
      const later = (a?: string, b?: string) => (a && b ? (a > b ? a : b) : a || b);
      // Город - из той же строки ведомости, что и расход (Иван 30.09): у заказа города его отправок,
      // а не все города артикула. Повторный выезд в другой город даёт два города.
      const cities = [...(cur.cities ?? [])];
      if (r.city && !cities.includes(r.city)) cities.push(r.city);
      byPosting.set(p.order, { ship: cur.ship + s, deliv: cur.deliv + d,
        dShip: later(cur.dShip, r.d_ship), dFact: later(cur.dFact, r.d_fact), ...(cities.length ? { cities } : {}) });
    });
  }
  return { byPosting, unmatched, how };
}

/** «Наша доставка» по ДАТЕ НАЧИСЛЕНИЯ заказа - для таблицы по артикулам (базис начислений), водопада
 *  и план-факта (Иван 28.09). Заказ в пути, который OZON ещё не начислил, в ряд НЕ входит (Иван 01.10,
 *  вариант «а»): его расход ждёт начисления в `pending` (на дате фактической доставки, без неё - отгрузки,
 *  без неё - заказа) и встанет в ряд на дату начисления, когда OZON его начислит - расход, выручка и доход
 *  за доставку всегда в одном месяце. Отменённый заказ OZON не начислит никогда, а счёт перевозчика по
 *  нему реальный - он остаётся в ряду на дате доставки/отгрузки (fallback), как раньше.
 *  Каждое отправление даёт ровно одну запись: ряд + pending = сумма byPosting (не теряется, не двоится). */
export function accrualShipSeries(postings: Posting[], byPosting: Map<string, PostingShip>) {
  const bySku = new Map<string, Map<string, number>>();
  const pending: [string, number][] = [];
  const fallback = { fact: 0, ship: 0, order: 0 };
  let total = 0, pendTotal = 0;
  const seen = new Set<string>();
  for (const p of postings) {
    const v = byPosting.get(p.order);
    if (!v || !v.ship || seen.has(p.order)) continue;
    seen.add(p.order);
    let d = p.sd || "";
    const fb = !d;
    if (fb) d = v.dFact || v.dShip || p.d;
    if (fb && String(p.status || "") !== "cancelled") { pending.push([d, v.ship]); pendTotal += v.ship; continue; }
    if (fb) { if (v.dFact) fallback.fact += v.ship; else if (v.dShip) fallback.ship += v.ship; else fallback.order += v.ship; }
    const sk = String(p.sku || "");
    const m = bySku.get(sk) ?? bySku.set(sk, new Map()).get(sk)!;
    m.set(d, (m.get(d) || 0) + v.ship);
    total += v.ship;
  }
  return { bySku, total, fallback, pending, pendTotal };
}

/** Повторный рейс перевозчика к уже отправленному заказу (возврат, повторная доставка): отдельная строка
 *  data/delivery_trips_extra.ndjson, к ship заказа в ведомости НЕ плюсуется (Иван 02.10, ответы 1а/2а/3).
 *  - «Аналитика по заказам»: perOrder - к заказу, в месяц заказа;
 *  - начисления («Отчет», таблица по артикулам, логистика): bySku - на ДАТУ РЕЙСА (d_trip), потому что
 *    своего начисления OZON у рейса нет; закрытый месяц заказа задним числом не меняется.
 *  Номер ищется тем же matchLedger, что и ведомость (одна логика). Старые данные не трогаются: файл
 *  только дописывается, сборщик ведомости его не перезаписывает.
 *  Инвариант: сумма bySku + unmatched = сумма ship всех рейсов (не теряется, не двоится). */
export interface ExtraTrip { order: string; ship: number; deliv: number; d_trip: string }
export function extraTripSeries(trips: ExtraTrip[], postings: Posting[]) {
  const perOrder = new Map<string, { ship: number; deliv: number }>();
  const bySku = new Map<string, Map<string, number>>();
  const unmatched: Unmatched[] = [];
  const skuOf = new Map<string, string>();
  for (const p of postings) if (!skuOf.has(p.order)) skuOf.set(p.order, String(p.sku || ""));
  let total = 0;
  for (const t of trips) {
    const d = String(t.d_trip || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`delivery_trips_extra: у рейса ${t.order} нет даты рейса d_trip`);
    const m = matchLedger([{ order: t.order, ship: t.ship, deliv: t.deliv }], postings);
    unmatched.push(...m.unmatched);
    for (const [k, v] of m.byPosting) {
      const cur = perOrder.get(k) ?? { ship: 0, deliv: 0 };
      perOrder.set(k, { ship: cur.ship + v.ship, deliv: cur.deliv + v.deliv });
      const sk = skuOf.get(k) || "";
      const s = bySku.get(sk) ?? bySku.set(sk, new Map()).get(sk)!;
      s.set(d, (s.get(d) || 0) + v.ship);
      total += v.ship;
    }
  }
  const all = trips.reduce((a, t) => a + (Number(t.ship) || 0), 0);
  const un = unmatched.reduce((a, u) => a + u.ship, 0);
  if (Math.abs(total + un - all) > 0.01) throw new Error(`delivery_trips_extra: рейсы ${all} ≠ разложено ${total} + не найдено ${un}`);
  return { perOrder, bySku, total, unmatched };
}
