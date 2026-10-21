import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { sourceHealth } from "./source-health.js";

const now = new Date("2026-10-21T12:00:00Z");
function check(change: (status: any, dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "delivery-health-"));
  try {
    const files = ["delivery_orders.ndjson","delivery_sku_daily.ndjson","delivery_city_daily.ndjson","delivery_trips_extra.ndjson","delivery_cities.json"];
    const outputs = Object.fromEntries(files.map(file => {
      const data = file.endsWith("json") ? "{}\n" : "";
      writeFileSync(join(dir,file),data);
      return [file,createHash("sha256").update(data).digest("hex")];
    }));
    const status = {loaded_at:now.toISOString(),through:"2026-10-20",events:0,missing_cost:0,undated_rows:0,retained_unseen_events:0,missing_customer_paid:0,city_unknown:0,outputs};
    change(status,dir); writeFileSync(join(dir,"delivery_sheet_status.json"),JSON.stringify(status));
    return sourceHealth(dir,now).find(r=>r.source === "Наша доставка: Google Таблица")!;
  } finally { rmSync(dir,{recursive:true,force:true}); }
}
describe("delivery freshness and coverage",()=>{
  it("successful read is fresh even on a day without shipments",()=>expect(check(()=>{}).status).toBe("ok"));
  it("fresh read with missing bill is incomplete, not zero expense",()=>{
    const r=check(s=>{s.missing_cost=1;});expect(r.status).toBe("warning");expect(r.note).toContain("без счёта: 1");
  });
  it("a partial file replacement cannot be certified by old status",()=>expect(check((_,dir)=>writeFileSync(join(dir,"delivery_orders.ndjson"),"{\"ship\":1}\n")).status).toBe("error"));
  it("an old success marker does not certify today's load",()=>expect(check(s=>{s.loaded_at="2026-10-18T12:00:00Z";}).status).toBe("error"));
  it("a retained missing shipment cannot be labelled complete",()=>expect(check(s=>{s.retained_unseen_events=1;}).status).toBe("warning"));
});
