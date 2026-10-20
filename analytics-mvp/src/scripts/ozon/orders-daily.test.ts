import { describe, expect, it } from "vitest";
import { annotation, checkRowCount } from "./orders-daily.js";

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
