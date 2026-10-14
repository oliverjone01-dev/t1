// «Оплата за заказ» (CPO) по дате заказа - одна функция для «Отчета» и вкладки «Реклама по карточкам»
// (Иван 13.10: «все да» - одна метрика на двух вкладках, источник как у «Отчета»).
// Вход: data/cpo_orders.ndjson (ручная выгрузка кабинета: номер заказа и списание), data/orders_daily.ndjson
// (отправления Seller API), data/cpo_sku_daily.ndjson (покрытие выгрузки по датам).
// День = самая ранняя дата отправлений заказа в orders_daily, не первая по порядку файла (ФЕНИКС O3 13.10). Выручка и штуки = отправления заказа без отменённых.
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
    const d0 = ps.reduce((m, p) => (String(p.d) < m ? String(p.d) : m), String(ps[0].d));
    const a = (day[d0] ||= { sp: 0, rev: 0, units: 0 });
    a.sp += Number(r.sp) || 0;
    for (const p of ps) if (p.status !== "cancelled") { a.rev += Number(p.revenue) || 0; a.units += Number(p.units) || 0; }
  }
  let from = "", to = "";
  for (const r of readNd(dp("cpo_sku_daily.ndjson"))) { const d = String(r.d); if (!from || d < from) from = d; if (d > to) to = d; }
  return { day, miss, from, to };
}

// Чья это выгрузка (ФЕНИКС N5, N8 13.10): только кампании «Оплата за заказ» (camp_meta.instr), ближайшая по расходу API
// за дни выгрузки к списаниям выгрузки. Кандидатов нет или разница больше допуска (1% списаний) - отказ сборки:
// выручка выгрузки не должна молча сесть на чужую кампанию (раньше без 28753239 выбиралась CPC-кампания).
export function cpoCampaign(spById: Record<string, number>, instrById: Record<string, string>, total: number, tol = 0.01): { id: string; sp: number } {
  let id = "", sp = 0;
  for (const [k, v] of Object.entries(spById)) {
    if (!/за заказ/i.test(instrById[k] || "")) continue;
    if (!id || Math.abs(v - total) < Math.abs(sp - total)) { id = k; sp = v; }
  }
  if (!id) throw new Error(`«Оплата за заказ»: среди кампаний с расходом в днях выгрузки нет кампании «за заказ» (списаний выгрузки ${Math.round(total)} ₽)`);
  if (Math.abs(sp - total) > tol * Math.abs(total)) throw new Error(`«Оплата за заказ»: расход API кампании ${id} ${Math.round(sp)} ₽ расходится со списаниями выгрузки ${Math.round(total)} ₽ больше чем на ${tol * 100}% - чья выгрузка, не ясно`);
  return { id, sp };
}

// Кампания выгрузки по данным сборки (одна на «Отчет» и вкладку «Реклама по карточкам»): расход API по кампаниям
// за дни выгрузки (ads_daily) и тип кампании (camp_meta снимков ads_30d и ads_periods). Нет выгрузки - пусто.
export function cpoExportCampaign(dp: (f: string) => string, co: { day: Record<string, CpoOrdersDay>; from: string; to: string }): { id: string; sp: number; total: number } {
  const total = Object.values(co.day).reduce((x, v) => x + v.sp, 0);
  if (!co.from) return { id: "", sp: 0, total };
  const byId: Record<string, number> = {}, instr: Record<string, string> = {};
  for (const r of readNd(dp("ads_daily.ndjson"))) if (r.d >= co.from && r.d <= co.to) byId[String(r.id)] = (byId[String(r.id)] || 0) + (Number(r.sp) || 0);
  const metas: any[] = [];
  try { metas.push(JSON.parse(readFileSync(dp("ads_30d.json"), "utf-8")).camp_meta); } catch { /* нет снимка */ }
  try { const ap = JSON.parse(readFileSync(dp("ads_periods.json"), "utf-8")); for (const k of Object.keys(ap)) metas.push(ap[k]?.camp_meta); } catch { /* нет снимка */ }
  for (const m of metas) for (const id in m || {}) if (!instr[id] && m[id]?.instr) instr[id] = String(m[id].instr);
  return { ...cpoCampaign(byId, instr, total), total };
}
