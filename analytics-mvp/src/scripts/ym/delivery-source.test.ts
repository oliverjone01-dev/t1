import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { deliverySource } from "./delivery-source.js";

describe("saved Market delivery source", () => {
  it("prefers the bot snapshot, refuses inconsistent data and falls back only before first sync", () => {
    const root = mkdtempSync(`${tmpdir()}/ym-delivery-`);
    try {
      mkdirSync(`${root}/data`);
      const fixture = `${root}/legacy.csv`;
      writeFileSync(fixture, "legacy");
      expect(deliverySource(`${root}/data`, fixture)?.text).toBe("legacy");
      const csv = "order,ship\n62227988545,1000\n";
      writeFileSync(`${root}/data/delivery.csv`, csv);
      expect(() => deliverySource(`${root}/data`, fixture)).toThrow();
      writeFileSync(`${root}/data/delivery_source.json`, JSON.stringify({ schema: 1, platform: "ym", loaded_at: new Date().toISOString(), csv_sha256: createHash("sha256").update(csv).digest("hex") }));
      expect(deliverySource(`${root}/data`, fixture)?.text).toBe(csv);
      writeFileSync(`${root}/data/delivery.csv`, "damaged");
      expect(() => deliverySource(`${root}/data`, fixture)).toThrow(/mismatch/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
