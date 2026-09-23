// Родство решает, кого нельзя брать в контроль и что считать одним наблюдением. Ошибка тут
// не видна в числах: она просто делает разницу тест минус контроль меньше, чем есть.
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import {
  loadCardMap, lineKey, kinKey, isKin, kinOfTests, collapseByCard, CARD_MAP_PATHS,
  type CardMap,
} from "./card-kin.js";

const map = (pairs: Array<[string, string]>, groups = 99): CardMap =>
  ({ card: new Map(pairs), groups, source: "test", real: groups >= 20 });
const none = map([], 0);

describe("линия как догадка", () => {
  it("берёт первые два сегмента артикула", () => {
    expect(lineKey("GGT-47-3-3-90")).toBe("GGT-47");
    expect(lineKey("GGT-03-2-1-E-14080")).toBe("GGT-03");
    expect(lineKey("GGM-01-1")).toBe("GGM-01");
  });

  it("без карты родство определяется по линии", () => {
    expect(isKin("GGT-47-3-3-90", "GGT-47-2-2-80", none)).toBe(true);
    expect(isKin("GGT-47-3-3-90", "GGM-01-1", none)).toBe(false);
    expect(isKin("GGT-47-3-3-90", "GGT-47-3-3-90", none)).toBe(false);  // сам себе не родня
  });

  it("карточка перебивает линию", () => {
    // Разные линии, но одна карточка: родня. И наоборот, одна линия, разные карточки: нет.
    const m = map([["A-1-1", "card1"], ["B-9-9", "card1"], ["C-1-1", "card2"], ["C-1-2", "card3"]]);
    expect(isKin("A-1-1", "B-9-9", m)).toBe(true);
    expect(isKin("C-1-1", "C-1-2", m)).toBe(false);
    expect(kinKey("Z-1-1", m)).toBe("Z-1");   // нет в карте - откат на линию
  });
});

describe("родня тестовых товаров", () => {
  it("собирает всех родственников, но не сами тестовые", () => {
    const all = ["GGT-47-3-3-90", "GGT-47-2-2-80", "GGT-47-3-5-90", "GGM-01-1"];
    const kin = kinOfTests(all, new Set(["GGT-47-3-3-90"]), none);
    expect([...kin].sort()).toEqual(["GGT-47-2-2-80", "GGT-47-3-5-90"]);
    expect(kin.has("GGT-47-3-3-90")).toBe(false);
    expect(kin.has("GGM-01-1")).toBe(false);
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

describe("карта из data/", () => {
  const has = CARD_MAP_PATHS.some((p) => existsSync(p));
  it.skipIf(!has)("читается, но пока помечена заглушкой", () => {
    const m = loadCardMap();
    expect(m.groups).toBeGreaterThan(0);
    // Две модели от 25.06 это заметка. Когда выгрузка из кабинета придёт, real станет true,
    // и правило по карточке перестанет быть догадкой на префиксе.
    expect(m.real).toBe(false);
  });

  it.skipIf(!has)("знает про склейку GGT-35, оба варианта тестовые в тесте 1", () => {
    const m = loadCardMap();
    expect(m.card.get("GGT-35-1-3-100-180")).toBeDefined();
    expect(m.card.get("GGT-35-1-3-100-180")).toBe(m.card.get("GGT-35-3-3-100-180"));
  });
});
