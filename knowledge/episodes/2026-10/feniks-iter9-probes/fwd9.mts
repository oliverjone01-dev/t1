// FENIKS iter9: forward-compat of the data format change (G5). New-format cpo_orders (row per order and day) read by the
// iter8 reader (p8) and by the branch reader (p9). Order 0001-0001 charged 60 on 10.09 and 40 on 11.09, one posting, revenue 300.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const S = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/i9";
const d = mkdtempSync(join(S, "fwd_"));
const nd = (rows: object[]) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
writeFileSync(join(d, "orders_daily.ndjson"), nd([{ order: "0001-0001-1", d: "2026-09-10", revenue: 300, units: 1, status: "delivered" }]));
writeFileSync(join(d, "cpo_orders.ndjson"), nd([{ order: "0001-0001", d: "2026-09-10", sp: 60 }, { order: "0001-0001", d: "2026-09-11", sp: 40 }]));
writeFileSync(join(d, "cpo_sku_daily.ndjson"), nd([{ d: "2026-09-10", sku: "1", sp: 60, n: 1 }, { d: "2026-09-11", sku: "1", sp: 40, n: 1 }]));
const dp = (f: string) => join(d, f);
for (const sb of ["p8", "p9"]) {
  const m = await import(`${S}/${sb}/analytics-mvp/src/scripts/cpo-orders-rev.ts`);
  const co = m.cpoOrdersByDay(dp);
  console.log(sb, JSON.stringify(co.day));
}
void tmpdir;
