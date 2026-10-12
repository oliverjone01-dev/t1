// FENIKS mutation probe (scratch copy only): do the new assertions discriminate skip vs no-skip?
import { shiftSeries, diffSeries, baseOf } from "./price-test.js";

const START = "2026-10-07";
const days = (from: string, n: number): string[] => {
  const out: string[] = []; const t = new Date(from + "T00:00:00Z");
  for (let i = 0; i < n; i++) { out.push(t.toISOString().slice(0, 10)); t.setUTCDate(t.getUTCDate() + 1); }
  return out;
};
const PRE = days("2026-09-30", 7), POST = days("2026-10-07", 7);
const CTRL = new Set(["X", "Y", "Z"]);
const g = new Map<string, Map<string, number>>();
for (const d of PRE) g.set(d, new Map([["A", 48], ["B", 48], ["X", 47.5], ["Y", 48], ["Z", 48.5]]));
for (const d of POST) g.set(d, new Map([["A", 48], ["B", 56], ["X", 47.5], ["Y", 48], ["Z", 48.5]]));
const all = () => true, skipB = (a: string) => a === "B", none = () => false;

const a1 = (skip: (a: string, d: string) => boolean) =>
  shiftSeries(g, ["A", "B"], CTRL, START, PRE, all, 0.5, skip).filter((x) => x.d >= START).every((x) => x.s === 0 && x.nt === 1);
const a2 = (skip: (a: string, d: string) => boolean) =>
  shiftSeries(g, ["A", "B", "C", "D"], CTRL, START, PRE, all, 0.75, skip).filter((x) => x.d >= START).every((x) => x.s === null);
console.log("assert1 with skipB:", a1(skipB), "| mutant (no skip):", a1(none), "-> discriminating:", a1(skipB) !== a1(none));
console.log("assert2 with skipB:", a2(skipB), "| mutant (no skip):", a2(none), "-> discriminating:", a2(skipB) !== a2(none));

// Base-slide demo: B dirty from 2026-10-03 (CPC), 3 products, minShare 0.5 -> need 2 clean per day.
const g2 = new Map<string, Map<string, number>>();
for (const d of days("2026-09-20", 17)) g2.set(d, new Map([["A", 48], ["B", 48], ["C", 49], ["X", 47.5], ["Y", 48], ["Z", 48.5]]));
const cpcFrom = (a: string, d: string) => (a === "B" || a === "C") && d >= "2026-10-03";
const s = diffSeries(g2, ["A", "B", "C"], CTRL, START, all, 0.5, cpcFrom);
console.log("base days with skip:", baseOf(s, START).days.join(","));
console.log("base days no skip  :", baseOf(diffSeries(g2, ["A", "B", "C"], CTRL, START, all, 0.5), START).days.join(","));
