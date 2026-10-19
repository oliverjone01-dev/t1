// Does labelling the system day clear it? The only data-side action a human could take after the first system day.
// vMass with every 19.10 row no_site: true -> systemDays? (gap-daily.ts:80 siteMissing counts no_site as missing).
// Usage: CODE=<scratch>/code_30abf83/analytics-mvp S=<scratch> npx tsx probe_label.mts. Read-only.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const CODE = process.env.CODE!, S = process.env.S!;
const gd = await import(pathToFileURL(`${CODE}/src/scripts/gap-daily.ts`).href);
const rows = readFileSync(`${S}/pb/vMass/data/gap_daily.ndjson`, "utf-8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
const labelled = rows.map((r) => (String(r.date).startsWith("2026-10-19") ? { ...r, no_site: true } : r));
console.log(`vMass as is: systemDays=${JSON.stringify(gd.markNoSiteEx(rows).systemDays)}`);
console.log(`vMass + no_site on all ${labelled.filter((r) => r.no_site === true && String(r.date).startsWith("2026-10-19")).length} rows of 19.10: systemDays=${JSON.stringify(gd.markNoSiteEx(labelled).systemDays)}`);
