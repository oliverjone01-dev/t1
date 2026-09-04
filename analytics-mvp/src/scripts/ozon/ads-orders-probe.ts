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
  const cpo = camps.filter((c) => /за заказ/i.test(c.paymentType || "") || /CPO/i.test(c.paymentType || ""));
  console.log(`Кампаний ${camps.length}; CPO ${cpo.length}. paymentType-ы: ${JSON.stringify([...new Set(camps.map((c) => c.paymentType))])}`);
  // Берём несколько CPO-кампаний (или все, если API отчёта по заказам агрегирует по всем).
  const pick = (cpo.length ? cpo : camps).slice(0, 5).map((c) => c.id);
  console.log(`Пробую отчёт по заказам для кампаний: ${pick.join(", ")} за ${from}..${to}`);

  let uuid = "";
  try { uuid = await perf.requestOrders(pick, from, to); }
  catch (e) { console.error("requestOrders ОШИБКА (вероятно неверный путь/тело):", (e as Error).message); return; }
  console.log("UUID отчёта:", uuid || "(пусто)");
  if (!uuid) return;

  let st = "";
  for (let i = 0; i < 40; i++) {
    try { const s = await perf.statisticsState(uuid); st = String(s.state ?? JSON.stringify(s)); } catch (e) { console.error("state ОШИБКА:", (e as Error).message); }
    console.log(`  state[${i}]: ${st}`);
    if (/\b(ok|done|success|ready)\b/i.test(st)) break;
    if (/\b(error|fail)\b/i.test(st)) { console.error("отчёт в ошибке"); return; }
    await sleep(5000);
  }

  let text = "";
  try { text = await perf.downloadStatistics(uuid); } catch (e) { console.error("download ОШИБКА:", (e as Error).message); return; }
  console.log(`\n=== СЫРОЙ ОТЧЁТ ПО ЗАКАЗАМ (первые 40 строк / 3000 символов) ===`);
  const lines = text.split(/\r?\n/).slice(0, 40);
  console.log(lines.join("\n").slice(0, 3000));
  console.log(`\n=== всего символов: ${text.length}, строк: ${text.split(/\r?\n/).length} ===`);
}

main().catch((e) => { console.error("ads-orders-probe FAILED:", (e as Error).message); process.exit(0); });
