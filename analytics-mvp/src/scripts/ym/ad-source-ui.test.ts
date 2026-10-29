import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("Market command center uses its own promotion snapshots and never OZON fixture campaigns", () => {
  const out = mkdtempSync(join(tmpdir(), "ym-ads-isolation-"));
  try {
    execFileSync("npx", ["tsx", "src/scripts/build-katya.ts"], {
      env: { ...process.env, PLATFORM: "ym", DATA_DIR: "data-ym", OUT_DIR: out },
      stdio: "pipe",
    });
    const html = readFileSync(join(out, "katya-command.html"), "utf8");
    const embedded = html.match(/const ADS=(.*?);const ADSP=(.*?);/);
    expect(embedded).not.toBeNull();
    expect(JSON.parse(embedded![1]!)).toEqual(JSON.parse(readFileSync("data-ym/ads_30d.json", "utf8")));
    expect(JSON.parse(embedded![2]!)).toEqual(JSON.parse(readFileSync("data-ym/ads_periods.json", "utf8")));
    expect(html).toContain("kpi('ДРР','н/д'");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}, 60_000);
