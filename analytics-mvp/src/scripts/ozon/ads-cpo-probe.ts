// PROBE: полнота рекламных данных Performance API. Перечисляет ВСЕ кампании по типам оплаты,
// суммирует расход за месяц по ВСЕМ кампаниям и сверяет с финансовой цифрой рекламы (adv из
// pnl_account_daily). Цель: доказать, что CPO («оплата за заказ») и прочая реклама доступны
// целиком (а текущие 23% - это пробел сбора, т.к. брали только топ-спенд). НЕ в ночном синке.
// Запуск: tsx ads-cpo-probe.ts [YYYY-MM-01] [YYYY-MM-31]
import { OzonPerformance } from "../../connector/ozon-performance.js";

async function main() {
  const clientId = process.env.OZON_PERF_CLIENT_ID || "", clientSecret = process.env.OZON_PERF_SECRET || "";
  if (!clientId || !clientSecret) { console.warn("ads-cpo-probe: OZON_PERF_* нет - пропуск"); return; }
  const from = process.argv[2] || "2026-08-01", to = process.argv[3] || "2026-08-31";
  const perf = new OzonPerformance({ clientId, clientSecret });

  const camps = await perf.campaigns();
  console.log(`Всего кампаний: ${camps.length}`);
  const byPay: Record<string, number> = {}, byObj: Record<string, number> = {};
  for (const c of camps) { byPay[c.paymentType || "?"] = (byPay[c.paymentType || "?"] || 0) + 1; byObj[c.advObjectType || "?"] = (byObj[c.advObjectType || "?"] || 0) + 1; }
  console.log("по paymentType:", JSON.stringify(byPay));
  console.log("по advObjectType:", JSON.stringify(byObj));

  const pay: Record<string, string> = {}; for (const c of camps) pay[c.id] = c.paymentType || "?";
  const ids = camps.map((c) => c.id);
  console.log(`\nТяну dailyStats по ВСЕМ ${ids.length} кампаниям ${from}..${to}...`);
  const stats = await perf.dailyStats(ids, from, to);
  let total = 0; const byPaySpend: Record<string, number> = {};
  for (const r of stats) { const s = (r as any).spent || 0; total += s; const p = pay[(r as any).id] || "?"; byPaySpend[p] = (byPaySpend[p] || 0) + s; }
  console.log(`Строк статистики: ${stats.length}`);
  console.log(`СУММАРНЫЙ РАСХОД по всем кампаниям = ${Math.round(total).toLocaleString("ru-RU")} ₽`);
  console.log("расход по paymentType:", Object.fromEntries(Object.entries(byPaySpend).map(([k, v]) => [k, Math.round(v)])));
  console.log("\nСверка: финансовая реклама (клик+CPO) за август по УПД/транзакциям ~ -2 311 309 ₽.");
  console.log("Если суммарный расход выше близок к 2,31 млн - значит по всем кампаниям (вкл. CPO) данные есть, надо просто собирать все, а не топ-спенд.");
}
main().catch((e) => { console.error("ads-cpo-probe FAILED:", (e as Error).message); process.exit(0); });
