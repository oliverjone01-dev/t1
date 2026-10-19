// Соинвест считается из пары цен, и ошибиться здесь дорого: это главная метрика A/B-тестов
// по рекламе. Тест держит именно ту границу, на которой дашборд обязан показать пробел,
// а не выдуманный ноль.
import { describe, it, expect } from "vitest";
import { coinvOf, priceRows, sameBeforeShare, SAME_BEFORE_WARN, NO_BEFORE_SHARE } from "./prices-daily.js";
import { priceItem } from "../../connector/ozon-seller.js";

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
    expect(rows).toEqual([{ d: "2026-09-22", offer: "GGM-01-1", price: 46611, paid: null, before: 93223, coinv: 50, coinv_paid: null }]);
  });

  it("товар без пары цен в ряд не попадает", () => {
    expect(priceRows([{ offer_id: "GGM-01-1", price: 1000, price_before: null }], "2026-09-22")).toEqual([]);
    expect(priceRows([{ offer_id: "", price: 1000, price_before: 2000 }], "2026-09-22")).toEqual([]);
  });
});

// Три цены /v5/product/info/prices легко перепутать, и цена ошибки известна: до 23.09 снимок
// брал витрину вместо цены по карте, и соинвест был занижен на пять пунктов против реестра
// начислений. Тест держит именно это различие.
describe("три цены прайса", () => {
  it("цена по карте это marketing_price, витрина - marketing_seller_price", () => {
    const it = priceItem("GGM-01-1", { price: 93223, marketing_seller_price: 46611, marketing_price: 41950 });
    expect(it).toMatchObject({ offer_id: "GGM-01-1", price_before: 93223, price: 46611, price_paid: 41950 });
  });

  it("в BFF то же поле зовётся marketing_oa_price", () => {
    expect(priceItem("A", { price: 100, marketing_seller_price: 90, marketing_oa_price: 81 }).price_paid).toBe(81);
  });

  it("без цены по карте отдаёт пробел, а не витрину", () => {
    const it = priceItem("A", { price: 100, marketing_seller_price: 90 });
    expect(it.price_paid).toBeNull();
    expect(it.price).toBe(90);
  });

  it("нули и мусор не считает ценой", () => {
    const it = priceItem("A", { price: "100", marketing_seller_price: 0, marketing_price: "—" });
    expect(it.price).toBe(100);      // витрины нет - откатились на предельную
    expect(it.price_paid).toBeNull();
    expect(it.price_before).toBe(100);
  });

  it("строка дня несёт обе цены и оба соинвеста", () => {
    const rows = priceRows([{ offer_id: "GGM-01-1", price: 46611, price_paid: 41950, price_before: 93223 }], "2026-09-23");
    expect(rows).toEqual([{
      d: "2026-09-23", offer: "GGM-01-1", price: 46611, paid: 41950, before: 93223,
      coinv: 50, coinv_paid: 55,
    }]);
  });

  it("без цены по карте второй соинвест остаётся пробелом", () => {
    const rows = priceRows([{ offer_id: "A", price: 50, price_paid: null, price_before: 100 }], "2026-09-23");
    expect(rows[0]).toMatchObject({ paid: null, coinv: 50, coinv_paid: null });
  });

  it("OZON не отдал цену до акций (price == before почти у всех) - before и соинвест дня пустые, не 0 (Иван 16.10)", () => {
    const items = Array.from({ length: 10 }, (_, k) => ({ offer_id: `A${k}`, price: 1000 + k, price_before: 1000 + k }));
    const rows = priceRows(items, "2026-10-16");
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.before === null && r.coinv === null && r.coinv_paid === null && r.price > 0)).toBe(true);
    const mixed = priceRows([...items.slice(0, 8), { offer_id: "B", price: 500, price_before: 1000 }, { offer_id: "C", price: 600, price_before: 1000 }], "d");
    expect(mixed.find((r) => r.offer === "B")).toMatchObject({ before: 1000, coinv: 50 });
  });

  it("доля price == before: «нет данных» с 0.9, предупреждение с 0.15 (история 19.09-14.10: максимум 6.7 %, ФЕНИКС P1)", () => {
    expect(SAME_BEFORE_WARN).toBeLessThan(NO_BEFORE_SHARE);
    expect(SAME_BEFORE_WARN).toBeGreaterThan(0.067);
    const items = Array.from({ length: 20 }, (_, k) => ({ offer_id: `A${k}`, price: k < 10 ? 1000 : 500, price_before: 1000 }));
    expect(sameBeforeShare(items)).toBe(0.5);
    expect(sameBeforeShare([])).toBeNull();
    expect(sameBeforeShare([{ offer_id: "A", price: 100, price_before: null }])).toBeNull();
    // 50 % - ниже порога «нет данных»: значения пишутся как есть, предупреждение даёт main() по той же доле.
    const rows = priceRows(items, "d");
    expect(rows.filter((r) => r.coinv === 0)).toHaveLength(10);
    expect(rows.filter((r) => r.coinv === 50)).toHaveLength(10);
    // 89 из 100 - ещё не «нет данных», 90 из 100 - уже «нет данных» (ФЕНИКС P1: 50 / 85 / 89 / 90 %).
    const same = (n: number) => Array.from({ length: n }, (_, k) => ({ offer_id: `S${k}`, price: 700, price_before: 700 }));
    const diff = (n: number) => Array.from({ length: n }, (_, k) => ({ offer_id: `Z${k}`, price: 500, price_before: 1000 }));
    expect(priceRows([...same(89), ...diff(11)], "d").filter((r) => r.coinv === 50)).toHaveLength(11);
    expect(priceRows([...same(90), ...diff(10)], "d").every((r) => r.coinv === null && r.before === null)).toBe(true);
  });
});
