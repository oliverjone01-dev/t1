// Соинвест считается из пары цен, и ошибиться здесь дорого: это главная метрика A/B-тестов
// по рекламе. Тест держит именно ту границу, на которой дашборд обязан показать пробел,
// а не выдуманный ноль.
import { describe, it, expect } from "vitest";
import { coinvOf, priceRows } from "./prices-daily.js";

describe("соинвест по паре цен", () => {
  it("считает долю скидки от цены до акций", () => {
    expect(coinvOf(50000, 100000)).toBe(50);
    expect(coinvOf(49400, 100000)).toBe(50.6);   // как в «Реакции»: без рекламы 49.4 %
  });

  it("отдаёт null там, где считать нечего, а не ноль", () => {
    expect(coinvOf(null, 100000)).toBeNull();
    expect(coinvOf(50000, null)).toBeNull();
    expect(coinvOf(50000, 0)).toBeNull();
    expect(coinvOf(120000, 100000)).toBeNull(); // цена выше «зачёркнутой» - данные битые
  });

  it("строка дня несёт артикул, обе цены и соинвест", () => {
    const rows = priceRows([{ offer_id: "GGM-01-1", price: 46611.4, price_before: 93222.8 }], "2026-09-22");
    expect(rows).toEqual([{ d: "2026-09-22", offer: "GGM-01-1", price: 46611, before: 93223, coinv: 50 }]);
  });

  it("товар без пары цен в ряд не попадает", () => {
    expect(priceRows([{ offer_id: "GGM-01-1", price: 1000, price_before: null }], "2026-09-22")).toEqual([]);
    expect(priceRows([{ offer_id: "", price: 1000, price_before: 2000 }], "2026-09-22")).toEqual([]);
  });
});
