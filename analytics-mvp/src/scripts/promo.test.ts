// Участие в акции решает, когда считать выход, а значит и от какого дня идёт замер.
// До 24.09 эту роль играл eb_pct, и он указывал на другую акцию: товар в «Усилении» был
// помечен вышедшим. Поэтому тут проверяется не форма файла, а смысл.
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseActs, parsePromoRow, readPromoDaily, exitOf, inPromoOn, membersOn, winKey,
  loadPromoFromSnapshots, type PromoRow,
} from "./promo.js";
import { degraded } from "./ozon/promo-daily.js";
import { readActsDaily, actKey, parseActsRow } from "./promo.js";

const US = winKey("STO", "2026-09-13", "2026-10-06");     // «Максимальный бустинг: усиление»
const MAX = winKey("STO", "2026-09-08", "2026-10-06");    // «Максимальный бустинг»

describe("разбор колонки acts", () => {
  it("достаёт тип и окно, цену по акции выбрасывает", () => {
    const acts = "EB(S)@95900[2025-03-19..2026-12-31];STO(S)@95899[2026-09-08..2026-10-06]";
    expect(parseActs(acts)).toEqual([
      { t: "EB", from: "2025-03-19", to: "2026-12-31" },
      { t: "STO", from: "2026-09-08", to: "2026-10-06" },
    ]);
    // Предельная цена по акции в публичный репозиторий не едет ни в каком виде.
    expect(JSON.stringify(parseActs(acts))).not.toContain("95899");
  });

  it("две STO с разными окнами это две разные акции, а не одна", () => {
    const p = parseActs("STO(S)@1[2026-09-08..2026-10-06];STO(S)@2[2026-09-13..2026-10-06]");
    expect(new Set(p.map((x) => winKey(x.t, x.from, x.to))).size).toBe(2);
  });

  it("пустая строка это отсутствие акций, а не ошибка", () => {
    expect(parseActs("")).toEqual([]);
  });
});

describe("контракт строки файла", () => {
  it("пустой список акций принимается: это наблюдение «акций нет»", () => {
    const r = parsePromoRow({ date: "2026-09-23", art: "A", promos: [] });
    expect(typeof r === "string" ? r : r.promos).toEqual([]);
  });

  it("отсутствие поля promos отвергается: молчание не равно пустоте", () => {
    expect(parsePromoRow({ date: "2026-09-23", art: "A" })).toContain("promos не список");
  });

  it("акция без окна отвергается: по одному типу STO не различить", () => {
    expect(parsePromoRow({ date: "2026-09-23", art: "A", promos: [{ t: "STO" }] })).toContain("окно");
  });
});

describe("дата выхода", () => {
  const dir = mkdtempSync(join(tmpdir(), "promo-"));
  const write = (rows: PromoRow[]): string => {
    const p = join(dir, `p${Math.random().toString(36).slice(2)}.ndjson`);
    writeFileSync(p, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    return p;
  };
  const day = (n: number) => `2026-09-${String(n).padStart(2, "0")}`;
  const row = (n: number, art: string, keys: Array<{ t: string; from: string; to: string }>): PromoRow =>
    ({ date: day(n), art, promos: keys });
  const us = { t: "STO", from: "2026-09-13", to: "2026-10-06" };
  const mx = { t: "STO", from: "2026-09-08", to: "2026-10-06" };

  it("первый наблюдаемый день без записи после дня с записью", () => {
    const r = readPromoDaily(write([row(23, "A", [us]), row(24, "A", [us]), row(25, "A", [])]));
    expect(exitOf(r, "A", US).exit).toBe(day(25));
    expect(exitOf(r, "A", US).lastIn).toBe(day(24));
  });

  it("выход из одной акции не считается выходом из другой", () => {
    const r = readPromoDaily(write([row(23, "B", [us, mx]), row(24, "B", [mx])]));
    expect(exitOf(r, "B", US).exit).toBe(day(24));
    expect(exitOf(r, "B", MAX).exit).toBeNull();
  });

  it("пропущенный день выходом не считается", () => {
    // 24-го съёма не было вовсе, строки нет. Это не выход, это дырка в съёме.
    const r = readPromoDaily(write([row(23, "C", [us]), row(25, "C", [us])]));
    expect(exitOf(r, "C", US).exit).toBeNull();
    expect(exitOf(r, "C", US).seen).toBe(2);
  });

  it("возврат в акцию снимает прежний выход", () => {
    const r = readPromoDaily(write([row(23, "D", [us]), row(24, "D", []), row(25, "D", [us])]));
    expect(exitOf(r, "D", US).exit).toBeNull();
    expect(exitOf(r, "D", US).lastIn).toBe(day(25));
  });

  it("товар, которого в акции не было ни дня, выхода не даёт", () => {
    const r = readPromoDaily(write([row(23, "E", []), row(24, "E", [])]));
    expect(exitOf(r, "E", US)).toEqual({ lastIn: null, exit: null, seen: 2 });
  });

  it("состав акции на день читается из того же файла", () => {
    const r = readPromoDaily(write([row(23, "A", [us]), row(23, "B", [us, mx]), row(23, "C", [])]));
    expect(membersOn(r, US, day(23))).toEqual(["A", "B"]);
    expect(membersOn(r, MAX, day(23))).toEqual(["B"]);
    expect(inPromoOn(r, "C", US, day(23))).toBe(false);
    expect(inPromoOn(r, "C", US, day(24))).toBeNull();   // дня нет - не знаем, а не «нет»
  });

  it("отсутствие файла это пустое чтение, а не ошибка", () => {
    expect(readPromoDaily(join(dir, "нет-такого.ndjson")).exists).toBe(false);
  });
});

describe("вытяжка из снимков", () => {
  it("отсутствие папки это норма: снимки в git не едут", () => {
    expect(loadPromoFromSnapshots("tools/reakciya/нет-такой-папки")).toEqual([]);
  });

  it("снимок в репозитории разбирается и даёт обе акции OZON", () => {
    // Числа берём из самого файла, а не из календаря: съём идёт каждый день, и прибитое
    // «56 товаров на 23.09» сломалось бы завтра, не поймав ни одной настоящей ошибки.
    const rows = loadPromoFromSnapshots();
    if (!rows.length) return;                       // папки нет - проверять нечего
    const last = rows.map((r) => r.date).sort().pop()!;
    const onLast = rows.filter((r) => r.date === last);
    const inUs = onLast.filter((r) => r.promos.some((p) => winKey(p.t, p.from, p.to) === US));
    const inMax = onLast.filter((r) => r.promos.some((p) => winKey(p.t, p.from, p.to) === MAX));
    expect(onLast.length).toBeGreaterThan(400);     // снимок целиком, а не обрывок
    expect(inUs.length).toBeGreaterThan(0);
    expect(inUs.length).toBeLessThan(onLast.length);
    // Акции пересекаются, но не совпадают: иначе их незачем было бы различать.
    const usArts = new Set(inUs.map((r) => r.art));
    expect(inMax.some((r) => usArts.has(r.art))).toBe(true);
    expect(inMax.some((r) => !usArts.has(r.art))).toBe(true);
  });
});

describe("сторож на деградировавший снимок", () => {
  const day = (n: number) => `2026-09-${String(n).padStart(2, "0")}`;
  const us = { t: "STO", from: "2026-09-13", to: "2026-10-06" };
  const full = (n: number, k: number): PromoRow[] =>
    Array.from({ length: k }, (_, i) => ({ date: day(n), art: `A${i}`, promos: [us] }));

  it("пустая колонка acts у всех товаров это сбой, а не массовый выход", () => {
    // Иначе страница напишет «вышли все», дата выхода уедет на день сбоя, и merge закрепит
    // это в файле навсегда: историю задним числом кабинет не отдаёт.
    const fresh = full(24, 56).map((r) => ({ ...r, promos: [] }));
    expect(degraded(full(23, 56), fresh)).toContain("было 56");
  });

  it("обычный день проходит", () => {
    expect(degraded(full(23, 56), full(24, 56))).toBeNull();
    expect(degraded(full(23, 56), full(24, 40))).toBeNull();
  });

  it("падение больше чем вдвое отклоняется", () => {
    expect(degraded(full(23, 56), full(24, 20))).toContain("стало 20");
  });

  it("первый день сравнивать не с чем, он принимается", () => {
    expect(degraded([], full(23, 56))).toBeNull();
  });
});

describe("acts_daily: участие по названию акции", () => {
  const dir = mkdtempSync(join(tmpdir(), "acts-"));
  const write = (rows: unknown[]): string => {
    const p = join(dir, `a${Math.random().toString(36).slice(2)}.ndjson`);
    writeFileSync(p, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    return p;
  };
  const row = (d: string, art: string, title: string) =>
    ({ date: `2026-09-${d}`, art, title, date_from: "2026-09-13", date_to: "2026-10-06" });
  const US = "Максимальный бустинг: усиление";
  const MX = "Максимальный бустинг";
  const obs = (d: string, arts: string[]) => new Map([[`2026-09-${d}`, new Set(arts)]]);

  it("две акции различаются названием, а не окном дат", () => {
    const r = readActsDaily(write([row("23", "A", US), row("23", "A", MX), row("23", "B", US)]), new Map());
    expect(actKey(US)).not.toBe(actKey(MX));
    expect(membersOn(r, actKey(US), "2026-09-23")).toEqual(["A", "B"]);
    expect(membersOn(r, actKey(MX), "2026-09-23")).toEqual(["A"]);
  });

  it("хвостовой пробел в названии не создаёт вторую акцию", () => {
    const r = readActsDaily(write([row("23", "A", MX + " "), row("23", "B", MX)]), new Map());
    expect(membersOn(r, actKey(MX), "2026-09-23")).toEqual(["A", "B"]);
  });

  it("снятый товар без строк акций это наблюдение «акций нет», а не пропуск", () => {
    // В файле строка только на факт участия, поэтому наблюдаемость приходит из снимка цен.
    const r = readActsDaily(write([row("23", "A", US)]), obs("23", ["A", "C"]));
    expect(inPromoOn(r, "C", actKey(US), "2026-09-23")).toBe(false);
    expect(inPromoOn(r, "D", actKey(US), "2026-09-23")).toBeNull();
  });

  it("выход виден как исчезновение названия, а не как пропавшая строка", () => {
    const r = readActsDaily(
      write([row("23", "A", US), row("24", "A", MX)]),
      new Map([["2026-09-23", new Set(["A"])], ["2026-09-24", new Set(["A"])]]),
    );
    expect(exitOf(r, "A", actKey(US)).exit).toBe("2026-09-24");
    expect(exitOf(r, "A", actKey(MX)).exit).toBeNull();
  });

  it("акция без названия отвергается", () => {
    expect(parseActsRow({ date: "2026-09-23", art: "A", title: "  " })).toContain("без названия");
  });
});
