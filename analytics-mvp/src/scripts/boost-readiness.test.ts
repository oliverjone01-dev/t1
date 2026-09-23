// Карточка решает, снимать ли бустинг с товара, поэтому цена ошибки здесь выше, чем у
// обычного графика: «плато» на шуме приведёт к снятию акции раньше времени.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import {
  controlByDay, gapSeries, baseOf, plateauOf, statusOf, readiness, loadCpoDays,
  daysBetween, median, ARRIVED,
  type CoinvRow, type DayPoint, type MoveSource,
} from "./boost-readiness.js";

const row = (date: string, art: string, v: number, extra: Partial<CoinvRow> = {}): CoinvRow =>
  ({ date, art, coinv_paid_pct: v, observed: true, in_panel: true, ...extra });

const pt = (day: number, shift: number, move?: MoveSource): DayPoint =>
  ({ date: `2026-07-${String(day + 1).padStart(2, "0")}`, day, gap: shift, shift, move });

describe("контроль = панель минус тестовые", () => {
  const rows = [
    row("2026-07-01", "T1", 60), row("2026-07-01", "C1", 40), row("2026-07-01", "C2", 50),
    row("2026-07-01", "OUT", 99, { in_panel: false }),
    row("2026-07-01", "SKIP", 1, { observed: false }),
  ];

  it("тестовые артикулы в контроль не входят", () => {
    expect(controlByDay(rows, new Set(["T1"])).get("2026-07-01")).toBe(45);
    expect(controlByDay(rows, new Set()).get("2026-07-01")).toBe(50);  // с тестовым медиана уехала
  });

  it("товары вне панели и ненаблюдаемые дни в контроль не входят", () => {
    // Иначе 99 и 1 растащили бы медиану в разные стороны.
    expect(controlByDay(rows, new Set(["T1"])).get("2026-07-01")).toBe(45);
  });

  it("разрыв берётся только там, где есть и товар, и контроль", () => {
    const ctl = controlByDay(rows, new Set(["T1"]));
    expect(gapSeries(rows, "T1", ctl)).toEqual([{ date: "2026-07-01", gap: 15 }]);
    // День без контроля в ряд не попадает.
    const solo = [...rows, row("2026-07-02", "T1", 70)];
    expect(gapSeries(solo, "T1", ctl)).toHaveLength(1);
  });

  it("ненаблюдаемый день товара в ряд не попадает", () => {
    const ctl = controlByDay([...rows, row("2026-07-02", "C1", 40), row("2026-07-02", "C2", 50)], new Set(["T1"]));
    const s = gapSeries([...rows, row("2026-07-02", "T1", 70, { observed: false })], "T1", ctl);
    expect(s.map((p) => p.date)).toEqual(["2026-07-01"]);
  });
});

describe("база", () => {
  const ser = (gaps: number[]) => gaps.map((g, i) => ({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, gap: g }));

  it("медиана семи наблюдаемых дней до включения", () => {
    const b = baseOf(ser([1, 2, 3, 4, 5, 6, 7, 100]), "2026-07-08", new Set());
    expect(b.base).toBe(4);            // сотня 08.07 это уже день включения, в базу не идёт
    expect([b.from, b.to]).toEqual(["2026-07-01", "2026-07-07"]);
  });

  it("день общего сдвига на краю окна двигает окно назад", () => {
    // 07.07 это день общего сдвига: окно уезжает на сутки, и база считается по 01-06.07.
    const b = baseOf(ser([1, 2, 3, 4, 5, 6, 40]), "2026-07-08", new Set(["2026-07-07"]));
    expect(b.shifted).toBe(true);
    expect(b.to).toBe("2026-07-06");
    expect(b.base).toBe(3.5);
  });

  it("день общего сдвига внутри окна оставляем", () => {
    const b = baseOf(ser([1, 2, 3, 40, 5, 6, 7]), "2026-07-08", new Set(["2026-07-04"]));
    expect(b.shifted).toBe(false);
    expect(b.base).toBe(5);            // медиана 1,2,3,40,5,6,7 это 5, сороковка тянет только хвост
  });

  it("меньше трёх дней до включения - базы нет", () => {
    expect(baseOf(ser([1, 2]), "2026-07-03", new Set()).base).toBeNull();
  });
});

describe("плато", () => {
  it("три подряд дня в пределах двух пунктов и не ниже порога", () => {
    const p = plateauOf([pt(0, 2), pt(1, 12), pt(2, 17.5), pt(3, 17.6), pt(4, 17.4)]);
    expect(p).toEqual({ from: "2026-07-03", day: 2 });
  });

  it("размах больше двух пунктов плато не даёт", () => {
    expect(plateauOf([pt(0, 10), pt(1, 13), pt(2, 16)])).toBeNull();
  });

  it("ровный ряд ниже порога прихода плато не даёт", () => {
    // Это и есть главный ложный срабатыватель: ровно, но никуда не пришло.
    expect(plateauOf([pt(0, 1), pt(1, 1), pt(2, 1)])).toBeNull();
  });

  it("день общего сдвига магазина днём плато не считается", () => {
    expect(plateauOf([pt(0, 17), pt(1, 17.5, "our_cpo"), pt(2, 17.2)])).toBeNull();
    expect(plateauOf([pt(0, 17), pt(1, 17.5, "our_cpo"), pt(2, 17.2), pt(3, 17.4), pt(4, 17.1)]))
      .toEqual({ from: "2026-07-03", day: 2 });
  });
});

describe("статусы", () => {
  it("меньше трёх дней - ждём", () => {
    expect(statusOf([pt(0, 1), pt(1, 2)], null)).toBe("ждём");
  });

  it("пять дней и сдвиг ниже порога - не пришло", () => {
    expect(statusOf([pt(0, 1), pt(3, 2), pt(5, 3)], null)).toBe("не пришло");
  });

  it("растёт, но плато ещё нет - едет", () => {
    expect(statusOf([pt(0, 1), pt(3, 9), pt(4, 12)], null)).toBe("едет");
  });

  it("плато перебивает всё остальное", () => {
    expect(statusOf([pt(0, 17), pt(1, 17), pt(2, 17)], { day: 0 })).toBe("плато");
  });

  it("пустой ряд - нет данных, а не ждём", () => {
    expect(statusOf([], null)).toBe("нет данных");
  });
});

describe("строка карточки", () => {
  const rows: CoinvRow[] = [];
  // Контроль стоит на 40 все дни, товар до включения тоже 40, потом уезжает вверх.
  const vals: Record<string, number> = {
    "2026-07-01": 40, "2026-07-02": 40, "2026-07-03": 40, "2026-07-04": 40,
    "2026-07-05": 40, "2026-07-06": 40, "2026-07-07": 40,
    "2026-07-08": 42, "2026-07-09": 44, "2026-07-10": 58, "2026-07-11": 58.5, "2026-07-12": 58.2,
  };
  for (const [d, v] of Object.entries(vals)) {
    rows.push(row(d, "T", v));
    rows.push(row(d, "C1", 40), row(d, "C2", 40));
  }
  const ctl = controlByDay(rows, new Set(["T"]));
  const series = gapSeries(rows, "T", ctl);

  it("считает базу, день и сдвиг, ловит плато", () => {
    const r = readiness({ art: "T", on: "2026-07-08" }, series, new Map());
    expect(r.base).toBe(0);
    expect(r.day).toBe(4);              // 12.07 это четвёртый день от включения
    expect(r.shift).toBe(18.2);
    expect(r.status).toBe("плато");
    expect(r.plateauFrom).toBe("2026-07-10");
    expect(r.plateauDay).toBe(2);
  });

  it("день включения считается нулевым", () => {
    const r = readiness({ art: "T", on: "2026-07-08" }, series, new Map());
    expect(r.series[0]).toMatchObject({ date: "2026-07-08", day: 0, shift: 2 });
  });

  it("без базы строка пустая, а не нулевая", () => {
    const r = readiness({ art: "T", on: "2026-07-02" }, series, new Map());
    expect(r.base).toBeNull();
    expect(r.status).toBe("нет данных");
    expect(r.series).toEqual([]);
  });

  it("после снятия бустинга считает дни и день возврата к базе", () => {
    const more = [...rows];
    for (const [d, v] of Object.entries({ "2026-07-13": 58, "2026-07-14": 58, "2026-07-15": 40.5 })) {
      more.push(row(d, "T", v), row(d, "C1", 40), row(d, "C2", 40));
    }
    const s = gapSeries(more, "T", controlByDay(more, new Set(["T"])));
    const r = readiness({ art: "T", on: "2026-07-08", off: "2026-07-13" }, s, new Map());
    expect(r.daysSinceOff).toBe(2);
    expect(r.backToBaseOn).toBe("2026-07-15");
    expect(r.heldDays).toBe(1);        // держался 13 и 14, ушёл 15-го
  });
});

describe("лог смены ставки CPO", () => {
  it("нет файла - пустое множество, а не падение", () => {
    expect(loadCpoDays("data/нет-такого-файла.psv").size).toBe(0);
  });
});

describe("мелочи, на которых легко ошибиться", () => {
  it("дни считаются календарно, а не по индексу наблюдений", () => {
    expect(daysBetween("2026-07-01", "2026-07-08")).toBe(7);
    expect(daysBetween("2026-08-31", "2026-09-01")).toBe(1);
  });

  it("медиана пустого ряда - NaN, чтобы пробел не стал нулём", () => {
    expect(median([])).toBeNaN();
    expect(median([3, 1, 2])).toBe(2);
  });
});

// Единственное наблюдение, на котором правило откалибровано: GGT-47-3-3-90, кампания
// 06.07-05.08. Если ряд в data/ поедет, тест это покажет, и подпись под карточкой придётся
// переписать вместе с правилом.
describe("эталон июля из data/", () => {
  const P = "data/coinv_daily.ndjson";
  const has = existsSync(P);
  it.skipIf(!has)("скачок на третий день, плато с четвёртого, после снятия держится пять дней", () => {
    const rows = readFileSync(P, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as CoinvRow);
    const ctl = controlByDay(rows, new Set(["GGT-47-3-3-90"]));
    const series = gapSeries(rows, "GGT-47-3-3-90", ctl);
    const r = readiness({ art: "GGT-47-3-3-90", on: "2026-07-06", off: "2026-08-05" }, series, new Map());

    const at = (d: number) => r.series.find((p) => p.day === d)?.shift;
    expect(at(2)).toBeLessThan(ARRIVED);       // на второй день ещё ничего
    expect(at(3)).toBeGreaterThan(ARRIVED);    // скачок на третий
    expect(r.plateauDay).toBe(4);              // плато с четвёртого
    expect(at(4)).toBeGreaterThan(17);
    expect(r.heldDays).toBe(5);                // после снятия держится пять дней
    expect(r.backToBaseOn).toBe("2026-08-11"); // уходит на шестой
  });
});
