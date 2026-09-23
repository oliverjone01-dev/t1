// Пустая клетка решает, как выглядит график. Ошибка здесь громкая и при этом незаметная:
// пропуск съёма рисуется обвалом до нуля, и читатель видит провал теста там, где его нет.
import { describe, it, expect } from "vitest";
import { metricDays, gapValue, gapFiller, coverage } from "./metric-gap.js";

type Row = Record<string, number | undefined>;
const S = (spec: Record<string, Record<string, Row>>): Map<string, Map<string, Row>> =>
  new Map(Object.entries(spec).map(([art, days]) => [art, new Map(Object.entries(days))]));

const isLevel = (k: string) => k === "coinv";

describe("дни, в которые метрику снимали", () => {
  it("это дни, где значение есть хоть у одного артикула", () => {
    const s = S({ A: { "2026-09-21": { vsearch: 0 }, "2026-09-22": {} }, B: { "2026-09-22": { vsearch: 5 } } });
    expect([...metricDays(s, "vsearch")].sort()).toEqual(["2026-09-21", "2026-09-22"]);
  });

  it("ноль это снятое значение, а не отсутствие дня", () => {
    // Ровно тут и живёт ошибка: у товара честный ноль показов, день снят.
    const s = S({ A: { "2026-09-21": { vsearch: 0 } } });
    expect(metricDays(s, "vsearch").has("2026-09-21")).toBe(true);
  });

  it("день без этой метрики в набор не попадает, даже если другие метрики в нём есть", () => {
    const s = S({ A: { "2026-09-23": { coinv: 50 } } });
    expect(metricDays(s, "vsearch").size).toBe(0);
    expect(metricDays(s, "coinv").size).toBe(1);
  });
});

describe("чем заполнять пустую клетку", () => {
  const days = new Set(["2026-09-21"]);

  it("количество в СНЯТЫЙ день это ноль: показов правда не было", () => {
    expect(gapValue("vsearch", "2026-09-21", isLevel, days)).toBe(0);
  });

  it("количество в НЕснятый день это пропуск, а не ноль", () => {
    expect(gapValue("vsearch", "2026-09-23", isLevel, days)).toBeNull();
  });

  it("уровень это всегда пропуск: усреднять соинвест с нулём нельзя", () => {
    expect(gapValue("coinv", "2026-09-21", isLevel, days)).toBeNull();
    expect(gapValue("coinv", "2026-09-23", isLevel, days)).toBeNull();
  });
});

describe("заполнитель с кэшем", () => {
  it("даёт те же ответы, что и прямой расчёт", () => {
    const s = S({ A: { "2026-09-21": { vsearch: 3 }, "2026-09-22": { coinv: 50 } } });
    const g = gapFiller(s, isLevel);
    expect(g("vsearch", "2026-09-21")).toBe(0);    // день снят, у этой группы пусто
    expect(g("vsearch", "2026-09-22")).toBeNull(); // показы в этот день не снимали
    expect(g("coinv", "2026-09-21")).toBeNull();   // уровень
  });

  it("повторный вызов по той же метрике отвечает так же", () => {
    const s = S({ A: { "2026-09-21": { vsearch: 3 } } });
    const g = gapFiller(s, isLevel);
    expect(g("vsearch", "2026-09-22")).toBe(g("vsearch", "2026-09-22"));
    expect(g("vsearch", "2026-09-21")).toBe(0);
  });
});

describe("покрытие метрик", () => {
  it("называет последний день по каждой метрике и молчит о ненайденных", () => {
    const s = S({
      A: { "2026-09-21": { vsearch: 1 }, "2026-09-23": { coinv: 50 } },
      B: { "2026-09-22": { vsearch: 2 } },
    });
    expect(coverage(s, ["coinv", "vsearch", "units"])).toEqual([
      { key: "coinv", last: "2026-09-23" },
      { key: "vsearch", last: "2026-09-22" },
    ]);
  });
});
