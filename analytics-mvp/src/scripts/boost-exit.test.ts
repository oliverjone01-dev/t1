// Дата выхода из бустинга решает, от какого дня считается замер 4 октября. Ошибка здесь
// сдвигает окно, а сдвинутое окно даёт число, которое выглядит нормальным и неверно.
import { describe, it, expect } from "vitest";
import {
  autoExitDate, cleanStreak, decideExit, loadEbSeries, loadEbDaily, loadEbFromSnapshots,
  CLEAN_DAYS_FOR_GATE, type EbPoint,
} from "./boost-exit.js";
import { merge, toRows, type EbRow } from "./ozon/eb-daily.js";

const D = (n: number): string => `2026-09-${String(n).padStart(2, "0")}`;
const pts = (spec: Array<[number, number]>): EbPoint[] => spec.map(([d, p]) => ({ date: D(d), pct: p }));

describe("автодата выхода", () => {
  it("это первый ноль после ненулевых, подтверждённый следующим днём", () => {
    expect(autoExitDate(pts([[19, 55], [20, 55], [21, 0], [22, 0]]))).toBe(D(21));
  });

  it("одиночный ноль между ненулевыми не считается выходом", () => {
    // Ровно то, ради чего подтверждение и вводилось: сбой съёма не снимает акцию.
    expect(autoExitDate(pts([[19, 55], [20, 0], [21, 55], [22, 55]]))).toBeNull();
  });

  it("после одиночного нуля настоящий выход всё равно находится", () => {
    expect(autoExitDate(pts([[19, 55], [20, 0], [21, 55], [22, 0], [23, 0]]))).toBe(D(22));
  });

  it("последний день без подтверждения датой не становится", () => {
    expect(autoExitDate(pts([[19, 55], [20, 55], [21, 0]]))).toBeNull();
  });

  it("ряд, начавшийся с нуля, выхода не даёт: перехода мы не видели", () => {
    expect(autoExitDate(pts([[19, 0], [20, 0], [21, 0]]))).toBeNull();
  });

  it("порядок строк в файлах значения не имеет", () => {
    expect(autoExitDate(pts([[22, 0], [19, 55], [21, 0], [20, 55]]))).toBe(D(21));
  });
});

describe("серия чистых дней", () => {
  it("считает подряд идущие нули с конца", () => {
    expect(cleanStreak(pts([[19, 55], [20, 0], [21, 0], [22, 0]]), D(23)).streak).toBe(3);
  });

  it("пропущенный снимок серию не рвёт, но виден в размахе", () => {
    // 22.09 потерян навсегда. Карточка от этого мигать не должна.
    const r = cleanStreak(pts([[20, 0], [21, 0], [23, 0]]), D(23));
    expect(r.streak).toBe(3);
    expect(r.span).toBe(4);      // календарных суток на три наблюдения
  });

  it("ненулевой день обрывает серию", () => {
    expect(cleanStreak(pts([[20, 0], [21, 55], [22, 0]]), D(23)).streak).toBe(1);
  });

  it("дни после asOf не учитываются: гейт смотрит на дату замера", () => {
    expect(cleanStreak(pts([[20, 0], [21, 0], [25, 0]]), D(21)).streak).toBe(2);
  });
});

describe("гейт", () => {
  const long = pts([[18, 55], [19, 0], [20, 0], [21, 0], [22, 0], [23, 0]]);

  it("пустое поле не блокирует замер, когда площадка держит ноль пять дней", () => {
    const d = decideExit("", long, D(23));
    expect(d.source).toBe("auto");
    expect(d.measure).toBe(D(19));
    expect(d.streak).toBe(5);
    expect(CLEAN_DAYS_FOR_GATE).toBe(5);
  });

  it("четырёх дней мало, и карточка говорит сколько осталось", () => {
    const d = decideExit("", pts([[18, 55], [19, 0], [20, 0], [21, 0], [22, 0]]), D(22));
    expect(d.source).toBe("none");
    expect(d.measure).toBeNull();
    expect(d.why).toContain("4 из 5");
  });

  it("заполненное руками поле разрешает замер сразу, без всякой серии", () => {
    const d = decideExit(D(20), pts([[18, 55], [19, 55]]), D(20));
    expect(d.source).toBe("manual");
    expect(d.measure).toBe(D(20));
    expect(d.auto).toBeNull();
  });

  it("когда есть обе, замер идёт от даты площадки, а ручная остаётся подписью", () => {
    // Цена покупателя менялась в день площадки, а не в день, когда нажали кнопку.
    const d = decideExit(D(22), long, D(23));
    expect(d.source).toBe("manual");
    expect(d.manual).toBe(D(22));
    expect(d.auto).toBe(D(19));
    expect(d.measure).toBe(D(19));
    expect(d.disagreeDays).toBe(3);
    expect(d.why).toContain("расхождение 3 дн");
  });

  it("расхождение в сутки не поднимает тревогу", () => {
    const d = decideExit(D(20), long, D(23));
    expect(d.disagreeDays).toBe(1);
    expect(d.why).toContain("не больше суток");
  });

  it("ни поля, ни подтверждённого нуля: замер не разрешён и сказано почему", () => {
    const d = decideExit(null, pts([[22, 55], [23, 55]]), D(23));
    expect(d.source).toBe("none");
    expect(d.auto).toBeNull();
    expect(d.why).toContain("подтверждённого нуля пока не дала");
  });
});

describe("чтение рядов eb_pct", () => {
  it("отсутствие папки и файла это не ошибка, а пустая карта", () => {
    expect(loadEbFromSnapshots("tools/reakciya/нет-такой-папки").size).toBe(0);
    expect(loadEbDaily("data/нет-такого-файла.ndjson").size).toBe(0);
  });

  it("вытяжка в репозитории читается: 500 товаров, 29 в нуле на 23.09", () => {
    // Сам снимок кабинета в git не едет, репозиторий публичный. В репозитории только eb_pct.
    const s = loadEbDaily();
    expect(s.size).toBe(500);
    const zero = [...s.values()].filter((p) => p.some((x) => x.date === "2026-09-23" && x.pct === 0));
    expect(zero.length).toBe(29);
  });

  it("на одном дне автодаты нет ни у кого: подтверждать нечем", () => {
    expect([...loadEbSeries().values()].filter((p) => autoExitDate(p) !== null).length).toBe(0);
  });
});

describe("слияние вытяжки", () => {
  const row = (d: string, art: string, v: number): EbRow => ({ date: d, art, eb_pct: v });

  it("свежий снимок перезаписывает свой день целиком, прежние дни остаются", () => {
    const out = merge([row(D(20), "A", 55), row(D(21), "A", 55)], [row(D(21), "A", 0)]);
    expect(out).toEqual([row(D(20), "A", 55), row(D(21), "A", 0)]);
  });

  it("товар, пропавший из свежего снимка, за прошлые дни не стирается", () => {
    const out = merge([row(D(20), "B", 55)], [row(D(21), "A", 0)]);
    expect(out.map((r) => r.art)).toEqual(["B", "A"]);
  });

  it("строки идут по дате, потом по артикулу: дифф читается глазами", () => {
    const rows = toRows(new Map([["B", [{ date: D(21), pct: 1 }]], ["A", [{ date: D(21), pct: 2 }, { date: D(20), pct: 3 }]]]));
    expect(rows.map((r) => `${r.date}/${r.art}`)).toEqual([`${D(20)}/A`, `${D(21)}/A`, `${D(21)}/B`]);
  });
});
