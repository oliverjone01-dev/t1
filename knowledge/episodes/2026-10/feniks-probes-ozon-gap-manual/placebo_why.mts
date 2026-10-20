// Why the placebo test of PR #489 stays red: per placebo card, the worst |shift| with the PR filter (own zero days
// excluded), the day it comes from, and whether that day is a zero of the card itself or of its pair partner.
// Read-only. Run from a code copy whose ./data points at a variant:  CODE=$PWD npx tsx <this file>
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
for (const a of SIB) {
  const mates = sibsOf(a).filter((x) => x !== a);
  const ser = sibsOf(a).length ? pairGapSeries(G.rows, a, sibsOf(a)) : gapSeries(G.rows, a, ctl);
  const r = readiness({ art: a, on }, ser, new Map(), BASE_MIN);
  const kept = r.series.filter((p: any) => !zeroDays.has(`${p.date}|${a}`));
  const worst = kept.reduce((m: any, p: any) => (Math.abs(p.shift) > Math.abs(m?.shift ?? 0) ? p : m), null);
  const why = worst ? (mates.filter((m) => zeroDays.has(`${worst.date}|${m}`)).length ? `zero of partner ${mates.filter((m) => zeroDays.has(`${worst.date}|${m}`)).join(",")}` : "no zero that day") : "-";
  console.log(`${a.padEnd(17)} mode=${mates.length ? "pair " + mates.join("+") : "control"} points=${r.series.length} filtered=${r.series.length - kept.length} worst=${worst ? Math.abs(worst.shift).toFixed(1) + " on " + worst.date : "-"} (${why})`);
}
