// eb_pct остался справочной колонкой уровня. Тесты следят за тем, чтобы он таким и остался:
// признаком участия в акции он не является, и вернуть его в гейт значит повторить ошибку,
// из-за которой GGK-02-1-5-120 был помечен вышедшим, сидя в акции.
import { describe, it, expect } from "vitest";
import { loadEbDaily, loadEbFromSnapshots, loadEbSeries, ebOn } from "./eb-level.js";
import { merge, toRows, type EbRow } from "./ozon/eb-daily.js";
import { loadPromoFromSnapshots, winKey } from "./promo.js";

const D = (n: number): string => `2026-09-${String(n).padStart(2, "0")}`;

describe("чтение рядов eb_pct", () => {
  it("отсутствие папки и файла это не ошибка, а пустая карта", () => {
    expect(loadEbFromSnapshots("tools/reakciya/нет-такой-папки").size).toBe(0);
    expect(loadEbDaily("data/нет-такого-файла.ndjson").size).toBe(0);
  });

  it("вытяжка в репозитории читается и выглядит как каталог, а не как обрывок", () => {
    const s = loadEbDaily();
    expect(s.size).toBeGreaterThan(400);
    const days = [...new Set([...s.values()].flat().map((p) => p.date))].sort();
    const last = days[days.length - 1]!;
    const onLast = [...s.values()].filter((p) => p.some((x) => x.date === last));
    expect(onLast.length).toBeGreaterThan(400);
  });

  it("уровень на день берётся из последнего наблюдения не позже дня", () => {
    const s = new Map([["A", [{ date: D(20), pct: 55 }, { date: D(23), pct: 15 }]]]);
    expect(ebOn(s, "A", D(22))).toBe(55);
    expect(ebOn(s, "A", D(23))).toBe(15);
    expect(ebOn(s, "A", D(19))).toBeNull();
    expect(ebOn(s, "нет такого", D(23))).toBeNull();
  });
});

describe("eb_pct это не участие в акции", () => {
  it("ноль в eb_pct не значит, что товар вышел из «Усиления»", () => {
    // Проверка на живых данных: именно на этом разошлись страница и кабинет 24.09.
    const eb = loadEbSeries();
    const promo = loadPromoFromSnapshots();
    if (!eb.size || !promo.length) return;
    const last = promo.map((r) => r.date).sort().pop()!;
    const US = winKey("STO", "2026-09-13", "2026-10-06");
    const inUs = new Set(promo.filter((r) => r.date === last
      && r.promos.some((p) => winKey(p.t, p.from, p.to) === US)).map((r) => r.art));
    const zeroInPromo = [...inUs].filter((a) => ebOn(eb, a, last) === 0);
    expect(zeroInPromo.length).toBeGreaterThan(0);
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
