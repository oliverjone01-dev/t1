// Тест 4: правило «держит / не держит» и проверка «цена снижена». Эталонные строки из спеки
// knowledge/semantic/metrics/ozon-price-test-gap-shift.yaml. Даты условные, «сегодня» передаётся.
import { describe, it, expect } from "vitest";
import {
  median, expectedDrop, priceApplied, diffSeries, baseOf, verdictOf, viewShare, viewsStop, firstRun, nextDay,
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

describe("правило", () => {
  const pre = [1, 1, 1, 1, 1, 1, 1];
  it("до старта - не запущен", () => {
    const s = diffSeries(gapOf(pre, []), TEST, CTRL, START, all);
    expect(verdictOf(s, START, END, "2026-10-05", -5.7).v).toBe("не запущен");
  });
  it("3 дня подряд около нуля - держит", () => {
    const s = diffSeries(gapOf(pre, [1.2, 0.6, 0.9]), TEST, CTRL, START, all);
    const r = verdictOf(s, START, END, "2026-10-10", -5.7);
    expect(r.v).toBe("держит");
    expect(r.from).toBe("2026-10-07");
  });
  it("3 дня подряд -4 п. и ниже - не держит", () => {
    const s = diffSeries(gapOf(pre, [-4.5, -4.8, -5.1]), TEST, CTRL, START, all);
    expect(verdictOf(s, START, END, "2026-10-10", -5.7).v).toBe("не держит");
  });
  it("два дня - ещё идёт", () => {
    const s = diffSeries(gapOf(pre, [-4.5, -4.8]), TEST, CTRL, START, all);
    expect(verdictOf(s, START, END, "2026-10-09", -5.7).v).toBe("идёт");
  });
  it("к концу окна между порогами - держит частично, доля по медиане", () => {
    const s = diffSeries(gapOf(pre, [-1.85, -1.85, -1.85, -1.85]), TEST, CTRL, START, all);
    const r = verdictOf(s, START, END, END, -5.7);
    expect(r.v).toBe("держит частично");
    expect(r.share).toBeCloseTo(1 - 2.85 / 5.7, 6);
  });
});

describe("ловушка: цену не снизили", () => {
  it("товар без подтверждённого снижения в дне не считается, и «держит» не выходит", () => {
    const pre = [1, 1, 1, 1, 1, 1, 1];
    const s = diffSeries(gapOf(pre, [1, 1, 1]), TEST, CTRL, START, () => false);
    expect(s.filter((x) => x.d >= START).every((x) => x.diff === null)).toBe(true);
    expect(verdictOf(s, START, END, "2026-10-10", -5.7).v).toBe("идёт");
  });
  it("меньше половины группы со сниженной ценой - день пустой", () => {
    const g = gapOf([1, 1, 1, 1, 1, 1, 1], [1]);
    const s = diffSeries(g, ["A", "B", "C"], CTRL, START, (a) => a === "A");
    expect(s.find((x) => x.d === START)!.diff).toBeNull();
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
