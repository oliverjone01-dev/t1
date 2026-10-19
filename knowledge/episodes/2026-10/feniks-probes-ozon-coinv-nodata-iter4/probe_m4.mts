// M1 / M2 / H (history) / G (gap reader) / X (same input, two writers) probes on the audited code.
// Run from any analytics-mvp copy: CODE=<analytics-mvp root of the audited rev> S=<scratch dir> npx tsx <this file>
// Writes only fixture files under $S.
import { writeFileSync } from "node:fs";
const CODE = process.env.CODE || "/home/user/t1/analytics-mvp";
const S = process.env.S || "/tmp";
const { mergeCoinv } = await import(`${CODE}/src/scripts/ozon/coinv-merge.ts`);
const { readGapDaily, markNoSite, noSite } = await import(`${CODE}/src/scripts/gap-daily.ts`);
const out: string[] = [];
const log = (k: string, ok: boolean, v: unknown) => out.push(`${ok ? "PASS" : "FAIL"} ${k}: ${JSON.stringify(v)}`);
const pick = (r: any) => r && ({ sku: r.sku, coinv_paid_pct: r.coinv_paid_pct, site_paid: r.site_paid, cap: r.cap, oa_source: r.oa_source, no_site: r.no_site });
const D = "2026-10-19";
const HIST = { date: "2026-10-12", art: "OLD", sku: "123", coinv_paid_pct: 47, site_paid: 45100, cap: 85900, in_panel: true };
const VAL = (art: string) => ({ date: D, art, sku: "123", coinv_paid_pct: 47.5, site_paid: 45100, cap: 85900, oa_source: "snapshot", in_panel: true });
const at = (rows: any[], art: string, d = D) => rows.find((r) => r.art === art && r.date === d);

// ---- M1 (coinv): repeat without vitrine over a same-day value, with and without history
const zeros: Array<[string, any]> = [
  ["a coinv 0 + oa==seller", { coinv_pct: 0, oa: 85900, seller: 85900, sku: "123" }],
  ["b sku empty, coinv 0", { coinv_pct: 0, oa: 85900, seller: 85900, sku: "" }],
  ["c no coinv, oa==seller", { oa: 85900, seller: 85900, sku: "123" }],
  ["d coinv 0, no prices", { coinv_pct: 0, sku: "123" }],
  ["e oa==seller 84000 (seller changed)", { coinv_pct: 0, oa: 84000, seller: 84000, sku: "123" }],
];
for (const [k, z] of zeros) {
  for (const [lab, stored] of [["mature", [HIST, VAL("OLD")]], ["new", [VAL("NEW")]]] as const) {
    const art = lab === "mature" ? "OLD" : "NEW";
    const r = at(mergeCoinv(stored.map((x) => ({ ...x })), [{ date: D, art, ...z }]).rows, art);
    log(`M1${k} ${lab}`, r.coinv_paid_pct === 47.5 && r.site_paid === 45100 && r.no_site === undefined && r.sku === "123", pick(r));
  }
}
// ---- M2 (coinv): slice with vitrine over a no_site row writes the value and removes the label
const NS = (art: string) => ({ date: D, art, sku: "123", site_paid: 85900, cap: 85900, oa_source: "snapshot", in_panel: true, no_site: true });
let r: any = at(mergeCoinv([NS("NEW")], [{ date: D, art: "NEW", sku: "123", coinv_pct: 47.5, oa: 45100, seller: 85900 }]).rows, "NEW");
log("M2a new: value over no_site", r.coinv_paid_pct === 47.5 && r.site_paid === 45100 && r.no_site === undefined, pick(r));
r = at(mergeCoinv([NS("NEW")], [{ date: D, art: "NEW", sku: "123", coinv_pct: 0, oa: 85900, seller: 85900 }]).rows, "NEW");
log("M2b new: zero again keeps label, no value", r.coinv_paid_pct === undefined && r.no_site === true, pick(r));
r = at(mergeCoinv([HIST, NS("OLD")], [{ date: D, art: "OLD", sku: "123", coinv_pct: 0, oa: 85900, seller: 85900 }]).rows, "OLD");
log("M2c mature: legacy no_site + zero slice -> honest 0, label removed", r.coinv_paid_pct === 0 && r.no_site === undefined, pick(r));

// ---- H (coinv history)
r = at(mergeCoinv([HIST], [{ date: D, art: "OLD", sku: "123", coinv_pct: 0, oa: 85900, seller: 85900 }]).rows, "OLD");
log("H1 mature zero -> 0, no label", r.coinv_paid_pct === 0 && r.no_site === undefined, pick(r));
r = at(mergeCoinv([], [{ date: D, art: "NEW", sku: "9", coinv_pct: 0, oa: 85900, seller: 85900 }]).rows, "NEW");
log("H2 new zero -> no_site", r.coinv_paid_pct === undefined && r.no_site === true, pick(r));
let rows: any[] = mergeCoinv([], [{ date: "2026-10-16", art: "NEW", coinv_pct: 0 }, { date: "2026-10-17", art: "NEW", coinv_pct: 0 }]).rows;
log("H3 new, two zero days in one slice -> both no_site", rows.every((x) => x.no_site === true && x.coinv_paid_pct === undefined), rows.map(pick));
// multi-day slice: day 1 paid, day 2 zero, nothing in stored (backfill of a new card)
rows = mergeCoinv([], [{ date: "2026-10-17", art: "NEW", coinv_pct: 47 }, { date: "2026-10-18", art: "NEW", coinv_pct: 0, oa: 85900, seller: 85900 }]).rows;
const h4c = at(rows, "NEW", "2026-10-18");
const h4g = markNoSite([{ date: "2026-10-17", art: "NEW", gap_pct: 47 }, { date: "2026-10-18", art: "NEW", gap_pct: 0, site_to_seller: 1 }]).find((x: any) => x.date === "2026-10-18");
log("H4 multi-day slice: coinv history from stored only vs gap from whole file (same input)", true,
  { coinv_18: pick(h4c), gap_18_noSite: noSite(h4g) });
// the same two days merged one slice at a time (how the mac sends them)
const seq = mergeCoinv(mergeCoinv([], [{ date: "2026-10-17", art: "NEW", coinv_pct: 47 }]).rows, [{ date: "2026-10-18", art: "NEW", coinv_pct: 0, oa: 85900, seller: 85900 }]).rows;
log("H4s same two days, one slice per day", at(seq, "NEW", "2026-10-18").coinv_paid_pct === 0, pick(at(seq, "NEW", "2026-10-18")));
// tiny positive coinv on day 1 (9 rub difference) counts as history for day 2
rows = mergeCoinv(mergeCoinv([], [{ date: "2026-10-16", art: "NEW", coinv_pct: 0.01, oa: 85891, seller: 85900 }]).rows,
  [{ date: "2026-10-17", art: "NEW", coinv_pct: 0, oa: 85900, seller: 85900 }]).rows;
log("H5 coinv 0.01 on the first day makes the next zero honest (edge E2 of iter3)", true, { d16: pick(at(rows, "NEW", "2026-10-16")), d17: pick(at(rows, "NEW", "2026-10-17")) });

// ---- G (gap reader on fixtures)
const f = `${S}/gap_fixture4.ndjson`;
const row = (o: any) => JSON.stringify({ src: "prices_raw", oa_used: false, ...o });
writeFileSync(f, [
  row({ date: "2026-10-12", art: "OLD", sku: "1", site_to_seller: 0.53, gap_pct: 47 }),
  row({ date: D, art: "OLD", sku: "1", site_to_seller: 1.0, gap_pct: 0.0 }),                          // G1 mature lone zero
  row({ date: D, art: "NEW", sku: "", site_to_seller: 1.0, gap_pct: 0.0 }),                           // G2 new zero
  row({ date: "2026-10-12", art: "M1", sku: "1", gap_pct: 47 }),
  row({ date: D, art: "M1", sku: "1", site_to_seller: 0.525, gap_pct: 47.5, snap: "утро" }),
  row({ date: D, art: "M1", sku: "1", site_to_seller: 1.0, gap_pct: 0.0, snap: "вечер" }),          // G4 M1 mature
  row({ date: "2026-10-12", art: "R", sku: "1", gap_pct: 47 }),
  row({ date: D, art: "R", sku: "1", site_to_seller: 1.0, gap_pct: 0.0, snap: "утро" }),
  row({ date: D, art: "R", sku: "1", site_to_seller: 0.525, gap_pct: 47.5, snap: "вечер" }),        // G5 reverse
  row({ date: "2026-10-12", art: "ZZ", sku: "1", gap_pct: 47 }),
  row({ date: D, art: "ZZ", sku: "1", site_to_seller: 1.0, gap_pct: 0.0, snap: "утро" }),
  row({ date: D, art: "ZZ", sku: "1", site_to_seller: 1.0, gap_pct: 0.0, snap: "вечер" }),          // G6 0 then 0
  row({ date: "2026-10-12", art: "NEG", sku: "1", gap_pct: 47 }),
  row({ date: D, art: "NEG", sku: "1", site_to_seller: 1.02, gap_pct: -2.0 }),                       // G7 mature negative
  row({ date: D, art: "NEGN", sku: "1", site_to_seller: 1.02, gap_pct: -2.0 }),                      // G7n new negative
  row({ date: "2026-10-16", art: "TINY", sku: "1", site_to_seller: 0.99995, gap_pct: 0.005 }),
  row({ date: "2026-10-17", art: "TINY", sku: "1", site_to_seller: 1.0, gap_pct: 0.0 }),             // G8 tiny first day
  row({ date: D, art: "M2", sku: "1", site_to_seller: null, gap_pct: null, no_site: true, snap: "утро" }),
  row({ date: D, art: "M2", sku: "1", site_to_seller: 0.525, gap_pct: 47.5, snap: "вечер" }),       // M2 gap
].join("\n") + "\n");
const g = readGapDaily(f);
const val = (a: string) => g.rows.filter((x: any) => x.art === a).map((x: any) => [x.date.slice(5), x.gap_pct]);
log("G1 mature lone zero -> 0 in series", JSON.stringify(val("OLD")) === JSON.stringify([["10-12", 47], ["10-19", 0]]), val("OLD"));
log("G2 new zero -> not in series", JSON.stringify(val("NEW")) === "[]", val("NEW"));
log("G4 M1 mature: evening 0 over morning 47.5 -> 47.5", JSON.stringify(val("M1").pop()) === JSON.stringify(["10-19", 47.5]), val("M1"));
log("G5 morning 0 (mature), evening 47.5 -> 47.5", JSON.stringify(val("R").pop()) === JSON.stringify(["10-19", 47.5]), val("R"));
log("G6 morning 0, evening 0 (mature) -> 0", JSON.stringify(val("ZZ").pop()) === JSON.stringify(["10-19", 0]), val("ZZ"));
log("G7 mature negative passes (stop fires on <10)", true, val("NEG"));
log("G7n new negative (site above ours, first day)", true, val("NEGN"));
log("G8 tiny 0.005 on first day = history for the next zero", true, val("TINY"));
log("M2g evening value over morning no_site", JSON.stringify(val("M2")) === JSON.stringify([["10-19", 47.5]]), val("M2"));
log("Gn noSite count (NEW, TINY d16, M2 none)", true, { noSite: g.noSite, bad: g.bad });

// ---- live file through the audited code: labels at read == labels in file; zeros in the series
const live = readGapDaily(`${process.env.DATA || "/home/user/t1/analytics-mvp/data"}/gap_daily.ndjson`);
log("B4 live readGapDaily: zeros 0, noSite 14, bad 0", live.rows.filter((x: any) => x.gap_pct === 0).length === 0 && live.noSite === 14 && live.bad === 0,
  { rows: live.rows.length, zeros: live.rows.filter((x: any) => x.gap_pct === 0).length, min: Math.min(...live.rows.map((x: any) => x.gap_pct)), noSite: live.noSite, bad: live.bad, withOa: live.withOa });
console.log(out.join("\n"));
