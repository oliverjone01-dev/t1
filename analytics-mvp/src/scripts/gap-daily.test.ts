import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readGapDaily, GAP_DAILY_FILE } from "./gap-daily.js";
import { gapSeries, controlByDay, median, pairGapSeries, readiness, BASE_MIN } from "./boost-readiness.js";

const tmp = (lines: object[]): string => {
  const d = mkdtempSync(join(tmpdir(), "gap-"));
  const p = join(d, GAP_DAILY_FILE);
  writeFileSync(p, lines.map((l) => JSON.stringify(l)).join("\n"), "utf-8");
  return p;
};

describe("readGapDaily", () => {
  it("файла нет: exists=false, а не пустой ряд, выданный за данные", () => {
    const r = readGapDaily(join(tmpdir(), "нет-такого-файла.ndjson"));
    expect(r.exists).toBe(false);
    expect(r.rows).toEqual([]);
  });

  it("читает gap_pct и считает источники", () => {
    const r = readGapDaily(tmp([
      { date: "2026-09-09", art: "A", gap_pct: 46.03, src: "snapshot", oa_used: false },
      { date: "2026-09-19", art: "A", gap_pct: 47.52, src: "prices_raw", oa_used: false },
    ]));
    expect(r.exists).toBe(true);
    expect(r.days).toEqual(["2026-09-09", "2026-09-19"]);
    expect(r.bySrc.get("snapshot")).toBe(1);
    expect(r.bySrc.get("prices_raw")).toBe(1);
    expect(r.rows[0]!.gap_pct).toBe(46.03);
  });

  it("строку с oa_used=true отбрасывает: смешивать шкалы в одном ряду нельзя", () => {
    const r = readGapDaily(tmp([
      { date: "2026-09-19", art: "A", gap_pct: 47.5, src: "prices_raw", oa_used: false },
      { date: "2026-09-19", art: "B", gap_pct: 47.5, src: "prices_raw", oa_used: true },
    ]));
    expect(r.rows).toHaveLength(1);
    expect(r.withOa).toBe(1);
  });

  it("строку без числа не считает нулём", () => {
    const r = readGapDaily(tmp([
      { date: "2026-09-19", art: "A", gap_pct: null, src: "prices_raw" },
      { date: "2026-09-19", art: "B", src: "prices_raw" },
    ]));
    expect(r.rows).toEqual([]);
    expect(r.bad).toBe(2);
  });

  it("ряд читается тем же кодом, что соинвест: gap_pct берётся как уровень", () => {
    const r = readGapDaily(tmp([
      { date: "2026-09-19", art: "A", gap_pct: 50, src: "prices_raw" },
      { date: "2026-09-19", art: "B", gap_pct: 44, src: "prices_raw" },
      { date: "2026-09-19", art: "C", gap_pct: 46, src: "prices_raw" },
    ]));
    const ctl = controlByDay(r.rows, new Set(["A"]));
    expect(ctl.get("2026-09-19")).toBe(median([44, 46]));
    expect(gapSeries(r.rows, "A", ctl)).toEqual([{ date: "2026-09-19", gap: 5 }]);
  });
});

describe("живой файл data/gap_daily.ndjson", () => {
  it("цена с картой в расчёт не входит ни в одной строке", () => {
    const r = readGapDaily("data/" + GAP_DAILY_FILE);
    if (!r.exists) return;                      // файла может не быть на чужой машине
    expect(r.withOa).toBe(0);
    expect(r.bad).toBe(0);
  });

  it("рублёвых цен в файле нет: предельная цена в публичный репозиторий не едет", () => {
    if (!existsSync("data/" + GAP_DAILY_FILE)) return;
    const first = JSON.parse(readFileSync("data/" + GAP_DAILY_FILE, "utf-8").split("\n")[0]!);
    for (const k of ["site", "seller", "min_price", "marketing_seller_price"]) {
      expect(Object.keys(first)).not.toContain(k);
    }
  });

  it("источники ряда - только наблюдения", () => {
    const r = readGapDaily("data/" + GAP_DAILY_FILE);
    if (!r.exists) return;
    // Все дни ряда сняты, моделей в нём нет: источники только snapshot и prices_raw.
    expect([...r.bySrc.keys()].sort()).toEqual(["prices_raw", "snapshot"]);
  });
});

// ГЕЙТ НА ЖИВОМ РЯДУ. Проверяем не «собралось», а сами числа: §15 требует сверки, а не
// отсутствия ошибок. Если файла нет (чужая машина, свежий клон без данных) - тест пропускается.
describe("гейт плато на живом gap_daily", () => {
  const G = readGapDaily("data/" + GAP_DAILY_FILE);
  const T = JSON.parse(readFileSync("tools/tests/tests.json", "utf-8")) as {
    тесты: Array<{ id: string; старт?: string; роли?: Record<string, string[]>; тест?: string[]; контроль?: string[] }>;
  };
  const wave = T.тесты.find((t) => t.id === "boost_plus_exit")!;
  const card = new Map<string, string>();
  if (existsSync("data/card_groups.json")) {
    for (const g of (JSON.parse(readFileSync("data/card_groups.json", "utf-8")).groups as
      Array<{ main: string; skus: Array<{ offer: string }> }>)) {
      for (const s of g.skus) card.set(s.offer, g.main);
    }
  }
  const AD = wave.роли?.test_ad ?? [], SIB = wave.роли?.test_sibling ?? [];
  const on = (wave.старт || "").slice(0, 10);
  const sibsOf = (a: string) => SIB.filter((x) => card.get(x) && card.get(x) === card.get(a));

  it("до старта волны в сыром ряду ровно два наблюдаемых дня", () => {
    if (!G.exists) return;
    const before = G.days.filter((d) => d < on);
    expect(before).toEqual(["2026-09-09", "2026-09-19"]);
    expect(before.length).toBe(BASE_MIN);
  });

  it("плацебо-группа держится: соседи без рекламы не уходят от базы", () => {
    if (!G.exists || !SIB.length) return;
    const ctl = controlByDay(G.rows, new Set([...AD, ...SIB]));
    const worst = Math.max(...SIB.map((a) => {
      const ser = sibsOf(a).length ? pairGapSeries(G.rows, a, sibsOf(a)) : gapSeries(G.rows, a, ctl);
      const r = readiness({ art: a, on }, ser, new Map(), BASE_MIN);
      return Math.max(0, ...r.series.map((p) => Math.abs(p.shift)));
    }));
    // Порог +8 держится, пока шум метода много меньше его. Граница 2 пункта взята с запасом:
    // на 24.09 худший сосед даёт 0.7. Если тест упадёт, порог надо пересматривать, а не правку
    // границы писать: это и есть сигнал, ради которого тест стоит.
    expect(worst).toBeLessThan(2);
    expect(worst).toBeGreaterThan(0);          // ноль означал бы, что ряд не читается
  });

  it("плато не собирается раньше 25.09: 22.09 в ряду нет", () => {
    if (!G.exists) return;
    const ctl = controlByDay(G.rows, new Set([...AD, ...SIB]));
    const last = G.days[G.days.length - 1]!;
    for (const a of AD) {
      const r = readiness({ art: a, on }, gapSeries(G.rows, a, ctl), new Map(), BASE_MIN, false);
      if (last < "2026-09-25" || !r.plateauFrom) {
        // До 25.09 в ряду три дня подряд после дыры 22.09 не набирается ни у кого.
        expect(r.plateauFrom).toBeUndefined();
        expect(r.plateauNotBefore).toBe("2026-09-25");
      } else {
        // Плато начинается не раньше первого дня после дыры и подтверждено третьим днём.
        expect(r.plateauFrom >= "2026-09-23").toBe(true);
        expect(G.days.filter((d) => d >= r.plateauFrom!).length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("25.09: плато сложилось только у GGL-07-XL-2 (сдвиг 8.9, 9.0, 8.4 с 23.09)", () => {
    if (!G.exists || !G.days.includes("2026-09-25")) return;
    const ctl = controlByDay(G.rows, new Set([...AD, ...SIB]));
    const got = AD.filter((a) => readiness({ art: a, on }, gapSeries(G.rows, a, ctl), new Map(), BASE_MIN, false).plateauFrom);
    // Цифры Ивана 8.8, 8.7, 8.2 посчитаны его контролем; порог +8 и три дня держатся в обоих.
    if (G.days[G.days.length - 1] === "2026-09-25") expect(got).toEqual(["GGL-07-XL-2"]);
  });
});
