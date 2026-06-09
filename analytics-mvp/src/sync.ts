// Оркестратор бэкфилла и ежедневного синка (S3).
// Идемпотентно: уже загруженные даты пропускаются (чекпойнт = сама БД).
// Источник за интерфейсом DataSource - тестируется без сети, на моке.

import type { Store } from "./store.js";
import type { SkuDaily } from "./types.js";
import { addDays } from "./period.js";

export interface DataSource {
  skuDaily(date: string): Promise<SkuDaily[]>;
}

// Все даты включительно от from до to.
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let d = from;
  while (d <= to) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

// Даты диапазона, по которым в БД ещё нет данных.
export function missingDates(store: Store, from: string, to: string): string[] {
  const have = new Set(store.distinctDates());
  return datesBetween(from, to).filter((d) => !have.has(d));
}

export interface BackfillOpts {
  pauseMs?: number; // пауза между днями, чтобы не злить лимиты OZON
  sleep?: (ms: number) => Promise<void>;
  onDay?: (date: string, rows: number) => void;
  refetchEmpty?: boolean; // перетягивать даты, по которым 0 строк (по умолч. нет)
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Загружает недостающие даты диапазона. Возвращает сводку.
export async function backfill(
  store: Store,
  src: DataSource,
  from: string,
  to: string,
  opts: BackfillOpts = {},
): Promise<{ days: number; rows: number; dates: string[] }> {
  const sleep = opts.sleep ?? realSleep;
  const pause = opts.pauseMs ?? 700;
  const todo = missingDates(store, from, to);
  let rows = 0;
  const done: string[] = [];
  for (let i = 0; i < todo.length; i++) {
    const date = todo[i]!;
    const dayRows = await src.skuDaily(date);
    if (dayRows.length === 0 && !opts.refetchEmpty) {
      // ниже пола данных или пустой день - помечаем якорной строкой, чтобы не дёргать повторно
      store.upsertSkuDaily([emptyAnchor(date)]);
    } else {
      store.upsertSkuDaily(dayRows);
    }
    rows += dayRows.length;
    done.push(date);
    opts.onDay?.(date, dayRows.length);
    if (i < todo.length - 1 && pause > 0) await sleep(pause);
  }
  return { days: done.length, rows, dates: done };
}

// Якорь для пустого дня (ниже пола / нет продаж): сам факт, что дату трогали.
function emptyAnchor(date: string): SkuDaily {
  return {
    date, sku: "__empty__", offer_id: null, name: "", line: "прочее",
    revenue: 0, units: 0, views: 0, to_cart: 0, delivered: 0, returns: 0, cancellations: 0,
  };
}
