import { describe, it, expect } from "vitest";
import { parseCard, parseRub, parseInt0, looksBlocked } from "./parse.js";

// Фикстура формата публичного OZON composer-api (widget_state) - ключи с динамическим суффиксом,
// значения - JSON-строки. Структура соответствует реальному ответу карточки товара.
const FIX_IN_STOCK = {
  widgetStates: {
    "webProductHeading-3279621-default-1": JSON.stringify({ title: "Стол кухонный обеденный раздвижной" }),
    "webPrice-3121879-default-1": JSON.stringify({ price: "8 990 ₽", originalPrice: "12 400 ₽", cardPrice: "7 691 ₽" }),
    "webReviewProductScore-3263391-default-1": JSON.stringify({ totalScore: 4.8, reviewsCount: 128 }),
    "webAddToCart-3000000-default-1": JSON.stringify({ maxItems: 14 }),
  },
  layout: [],
};

const FIX_OOS = {
  widgetStates: {
    "webProductHeading-1-default-1": JSON.stringify({ title: "Стол круглый д90 см" }),
    "webPrice-2-default-1": JSON.stringify({ price: "10 500 ₽", cardPrice: "9 450 ₽" }),
    "webOutOfStock-3-default-1": JSON.stringify({ text: "Этот товар закончился" }),
    "webSingleProductScore-4-default-1": JSON.stringify({ totalScore: "4,6", reviewsCount: 12 }),
  },
};

describe("parseRub / parseInt0", () => {
  it("парсит рубли с пробелами и nbsp", () => {
    expect(parseRub("7 691 ₽")).toBe(7691);
    expect(parseRub("1 183 230 ₽")).toBe(1183230);
    expect(parseRub("нет")).toBeNull();
    expect(parseRub(null)).toBeNull();
  });
  it("парсит первое целое", () => {
    expect(parseInt0("128 отзывов")).toBe(128);
    expect(parseInt0("осталось 7 шт.")).toBe(7);
  });
});

describe("parseCard", () => {
  it("товар в наличии: цена с картой, базовая, рейтинг, отзывы, остаток", () => {
    const c = parseCard("2272994591", FIX_IN_STOCK);
    expect(c.ok).toBe(true);
    expect(c.price).toBe(7691); // cardPrice приоритетнее
    expect(c.priceBase).toBe(12400); // originalPrice
    expect(c.rating).toBe(4.8);
    expect(c.reviews).toBe(128);
    expect(c.available).toBe(true);
    expect(c.stock).toBe(14);
    expect(c.title).toContain("раздвижной");
  });

  it("товар закончился: available=false, рейтинг с запятой", () => {
    const c = parseCard("3486895764", FIX_OOS);
    expect(c.available).toBe(false);
    expect(c.price).toBe(9450);
    expect(c.rating).toBeCloseTo(4.6, 1);
    expect(c.reviews).toBe(12);
    expect(c.stock).toBeNull(); // OZON остаток не показал
  });

  it("пустой/битый ответ -> ok=false, без падения", () => {
    expect(parseCard("x", {}).ok).toBe(false);
    expect(parseCard("x", null).ok).toBe(false);
    expect(parseCard("x", { widgetStates: { "webPrice-1": "{битый" } }).ok).toBe(false);
  });
});

describe("looksBlocked", () => {
  it("ловит HTML/капчу/qrator вместо JSON", () => {
    expect(looksBlocked("<!doctype html><html>...")).toBe(true);
    expect(looksBlocked('{"some":"captcha required"}')).toBe(true);
    expect(looksBlocked("")).toBe(true);
    expect(looksBlocked('{"widgetStates":{}}')).toBe(false);
  });
});
