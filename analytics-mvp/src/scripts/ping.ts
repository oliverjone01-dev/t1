// S2: проверка боевой связи с OZON. Запуск: npm run ping (после заполнения .env).
// Делает по одному аутентифицированному вызову к каждому API и печатает срез.

import { loadEnv, required } from "../env.js";
import { OzonSeller } from "../connector/ozon-seller.js";
import { OzonPerformance } from "../connector/ozon-performance.js";
import { resolvePeriod } from "../period.js";

async function main() {
  loadEnv();
  const period = resolvePeriod({ question: "вчера" });
  console.log(`Период проверки: ${period.cur.from}..${period.cur.to}`);

  // Seller
  const seller = new OzonSeller({
    clientId: required("OZON_SELLER_CLIENT_ID"),
    apiKey: required("OZON_SELLER_API_KEY"),
  });
  const days = await seller.analytics(period.cur.from, period.cur.to, "day");
  console.log(`[Seller] analytics/data day -> строк: ${days.length}`);
  if (days[0]) console.log(`  пример метрик (в порядке ANALYTICS_METRICS): ${days[0].metrics.join(", ")}`);

  // Performance
  const perf = new OzonPerformance({
    clientId: required("OZON_PERF_CLIENT_ID"),
    clientSecret: required("OZON_PERF_CLIENT_SECRET"),
  });
  const camps = await perf.campaigns();
  console.log(`[Performance] кампаний: ${camps.length}`);

  console.log("OK: оба API отвечают, ключи рабочие.");
}

main().catch((e) => {
  console.error("Ошибка связи с OZON:", e.message);
  process.exit(1);
});
