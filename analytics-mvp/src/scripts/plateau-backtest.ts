// Проверка правила плато на истории (Иван 28.09: «найди ещё данные по артикулам для подтверждения
// или наоборот установленного правила»). Правило откалибровано на одном товаре (GGT-47-3-3-90),
// здесь оно прогоняется на всех включениях рекламы, какие видны в данных, и на плацебо.
//
// Включение рекламы - первый день с расходом (data/ads_sku_daily.ndjson, ряд с 03.07) после 14 дней
// без расхода; конец - последний день серии, где между днями с расходом не больше одного пустого.
// Ряд - соинвест из data/coinv_daily.ndjson (с июня), разрыв к медиане панели без всех товаров,
// которые хоть раз рекламировались. Шкала - соинвест, а не gap_pct страницы: сырых цен за лето нет.
// Плацебо - товары без рекламы за всё время с теми же датами старта: как часто правило
// «срабатывает» само, без воздействия.
import { readFileSync } from "node:fs";
import { gapSeries, controlByDay, readiness, ARRIVED, type CoinvRow } from "./boost-readiness.js";

export interface BacktestEvent {
  art: string; on: string; last: string; runDays: number; spend: number;
  base: number | null; obs: number; maxShift: number | null; firstHitDay: number | null;
  plateau: string | null; plateauDay: number | null; heldAfterStop: number | null;
}
export interface Backtest {
  events: BacktestEvent[]; usable: BacktestEvent[];
  hit: number; plateau: number; hitDays: number[]; plateauDays: number[];
  placeboN: number; placeboHit: number; placeboPlateau: number;
  nearMiss: number; heldAfterStop: number[];
}

const add = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 864e5).toISOString().slice(0, 10);
const QUIET = 14, FIRST = "2026-07-03";

export function runBacktest(coinv: CoinvRow[], adsSku: Array<{ d: string; sku: string | number; sp: number }>,
                            sku2art: Record<string, string>): Backtest {
  const spend = new Map<string, Map<string, number>>();
  for (const r of adsSku) {
    const a = sku2art[String(r.sku)]; if (!a || !(r.sp > 0)) continue;
    const m = spend.get(a) ?? spend.set(a, new Map()).get(a)!; m.set(r.d, (m.get(r.d) || 0) + r.sp);
  }
  const everAd = new Set(spend.keys());
  const ctl = controlByDay(coinv, everAd, undefined, false);
  const haveCo = new Set(coinv.map((r) => r.art));
  const lastCo = coinv.reduce((m, r) => r.date > m ? r.date : m, "");
  const res = (art: string, on: string, off?: string) =>
    readiness({ art, on, off }, gapSeries(coinv, art, ctl, false), new Map(), 3, false);
  const events: BacktestEvent[] = [];
  for (const [a, m] of spend) {
    if (!haveCo.has(a)) continue;
    for (const d of [...m.keys()].sort()) {
      if (add(d, -QUIET) < FIRST) continue;
      let quiet = true; for (let k = 1; k <= QUIET; k++) if (m.has(add(d, -k))) { quiet = false; break; }
      if (!quiet) continue;
      let e = d; while (m.has(add(e, 1)) || m.has(add(e, 2))) e = m.has(add(e, 1)) ? add(e, 1) : add(e, 2);
      const r = res(a, d, e < lastCo ? add(e, 1) : undefined);
      const run = r.series.filter((p) => p.date <= e);
      const hit = run.find((p) => p.shift >= ARRIVED);
      events.push({
        art: a, on: d, last: e, runDays: Math.round((Date.parse(e) - Date.parse(d)) / 864e5) + 1,
        spend: Math.round([...m.entries()].filter(([x]) => x >= d && x <= e).reduce((s, [, v]) => s + v, 0)),
        base: r.base, obs: run.length, maxShift: run.length ? Math.max(...run.map((p) => p.shift)) : null,
        firstHitDay: hit ? hit.day : null,
        plateau: r.plateauFrom && r.plateauFrom <= e ? r.plateauFrom : null,
        plateauDay: r.plateauFrom && r.plateauFrom <= e ? r.plateauDay ?? null : null,
        heldAfterStop: r.heldDays != null && r.heldDays >= 0 ? r.heldDays : null,
      });
    }
  }
  const usable = events.filter((e) => e.base != null && e.obs >= 3);
  // Плацебо: 20 случайных товаров без рекламы на каждую дату старта, фиксированное зерно.
  const never = [...haveCo].filter((a) => !everAd.has(a)).sort();
  let seed = 7; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  let pN = 0, pHit = 0, pPl = 0;
  for (const e of usable) for (let k = 0; k < 20 && never.length; k++) {
    const a = never[Math.floor(rnd() * never.length)]!;
    const r = res(a, e.on); const run = r.series.filter((p) => p.date <= e.last);
    if (!run.length || r.base == null) continue;
    pN++; if (run.some((p) => p.shift >= ARRIVED)) pHit++; if (r.plateauFrom && r.plateauFrom <= e.last) pPl++;
  }
  const hits = usable.filter((e) => e.firstHitDay != null), pls = usable.filter((e) => e.plateau);
  return {
    events, usable, hit: hits.length, plateau: pls.length,
    hitDays: hits.map((e) => e.firstHitDay!).sort((x, y) => x - y),
    plateauDays: pls.map((e) => e.plateauDay!).sort((x, y) => x - y),
    placeboN: pN, placeboHit: pHit, placeboPlateau: pPl,
    nearMiss: usable.filter((e) => e.maxShift != null && e.maxShift >= ARRIVED - 1 && e.maxShift < ARRIVED).length,
    heldAfterStop: usable.map((e) => e.heldAfterStop).filter((x): x is number => x != null).sort((x, y) => x - y),
  };
}

if (process.argv[1]?.endsWith("plateau-backtest.ts")) {
  const nd = (p: string) => readFileSync(p, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const b = runBacktest(nd("data/coinv_daily.ndjson"), nd("data/ads_sku_daily.ndjson"),
    JSON.parse(readFileSync("data/sku_offer.json", "utf-8")));
  const { events, usable, ...rest } = b;
  console.log(JSON.stringify({ events: events.length, usable: usable.length, ...rest }));
}
