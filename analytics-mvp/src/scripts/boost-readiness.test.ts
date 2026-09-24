// Карточка решает, снимать ли бустинг с товара, поэтому цена ошибки здесь выше, чем у
// обычного графика: «плато» на шуме приведёт к снятию акции раньше времени.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import {
  controlByDay, gapSeries, baseOf, plateauOf, statusOf, readiness, loadCpoDays, loadMoves,
  daysBetween, median, earliestPlateau, ARRIVED,
  type CoinvRow, type DayPoint, type MoveSource,
  pairGapSeries, pairFit, adFreeFrom,
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
    expect([b.days, b.span, b.dirty]).toEqual([7, 7, false]);
  });

  it("окно набирается по ЧИСТЫМ дням, а не по календарю", () => {
    // 04, 05 и 06.07 - дни общего сдвига. Календарная семидневка взяла бы их и уехала,
    // окно по чистым дням достаёт до 01.07 и растягивается на десять календарных.
    const b = baseOf(ser([1, 2, 3, 4, 5, 6, 7, 40, 40, 40]), "2026-07-11",
      new Set(["2026-07-08", "2026-07-09", "2026-07-10"]));
    expect(b.base).toBe(4);            // медиана 1..7, сороковки не вошли
    expect([b.from, b.to]).toEqual(["2026-07-01", "2026-07-07"]);
    expect([b.days, b.span, b.dirty]).toEqual([7, 7, false]);
  });

  it("день общего сдвига в середине окна тоже выбрасывается", () => {
    // Старое правило ловило только края; Иван показал, что 5 дней из 7 были в середине.
    const b = baseOf(ser([1, 2, 3, 40, 5, 6, 7]), "2026-07-08", new Set(["2026-07-04"]));
    expect(b.base).toBe(4);            // медиана 1,2,3,5,6,7 это 4, сороковка выброшена
    expect(b.days).toBe(6);
    expect(b.span).toBe(7);            // шесть чистых дней растянулись на семь календарных
  });

  it("чистых дней не хватило - база считается, но помечается грязной", () => {
    const b = baseOf(ser([1, 2, 3, 4, 5]), "2026-07-06", new Set(["2026-07-02", "2026-07-03", "2026-07-04"]));
    expect(b.dirty).toBe(true);
    expect(b.base).toBe(3);            // по всем пяти дням, включая грязные
    expect(b.days).toBe(5);
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

  it("окно не перешагивает потерянный день", () => {
    // Ровно случай волны: 21.09 есть, 22.09 потерян, 23.09 есть. Окно 21+23+24 проверяет
    // устойчивость на четырёх сутках с дырой, а не на трёх подряд, и права на плато не даёт.
    expect(plateauOf([pt(1, 17), pt(3, 17.2), pt(4, 17.1)])).toBeNull();
    expect(plateauOf([pt(3, 17.2), pt(4, 17.1), pt(5, 17)])).toEqual({ from: "2026-07-04", day: 3 });
  });

  it("день общего сдвига магазина днём плато не считается", () => {
    expect(plateauOf([pt(0, 17), pt(1, 17.5, "our_cpo"), pt(2, 17.2)])).toBeNull();
    expect(plateauOf([pt(0, 17), pt(1, 17.5, "our_cpo"), pt(2, 17.2), pt(3, 17.4), pt(4, 17.1)]))
      .toEqual({ from: "2026-07-03", day: 2 });
  });
});

describe("когда плато сможет собраться", () => {
  it("на хвосте из одного дня ждать ещё двое суток", () => {
    expect(earliestPlateau([pt(0, 1), pt(3, 9)], "2026-09-23")).toBe("2026-09-25");
  });

  it("на хвосте из двух подряд дней ждать одни сутки", () => {
    expect(earliestPlateau([pt(2, 9), pt(3, 10)], "2026-09-23")).toBe("2026-09-24");
  });

  it("день общего сдвига в хвосте обнуляет счёт", () => {
    expect(earliestPlateau([pt(2, 9), pt(3, 10, "our_cpo")], "2026-09-23")).toBe("2026-09-26");
  });

  it("пустой ряд даты не выдумывает", () => {
    expect(earliestPlateau([], "2026-09-23")).toBeNull();
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

describe("загрузка дней общего сдвига", () => {
  it("спокойные дни пометку не получают", () => {
    // В store_moves.ndjson лежат ВСЕ дни, и спокойные тоже. Если брать их все подряд,
    // помеченным окажется каждый день, плато не соберётся никогда, а база станет грязной.
    const P = "data/store_moves.ndjson";
    if (!existsSync(P)) return;
    const all = readFileSync(P, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const m = loadMoves(P);
    expect(m.size).toBeLessThan(all.length);
    expect(m.size).toBe(all.filter((r) => r.store_move).length);
    for (const r of all.filter((r) => !r.store_move)) expect(m.has(r.date)).toBe(false);
    // День без наблюдения цен пометки не получает: это пропуск съёма, а не сдвиг магазина.
    for (const r of all.filter((r) => r.store_move === null)) expect(m.has(r.date)).toBe(false);
  });

  it("по логу CPO день размечается как наша смена ставки", () => {
    const P = "data/store_moves.ndjson", C = "tools/tests/cpo_history.psv";
    if (!existsSync(P) || !existsSync(C)) return;
    const cpo = loadCpoDays(C);
    expect(cpo.size).toBeGreaterThan(10);
    const m = loadMoves(P, cpo);
    const ours = [...m.entries()].filter(([, v]) => v === "our_cpo").map(([d]) => d);
    expect(ours.length).toBeGreaterThan(10);
    for (const d of ours) expect(cpo.has(d)).toBe(true);
  });

  it("нет файла - пустое множество, а не падение", () => {
    expect(loadCpoDays("data/нет-такого-файла.psv").size).toBe(0);
    expect(loadMoves("data/нет-такого-файла.ndjson").size).toBe(0);
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
  const load = () => readFileSync(P, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as CoinvRow);
  const refRow = (moves = new Map<string, MoveSource>()) => {
    const rows = load();
    const ctl = controlByDay(rows, new Set(["GGT-47-3-3-90"]));
    return readiness({ art: "GGT-47-3-3-90", on: "2026-07-06", off: "2026-08-05" },
      gapSeries(rows, "GGT-47-3-3-90", ctl), moves);
  };

  it.skipIf(!has)("скачок на третий день, после снятия держится пять дней", () => {
    const r = refRow();
    const at = (d: number) => r.series.find((p) => p.day === d)?.shift;
    expect(at(2)).toBeLessThan(ARRIVED);       // на второй день ещё ничего
    expect(at(3)).toBeGreaterThan(ARRIVED);    // скачок на третий
    expect(at(4)).toBeGreaterThan(17);
    expect(r.plateauDay).toBe(4);              // без пометок сдвигов плато видно с четвёртого
    expect(r.heldDays).toBe(5);                // после снятия держится пять дней
    expect(r.backToBaseOn).toBe("2026-08-11"); // уходит на шестой
  });

  it.skipIf(!has || !existsSync("data/store_moves.ndjson"))("пометки сдвигов отодвигают плато, но не отменяют его", () => {
    // Числа берём из самого файла разметки: он пересобирается по явному правилу, и прибитая
    // дата ломалась бы при каждом пересчёте, не поймав ни одной настоящей ошибки. Проверяем
    // смысл: плато не может начаться в день общего сдвига и не может быть раньше, чем без
    // пометок, а сам эффект от разметки не исчезает.
    const moves = loadMoves("data/store_moves.ndjson");
    const bare = refRow(new Map());
    const r = refRow(moves);
    expect(r.plateauFrom).toBeTruthy();
    expect(moves.has(r.plateauFrom!)).toBe(false);
    expect(r.plateauDay!).toBeGreaterThanOrEqual(bare.plateauDay!);
    expect(r.heldDays).toBe(bare.heldDays);
  });

  it.skipIf(!has || !existsSync("data/boost_reference_july.ndjson"))("сходится с эталоном Ивана в пределах 1.5 пункта", () => {
    const r = refRow(loadMoves("data/store_moves.ndjson"));
    const ref = new Map<string, any>(readFileSync("data/boost_reference_july.ndjson", "utf-8")
      .trim().split("\n").filter(Boolean).map((l) => { const o = JSON.parse(l); return [o.date, o]; }));
    const diffs = r.series.map((p) => ref.get(p.date))
      .map((e, i) => (e ? Math.abs(r.series[i]!.shift - e.shift_base_clean_pp) : null))
      .filter((x): x is number => x != null);
    expect(diffs.length).toBeGreaterThan(30);
    // Расхождение идёт от контроля: он у нас на 0.2 пункта выше (медиана по 51 дню), а на
    // дне скачка, где разрыв за сутки прыгает на 10 пунктов, это множится.
    expect(Math.max(...diffs)).toBeLessThan(1.5);
    expect(median(diffs)).toBeLessThan(0.5);
  });
});

describe("парный ряд и пригодность пары", () => {
  const D = (n: number) => `2026-09-${String(n).padStart(2, "0")}`;
  const rows = (spec: Array<[number, string, number]>): CoinvRow[] =>
    spec.map(([d, art, v]) => ({ date: D(d), art, coinv_paid_pct: v }));

  it("общий сдвиг магазина сокращается в разнице пары", () => {
    // 21.09 цену сдвинули оба товара: уровень уехал, разница осталась на месте.
    const s = pairGapSeries(rows([
      [20, "A", 50], [20, "B", 50],
      [21, "A", 55], [21, "B", 55],
    ]), "A", ["B"]);
    expect(s.map((x) => x.gap)).toEqual([0, 0]);
  });

  it("несколько соседей сводятся медианой, а не первым попавшимся", () => {
    const s = pairGapSeries(rows([[20, "A", 60], [20, "B", 50], [20, "C", 52], [20, "D", 70]]), "A", ["B", "C", "D"]);
    expect(s[0]!.gap).toBe(8);      // медиана соседей 52
  });

  it("день без соседа в ряд не попадает", () => {
    const s = pairGapSeries(rows([[20, "A", 60], [21, "A", 61], [20, "B", 50]]), "A", ["B"]);
    expect(s.map((x) => x.date)).toEqual([D(20)]);
  });

  it("соседей нет: ряда нет, а не ряд из нулей", () => {
    expect(pairGapSeries(rows([[20, "A", 60]]), "A", [])).toEqual([]);
  });

  it("пара годится, если до старта разница держалась около нуля", () => {
    const ser = [18, 19, 20].map((d) => ({ date: D(d), gap: 0.5 }));
    const f = pairFit(ser, D(21), D(1));
    expect(f.ok).toBe(true);
    expect(f.days).toBe(3);
  });

  it("пара со смещённой разницей отвергается с числом", () => {
    // Живой случай: GGL-07-XL-2 против GGL-01-M-2, до старта медиана +25.
    const ser = [18, 19, 20].map((d) => ({ date: D(d), gap: 25 }));
    const f = pairFit(ser, D(21), D(1));
    expect(f.ok).toBe(false);
    expect(f.why).toContain("+25");
  });

  it("пара с гуляющей разницей отвергается, даже если медиана нулевая", () => {
    const ser = [{ date: D(18), gap: -15 }, { date: D(19), gap: 0 }, { date: D(20), gap: 15 }];
    const f = pairFit(ser, D(21), D(1));
    expect(f.ok).toBe(false);
    expect(f.why).toContain("гуляла");
  });

  it("проверять не на чем: пара не принимается молча", () => {
    const f = pairFit([{ date: D(20), gap: 0 }], D(21), D(1));
    expect(f.ok).toBe(false);
    expect(f.why).toContain("не на чем");
  });

  it("дни после старта в проверку не идут: там и должен быть эффект", () => {
    const ser = [...[18, 19, 20].map((d) => ({ date: D(d), gap: 0 })), { date: D(25), gap: 30 }];
    expect(pairFit(ser, D(21), D(1)).ok).toBe(true);
  });

  it("окно обрезает дни до первой рекламы: грязный день в проверку не идёт", () => {
    // 18-е было с рекламой, поэтому окно открывается только с 19-го, и разница 25 за 18-е
    // пару больше не бракует: она не про сопоставимость, она про уже включённую рекламу.
    const ser = [{ date: D(18), gap: 25 }, { date: D(19), gap: 0 }, { date: D(20), gap: 0.5 }];
    expect(pairFit(ser, D(21), D(18)).ok).toBe(false);
    const f = pairFit(ser, D(21), D(19));
    expect(f.ok).toBe(true);
    expect(f.days).toBe(2);
    expect(f.from).toBe(D(19));
  });

  it("реклама шла накануне старта: пара непроверяема, а не годна", () => {
    const ser = [18, 19, 20].map((d) => ({ date: D(d), gap: 0 }));
    const f = pairFit(ser, D(21), null);
    expect(f.ok).toBe(false);
    expect(f.why).toContain("накануне");
  });
});

describe("adFreeFrom: окно до первой рекламы", () => {
  const D = (n: number) => `2026-09-${String(n).padStart(2, "0")}`;
  it("идёт назад от старта и останавливается на дне с расходом", () => {
    expect(adFreeFrom(D(21), new Set([D(17)]))).toBe(D(18));
  });

  it("расход накануне старта закрывает окно совсем", () => {
    expect(adFreeFrom(D(21), new Set([D(20)]))).toBe(null);
  });

  it("расхода не было вовсе: окно ограничено только глубиной поиска", () => {
    expect(adFreeFrom(D(21), new Set(), 3)).toBe(D(18));
  });
});
