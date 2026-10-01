import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ledgerFreshness, LEDGER_STALE_DAYS } from "./derive-lib.js";
import { yesterday, addDays } from "./common.js";

// Даты инжектируются: «вчера» передаётся параметром, на сегодня тесты функции не завязаны.
const net = (b: string, ...ds: string[]) => ds.map((d) => ({ business: b, d }));
const ALL_SEP = ["1023124/2026-09", "74986385/2026-09"];

describe("свежесть реестра платежей - гибрид (тревога конца прогона)", () => {
  it("предел 2 дня", () => expect(LEDGER_STALE_DAYS).toBe(2));

  it("прогон 29.09 как был: 1023124 по 27.09, сентябрь не собран - красный в первый же день", () => {
    const r = ledgerFreshness([...net("1023124", "2026-09-27"), ...net("74986385", "2026-09-28")], ["1023124", "74986385"], "2026-09-28", ["1023124/2026-03", "74986385/2026-09"]);
    expect(r.map((x) => [x.business, x.lag, x.month_done, x.stale])).toEqual([["1023124", 1, false, true], ["74986385", 0, true, false]]);
  });

  it("прогон 30.09 как был: оба по 29.09, все месяцы собраны - зелёный", () => {
    const r = ledgerFreshness([...net("1023124", "2026-09-29"), ...net("74986385", "2026-09-29")], ["1023124", "74986385"], "2026-09-29", ALL_SEP);
    expect(r.every((x) => !x.stale && x.lag === 0)).toBe(true);
  });

  it("отставание 1 при собранном месяце (тихий день) - не тревога", () => {
    expect(ledgerFreshness(net("1023124", "2026-09-28"), ["1023124"], "2026-09-29", ALL_SEP)[0]).toMatchObject({ lag: 1, stale: false });
  });

  it("отставание 2 - тревога даже при собранном месяце; граница месяца считается в днях", () => {
    expect(ledgerFreshness(net("1023124", "2026-08-30"), ["1023124"], "2026-09-01", ["1023124/2026-09"])[0]).toMatchObject({ lag: 2, stale: true });
  });

  it("настроенный кабинет без строк реестра - тревога", () => {
    expect(ledgerFreshness(net("1023124", "2026-09-29"), ["1023124", "74986385"], "2026-09-29", ALL_SEP).find((x) => x.business === "74986385")).toMatchObject({ ledger_to: null, stale: true });
  });

  it("кабинет есть в реестре, но убран из настроек - не проверяется", () => {
    expect(ledgerFreshness([...net("1023124", "2026-09-29"), ...net("999", "2026-05-01")], ["1023124"], "2026-09-29", ALL_SEP).map((x) => x.business)).toEqual(["1023124"]);
  });

  it("строка с датой из будущего не гасит тревогу", () => {
    const r = ledgerFreshness(net("1023124", "2026-09-20", "2026-12-01"), ["1023124"], "2026-09-29", ALL_SEP)[0];
    expect(r).toMatchObject({ lag: -63, stale: true });
  });

  it("строка с битой датой не гасит тревогу (NaN)", () => {
    const r = ledgerFreshness(net("1023124", "2026-09-20", "2026-28-09"), ["1023124"], "2026-09-29", ALL_SEP)[0];
    expect(r).toMatchObject({ lag: null, stale: true });
  });
});

// Сам скрипт: код выхода. Даты от настоящего «вчера», потому что скрипт берёт его из часов.
describe("ym:ledger-fresh - код выхода", () => {
  const run = (rows: Array<{ business: string; d: string }>, done: string[]) => {
    const dir = mkdtempSync(join(tmpdir(), "ym-lf-"));
    writeFileSync(join(dir, "netting.ndjson"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    writeFileSync(join(dir, "netting_state.json"), JSON.stringify({ months_done: done }));
    return spawnSync("npx", ["tsx", "src/scripts/ym/ledger-fresh.ts"], { env: { ...process.env, YM_DATA_DIR: dir, YM_BUSINESS_IDS: "1,2" }, encoding: "utf-8" });
  };
  const y = yesterday(), m = y.slice(0, 7);
  it("свежий реестр - 0", () => {
    expect(run([{ business: "1", d: y }, { business: "2", d: y }], [`1/${m}`, `2/${m}`]).status).toBe(0);
  }, 30000);
  it("застрявший кабинет - 1 и ::error:: с номером кабинета", () => {
    const p = run([{ business: "1", d: y }, { business: "2", d: addDays(y, -2) }], [`1/${m}`, `2/${m}`]);
    expect(p.status).toBe(1);
    expect(p.stderr).toMatch(/::error::реестр платежей кабинета 2 застрял/);
  }, 30000);
});
