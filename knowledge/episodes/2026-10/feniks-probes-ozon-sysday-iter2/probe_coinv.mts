// R7 (coinv-merge dedup) and M1 interplay, head code 10049c0. Run from <scratch>/code_10049c0/analytics-mvp:
//   CODE=$PWD npx tsx <this file>
// Read-only: imports the module, prints results, writes nothing.
const CODE = process.env.CODE!;
const { mergeCoinv } = await import(CODE + "/src/scripts/ozon/coinv-merge.ts");
const { markNoSiteEx } = await import(CODE + "/src/scripts/gap-daily.ts");

const arts = (n: number) => Array.from({ length: n }, (_, i) => `A${i}`);
const stored = (d: string, n: number) => arts(n).map((art) => ({ date: d, art, coinv_paid_pct: 40, in_panel: true }));
const slice = (d: string, n: number, zero: boolean) =>
  arts(n).map((art) => ({ date: d, art, sku: "1", seller: 1000, oa: zero ? 1000 : 600, coinv_pct: zero ? 0 : 40, src: "snapshot" }));
const gapDay = (d: string, n: number, zero: boolean) =>
  arts(n).map((art) => ({ date: d, art, sku: "1", gap_pct: zero ? 0 : 40, site_to_seller: zero ? 1 : 0.6, src: "prices_raw" }));

const show = (name: string, r: { systemDays: string[]; rows?: Array<Record<string, unknown>> }, d = "2026-10-19") => {
  const day = (r.rows ?? []).filter((x) => x.date === d);
  const vals = day.slice(0, 3).map((x) => x.coinv_paid_pct ?? x.gap_pct ?? (x.no_site ? "no_site" : "-"));
  console.log(`${name}: systemDays=${JSON.stringify(r.systemDays)} rows of day=${day.length} first values=${JSON.stringify(vals)}`);
};

// (a) author's test: 30 articles x 2 slices, all zero -> 30 unique, below the 50-row floor
show("coinv 30x2 zero", mergeCoinv(stored("2026-10-12", 30), [...slice("2026-10-19", 30, true), ...slice("2026-10-19", 30, true)]));
// (b) 60 x 2 all zero -> 60 unique, 100% -> system day
show("coinv 60x2 zero", mergeCoinv(stored("2026-10-12", 60), [...slice("2026-10-19", 60, true), ...slice("2026-10-19", 60, true)]));
// (c) M1: morning captured (40%), evening without storefront (0) for 60 articles
show("coinv 60 morning ok + evening zero", mergeCoinv(stored("2026-10-12", 60), [...slice("2026-10-19", 60, false), ...slice("2026-10-19", 60, true)]));
// (c') the same two slices through the gap_daily reader (M1 dedup before the share)
const g = markNoSiteEx([...gapDay("2026-10-12", 60, false), ...gapDay("2026-10-19", 60, false), ...gapDay("2026-10-19", 60, true)]);
console.log(`gap  60 morning ok + evening zero: systemDays=${JSON.stringify(g.systemDays)} warnDays=${JSON.stringify(g.warnDays)} values=${JSON.stringify(g.rows.filter((x: any) => x.date === "2026-10-19").slice(0, 3).map((x: any) => x.gap_pct))}`);
