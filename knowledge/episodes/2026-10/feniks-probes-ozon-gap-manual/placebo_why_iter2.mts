// Placebo test of PR #489 at e1c3a62: per placebo card, the worst |shift| with the HEAD filter (a day is dropped if
// gap_pct === 0 at the card or at any card of sibsOf(a)), how many points the filter drops, and what the pair partners
// show on the worst day (zero / non-zero below 10 / normal). Read-only.
// Run from a code copy whose ./data points at a variant:  CODE=$PWD npx tsx <this file>
import { readFileSync, existsSync } from "node:fs";
const CODE = process.env.CODE!;
const { readGapDaily, GAP_DAILY_FILE } = await import(CODE + "/src/scripts/gap-daily.ts");
const { gapSeries, controlByDay, pairGapSeries, readiness, BASE_MIN } = await import(CODE + "/src/scripts/boost-readiness.ts");

const G = readGapDaily("data/" + GAP_DAILY_FILE);
const T = JSON.parse(readFileSync("tools/tests/tests.json", "utf-8"));
const wave = T.тесты.find((t: any) => t.id === "boost_plus_exit");
const card = new Map<string, string>();
if (existsSync("data/card_groups.json")) {
  for (const g of JSON.parse(readFileSync("data/card_groups.json", "utf-8")).groups) for (const s of g.skus) card.set(s.offer, g.main);
}
const AD: string[] = wave.роли?.test_ad ?? [], SIB: string[] = wave.роли?.test_sibling ?? [];
const on = (wave.старт || "").slice(0, 10);
const sibsOf = (a: string) => SIB.filter((x) => card.get(x) && card.get(x) === card.get(a));
const ctl = controlByDay(G.rows, new Set([...AD, ...SIB]));
const zeroDays = new Set(G.rows.filter((r: any) => r.gap_pct === 0).map((r: any) => `${r.date}|${r.art}`));
const val = new Map(G.rows.map((r: any) => [`${r.date}|${r.art}`, r.gap_pct]));
let worstAll = 0;
for (const a of SIB) {
  const sibs = sibsOf(a);
  const ser = sibs.length ? pairGapSeries(G.rows, a, sibs) : gapSeries(G.rows, a, ctl);
  const r = readiness({ art: a, on }, ser, new Map(), BASE_MIN);
  const zeroAt = (d: string) => zeroDays.has(`${d}|${a}`) || sibs.some((x) => zeroDays.has(`${d}|${x}`));
  const kept = r.series.filter((p: any) => !zeroAt(p.date));
  const worst = kept.reduce((m: any, p: any) => (Math.abs(p.shift) > Math.abs(m?.shift ?? 0) ? p : m), null);
  if (worst) worstAll = Math.max(worstAll, Math.abs(worst.shift));
  const mates = sibs.filter((x) => x !== a);
  const onWorst = worst ? mates.map((m) => `${m}=${val.get(`${worst.date}|${m}`) ?? "-"}`).join(" ") : "";
  console.log(`${a.padEnd(16)} mode=${mates.length ? "pair" : "single (sibs=[self])"} points=${r.series.length} dropped=${r.series.length - kept.length} worst=${worst ? Math.abs(worst.shift).toFixed(1) + " on " + worst.date : "-"} own=${worst ? val.get(`${worst.date}|${a}`) : "-"} partners: ${onWorst}`);
}
console.log(`worst over placebo cards = ${worstAll.toFixed(1)} (test: must be < 2 and > 0)`);
