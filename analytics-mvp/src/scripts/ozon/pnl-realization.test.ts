import { describe, it, expect } from "vitest";
import { parseRow } from "./pnl-realization.js";

// База налога OZON (Иван 25.09.2026): колонки F + G отчёта о реализации за вычетом возвратов J + K.
// F «Реализовано на сумму» = amount; G «Выплаты по механикам лояльности партнёров» =
// bank_coinvestment + stars + pick_up_point_coinvestment. Строка скрина: 22 780,00 и 227,80.
describe("отчёт о реализации: база налога F + G - J - K", () => {
  it("продажа без возврата: F и G из строки скрина", () => {
    const r = parseRow({ item: { sku: 3492790223 }, delivery_commission: { quantity: 1, amount: 22780, bank_coinvestment: 227.8, stars: 0, pick_up_point_coinvestment: 0, bonus: 500, standard_fee: 9000, total: 14000 }, return_commission: null })!;
    expect(r.f).toBe(22780);
    expect(r.g).toBeCloseTo(227.8, 2);
    expect(r.tb).toBeCloseTo(23007.8, 2);
  });

  it("баллы за скидки (bonus) в G не входят, звёзды и ПВЗ входят", () => {
    const r = parseRow({ item: { sku: 1 }, delivery_commission: { amount: 1000, bank_coinvestment: 5, stars: 3, pick_up_point_coinvestment: 2, bonus: 700 } })!;
    expect(r.g).toBe(10);
    expect(r.tb).toBe(1010);
  });

  it("возврат уменьшает базу тем же составом: J и K", () => {
    const r = parseRow({ item: { sku: 1 }, delivery_commission: { amount: 1000, bank_coinvestment: 10 }, return_commission: { amount: 1000, bank_coinvestment: 10 } })!;
    expect(r.j).toBe(1000);
    expect(r.k).toBe(10);
    expect(r.tb).toBe(0);
  });

  it("строка без SKU не считается", () => {
    expect(parseRow({ item: { sku: 0 }, delivery_commission: { amount: 1 } })).toBeNull();
  });
});

describe("отчёт о реализации за день: те же деньги, что у месячного", () => {
  it("строки одного SKU за день складываются, bonus в базу не входит", async () => {
    const { aggDay } = await import("./realization-daily.js");
    const rows = [
      { item: { sku: 7 }, delivery_commission: { quantity: 1, amount: 100, bank_coinvestment: 1, bonus: 120, standard_fee: 90, total: 131 } },
      { item: { sku: 7 }, delivery_commission: { quantity: 1, amount: 50, bank_coinvestment: 0.5, bonus: 60, standard_fee: 45, total: 65.5 }, return_commission: { quantity: 1, amount: 50, bank_coinvestment: 0.5, bonus: 60, standard_fee: 45, total: 65.5 } },
    ];
    const [r] = aggDay("2026-09-24", rows);
    expect(r!.sold - r!.ret).toBe(1);
    expect(r!.tb).toBeCloseTo(101, 2);           // F + G − J − K
    expect(r!.bonus).toBe(120);                  // баллы нетто
    expect(r!.tb + r!.bonus).toBeCloseTo(221, 2); // = цена продавца нетто, то есть «Начислено»
    expect(r!.pay).toBeCloseTo(131, 2);
  });
});
