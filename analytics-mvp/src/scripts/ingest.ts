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
const TOTALS = "data/daily_totals.ndjson";

interface RawRow {
  date: string; sku: string; name: string;
  rev: number; units: number; views: number; cart: number;
  deliv: number; ret: number; canc: number;
}

type DayTot = { date: string; revenue: number; units: number; views: number; to_cart: number; delivered: number; returns: number; cancellations: number };

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

// Дневные тоталы канала (показы/корзина/заказы/доставка/возвраты/отмены) - из ВСЕХ строк payload,
// чтобы конверсия и возвраты считались по полным показам, а не только по дням-с-продажей.
// Хранятся отдельно (1 строка/день), per-SKU история остаётся компактной (только продажи).
function upsertTotals(raw: RawRow[]): { days: number; total: number } {
  const map = new Map<string, DayTot>();
  if (existsSync(TOTALS)) {
    for (const l of readFileSync(TOTALS, "utf-8").split("\n").filter(Boolean)) {
      const t = JSON.parse(l) as DayTot; map.set(t.date, t);
    }
  }
  const touched = new Set<string>();
  for (const r of raw) {
    if (!r.date) continue;
    if (!touched.has(r.date)) { // день из payload перезаписываем заново (идемпотентно)
      map.set(r.date, { date: r.date, revenue: 0, units: 0, views: 0, to_cart: 0, delivered: 0, returns: 0, cancellations: 0 });
      touched.add(r.date);
    }
    const t = map.get(r.date)!;
    t.revenue += r.rev || 0; t.units += r.units || 0; t.views += r.views || 0; t.to_cart += r.cart || 0;
    t.delivered += r.deliv || 0; t.returns += r.ret || 0; t.cancellations += r.canc || 0;
  }
  const dates = [...map.keys()].sort();
  mkdirSync(dirname(TOTALS), { recursive: true });
  writeFileSync(TOTALS, dates.map((d) => JSON.stringify(map.get(d))).join("\n") + "\n");
  return { days: touched.size, total: dates.length };
}

function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Укажи путь к payload.json: npm run ingest -- <file>");
  const payload = JSON.parse(readFileSync(path, "utf-8")) as { rows: RawRow[] };
  const raw = payload.rows || [];

  // 1) дневные тоталы из ВСЕХ строк (полные показы/возвраты)
  const tot = upsertTotals(raw);

  // 2) per-SKU история - только дни с продажей (компактно, для разрезов по товарам)
  const mapped: SkuDaily[] = raw
    .filter((r) => (r.rev || 0) > 0 || (r.units || 0) > 0)
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
  const dates = [...new Set(raw.map((r) => r.date))].sort();
  console.log(`Ингест: payload ${raw.length} строк. Тоталы: +${tot.days} дн (всего ${tot.total}). История(продажи) ${before}->${after}.`);
  console.log(`Даты: ${dates[0]}..${dates[dates.length - 1]} (${dates.length} дней)`);
  store.close();
}

main();
