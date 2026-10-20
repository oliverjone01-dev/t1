import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { readGapDaily, readGapMarked, markNoSite, markNoSiteEx, noSite, GAP_DAILY_FILE, GAP_MANUAL_FILE, NO_SITE_DAY_MIN, type GapRow } from "./gap-daily.js";
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

  it("ноль в ряду только у карточки с историей: строка без витрины у новой карточки помечена no_site (14 строк на 19.10, v8/fix_nodata_1610.py)", () => {
    // Правило, а не снимок (ФЕНИКС #487 iter4 L3, E091): честный ноль у зрелой карточки законен, новая карточка
    // с мака приходит нулём без метки до скрипта v8 - оба состояния тест должен пропускать.
    const r = readGapDaily("data/" + GAP_DAILY_FILE);
    if (!r.exists) return;
    expect(r.noSite).toBeGreaterThanOrEqual(14);
    const firstNonZero = new Map<string, string>();
    for (const x of r.rows) if ((x.gap_pct ?? -1) > 0 && (firstNonZero.get(x.art) ?? "9999") > x.date) firstNonZero.set(x.art, x.date);
    const zeroWithoutHistory = r.rows.filter((x) => x.gap_pct === 0 && !((firstNonZero.get(x.art) ?? "9999") < x.date)).map((x) => `${x.date} ${x.art}`);
    expect(zeroWithoutHistory).toEqual([]);
  });

  it("каждая метка no_site, в файле или при чтении, стоит у карточки без истории (Иван 19.10)", () => {
    if (!existsSync("data/" + GAP_DAILY_FILE)) return;
    const raw = readFileSync("data/" + GAP_DAILY_FILE, "utf-8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
    const firstNonZero = new Map<string, string>();
    for (const r of raw) if (Number(r.gap_pct) > 0 && (firstNonZero.get(r.art) ?? "9999") > r.date) firstNonZero.set(r.art, r.date);
    // Число меток в файле не проверяем: пока скрипт v8 не прогнан, метки новой карточке ставит чтение (E091).
    const inFile = raw.filter((r) => r.no_site === true);
    const marked = markNoSiteEx(raw);
    const byRead = marked.rows.filter(noSite);
    // Метки файла - подмножество меток при чтении: чтение может добавить метку новой карточке, которую мак записал
    // нулём до скрипта v8, но не может снять метку, лежащую в файле.
    const readKeys = new Set(byRead.map((r) => `${r.date}|${r.art}`));
    expect(inFile.filter((r) => !readKeys.has(`${r.date}|${r.art}`))).toEqual([]);
    // Историю проверяем только у меток, которые добавило чтение, и вне системных дней: метка в файле у зрелой
    // карточки законна - так снимают ложный стоп (Codex #488 P1, ФЕНИКС #488 L4); системный день метит всех.
    const fileKeys = new Set(inFile.map((r) => `${r.date}|${r.art}`)), sysDays = new Set(marked.systemDays);
    const withHistory = byRead
      .filter((r) => !fileKeys.has(`${r.date}|${r.art}`) && !sysDays.has(r.date) && (firstNonZero.get(r.art) ?? "9999") < r.date)
      .map((r) => `${r.date} ${r.art}`);
    expect(withHistory).toEqual([]);
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
    // Честный ноль у соседа (OZON перестал доплачивать, Иван 19.10) - событие, а не шум метода: такие дни из
    // проверки шума исключаются, иначе тест красный навсегда (ФЕНИКС #488 iter2, E091).
    // Ноль у любой стороны пары: у самой карточки или у соседа по объединённой карточке, с которым она
    // сравнивается (Codex #489 P2, ФЕНИКС #489 L5).
    const zeroDays = new Set(G.rows.filter((r) => r.gap_pct === 0).map((r) => `${r.date}|${r.art}`));
    const worst = Math.max(...SIB.map((a) => {
      const sibs = sibsOf(a);
      const ser = sibs.length ? pairGapSeries(G.rows, a, sibs) : gapSeries(G.rows, a, ctl);
      const r = readiness({ art: a, on }, ser, new Map(), BASE_MIN);
      const zeroAt = (d: string) => zeroDays.has(`${d}|${a}`) || sibs.some((x) => zeroDays.has(`${d}|${x}`));
      return Math.max(0, ...r.series.filter((p) => !zeroAt(p.date)).map((p) => Math.abs(p.shift)));
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
        // До 25.09 в ряду три дня подряд после дыры 22.09 не набирается ни у кого. Позже, если
        // сдвиг прервался (28.09 у четырёх артикулов упал ниже +8), ближайшая дата плато уходит
        // дальше 25.09, но раньше её не бывает никогда.
        expect(r.plateauFrom).toBeUndefined();
        if (last < "2026-09-25") expect(r.plateauNotBefore).toBe("2026-09-25");
        else expect(r.plateauNotBefore! >= "2026-09-25").toBe(true);
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

describe("съём утром и вечером: повтор даты заменяет строку (К4)", () => {
  it("на дату и товар одна строка, побеждает последняя", () => {
    const dir = mkdtempSync(join(tmpdir(), "gap2-"));
    const p = join(dir, "gap_daily.ndjson");
    writeFileSync(p, [
      JSON.stringify({ date: "2026-10-15", art: "A-1", gap_pct: 10, src: "prices_raw", snap: "утро" }),
      JSON.stringify({ date: "2026-10-15", art: "A-1", gap_pct: 12, src: "prices_raw", snap: "вечер" }),
    ].join("\n"));
    const r = readGapDaily(p);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.gap_pct).toBe(12);
  });
});

describe("срез без витрины: «нет данных», а не ноль (Иван 16.10; ФЕНИКС 16.10 G1, M1)", () => {
  it("SKU пустой и разрыв 0 - строка не идёт в ряд и не считается битой", () => {
    const r = readGapDaily(tmp([
      { date: "2026-10-16", art: "NEW", sku: "", site_to_seller: 1.0, gap_pct: 0.0, src: "prices_raw", oa_used: false },
      { date: "2026-10-16", art: "OLD", sku: "123", site_to_seller: 0.5, gap_pct: 50, src: "prices_raw", oa_used: false },
    ]));
    expect(r.rows.map((x) => x.art)).toEqual(["OLD"]);
    expect(r.noSite).toBe(1);
    expect(r.bad).toBe(0);
  });

  it("метка no_site: строка, которой мак потом дописал SKU, тоже «нет данных»", () => {
    const r = readGapDaily(tmp([{ date: "2026-10-16", art: "NEW", sku: "123", site_to_seller: null, gap_pct: null, no_site: true, src: "prices_raw" }]));
    expect(r.rows).toEqual([]);
    expect(r.noSite).toBe(1);
    expect(r.bad).toBe(0);
  });

  it("ноль со SKU при цене сайта, равной нашей, - тоже «нет данных» (Иван 19.10: первый день карточки, не доплата)", () => {
    const r = readGapDaily(tmp([{ date: "2026-10-12", art: "A", sku: "123", site_to_seller: 1.0, gap_pct: 0.0, src: "prices_raw" }]));
    expect(r.rows).toEqual([]);
    expect(r.noSite).toBe(1);
  });

  it("маленький, но ненулевой разрыв со SKU остаётся: нет данных только при равенстве цен", () => {
    const r = readGapDaily(tmp([{ date: "2026-10-12", art: "A", sku: "123", site_to_seller: 0.98, gap_pct: 2.0, src: "prices_raw" }]));
    expect(r.rows[0]!.gap_pct).toBe(2);
    expect(r.noSite).toBe(0);
  });

  it("пусто без SKU - это «нет числа» (bad), а не «нет витрины»", () => {
    const r = readGapDaily(tmp([{ date: "2026-10-16", art: "A", gap_pct: null, src: "prices_raw" }]));
    expect(r.bad).toBe(1);
    expect(r.noSite).toBe(0);
  });

  it("повтор без витрины не стирает снятое значение того же дня (M1); повтор со значением стирает ложный 0", () => {
    const r = readGapDaily(tmp([
      { date: "2026-10-16", art: "A", sku: "123", gap_pct: 47.5, src: "prices_raw", snap: "утро" },
      { date: "2026-10-16", art: "A", sku: "", gap_pct: 0, src: "prices_raw", snap: "вечер" },
      { date: "2026-10-16", art: "B", sku: "", gap_pct: 0, src: "prices_raw", snap: "утро" },
      { date: "2026-10-16", art: "B", sku: "456", gap_pct: 47.6, src: "prices_raw", snap: "вечер" },
    ]));
    expect(Object.fromEntries(r.rows.map((x) => [x.art, x.gap_pct]))).toEqual({ A: 47.5, B: 47.6 });
    expect(r.noSite).toBe(0);
  });
});

describe("ноль у карточки с историей остаётся нулём (Иван 19.10 после ФЕНИКСА Z1)", () => {
  it("прежний день с разрывом есть: ноль идёт в ряд как 0, не как «нет данных»", () => {
    const r = readGapDaily(tmp([
      { date: "2026-10-12", art: "GGK-02-3-3-80", sku: "123", site_to_seller: 0.53, gap_pct: 47, src: "prices_raw", oa_used: false },
      { date: "2026-10-19", art: "GGK-02-3-3-80", sku: "123", site_to_seller: 1.0, gap_pct: 0.0, src: "prices_raw", oa_used: false },
    ]));
    expect(r.rows.map((x) => [x.date, x.gap_pct])).toEqual([["2026-10-12", 47], ["2026-10-19", 0]]);
    expect(r.noSite).toBe(0);
  });

  it("история считается по всему файлу, а не по порядку строк", () => {
    const r = readGapDaily(tmp([
      { date: "2026-10-19", art: "A", sku: "1", site_to_seller: 1.0, gap_pct: 0.0, src: "prices_raw" },
      { date: "2026-10-12", art: "A", sku: "1", site_to_seller: 0.53, gap_pct: 47, src: "prices_raw" },
    ]));
    expect(r.rows.find((x) => x.date === "2026-10-19")!.gap_pct).toBe(0);
    expect(r.noSite).toBe(0);
  });

  it("более поздний день историей не считается: первый день карточки - «нет данных», даже если назавтра 47 %", () => {
    const r = readGapDaily(tmp([
      { date: "2026-10-16", art: "NEW", sku: "", site_to_seller: 1.0, gap_pct: 0.0, src: "prices_raw" },
      { date: "2026-10-17", art: "NEW", sku: "9", site_to_seller: 0.53, gap_pct: 47, src: "prices_raw" },
    ]));
    expect(r.rows.map((x) => [x.date, x.gap_pct])).toEqual([["2026-10-17", 47]]);
    expect(r.noSite).toBe(1);
  });

  it("история - только ненулевой разрыв: два нуля подряд у новой карточки оба «нет данных»", () => {
    const r = readGapDaily(tmp([
      { date: "2026-10-10", art: "GGT-47-5-1-80", site_to_seller: 1.0, gap_pct: 0.0, src: "prices_raw" },
      { date: "2026-10-11", art: "GGT-47-5-1-80", site_to_seller: 1.0, gap_pct: 0.0, src: "prices_raw" },
    ]));
    expect(r.rows).toEqual([]);
    expect(r.noSite).toBe(2);
  });

  it("готовая метка no_site из файла главнее истории", () => {
    const r = readGapDaily(tmp([
      { date: "2026-10-12", art: "A", sku: "1", site_to_seller: 0.53, gap_pct: 47, src: "prices_raw" },
      { date: "2026-10-19", art: "A", sku: "1", site_to_seller: null, gap_pct: null, no_site: true, src: "prices_raw" },
    ]));
    expect(r.rows.map((x) => x.date)).toEqual(["2026-10-12"]);
    expect(r.noSite).toBe(1);
    expect(r.bad).toBe(0);
  });

  it("M1 не зависит от истории: вечерний ноль у зрелой карточки не стирает снятое утром значение того же дня", () => {
    const r = readGapDaily(tmp([
      { date: "2026-10-12", art: "A", sku: "1", gap_pct: 47, src: "prices_raw" },
      { date: "2026-10-19", art: "A", sku: "1", gap_pct: 47.5, src: "prices_raw", snap: "утро" },
      { date: "2026-10-19", art: "A", sku: "", gap_pct: 0, src: "prices_raw", snap: "вечер" },
    ]));
    expect(r.rows.find((x) => x.date === "2026-10-19")!.gap_pct).toBe(47.5);
    expect(r.noSite).toBe(0);
  });

  it("markNoSite: прямые читатели видят ту же метку и не меняют входные строки", () => {
    const input: GapRow[] = [
      { date: "2026-10-16", art: "NEW", gap_pct: 0 },
      { date: "2026-10-12", art: "OLD", gap_pct: 47 },
      { date: "2026-10-19", art: "OLD", gap_pct: 0 },
    ];
    const out = markNoSite(input);
    expect(out.map((r) => [r.art, r.date, noSite(r)])).toEqual([["NEW", "2026-10-16", true], ["OLD", "2026-10-12", false], ["OLD", "2026-10-19", false]]);
    expect(input[0]!.no_site).toBeUndefined();
  });
});

describe("системный день: цена сайта равна нашей у 90% строк дня и больше (K2 ФЕНИКСА iter4, Иван 19.10)", () => {
  const day = (date: string, n: number, zeros: number, art = "A"): GapRow[] =>
    Array.from({ length: n }, (_, i) => ({ date, art: `${art}${i}`, sku: "1", gap_pct: i < zeros ? 0 : 47, site_to_seller: i < zeros ? 1.0 : 0.53, src: "prices_raw" }));

  it("все строки без витрины системного дня - «нет данных» даже у карточек с историей; стоп не зажигается", () => {
    const rows = [...day("2026-10-12", 60, 0), ...day("2026-10-19", 60, 55)];
    const { rows: out, systemDays } = markNoSiteEx(rows);
    expect(systemDays).toEqual(["2026-10-19"]);
    const d19 = out.filter((r) => r.date === "2026-10-19");
    expect(d19.filter(noSite)).toHaveLength(55);
    expect(d19.filter((r) => !noSite(r)).map((r) => r.gap_pct)).toEqual(Array(5).fill(47));
    const r = readGapDaily(tmp(rows));
    expect(r.systemDays).toEqual(["2026-10-19"]);
    expect(r.rows.filter((x) => x.date === "2026-10-19")).toHaveLength(5);
    expect(r.noSite).toBe(55);
  });

  it("ниже 90% - обычный день: ноль с историей остаётся нулём", () => {
    const rows = [...day("2026-10-12", 60, 0), ...day("2026-10-19", 60, 50)];
    const { rows: out, systemDays } = markNoSiteEx(rows);
    expect(systemDays).toEqual([]);
    expect(out.filter((r) => r.date === "2026-10-19" && noSite(r))).toHaveLength(0);
    expect(out.filter((r) => r.date === "2026-10-19" && r.gap_pct === 0)).toHaveLength(50);
  });

  it(`меньше ${NO_SITE_DAY_MIN} строк в дне - правило дня не применяется: срез из одной новой карточки не системный день`, () => {
    const rows = [...day("2026-10-12", 3, 0), ...day("2026-10-19", 3, 3)];
    const { rows: out, systemDays } = markNoSiteEx(rows);
    expect(systemDays).toEqual([]);
    expect(out.filter((r) => r.date === "2026-10-19" && r.gap_pct === 0 && !noSite(r))).toHaveLength(3);
  });

  it("порог ни один день до 19.10 включительно не задевает [ДАННЫЕ gap_daily 19.10: максимум 1,9%]; позже системный день законен", () => {
    if (!existsSync("data/" + GAP_DAILY_FILE)) return;
    const r = readGapDaily("data/" + GAP_DAILY_FILE);
    expect(r.systemDays.filter((d) => d <= "2026-10-19")).toEqual([]);
    expect(r.warnDays.filter((d) => d <= "2026-10-19")).toEqual([]);
  });

  it("зона предупреждения 15-90%: значения как есть, день в warnDays", () => {
    const rows = [...day("2026-10-12", 60, 0), ...day("2026-10-19", 60, 20)];
    const { rows: out, systemDays, warnDays } = markNoSiteEx(rows);
    expect(systemDays).toEqual([]);
    expect(warnDays).toEqual(["2026-10-19"]);
    expect(out.filter((r) => r.date === "2026-10-19" && r.gap_pct === 0 && !noSite(r))).toHaveLength(20);
  });

  it("метка из файла у зрелой карточки (снятие ложного стопа) законна и остаётся", () => {
    const rows = [...day("2026-10-12", 60, 0), { date: "2026-10-19", art: "A0", sku: "1", gap_pct: null as unknown as number, site_to_seller: null as unknown as number, no_site: true, src: "prices_raw" }];
    const r = readGapDaily(tmp(rows));
    expect(r.noSite).toBe(1);
    expect(r.rows.filter((x) => x.date === "2026-10-19")).toEqual([]);
  });
});

describe("ручные снятия ложных стопов: gap_manual.ndjson рядом с gap_daily (Иван 20.10)", () => {
  const withManual = (lines: object[], manual: object[]): string => {
    const p = tmp(lines);
    writeFileSync(join(dirname(p), GAP_MANUAL_FILE), manual.map((l) => JSON.stringify(l)).join("\n") + "\n", "utf-8");
    return p;
  };
  const mature = [
    { date: "2026-10-12", art: "GGK-02-3-3-80", sku: "1", gap_pct: 47, site_to_seller: 0.53, src: "prices_raw" },
    { date: "2026-10-19", art: "GGK-02-3-3-80", sku: "1", gap_pct: 0, site_to_seller: 1.0, src: "prices_raw" },
  ];

  it("запись (день, артикул) гасит честный ноль у зрелой карточки: строка «нет данных», как метка в файле", () => {
    const p = withManual(mature, [{ date: "2026-10-19", art: "GGK-02-3-3-80", reason: "сбой витрины", by: "тест" }]);
    const r = readGapDaily(p);
    expect(r.rows.map((x) => [x.date, x.gap_pct])).toEqual([["2026-10-12", 47]]);
    expect(r.noSite).toBe(1);
    expect(r.manual).toBe(1);
    expect(readGapMarked(p).rows.find((x) => x.date === "2026-10-19")!.no_site).toBe(true);
  });

  it("без файла и с записью на другой день или артикул ноль остаётся нулём", () => {
    expect(readGapDaily(tmp(mature)).rows.find((x) => x.date === "2026-10-19")!.gap_pct).toBe(0);
    const p = withManual(mature, [{ date: "2026-10-18", art: "GGK-02-3-3-80" }, { date: "2026-10-19", art: "OTHER" }]);
    const r = readGapDaily(p);
    expect(r.rows.find((x) => x.date === "2026-10-19")!.gap_pct).toBe(0);
    expect(r.manual).toBe(0);
  });

  it("битая строка ручного файла снятие не делает и чтение не ломает", () => {
    const p = tmp(mature);
    writeFileSync(join(dirname(p), GAP_MANUAL_FILE), "{не json\n", "utf-8");
    expect(readGapDaily(p).rows.find((x) => x.date === "2026-10-19")!.gap_pct).toBe(0);
  });

  it("запись на ненулевую строку (поздний срез исправил день) ничего не делает", () => {
    const fixed = [mature[0]!, { ...mature[1]!, gap_pct: 48.55, site_to_seller: 0.51 }];
    const p = withManual(fixed, [{ date: "2026-10-19", art: "GGK-02-3-3-80", reason: "сбой витрины" }]);
    const r = readGapDaily(p);
    expect(r.rows.find((x) => x.date === "2026-10-19")!.gap_pct).toBe(48.55);
    expect(r.manual).toBe(0);
    expect(r.manualRows).toEqual([]);
  });

  it("применённые записи возвращаются для строки «снято вручную» на странице; файл есть - manualFile true", () => {
    const p = withManual(mature, [{ date: "2026-10-19", art: "GGK-02-3-3-80", reason: "сбой витрины", by: "тест" }]);
    const r = readGapDaily(p);
    expect(r.manualRows).toEqual([{ date: "2026-10-19", art: "GGK-02-3-3-80", reason: "сбой витрины", by: "тест" }]);
    expect(r.manualFile).toBe(true);
    expect(readGapDaily(tmp(mature)).manualFile).toBe(false);
  });

  it("живой файл ручных снятий на месте (сторож: мак или чистка data/ не должны его потерять) и каждая запись - день и артикул из gap_daily", () => {
    if (!existsSync("data/" + GAP_DAILY_FILE)) return;
    expect(existsSync("data/" + GAP_MANUAL_FILE)).toBe(true);
    const keys = new Set(readFileSync("data/" + GAP_DAILY_FILE, "utf-8").split("\n").filter((l) => l.trim()).map((l) => { const r = JSON.parse(l); return `${r.date}|${r.art}`; }));
    const manual = readFileSync("data/" + GAP_MANUAL_FILE, "utf-8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
    for (const m of manual) {
      expect(typeof m.date).toBe("string"); expect(typeof m.art).toBe("string");
      expect(keys.has(`${m.date}|${m.art}`)).toBe(true);
    }
  });
});
