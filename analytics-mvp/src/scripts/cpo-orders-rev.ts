// «Оплата за заказ» (CPO) по дате заказа - одна функция для «Отчета» и вкладки «Реклама по карточкам»
// (Иван 13.10: «все да» - одна метрика на двух вкладках, источник как у «Отчета»).
// Вход: data/cpo_orders.ndjson (ручная выгрузка кабинета: номер заказа и списание), data/orders_daily.ndjson
// (отправления Seller API), data/cpo_sku_daily.ndjson (покрытие выгрузки по датам).
// День = дата первого отправления заказа в orders_daily. Выручка и штуки = отправления заказа без отменённых.
// Заказа нет в orders_daily - строка не учитывается (miss). Расход - списание по выгрузке, как есть.
import { readFileSync } from "node:fs";

const readNd = (p: string): any[] => {
  try { return readFileSync(p, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
};

export type CpoOrdersDay = { sp: number; rev: number; units: number };

export function cpoOrdersByDay(dp: (f: string) => string): { day: Record<string, CpoOrdersDay>; miss: number; from: string; to: string } {
  const postings: Record<string, any[]> = {};
  for (const r of readNd(dp("orders_daily.ndjson"))) { const o = String(r.order || ""); const k = o.slice(0, o.lastIndexOf("-")); (postings[k] ||= []).push(r); }
  const day: Record<string, CpoOrdersDay> = {};
  let miss = 0;
  for (const r of readNd(dp("cpo_orders.ndjson"))) {
    const ps = postings[String(r.order)]; if (!ps || !ps.length) { miss++; continue; }
    const a = (day[String(ps[0].d)] ||= { sp: 0, rev: 0, units: 0 });
    a.sp += Number(r.sp) || 0;
    for (const p of ps) if (p.status !== "cancelled") { a.rev += Number(p.revenue) || 0; a.units += Number(p.units) || 0; }
  }
  let from = "", to = "";
  for (const r of readNd(dp("cpo_sku_daily.ndjson"))) { const d = String(r.d); if (!from || d < from) from = d; if (d > to) to = d; }
  return { day, miss, from, to };
}
