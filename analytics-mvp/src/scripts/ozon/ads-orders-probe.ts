// PROBE: «Отчёт по заказам» продвижения OZON - заказы по SKU за период, включая CPO
// («оплата за заказ»), которых нет в attribution-отчёте. Цель: подтвердить эндпоинт, формат и
// покрытие (особенно CPO), прежде чем строить сборщик. НЕ в ночном синке.
// Запуск: tsx ads-orders-probe.ts [YYYY-MM-01] [YYYY-MM-31]
import { OzonPerformance } from "../../connector/ozon-performance.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const clientId = process.env.OZON_PERF_CLIENT_ID || "", clientSecret = process.env.OZON_PERF_SECRET || "";
  if (!clientId || !clientSecret) { console.warn("ads-orders-probe: OZON_PERF_* нет - пропуск"); return; }
  const from = process.argv[2] || "2026-08-01", to = process.argv[3] || "2026-08-31";
  const perf = new OzonPerformance({ clientId, clientSecret });

  const camps = await perf.campaigns();
  const pay: Record<string, string> = {}; for (const c of camps) pay[c.id] = c.paymentType || "?";
  // Ранжируем по расходу за период (dailyStats), чтобы взять реально работавшие кампании.
  const stats = await perf.dailyStats(camps.map((c) => c.id), from, to);
  const spend: Record<string, number> = {}; for (const r of stats) spend[String((r as any).id)] = (spend[String((r as any).id)] || 0) + ((r as any).spent || 0);
  const ranked = Object.keys(spend).filter((id) => spend[id]! > 0).sort((a, b) => spend[b]! - spend[a]!);
  const topCPO = ranked.filter((id) => /за заказ|CPO/i.test(pay[id] || ""));
  const topCPC = ranked.filter((id) => /CPC|клик/i.test(pay[id] || ""));
  console.log(`Кампаний ${camps.length}; работавших ${ranked.length}. paymentType-ы: ${JSON.stringify([...new Set(camps.map((c) => c.paymentType))])}`);
  console.log(`ТОП CPO: ${topCPO.slice(0, 3).map((id) => id + "(" + Math.round(spend[id]!) + "₽)").join(", ")}`);
  console.log(`ТОП CPC: ${topCPC.slice(0, 3).map((id) => id + "(" + Math.round(spend[id]!) + "₽)").join(", ")}`);

  async function tryOrders(label: string, ids: string[], f = from, t = to) {
    console.log(`\n--- ${label}: кампании [${ids.join(", ") || "ВСЕ (без фильтра)"}] ${f}..${t} ---`);
    let uuid = "";
    try { uuid = await perf.requestOrders(ids, f, t); }
    catch (e) { console.error("  requestOrders ОШИБКА:", (e as Error).message); return; }
    if (!uuid) { console.log("  UUID пустой"); return; }
    let st = "";
    for (let i = 0; i < 40; i++) {
      try { st = String((await perf.statisticsState(uuid)).state ?? ""); } catch (e) { console.error("  state ОШИБКА:", (e as Error).message); return; }
      if (/\b(ok|done|success|ready)\b/i.test(st)) break;
      if (/\b(error|fail)\b/i.test(st)) { console.error("  отчёт в ошибке:", st); return; }
      await sleep(4000);
    }
    let text = ""; try { text = await perf.downloadStatistics(uuid); } catch (e) { console.error("  download ОШИБКА:", (e as Error).message); return; }
    try {
      const j = JSON.parse(text);
      const rows = j.rows || j.result || [];
      console.log(`  rows: ${rows.length}, overExpenses: ${j.overExpenses}`);
      if (rows.length) { console.log("  КЛЮЧИ строки:", Object.keys(rows[0]).join(", ")); console.log("  ПРИМЕР строки:", JSON.stringify(rows[0]).slice(0, 600)); }
    } catch { console.log("  не-JSON, первые 500 симв:", text.slice(0, 500)); }
  }

  if (topCPO.length) await tryOrders("CPO топ-1", [topCPO[0]!]);
  if (topCPC.length) await tryOrders("CPC топ-1", [topCPC[0]!]);
  await tryOrders("ВСЕ кампании (без фильтра)", []);
  // Свежее окно на случай, если август за пределами отчёта по заказам.
  const from2 = new Date(Date.parse(to) - 29 * 864e5).toISOString().slice(0, 10);
  if (topCPO.length) await tryOrders(`CPO топ-1 (свежее окно)`, [topCPO[0]!], from2, to);
}

main().catch((e) => { console.error("ads-orders-probe FAILED:", (e as Error).message); process.exit(0); });
