// Сквозной тест продьюсеров отчётов на подменённом API Маркета (fixtures/ym-api-stub.mjs): гоняем
// реальный reports.ts, а не копию логики. Живой факт 12.10 (прогон 38222088709): бэкфилл реестра
// скачал 6 отчётов, на седьмом `fetch failed` - и потерял всё. Тест обязан падать на коде до PR #465.
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const STUB = resolve("src/scripts/ym/fixtures/ym-api-stub.mjs");
const MONTHS = Array.from({ length: 9 }, (_, i) => `2026-${String(i + 2).padStart(2, "0")}`);
const BIZ = ["111", "222"];

function seedNetting(): string {
  const d = mkdtempSync(join(tmpdir(), "ym-soft-"));
  const rows = BIZ.flatMap((b) => MONTHS.map((ym) => ({ d: `${ym}-01`, business: b, tx: `old-${b}-${ym}`, amount: 500, type: "Начисление", platform: "ym" })));
  writeFileSync(join(d, "netting.ndjson"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  // Схема 4 - как в живом снимке 12.10: текущая 5, значит бэкфилл с февраля.
  writeFileSync(join(d, "netting_state.json"), JSON.stringify({ schema: 4, months_done: BIZ.flatMap((b) => MONTHS.map((ym) => `${b}/${ym}`)) }));
  return d;
}
function run(dir: string, scen: object, args: string[]): string {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith("YM_") && v !== undefined) env[k] = v;
  Object.assign(env, {
    YM_API_KEY: "stub-key", YM_BUSINESS_IDS: BIZ.join(","), YM_DATA_DIR: dir, NODE_OPTIONS: `--import=${STUB}`,
    SCEN: JSON.stringify(scen), STUB_LOG: join(dir, "_req.ndjson"), YM_REPORT_BUDGET: "10", YM_REPORT_WAIT_MS: "10", YM_REPORT_TIMEOUT_MS: "50",
  });
  // Продьюсер «мягкий» (exit 0 даже на FAILED), поэтому читаем и stdout, и stderr.
  const r = spawnSync("npx", ["tsx", "src/scripts/ym/reports.ts", ...args], { env, encoding: "utf8", timeout: 120_000 });
  return `${r.stdout || ""}\n${r.stderr || ""}`;
}
const state = (dir: string) => JSON.parse(readFileSync(join(dir, "netting_state.json"), "utf8"));

describe("бэкфилл реестра переживает обрыв связи и таймаут", () => {
  it("обрыв на 7-м отчёте: 6 скачанных пар сохранены, схема записана, файл не потерял старые месяцы", () => {
    const d = seedNetting();
    const out = run(d, { failNth: 7, failKind: "fetch_failed" }, ["netting", "2026-02-01", "2026-10-10"]);
    expect(out).not.toMatch(/ym-reports FAILED/);
    const st = state(d);
    expect(st.schema).toBe(5);
    expect(st.months_done.filter((p: string) => p.startsWith("111/")).length).toBe(6);
    // обрыв по одному кабинету не лишает второй его доли бюджета
    expect(st.months_done.some((p: string) => p.startsWith("222/"))).toBe(true);
    const rows = readFileSync(join(d, "netting.ndjson"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    for (const b of BIZ) for (const ym of MONTHS) expect(rows.some((r) => r.business === b && r.d.startsWith(ym)), `${b}/${ym}`).toBe(true);
  }, 150_000);
  it("таймаут генерации на 7-м отчёте - тоже мягкая остановка", () => {
    const d = seedNetting();
    const out = run(d, { failNth: 7, failKind: "timeout_pending" }, ["netting", "2026-02-01", "2026-10-10"]);
    expect(out).not.toMatch(/ym-reports FAILED/);
    expect(state(d).schema).toBe(5);
  }, 150_000);
  it("битый сертификат - НЕ сбой связи: продьюсер падает громко, состояние не тронуто", () => {
    const d = seedNetting();
    const out = run(d, { failNth: 7, failKind: "tls_expired" }, ["netting", "2026-02-01", "2026-10-10"]);
    expect(out).toMatch(/ym-reports FAILED/);
    expect(state(d).schema).toBe(4);
  }, 150_000);
});
