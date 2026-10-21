import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import type { DelivIssue } from "./delivery-lib.js";

// Network reads belong to the bot. Every builder uses the same saved snapshot.
export function deliverySource(dataDir = "data-ym", fixture = "fixtures/delivery_ym.csv"): { text: string; path: string; issues: DelivIssue[] } | null {
  const path = `${dataDir}/delivery.csv`;
  if (!existsSync(path)) return existsSync(fixture) ? { text: readFileSync(fixture, "utf8"), path: fixture, issues: [] } : null;
  const text = readFileSync(path, "utf8");
  const state = JSON.parse(readFileSync(`${dataDir}/delivery_source.json`, "utf8"));
  if (state.schema !== 1 || state.platform !== "ym" || !Number.isFinite(Date.parse(state.loaded_at)) ||
      state.csv_sha256 !== createHash("sha256").update(text).digest("hex")) {
    throw new Error("Market delivery snapshot/manifest mismatch; refresh delivery before building");
  }
  if (Date.now() - Date.parse(state.loaded_at) > 36 * 3600_000) console.warn(`::warning::ведомость нашей доставки прочитана ${state.loaded_at}, более 36 часов назад`);
  return { text, path, issues: state.source_issues || [] };
}
