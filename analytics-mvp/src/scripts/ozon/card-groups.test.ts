import { describe, it, expect } from "vitest";
import { rowsToCardGroups, indexGroups } from "./card-groups.js";

const header = ["Модель", "SKU", "Артикул", "Название", "Роль"];

describe("rowsToCardGroups", () => {
  it("группирует SKU по модели и определяет основную карточку по роли", () => {
    const rows = [
      header,
      ["TRUBIS Wood 200x90", "3564841366", "GGT-03-3-3-E-16080", "Стол овальный белый", "основная"],
      ["TRUBIS Wood 200x90", "3564831766", "GGT-03-3-3-O-20090", "Стол овальный 200", "объединённая"],
    ];
    const { groups } = rowsToCardGroups(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.model).toBe("TRUBIS Wood 200x90");
    expect(groups[0]!.main).toBe("3564841366");
    expect(groups[0]!.skus.map((s) => s.sku)).toEqual(["3564841366", "3564831766"]);
  });

  it("без явной основной берёт первый SKU модели", () => {
    const rows = [header, ["M", "111", "o1", "n1", ""], ["M", "222", "o2", "n2", ""]];
    expect(rowsToCardGroups(rows).groups[0]!.main).toBe("111");
  });

  it("дубль SKU в модели и пустые строки пропускаются с предупреждением", () => {
    const rows = [header, ["M", "111", "", "", "основная"], ["", "", "", "", ""], ["M", "111", "", "", ""]];
    const { groups, warnings } = rowsToCardGroups(rows);
    expect(groups[0]!.skus).toHaveLength(1);
    expect(warnings.some((w) => /повтор/.test(w))).toBe(true);
  });

  it("одиночная модель помечается предупреждением (объединять нечего)", () => {
    const { warnings } = rowsToCardGroups([header, ["Solo", "999", "", "", "основная"]]);
    expect(warnings.some((w) => /1 SKU/.test(w))).toBe(true);
  });

  it("indexGroups строит карты sku->model и model->группа", () => {
    const { groups } = rowsToCardGroups([header, ["M", "111", "", "", "основная"], ["M", "222", "", "", ""]]);
    const { skuToModel, byModel } = indexGroups(groups);
    expect(skuToModel["222"]).toBe("M");
    expect(byModel["M"]!.main).toBe("111");
  });
});
