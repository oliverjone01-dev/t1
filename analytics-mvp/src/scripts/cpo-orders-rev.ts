// «Оплата за заказ» (CPO) по дате заказа - одна функция для «Отчета» и вкладки «Реклама по карточкам»
// (Иван 13.10: «все да» - одна метрика на двух вкладках, источник как у «Отчета»).
// Вход: data/cpo_orders.ndjson (ручная выгрузка кабинета: номер заказа и списание), data/orders_daily.ndjson
// (отправления Seller API), data/cpo_sku_daily.ndjson (покрытие выгрузки по датам).
// День = самая ранняя дата отправлений заказа в orders_daily, не первая по порядку файла (ФЕНИКС O3 13.10). Выручка и штуки = отправления заказа без отменённых.
// Заказа нет в orders_daily - строка не учитывается (miss, missSp). Расход - списание по выгрузке, как есть; строки одного
// заказа (сборщик с 14.10 пишет строку на заказ и день) складываются. spAll - все списания выгрузки, с ненайденными.
import { readFileSync } from "node:fs";

// Нет файла - пусто; файл есть, но строка не разбирается - ошибка в bad (ФЕНИКС G2 14.10: раньше битый файл молча
// давал пустой ряд). Пишет в bad, а не роняет сборку: решение по ошибкам - в cpoExportCampaign.
const readNd = (p: string, bad?: string[]): any[] => {
  let txt: string;
  try { txt = readFileSync(p, "utf-8"); } catch { return []; }
  const out: any[] = [];
  txt.split("\n").forEach((l, i) => { if (!l.trim()) return; try { out.push(JSON.parse(l)); } catch { bad?.push(`${p.split("/").pop()}: строка ${i + 1} не разбирается`); } });
  return out;
};

export type CpoOrdersDay = { sp: number; rev: number; units: number };

export type CpoOrders = { day: Record<string, CpoOrdersDay>; miss: number; missSp: number; spAll: number; from: string; to: string; bad: string[] };

export function cpoOrdersByDay(dp: (f: string) => string): CpoOrders {
  const bad: string[] = [];
  const postings: Record<string, any[]> = {};
  for (const r of readNd(dp("orders_daily.ndjson"), bad)) { const o = String(r.order || ""); const k = o.slice(0, o.lastIndexOf("-")); (postings[k] ||= []).push(r); }
  const spBy: Record<string, number> = {};
  for (const r of readNd(dp("cpo_orders.ndjson"), bad)) { const o = String(r.order); spBy[o] = (spBy[o] || 0) + (Number(r.sp) || 0); }
  const day: Record<string, CpoOrdersDay> = {};
  let miss = 0, missSp = 0, spAll = 0;
  for (const [o, sp] of Object.entries(spBy)) {
    spAll += sp;
    const ps = postings[o]; if (!ps || !ps.length) { miss++; missSp += sp; continue; }
    const d0 = ps.reduce((m, p) => (String(p.d) < m ? String(p.d) : m), String(ps[0].d));
    const a = (day[d0] ||= { sp: 0, rev: 0, units: 0 });
    a.sp += sp;
    for (const p of ps) if (p.status !== "cancelled") { a.rev += Number(p.revenue) || 0; a.units += Number(p.units) || 0; }
  }
  let from = "", to = "";
  for (const r of readNd(dp("cpo_sku_daily.ndjson"), bad)) { const d = String(r.d || ""); if (!d) continue; if (!from || d < from) from = d; if (d > to) to = d; }
  return { day, miss, missSp, spAll, from, to, bad };
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
// Сборку не роняет (Иван 14.10, ФЕНИКС G3: падение сборки OZON останавливало публикацию всего сайта): при ошибке id пустой,
// err - текст для красной плашки на обеих страницах, выручка «за заказ» там - «нет данных». Проверки по порядку:
// файлы читаются (G2); есть списания, но нет покрытия cpo_sku_daily (G2); заказы выгрузки ещё не пришли в orders_daily
// (G1, свой текст); кампания «за заказ» с расходом API в допуске 1% от ВСЕХ списаний выгрузки (N8, G1).
export function cpoExportCampaign(dp: (f: string) => string, co: CpoOrders): { id: string; sp: number; total: number; err: string } {
  const total = co.spAll, R = (v: number) => Math.round(v).toLocaleString("ru-RU");
  const fail = (err: string) => ({ id: "", sp: 0, total, err: "«Оплата за заказ»: " + err });
  if (co.bad.length) return fail("файлы выгрузки не разбираются (" + co.bad.slice(0, 3).join("; ") + ")");
  if (!Math.round(total) && !co.from) return { id: "", sp: 0, total, err: "" };
  if (!co.from) return fail(`есть списания выгрузки ${R(total)} ₽, но покрытие (cpo_sku_daily) пустое - даты выгрузки неизвестны`);
  if (co.miss) return fail(`${co.miss} заказов выгрузки (${R(co.missSp)} ₽) ещё нет в отправлениях orders_daily - выручка неполная, ждём сбора заказов`);
  const byId: Record<string, number> = {}, instr: Record<string, string> = {};
  for (const r of readNd(dp("ads_daily.ndjson"))) if (r.d >= co.from && r.d <= co.to) byId[String(r.id)] = (byId[String(r.id)] || 0) + (Number(r.sp) || 0);
  const metas: any[] = [];
  try { metas.push(JSON.parse(readFileSync(dp("ads_30d.json"), "utf-8")).camp_meta); } catch { /* нет снимка */ }
  try { const ap = JSON.parse(readFileSync(dp("ads_periods.json"), "utf-8")); for (const k of Object.keys(ap)) metas.push(ap[k]?.camp_meta); } catch { /* нет снимка */ }
  for (const m of metas) for (const id in m || {}) if (!instr[id] && m[id]?.instr) instr[id] = String(m[id].instr);
  try { return { ...cpoCampaign(byId, instr, total), total, err: "" }; } catch (e) { return fail(String((e as Error).message).replace(/^«Оплата за заказ»: /, "")); }
}
