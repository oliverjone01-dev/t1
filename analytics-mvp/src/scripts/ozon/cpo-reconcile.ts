import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { OzonPerformance } from "../../connector/ozon-performance.js";
import { readCpo } from "./cpo-capture.js";

async function main() {
  const capture = readCpo(file => "data/" + file);
  if (!capture) return;
  const ordersHash = createHash("sha256").update(readFileSync("data/orders_daily.ndjson")).digest("hex");
  if (ordersHash === capture.orders_sha256) return;
  const clientId = process.env.OZON_PERF_CLIENT_ID;
  const clientSecret = process.env.OZON_PERF_SECRET;
  if (!clientId || !clientSecret) throw new Error("Performance API credentials missing");

  const perf = new OzonPerformance({ clientId, clientSecret });
  const uuid = await perf.requestAllSkuCpoOrders(capture.from, capture.to);
  for (let attempt = 0; attempt < 20; attempt++) {
    const status = String((await perf.statisticsState(uuid)).state ?? "");
    if (["OK", "DONE", "READY", "SUCCESS", "COMPLETED"].includes(status)) {
      const csv = await perf.downloadStatistics(uuid);
      const result = spawnSync("python3", ["-B", "tools/cabinet/cpo_reconcile.py"], {
        input: csv, stdio: ["pipe", "inherit", "inherit"],
      });
      if (result.status !== 0) throw new Error("CPO aggregate validation failed");
      return;
    }
    if (["ERROR", "FAILED", "CANCELLED"].includes(status)) throw new Error("CPO report failed");
    await setTimeout(10_000);
  }
  throw new Error("CPO report timed out");
}

main().catch(() => {
  // This workflow is public. API errors may contain native report metadata.
  console.error("::warning::CPO API reconciliation failed; previous validated aggregates preserved");
  process.exitCode = 1;
});
