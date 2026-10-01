// Тест 4: правило «держит / не держит» и проверка «цена снижена». Эталонные строки из спеки
// knowledge/semantic/metrics/ozon-price-test-gap-shift.yaml. Даты условные, «сегодня» передаётся.
import { describe, it, expect } from "vitest";
import {
  median, expectedDrop, priceApplied, priceState, diffSeries, baseOf, shiftSeries, verdictOf, viewShare, viewsStop, firstRun, nextDay,
} from "./price-test.js";

const START = "2026-10-07", END = "2026-10-21";
const PRE = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06"];
const POST = ["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12", "2026-10-13"];
const TEST = ["A", "B"];
const CTRL = new Set(["X", "Y", "Z"]);

/** День: тест на diff выше контроля 48.0. */
function day(diff: number): Map<string, number> {
  return new Map([["A", 48 + diff], ["B", 48 + diff], ["X", 47.5], ["Y", 48], ["Z", 48.5]]);
}
function gapOf(pre: number[], post: number[]): Map<string, Map<string, number>> {
  const g = new Map<string, Map<string, number>>();
  PRE.forEach((d, i) => g.set(d, day(pre[i]!)));
  POST.slice(0, post.length).forEach((d, i) => g.set(d, day(post[i]!)));
  return g;
}
const all = () => true;

describe("эталон спеки", () => {
  it("база - медиана 7 дней до старта, сдвиг - разница дня минус база", () => {
    const pre = [1.30, 1.06, 0.99, 1.52, 1.28, 1.19, 1.20];
    const s = diffSeries(gapOf(pre, [-1.0]), TEST, CTRL, START, all);
    const { base, days } = baseOf(s, START);
    expect(days).toHaveLength(7);
    expect(base).toBeCloseTo(1.20, 6);
    const post = s.find((x) => x.d === START)!;
    expect(post.diff).toBeCloseTo(-1.0, 6);
    expect(post.diff! - base!).toBeCloseTo(-2.2, 6);
  });
  it("ожидаемый сдвиг при «не держит»: g 48.5, снижение 10% -> -5.72 п.", () => {
    expect(expectedDrop(48.5, 0.10)).toBeCloseTo(-5.722, 3);
  });
  it("цена: -10% засчитана, -5% нет, нет снимка - нет", () => {
    expect(priceApplied(68300, 61470, 0.10)).toBe(true);
    expect(priceApplied(68300, 64885, 0.10)).toBe(false);
    expect(priceApplied(68300, null, 0.10)).toBe(false);
    expect(priceApplied(null, 61470, 0.10)).toBe(false);
  });
});

/** Сдвиги по дням после старта (база по всем товарам за PRE). */
function shifts(pre: number[], post: number[], applied: (a: string, d: string) => boolean = all, test = TEST) {
  const g = gapOf(pre, post);
  const { days } = baseOf(diffSeries(g, test, CTRL, START, all), START);
  return shiftSeries(g, test, CTRL, START, days, applied);
}
/** Ряд сдвигов на произвольных датах после старта. */
const xsOf = (vals: number[]) => vals.map((s, i) => ({ d: nextDay(START, i + 1), s, nt: 10 }));

describe("правило (Иван 01.10, п. 1а: итог окна - медиана последних 7 наблюдаемых дней)", () => {
  const pre = [1, 1, 1, 1, 1, 1, 1];
  it("до старта - не запущен", () => {
    expect(verdictOf(shifts(pre, []), START, END, "2026-10-05", -5.7).v).toBe("не запущен");
  });
  it("около нуля - держит, до замера предварительно", () => {
    const r = verdictOf(shifts(pre, [1.2, 0.6, 0.9]), START, END, "2026-10-10", -5.7);
    expect(r.v).toBe("держит");
    expect(r.prelim).toBe(true);
  });
  it("-4 п. и ниже - не держит", () => {
    expect(verdictOf(shifts(pre, [-4.5, -4.8, -5.1]), START, END, "2026-10-10", -5.7).v).toBe("не держит");
  });
  it("меньше трёх точек - ещё идёт; на замере - мало данных", () => {
    expect(verdictOf(shifts(pre, [-4.5, -4.8]), START, END, "2026-10-09", -5.7).v).toBe("идёт");
    expect(verdictOf(shifts(pre, [-4.5, -4.8]), START, END, END, -5.7).v).toBe("мало данных");
  });
  it("на замере между порогами - держит частично, доля по медиане, окно продлено", () => {
    const r = verdictOf(shifts(pre, [-1.85, -1.85, -1.85, -1.85]), START, END, END, -5.7, "2026-10-28");
    expect(r.v).toBe("держит частично");
    expect(r.medShift).toBeCloseTo(-2.85, 6);
    expect(r.share).toBeCloseTo(1 - 2.85 / 5.7, 6);
    expect(r.extended).toBe(true);
    expect(r.end).toBe("2026-10-28");
    expect(r.prelim).toBe(true);
  });
  it("после продления итог на 28.10, не предварительно", () => {
    const r = verdictOf(xsOf([-2.5, -2.5, -2.5, -2.5]), START, END, "2026-10-28", -5.7, "2026-10-28");
    expect(r.v).toBe("держит частично");
    expect(r.prelim).toBe(false);
  });
  it("без продления_до итог на замере", () => {
    const r = verdictOf(xsOf([-2.5, -2.5, -2.5]), START, END, END, -5.7);
    expect(r.extended).toBe(false);
    expect(r.prelim).toBe(false);
  });
  it("ФЕНИКС L1: держит, не держит, держит - решают последние дни, а не первая серия", () => {
    const r = verdictOf(xsOf([0, 0, 0, -5, -5, -5, 0, 0, 0, 0, 0]), START, END, END, -5.7);
    expect(r.window).toHaveLength(7);
    expect(r.v).toBe("держит");
  });
  it("ФЕНИКС L2: 3 дня -0.5, затем 7 дней -2.5 - не «держит»", () => {
    const r = verdictOf(xsOf([-0.5, -0.5, -0.5, -2.5, -2.5, -2.5, -2.5, -2.5, -2.5, -2.5]), START, END, END, -5.7);
    expect(r.v).toBe("держит частично");
    expect(r.medShift).toBeCloseTo(-2.5, 6);
  });
});

describe("одна популяция до и после старта (ФЕНИКС G1)", () => {
  it("ФЕНИКС L4: Ozon держит, засчитана часть товаров с низкой базой - всё равно «держит»", () => {
    // 10 товаров: у 5 разрыв на 2 п. ниже контроля, у 5 на 1.5 п. выше; засчитаны 6 (5 низких и 1 высокий).
    // Ozon держит - разрыв каждого не меняется.
    const test = Array.from({ length: 10 }, (_, i) => `T${i}`);
    const g = new Map<string, Map<string, number>>();
    for (const d of [...PRE, ...POST]) {
      const m = new Map<string, number>([["X", 47.5], ["Y", 48], ["Z", 48.5]]);
      test.forEach((a, i) => m.set(a, i < 5 ? 46 : 49.5));
      g.set(d, m);
    }
    const appliedSix = (a: string) => Number(a.slice(1)) < 6;
    const { days } = baseOf(diffSeries(g, test, CTRL, START, all), START);
    const xs = shiftSeries(g, test, CTRL, START, days, appliedSix);
    const post = xs.filter((x) => x.d >= START);
    expect(post.every((x) => x.nt === 6 && Math.abs(x.s!) < 1e-9)).toBe(true);
    expect(verdictOf(xs, START, END, END, -5.7).v).toBe("держит");
    // старый расчёт по медиане группы дал бы ложный сдвиг: база по 10, день по 6
    const old = diffSeries(g, test, CTRL, START, appliedSix);
    const base = baseOf(old, START).base!;
    expect(old.find((x) => x.d === START)!.diff! - base).toBeLessThan(-1);
  });
});

describe("ловушка: цену не снизили", () => {
  it("товар без подтверждённого снижения в дне не считается, и «держит» не выходит", () => {
    const xs = shifts([1, 1, 1, 1, 1, 1, 1], [1, 1, 1], () => false);
    expect(xs.filter((x) => x.d >= START).every((x) => x.s === null)).toBe(true);
    expect(verdictOf(xs, START, END, "2026-10-10", -5.7).v).toBe("идёт");
  });
  it("меньше половины группы со сниженной ценой - день пустой", () => {
    const xs = shifts([1, 1, 1, 1, 1, 1, 1], [1], (a) => a === "A", ["A", "B", "C"]);
    expect(xs.find((x) => x.d === START)!.s).toBeNull();
  });
  it("ФЕНИКС L3: коридор цены - витрина в поле price, -19%, -90%, рост - аномалия, не «снижена»", () => {
    expect(priceState(68300, 61470, 0.10)).toBe("снижена");
    expect(priceState(68300, 61900, 0.10)).toBe("снижена");     // округление командой, -9.4%
    expect(priceState(68300, 68300, 0.10)).toBe("не снижена");
    expect(priceState(68300, 34800, 0.10)).toBe("аномалия");    // витрина вместо предельной
    expect(priceState(68300, 55300, 0.10)).toBe("аномалия");    // -19%
    expect(priceState(68300, 6830, 0.10)).toBe("аномалия");     // -90%
    expect(priceState(68300, 64885, 0.10)).toBe("аномалия");    // -5%
    expect(priceState(68300, 75000, 0.10)).toBe("аномалия");
    expect(priceState(null, 61470, 0.10)).toBe("нет цены");
    expect(priceApplied(68300, 55300, 0.10)).toBe(false);
  });
});

describe("показы", () => {
  const v = new Map<string, Map<string, number>>();
  for (let i = 0; i < 14; i++) {
    const d = nextDay("2026-09-30", i);
    const after = d >= START;
    v.set(d, new Map([["A", after ? 3 : 10], ["X", 990]]));
  }
  it("доля группы за окно [с, по)", () => {
    const r = viewShare(v, new Set(["A"]), "2026-09-30", START);
    expect(r.days).toBe(7);
    expect(r.share).toBeCloseTo(70 / 7000, 9);
  });
  it("стоп: 3 дня подряд ниже половины базы", () => {
    const base = viewShare(v, new Set(["A"]), "2026-09-30", START).share;
    expect(viewsStop(v, new Set(["A"]), START, base)).toBe(START);
  });
  it("пустые дни - не ноль: окна без показов дают null", () => {
    expect(viewShare(v, new Set(["A"]), "2027-01-01", "2027-01-08").share).toBeNull();
  });
});

describe("служебное", () => {
  it("медиана чётной и пустой выборки", () => {
    expect(median([1, 3, 2, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
  it("серия ищется подряд, разрыв обнуляет счёт", () => {
    const xs = [0, 0, -5, 0, 0, 0].map((s, i) => ({ d: nextDay("2026-10-07", i), s }));
    expect(firstRun(xs, (s) => s >= -1)).toBe("2026-10-10");
  });
  it("7 дней = ровно 7 дат, граница месяца", () => {
    const ds = Array.from({ length: 7 }, (_, i) => nextDay("2026-09-28", i));
    expect(ds[0]).toBe("2026-09-28");
    expect(ds[6]).toBe("2026-10-04");
    expect(new Set(ds).size).toBe(7);
  });
});
