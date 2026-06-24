// Чистый парсер ответа публичного OZON composer-api (widget_state). Без сети - тестируется на фикстуре.
// OZON отдаёт страницу карточки как { widgetStates: { "<widgetName>-<id>-...": "<json-строка>" }, ... }.
// Имена виджетов несут динамический суффикс, поэтому матчим по ПРЕФИКСУ. Значения - JSON-строки.
//
// ВАЖНО (Protocol 9): цена/рейтинг/отзывы/наличие - это [ДАННЫЕ] (публичны на карточке).
// Заказы и выручка конкурента OZON НЕ отдаёт ни здесь, ни в Seller API -> только [ГИПОТЕЗА] (см. pilot.ts).

export interface CardData {
  sku: string;
  title: string | null;
  price: number | null; // текущая цена с картой Ozon (₽), [ДАННЫЕ]
  priceBase: number | null; // цена без карты/«старая» (₽), [ДАННЫЕ]
  rating: number | null; // средняя оценка 0..5, [ДАННЫЕ]
  reviews: number | null; // число отзывов, [ДАННЫЕ]
  stock: number | null; // «осталось N шт», если OZON показал (часто скрыто), [ДАННЫЕ|null]
  available: boolean | null; // в наличии, [ДАННЫЕ]
  ok: boolean; // распарсилось ли хоть что-то полезное
}

// "5 912 ₽", "5912₽", "1 183 230 ₽" -> 5912 / 1183230. Берём первую группу цифр с пробелами/nbsp.
export function parseRub(s: unknown): number | null {
  if (typeof s !== "string") return null;
  const m = s.replace(/ /g, " ").match(/(\d[\d\s]*)/);
  if (!m) return null;
  const g = m[1];
  if (g === undefined) return null;
  const n = parseInt(g.replace(/\s/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

// Достаёт первое целое из строки ("128 отзывов" -> 128, "осталось 7 шт." -> 7).
export function parseInt0(s: unknown): number | null {
  if (typeof s !== "string") return null;
  const m = s.replace(/ /g, " ").match(/(\d[\d\s]*)/);
  if (!m) return null;
  const g = m[1];
  if (g === undefined) return null;
  const n = parseInt(g.replace(/\s/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

// Распарсить widgetStates: ключи с динамическим суффиксом -> найти первый по префиксу и JSON.parse значение.
function pickWidget(states: Record<string, string>, prefix: string): any | null {
  for (const k of Object.keys(states)) {
    if (k.startsWith(prefix)) {
      const v = states[k];
      if (v === undefined) continue;
      try { return JSON.parse(v); } catch { return null; }
    }
  }
  return null;
}

// Главный парсер: на вход - распарсенный JSON ответа composer-api, на выход - нормализованная карточка.
export function parseCard(sku: string, page: any): CardData {
  const out: CardData = { sku, title: null, price: null, priceBase: null, rating: null, reviews: null, stock: null, available: null, ok: false };
  const states: Record<string, string> = (page && page.widgetStates) || {};
  if (!states || typeof states !== "object") return out;

  // Цена: webPrice -> { price, originalPrice, cardPrice }. cardPrice = с Ozon Картой, price = обычная.
  const wp = pickWidget(states, "webPrice-");
  if (wp) {
    out.price = parseRub(wp.cardPrice) ?? parseRub(wp.price);
    out.priceBase = parseRub(wp.originalPrice) ?? parseRub(wp.price);
  }

  // Заголовок: webProductHeading -> { title }
  const wh = pickWidget(states, "webProductHeading-");
  if (wh && typeof wh.title === "string") out.title = wh.title.trim();

  // Рейтинг и отзывы: webReviewProductScore / webSingleProductScore -> { totalScore, reviewsCount } или текст.
  const wr = pickWidget(states, "webReviewProductScore-") || pickWidget(states, "webSingleProductScore-");
  if (wr) {
    if (typeof wr.totalScore === "number") out.rating = wr.totalScore;
    else if (typeof wr.totalScore === "string") out.rating = parseFloat(wr.totalScore.replace(",", ".")) || null;
    if (typeof wr.reviewsCount === "number") out.reviews = wr.reviewsCount;
    else out.reviews = parseInt0(wr.reviewsCount) ?? parseInt0(wr.reviewsCountText) ?? parseInt0(wr.subtitle);
  }

  // Наличие/остаток: webOutOfStock (нет в наличии) или webAddToCart (есть; иногда maxItems = остаток).
  const oos = pickWidget(states, "webOutOfStock-");
  const cart = pickWidget(states, "webAddToCart-");
  if (oos) out.available = false;
  else if (cart) {
    out.available = true;
    // Остаток виден редко: maxItems / quantity / текст «осталось N шт».
    out.stock = (typeof cart.maxItems === "number" ? cart.maxItems : null)
      ?? (typeof cart.quantity === "number" ? cart.quantity : null)
      ?? parseInt0(cart.subtitle) ?? parseInt0(cart.text);
  }

  out.ok = out.price != null || out.title != null || out.rating != null;
  return out;
}

// Признаки анти-бот заглушки/челленджа вместо нормального JSON карточки.
export function looksBlocked(raw: string): boolean {
  if (!raw) return true;
  const s = raw.slice(0, 2000).toLowerCase();
  if (s.includes("captcha") || s.includes("are you a robot") || s.includes("доступ ограничен") || s.includes("qrator")) return true;
  // Нормальный ответ - JSON с widgetStates; если это HTML-страница, считаем блоком.
  const t = raw.trimStart();
  return t.startsWith("<");
}
