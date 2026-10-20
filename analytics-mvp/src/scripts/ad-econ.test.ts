import { describe, it, expect } from "vitest";
import { adEcon, ECON_WIN_DAYS, type SkuAccrRow, type ChanRow } from "./ad-econ.js";

// Эталон посчитан вручную. Окно 60 дн. по последней дате ряда (2026-10-15): 2026-08-17..2026-10-15.
// SKU A: 3 дня доставок, начислено 300, к выплате 150 -> 50%. SKU B: 1 день, 100/40 -> 60%, но мало дней ->
// ставка категории «Столы» (A+B: 400/190 -> 52.5%). SKU C (другая категория, «Зеркала»): 3 дня, 300/180 -> 40%.
// Строка A за 2026-08-16 вне окна. Ряд SKU за окно: 700 / 370 -> 47.14%; канал: 700, сборы -337 -> 48.14%;
// надбавка за эквайринг и хранение = 1.0 п.п.
const skuRows: SkuAccrRow[] = [
  { d: "2026-08-16", sku: "A", accruals: 1000, amount: 0 },
  { d: "2026-09-01", sku: "A", accruals: 100, amount: 50 },
  { d: "2026-09-10", sku: "A", accruals: 100, amount: 50 },
  { d: "2026-10-15", sku: "A", accruals: 100, amount: 50 },
  { d: "2026-10-01", sku: "B", accruals: 100, amount: 40 },
  { d: "2026-09-02", sku: "C", accruals: 100, amount: 60 },
  { d: "2026-09-03", sku: "C", accruals: 100, amount: 60 },
  { d: "2026-09-04", sku: "C", accruals: 100, amount: 60 },
];
const ch: ChanRow[] = [{ d: "2026-08-16", accruals: 1000, fees: -1000 }, { d: "2026-09-01", accruals: 700, fees: -337 }];
const cat = (s: string) => (s === "C" ? "Зеркала" : "Столы");
const live = [{ sku: "A", rev: 1000, units: 10 }, { sku: "B", price: 200 }];
const cogs = { A: 20, B: 50, D: 30 };

describe("юнит-экономика рекламы: ставка сборов из ряда начислений", () => {
  const { econ, meta } = adEcon(skuRows, ch, cogs, live, cat, ["D", "E"]);
  it("окно - последние 60 дней ряда", () => {
    expect(ECON_WIN_DAYS).toBe(60);
    expect(meta).toMatchObject({ from: "2026-08-17", to: "2026-10-15" });
  });
  it("надбавка за эквайринг и хранение = ставка канала минус ставка SKU-ряда", () => {
    expect(meta.topUp).toBe(1);
    expect(meta.warn).toEqual([]);
  });
  it("SKU с 3+ днями доставок - своя ставка плюс надбавка; с/с % от цены выручка/штуки", () => {
    expect(econ.A).toMatchObject({ com: 51, comSrc: "по SKU, 3 дн. с доставками", price: 100, cogs: 20, be: 29, why: null, accr: 300 });
  });
  it("SKU с <3 днями - ставка категории; без продаж в окне - тоже категории", () => {
    expect(econ.B.com).toBe(53.5);
    expect(econ.B.comSrc).toContain("«Столы»");
    expect(econ.B).toMatchObject({ price: 200, cogs: 25, be: 21.5 });
    expect(econ.D).toMatchObject({ com: 53.5, cogsRub: 30, cogs: null, be: null, why: "нет цены" });
    expect(econ.C.com).toBe(41);
  });
  it("нет себестоимости - причина, а не 0", () => {
    expect(econ.E).toMatchObject({ com: 53.5, cogsRub: null, be: null, why: "нет себестоимости" });
  });
  it("каналы расходятся больше 1% - надбавки нет и есть предупреждение", () => {
    const r = adEcon(skuRows, [{ d: "2026-09-01", accruals: 800, fees: -400 }], cogs, live, cat, []);
    expect(r.meta.topUp).toBeNull();
    expect(r.meta.warn[0]).toContain("расходятся");
    expect(r.econ.A.com).toBe(50);
  });
  it("пустой ряд - пусто и предупреждение, не нули", () => {
    const r = adEcon([], ch, cogs, live, cat, ["A"]);
    expect(r.econ).toEqual({});
    expect(r.meta.warn.length).toBe(1);
  });
});
