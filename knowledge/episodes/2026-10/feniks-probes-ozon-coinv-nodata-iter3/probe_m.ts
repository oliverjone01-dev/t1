// M1 / M2 probes on HEAD code (run: cd analytics-mvp && npx tsx <this file>). Writes only to scratch.
import { writeFileSync } from "node:fs";
import { mergeCoinv } from "/home/user/t1/analytics-mvp/src/scripts/ozon/coinv-merge.ts";
import { readGapDaily, noSite } from "/home/user/t1/analytics-mvp/src/scripts/gap-daily.ts";
const S = "/tmp/claude-0/-home-user-t1/feadf20c-8819-5ff1-a553-d442fce0f391/scratchpad";
const out: string[] = [];
const log = (k: string, ok: boolean, v: unknown) => out.push(`${ok ? "PASS" : "FAIL"} ${k}: ${JSON.stringify(v)}`);
const D = "2026-10-17", A = "GGT-03-5-1-L-100";
const VAL = { date: D, art: A, sku: "6045903630", coinv_paid_pct: 47.5, site_paid: 45100, cap: 85900, oa_source: "snapshot", in_panel: true };
const pick = (r: any) => ({ sku: r.sku, coinv_paid_pct: r.coinv_paid_pct, site_paid: r.site_paid, cap: r.cap, oa_source: r.oa_source, no_site: r.no_site });

// ---- M1: repeat without vitrine over a value WITH SKU must not erase it
const m1cases: Array<[string, any]> = [
  ["M1a sku same, coinv 0, oa==seller", { date: D, art: A, sku: "6045903630", coinv_pct: 0, oa: 85900, seller: 85900, src: "snapshot" }],
  ["M1b sku empty, coinv 0", { date: D, art: A, sku: "", coinv_pct: 0, oa: 85900, seller: 85900 }],
  ["M1c no coinv field, oa==seller only", { date: D, art: A, sku: "6045903630", oa: 85900, seller: 85900 }],
  ["M1d coinv 0, no prices", { date: D, art: A, sku: "6045903630", coinv_pct: 0 }],
  ["M1e oa==seller, seller changed 84000", { date: D, art: A, sku: "6045903630", coinv_pct: 0, oa: 84000, seller: 84000 }],
];
for (const [k, s] of m1cases) {
  const r = mergeCoinv([{ ...VAL }], [s]).rows[0] as any;
  log(k, r.coinv_paid_pct === 47.5 && r.site_paid === 45100 && r.no_site === undefined && r.sku === "6045903630", pick(r));
}
const twice = mergeCoinv(mergeCoinv([{ ...VAL }], [m1cases[0]![1]]).rows, [m1cases[0]![1]]).rows[0] as any;
log("M1f idempotent x2", twice.coinv_paid_pct === 47.5 && twice.no_site === undefined, pick(twice));

// ---- M2: slice with vitrine over no_site writes value and removes label
const NS = { date: D, art: A, sku: "6045903630", site_paid: 85900, cap: 85900, oa_source: "snapshot", in_panel: true, no_site: true };
const m2 = mergeCoinv([{ ...NS }], [{ date: D, art: A, sku: "6045903630", coinv_pct: 47.5, oa: 45100, seller: 85900, src: "snapshot" }]).rows[0] as any;
log("M2a value written, label removed", m2.coinv_paid_pct === 47.5 && m2.site_paid === 45100 && m2.no_site === undefined, pick(m2));
const m2b = mergeCoinv([{ ...NS }], [{ date: D, art: A, sku: "6045903630", coinv_pct: 0, oa: 85900, seller: 85900 }]).rows[0] as any;
log("M2b no-vitrine again keeps label, no value", m2b.coinv_paid_pct === undefined && m2b.no_site === true, pick(m2b));
const m2c = mergeCoinv([{ ...NS }], [{ date: D, art: A, sku: "6045903630", coinv_pct: 47.5 }]).rows[0] as any;
log("M2c value without prices: label removed, site_paid stays = cap (stale)", m2c.coinv_paid_pct === 47.5 && m2c.no_site === undefined, pick(m2c));
const m2d = mergeCoinv([{ ...NS }], [{ date: D, art: A, sku: "6045903630", oa: 45100, seller: 85900 }]).rows[0] as any;
log("M2d prices without coinv_pct: label removed, value absent", true, pick(m2d));
// new day with vitrine for an art that was no_site yesterday: plain add
const m2e = mergeCoinv([{ ...NS }], [{ date: "2026-10-18", art: A, sku: "6045903630", coinv_pct: 52.63, oa: 40690, seller: 85900 }]).rows.find((r) => r.date === "2026-10-18") as any;
log("M2e next day value", m2e.coinv_paid_pct === 52.63 && m2e.no_site === undefined, pick(m2e));

// ---- same rule? edge predicates (gap_daily vs coinv_daily)
const gHi = noSite({ date: D, art: A, sku: "1", site_to_seller: 1.02, gap_pct: -2.0 });
const cHi = mergeCoinv([], [{ date: D, art: A, sku: "1", coinv_pct: -2.0, oa: 87618, seller: 85900 }]).rows[0] as any;
log("E1 site above ours: gap noSite / coinv value", true, { gap_noSite: gHi, coinv: cHi.coinv_paid_pct, coinv_no_site: cHi.no_site });
const gNear = noSite({ date: D, art: A, sku: "1", site_to_seller: 0.9999, gap_pct: 0.01 });
const cNear = mergeCoinv([], [{ date: D, art: A, sku: "1", coinv_pct: 0.01, oa: 85891, seller: 85900 }]).rows[0] as any;
log("E2 near-equal (9 rub): gap noSite / coinv value", true, { gap_noSite: gNear, coinv: cNear.coinv_paid_pct, coinv_no_site: cNear.no_site });

// ---- readGapDaily M1/M2 on a fixture
const f = `${S}/gap_fixture.ndjson`;
const row = (o: any) => JSON.stringify({ src: "prices_raw", oa_used: false, ...o });
writeFileSync(f, [
  row({ date: D, art: "M1", sku: "1", site_to_seller: 0.525, gap_pct: 47.5, snap: "утро" }),
  row({ date: D, art: "M1", sku: "1", site_to_seller: 1.0, gap_pct: 0.0, snap: "вечер" }),
  row({ date: D, art: "M1L", sku: "1", site_to_seller: 0.525, gap_pct: 47.5, snap: "утро" }),
  row({ date: D, art: "M1L", sku: "1", site_to_seller: null, gap_pct: null, no_site: true, snap: "вечер" }),
  row({ date: D, art: "M2", sku: "1", site_to_seller: null, gap_pct: null, no_site: true, snap: "утро" }),
  row({ date: D, art: "M2", sku: "1", site_to_seller: 0.525, gap_pct: 47.5, snap: "вечер" }),
  row({ date: D, art: "Z", sku: "1", site_to_seller: 1.0, gap_pct: 0.0 }),
].join("\n") + "\n");
const g = readGapDaily(f);
const val = (a: string) => g.rows.filter((r) => r.art === a).map((r) => r.gap_pct);
log("G-M1 evening 0 with SKU over morning 47.5", JSON.stringify(val("M1")) === "[47.5]", val("M1"));
log("G-M1L evening labeled no_site over morning 47.5", JSON.stringify(val("M1L")) === "[47.5]", val("M1L"));
log("G-M2 evening value over morning no_site", JSON.stringify(val("M2")) === "[47.5]", val("M2"));
log("G-Z lone 0 with SKU -> no data", JSON.stringify(val("Z")) === "[]", { rows: val("Z"), noSite: g.noSite, zeros: g.rows.filter((r) => r.gap_pct === 0).length });

// ---- B4 on the live file
const live = readGapDaily("/home/user/t1/analytics-mvp/data/gap_daily.ndjson");
log("B4 live: zeros in series 0, noSite >= 14, bad 0", live.rows.filter((r) => r.gap_pct === 0).length === 0 && live.noSite >= 14 && live.bad === 0,
  { rows: live.rows.length, zeros: live.rows.filter((r) => r.gap_pct === 0).length, min: Math.min(...live.rows.map((r) => r.gap_pct as number)), noSite: live.noSite, bad: live.bad, withOa: live.withOa });
console.log(out.join("\n"));
