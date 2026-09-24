// Оценщик решает, что нарисовано на графике и что написано под ним. Ошибка здесь не падает,
// а рисует ровную линию на нуле под подписью «-18 %», как было с корзиной 24.09.
import { describe, it, expect } from "vitest";
import {
  estOf, DENSITY_MIN, density, densityByDay, medianIndexLine, sumIndexLine,
  growthMedian, growthSum, growth, line, winMean, type Matrix,
} from "./estimator.js";

const B = [0, 1], P = [2, 3];
const B3 = [0, 1, 2], P3 = [3, 4, 5];

describe("правило выбора оценщика", () => {
  it("плотные метрики считаются медианой, количества суммой", () => {
    for (const k of ["pos", "vsearch", "views", "pdp"]) expect(estOf(k)).toBe("median");
    for (const k of ["cart", "units"]) expect(estOf(k)).toBe("sum");
  });

  it("незнакомая метрика идёт по медиане, а не молча по сумме", () => {
    expect(estOf("выдумка")).toBe("median");
  });
});

describe("разреженное количество", () => {
  // Настоящая форма корзины: у каждого артикула база ненулевая, но в отдельный день
  // значение есть лишь у одного-двух из пяти.
  const m: Matrix = [
    [1, 0, 1, 0, 0, 0],
    [1, 0, 1, 0, 0, 0],
    [1, 0, 1, 0, 0, 0],
    [1, 0, 1, 2, 0, 0],
    [1, 0, 1, 0, 3, 0],
  ];

  it("медиана дневных индексов вырождается в ноль, хотя группа жива", () => {
    expect(medianIndexLine(m, B3).slice(3)).toEqual([0, 0, 0]);
  });

  it("индекс суммы показывает поведение группы и в ноль не садится", () => {
    // Суммы по дням: 5, 0, 5, 2, 3, 0. Средний день базы 10/3.
    expect(sumIndexLine(m, B3).map((v) => v == null ? null : Math.round(v))).toEqual([150, 0, 150, 60, 90, 0]);
  });

  it("прирост суммы считается по той же сумме, что и линия", () => {
    expect(growthSum(m, B3, P3).value).toBe(-50);
    expect(growth(m, B3, P3, "sum").value).toBe(growthSum(m, B3, P3).value);
  });

  it("плотность видна числом, а не на глаз", () => {
    expect(density(m).share).toBeCloseTo(12 / 30, 5);
    expect(density(m).share).toBeLessThan(DENSITY_MIN);
    expect(densityByDay(m)[1]).toEqual({ n: 5, nonzero: 0 });
  });
});

describe("плотная метрика", () => {
  const m: Matrix = [
    [100, 100, 200, 200],
    [50, 50, 100, 100],
    [10, 10, 5, 5],
  ];

  it("медиана индексов не даёт одному крупному ряду перевесить группу", () => {
    expect(medianIndexLine(m, B)).toEqual([100, 100, 200, 200]);
    // Сумма перевешена первым рядом и дала бы другой ответ.
    expect(sumIndexLine(m, B)![2]).toBeGreaterThan(180);
  });

  it("прирост по медиане это середина поартикульных приростов", () => {
    expect(growthMedian(m, B, P).value).toBe(100);
    expect(growthMedian(m, B, P).n).toBe(3);
  });
});

describe("карточки", () => {
  // Три варианта одной карточки и один одиночный товар: без схлопывания карточка решает всё.
  const m: Matrix = [
    [10, 10, 40, 40],
    [10, 10, 40, 40],
    [10, 10, 40, 40],
    [10, 10, 11, 11],
  ];
  const g = ["card:1", "card:1", "card:1", "art:X"];

  it("варианты одной карточки идут одним наблюдением", () => {
    expect(growthMedian(m, B, P).value).toBe(300);          // карточка перевесила
    expect(growthMedian(m, B, P, g).value).toBe(155);       // середина между +300 и +10
    expect(growthMedian(m, B, P, g).n).toBe(2);
  });

  it("линия схлопывается так же, как число", () => {
    expect(medianIndexLine(m, B, g)![2]).toBe(255);          // середина между 400 и 110
  });

  it("сумме группировка безразлична: сумма от разбиения не зависит", () => {
    expect(growth(m, B, P, "sum", g).value).toBe(growth(m, B, P, "sum").value);
  });
});

describe("пропуски", () => {
  it("день без съёма не участвует ни в базе, ни в приросте", () => {
    expect(winMean([null, 10, null, 20], [0, 1])).toBe(10);
    expect(winMean([null, null], [0, 1])).toBeNull();
  });

  it("день, в котором не отчитался никто, остаётся пропуском, а не нулём", () => {
    const m: Matrix = [[1, 1, null, 2], [1, 1, null, 2]];
    expect(sumIndexLine(m, B)[2]).toBeNull();
    expect(medianIndexLine(m, B)[2]).toBeNull();
  });

  it("ряд с нулевой базой в медиану не входит: привести его к 100 нельзя", () => {
    const m: Matrix = [[0, 0, 5, 5], [10, 10, 20, 20]];
    expect(growthMedian(m, B, P).n).toBe(1);
    expect(line(m, B, "median")[2]).toBe(200);
  });
});
