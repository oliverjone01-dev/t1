import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const stub = resolve("src/scripts/ym/fixtures/ym-api-stub.mjs");
const read = (d: string, f: string) => JSON.parse(readFileSync(join(d, f), "utf8"));
function seed(from: string[] = ["2002"]) {
  const d = mkdtempSync(join(tmpdir(), "ym-resume-"));
  const rows = [{ ym: "2026-05", sku: "SKU-1", sold: 1, ret: 0, amount: 1000, from: ["1001"] },
    { ym: "2026-06", sku: "SKU-1", sold: 1, ret: 0, amount: 1000, from }];
  writeFileSync(join(d, "realization_monthly.ndjson"), rows.map(r => JSON.stringify(r)).join("\n") + "\n");
  writeFileSync(join(d, "realization_state.json"), JSON.stringify({ pairs: ["2026-05/1001", "2026-06/2002"] }));
  const orders = [{ campaign: "1001", fin: "2026-05-10", status: "DELIVERED", delivered: 1 },
    { campaign: "2002", fin: "2026-06-10", status: "DELIVERED", delivered: 1 }];
  writeFileSync(join(d, "orders.ndjson"), orders.map(r => JSON.stringify(r)).join("\n") + "\n");
  return d;
}
function run(d: string, args: string[], budget = "10") {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("YM_")));
  const r = spawnSync("npx", ["tsx", "src/scripts/ym/reports.ts", "realization", ...args], {
    env: { ...env, YM_API_KEY: "stub-key", YM_BUSINESS_IDS: "111,222", YM_DATA_DIR: d,
      YM_REPORT_BUDGET: budget, NODE_OPTIONS: `--import=${stub}`, SCEN: "{}", STUB_LOG: join(d, "requests.ndjson") },
    encoding: "utf8", timeout: 30000,
  });
  expect(r.status, r.stderr || r.stdout || "child did not exit").toBe(0);
  return (r.stdout || "") + (r.stderr || "");
}
describe("прогресс реализации восстанавливается вместе с месяцем", () => {
  it("частично скачанный месяц не заменяет полный старый месяц", () => {
    const d = seed();
    writeFileSync(join(d, "realization_monthly.ndjson"), JSON.stringify({ ym: "2026-06", sku: "SKU-1", sold: 2, ret: 0, amount: 2000, from: ["1001", "2002"] }) + "\n");
    writeFileSync(join(d, "realization_state.json"), JSON.stringify({ pairs: ["2026-06/1001", "2026-06/2002"] }));
    writeFileSync(join(d, "orders.ndjson"), ["1001", "2002"].map(campaign => JSON.stringify({ campaign, fin: "2026-06-10", status: "DELIVERED", delivered: 1 })).join("\n") + "\n");
    expect(run(d, ["2026-06", "--rebuild"], "1")).toContain("realization: всего");
    expect(JSON.parse(readFileSync(join(d, "realization_monthly.ndjson"), "utf8").trim())).toMatchObject({ sold: 2, amount: 2000 });
    expect(read(d, "realization_state.json").pairs).toEqual(["2026-06/1001", "2026-06/2002"]);
  }, 60000);
  it("исчерпанный бюджет: второй месяц восстановлен вместе с исходными pairs и не задваивается следующим прогоном", () => {
    const d = seed();
    expect(run(d, ["2026-05", "2026-06", "--rebuild"], "1")).toContain("realization: всего");
    expect(read(d, "realization_state.json").pairs).toContain("2026-06/2002");
    expect(run(d, ["2026-06"])).not.toContain("ym-reports FAILED");
    const june = readFileSync(join(d, "realization_monthly.ndjson"), "utf8").trim().split("\n").map(l => JSON.parse(l)).find(r => r.ym === "2026-06");
    expect(june).toMatchObject({ sold: 1, ret: 0, amount: 1000 });
  }, 60000);
  it.each([{ from: ["2002"] }, { from: [] }])("несогласованные/неизвестные from=$from: отказ до добавления и без изменения фактов", ({ from }) => {
    const d = seed(from);
    writeFileSync(join(d, "realization_state.json"), JSON.stringify({ pairs: [] }));
    const before = readFileSync(join(d, "realization_monthly.ndjson"), "utf8");
    expect(run(d, ["2026-06"])).toContain("REALIZATION_STATE_CONFLICT");
    expect(readFileSync(join(d, "realization_monthly.ndjson"), "utf8")).toBe(before);
    expect(read(d, "realization_state.json").pairs).toEqual([]);
  });
});
