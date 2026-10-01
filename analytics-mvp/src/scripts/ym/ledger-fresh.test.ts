import { describe, it, expect } from "vitest";
import { ledgerFreshness, LEDGER_STALE_DAYS } from "./derive-lib.js";

// Даты инжектируются: «вчера» передаётся параметром, на сегодня тест не завязан.
const net = (b: string, ...ds: string[]) => ds.map((d) => ({ business: b, d }));

describe("свежесть реестра платежей по календарю (тревога конца прогона)", () => {
  it("предел 2 дня", () => expect(LEDGER_STALE_DAYS).toBe(2));

  it("снимок 29.09 как был: 1023124 по 27.09, 74986385 по 28.09 - отставание 1 и 0, тревоги нет", () => {
    const r = ledgerFreshness([...net("1023124", "2026-09-26", "2026-09-27"), ...net("74986385", "2026-09-28")], [], "2026-09-28");
    expect(r.map((x) => [x.business, x.ledger_to, x.lag, x.stale])).toEqual([["1023124", "2026-09-27", 1, false], ["74986385", "2026-09-28", 0, false]]);
  });

  it("тот же реестр днём позже (застрял второй день) - тревога только по застрявшему кабинету", () => {
    const r = ledgerFreshness([...net("1023124", "2026-09-27"), ...net("74986385", "2026-09-29")], [], "2026-09-29");
    expect(r.filter((x) => x.stale).map((x) => [x.business, x.lag])).toEqual([["1023124", 2]]);
  });

  it("граница месяца: вчера 30.09, реестр по 28.09 - отставание 2", () => {
    expect(ledgerFreshness(net("1", "2026-09-28"), [], "2026-09-30")[0]).toMatchObject({ lag: 2, stale: true });
  });

  it("кабинет с заказами за 30 дней, но без единой строки реестра - тревога, а не пропуск", () => {
    const r = ledgerFreshness(net("1", "2026-09-29"), [{ business: "2", created: "2026-09-01T10:00:00" }], "2026-09-30");
    expect(r.find((x) => x.business === "2")).toEqual({ business: "2", ledger_to: null, lag: null, stale: true });
  });

  it("кабинет только со старыми заказами (раньше 30 дней) и без реестра не проверяется", () => {
    const r = ledgerFreshness(net("1", "2026-09-29"), [{ business: "2", created: "2026-08-31" }], "2026-09-30");
    expect(r.map((x) => x.business)).toEqual(["1"]);
  });

  it("окно заказов ровно 30 дат: 01.09 при вчера 30.09 входит", () => {
    const r = ledgerFreshness([], [{ business: "2", created: "2026-09-01" }], "2026-09-30");
    expect(r.map((x) => x.business)).toEqual(["2"]);
  });
});
