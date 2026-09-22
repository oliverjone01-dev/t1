// Ежедневный снимок цен по артикулам -> data/prices_daily.ndjson (НАКОПИТЕЛЬНО).
// Строка: {d, offer, price, before, coinv}.
//   price  - цена, которую видит покупатель (marketing_seller_price, т.е. с акциями продавца);
//   before - цена продавца ДО акций (зачёркнутая);
//   coinv  - соинвест в процентах, (1 - price / before) * 100, округлён до 0.1.
//
// Зачем: соинвест - главная метрика A/B-тестов по рекламе (tools/tests/tests.json), но
// посуточного ряда по артикулам не было. Разовый срез кабинета (data/cur_prices.psv)
// ключован по product_id, а тесты живут по артикулам, и состыковать их нечем. Здесь ключ
// сразу offer_id, то есть артикул.
//
// ВАЖНО: история задним числом не восстанавливается. /v5/product/info/prices отдаёт только
// текущее состояние, поэтому ряд начинается с первого запуска. За день пишем один снимок:
// повторный запуск в те же сутки ничего не добавляет (идемпотентность по дате).
//
// Запуск: npm run prices:daily   (без OZON_SELLER_* не стартует)
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { OzonSeller } from "../../connector/ozon-seller.js";

const OUT = "data/prices_daily.ndjson";

export interface PriceRow { d: string; offer: string; price: number; before: number; coinv: number | null }

const pad = (n: number) => String(n).padStart(2, "0");
const today = (): string => { const d = new Date(); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

// Соинвест = доля скидки от цены до акций. Без обеих цен или при before <= price смысла нет:
// отдаём null, чтобы дашборд показал пробел, а не выдуманный ноль.
export function coinvOf(price: number | null, before: number | null): number | null {
  if (!price || !before || before <= 0 || price > before) return null;
  return Math.round((1 - price / before) * 1000) / 10;
}

// Чистое (без сети): строки коннектора -> записи дня. Вынесено ради теста.
export function priceRows(
  items: Array<{ offer_id: string; price: number | null; price_before: number | null }>,
  d: string,
): PriceRow[] {
  const out: PriceRow[] = [];
  for (const it of items) {
    const offer = String(it.offer_id || "").trim();
    if (!offer || !it.price || !it.price_before) continue;
    out.push({ d, offer, price: Math.round(it.price), before: Math.round(it.price_before), coinv: coinvOf(it.price, it.price_before) });
  }
  return out;
}

function hasDate(d: string): boolean {
  if (!existsSync(OUT)) return false;
  for (const l of readFileSync(OUT, "utf-8").trim().split("\n").filter(Boolean)) {
    try { if (JSON.parse(l).d === d) return true; } catch { /* битая строка - пропуск */ }
  }
  return false;
}

async function main() {
  const clientId = process.env.OZON_SELLER_CLIENT_ID || "", apiKey = process.env.OZON_SELLER_API_KEY || "";
  if (!clientId || !apiKey) { console.warn("prices-daily: OZON_SELLER_* нет - пропуск (снимок цен не обновлён)"); return; }
  const d = today();
  if (hasDate(d)) { console.log(`prices-daily: снимок за ${d} уже есть - пропуск`); return; }

  const seller = new OzonSeller({ clientId, apiKey });
  let items: Array<{ offer_id: string; price: number | null; price_before: number | null }>;
  try { items = await seller.prices(); }
  catch (e) { console.warn(`prices-daily: /v5/product/info/prices - ${(e as Error).message}`); return; }

  const rows = priceRows(items, d);
  if (!rows.length) { console.warn(`prices-daily: OZON вернул ${items.length} товаров, но ни у одного нет пары цен - ничего не пишем`); return; }
  appendFileSync(OUT, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const withCo = rows.filter((r) => r.coinv != null);
  const med = withCo.length ? [...withCo].sort((a, b) => (a.coinv! - b.coinv!))[Math.floor(withCo.length / 2)]!.coinv : null;
  console.log(`prices-daily: ${d} - ${rows.length} артикулов -> ${OUT}; соинвест посчитан у ${withCo.length}, медиана ${med ?? "-"} %`);
}

if (process.argv[1] && process.argv[1].endsWith("prices-daily.ts")) {
  main().catch((e) => { console.error("prices-daily:", (e as Error).message); process.exit(1); });
}
