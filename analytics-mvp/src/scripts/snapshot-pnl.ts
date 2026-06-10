// Нормализует сырой ответ pnl-вебхука в data/pnl_30d.json:
// группирует статьи services в категории сборов. Запуск: tsx snapshot-pnl.ts <raw.json>
import { readFileSync, writeFileSync } from "node:fs";
import { normalizePnl, type RawPnl } from "../util/pnl.js";

function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Укажи raw.json");
  const raw = JSON.parse(readFileSync(path, "utf-8")) as RawPnl;
  const out = normalizePnl(raw);
  writeFileSync("data/pnl_30d.json", JSON.stringify(out));
  console.log(`pnl_30d.json: выручка ${out.accruals}, к начислению ${out.payout}, статей ${Object.keys(out.breakdown).length}`);
}

main();
