import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";
import { priceStatus, priceWhen, gaugePeriod, storeGoalDay, cardPlanDay, monthEnd, goalPath, cardStatus, spendStatus, weekSum, daysIn, drange, planBlock, PLAN_FILE, adsFullDay, storeNeed, monthGoal, orderDay, decisionWarn, cabinetCheck, CAB_FILE, netUnits, priceAt, priceChanges, wkDelta, ordWindow, deltaNote, DELTA_MIN_DAYS, DELTA_MIN_ORDERS, PLAN_CARDS_FILE } from "./plan-tab.js";

const OCT = { mid: 355, lo: 300, hi: 429 };

describe("goalPath", () => {
  it("до 17.10 цель идёт по базе («плохо») ровно по дням", () => {
    expect(goalPath(OCT, 16, "mid")).toBeCloseTo(300 / 31 * 16);
    expect(goalPath(OCT, 16, "hi")).toBeCloseTo(goalPath(OCT, 16, "lo"));
  });
  it("31.10 сходится к цели месяца в каждом сценарии", () => {
    for (const sc of ["lo", "mid", "hi"] as const) expect(goalPath(OCT, 31, sc)).toBeCloseTo(OCT[sc]);
  });
  it("коридор не перекрещивается", () => {
    for (let d = 1; d <= 31; d++) expect(goalPath(OCT, d, "lo")).toBeLessThanOrEqual(goalPath(OCT, d, "hi"));
  });
});

describe("cardStatus", () => {
  it("нет заказов в данных - «нет данных», а не «отстаём»", () => expect(cardStatus(null, 31, 5)).toBe("нет данных"));
  it("первые 2 дня - «рано»", () => expect(cardStatus(0, 31, 2)).toBe("рано"));
  it("сравнение с путём порог × дни / 14", () => {
    expect(cardStatus(7, 14, 7)).toBe("идём");
    expect(cardStatus(6, 14, 7)).toBe("отстаём");
  });
});

describe("spendStatus - расход: меньше значит лучше (Иван 15.10)", () => {
  it("ноль и недотрата - в плане", () => { expect(spendStatus(0)).toBe("в плане"); expect(spendStatus(40)).toBe("в плане"); });
  it("пороги 100 и 120", () => {
    expect(spendStatus(100)).toBe("в плане"); expect(spendStatus(110)).toBe("выше плана"); expect(spendStatus(121)).toBe("перерасход");
  });
  it("нет данных - не ноль", () => expect(spendStatus(null)).toBe("нет данных"));
});

describe("adsFullDay - отчёт по товарам доливается несколько ночей (ФЕНИКС G1)", () => {
  const daily = [{ d: "2026-10-12", id: "1", sp: 100 }, { d: "2026-10-12", id: "2", sp: 50 }, { d: "2026-10-13", id: "1", sp: 100 }, { d: "2026-10-13", id: "2", sp: 50 },
    { d: "2026-10-13", id: "9", sp: 999 }];
  it("день, где одна кампания ещё не собрана, - не полный", () => expect(adsFullDay(daily, { "1": "2026-10-14", "2": "2026-10-13" }, "9")).toBe("2026-10-12"));
  it("все собраны - последний день полный; «Оплата за заказ» не в счёт", () => expect(adsFullDay(daily, { "1": "2026-10-14", "2": "2026-10-14" }, "9")).toBe("2026-10-13"));
  it("кампания без состояния - день не полный", () => expect(adsFullDay(daily, { "1": "2026-10-14" }, "9")).toBe(""));
  it("сбой отчёта: дата сбора есть, строк по товарам меньше 95% - день не полный (ФЕНИКС N2)", () => {
    const sku = new Map([["1|2026-10-12", 100], ["2|2026-10-12", 50], ["1|2026-10-13", 100], ["2|2026-10-13", 10]]);
    expect(adsFullDay(daily, { "1": "2026-10-14", "2": "2026-10-14" }, "9", "", sku)).toBe("2026-10-12");
  });
  it("дни до окна не мешают: старая несобранная кампания не обнуляет результат", () =>
    expect(adsFullDay([{ d: "2026-07-01", id: "3", sp: 10 }, ...daily], { "1": "2026-10-14", "2": "2026-10-14" }, "9", "2026-10-08")).toBe("2026-10-13"));
  it("принятое свежее окно не блокируется старым full-window checkpoint", () => {
    const sku = new Map([["1|2026-10-12",100],["2|2026-10-12",50],["1|2026-10-13",100],["2|2026-10-13",50]]);
    const state = {"1":"2026-10-14","2":"2026-10-13"};
    const rec = {"2":{loaded_at:"2026-10-14T07:00:00Z",accepted_windows:[{from:"2026-10-13",to:"2026-10-13",loaded_at:"2026-10-14T07:00:00Z"}]}};
    expect(adsFullDay(daily,state,"9","",sku,rec)).toBe("2026-10-13");
    expect(state["2"]).toBe("2026-10-13");
    expect(adsFullDay(daily,state,"9","",undefined,rec)).toBe("2026-10-12");
    sku.set("2|2026-10-13",10);
    expect(adsFullDay(daily,state,"9","",sku,rec)).toBe("2026-10-12");
  });
  it("receipt не заменяет проверку закрытого дня, диапазона и суммы", () => {
    const sku = new Map([["1|2026-10-12",100],["2|2026-10-12",50],["1|2026-10-13",100],["2|2026-10-13",50]]);
    const state = {"1":"2026-10-14","2":"2026-10-13"};
    for (const r of [
      {loaded_at:"2026-10-13T12:00:00Z",accepted_windows:[{from:"2026-10-13",to:"2026-10-13",loaded_at:"2026-10-13T12:00:00Z"}]},
      {loaded_at:"2026-10-14T07:00:00Z",accepted_windows:[{from:"2026-10-12",to:"2026-10-12",loaded_at:"2026-10-14T07:00:00Z"}]},
      {loaded_at:"2026-10-14T07:00:00Z",accepted_windows:[{from:"2026-00-01",to:"2026-99-01",loaded_at:"2026-10-14T07:00:00Z"}]},
    ]) expect(adsFullDay(daily,state,"9","",sku,{"2":r as any})).toBe("2026-10-12");
  });
});

describe("storeNeed / monthGoal - цель магазина по пути, а не по прямой (ФЕНИКС G2, G3)", () => {
  it("к 17.10 нужно по пути цели: база 3 дня + прирост 1 дня", () => expect(storeNeed(OCT, 3)).toBeCloseTo(300 / 31 * 3 + 55 / 15));
  it("за 14 дней - 179", () => expect(Math.round(storeNeed(OCT, 14))).toBe(179));
  const goal = { units: { oct: OCT, nov: { mid: 409, lo: 290, hi: 568 } }, turn_mln: { oct: OCT, nov: OCT }, pay_mln: { oct: OCT, nov: OCT }, nov_rollback: { units: 1, pay_mln: 1 } };
  it("октябрь - путь октября", () => expect(monthGoal(goal, "2026-10-13")!.units).toBeCloseTo(300 / 31 * 13));
  it("03.11 - цель ноября за 3 дня, а не октябрь (иначе 1 705%)", () => {
    const g = monthGoal(goal, "2026-11-03")!; expect(g.month).toBe("nov"); expect(g.from).toBe("2026-11-01"); expect(g.units).toBeCloseTo(409 / 30 * 3);
  });
  it("вне октября-ноября - нет цели", () => expect(monthGoal(goal, "2026-12-01")).toBeNull());
});

describe("orderDay - день заказа по Москве", () => {
  it("22:30 UTC - уже следующий день по Москве", () => expect(orderDay({ d: "2026-10-15", t: "2026-10-15T22:30:00Z" })).toBe("2026-10-16"));
  it("20:59 UTC - тот же день", () => expect(orderDay({ d: "2026-10-15", t: "2026-10-15T20:59:00.000Z" })).toBe("2026-10-15"));
  it("нет времени - дата как была", () => expect(orderDay({ d: "2026-10-15" })).toBe("2026-10-15"));
});

describe("decisionWarn - день решения без последнего дня окна (ФЕНИКС N8, Codex P1)", () => {
  it("29.10, заказы по 27.10 - предупреждение есть", () => {
    expect(decisionWarn("2026-10-29", "2026-10-29", "2026-10-27", "2026-10-28")).toContain("за 28.10 данных ещё нет");
  });
  it("29.10, заказы по 28.10 - предупреждения нет", () => expect(decisionWarn("2026-10-29", "2026-10-29", "2026-10-28", "2026-10-28")).toBe(""));
  it("до дня решения - предупреждения нет", () => expect(decisionWarn("2026-10-28", "2026-10-29", "2026-10-26", "2026-10-28")).toBe(""));
  it("заказов нет вовсе - предупреждение есть", () => expect(decisionWarn("2026-10-30", "2026-10-29", "", "2026-10-28")).not.toBe(""));
});

describe("cabinetCheck - сверка «Заказано, шт» с кабинетом по каждой карточке (ФЕНИКС S1)", () => {
  const ours = new Map([["1|2026-10-15", 10], ["2|2026-10-15", 3], ["3|2026-10-15", 5]]);
  const cards = [["1", "2"], ["3"]];
  const full = [{ date: "2026-10-15", sku: "1", units: 10 }, { date: "2026-10-15", sku: "2", units: 3 }, { date: "2026-10-15", sku: "3", units: 5 }];
  it("полная выгрузка, всё сходится - в допуске", () => {
    const r = cabinetCheck(full, ours, "2026-10-15", "2026-10-28", cards)!;
    expect(r.ok).toBe(true); expect(r.full).toBe(true); expect(r.cards.map((x) => [x.cab, x.ours])).toEqual([[13, 13], [5, 5]]);
  });
  it("+3 и -3 по двум карточкам не гасят друг друга", () => {
    const r = cabinetCheck([{ date: "2026-10-15", sku: "1", units: 13 }, { date: "2026-10-15", sku: "2", units: 3 }, { date: "2026-10-15", sku: "3", units: 2 }], ours, "2026-10-15", "2026-10-28", cards)!;
    expect(r.ok).toBe(false); expect(r.cards.map((x) => x.ok)).toEqual([false, false]);
  });
  it("неполная выгрузка - не «в допуске», охват виден", () => {
    const r = cabinetCheck(full.slice(0, 2), ours, "2026-10-15", "2026-10-28", cards)!;
    expect(r.full).toBe(false); expect(r.ok).toBe(false); expect([r.cards[1]!.have, r.cards[1]!.need]).toEqual([0, 1]);
  });
  it("повтор «дата + товар» - берётся последняя строка, не сумма (Codex P2)", () => {
    const r = cabinetCheck([...full, { date: "2026-10-15", sku: "3", units: 1 }, { date: "2026-10-15", sku: "3", units: 5 }], ours, "2026-10-15", "2026-10-28", cards)!;
    expect(r.cards[1]!.cab).toBe(5); expect(r.ok).toBe(true);
  });
  it("вне окна - сверки нет", () => expect(cabinetCheck([{ date: "2026-10-01", sku: "1", units: 9 }], ours, "2026-10-15", "2026-10-28", cards)).toBeNull());
  // ФЕНИКС B1c: охват - все дни от начала окна до конца выгрузки, а не дни, которые в выгрузке есть
  const day = (date: string, ts?: string) => [{ date, sku: "1", units: 0, ts }, { date, sku: "2", units: 0, ts }, { date, sku: "3", units: 0, ts }];
  const zero = new Map<string, number>();
  it("пропущен день внутри выгрузки - не «в допуске»", () => {
    const r = cabinetCheck([...day("2026-10-15"), ...day("2026-10-16"), ...day("2026-10-18")], zero, "2026-10-15", "2026-10-28", cards)!;
    expect(r.days).toEqual(["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(r.full).toBe(false); expect(r.ok).toBe(false); expect([r.cards[0]!.have, r.cards[0]!.need]).toEqual([6, 8]);
  });
  it("выгрузка короче «по вчера» от времени съёма - не «в допуске»", () => {
    const ts = "2026-10-22T05:10:00Z";   // 22.10 08:10 МСК: нужны дни 15-21.10
    const r = cabinetCheck(["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"].flatMap((d) => day(d, ts)), zero, "2026-10-15", "2026-10-28", cards)!;
    expect(r.days).toHaveLength(7); expect(r.full).toBe(false);
  });
  it("полная выгрузка по вчера - в допуске; конец не дальше последнего дня заказов", () => {
    const ts = "2026-10-17T05:00:00Z";
    expect(cabinetCheck([...day("2026-10-15", ts), ...day("2026-10-16", ts)], zero, "2026-10-15", "2026-10-28", cards)!.ok).toBe(true);
    expect(cabinetCheck([...day("2026-10-15", ts), ...day("2026-10-16", ts)], zero, "2026-10-15", "2026-10-15", cards)!.days).toEqual(["2026-10-15"]);
  });
  it("в окне только незакрытый день съёма - сверки нет", () =>
    expect(cabinetCheck(day("2026-10-15", "2026-10-15T17:00:00Z"), zero, "2026-10-15", "2026-10-28", cards)).toBeNull());
});

describe("эталоны спеки ozon-plan-15-10 v2 (Иван 15.10 «да»), на замороженной выборке 15.10 (ФЕНИКС G1)", () => {
  // Выборка заморожена: живые данные двигают поздние отмены (TRUBIS 160 за сутки 50 -> 49), тест на них краснел бы без правки кода (E083).
  const R = readFileSync("src/scripts/__fixtures__/plan-golden-orders.ndjson", "utf-8").split("\n").filter(Boolean)
    .map((l) => JSON.parse(l) as { d: string; status: string; sku: string; units: number });
  const card = JSON.parse(readFileSync("src/scripts/__fixtures__/plan-golden-card.json", "utf-8")) as { trubis160_skus: string[] };
  it("магазин 01-13.10 без отмен, день UTC - 137", () => expect(netUnits(R, "2026-10-01", "2026-10-13")).toBe(137));
  it("TRUBIS 160, вся объединённая карточка (48 товаров), 14.09-11.10 без отмен - 49", () => {
    expect(card.trubis160_skus).toHaveLength(48);
    expect(netUnits(R, "2026-09-14", "2026-10-11", new Set(card.trubis160_skus))).toBe(49);
  });
});

describe("цена по датам (Иван 15.10: было 14.10; Иван 20.10: только смены цены, без колонок дат)", () => {
  const h = new Map([["A", new Map([["2026-10-13", 100], ["2026-10-14", 100], ["2026-10-15", 100], ["2026-10-16", 90], ["2026-10-17", 90], ["2026-10-19", 100]])],
    ["B", new Map([["2026-10-12", 50], ["2026-10-18", 45]])]]);
  it("priceAt - последняя цена не позже дня", () => {
    expect(priceAt(h.get("B"), "2026-10-14")).toBe(50); expect(priceAt(h.get("A"), "2026-10-16")).toBe(90); expect(priceAt(h.get("B"), "2026-10-01")).toBeNull();
  });
  it("смены: только дни, когда цена отличается от предыдущего наблюдения, с новой ценой; возврат к старой - тоже смена", () =>
    expect(priceChanges(h.get("A"), "2026-10-14")).toEqual([{ d: "2026-10-16", price: 90 }, { d: "2026-10-19", price: 100 }]));
  it("смена без наблюдения 14.10 считается от последней цены до базы", () => expect(priceChanges(h.get("B"), "2026-10-14")).toEqual([{ d: "2026-10-18", price: 45 }]));
  it("без смен - пусто; нет истории - пусто", () => {
    expect(priceChanges(new Map([["2026-10-14", 1], ["2026-10-15", 1]]), "2026-10-14")).toEqual([]);
    expect(priceChanges(undefined, "2026-10-14")).toEqual([]);
  });
});

describe("wkDelta - дельта заказов артикула в шт/нед, окна разной длины приводятся к неделе (Иван 20.10)", () => {
  it("8 шт за 14 дн против 7 шт за 4 дн: 12,3 - 4,0 = +8,3 в неделю", () => expect(wkDelta(8, 14, 7, 4)).toBe(8.3));
  it("одинаковый темп - 0", () => expect(wkDelta(14, 14, 4, 4)).toBe(0));
  it("нет дней окна с 15.10 - null, не 0 (К7)", () => { expect(wkDelta(5, 14, 0, 0)).toBeNull(); expect(wkDelta(5, 0, 1, 4)).toBeNull(); });
});

describe("ordWindow - сумма заказов и дни из одного окна, конец не позже 28.10 (Codex #490 P2, ФЕНИКС #490 G1)", () => {
  it("заказы по 18.10 - окно 15-18.10, 4 дня", () => expect(ordWindow("2026-10-15", "2026-10-28", "2026-10-18")).toEqual({ end: "2026-10-18", days: 4 }));
  it("заказы по 29.10 и дальше - окно режется концом плана 28.10, 14 дней, сумма тоже до 28.10", () => {
    expect(ordWindow("2026-10-15", "2026-10-28", "2026-10-29")).toEqual({ end: "2026-10-28", days: 14 });
    expect(ordWindow("2026-10-15", "2026-10-28", "2026-11-05")).toEqual({ end: "2026-10-28", days: 14 });
  });
  it("заказов с 15.10 ещё нет - пустое окно, 0 дней", () => {
    expect(ordWindow("2026-10-15", "2026-10-28", "2026-10-14")).toEqual({ end: "", days: 0 });
    expect(ordWindow("2026-10-15", "2026-10-28", "")).toEqual({ end: "", days: 0 });
  });
});

describe("deltaNote - Δ серым с причиной, пока данных мало или цена в окне не менялась (ФЕНИКС #490 G2)", () => {
  it("окно короче порога дней", () => expect(deltaNote(8, 7, 4, true)).toBe(`мало данных: окно 4 дн, нужно ${DELTA_MIN_DAYS}`));
  it("заказов в двух окнах меньше порога", () => expect(deltaNote(2, 1, 7, true)).toBe(`мало данных: заказов 3, нужно ${DELTA_MIN_ORDERS}`));
  it("цена в окне заказов не менялась", () => expect(deltaNote(4, 3, 7, false)).toBe("цена в окне не менялась"));
  it("нет дней окна", () => expect(deltaNote(4, null, 0, true)).toBe("нет дней окна"));
  it("данных хватает - null, Δ как есть", () => expect(deltaNote(4, 3, 7, true)).toBeNull());
});

describe("план v2 - корректировка Ивана 15.10", () => {
  const P = JSON.parse(readFileSync("data/plan_2026-10-15_v2.json", "utf-8")) as { cards: Array<{ short: string; n_min: number; min_arts: string[] }>; price: Array<{ art: string; when: string; price_new: number }> };
  const OUT = ["GGT-03-3-1-E-12080", "GGM-08-3-M", "GGM-24-3", "GGK-02-3-5-80", "GGL-11"];
  it("выведенных артикулов нет в минимальном клике, n_min = числу товаров", () => {
    for (const c of P.cards) { expect(c.n_min).toBe(c.min_arts.length); for (const a of OUT) expect(c.min_arts).not.toContain(a); }
    expect(P.cards.reduce((a, c) => a + c.n_min, 0)).toBe(61 - 27);
  });
  it("GGT-12-2 убран, TRUBIS 160 снижается с 15.10 до 87 210", () => {
    expect(P.price.map((p) => p.art)).not.toContain("GGT-12-2");
    expect(P.price.find((p) => p.art === "GGT-03-3-3-E-16080")).toMatchObject({ when: "15.10", price_new: 87210 });
    expect(P.price).toHaveLength(25);
  });
});

describe("состав карточек плана заморожен на 15.10 (Иван 16.10: новые GGT-03-5-1 в план не считать)", () => {
  const fz = JSON.parse(readFileSync(`data/${PLAN_CARDS_FILE}`, "utf-8")) as { imported_at: string; groups: Array<{ skus: Array<{ offer: string }> }> };
  it("страница плана читает замороженный файл, не ночную карту", () => expect(PLAN_CARDS_FILE).toBe("plan_card_groups_1510.json"));
  it("в замороженном составе выгрузка 23.09 и нет новых GGT-03-5-1", () => {
    expect(fz.imported_at).toBe("2026-09-23");
    const offers = fz.groups.flatMap((g) => g.skus.map((s) => s.offer));
    expect(offers).toHaveLength(498);
    expect(offers.filter((o) => o.startsWith("GGT-03-5-1") && o !== "GGT-03-5-1-O-20090")).toEqual([]);
  });
});

describe("план v4 - Иван 16.10: QUATRIS и PROFIX на -10% от цены 14.10 с 16.10", () => {
  type Pr = { art: string; when: string; price_now: number; price_new: number };
  type V = { cards: unknown[]; withdrawn: string[]; price: Pr[]; start: string; check: string };
  const v3 = JSON.parse(readFileSync("data/plan_2026-10-15_v3.json", "utf-8")) as V;
  const v4 = JSON.parse(readFileSync("data/plan_2026-10-15_v4.json", "utf-8")) as V;
  const ARTS = ["GGT-48-2-2-100-180", "GGT-48-3-3-100-180", "GGT-48-5-1-100-180", "GGT-46-2-2-100", "GGT-46-3-3-100", "GGT-46-5-1-100"];
  it("страница читает v4", () => expect(PLAN_FILE).toBe("plan_2026-10-15_v4.json"));
  it("6 артикулов с 16.10, цена 14.10 и -10% до 10 ₽, без дублей", () => {
    const r = v4.price.filter((p) => p.when === "16.10");
    expect(r.map((p) => p.art).sort()).toEqual([...ARTS].sort());
    expect(new Set(v4.price.map((p) => p.art)).size).toBe(v4.price.length);
    expect(v4.price).toHaveLength(29);
    expect(v4.price.find((p) => p.art === "GGT-48-2-2-100-180")).toMatchObject({ price_now: 79282, price_new: 71350 });
    for (const p of r) { expect(p.price_new % 10).toBe(0); expect(Math.abs(p.price_new / p.price_now - 0.9)).toBeLessThan(0.001); }
  });
  it("остальное как в v3: карточки, выводимые, окно, прочие строки цены", () => {
    expect(v4.cards).toEqual(v3.cards); expect(v4.withdrawn).toEqual(v3.withdrawn);
    expect([v4.start, v4.check]).toEqual([v3.start, v3.check]);
    expect(v4.price.filter((p) => !ARTS.includes(p.art))).toEqual(v3.price.filter((p) => !ARTS.includes(p.art)));
  });
  it("подпись под плашками: число артикулов по датам, по порядку", () =>
    expect(priceWhen(v4.price)).toEqual([["15.10", 14], ["16.10", 6], ["22.10", 9]]));
});

describe("план v3 - V3, Иван 15.10 «б»: выводимые вне карточки, пороги правилом 15%", () => {
  type C = { short: string; threshold: number; threshold_price: number | null; u_wk_base: number };
  const v2 = JSON.parse(readFileSync("data/plan_2026-10-15_v2.json", "utf-8")) as { cards: C[] };
  const v3 = JSON.parse(readFileSync("data/plan_2026-10-15_v3.json", "utf-8")) as { cards: C[]; withdrawn: string[] };
  it("27 выводимых артикулов", () => { expect(v3.withdrawn).toHaveLength(27); expect(v3.withdrawn).toContain("GGM-24-3"); });
  it("пороги: 5 карточек пересчитаны, у остальных как в Excel", () => {
    const thr = Object.fromEntries(v3.cards.map((c) => [c.short, [c.threshold, c.threshold_price]]));
    expect(thr).toMatchObject({ KUVINO: [18, 20], EVELIX: [12, 14], OSOLIS: [10, 11], ARFEO: [5, 6], ARKIS: [5, 6] });
    const same = ["TRUBIS 160", "KONUX", "GENTRIS", "TRUBIS L120", "OZEVIS"];
    for (const c of v3.cards.filter((c) => same.includes(c.short))) expect(c).toEqual(v2.cards.find((x) => x.short === c.short));
  });
});

describe("priceStatus - статус цены по факту, а не «ждём» (Иван 15.10)", () => {
  it("в день смены уже снижена до целевой - «снижена»", () => expect(priceStatus(75905, 79900, 75900, "2026-10-15", "2026-10-15")).toEqual({ key: "снижена", text: "снижена -5,0%" }));
  it("снижена наполовину - «частично» с фактом и целью", () => expect(priceStatus(115900, 121898, 109710, "2026-10-15", "2026-10-15")).toEqual({ key: "частично", text: "частично: -4,9% из -10,0%" }));
  it("срок не наступил, цена та же - «по плану с ДД.ММ»", () => expect(priceStatus(48900, 48900, 44010, "2026-10-22", "2026-10-15").text).toBe("по плану с 22.10"));
  it("в сам день смены цена та же - «сегодня, пока не снижена», не красное", () => expect(priceStatus(96898, 96898, 87210, "2026-10-15", "2026-10-15")).toEqual({ key: "по плану", text: "сегодня 15.10: пока не снижена" }));
  it("срок прошёл, цена та же - «не снижена»", () => expect(priceStatus(96898, 96898, 87210, "2026-10-15", "2026-10-16").key).toBe("не снижена"));
  it("раньше срока частично - видно сразу", () => expect(priceStatus(80091, 80900, 72810, "2026-10-22", "2026-10-15").key).toBe("частично"));
  it("нет цены", () => expect(priceStatus(null, 1, 1, "2026-10-15", "2026-10-15").key).toBe("нет цены"));
});

describe("спидометры: период с 15.10 по конец месяца (Иван 15.10)", () => {
  it("период - с 15.10 по 31.10, с ноября - месяц целиком; last - последний день данных в периоде", () => {
    expect(gaugePeriod("2026-10-14", "2026-10-15")).toEqual({ from: "2026-10-15", to: "2026-10-31", last: "" });
    expect(gaugePeriod("2026-10-20", "2026-10-15")).toEqual({ from: "2026-10-15", to: "2026-10-31", last: "2026-10-20" });
    expect(gaugePeriod("2026-11-03", "2026-10-15")).toEqual({ from: "2026-11-01", to: "2026-11-30", last: "2026-11-03" });
    expect(gaugePeriod("", "2026-10-15")).toEqual({ from: "2026-10-15", to: "2026-10-31", last: "" });
  });
  it("план магазина на день: сумма за 15-31.10 = цель октября минус путь к 14.10", () => {
    const g = { oct: { lo: 300, mid: 355, hi: 429 }, nov: { lo: 290, mid: 409, hi: 568 } };
    const t = drange("2026-10-15", "2026-10-31").reduce((a, d) => a + storeGoalDay(g, d), 0);
    expect(t).toBeCloseTo(355 - goalPath(g.oct, 14, "mid"), 6); expect(storeGoalDay(g, "2026-11-05")).toBeCloseTo(409 / 30, 6);
  });
  it("план карточки на день: до 15.10 база/7, с 15.10 порог/14", () => {
    const c = { u_wk_base: 7, threshold: 28 };
    expect(cardPlanDay(c, "2026-10-14", "2026-10-15")).toBe(1); expect(cardPlanDay(c, "2026-10-15", "2026-10-15")).toBe(2);
  });
  it("конец месяца", () => { expect(monthEnd("2026-10-01")).toBe("2026-10-31"); expect(monthEnd("2026-11-01")).toBe("2026-11-30"); });
});

describe("weekSum / daysIn", () => {
  const m = new Map([["2026-10-15", 100], ["2026-10-16", 50]]);
  it("неделя после последнего дня источника - null, а не ноль", () => expect(weekSum(m, "2026-10-22", "2026-10-28", "2026-10-16")).toBeNull());
  it("неполная неделя обрезается последним днём и знает число дней", () => expect(weekSum(m, "2026-10-15", "2026-10-21", "2026-10-16")).toEqual([150, 2]));
  it("внутри полного окна день без строки - ноль (кампания не тратила); неполные дни отрезает adsFullDay", () => expect(weekSum(m, "2026-10-15", "2026-10-21", "2026-10-17")).toEqual([150, 3]));
  it("daysIn ограничен 0..14", () => {
    expect(daysIn("2026-10-15", "")).toBe(0); expect(daysIn("2026-10-15", "2026-10-15")).toBe(1); expect(daysIn("2026-10-15", "2026-11-30")).toBe(14);
  });
  it("drange включает оба конца", () => expect(drange("2026-10-30", "2026-11-01")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]));
});

// ---------- сборка на маленьком наборе данных
function fixture(extra: Record<string, unknown[]> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "plan-"));
  const nd = (f: string, rows: unknown[]) => writeFileSync(join(dir, f), rows.map((r) => JSON.stringify(r)).join("\n"));
  const tri = { mid: 1, lo: 1, hi: 1 };
  writeFileSync(join(dir, PLAN_FILE), JSON.stringify({
    start: "2026-10-15", check: "2026-10-29", window: ["2026-10-15", "2026-10-28"], min_budget_sku: 1500, min_campaign_budget: 2000,
    cards: [{ main_art: "A-1", short: "АЛЬФА", name: "", u_wk_base: 2, click_new: 20000, n_min: 1, threshold: 6, threshold_price: null, min_arts: ["A-2"] }],
    withdrawn: extra.withdrawn,
    to_min: [{ cid: "77", art: "Z-1" }],
    price: [{ art: "A-1", name: "", when: "15.10", price_now: 1000, price_new: 900, step: "-10%" }],
    goal: { units: { oct: OCT, nov: OCT }, turn_mln: { oct: tri, nov: tri }, pay_mln: { oct: tri, nov: tri }, nov_rollback: { units: 1, pay_mln: 1 } },
  }));
  writeFileSync(join(dir, PLAN_CARDS_FILE), JSON.stringify({ groups: [{ main: "1", skus: [{ sku: "1", offer: "A-1" }, { sku: "2", offer: "A-2" }] }] }));
  nd("sku_views.ndjson", [
    { date: "2026-10-15", sku: "1", views: 100, vsearch: 50, pdp: 10, cart: 2, units: 1 },
    { date: "2026-10-15", sku: "9", views: 900, vsearch: 500, pdp: 90, cart: 8, units: 3 },
  ]);
  nd("orders_daily.ndjson", extra.orders ?? [
    { d: "2026-10-15", status: "delivered", sku: "1", units: 2, revenue: 1000 },
    { d: "2026-10-15", status: "cancelled", sku: "2", units: 5, revenue: 5000 },
    { d: "2026-10-16", status: "awaiting_deliver", sku: "2", units: 1, revenue: 900 },
    { d: "2026-10-16", status: "delivered", sku: "9", units: 4, revenue: 100 },
  ]);
  nd("ads_sku_daily.ndjson", [
    { d: "2026-10-15", cid: "5", sku: "1", sp: 3000 }, { d: "2026-10-15", cid: "77", sku: "8", sp: 2500 },
    { d: "2026-10-15", cid: "28753239", sku: "1", sp: 99999 }, { d: "2026-10-15", cid: "77", sku: "1", sp: 400 },
    { d: "2026-10-16", cid: "77", sku: "8", sp: 2600 },
  ]);
  nd("ads_daily.ndjson", (extra.adsDaily as unknown[] | undefined ?? []).concat([{ d: "2026-10-15", id: "5", sp: 3000, cl: 40 }, { d: "2026-10-15", id: "77", sp: 2500, cl: 10 },
    { d: "2026-10-16", id: "5", sp: 1000, cl: 10 }, { d: "2026-10-16", id: "77", sp: 2600, cl: 10 }]));
  writeFileSync(join(dir, "ads_sku_state.json"), JSON.stringify({ "5": "2026-10-16", "77": "2026-10-17" }));
  nd("prices_daily.ndjson", [{ d: "2026-10-16", offer: "A-1", price: 1000 }]);
  nd("gap_daily.ndjson", extra.gap ?? [{ date: "2026-10-16", art: "A-1", gap_pct: 5 }]);
  nd("funnel_tests.ndjson", []);
  if (extra.cab) nd(CAB_FILE, extra.cab);
  return (f: string) => join(dir, f);
}
const pd = (js: string) => JSON.parse(js.slice("window.PD=".length, js.indexOf(";\n")));

describe("planBlock", () => {
  it('uses closed native observations in plan funnel and position without advancing its order calendar',()=>{
    const f=fixture();
    writeFileSync(f('cabinet_capture.json'),JSON.stringify({version:1,company:'GENGLASS',snapshots:[{
      version:1,company:'GENGLASS',day:'2026-10-15',captured_at:'2026-10-16T06:00:00+03:00',phase:'утро',day_in_progress:false,
      scope:{expected:1,received:1,matched:1,missing:0,extra:0,status:'complete'},
      totals:{views:20,search_views:10,pdp_views:2,cart:1,ordered_units:0},
      items:[{sku:'1',scheme:null,views:20,search_views:10,pdp_views:2,cart:1,ordered_units:0,search_position:12}],
      source:'ozon-native-daily-product-report',not_refreshed:['card_price']
    }]}));
    const d=pd(planBlock('2026-10-17',f)!.js),i=d.days.indexOf('2026-10-15');
    expect(d.ser[0].views[i]).toBe(20);expect(d.ser[0].pos[i]).toBe(12);
    expect(d.store.views[i]).toBe(920);expect(d.ser[0].orders[i]).toBe(2);
    expect(d.od_last).toBe('2026-10-16');
    const input=JSON.parse(readFileSync(f('cabinet_capture.json'),'utf8'));
    input.snapshots[0].day_in_progress=true;
    writeFileSync(f('cabinet_capture.json'),JSON.stringify(input));
    const partial=pd(planBlock('2026-10-17',f)!.js);
    expect(partial.ser[0].views[i]).toBe(100);expect(partial.ser[0].pos[i]).toBeNull();
  });
  it('shows current native day in plan charts while closed facts remain unchanged',()=>{
    const f=fixture(),before=pd(planBlock('2026-10-29',f)!.js);
    writeFileSync(f('cabinet_capture.json'),JSON.stringify({version:1,company:'GENGLASS',snapshots:[{
      version:1,company:'GENGLASS',day:'2026-10-29',captured_at:'2026-10-29T09:18:00Z',phase:'утро',day_in_progress:true,
      scope:{expected:1,received:1,matched:1,missing:0,extra:0,status:'complete'},
      totals:{views:20,search_views:10,pdp_views:2,cart:1,ordered_units:0},
      items:[{sku:'1',scheme:null,views:20,search_views:10,pdp_views:2,cart:1,ordered_units:0,search_position:12}],
      source:'ozon-native-daily-product-report',not_refreshed:['card_price']
    }]}));
    const block=planBlock('2026-10-29',f)!,after=pd(block.js);
    for(const k of ['ser','store','gauges','cards_win','od_last','sv_last'])expect(after[k]).toEqual(before[k]);
    const dom=new JSDOM(`<body>${block.html}<script>${block.js}</script>`,{runScripts:'dangerously'});
    const doc=dom.window.document;
    expect(doc.querySelector('#pt-dynchart')!.textContent).toContain('29.10');
    expect(doc.querySelector('#pt-dynchart')!.textContent).toContain('12:18');
    expect(doc.querySelector('#pt-dynchart [data-partial-day="2026-10-29"]')?.getAttribute('data-value')).toBe('10');
    let buttons=Array.from(doc.querySelectorAll('#pt-metsel button')) as any[];
    buttons.find(b=>b.textContent==='Показы всего')!.click();
    expect(doc.querySelector('#pt-dynchart [data-partial-day]')?.getAttribute('data-value')).toBe('20');
    buttons=Array.from(doc.querySelectorAll('#pt-metsel button')) as any[];
    buttons.find(b=>b.textContent==='Расход на клики, ₽')!.click();
    expect(doc.querySelector('#pt-dynchart [data-partial-day]')).toBeNull();
    expect(doc.querySelector('#pt-dyntbl')!.textContent).toContain('29.10 · неполный день');
    dom.window.close();
  });
  it("нет файла плана - блока нет, страница собирается без него", () => {
    const dir = mkdtempSync(join(tmpdir(), "plan-none-"));
    expect(planBlock("2026-10-16", (f) => join(dir, f))).toBeNull();
  });
  it("заказы карточки - все её товары без отмен; магазин - все товары", () => {
    const b = planBlock("2026-10-17", fixture())!;
    const D = pd(b.js); const j = D.days.indexOf("2026-10-15"), k = D.days.indexOf("2026-10-16");
    expect(D.ser[0].orders[j]).toBe(2);           // отмена 5 шт не считается
    expect(D.ser[0].orders[k]).toBe(1);           // второй товар карточки идёт в карточку
    expect(D.store.orders[k]).toBe(5);
    expect(D.ser[0].orders[k + 1]).toBeNull();    // после последнего дня источника - пропуск, не ноль
  });
  it("спидометры: факт с 15.10 против плана 15-31.10, метка - план на последний день; реклама - все клики", () => {
    const G = pd(planBlock("2026-10-17", fixture())!.js).gauges;
    expect(G.cards).toMatchObject({ from: "2026-10-15", to: "2026-10-31", last: "2026-10-16", fact: 3, plan: Math.round(17 * 6 / 14 * 10) / 10, plan_td: Math.round(2 * 6 / 14 * 10) / 10, ref: null });
    expect(G.ads).toMatchObject({ fact: 3000 + 2500 + 1000 + 2600, plan_wk: 20000 + 1500 + 2000 });
    expect(G.ads.plan).toBe(Math.round((G.ads.plan_wk + G.ads.other_wk) / 7 * 17));
  });
  it("скидка OZON: было на 14.10, стало по последнему срезу, разница в п.п. (Иван 15.10)", () => {
    const html = planBlock("2026-10-17", fixture({ gap: [{ date: "2026-10-13", art: "A-1", gap_pct: 30 }, { date: "2026-10-14", art: "A-1", gap_pct: 20 }, { date: "2026-10-16", art: "A-1", gap_pct: 5 }] }))!.html;
    const row = html.slice(html.indexOf("Скидка OZON сейчас"));
    expect(row).toContain(">20,0%<"); expect(row).toContain(">5,0%<"); expect(row).toContain("-15,0 п.п."); expect(row).toContain("OZON не доплачивает?");
  });
  it("данные до 15.10 - только справочно: в факт и план периода не входят (Иван 15.10)", () => {
    const orders = [{ d: "2026-10-10", status: "delivered", sku: "1", units: 7, revenue: 7000 }, { d: "2026-10-15", status: "delivered", sku: "1", units: 2, revenue: 1000 },
      { d: "2026-10-16", status: "delivered", sku: "9", units: 4, revenue: 100 }];
    const G = pd(planBlock("2026-10-17", fixture({ orders, adsDaily: [{ d: "2026-10-10", id: "5", sp: 50000, cl: 1 }] }))!.js).gauges;
    expect(G.cards).toMatchObject({ fact: 2, ref: { from: "2026-10-01", to: "2026-10-14", fact: 7 } });
    expect(G.store).toMatchObject({ fact: 6, ref: { fact: 7 } });
    expect(G.ads.fact).toBe(9100); expect(G.ads.ref.fact).toBe(50000);
    expect(G.ads.plan).toBe(Math.round((G.ads.plan_wk + G.ads.other_wk) / 7 * 17));   // план периода - ставка × 17 дней, расход 01-14.10 в него не входит (кроме темпа прочих кампаний за 01-13.10)
  });
  it("выводимый товар не идёт в карточку, но идёт в магазин (Иван 15.10 «б»)", () => {
    const b = planBlock("2026-10-17", fixture({ withdrawn: ["A-2"] }))!;
    const D = pd(b.js); const k = D.days.indexOf("2026-10-16");
    expect(D.ser[0].orders[k]).toBe(0); expect(D.store.orders[k]).toBe(5);
    expect(b.warnings.filter((w) => w.includes("выводим"))).toEqual([]);
  });
  it("клик главного: без «Оплаты за заказ» и без кампаний на минимум; день, где кампания 5 не собрана, отрезан", () => {
    const D = pd(planBlock("2026-10-17", fixture())!.js);
    expect(D.ad_last).toBe("2026-10-15");                 // 16.10 у кампании 5 ещё нет строк по товарам
    expect(D.spend[0].rows[0].w[1]).toEqual([3000, 1]);    // 400 ₽ кампании 77 на главном не задваиваются
  });
  it("11 кампаний - по дням кампаний (ads_daily), полные дни", () => {
    const D = pd(planBlock("2026-10-17", fixture())!.js);
    expect(D.spend[2].rows[0].w[1]).toEqual([5100, 2]);
  });
  it("CPC магазина: расход и клики из одного источника", () => {
    const D = pd(planBlock("2026-10-17", fixture())!.js); const j = D.days.indexOf("2026-10-16");
    expect(D.store.sp[j]).toBe(3600); expect(D.store.clk[j]).toBe(20);
  });
  it("цена не снижена и OZON не доплачивает - видно в статусах", () => {
    const D = pd(planBlock("2026-10-17", fixture())!.js);
    expect(D.price_st["не снижена"]).toBe(1);
    expect(D.price_st.eb).toBe(1);
  });
  it("на корректных данных предупреждений инварианта нет", () => {
    expect(planBlock("2026-10-17", fixture())!.warnings).toEqual([]);
  });
  it("заказ после 21:00 UTC последнего дня выгрузки - день по МСК неполный, ждёт сбора (ФЕНИКС N1)", () => {
    const f = fixture({ orders: [
      { d: "2026-10-16", t: "2026-10-16T10:00:00Z", status: "delivered", sku: "1", units: 1, revenue: 1 },
      { d: "2026-10-16", t: "2026-10-16T22:30:00Z", status: "delivered", sku: "1", units: 1, revenue: 1 },
    ] });
    const D = pd(planBlock("2026-10-17", f)!.js);
    expect(D.od_last).toBe("2026-10-16");
    expect(D.ser[0].orders[D.days.indexOf("2026-10-16")]).toBe(1);
  });
  it("в чипе видна дата заказов; в день решения без 28.10 - заметное предупреждение (N8)", () => {
    const b = planBlock("2026-10-29", fixture())!;
    expect(b.html).toContain("заказы по 16.10");
    expect(b.html).toContain("pt-decide");
    expect(planBlock("2026-10-17", fixture())!.html).not.toContain("pt-decide");
  });
  it("сверка с кабинетом: в допуске - строка в «Как считаем», без предупреждения; мимо - предупреждение", () => {
    const ok = planBlock("2026-10-17", fixture({ cab: [{ date: "2026-10-15", sku: "1", ordered_units: 2 }, { date: "2026-10-15", sku: "2", ordered_units: 5 }] }))!;
    expect(ok.html).toContain("Сверка с кабинетом");
    expect(ok.warnings).toEqual([]);
    const bad = planBlock("2026-10-17", fixture({ cab: [{ date: "2026-10-15", sku: "1", ordered_units: 20 }] }))!;
    expect(bad.warnings.join(" ")).toContain("сверка с кабинетом");
    expect(bad.html).toContain("выгрузка неполная - сверка не пройдена");
    expect(bad.html).not.toContain("в допуске (2%");
  });
  it("в данных страницы нет «</script>»", () => {
    expect(planBlock("2026-10-17", fixture())!.js.includes("</script")).toBe(false);
  });
});

// Клиентский скрипт блока исполняется только в браузере: без этого теста 753bf11 (ReferenceError wkLast) прошёл 66/66 (ФЕНИКС T4, E087).
describe("клиент блока в jsdom: скрипт отрабатывает, спидометры заполнены", () => {
  function run(today: string, f = fixture()) {
    const b = planBlock(today, f)!;
    const errs: string[] = [];
    const vc = new VirtualConsole(); vc.on("jsdomError", (e) => errs.push(String(e))); vc.on("error", (e) => errs.push(String(e)));
    const dom = new JSDOM(`<!doctype html><html><head><style>${b.css}</style></head><body>${b.html}<script>${b.js}</script></body></html>`,
      { runScripts: "dangerously", virtualConsole: vc, pretendToBeVisual: true });
    const g = [...dom.window.document.querySelectorAll("#pt-gauges .gauge")].map((x) => x.textContent!.replace(/\s+/g, " "));
    return { errs, g, doc: dom.window.document };
  }
  it("ошибок нет, 5 спидометров, у каждого подпись", () => {
    const r = run("2026-10-17");
    expect(r.errs).toEqual([]); expect(r.g).toHaveLength(5);
    expect(r.g[0]).toContain("Заказы 10 карточек"); expect(r.g[4]).toContain("Реклама, все клики");
  });
  it("«на пути» - по окну решения; 2 дня данных - «рано» (Иван 15.10, ФЕНИКС W5)", () => {
    const r = run("2026-10-17");
    expect(r.g[1]).toContain("окно решения 15.10-28.10"); expect(r.g[1]).toContain("рано");
  });
  it("реклама: факт - все клики за период с 15.10", () => {
    const r = run("2026-10-17");
    expect(r.g[4]).toContain("9 из"); // 9,1 тыс. факта 15-16.10 в тыс. ₽ округлено
  });
  it("цвет зоны под стрелкой = цвет статуса к плану на дату, у всех спидометров (Иван 15.10, ФЕНИКС G1)", () => {
    const days = ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];
    for (const u of [0, 1, 2, 5]) {
      const orders = days.flatMap((d) => [{ d, status: "delivered", sku: "1", units: u, revenue: 1000 * u }, { d, status: "delivered", sku: "9", units: 5, revenue: 5000 }]);
      const b = planBlock("2026-10-19", fixture({ orders }))!;
      const dom = new JSDOM(`<body>${b.html}<script>${b.js}</script></body>`, { runScripts: "dangerously" });
      const gs = [...dom.window.document.querySelectorAll("#pt-gauges .gauge")] as InstanceType<typeof dom.window.HTMLElement>[];
      for (const g of gs) if (g.dataset.st) expect([g.textContent!.slice(0, 20), g.dataset.zone]).toEqual([g.textContent!.slice(0, 20), g.dataset.st]);
      expect(gs.filter((g) => g.dataset.st).length).toBeGreaterThanOrEqual(3);
    }
  });
  // по нарисованному SVG, а не по data-zone: стрелка стоит в видимой дуге цвета статуса (ФЕНИКС G1t, G3; Codex P2 #482)
  const drawnOk = (b: { html: string; js: string }) => {
    const dom = new JSDOM(`<body>${b.html}<script>${b.js}</script></body>`, { runScripts: "dangerously" });
    const bad: string[] = [], sts: string[] = []; let n = 0;
    for (const g of [...dom.window.document.querySelectorAll("#pt-gauges .gauge")] as InstanceType<typeof dom.window.HTMLElement>[]) {
      if (!g.dataset.st || g.dataset.pct === "") continue; n++; sts.push(g.dataset.st);
      const pc = Math.min(150, Number(g.dataset.pct));
      const hit = [...g.querySelectorAll("path[data-z0]")].some((p) => {
        const [m, a] = p.getAttribute("d")!.split(" A"); const end = a!.split(" ").slice(-2).join(" ");
        return p.getAttribute("stroke") === g.dataset.st && Number(p.getAttribute("data-z0")) <= pc && pc <= Number(p.getAttribute("data-z1")) && m!.slice(1) !== end;
      });
      if (!hit) bad.push(g.textContent!.slice(0, 24) + " " + pc.toFixed(2));
      const under = [...g.querySelectorAll("path[data-z0]")].filter((p) => Number(p.getAttribute("data-z0")) <= pc && pc <= Number(p.getAttribute("data-z1"))).map((p) => p.getAttribute("stroke"));
      if (!under.includes(g.dataset.zone!)) bad.push("data-zone " + g.textContent!.slice(0, 24));
    }
    return { bad, n, sts };
  };
  it("стрелка - в нарисованной дуге цвета статуса, сценарии заказов и рекламы", () => {
    const days = ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];
    for (const u of [0, 1, 2, 5]) {
      const orders = days.flatMap((d) => [{ d, status: "delivered", sku: "1", units: u, revenue: 1000 * u }, { d, status: "delivered", sku: "9", units: 5, revenue: 5000 }]);
      const r = drawnOk(planBlock("2026-10-19", fixture({ orders }))!);
      expect(r.bad).toEqual([]); expect(r.n).toBeGreaterThanOrEqual(3);
    }
  });
  it("первый день периода: узкая жёлтая зона не пропадает (Codex P2 #482)", () => {
    // 8 заказов за 15.10: карточки 4,7% и магазин 3,6% шкалы - жёлтые, а жёлтая зона уже 1,4 п. (3,84-5,48 и 3,09-4,42)
    let yellow = 0;
    for (const u of [0, 7, 8, 9]) {
      const orders = [{ d: "2026-10-15", status: "delivered", sku: "1", units: u, revenue: 1000 * u }];
      const r = drawnOk(planBlock("2026-10-16", fixture({ orders }))!);
      expect(r.bad).toEqual([]); if (r.sts.includes("#E5B567")) yellow++;
    }
    expect(yellow).toBe(3);
  });
  it("реклама: перерасход - красная зона, недорасход - зелёная (больше - краснее)", () => {
    const ads = (sp: number) => ["2026-10-15", "2026-10-16", "2026-10-17"].map((d) => ({ d, id: "5", sp, cl: 1 }));
    const zone = (sp: number) => {
      const b = planBlock("2026-10-19", fixture({ adsDaily: ads(sp) }))!;
      const dom = new JSDOM(`<body>${b.html}<script>${b.js}</script></body>`, { runScripts: "dangerously" });
      const g = [...dom.window.document.querySelectorAll("#pt-gauges .gauge")].pop() as InstanceType<typeof dom.window.HTMLElement>;
      return [g.dataset.zone, g.dataset.st];
    };
    const [hi] = zone(100000), [lo] = zone(10);
    expect(hi).toBe("#FF7A7E"); expect(lo).toBe("#34D399");
  });
  it("разделы ниже спидометров тоже отрисованы (скрипт не упал на полпути)", () => {
    const r = run("2026-10-17");
    for (const id of ["pt-gauges", "pt-pills", "pt-pricepills"]) expect(r.doc.getElementById(id)?.innerHTML.length ?? 0).toBeGreaterThan(20);
  });
});

describe("заказы внутри группы по моделям", () => {
  it("суммирует SKU одной модели, не считает отмены, раскрывает артикулы", () => {
    const dp = fixture();
    writeFileSync(dp("sku_taxonomy.json"), JSON.stringify({ "1": { model: "Стол 160", offer: "другой offer" }, "2": { model: "Стол 160" } }));
    const b = planBlock("2026-10-26", dp)!; const d = pd(b.js);
    expect(d.order_breakdown[0]).toEqual({ total: 3, end: "2026-10-16", models: [{ model: "Стол 160", units: 3, share: 100, skus: [
      { sku: "1", offer: "A-1", units: 2 }, { sku: "2", offer: "A-2", units: 1 },
    ] }] });
    expect(d.store_breakdown.total).toBe(7);
    const dom = new JSDOM(`<html><body>${b.html}<script>${b.js}</script></body></html>`, { runScripts: "dangerously", pretendToBeVisual: true });
    const doc = dom.window.document;
    (doc.querySelector('.crow[data-i="0"]') as HTMLElement).click();
    expect(doc.querySelector('#pt-cdet0')?.hasAttribute('hidden')).toBe(false);
    expect(doc.querySelector<HTMLElement>('#pt-cdet0 .ob-stack>span')?.style.width).toBe('100%');
    expect(doc.querySelector('#pt-cdet0 .order-breakdown')?.textContent).not.toContain('%');
    const pill = doc.querySelector<HTMLButtonElement>('#pt-cdet0 .ob-pill')!;
    expect(pill.textContent).toBe('Стол 1603 шт.');
    expect(doc.querySelector<HTMLElement>('#pt-cdet0 .ob-skus')?.hidden).toBe(true);
    pill.click();
    expect(pill.getAttribute('aria-expanded')).toBe('true');
    expect(doc.querySelector<HTMLElement>('#pt-cdet0 .ob-skus')?.hidden).toBe(false);
    expect(doc.querySelector('#pt-cdet0 .ob-skus')?.textContent).toContain('A-1');
    expect(doc.querySelector('#pt-mc0 svg')).not.toBeNull();
    pill.click();
    expect(doc.querySelector<HTMLElement>('#pt-cdet0 .ob-skus')?.hidden).toBe(true);
    dom.window.close();
  });
  it("разные модели: доли от общего числа, неизвестная модель не теряется", () => {
    const dp = fixture(); writeFileSync(dp("sku_taxonomy.json"), JSON.stringify({ "2": { model: "Размер 200" } }));
    const b = pd(planBlock("2026-10-26", dp)!.js).order_breakdown[0];
    expect(b.models.map((m: any) => [m.model, m.units])).toEqual([["Модель не указана · A-1", 2], ["Размер 200", 1]]);
    expect(b.models.reduce((s: number, m: any) => s + m.share, 0)).toBeCloseTo(100);
    expect(b.models.reduce((s: number, m: any) => s + m.units, 0)).toBe(b.total);
  });
  it("выводимый и посторонний SKU только в магазине", () => {
    const d = pd(planBlock("2026-10-26", fixture({ withdrawn: ["A-2"] }))!.js);
    expect(d.order_breakdown[0].total).toBe(2);
    expect(d.order_breakdown[0].models.flatMap((m: any) => m.skus.map((s: any) => s.sku))).toEqual(["1"]);
    expect(d.store_breakdown.total).toBe(7);
  });
  it("границы по Москве: перенос до старта включается, после 28.10 и неполный день исключены", () => {
    const orders = [
      { d: "2026-10-14", t: "2026-10-14T22:00:00Z", sku: "1", units: 2, status: "delivered" },
      { d: "2026-10-28", t: "2026-10-28T20:59:00Z", sku: "2", units: 3, status: "delivered" },
      { d: "2026-10-28", t: "2026-10-28T21:00:00Z", sku: "1", units: 9, status: "delivered" },
    ];
    const dp = fixture({ orders });
    expect(pd(planBlock("2026-10-29", dp)!.js).order_breakdown[0].total).toBe(5);
    writeFileSync(dp("orders_daily.ndjson"), [...orders, { d: "2026-10-29", sku: "1", units: 10, status: "delivered" }].map(r => JSON.stringify(r)).join('\n'));
    expect(pd(planBlock("2026-10-30", dp)!.js).order_breakdown[0].total).toBe(5);
  });
  it("пустой источник отличается от нуля заказов", () => {
    const missing = planBlock("2026-10-26", fixture({ orders: [] }))!;
    expect(pd(missing.js).order_breakdown[0].total).toBeNull(); expect(missing.html).toContain('Нет данных за период');
    const zero = planBlock("2026-10-26", fixture({ orders: [{ d: "2026-10-16", sku: "9", units: 1, status: "delivered" }] }))!;
    expect(pd(zero.js).order_breakdown[0].total).toBe(0); expect(zero.html).toContain('Заказов за период нет');
  });
  it("экранирует HTML и script в модели", () => {
    const dp = fixture(); const model = '<img src=x onerror="alert(1)"></script>';
    writeFileSync(dp("sku_taxonomy.json"), JSON.stringify({ "1": { model } }));
    const b = planBlock("2026-10-26", dp)!;
    expect(b.html).not.toContain(model); expect(b.js).not.toContain('</script>');
    const doc = new JSDOM(b.html).window.document;
    expect(doc.querySelector('#pt-cdet0 .ob-name')?.textContent).toBe(model);
    expect(doc.querySelector('#pt-cdet0 img')).toBeNull();
  });
});

describe("компактные плашки моделей", () => {
  it("полное имя и штуки без процентов; одна открытая модель; малая доля", () => {
    const dp = fixture({ orders: [
      { d: "2026-10-16", sku: "1", units: 99, status: "delivered" },
      { d: "2026-10-16", sku: "2", units: 1, status: "delivered" },
    ] });
    const longName = "KUVINO NF LED L, с сенсорным выключателем";
    writeFileSync(dp("sku_taxonomy.json"), JSON.stringify({ "1": { model: "TRUBIS Wood Oval 160" }, "2": { model: longName } }));
    const b = planBlock("2026-10-26", dp)!;
    const dom = new JSDOM(`<html><body>${b.html}<script>${b.js}</script></body></html>`, { runScripts: "dangerously", pretendToBeVisual: true });
    const doc = dom.window.document, group = doc.querySelector('#pt-cdet0 .order-breakdown')!;
    const pills = group.querySelectorAll<HTMLButtonElement>('.ob-pill'), panels = group.querySelectorAll<HTMLElement>('.ob-skus');
    expect(pills[1]!.querySelector('.ob-name')!.textContent).toBe(longName);
    expect(pills[1]!.querySelector('b')!.textContent).toBe('1 шт.');
    expect(group.textContent).not.toContain('%');
    expect(group.querySelectorAll<HTMLElement>('.ob-stack>span')[1]!.style.width).toBe('1%');
    pills[0]!.click(); expect(panels[0]!.hidden).toBe(false);
    pills[1]!.click(); expect(panels[0]!.hidden).toBe(true); expect(panels[1]!.hidden).toBe(false);
    expect(pills[0]!.getAttribute('aria-expanded')).toBe('false');
    pills[1]!.click(); expect(panels[1]!.hidden).toBe(true);
    const ids = Array.from(doc.querySelectorAll('[id]'), el => el.id); expect(new Set(ids).size).toBe(ids.length);
    dom.window.close();
  });
});
