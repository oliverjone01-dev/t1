// PROBE: какие метрики /v1/analytics/data принимает наш кабинет.
// Нужен, чтобы не зашивать в ночной сбор имя метрики «на веру». OZON отвергает весь запрос
// целиком, если хотя бы одна метрика неизвестна, поэтому проверяем по одной и печатаем
// вердикт. Позиция в поиске значится в метриках A/B-тестов (tools/tests/tests.json), но
// собирается сейчас только разовой выгрузкой кабинета.
//
// Запуск: npx tsx src/scripts/ozon/analytics-metrics-probe.ts [YYYY-MM-DD]
import { OzonSeller } from "../../connector/ozon-seller.js";

// Кандидаты на «позицию» плюс пара уже используемых метрик как контроль самого зонда:
// если и они не проходят, дело не в имени метрики, а в доступе или дате.
const CANDIDATES = [
  "hits_view_search",     // контроль: заведомо рабочая
  "position_category",
  "position_search",
  "avg_position",
  "search_position",
] as const;

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.error("probe: нет OZON_SELLER_CLIENT_ID / OZON_SELLER_API_KEY"); process.exit(1); }
  const d = process.argv[2] || new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const seller = new OzonSeller({ clientId, apiKey });
  console.log(`probe: /v1/analytics/data, dimension=sku, дата ${d}`);
  for (const m of CANDIDATES) {
    try {
      const rows = await seller.analyticsMetricsProbe(d, [m]);
      const sample = rows.slice(0, 3).map((r) => `${r.sku}:${r.value}`).join(", ");
      console.log(`  [ok]   ${m} - строк ${rows.length}${sample ? `, примеры ${sample}` : ""}`);
    } catch (e) {
      console.log(`  [нет]  ${m} - ${(e as Error).message.slice(0, 140)}`);
    }
  }
  console.log("Вывод: метрику со статусом [ok] можно добавлять в ночной сбор.");
}

main().catch((e) => { console.error("probe:", (e as Error).message); process.exit(1); });
