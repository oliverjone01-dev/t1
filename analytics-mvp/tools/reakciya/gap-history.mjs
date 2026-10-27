// Node 22.18+ / 24: built-in type stripping, no npm install needed by the Mac collector.
import { existsSync } from 'node:fs';
import { readGapDaily } from '../../src/scripts/gap-daily.ts';

const path = process.argv[2];
if (!path || !existsSync(path)) throw new Error('Missing gap_daily.ndjson');
const source = readGapDaily(path);
if (source.bad) throw new Error(`Invalid gap rows: ${source.bad}`);
const seen = new Set();
for (const row of source.rows) {
  const key = `${row.date}|${row.art}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      !Number.isFinite(Date.parse(`${row.date}T00:00:00Z`)) ||
      new Date(`${row.date}T00:00:00Z`).toISOString().slice(0, 10) !== row.date ||
      row.gap_pct < 0 || row.gap_pct > 100 || seen.has(key)) {
    throw new Error(`Invalid or duplicate gap key: ${key}`);
  }
  seen.add(key);
}
process.stdout.write(JSON.stringify({ rows: source.rows,
  excluded: { no_site: source.noSite, with_card: source.withOa },
  system_days: source.systemDays, manual: source.manual }));
