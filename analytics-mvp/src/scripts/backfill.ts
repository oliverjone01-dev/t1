// S3: бэкфилл/ежедневный синк дневной истории OZON.
// Запуск: npm run backfill [-- --from 2026-02-01 --to 2026-06-07]
// Персистентность - текстовый снапшот data/history.ndjson (коммитится в Git),
// SQLite используется как рабочий буфер в рамках запуска.
//
// ВНИМАНИЕ: боевой запуск должен идти там, где открыт интернет к OZON
// (GitHub Actions), мой контейнер OZON не пускает (сетевая политика).

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadEnv, required } from "../env.js";
import { Store } from "../store.js";
import { OzonSeller } from "../connector/ozon-seller.js";
import { backfill } from "../sync.js";
import { runDq } from "../dq.js";
import { fmt, addDays } from "../period.js";
import type { SkuDaily } from "../types.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const SNAPSHOT = "data/history.ndjson";

function loadSnapshot(store: Store): number {
  if (!existsSync(SNAPSHOT)) return 0;
  const lines = readFileSync(SNAPSHOT, "utf-8").split("\n").filter(Boolean);
  const rows = lines.map((l) => JSON.parse(l) as SkuDaily);
  if (rows.length) store.upsertSkuDaily(rows);
  return rows.length;
}

function saveSnapshot(store: Store): number {
  const rows = store.allSkuDaily();
  mkdirSync(dirname(SNAPSHOT), { recursive: true });
  writeFileSync(SNAPSHOT, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return rows.length;
}

async function main() {
  loadEnv();
  const floor = process.env.DATA_FLOOR || "2026-02-01";
  const from = arg("from") || floor;
  const to = arg("to") || addDays(fmt(new Date()), -1); // вчера

  const store = new Store(process.env.DB_PATH || "data/analytics.db");
  const loaded = loadSnapshot(store);
  console.log(`Снапшот: загружено ${loaded} строк. Синк ${from}..${to}`);

  const seller = new OzonSeller({
    clientId: required("OZON_SELLER_CLIENT_ID"),
    apiKey: required("OZON_SELLER_API_KEY"),
  });

  const res = await backfill(store, { skuDaily: (d) => seller.skuDaily(d) }, from, to, {
    onDay: (date, rows) => console.log(`  ${date}: ${rows} строк`),
  });
  console.log(`Загружено дней: ${res.days}, строк: ${res.rows}`);

  const saved = saveSnapshot(store);
  console.log(`Снапшот сохранён: ${saved} строк в ${SNAPSHOT}`);

  const dq = runDq(store, from, to);
  console.log("DQ:", JSON.stringify({ ok: dq.ok, freshness: dq.freshness.ok, gaps: dq.gaps.length, volumeDrop: dq.volumeDrop?.ok }));
  if (dq.volumeDrop && !dq.volumeDrop.ok) {
    // НЕ фатал: последний день ещё не устоялся (OZON досчитывает продажи с задержкой). Данные
    // всё равно коммитим - дашборд помечает такой день как «частичный». Иначе свежий день никогда
    // не попадёт в репозиторий и дашборд застрянет на пред-предыдущем дне.
    console.warn(`DQ warn: объём последнего дня ${dq.volumeDrop.date} = ${dq.volumeDrop.revenue} ниже медианы ${dq.volumeDrop.median} - вероятно ещё не устоялся. Коммитим, день частичный.`);
  }
  if (!dq.ok) {
    console.error("DQ провалена (fatal: нет свежего дня или дыры в датах):", JSON.stringify(dq, null, 2));
    process.exit(2);
  }
  store.close();
}

main().catch((e) => {
  console.error("Сбой синка:", e.message);
  process.exit(1);
});
