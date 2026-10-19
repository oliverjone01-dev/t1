// iter2 G1b reproduction on HEAD, both variants (no SKU / with SKU) and labeled no_site row. Run from analytics-mvp.
import { readFileSync, writeFileSync } from "node:fs";
import { planBlock } from "/home/user/t1/analytics-mvp/src/scripts/plan-tab.ts";
import { readGapDaily } from "/home/user/t1/analytics-mvp/src/scripts/gap-daily.ts";
const S = "/tmp/claude-0/-home-user-t1/feadf20c-8819-5ff1-a553-d442fce0f391/scratchpad";
const ART = "GGT-48-2-2-100-180";
const base = readFileSync("/home/user/t1/analytics-mvp/data/gap_daily.ndjson", "utf-8").replace(/\n?$/, "\n");
const variants: Record<string, object | null> = {
  none: null,
  nosku_zero: { date: "2026-10-19", art: ART, sku: "", site_to_seller: 1.0, gap_pct: 0.0, src: "prices_raw", oa_used: false, snap: "вечер" },
  sku_zero: { date: "2026-10-19", art: ART, sku: "5444460310", site_to_seller: 1.0, gap_pct: 0.0, src: "prices_raw", oa_used: false, snap: "вечер" },
  labeled: { date: "2026-10-19", art: ART, sku: "5444460310", site_to_seller: null, gap_pct: null, no_site: true, src: "prices_raw", oa_used: false, snap: "вечер" },
  s2s_only: { date: "2026-10-19", art: ART, sku: "5444460310", site_to_seller: 1.0, src: "prices_raw", oa_used: false, snap: "вечер" },
  control_5: { date: "2026-10-19", art: ART, sku: "5444460310", site_to_seller: 0.95, gap_pct: 5.0, src: "prices_raw", oa_used: false, snap: "вечер" },
};
for (const [k, extra] of Object.entries(variants)) {
  const copy = `${S}/gap_${k}.ndjson`;
  writeFileSync(copy, base + (extra ? JSON.stringify(extra) + "\n" : ""));
  const html = planBlock("2026-10-19", (f) => (f === "gap_daily.ndjson" ? copy : `/home/user/t1/analytics-mvp/data/${f}`))!.html;
  const i = html.indexOf(ART);
  const t = html.slice(i, i + 2600).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const j = t.indexOf("53,8%");
  console.log(k.padEnd(11), "| plan:", t.slice(j, j + 60), "| readGapDaily 19.10:", JSON.stringify(readGapDaily(copy).rows.filter((r) => r.art === ART && r.date === "2026-10-19").map((r) => r.gap_pct)));
}
