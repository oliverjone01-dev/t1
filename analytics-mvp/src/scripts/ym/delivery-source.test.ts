import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { deliverySource, deliveryHealthHtml } from "./delivery-source.js";

describe("nonblocking Market delivery source", () => {
  it("retains verified stale data, labels errors, excludes damaged snapshots and recovers", () => {
    const root = mkdtempSync(`${tmpdir()}/ym-delivery-`);
    try {
      const dir = `${root}/data`; mkdirSync(dir);
      const fixture = `${root}/legacy.csv`;
      const csv = readFileSync("fixtures/delivery_ym.csv", "utf8");
      writeFileSync(fixture, csv);
      expect(deliverySource(dir, fixture)).toMatchObject({text: csv, loaded_at: null});
      expect(deliveryHealthHtml(dir, fixture)).toContain("историческая ведомость");
      writeFileSync(`${dir}/delivery.csv`, csv);
      expect(deliverySource(dir, fixture).text).toBe("");
      const valid = { schema: 1, platform: "ym", loaded_at: new Date().toISOString(), through: "2026-11-08", csv_sha256: createHash("sha256").update(csv).digest("hex") };
      const state = (patch = {}) => writeFileSync(`${dir}/delivery_source.json`, JSON.stringify({...valid, ...patch}));
      state();
      expect(deliverySource(dir, fixture)).toMatchObject({text: csv, warning: ""});
      expect(deliveryHealthHtml(dir, fixture)).toBe("");
      state({loaded_at: new Date(Date.now() - 72 * 3600_000).toISOString()});
      expect(deliverySource(dir, fixture).text).toBe(csv);
      expect(deliveryHealthHtml(dir, fixture)).toContain("старше 36 часов");
      state();
      writeFileSync(`${dir}/delivery_refresh.json`, JSON.stringify({status: "error", reason: '<script>SECRET</script>'}));
      const html = deliveryHealthHtml(dir, fixture);
      expect(html).toContain("Прибыль предварительная");
      expect(html).toContain("2026-11-08");
      expect(html).not.toContain("<script>");
      expect(deliverySource(dir, fixture).text).toBe(csv);
      writeFileSync(`${dir}/delivery_refresh.json`, JSON.stringify({status: "ok"}));
      expect(deliveryHealthHtml(dir, fixture)).toBe("");
      state({source_issues: [{order: "1", shipped: "", status: "Доставлен", ship: null, reason: "нет даты"}]});
      expect(deliveryHealthHtml(dir, fixture)).toContain("незаполненные данные");
      state({source_counts: {active: {missing_cost_rows: 1}}});
      expect(deliveryHealthHtml(dir, fixture)).toContain("без суммы доставки");
      for (const broken of [{source_issues: {a: 1}}, {source_issues: [null]}, {through: {a: 1}}, {source_counts: {active: null}}]) {
        state(broken);
        expect(deliverySource(dir, fixture).text).toBe("");
        expect(deliveryHealthHtml(dir, fixture)).toContain("не прошла проверку");
      }
      state();
      unlinkSync(`${dir}/delivery.csv`);
      expect(deliverySource(dir, fixture).text).toBe("");
      writeFileSync(`${dir}/delivery.csv`, "damaged");
      expect(deliverySource(dir, fixture).text).toBe("");
      expect(deliveryHealthHtml(dir, fixture)).toContain("не включены в расчёт");
      unlinkSync(`${dir}/delivery.csv`); unlinkSync(`${dir}/delivery_source.json`); unlinkSync(fixture);
      expect(deliverySource(dir, fixture).text).toBe("");
      expect(deliveryHealthHtml(dir, fixture)).toContain("нет подтверждённой загрузки");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
