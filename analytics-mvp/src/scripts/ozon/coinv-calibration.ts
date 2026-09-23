// Калибровка соинвеста по эталону начислений -> data/coinv_calibration.json.
//
// Соинвест это главная метрика A/B-тестов по рекламе, и до сентября её нечем было проверить.
// Иван выгрузил реестр «Начисления» с разбивкой строки «Баллы за скидки»: по каждому заказу
// видно, сколько заплатил покупатель и сколько доплатил Ozon. Тождество
//   цена продавца = выручка от покупателя + баллы за скидки + программы партнёров
// сходится до рубля, значит это факт, а не оценка.
//
// Наш показатель считается из пары цен снимка. Цен на витрине две, и это главное:
//   coinv_listed = (1 - витрина / предельная) * 100        - акции продавца;
//   coinv_paid   = (1 - цена по карте / предельная) * 100  - плюс скидки самого Ozon.
// Скрипт сравнивает обе с фактом и говорит, КАКОЙ из цен ошибка, подставляя фактические
// значения по одному. Какая подстановка вывела показатель на факт, та цена и виновата.
//
// ЕДИНИЦА СЧЁТА - ЗАКАЗ, не артикул. Медиану по каталогу с медианой по заказам сравнивать
// нельзя: заказывают чаще уценённое, и по каталогу за август выходит 46 %, а по заказанным
// товарам 57 %. Это разные совокупности, а не расхождение метрики. Поэтому каждый заказ
// берёт снимок своего артикула, и медиана считается по заказам с обеих сторон.
//
// Эталон без даты заказа: в выгрузке есть только период (YYYY-MM), поэтому снимок артикула
// сворачивается в медиану за период. Это стоит нескольких пунктов там, где цена внутри месяца
// гуляла, и спутать этот шум с ошибкой метрики легко. Поэтому рядом всегда считается срез по
// артикулам со стабильной ценой: по августу на всей выборке остаётся 3.1 пункта, а на срезе
// 0.5 пункта, и видно, что виновата свёртка, а не показатель.
//
// Запуск: npm run coinv:calib   (сети не требует, читает только data/)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FACT = "data/payout_orders.ndjson";
const OURS = "data/coinv_daily.ndjson";
const OUT = "data/coinv_calibration.json";
/** Порог разброса витринной цены для среза «стабильные». 15 % это цена одной акции: выше него
 *  месячная медиана перестаёт представлять конкретный день заказа. */
const STABLE_SPREAD = 0.15;

export interface FactRow {
  accrual_id: string; art: string; qty: number;
  seller_price_unit: number; seller_price_total: number;
  paid_by_buyer: number; paid_by_ozon: number; partner_programs: number;
  ozon_share_pct: number; period: string;
}
/** Схема снимка от 23.09: observed дневной, состав панели фиксирован in_panel, обе витрины
 *  рядом. Старые поля (site, coinv_pct, cap_reliable) читаем для совместимости со снимками
 *  до 23.09, иначе пересчёт истории молча обнулился бы. */
export interface OurRow {
  date: string; art: string; cap: number;
  site_listed?: number; site_paid?: number;
  coinv_listed_pct?: number; coinv_paid_pct?: number;
  observed?: boolean; in_panel?: boolean;
  site?: number; coinv_pct?: number;
}

/** Цена на витрине и цена по карте из строки снимка, с откатом на старую схему. */
export const listedOf = (r: OurRow): number | undefined => r.site_listed ?? r.site;
export const paidOf = (r: OurRow): number | undefined => r.site_paid;
/** День без наблюдения в расчёт не берём. В снимке до 23.09 флага нет - там наблюдение есть. */
export const isObserved = (r: OurRow): boolean => r.observed !== false;

export interface ArtSnap {
  art: string; days: number;
  cap: number; listed: number; paid: number | null;
  /** (max - min) / медиана витринной цены за период. 0 значит цена не двигалась. */
  spread: number;
}
export interface PeriodCalib {
  period: string;
  /** Заказов в эталоне и сколько из них удалось сопоставить со снимком. */
  ordersTotal: number; ordersMatched: number;
  artsTotal: number; artsMatched: number; artsWithPaid: number;
  revenueTotal: number; revenueMatched: number;
  /** Всё ниже - медианы ПО ЗАКАЗАМ сопоставленного множества. */
  listed: number; paid: number | null; withFactBuyer: number; withFactCap: number; fact: number;
  /** Отношения цен: факт к нашей витрине и к нашей цене по карте. */
  buyerToListed: number; buyerToPaid: number | null; capRatio: number;
  missing: string[];
  snaps: ArtSnap[];
  /** Та же калибровка, но только по артикулам со стабильной ценой внутри периода.
   *  Эталон не несёт даты заказа, поэтому снимок артикула сворачивается в медиану за месяц.
   *  Там, где цена внутри месяца гуляла, эта свёртка сама по себе даёт несколько пунктов
   *  шума, и его легко принять за ошибку метрики. Срез по стабильным ценам этот шум убирает:
   *  чем уже разброс, тем ближе отношение «факт / цена с картой» к единице. */
  stable?: PeriodCalib;
}

export const median = (v: number[]): number => {
  if (!v.length) return NaN;
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const r1 = (x: number) => Math.round(x * 10) / 10;
/** «1 пункт», «2 пункта», «7 пунктов»: отчёт читают люди, и кривое склонение бросается в глаза. */
export const pts = (x: number): string => {
  const n = Math.abs(r1(x)), i = Math.floor(n);
  if (n !== i) return `${r1(x)} пункта`;
  const d = i % 100, u = i % 10;
  if (d >= 11 && d <= 14) return `${r1(x)} пунктов`;
  if (u === 1) return `${r1(x)} пункт`;
  if (u >= 2 && u <= 4) return `${r1(x)} пункта`;
  return `${r1(x)} пунктов`;
};
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Заказы, где тождество не сходится. Невязка больше рубля - строка выгрузки битая,
 *  считать по ней нельзя, и молчать о ней тоже нельзя. */
export function brokenRows(fact: FactRow[]): Array<{ id: string; art: string; residual: number }> {
  const out: Array<{ id: string; art: string; residual: number }> = [];
  for (const o of fact) {
    const sum = o.paid_by_buyer + o.paid_by_ozon + o.partner_programs;
    const res = o.seller_price_total - sum;
    if (Math.abs(res) > 1) out.push({ id: o.accrual_id, art: o.art, residual: Math.round(res) });
  }
  return out;
}

/** Снимок артикула, свёрнутый в одну точку за период. Дни без наблюдения выброшены.
 *  spread - относительный разброс витринной цены внутри периода, им отсекают артикулы,
 *  у которых месячная медиана не представляет ни один конкретный день. */
export function snapOf(art: string, rows: OurRow[]): ArtSnap | null {
  const ok = rows.filter(isObserved);
  const cap = median(ok.map((x) => x.cap).filter((x) => x > 0));
  const ls = ok.map(listedOf).filter((x): x is number => !!x && x > 0);
  const listed = median(ls);
  const paidV = ok.map(paidOf).filter((x): x is number => !!x && x > 0);
  if (!cap || !listed) return null;
  return {
    art, days: ok.length, cap, listed,
    paid: paidV.length ? median(paidV) : null,
    spread: r3((Math.max(...ls) - Math.min(...ls)) / listed),
  };
}

/** Калибровка за один период. Единица счёта - заказ: каждый заказ подтягивает снимок своего
 *  артикула, и медианы берутся по заказам с обеих сторон. Возвраты (отрицательные суммы) не
 *  берём: доля Ozon в возврате это та же доля продажи с обратным знаком. */
export function calibrate(fact: FactRow[], ours: OurRow[], period: string, maxSpread = Infinity): PeriodCalib {
  const f = fact.filter((o) => o.period === period && o.seller_price_unit > 0 && o.qty > 0);
  const o = ours.filter((x) => x.date.slice(0, 7) === period);

  const byArtOurs = new Map<string, OurRow[]>();
  for (const x of o) { const a = byArtOurs.get(x.art); if (a) a.push(x); else byArtOurs.set(x.art, [x]); }
  const snaps = new Map<string, ArtSnap>();
  for (const [art, rows] of byArtOurs) {
    const s = snapOf(art, rows);
    if (s && s.spread <= maxSpread) snaps.set(art, s);
  }

  // Ряды по ЗАКАЗАМ. У каждого заказа своя строка в каждом ряду, поэтому медианы сопоставимы.
  const listed: number[] = [], paid: number[] = [], wBuyer: number[] = [], wCap: number[] = [];
  const factSh: number[] = [], bToListed: number[] = [], bToPaid: number[] = [], capR: number[] = [];
  const missing = new Set<string>();
  const matchedArts = new Set<string>();
  let revenueMatched = 0, ordersMatched = 0;
  for (const x of f) {
    const s = snaps.get(x.art);
    if (!s) { missing.add(x.art); continue; }
    ordersMatched += 1;
    matchedArts.add(x.art);
    revenueMatched += x.seller_price_total;
    const buyer = x.paid_by_buyer / x.qty;
    listed.push(100 * (1 - s.listed / s.cap));
    if (s.paid) { paid.push(100 * (1 - s.paid / s.cap)); bToPaid.push(buyer / s.paid); }
    wBuyer.push(100 * (1 - buyer / s.cap));
    if (x.seller_price_unit > 0) {
      wCap.push(100 * (1 - s.listed / x.seller_price_unit));
      capR.push(x.seller_price_unit / s.cap);
    }
    factSh.push(x.ozon_share_pct);
    bToListed.push(buyer / s.listed);
  }
  const m1 = (v: number[]) => (v.length ? r1(median(v)) : NaN);
  return {
    period,
    ordersTotal: f.length, ordersMatched,
    artsTotal: new Set(f.map((x) => x.art)).size,
    artsMatched: matchedArts.size,
    artsWithPaid: [...matchedArts].filter((a) => snaps.get(a)?.paid != null).length,
    revenueTotal: Math.round(f.reduce((s, x) => s + x.seller_price_total, 0)),
    revenueMatched: Math.round(revenueMatched),
    listed: m1(listed),
    paid: paid.length ? m1(paid) : null,
    withFactBuyer: m1(wBuyer),
    withFactCap: m1(wCap),
    fact: m1(factSh),
    buyerToListed: bToListed.length ? r3(median(bToListed)) : NaN,
    buyerToPaid: bToPaid.length ? r3(median(bToPaid)) : null,
    capRatio: capR.length ? r3(median(capR)) : NaN,
    missing: [...missing].sort(),
    snaps: [...snaps.values()].filter((s) => matchedArts.has(s.art)).sort((a, b) => a.art.localeCompare(b.art)),
  };
}

/** Что калибровка говорит словами. Отчёт читает Иван, и «ошибка в витрине» полезнее, чем
 *  четыре одинаково выглядящих строки с процентами. */
export function verdict(p: PeriodCalib): string {
  const best = p.paid != null && Math.abs(p.fact - p.paid) < Math.abs(p.fact - p.listed) ? p.paid : p.listed;
  const which = best === p.paid ? "по цене с картой" : "по витрине";
  const gap = p.fact - best;
  // Срез по стабильным ценам решает спор «ошибка метрики или шум сопоставления»: если там
  // расхождение уходит, виновата месячная свёртка, а не сам показатель.
  const st = p.stable;
  const stBest = st && (st.paid != null && Math.abs(st.fact - st.paid) < Math.abs(st.fact - st.listed) ? st.paid : st.listed);
  const stGap = st && stBest != null ? st.fact - stBest : null;
  if (Math.abs(gap) < 1) return `соинвест ${which} сходится с фактом, расхождение меньше пункта`;
  if (stGap != null && Math.abs(stGap) < 1 && st) {
    return `соинвест ${which} расходится на ${pts(gap)} по всей выборке, но на ${st.ordersMatched} заказах`
      + ` со стабильной ценой расхождение ${pts(stGap)}: это шум месячной свёртки, а не ошибка метрики`;
  }
  const byBuyer = Math.abs(p.fact - p.withFactBuyer);
  const byCap = Number.isFinite(p.withFactCap) ? Math.abs(p.fact - p.withFactCap) : Infinity;
  const who = byBuyer < byCap ? "цена, которую платит покупатель" : "предельная цена";
  const left = Math.min(byBuyer, byCap);
  return `лучший ряд ${which}, расхождение ${gap >= 0 ? "+" : ""}${pts(gap)};`
    + ` виновата ${who} (подстановка факта оставляет ${pts(left)})`;
}

function readNdjson<T>(p: string): T[] {
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as T);
}

function main(): void {
  const fact = readNdjson<FactRow>(FACT);
  const ours = readNdjson<OurRow>(OURS);
  if (!fact.length) { console.warn(`coinv-calibration: нет эталона ${FACT} - пропуск`); return; }
  if (!ours.length) { console.warn(`coinv-calibration: нет ряда ${OURS} - пропуск`); return; }

  const broken = brokenRows(fact);
  if (broken.length) {
    console.log(`Тождество не сходится у ${broken.length} строк из ${fact.length}:`);
    for (const b of broken) console.log(`  ${b.id} ${b.art}: невязка ${b.residual.toLocaleString("ru")} ₽`);
  } else {
    console.log(`Тождество сходится на всех ${fact.length} строках эталона.`);
  }

  const periods = [...new Set(fact.map((x) => x.period))].sort();
  const out: PeriodCalib[] = [];
  for (const period of periods) {
    const c = calibrate(fact, ours, period);
    c.stable = calibrate(fact, ours, period, STABLE_SPREAD);
    out.push(c);
    const n = (x: number | null) => (x == null || !Number.isFinite(x) ? "нет данных" : `${x.toFixed(1)} %`);
    const q = (x: number | null) => (x == null || !Number.isFinite(x) ? "-" : x.toFixed(3));
    console.log(`\n=== ${period} ===`);
    console.log(`  заказов сопоставлено ${c.ordersMatched} из ${c.ordersTotal},`
      + ` артикулов ${c.artsMatched} из ${c.artsTotal} (с ценой по карте ${c.artsWithPaid})`);
    console.log(`  оборот покрыт: ${c.revenueMatched.toLocaleString("ru")} из ${c.revenueTotal.toLocaleString("ru")} ₽`
      + ` (${Math.round(100 * c.revenueMatched / (c.revenueTotal || 1))} %)`);
    console.log(`  Всё ниже - медианы ПО ЗАКАЗАМ сопоставленного множества.`);
    console.log(`  соинвест по витрине              ${n(c.listed)}`);
    console.log(`  соинвест по цене с картой        ${n(c.paid)}`);
    console.log(`  с фактической ценой покупателя   ${n(c.withFactBuyer)}`);
    console.log(`  с фактической предельной ценой   ${n(c.withFactCap)}`);
    console.log(`  факт                             ${n(c.fact)}`);
    console.log(`  факт / витрина ${q(c.buyerToListed)} · факт / цена с картой ${q(c.buyerToPaid)}`
      + ` · предельная факт / наша ${q(c.capRatio)}`);
    const st = c.stable;
    if (st && st.ordersMatched) {
      console.log(`  срез по стабильной цене (разброс <${Math.round(STABLE_SPREAD * 100)} %), заказов ${st.ordersMatched}:`);
      console.log(`    витрина ${n(st.listed)} · карта ${n(st.paid)} · факт ${n(st.fact)}`
        + ` · факт / карта ${q(st.buyerToPaid)}`);
    }
    console.log(`  ВЕРДИКТ: ${verdict(c)}`);
    if (c.missing.length) console.log(`  нет в нашем снимке (${c.missing.length}): ${c.missing.slice(0, 10).join(", ")}${c.missing.length > 10 ? " ..." : ""}`);
  }
  writeFileSync(OUT, JSON.stringify({ built: new Date().toISOString().slice(0, 10), broken, periods: out }, null, 1) + "\n");
  console.log(`\n-> ${OUT}`);
}

if (/coinv-calibration\.(ts|js)$/.test(process.argv[1] || "")) main();
