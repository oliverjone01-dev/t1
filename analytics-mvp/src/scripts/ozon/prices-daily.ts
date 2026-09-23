// Ежедневный снимок цен по артикулам -> data/prices_daily.ndjson (НАКОПИТЕЛЬНО).
// Строка: {d, offer, price, paid, before, coinv, coinv_paid}.
//   price      - цена на витрине (marketing_seller_price, акции продавца);
//   paid       - цена, которую платит покупатель с картой Ozon (marketing_price, все акции);
//   before     - предельная цена продавца (зачёркнутая);
//   coinv      - (1 - price / before) * 100, доля Ozon по витрине;
//   coinv_paid - (1 - paid / before) * 100, доля Ozon по тому, что реально заплатили.
//
// Считать надо по coinv_paid. Сверка с реестром начислений за август (data/payout_orders.ndjson,
// npm run coinv:calib) показала: соинвест по витрине занижает долю Ozon, потому что скидка по
// карте Ozon в витринную цену не входит, а платит её тоже Ozon. По витрине выходило 52.5 %,
// по цене с картой 57.2 %, факт 57.6 %.
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

export interface PriceRow {
  d: string; offer: string; price: number; paid: number | null; before: number;
  coinv: number | null; coinv_paid: number | null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const today = (): string => { const d = new Date(); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

// Соинвест = доля скидки от цены до акций. Без обеих цен или при before <= price смысла нет:
// отдаём null, чтобы дашборд показал пробел, а не выдуманный ноль.
export function coinvOf(price: number | null, before: number | null): number | null {
  if (!price || !before || before <= 0 || price > before) return null;
  return Math.round((1 - price / before) * 1000) / 10;
}

// Чистое (без сети): строки коннектора -> записи дня. Вынесено ради теста.
// Цена по карте может не прийти: тогда пишем пробел в paid и coinv_paid, а не подменяем их
// витриной. Подмена дала бы правдоподобное, но заниженное число, и его никто бы не заметил.
export function priceRows(
  items: Array<{ offer_id: string; price: number | null; price_paid?: number | null; price_before: number | null }>,
  d: string,
): PriceRow[] {
  const out: PriceRow[] = [];
  for (const it of items) {
    const offer = String(it.offer_id || "").trim();
    if (!offer || !it.price || !it.price_before) continue;
    const paid = it.price_paid && it.price_paid > 0 ? it.price_paid : null;
    out.push({
      d, offer,
      price: Math.round(it.price),
      paid: paid == null ? null : Math.round(paid),
      before: Math.round(it.price_before),
      coinv: coinvOf(it.price, it.price_before),
      coinv_paid: coinvOf(paid, it.price_before),
    });
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
  let items: Array<{ offer_id: string; price: number | null; price_paid: number | null; price_before: number | null }>;
  try { items = await seller.prices(); }
  catch (e) { console.warn(`prices-daily: /v5/product/info/prices - ${(e as Error).message}`); return; }

  const rows = priceRows(items, d);
  if (!rows.length) { console.warn(`prices-daily: OZON вернул ${items.length} товаров, но ни у одного нет пары цен - ничего не пишем`); return; }
  appendFileSync(OUT, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const medOf = (v: Array<number | null>): number | null => {
    const a = v.filter((x): x is number => x != null).sort((x, y) => x - y);
    return a.length ? a[Math.floor(a.length / 2)]! : null;
  };
  const paidN = rows.filter((r) => r.coinv_paid != null).length;
  console.log(`prices-daily: ${d} - ${rows.length} артикулов -> ${OUT}`);
  console.log(`  соинвест по витрине: медиана ${medOf(rows.map((r) => r.coinv)) ?? "-"} %`);
  console.log(`  соинвест по цене с картой: медиана ${medOf(rows.map((r) => r.coinv_paid)) ?? "-"} % (посчитан у ${paidN} из ${rows.length})`);
  // Молчащий пробел здесь дороже шумного: без цены по карте соинвест занижен на пять пунктов,
  // и заметить это можно только сверкой с начислениями раз в месяц.
  if (!paidN) console.warn("  ::warning:: цена по карте Ozon не пришла ни по одному артикулу - проверьте поле marketing_price в ответе");
}

if (process.argv[1] && process.argv[1].endsWith("prices-daily.ts")) {
  main().catch((e) => { console.error("prices-daily:", (e as Error).message); process.exit(1); });
}
