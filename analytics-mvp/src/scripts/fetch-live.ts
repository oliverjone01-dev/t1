// СТРАЖ СНИМКОВ (без сети). Раньше тянул живые данные из n8n-вебхуков; после миграции на
// прямые клиенты OZON (src/scripts/ozon/*) снимки кладёт ночной ozon-snapshots.yml и коммитит
// в data/. Деплою больше НЕ нужно ходить в n8n - он собирает из закоммиченных снимков.
// Этот скрипт лишь проверяет, что нужные снимки на месте и непустые, и логирует их свежесть.
// Сборку НЕ валит из-за устаревания (мягкий страж): отсутствие файла - ошибка, старость - warning.
import { existsSync, readFileSync } from "node:fs";

const REQUIRED = [
  "ads_30d.json",
  "ads_periods.json",
  "skus_live_30d.json",
  "pnl_30d.json",
  "pnl_sku_30d.json",
];

// Берём конец окна снимка (где он есть) и сравниваем с вчера - мягкая отметка устаревания.
function snapshotEnd(j: any): string | null {
  if (!j || typeof j !== "object") return null;
  return (j.dateTo || j.generated_at?.slice(0, 10) || (j.p30 && j.p30.dateTo) || null) as string | null;
}

function daysOld(to: string | null): number | null {
  if (!to) return null;
  const t = new Date(`${to}T00:00:00Z`).getTime();
  const now = new Date();
  const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  y.setUTCDate(y.getUTCDate() - 1);
  return Math.round((y.getTime() - t) / 86400000);
}

function main() {
  let missing = 0;
  for (const f of REQUIRED) {
    const path = `data/${f}`;
    if (!existsSync(path)) {
      console.error(`::error::снимок отсутствует: ${path} (ожидается от ozon-snapshots.yml)`);
      missing++;
      continue;
    }
    let j: any;
    try {
      j = JSON.parse(readFileSync(path, "utf-8"));
    } catch (e) {
      console.error(`::error::снимок повреждён: ${path}: ${(e as Error).message}`);
      missing++;
      continue;
    }
    if (!j || (typeof j === "object" && Object.keys(j).length === 0)) {
      console.error(`::error::снимок пуст: ${path}`);
      missing++;
      continue;
    }
    const end = snapshotEnd(j);
    const n = daysOld(end);
    const fresh = n == null ? "дата окна неизвестна" : n <= 1 ? `свежий (${end})` : `устарел на ${n} дн (${end})`;
    if (n != null && n >= 2) console.log(`::warning::снимок ${f} ${fresh} - проверь ночной синк ozon-snapshots.yml`);
    console.log(`OK   ${f}: ${fresh}`);
  }
  if (missing) {
    console.error(`Нет ${missing} обязательных снимков в data/. Запусти ozon-snapshots.yml (прямой OZON).`);
    process.exit(1);
  }
  console.log("Все снимки на месте. Сборка идёт из закоммиченных данных (без n8n).");
}

main();
