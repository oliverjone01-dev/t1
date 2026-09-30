import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { matchLedger, accrualShipSeries, type Posting } from "./delivery-match.js";

const P: Posting[] = [
  { order: "46952822-0108-1", d: "2026-08-01", status: "delivered", units: 1 },
  { order: "0198044483-0090-1", d: "2026-05-16", status: "delivered", units: 1 },
  { order: "0243489759-0033-1", d: "2026-06-18", status: "delivered", units: 1 },
  { order: "0243489759-0033-3", d: "2026-06-18", status: "delivered", units: 3 },
  { order: "39351709-0446-1", d: "2026-06-10", status: "delivered", units: 1 },
  { order: "39351709-0445-1", d: "2026-06-08", status: "cancelled", units: 0 },
  { order: "46027676-0255-1", d: "2026-07-18", status: "delivered", units: 1 },
  { order: "46027676-0255-3", d: "2026-07-18", status: "delivered", units: 1 },
];

describe("ведомость доставки ищется по номеру заказа, а не раскладывается", () => {
  const r = matchLedger([
    { order: "46952822-0108-1", ship: 2947.52, deliv: 2399 },
    { order: "0198044483-0090", ship: 457.5, deliv: 0 },
    { order: "0243489759-0033", ship: 146, deliv: 0 },
    { order: "39351709-0446-1 бывш. 39351709-0445-1", ship: 3098, deliv: 2500 },
    { order: "46027676-0255-1 46027676-0255-3", ship: 10457.84, deliv: 0 },
    { order: "4329186-0065-1", ship: 7716, deliv: 0 },
    { order: "49332349-0186-1", ship: 0, deliv: 0 },
  ], P);

  it("точный номер встаёт на свой заказ до копейки (замечание Ивана 28.09)", () => {
    expect(r.byPosting.get("46952822-0108-1")).toEqual({ ship: 2947.52, deliv: 2399 });
  });
  it("номер без хвоста с одним отправлением - на него целиком", () => {
    expect(r.byPosting.get("0198044483-0090-1")!.ship).toBe(457.5);
  });
  it("номер без хвоста с двумя отправлениями - делится по штукам этого заказа", () => {
    expect(r.byPosting.get("0243489759-0033-1")!.ship).toBe(36.5);
    expect(r.byPosting.get("0243489759-0033-3")!.ship).toBe(109.5);
  });
  it("«бывш.» - на действующий номер, отменённый не получает ничего", () => {
    expect(r.byPosting.get("39351709-0446-1")!.ship).toBe(3098);
    expect(r.byPosting.has("39351709-0445-1")).toBe(false);
  });
  it("два отправления в строке - оба", () => {
    const a = r.byPosting.get("46027676-0255-1")!.ship, b = r.byPosting.get("46027676-0255-3")!.ship;
    expect(a + b).toBeCloseTo(10457.84, 2);
  });
  it("ненайденный номер не раскладывается, а попадает в список; нулевые строки не шумят", () => {
    expect(r.unmatched.map((u) => u.raw)).toEqual(["4329186-0065-1"]);
  });
  it("деньги не теряются и не множатся: найдено + не найдено = ведомость", () => {
    const got = [...r.byPosting.values()].reduce((s, v) => s + v.ship, 0) + r.unmatched.reduce((s, u) => s + u.ship, 0);
    expect(got).toBeCloseTo(2947.52 + 457.5 + 146 + 3098 + 10457.84 + 7716, 2);
  });
});

describe("живые данные: сумма ведомости сохраняется при сопоставлении", () => {
  it("найдено + не найдено = вся ведомость, до копейки", () => {
    if (!existsSync("data/delivery_orders.ndjson") || !existsSync("data/orders_daily.ndjson")) return;
    const nd = (f: string) => readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const led = nd("data/delivery_orders.ndjson");
    const r = matchLedger(led, nd("data/orders_daily.ndjson"));
    const total = led.reduce((s: number, x: any) => s + (Number(x.ship) || 0), 0);
    const got = [...r.byPosting.values()].reduce((s, v) => s + v.ship, 0) + r.unmatched.reduce((s, u) => s + u.ship, 0);
    expect(got).toBeCloseTo(total, 1);
    expect(r.byPosting.get("46952822-0108-1")?.ship).toBe(2947.52);
  });
});

describe("«Наша доставка» по дате начисления заказа (Иван 28.09)", () => {
  const P2: Posting[] = [
    { order: "A-1-1", d: "2026-07-31", sd: "2026-08-13", sku: "1", units: 1, status: "delivered" },
    { order: "B-1-1", d: "2026-08-20", sd: null, sku: "2", units: 1, status: "delivering" },
    { order: "C-1-1", d: "2026-08-25", sd: null, sku: "2", units: 1, status: "cancelled" },
  ];
  const r = matchLedger([
    { order: "A-1-1", ship: 3666.1, deliv: 0, d_ship: "2026-08-04", d_fact: "2026-08-09" },
    { order: "B-1-1", ship: 1000, deliv: 0, d_ship: "2026-08-22", d_fact: "2026-08-26" },
    { order: "C-1-1", ship: 500, deliv: 0, d_ship: "2026-08-27" },
  ], P2);
  const s = accrualShipSeries(P2, r.byPosting);
  it("начисленный заказ - на дату начисления, не заказа и не отгрузки", () => {
    expect(s.bySku.get("1")!.get("2026-08-13")).toBe(3666.1);
  });
  it("не начисленный - на фактическую доставку, без неё - на отгрузку", () => {
    expect(s.bySku.get("2")!.get("2026-08-26")).toBe(1000);
    expect(s.bySku.get("2")!.get("2026-08-27")).toBe(500);
    expect(s.fallback).toEqual({ fact: 1000, ship: 500, order: 0 });
  });
  it("ничего не теряется и не двоится: ряд = всё, что нашлось по номерам", () => {
    expect(s.total).toBeCloseTo(3666.1 + 1000 + 500, 2);
  });
  it("живые данные: ряд по начислению = всё найденное по номерам, до копейки", () => {
    if (!existsSync("data/delivery_orders.ndjson") || !existsSync("data/orders_daily.ndjson")) return;
    const nd = (f: string) => readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const od = nd("data/orders_daily.ndjson");
    const m = matchLedger(nd("data/delivery_orders.ndjson"), od);
    const a = accrualShipSeries(od, m.byPosting);
    const matched = [...m.byPosting.values()].reduce((x, v) => x + v.ship, 0);
    expect(a.total).toBeCloseTo(matched, 1);
    let inSeries = 0; for (const mm of a.bySku.values()) for (const v of mm.values()) inSeries += v;
    expect(inSeries).toBeCloseTo(matched, 1);
  });
});

describe("ведомость: суммы текстом не превращаются в 0 (ФЕНИКС 29.09, п.1)", () => {
  it("разбор денежных ячеек: пробелы любого вида, переносы, «1871х2», сдвиг столбцов", async () => {
    const { execFileSync } = await import("node:child_process");
    const out = execFileSync("python3", ["tools/delivery/ledger_money.py"], { encoding: "utf-8" });
    expect(out).toContain("все проверки прошли");
  });
  it("файл данных = сама ведомость (xlsx), если сырьё есть локально", async () => {
    const { execFileSync } = await import("node:child_process");
    const out = execFileSync("python3", ["tools/delivery/check_ledger_raw.py"], { encoding: "utf-8" });
    expect(out).toMatch(/ни одна сумма не потеряна|сырья нет/);
  });
});

describe("matchLedger: город заказа (Иван 30.09)", () => {
  it("город берётся из строки ведомости этого заказа, а не из артикула", () => {
    const post: Posting[] = [
      { order: "111-0001-1", d: "2026-08-01", units: 1 },
      { order: "222-0002-1", d: "2026-08-02", units: 1 },
    ];
    const m = matchLedger([
      { order: "111-0001-1", ship: 3000, deliv: 2000, city: "Краснодарский Край, Краснодар" },
      { order: "222-0002-1", ship: 2500, deliv: 1500, city: "Тюменская Область, Тюмень" },
    ], post);
    expect(m.byPosting.get("111-0001-1")?.cities).toEqual(["Краснодарский Край, Краснодар"]);
    expect(m.byPosting.get("222-0002-1")?.cities).toEqual(["Тюменская Область, Тюмень"]);
  });
  it("повторный выезд в другой город - два города; без города поля нет", () => {
    const post: Posting[] = [{ order: "333-0003-1", d: "2026-08-03", units: 1 }, { order: "444-0004-1", d: "2026-08-04", units: 1 }];
    const m = matchLedger([
      { order: "333-0003-1", ship: 1000, deliv: 0, city: "Астраханская Область, Астрахань" },
      { order: "333-0003-1", ship: 1200, deliv: 0, city: "Алтайский Край, Барнаул" },
      { order: "444-0004-1", ship: 900, deliv: 0 },
    ], post);
    expect(m.byPosting.get("333-0003-1")?.cities).toEqual(["Астраханская Область, Астрахань", "Алтайский Край, Барнаул"]);
    expect(m.byPosting.get("444-0004-1")?.cities).toBeUndefined();
  });
});
