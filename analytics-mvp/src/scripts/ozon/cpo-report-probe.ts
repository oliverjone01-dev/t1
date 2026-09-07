// PROBE: есть ли per-SKU / per-заказ расход по CPO-кампаниям («Оплата за заказ», Товарное
// продвижение) в публичном Performance API - тот отчёт, что в кабинете под «Скачать отчёт».
// Прогоняет активные CPO-кампании через ВСЕ report-эндпоинты и печатает, что реально отдаёт OZON:
//   1) async /api/client/statistics с разными groupBy (NO_GROUP_BY / DATE) -> UUID -> отчёт;
//   2) /api/client/statistics/daily/json (сырые поля) - есть ли разбивка;
//   3) /api/client/campaign/{id}/objects - какие SKU в кампании.
// НЕ в ночном синке. Запуск: tsx cpo-report-probe.ts [from] [to]. Разбор логов -> удалить.
import { OzonPerformance } from "../../connector/ozon-performance.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pollReport(perf: OzonPerformance, uuid: string): Promise<{ state: string; body: string }> {
  let state = "";
  for (let i = 0; i < 30; i++) {
    try { state = String((await perf.statisticsState(uuid)).state ?? ""); } catch (e) { return { state: "STATE_ERR: " + (e as Error).message, body: "" }; }
    if (/\b(ok|done|success|ready)\b/i.test(state)) break;
    if (/\b(error|fail)\b/i.test(state)) return { state, body: "" };
    await sleep(5000);
  }
  let body = "";
  try { body = await perf.downloadStatistics(uuid); } catch (e) { body = "DOWNLOAD_ERR: " + (e as Error).message; }
  return { state, body };
}

async function main() {
  const clientId = process.env.OZON_PERF_CLIENT_ID || "", clientSecret = process.env.OZON_PERF_SECRET || "";
  if (!clientId || !clientSecret) { console.warn("cpo-report-probe: OZON_PERF_* нет - пропуск"); return; }
  const from = process.argv[2] || "2026-09-01", to = process.argv[3] || "2026-09-07";
  const perf = new OzonPerformance({ clientId, clientSecret });

  const camps = await perf.campaigns();
  // CPO-кампании: paymentType CPO ИЛИ «оплата за заказ» / ALL_SKU_PROMO по объекту.
  const cpo = camps.filter((c) => /CPO/i.test(c.paymentType) || /ALL_SKU|PROMO/i.test(c.advObjectType));
  console.log(`Всего кампаний ${camps.length}, из них CPO/товарное продвижение: ${cpo.length}`);
  console.log("CPO-кампании (id · paymentType · advObjectType · state):");
  cpo.forEach((c) => console.log(`  ${c.id} · ${c.paymentType} · ${c.advObjectType} · ${c.state}`));

  // Берём до 3 CPO-кампаний (активные вперёд) для разведки отчётов.
  const pick = [...cpo.filter((c) => /RUNNING/i.test(c.state)), ...cpo.filter((c) => !/RUNNING/i.test(c.state))].slice(0, 3);
  console.log(`\nРазведка отчётов по ${pick.length} CPO-кампаниям, окно ${from}..${to}\n`);

  for (const c of pick) {
    console.log(`===== CPO-кампания ${c.id} (${c.state}) =====`);

    // (0) SKU кампании
    try { const objs = await perf.campaignObjects(c.id); console.log(`  objects (SKU): ${objs.length}${objs.length ? " · пример " + objs.slice(0, 5).join(",") : ""}`); }
    catch (e) { console.log("  objects ERR:", (e as Error).message); }

    // (1) daily/json сырые поля
    try { const raw = await perf.dailyStatsRaw([c.id], from, to); console.log(`  daily/json строк: ${raw.length}; поля: ${raw[0] ? Object.keys(raw[0]).join(",") : "-"}`); if (raw[0]) console.log("    строка[0]:", JSON.stringify(raw[0])); }
    catch (e) { console.log("  daily/json ERR:", (e as Error).message); }

    // (2) async statistics report, разные groupBy
    for (const gb of ["NO_GROUP_BY", "DATE"]) {
      try {
        const uuid = await perf.requestStatistics([c.id], from, to, gb);
        if (!uuid) { console.log(`  statistics[${gb}]: UUID пуст`); continue; }
        const { state, body } = await pollReport(perf, uuid);
        const head = (body || "").slice(0, 1500).replace(/\r/g, "");
        const firstLines = head.split("\n").slice(0, 6).join("\n    ");
        console.log(`  statistics[${gb}] state=${state} len=${(body || "").length}`);
        console.log(`    отчёт(первые строки):\n    ${firstLines || "<пусто>"}`);
      } catch (e) { console.log(`  statistics[${gb}] ERR:`, (e as Error).message); }
    }
    console.log("");
  }
  console.log("ВЫВОД: если в statistics[*] отчёте есть колонки с SKU + расход/заказы - CPO per-SKU доступен через API (строим авто-сбор).");
  console.log("Если все statistics по CPO -> 400/пусто, а daily/json даёт только уровень кампании - публичный API per-SKU для CPO не отдаёт (нужен ручной импорт отчёта из кабинета).");
}
main().catch((e) => { console.error("cpo-report-probe FAILED:", (e as Error).message); process.exit(0); });
