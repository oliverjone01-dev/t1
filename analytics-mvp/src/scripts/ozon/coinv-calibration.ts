// Калибровка соинвеста по эталону начислений -> data/coinv_calibration.json.
//
// Соинвест это главная метрика A/B-тестов по рекламе, и до сентября её нечем было проверить.
// Иван выгрузил реестр «Начисления» с разбивкой строки «Баллы за скидки»: по каждому заказу
// видно, сколько заплатил покупатель и сколько доплатил Ozon. Тождество
//   цена продавца = выручка от покупателя + баллы за скидки + программы партнёров
// сходится до рубля, значит это факт, а не оценка.
//
// Наш показатель считается из пары цен снимка: coinv = (1 - витрина / предельная) * 100.
// Скрипт сравнивает его с фактом и главное - говорит, КАКОЙ из двух цен ошибка, подставляя
// фактические значения по одному:
//   «с фактической ценой покупателя» - исправлена только витрина;
//   «с фактической предельной ценой» - исправлена только предельная.
// Какая подстановка вывела показатель на факт, та цена и виновата.
//
// Эталон без даты заказа: в выгрузке есть только период (YYYY-MM). Поэтому сравниваем не
// заказ с днём, а медиану по артикулу за период с медианой по его заказам. Сопоставлять
// поштучно нельзя: расхождение дат само по себе дало бы несколько пунктов шума.
//
// Запуск: npm run coinv:calib   (сети не требует, читает только data/)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FACT = "data/payout_orders.ndjson";
const OURS = "data/coinv_daily.ndjson";
const OUT = "data/coinv_calibration.json";

export interface FactRow {
  accrual_id: string; art: string; qty: number;
  seller_price_unit: number; seller_price_total: number;
  paid_by_buyer: number; paid_by_ozon: number; partner_programs: number;
  ozon_share_pct: number; period: string;
}
export interface OurRow { date: string; art: string; site: number; cap: number; coinv_pct: number }

export interface ArtCalib {
  art: string; orders: number; days: number;
  ourCap: number; factCap: number; ourSite: number; factBuyer: number;
  our: number; withFactBuyer: number; withFactCap: number; fact: number;
}
export interface PeriodCalib {
  period: string;
  ordersTotal: number; artsTotal: number; artsMatched: number;
  revenueTotal: number; revenueMatched: number;
  our: number; withFactBuyer: number; withFactCap: number; fact: number;
  buyerRatio: number; capRatio: number;
  missing: string[];
  arts: ArtCalib[];
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

/** Калибровка за один период. Возвраты (отрицательные суммы) в расчёт долей не берём:
 *  доля Ozon в возврате это та же доля продажи с обратным знаком, она ничего не добавляет. */
export function calibrate(fact: FactRow[], ours: OurRow[], period: string): PeriodCalib {
  const f = fact.filter((o) => o.period === period && o.seller_price_unit > 0 && o.qty > 0);
  const o = ours.filter((x) => x.date.slice(0, 7) === period);

  const group = <T extends { art: string }>(xs: T[]): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const x of xs) { const a = m.get(x.art); if (a) a.push(x); else m.set(x.art, [x]); }
    return m;
  };
  const byArtFact = group(f), byArtOurs = group(o);

  const arts: ArtCalib[] = [];
  const missing: string[] = [];
  let revenueMatched = 0;
  for (const [art, os] of byArtFact) {
    const mine = byArtOurs.get(art);
    if (!mine || !mine.length) { missing.push(art); continue; }
    const ourCap = median(mine.map((x) => x.cap));
    const ourSite = median(mine.map((x) => x.site));
    if (!ourCap) { missing.push(art); continue; }
    const factCap = median(os.map((x) => x.seller_price_unit));
    const factBuyer = median(os.map((x) => x.paid_by_buyer / x.qty));
    revenueMatched += os.reduce((s, x) => s + x.seller_price_total, 0);
    arts.push({
      art, orders: os.length, days: mine.length,
      ourCap: Math.round(ourCap), factCap: Math.round(factCap),
      ourSite: Math.round(ourSite), factBuyer: Math.round(factBuyer),
      our: r1(100 * (1 - ourSite / ourCap)),
      withFactBuyer: r1(100 * (1 - factBuyer / ourCap)),
      withFactCap: factCap ? r1(100 * (1 - ourSite / factCap)) : NaN,
      fact: r1(median(os.map((x) => x.ozon_share_pct))),
    });
  }
  arts.sort((a, b) => a.art.localeCompare(b.art));
  const ok = arts.filter((a) => Number.isFinite(a.withFactCap));
  return {
    period,
    ordersTotal: f.length,
    artsTotal: byArtFact.size,
    artsMatched: arts.length,
    revenueTotal: Math.round(f.reduce((s, x) => s + x.seller_price_total, 0)),
    revenueMatched: Math.round(revenueMatched),
    our: r1(median(arts.map((a) => a.our))),
    withFactBuyer: r1(median(arts.map((a) => a.withFactBuyer))),
    withFactCap: r1(median(ok.map((a) => a.withFactCap))),
    fact: r1(median(arts.map((a) => a.fact))),
    buyerRatio: r3(median(arts.map((a) => a.factBuyer / a.ourSite))),
    capRatio: r3(median(ok.map((a) => a.factCap / a.ourCap))),
    missing: missing.sort(),
    arts,
  };
}

/** Какая из двух цен объясняет расхождение. Возвращает вердикт словами, а не только числа:
 *  отчёт читает Иван, и «ошибка в витрине» полезнее, чем две одинаково выглядящих строки. */
export function verdict(p: PeriodCalib): string {
  const gap = p.fact - p.our;
  if (Math.abs(gap) < 1) return "наш соинвест сходится с фактом, расхождение меньше пункта";
  const byBuyer = Math.abs(p.fact - p.withFactBuyer);
  const byCap = Math.abs(p.fact - p.withFactCap);
  const who = byBuyer < byCap ? "витрина" : "предельная цена";
  const left = Math.min(byBuyer, byCap);
  return `расхождение ${gap >= 0 ? "+" : ""}${pts(gap)}, ошибка в том, как снимается ${who}`
    + ` (подстановка факта оставляет ${pts(left)})`;
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
    out.push(c);
    console.log(`\n=== ${period}: заказов ${c.ordersTotal}, артикулов ${c.artsMatched} из ${c.artsTotal} ===`);
    console.log(`  оборот покрыт: ${c.revenueMatched.toLocaleString("ru")} из ${c.revenueTotal.toLocaleString("ru")} ₽`
      + ` (${Math.round(100 * c.revenueMatched / (c.revenueTotal || 1))} %)`);
    console.log(`  наш соинвест как есть            ${c.our.toFixed(1)} %`);
    console.log(`  с фактической ценой покупателя   ${c.withFactBuyer.toFixed(1)} %`);
    console.log(`  с фактической предельной ценой   ${c.withFactCap.toFixed(1)} %`);
    console.log(`  факт                             ${c.fact.toFixed(1)} %`);
    console.log(`  витрина: факт / наша ${c.buyerRatio.toFixed(3)} · предельная: факт / наша ${c.capRatio.toFixed(3)}`);
    console.log(`  ВЕРДИКТ: ${verdict(c)}`);
    if (c.missing.length) console.log(`  нет в нашем снимке (${c.missing.length}): ${c.missing.slice(0, 10).join(", ")}${c.missing.length > 10 ? " ..." : ""}`);
  }
  writeFileSync(OUT, JSON.stringify({ built: new Date().toISOString().slice(0, 10), broken, periods: out }, null, 1) + "\n");
  console.log(`\n-> ${OUT}`);
}

if (/coinv-calibration\.(ts|js)$/.test(process.argv[1] || "")) main();
