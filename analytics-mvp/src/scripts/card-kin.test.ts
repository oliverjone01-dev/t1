// Родство решает, кого нельзя брать в контроль и что считать одним наблюдением. Ошибка тут
// не видна в числах: она просто делает разницу тест минус контроль меньше, чем есть.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import {
  loadCardMap, kinKey, isKin, kinOfTests, collapseByCard, mapHealth, CARD_MAP_PATHS,
  type CardMap,
} from "./card-kin.js";

const map = (pairs: Array<[string, string]>, groups = 99): CardMap =>
  ({ card: new Map(pairs), groups, source: "test", real: groups >= 20, importedAt: "2026-09-23" });
const none = map([], 0);

describe("префикс артикула роднёй больше не считается", () => {
  it("без карты родни нет вовсе: догадка дороже пропуска", () => {
    // До 23.09 эти двое считались роднёй по линии GGT-47. Линия объединяет разные модели,
    // поэтому признак убран, а замены на уровне панели нет: корреляция остатков с порогом
    // 0.3 помечает роднёй 490 артикулов из 493, ровно как случайная двадцатка нетестовых.
    expect(isKin("GGT-47-3-3-90", "GGT-47-2-2-80", none)).toBe(false);
    expect(isKin("GGT-47-3-3-90", "GGM-01-1", none)).toBe(false);
    expect(kinKey("GGT-47-3-3-90", none)).toBe("");
  });

  it("сам себе не родня, даже когда карточка известна", () => {
    const m = map([["A-1-1", "card1"]]);
    expect(isKin("A-1-1", "A-1-1", m)).toBe(false);
  });

  it("родня только по карточке, и неизвестность не склеивает", () => {
    // Разные линии, одна карточка: родня. Одна линия, разные карточки: нет.
    // Двое, которых в карте нет, роднёй не становятся, хотя ключ у обоих пустой.
    const m = map([["A-1-1", "card1"], ["B-9-9", "card1"], ["C-1-1", "card2"], ["C-1-2", "card3"]]);
    expect(isKin("A-1-1", "B-9-9", m)).toBe(true);
    expect(isKin("C-1-1", "C-1-2", m)).toBe(false);
    expect(kinKey("Z-1-1", m)).toBe("");
    expect(isKin("Z-1-1", "Z-1-2", m)).toBe(false);
  });
});

describe("родня тестовых товаров", () => {
  it("собирает родню по карточке, но не сами тестовые", () => {
    const m = map([["T-1", "c1"], ["K-1", "c1"], ["K-2", "c1"], ["X-1", "c2"]]);
    const kin = kinOfTests(["T-1", "K-1", "K-2", "X-1"], new Set(["T-1"]), m);
    expect([...kin].sort()).toEqual(["K-1", "K-2"]);
    expect(kin.has("T-1")).toBe(false);
    expect(kin.has("X-1")).toBe(false);
  });

  it("без карты набор пуст, а не собран по префиксу", () => {
    const all = ["GGT-47-3-3-90", "GGT-47-2-2-80", "GGT-47-3-5-90", "GGM-01-1"];
    expect(kinOfTests(all, new Set(["GGT-47-3-3-90"]), none).size).toBe(0);
  });
});

describe("схлопывание по карточке", () => {
  const m = map([["GGT-35-1-3-100-180", "3734276153"], ["GGT-35-3-3-100-180", "3734276153"]]);
  const rows = [
    { art: "GGT-35-1-3-100-180", v: 20 },
    { art: "GGT-35-3-3-100-180", v: 10 },
    { art: "GGM-01-1", v: 100 },
  ];

  it("варианты одной карточки дают одно наблюдение", () => {
    const r = collapseByCard(rows, (x) => x.art, (x) => x.v, m);
    expect(r.values.sort((a, b) => a - b)).toEqual([15, 100]);   // 15 это медиана пары, не два числа
    expect(r.collapsed).toEqual([{ card: "3734276153", arts: ["GGT-35-1-3-100-180", "GGT-35-3-3-100-180"] }]);
  });

  it("без карточки товар остаётся сам себе наблюдением", () => {
    const r = collapseByCard(rows, (x) => x.art, (x) => x.v, none);
    expect(r.values.sort((a, b) => a - b)).toEqual([10, 20, 100]);
    expect(r.collapsed).toEqual([]);
  });

  it("по линии НЕ схлопывает: линия объединяет разные модели", () => {
    const r = collapseByCard(
      [{ art: "GGT-03-1-1", v: 1 }, { art: "GGT-03-9-9", v: 99 }],
      (x) => x.art, (x) => x.v, none);
    expect(r.values.sort((a, b) => a - b)).toEqual([1, 99]);
  });

  it("пробел внутри карточки не превращается в ноль", () => {
    const r = collapseByCard(
      [{ art: "GGT-35-1-3-100-180", v: 20 }, { art: "GGT-35-3-3-100-180", v: null as any }],
      (x) => x.art, (x) => x.v, m);
    expect(r.values).toEqual([20]);
  });
});


describe("карта карточек из кабинета", () => {
  it("прочитана и помечена настоящей, а не заметкой", () => {
    // Размер карты сверяем с самим файлом: выгрузка обновляется, и прибитое «35 карточек»
    // однажды упало бы на новом снимке, не поймав при этом ни одной ошибки.
    const m = loadCardMap();
    expect(m.groups).toBeGreaterThanOrEqual(20);
    expect(m.real).toBe(true);
    expect(m.card.size).toBeGreaterThan(m.groups * 2 - 1);   // в каждой карточке минимум двое
  });

  it("в карте нет одиночек: карточка из одного товара родни не создаёт", () => {
    const m = loadCardMap();
    const size = new Map<string, number>();
    for (const c of m.card.values()) size.set(c, (size.get(c) ?? 0) + 1);
    expect([...size.values()].filter((n) => n < 2)).toEqual([]);
  });

  it("эталон правила плато делит карточку с соседями по линии L", () => {
    // Из-за них июльская база была занижена на 5.1 пункта: плато выходило +17.4 вместо +22.5.
    // Это факт о товаре, а не о снимке, поэтому проверяется по существу, а не по числу.
    const m = loadCardMap();
    const ref = m.card.get("GGT-47-3-3-90");
    expect(ref).toBeTruthy();
    const mates = [...m.card.entries()].filter(([a, c]) => c === ref && a !== "GGT-47-3-3-90").map(([a]) => a);
    expect(mates.length).toBeGreaterThan(10);
    expect(mates.filter((a) => a.startsWith("GGT-03-") && /-L-\d/.test(a)).length).toBeGreaterThan(10);
  });
});

describe("склейка GGT-35", () => {
  it("оба варианта в одной карточке, поэтому идут в медиану один раз", () => {
    const m = loadCardMap();
    expect(m.card.get("GGT-35-1-3-100-180")).toBe(m.card.get("GGT-35-3-3-100-180"));
    expect(isKin("GGT-35-1-3-100-180", "GGT-35-3-3-100-180", m)).toBe(true);
  });
});

describe("здоровье карты карточек", () => {
  const m = (pairs: Array<[string, string]>, importedAt: string): CardMap =>
    ({ card: new Map(pairs), groups: 30, source: "test", real: true, importedAt });

  it("свежая карта, покрывающая снимок, тревоги не поднимает", () => {
    const h = mapHealth(m([["A", "c1"], ["B", "c1"]], "2026-09-23"), "2026-09-23", ["A", "B"]);
    expect(h.age).toBe(0);
    expect(h.missShare).toBe(0);
    expect(h.stale).toBe(false);
  });

  it("карта старше порога это тревога, даже если покрытие полное", () => {
    const h = mapHealth(m([["A", "c1"], ["B", "c1"]], "2026-09-01"), "2026-09-23", ["A", "B"]);
    expect(h.age).toBe(22);
    expect(h.stale).toBe(true);
  });

  it("свежая дата не спасает, если каталог вырос мимо карты", () => {
    // Ровно этот случай карта датой не ловит: выгрузка сегодняшняя, а товаров стало больше.
    const arts = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const h = mapHealth(m([["A", "c1"], ["B", "c1"]], "2026-09-23"), "2026-09-23", arts);
    expect(h.age).toBe(0);
    expect(h.missShare).toBe(0.8);
    expect(h.stale).toBe(true);
  });

  it("одиночный непокрытый артикул из полутысячи тревоги не поднимает", () => {
    const arts = Array.from({ length: 500 }, (_, i) => `A${i}`);
    const pairs = arts.slice(0, 499).map((a) => [a, "c1"] as [string, string]);
    const h = mapHealth(m(pairs, "2026-09-23"), "2026-09-23", arts);
    expect(h.missShare).toBeLessThan(0.05);
    expect(h.stale).toBe(false);
  });

  it("карта без даты не притворяется свежей, но и не врёт про возраст", () => {
    const h = mapHealth(m([["A", "c1"], ["B", "c1"]], ""), "2026-09-23", ["A", "B"]);
    expect(h.age).toBeNull();
    expect(h.stale).toBe(false);   // покрытие полное, врать не о чем
  });

  it("на живой карте и живом снимке тревоги сегодня нет", () => {
    const rows = readFileSync("data/coinv_daily.ndjson", "utf-8").trim().split("\n")
      .filter(Boolean).map((l) => JSON.parse(l) as { date: string; art: string });
    const last = rows.reduce((a, r) => (r.date > a ? r.date : a), "");
    const arts = [...new Set(rows.filter((r) => r.date === last).map((r) => r.art))];
    const h = mapHealth(loadCardMap(), last, arts);
    expect(h.stale, `карта карточек отстала: возраст ${h.age}, без карточки ${(h.missShare * 100).toFixed(1)} %`).toBe(false);
  });
});
