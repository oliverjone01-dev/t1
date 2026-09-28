import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { matchLedger, type Posting } from "./delivery-match.js";

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
