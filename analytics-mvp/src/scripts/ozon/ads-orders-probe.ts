// PROBE v3: «Отчёт по заказам» продвижения OZON. Перебираем варианты тела/дат, чтобы понять,
// при каких параметрах эндпоинт отдаёт строки заказов по SKU (и покрывает ли CPO). Дампим сырой
// ответ. НЕ в ночном синке. Запуск: tsx ads-orders-probe.ts
import { OzonPerformance } from "../../connector/ozon-performance.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const clientId = process.env.OZON_PERF_CLIENT_ID || "", clientSecret = process.env.OZON_PERF_SECRET || "";
  if (!clientId || !clientSecret) { console.warn("ads-orders-probe: OZON_PERF_* нет - пропуск"); return; }
  const perf = new OzonPerformance({ clientId, clientSecret });

  // Свежее окно (последние 30 дней) - там точно есть заказы.
  const to = ymd(new Date(Date.now() - 864e5)), from = ymd(new Date(Date.now() - 31 * 864e5));
  const camps = await perf.campaigns();
  const pay: Record<string, string> = {}; for (const c of camps) pay[c.id] = c.paymentType || "?";
  const stats = await perf.dailyStats(camps.map((c) => c.id), from, to);
  const spend: Record<string, number> = {}, ord: Record<string, number> = {};
  for (const r of stats) { const id = String((r as any).id); spend[id] = (spend[id] || 0) + ((r as any).spent || 0); ord[id] = (ord[id] || 0) + ((r as any).orders || 0); }
  const ranked = Object.keys(spend).filter((id) => spend[id]! > 0).sort((a, b) => spend[b]! - spend[a]!);
  const cpc = ranked.find((id) => /CPC|клик/i.test(pay[id] || "") && (ord[id] || 0) > 0) || ranked.find((id) => /CPC/i.test(pay[id] || "")) || ranked[0]!;
  const cpo = ranked.find((id) => /за заказ|CPO/i.test(pay[id] || "")) || "";
  console.log(`Окно ${from}..${to}. CPC-проба: ${cpc} (расход ${Math.round(spend[cpc]!)}, заказов ${ord[cpc] || 0}); CPO: ${cpo || "нет"}`);

  const PATH = "/api/client/statistics/orders/generate/json";
  async function gen(label: string, body: any) {
    console.log(`\n=== ${label} ===\n  POST ${PATH} body=${JSON.stringify(body)}`);
    let uuid = "";
    try { const d = await perf.rawPost(PATH, body); uuid = String(d.UUID ?? d.uuid ?? d.id ?? ""); console.log("  ответ generate:", JSON.stringify(d).slice(0, 200)); }
    catch (e) { console.error("  generate ОШИБКА:", (e as Error).message); return; }
    if (!uuid) return;
    let st = "";
    for (let i = 0; i < 40; i++) { try { st = String((await perf.statisticsState(uuid)).state ?? ""); } catch (e) { console.error("  state err:", (e as Error).message); return; } if (/\b(ok|done|success|ready)\b/i.test(st)) break; if (/\b(error|fail)\b/i.test(st)) { console.error("  state:", st); return; } await sleep(4000); }
    let text = ""; try { text = await perf.downloadStatistics(uuid); } catch (e) { console.error("  download err:", (e as Error).message); return; }
    console.log("  СЫРОЙ ОТВЕТ (первые 900):", text.slice(0, 900));
    try { const j = JSON.parse(text); const rows = j.rows || j.result || []; if (rows.length) console.log("  КЛЮЧИ строки:", Object.keys(rows[0]).join(", ")); } catch { /* не json */ }
  }

  await gen("V1 CPC from/to RFC3339", { campaigns: [cpc], from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.000Z` });
  await gen("V2 CPC from/to date-only", { campaigns: [cpc], from, to });
  await gen("V3 CPC dateFrom/dateTo date-only", { campaigns: [cpc], dateFrom: from, dateTo: to });
  await gen("V4 CPC from/to RFC3339 БЕЗ campaigns", { from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.000Z` });
  if (cpo) await gen("V5 CPO from/to RFC3339", { campaigns: [cpo], from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.000Z` });
}

main().catch((e) => { console.error("ads-orders-probe FAILED:", (e as Error).message); process.exit(0); });
