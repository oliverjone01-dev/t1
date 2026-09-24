// Подпись источника это не косметика: по ней читатель понимает, с чем сравнивается тест.
import { describe, it, expect } from "vitest";
import { pickCtlSrc, CTL_SRC_NAME, type CtlAvail } from "./ctl-src.js";

const base: CtlAvail = { funnelMetric: false, funnelFile: false, funnelArts: 0, funnelAgg: false, explicit: false };

describe("выбор источника контроля", () => {
  it("поартикульные строки среза под тесты важнее всего", () => {
    expect(pickCtlSrc({ ...base, funnelMetric: true, funnelFile: true, funnelArts: 46, funnelAgg: true }))
      .toBe("funnel_arts");
  });

  it("без поартикульных берётся готовый агрегат", () => {
    expect(pickCtlSrc({ ...base, funnelMetric: true, funnelFile: true, funnelAgg: true })).toBe("funnel_agg");
  });

  it("явный список из tests.json НЕ называется панелью", () => {
    // Ровно дефект, найденный 24.09: контроль теста 2 это 46 участников акции, а страница
    // писала «панель снимка без тестовых и их родни».
    const src = pickCtlSrc({ ...base, explicit: true });
    expect(src).toBe("explicit");
    expect(CTL_SRC_NAME[src]).not.toContain("панель");
    expect(CTL_SRC_NAME[src]).toContain("tests.json");
  });

  it("панель остаётся только там, где контроль действительно из панели", () => {
    expect(pickCtlSrc(base)).toBe("panel");
  });

  it("не вороночная метрика не берёт контроль из файла воронки", () => {
    // Соинвест и цена в funnel_tests не приходят, и подменять их оттуда нечем.
    expect(pickCtlSrc({ ...base, funnelFile: true, funnelArts: 46, explicit: true })).toBe("explicit");
  });

  it("файла нет: строки в нём не спасают", () => {
    expect(pickCtlSrc({ ...base, funnelMetric: true, funnelArts: 46, explicit: true })).toBe("explicit");
  });

  it("у каждого источника есть человеческое имя", () => {
    for (const k of Object.keys(CTL_SRC_NAME)) expect(CTL_SRC_NAME[k as keyof typeof CTL_SRC_NAME].length).toBeGreaterThan(10);
  });
});
