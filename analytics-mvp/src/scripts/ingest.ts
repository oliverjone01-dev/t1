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
const VIEWS = "data/sku_views.ndjson"; // полные показы SKU×день (включая дни без продажи) - для воронки по категориям

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

type ViewRow = { date: string; sku: string; name: string; line: string; views: number; cart: number; units: number; deliv: number; ret: number; canc: number };

// Полные показы по SKU×день: ВСЕ строки payload с любой активностью (показ/корзина/заказ/возврат),
// а не только дни-с-продажей. Идемпотентно: день из payload переписываем заново.
// Нужен для воронки по категориям, где показы должны считаться по всем дням, а не только в дни продаж.
function upsertViews(raw: RawRow[]): { rows: number } {
  const map = new Map<string, ViewRow>();
  if (existsSync(VIEWS)) {
    for (const l of readFileSync(VIEWS, "utf-8").split("\n").filter(Boolean)) {
      const r = JSON.parse(l) as ViewRow; map.set(r.date + "|" + r.sku, r);
    }
  }
  const touched = new Set<string>();
  for (const r of raw) {
    if (!r.date) continue;
    if (!touched.has(r.date)) { // чистим день перед перезаписью
      for (const k of [...map.keys()]) if (k.startsWith(r.date + "|")) map.delete(k);
      touched.add(r.date);
    }
    if (!((r.views || 0) > 0 || (r.cart || 0) > 0 || (r.units || 0) > 0 || (r.ret || 0) > 0 || (r.canc || 0) > 0)) continue;
    map.set(r.date + "|" + String(r.sku), {
      date: r.date, sku: String(r.sku), name: r.name || "", line: lineOf(r.name || ""),
      views: r.views || 0, cart: r.cart || 0, units: r.units || 0, deliv: r.deliv || 0, ret: r.ret || 0, canc: r.canc || 0,
    });
  }
  const keys = [...map.keys()].sort();
  mkdirSync(dirname(VIEWS), { recursive: true });
  writeFileSync(VIEWS, keys.map((k) => JSON.stringify(map.get(k))).join("\n") + "\n");
  return { rows: keys.length };
}

function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Укажи путь к payload.json: npm run ingest -- <file>");
  const payload = JSON.parse(readFileSync(path, "utf-8")) as { rows: RawRow[] };
  const raw = payload.rows || [];

  // 1) дневные тоталы из ВСЕХ строк (полные показы/возвраты)
  const tot = upsertTotals(raw);
  // 1b) полные показы по SKU×день (для воронки по категориям)
  const vw = upsertViews(raw);

  // 2) per-SKU история - дни с продажей ЛИБО с возвратом/отменой (компактно, для разрезов по товарам).
  // Раньше держали только дни-с-продажей -> строки-возвраты в дни без продажи выпадали,
  // и возвраты/отмены в разрезе категорий недосчитывались против тотала канала (2 вместо 7).
  const mapped: SkuDaily[] = raw
    .filter((r) => (r.rev || 0) > 0 || (r.units || 0) > 0 || (r.ret || 0) > 0 || (r.canc || 0) > 0)
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
  console.log(`Ингест: payload ${raw.length} строк. Тоталы: +${tot.days} дн (всего ${tot.total}). История(продажи) ${before}->${after}. Показы SKU×день: ${vw.rows}.`);
  console.log(`Даты: ${dates[0]}..${dates[dates.length - 1]} (${dates.length} дней)`);
  store.close();
}

main();
