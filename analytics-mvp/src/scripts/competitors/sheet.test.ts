import { describe, it, expect } from "vitest";
import { parseCsv, rowsToItems, toCsvExportUrl } from "./sheet.js";

describe("parseCsv", () => {
  it("кавычки, запятые и переносы внутри полей", () => {
    const csv = 'a,b\n"1,2","строка\nперенос"\n3,4\n';
    expect(parseCsv(csv)).toEqual([["a", "b"], ["1,2", "строка\nперенос"], ["3", "4"]]);
  });
  it("снимает BOM и экранированные кавычки", () => {
    const csv = '﻿x\n"он сказал ""да"""\n';
    expect(parseCsv(csv)).toEqual([["x"], ['он сказал "да"']]);
  });
  it("последняя строка без перевода строки не теряется", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("rowsToItems", () => {
  const header = ["Артикул", "Продавец", "Название конкурента", "Товар GG", "Категория", "Квалификация"];

  it("маппит русские заголовки и вытаскивает sku даже из ссылки", () => {
    const rows = [header, ["https://www.ozon.ru/product/123456", "ЛайфМебель", "Стол Барон", "Стол TRUBIS 200", "Стол обеденный", "Горячий"]];
    const { items } = rowsToItems(rows);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ sku: "123456", seller: "ЛайфМебель", gg_product: "Стол TRUBIS 200", category: "Стол обеденный" });
  });

  it("принимает английские заголовки и другой порядок колонок", () => {
    const rows = [["category", "sku", "seller"], ["Стол письменный", "999", "OpenDesing"]];
    const { items } = rowsToItems(rows);
    expect(items[0]).toMatchObject({ sku: "999", seller: "OpenDesing", category: "Стол письменный" });
  });

  it("пропускает пустые строки и дубли с предупреждением", () => {
    const rows = [header, ["111", "A", "n", "g", "c", "q"], ["", "", "", "", "", ""], ["111", "A2", "n2", "g2", "c2", "q2"]];
    const { items, warnings } = rowsToItems(rows);
    expect(items.map((i) => i.sku)).toEqual(["111"]);
    expect(warnings.some((w) => /дубль/.test(w))).toBe(true);
  });

  it("без колонки артикула - предупреждение, ноль строк", () => {
    const { items, warnings } = rowsToItems([["foo", "bar"], ["1", "2"]]);
    expect(items).toHaveLength(0);
    expect(warnings.join()).toMatch(/артикул/);
  });
});

describe("toCsvExportUrl", () => {
  it("из обычной ссылки делает CSV-экспорт с нужным gid", () => {
    expect(toCsvExportUrl("https://docs.google.com/spreadsheets/d/ABC123/edit#gid=42"))
      .toBe("https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=42");
  });
  it("готовый CSV-URL не трогает", () => {
    const u = "https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=0";
    expect(toCsvExportUrl(u)).toBe(u);
  });
  it("из голого ID собирает URL с gid по умолчанию", () => {
    expect(toCsvExportUrl("ABCDEFGHIJKLMNOPQRSTUVWX")).toBe("https://docs.google.com/spreadsheets/d/ABCDEFGHIJKLMNOPQRSTUVWX/export?format=csv&gid=0");
  });
});
