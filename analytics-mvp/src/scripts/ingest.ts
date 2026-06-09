// Ингест payload воркфлоу "Дневная история" в history.ndjson.
// Используется, когда сбор идёт через n8n (он держит ключи и ходит в OZON),
// а контейнер OZON не пускает. Запуск: npm run ingest -- <payload.json>
// payload = объект { dateFrom, dateTo, count, rows:[{date,sku,name,rev,units,views,cart,deliv,ret,canc}] }

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Store } from "../store.js";
import { lineOf } from "../util/line.js";
import type { SkuDaily } from "../types.js";

const SNAPSHOT = "data/history.ndjson";

interface RawRow {
  date: string; sku: string; name: string;
  rev: number; units: number; views: number; cart: number;
  deliv: number; ret: number; canc: number;
}

function loadSnapshot(store: Store): number {
  if (!existsSync(SNAPSHOT)) return 0;
  const rows = readFileSync(SNAPSHOT, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as SkuDaily);
  if (rows.length) store.upsertSkuDaily(rows);
  return rows.length;
}

function saveSnapshot(store: Store): number {
  const rows = store.allSkuDaily();
  mkdirSync(dirname(SNAPSHOT), { recursive: true });
  writeFileSync(SNAPSHOT, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return rows.length;
}

function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Укажи путь к payload.json: npm run ingest -- <file>");
  const payload = JSON.parse(readFileSync(path, "utf-8")) as { rows: RawRow[] };
  const raw = payload.rows || [];

  const mapped: SkuDaily[] = raw
    .filter((r) => (r.rev || 0) > 0 || (r.units || 0) > 0) // только строки с продажами
    .map((r) => ({
      date: r.date,
      sku: String(r.sku),
      offer_id: null,
      name: r.name || "",
      line: lineOf(r.name || ""),
      revenue: r.rev || 0,
      units: r.units || 0,
      views: r.views || 0,
      to_cart: r.cart || 0,
      delivered: r.deliv || 0,
      returns: r.ret || 0,
      cancellations: r.canc || 0,
    }));

  const store = new Store(":memory:");
  const before = loadSnapshot(store);
  store.upsertSkuDaily(mapped);
  const after = saveSnapshot(store);
  const dates = [...new Set(mapped.map((r) => r.date))].sort();
  console.log(`Ингест: payload ${raw.length} строк -> с продажами ${mapped.length}. Снапшот ${before} -> ${after}.`);
  console.log(`Даты: ${dates[0]}..${dates[dates.length - 1]} (${dates.length} дней)`);
  store.close();
}

main();
