// K2 unit-level probes on the PR code copy (30abf83), real data variants and synthetic edge cases.
// Usage: CODE=<scratch>/code_30abf83/analytics-mvp S=<scratch> REPO_DATA=<repo analytics-mvp/data> npx tsx probe_sd.mts
// Reads only; writes nothing.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const CODE = process.env.CODE!, S = process.env.S!, REPO_DATA = process.env.REPO_DATA!;
const gd = await import(pathToFileURL(`${CODE}/src/scripts/gap-daily.ts`).href);
const cm = await import(pathToFileURL(`${CODE}/src/scripts/ozon/coinv-merge.ts`).href);
const nd = (p: string): any[] => readFileSync(p, "utf-8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
const log = (...a: unknown[]) => console.log(...a);

log(`constants: NO_SITE_DAY_SHARE=${gd.NO_SITE_DAY_SHARE} NO_SITE_DAY_MIN=${gd.NO_SITE_DAY_MIN}`);

// 1. Boundaries on real-data variants (readGapDaily = what build-tests reads).
for (const v of ["v0", "vMass", "vS90", "vS89", "vKeep", "vN50", "vN49", "vZ", "vU", "vP", "vPfix", "vZfix"]) {
  const r = gd.readGapDaily(`${S}/pb/${v}/data/gap_daily.ndjson`);
  const d19 = r.rows.filter((x: any) => x.date === "2026-10-19");
  const zeros19 = d19.filter((x: any) => x.gap_pct === 0).length;
  log(`${v.padEnd(6)} systemDays=${JSON.stringify(r.systemDays)} noSite=${r.noSite} rows19=${d19.length} zeros19=${zeros19} lastDay=${r.days[r.days.length - 1]}`);
}

// 2. Non-zero rows of a system day stay data with their original values (vKeep vs v0).
{
  const v0 = nd(`${S}/pb/v0/data/gap_daily.ndjson`).filter((x) => x.date.startsWith("2026-10-19"));
  const orig = new Map(v0.map((x) => [x.art, x.gap_pct]));
  const r = gd.readGapDaily(`${S}/pb/vKeep/data/gap_daily.ndjson`);
  const d19 = r.rows.filter((x: any) => x.date === "2026-10-19");
  const changed = d19.filter((x: any) => orig.get(x.art) !== x.gap_pct);
  const keep = d19.find((x: any) => x.art === "GGK-05-2-3-7040");
  log(`vKeep: 19.10 data rows ${d19.length}, value differs from v0: ${changed.length}, GGK-05-2-3-7040 = ${keep?.gap_pct} (v0 ${orig.get("GGK-05-2-3-7040")})`);
}

// 3. Exact 90% at the floor: n=50 with 45 vs 44 zeros, all articles with history.
{
  const hist = Array.from({ length: 50 }, (_, i) => ({ date: "2026-10-12", art: `A${i}`, gap_pct: 47, site_to_seller: 0.53 }));
  for (const z of [45, 44]) {
    const day = Array.from({ length: 50 }, (_, i) => ({ date: "2026-10-19", art: `A${i}`, gap_pct: i < z ? 0 : 47, site_to_seller: i < z ? 1 : 0.53 }));
    const { systemDays, rows } = gd.markNoSiteEx([...hist, ...day]);
    log(`n=50 zeros=${z} share=${z / 50}: systemDays=${JSON.stringify(systemDays)} honest zeros left=${rows.filter((x: any) => x.date === "2026-10-19" && x.gap_pct === 0 && x.no_site !== true).length}`);
  }
}

// 4. Same slice through both implementations: 30 articles, each twice in the day (morning + evening), all zero.
{
  const stored = Array.from({ length: 30 }, (_, i) => ({ date: "2026-10-12", art: `A${i}`, coinv_paid_pct: 47 }));
  const slice: any[] = [];
  for (const snap of ["утро", "вечер"]) for (let i = 0; i < 30; i++) slice.push({ date: "2026-10-19", art: `A${i}`, sku: "1", coinv_pct: 0, oa: 85900, seller: 85900, snap });
  const m = cm.mergeCoinv(stored, slice);
  const gapRows = [
    ...Array.from({ length: 30 }, (_, i) => ({ date: "2026-10-12", art: `A${i}`, gap_pct: 47, site_to_seller: 0.53 })),
    ...slice.map((s) => ({ date: s.date, art: s.art, gap_pct: 0, site_to_seller: 1 })),
  ];
  const g = gd.markNoSiteEx(gapRows);
  log(`dup slice 30 arts x2: coinv-merge systemDays=${JSON.stringify(m.systemDays)} (counts ${slice.length} raw rows); gap-daily systemDays=${JSON.stringify(g.systemDays)} (counts ${new Set(gapRows.filter((r) => r.date === "2026-10-19").map((r) => r.art)).size} deduped)`);
  log(`   coinv 19.10: no_site ${m.rows.filter((r: any) => r.date === "2026-10-19" && r.no_site === true).length}, zero ${m.rows.filter((r: any) => r.date === "2026-10-19" && r.coinv_paid_pct === 0).length}; gap 19.10 honest zeros ${g.rows.filter((r: any) => r.date === "2026-10-19" && r.no_site !== true && r.gap_pct === 0).length}`);
}

// 5. coinv-merge on the real stored coinv_daily: a 20.10 slice built from the 19.10 rows (all zero / 89% zero).
{
  const stored = nd(`${REPO_DATA}/coinv_daily.ndjson`);
  const d19 = stored.filter((r) => r.date === "2026-10-19" && typeof r.coinv_paid_pct === "number");
  const mk = (zeroN: number) => d19.map((r, i) => ({ date: "2026-10-20", art: r.art, sku: r.sku, seller: r.cap,
    oa: i < zeroN ? r.cap : r.site_paid, coinv_pct: i < zeroN ? 0 : r.coinv_paid_pct }));
  for (const [name, z] of [["all", d19.length], ["90%", Math.ceil(0.9 * d19.length)], ["89%", Math.ceil(0.9 * d19.length) - 1]] as const) {
    const m = cm.mergeCoinv(stored, mk(z as number));
    const d20 = m.rows.filter((r: any) => r.date === "2026-10-20");
    log(`coinv slice 20.10 ${name} (${z}/${d19.length}): systemDays=${JSON.stringify(m.systemDays)} no_site=${d20.filter((r: any) => r.no_site === true).length} zero=${d20.filter((r: any) => r.coinv_paid_pct === 0).length} paid>0=${d20.filter((r: any) => (r.coinv_paid_pct ?? 0) > 0).length}`);
  }
}

// 6. Negative gap (site price above ours) counts as «price equals ours» in gap-daily (site_to_seller >= 0.9999).
{
  const rows = [{ date: "2026-10-12", art: "N1", gap_pct: 47, site_to_seller: 0.53 }, { date: "2026-10-19", art: "N1", gap_pct: -5, site_to_seller: 1.05 }];
  log(`negative gap at a card with history: priceEqualsOurs=${gd.priceEqualsOurs(rows[1])}, markNoSite -> no_site=${gd.markNoSite(rows)[1].no_site === true}, value kept=${gd.markNoSite(rows)[1].gap_pct}`);
}
