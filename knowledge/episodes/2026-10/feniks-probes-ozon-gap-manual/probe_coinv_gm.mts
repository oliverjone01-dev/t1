// coinv-merge system-day share vs the M1 rule, head code of PR #489. Read-only: imports, prints, writes nothing.
// Run from a code copy:  CODE=$PWD npx tsx <this file>
const CODE = process.env.CODE!;
const { mergeCoinv } = await import(CODE + "/src/scripts/ozon/coinv-merge.ts");
const { markNoSiteEx } = await import(CODE + "/src/scripts/gap-daily.ts");

const arts = (n: number, p = "A") => Array.from({ length: n }, (_, i) => `${p}${i}`);
const stored = (d: string, n: number, v = 40) => arts(n).map((art) => ({ date: d, art, coinv_paid_pct: v, in_panel: true }));
const slice = (d: string, n: number, zero: boolean, p = "A") =>
  arts(n, p).map((art) => ({ date: d, art, sku: "1", seller: 1000, oa: zero ? 1000 : 600, coinv_pct: zero ? 0 : 40, src: "snapshot" }));
const gapDay = (d: string, n: number, zero: boolean, p = "A") =>
  arts(n, p).map((art) => ({ date: d, art, sku: "1", gap_pct: zero ? 0 : 40, site_to_seller: zero ? 1 : 0.6, src: "prices_raw" }));
const show = (name: string, r: { systemDays: string[]; rows: Array<Record<string, unknown>> }, d = "2026-10-19") => {
  const day = r.rows.filter((x) => x.date === d);
  const vals = [...new Set(day.map((x) => (x.no_site ? "no_site" : x.coinv_paid_pct)))];
  console.log(`${name}: systemDays=${JSON.stringify(r.systemDays)} rows=${day.length} values=${JSON.stringify(vals)}`);
};
const gap = (name: string, rows: Array<Record<string, unknown>>, d = "2026-10-19") => {
  const g = markNoSiteEx(rows as never);
  const day = g.rows.filter((x: any) => x.date === d);
  console.log(`${name}: systemDays=${JSON.stringify(g.systemDays)} warnDays=${JSON.stringify(g.warnDays)} values=${JSON.stringify([...new Set(day.map((x: any) => (x.no_site ? "no_site" : x.gap_pct)))])}`);
};

// (a) author: 30 x 2 zero -> 30 unique < 50 rows
show("coinv (a) 30x2 zero", mergeCoinv(stored("2026-10-12", 30), [...slice("2026-10-19", 30, true), ...slice("2026-10-19", 30, true)]));
// (b) 60 x 2 zero, no stored value that day -> real system day
show("coinv (b) 60x2 zero", mergeCoinv(stored("2026-10-12", 60), [...slice("2026-10-19", 60, true), ...slice("2026-10-19", 60, true)]));
// (c) author's new case: morning already merged (stored 47), evening slice zero
show("coinv (c) stored morning + evening zero", mergeCoinv([...stored("2026-10-12", 60), ...stored("2026-10-19", 60, 47)], slice("2026-10-19", 60, true)));
// (d) iter2 D2: ONE slice file with morning captured and evening zero (60 + 60), nothing stored that day
show("coinv (d) one slice morning ok + evening zero", mergeCoinv(stored("2026-10-12", 60), [...slice("2026-10-19", 60, false), ...slice("2026-10-19", 60, true)]));
gap("gap   (d) same two cuts through gap_daily reader", [...gapDay("2026-10-12", 60, false), ...gapDay("2026-10-19", 60, false), ...gapDay("2026-10-19", 60, true)]);
// (e) stored morning for 60 + slice: those 60 zero and 40 new articles zero
show("coinv (e) 60 kept by M1 + 40 new zero", mergeCoinv([...stored("2026-10-12", 60), ...stored("2026-10-19", 60, 47)], [...slice("2026-10-19", 60, true), ...slice("2026-10-19", 40, true, "N")]));
gap("gap   (e) same through gap_daily reader", [...gapDay("2026-10-12", 60, false), ...gapDay("2026-10-19", 60, false), ...gapDay("2026-10-19", 60, true), ...gapDay("2026-10-19", 40, true, "N")]);
