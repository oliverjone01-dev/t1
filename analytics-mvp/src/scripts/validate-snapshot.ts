// Санити-проверка снимка перед заменой фикстуры (FENIX G2/G3).
// Ловит: пустой/битый ответ вебхука, нулевые ключевые поля, обрезанный JSON.
// Запуск: tsx validate-snapshot.ts <type> <file>  (type: skus|ads|pnl|daily)
// Код выхода != 0 => снимок плохой, фикстуру НЕ заменять, job упасть.
import { readFileSync } from "node:fs";

function fail(msg: string): never {
  console.error(`SNAPSHOT INVALID: ${msg}`);
  process.exit(1);
}

function main() {
  const type = process.argv[2];
  const file = process.argv[3];
  if (!type || !file) fail("usage: <type> <file>");

  let data: any;
  try {
    const raw = readFileSync(file, "utf-8");
    if (raw.trim().length < 2) fail(`пустой файл ${file}`);
    data = JSON.parse(raw);
  } catch (e) {
    fail(`не парсится JSON: ${(e as Error).message}`);
  }
  if (data && data.error) fail(`вебхук вернул ошибку: ${JSON.stringify(data.error)}`);

  switch (type) {
    case "skus":
      if (!Array.isArray(data.sku_table) || data.sku_table.length < 10) fail("sku_table пустой/короткий");
      if (!data.totals || !(data.totals.rev > 0)) fail("totals.rev не положителен");
      break;
    case "ads":
      if (!data.totals || !(data.totals.spend > 0)) fail("ads totals.spend не положителен");
      if (!Array.isArray(data.by_line)) fail("ads by_line отсутствует");
      break;
    case "pnl":
      if (!(data.accruals > 0)) fail("pnl accruals не положителен");
      if (!(data.payout > 0)) fail("pnl payout не положителен");
      break;
    case "pnlsku":
      if (!data.bySku || Object.keys(data.bySku).length < 10) fail("pnl-sku bySku пустой/короткий");
      break;
    case "daily":
      if (!Array.isArray(data.rows)) fail("daily rows отсутствует");
      // пустой день (0 продаж) допустим - не фейлим, но печатаем
      break;
    default:
      fail(`неизвестный тип ${type}`);
  }
  console.log(`OK ${type}: ${file}`);
}

main();
