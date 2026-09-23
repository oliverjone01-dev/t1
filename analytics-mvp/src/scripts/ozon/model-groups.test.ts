// Карта объединённых карточек решает, кого считать роднёй. Ошибка здесь не видна в числах:
// она либо возвращает в контроль брата тестового товара, либо схлопывает разные модели в одну.
import { describe, it, expect } from "vitest";
import { itemsToCardGroups, modelIdOf, modelCountOf, commonName, MIN_MEMBERS } from "./model-groups.js";

const item = (offer: string, model: string | number | null, extra: Record<string, unknown> = {}) => ({
  offer_id: offer,
  sku: `sku-${offer}`,
  name: `GENGLASS Стол кухонный ${offer}`,
  ...(model == null ? {} : { model_info: { model_id: model, count: 2 } }),
  ...extra,
});

describe("чтение model_id", () => {
  it("берётся из model_info, из camelCase и из плоского поля", () => {
    expect(modelIdOf({ model_info: { model_id: 77 } })).toBe("77");
    expect(modelIdOf({ modelInfo: { modelId: 77 } })).toBe("77");
    expect(modelIdOf({ model_id: 77 })).toBe("77");
  });

  it("ноль и пустота это «нет модели», а не модель с номером ноль", () => {
    expect(modelIdOf({ model_info: { model_id: 0 } })).toBe("");
    expect(modelIdOf({})).toBe("");
    expect(modelIdOf(null)).toBe("");
  });

  it("count без числа читается как «OZON не сказал», а не как пустая карточка", () => {
    expect(modelCountOf({ model_info: { count: 5 } })).toBe(5);
    expect(modelCountOf({ model_info: { count: 0 } })).toBe(0);
    expect(modelCountOf({})).toBe(0);
  });
});

describe("подпись карточки", () => {
  it("это общее начало названий, а не название одного из участников", () => {
    expect(commonName(["KONUX Стол 100", "KONUX Стол 180"], "9")).toBe("KONUX Стол");
  });

  it("без общего начала подписываем номером модели, а не первым попавшимся товаром", () => {
    expect(commonName(["Зеркало круглое", "Стол овальный"], "9")).toBe("модель 9");
  });

  it("единственное название берётся как есть", () => {
    expect(commonName(["Стол KONUX"], "9")).toBe("Стол KONUX");
  });
});

describe("сборка групп", () => {
  it("одиночный товар карточкой не становится", () => {
    const { groups, stats } = itemsToCardGroups([item("A", 1)]);
    expect(groups).toEqual([]);
    expect(stats.withModel).toBe(1);
    expect(MIN_MEMBERS).toBe(2);
  });

  it("два товара с одним model_id это одна карточка, id модели и есть ключ", () => {
    const { groups } = itemsToCardGroups([item("A", 1), item("B", 1)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.main).toBe("1");
    expect(groups[0]!.skus.map((s) => s.offer)).toEqual(["A", "B"]);
  });

  it("разные model_id не склеиваются, даже если названия похожи", () => {
    const { groups } = itemsToCardGroups([item("A", 1), item("B", 2), item("C", 2)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.main).toBe("2");
  });

  it("товары без model_id просто не попадают в карту", () => {
    const { groups, stats } = itemsToCardGroups([item("A", null), item("B", null)]);
    expect(groups).toEqual([]);
    expect(stats.withModel).toBe(0);
  });

  it("дубль по offer из пагинации внахлёст карточку не раздувает", () => {
    const { groups } = itemsToCardGroups([item("A", 1), item("A", 1), item("B", 1)]);
    expect(groups[0]!.skus).toHaveLength(2);
  });

  it("недобор против count OZON виден, а не замолчан", () => {
    // OZON обещает 3 участника, пришло 2: карту отдаём, но с меткой неполноты.
    const three = { model_info: { model_id: 5, count: 3 } };
    const { groups, stats, warnings } = itemsToCardGroups([
      { offer_id: "A", name: "Стол A", ...three },
      { offer_id: "B", name: "Стол B", ...three },
    ]);
    expect(groups).toHaveLength(1);
    expect(stats.incomplete).toEqual([{ model: "5", have: 2, want: 3 }]);
    expect(warnings.join(" ")).toContain("недобором");
  });

  it("пустой ответ и ответ без моделей описываются разными словами", () => {
    expect(itemsToCardGroups([]).warnings.join(" ")).toContain("ответ пустой");
    expect(itemsToCardGroups([item("A", null)]).warnings.join(" ")).toContain("model_id");
  });
});
