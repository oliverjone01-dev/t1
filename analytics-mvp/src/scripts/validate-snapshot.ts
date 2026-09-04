// Санити-проверка снимка перед заменой фикстуры (FENIX G2/G3).
// Ловит: пустой/битый ответ вебхука, нулевые ключевые поля, обрезанный JSON.
// Запуск: tsx validate-snapshot.ts <type> <file>  (type: skus|ads|pnl|daily)
// Код выхода != 0 => снимок плохой, фикстуру НЕ заменять, job упасть.
import { readFileSync } from "node:fs";

const DROP_GATE = 0.4; // просадка ключевой метрики >40% относительно прошлого снимка = блок (FENIX G3)
// Минимум строк SKU в снимке. OZON: 10 (default). Маркет (SNAPSHOT_MIN_SKUS=1): каталог меньше, порог ниже.
const MIN_SKUS = Math.max(1, Number(process.env.SNAPSHOT_MIN_SKUS || 10) || 10);

function fail(msg: string): never {
  console.error(`SNAPSHOT INVALID: ${msg}`);
  process.exit(1);
}

// Ключевая метрика для дельта-гейта по типу снимка.
function keyMetric(type: string, d: any): { name: string; val: number } | null {
  switch (type) {
    case "skus": return { name: "totals.rev", val: Number(d?.totals?.rev) || 0 };
    case "ads": return { name: "totals.spend", val: Number(d?.totals?.spend) || 0 };
    case "pnl": return { name: "accruals", val: Number(d?.accruals) || 0 };
    case "pnlsku": return { name: "skuCount", val: d?.bySku ? Object.keys(d.bySku).length : 0 };
    case "daily": return { name: "rows", val: Array.isArray(d?.rows) ? d.rows.length : 0 };
    default: return null;
  }
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
      if (!Array.isArray(data.sku_table) || data.sku_table.length < MIN_SKUS) fail(`sku_table пустой/короткий (<${MIN_SKUS})`);
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
    case "pnlsku": {
      const n = data.bySku ? Object.keys(data.bySku).length : 0;
      if (n < MIN_SKUS) fail(`pnl-sku bySku пустой/короткий (<${MIN_SKUS})`);
      if (typeof data.skuCount === "number" && data.skuCount !== n) fail(`skuCount ${data.skuCount} != ключей ${n}`);
      break;
    }
    case "daily":
      if (!Array.isArray(data.rows)) fail("daily rows отсутствует");
      // пустой день (0 продаж) допустим - не фейлим, но печатаем
      break;
    default:
      fail(`неизвестный тип ${type}`);
  }

  // Дельта-гейт: сверка с прошлым снимком (4-й аргумент). Блокируем резкую просадку.
  const prevFile = process.argv[4];
  if (prevFile) {
    try {
      const prev = JSON.parse(readFileSync(prevFile, "utf-8"));
      const km = keyMetric(type, data), kp = keyMetric(type, prev);
      if (km && kp && kp.val > 0) {
        const drop = (kp.val - km.val) / kp.val;
        if (drop > DROP_GATE) fail(`дельта-гейт: ${km.name} упал ${Math.round(drop * 100)}% (${kp.val} -> ${km.val}) - похоже на частичные данные OZON, снимок НЕ заменяем`);
        console.log(`дельта-гейт ${km.name}: ${kp.val} -> ${km.val} (${drop >= 0 ? "-" : "+"}${Math.abs(Math.round(drop * 100))}%) ОК`);
      }
    } catch (e) {
      console.log(`дельта-гейт: прошлый снимок недоступен (${(e as Error).message}) - пропускаю`);
    }
  }
  console.log(`OK ${type}: ${file}`);
}

main();
