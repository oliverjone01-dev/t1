import { describe, expect, it } from "vitest";
import { annotation, checkRowCount, checkTotals, totalsOf, shape } from "./orders-daily.js";

// Аннотации сборщика заказов: ключи кабинета вырезаны, перевод строки закодирован, длина ограничена.
describe("orders-daily annotation", () => {
  it("вырезает ключи кабинета из текста ошибки", () => {
    const out = annotation("error", "HTTP 403 key=abc123 id=777", ["abc123", "777"]);
    expect(out).toBe("::error::HTTP 403 key=*** id=***");
    expect(out).not.toContain("abc123");
  });
  it("кодирует перевод строки и пустые секреты не трогает", () => {
    expect(annotation("notice", "a\r\nb", ["", "zzz"])).toBe("::notice::a%0Ab");
  });
  it("режет длинный текст до 1500 символов", () => {
    const out = annotation("error", "x".repeat(5000));
    expect(out.length).toBe("::error::".length + 1501);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("orders-daily checkRowCount", () => {
  it("усохшая выдача после смены эндпоинта - ошибка, файл не перезаписывается", () => {
    expect(checkRowCount(3881, 0)).toMatch(/0 меньше 99% прошлого файла \(3881\)/);
    expect(checkRowCount(3881, 3800)).not.toBeNull();
  });
  it("рост или равенство, а также первый сбор - проходят", () => {
    expect(checkRowCount(3881, 3881)).toBeNull();
    expect(checkRowCount(3881, 3850)).toBeNull();
    expect(checkRowCount(3881, 3900)).toBeNull();
    expect(checkRowCount(0, 0)).toBeNull();
  });
});

describe("orders-daily checkTotals и shape", () => {
  const prev = { rows: 3881, revenue: 214071012, paid: 3847 };
  it("нулевая выручка при верном числе строк - ошибка (20.10: смена формы цены в v3)", () => {
    expect(checkTotals(prev, { rows: 3905, revenue: 0, paid: 0 })).toMatch(/выручка 0 меньше 99%/);
    expect(checkTotals(prev, { rows: 3905, revenue: 215000000, paid: 0 })).toMatch(/с paid 0 меньше 99%/);
    expect(checkTotals(prev, { rows: 3905, revenue: 215000000, paid: 3870 })).toBeNull();
    expect(checkTotals({ rows: 0, revenue: 0, paid: 0 }, { rows: 10, revenue: 0, paid: 0 })).toBeNull();
  });
  it("totalsOf считает строки, выручку и заказы с paid", () => {
    expect(totalsOf([{ revenue: 10, paid: 9 }, { revenue: 5, paid: null }, {}])).toEqual({ rows: 3, revenue: 15, paid: 1 });
  });
  it("shape печатает имена полей и типы без значений", () => {
    expect(shape({ posting_number: "123", products: [{ price: { amount: "10", currency_code: "RUB" }, sku: 1 }], financial_data: null, empty: [] }))
      .toBe("{posting_number:string,products:[{price:{amount:string,currency_code:string},sku:number}],financial_data:null,empty:[]}");
    expect(shape({ a: { b: { c: { d: { e: 1 } } } } }, 3)).toBe("{a:{b:{c:{…}}}}");
  });
});
