// Карта карточек решает, кто выходит из контроля. Ошибка здесь не видна в числах: она
// либо возвращает в контроль соседа по карточке, либо без нужды выбрасывает чужой товар.
import { describe, it, expect } from "vitest";
import { parseCardsPsv, toGroups, latestCardsFile, CABINET_DIR } from "./cards-extract.js";

const HEAD = "art|sku|item_id|card_id|card_variants_declared|model_id|model_variants_declared";
const psv = (...rows: string[]) => [HEAD, ...rows].join("\n");

describe("разбор выгрузки", () => {
  it("берёт артикул, sku и карточку, остальное не тащит", () => {
    const r = parseCardsPsv(psv("A-1|111|222|CARD1|3|999|3"));
    expect(r).toEqual([{ art: "A-1", sku: "111", card: "CARD1", declared: 3 }]);
  });

  it("товар без карточки не берётся: пустая карточка это «не склеен»", () => {
    expect(parseCardsPsv(psv("A-1|111|222||0|999|0"))).toEqual([]);
  });

  it("порядок колонок не зашит, читается по шапке", () => {
    const r = parseCardsPsv("card_id|art\nCARD9|Z-9");
    expect(r[0]!.art).toBe("Z-9");
    expect(r[0]!.card).toBe("CARD9");
  });

  it("файл без нужных колонок даёт пусто, а не мусор", () => {
    expect(parseCardsPsv("foo|bar\n1|2")).toEqual([]);
    expect(parseCardsPsv("")).toEqual([]);
  });
});

describe("сборка групп", () => {
  it("одиночка карточкой не становится и считается отдельно", () => {
    const { groups, singles } = toGroups(parseCardsPsv(psv("A-1|1|2|C1|1|9|1")));
    expect(groups).toEqual([]);
    expect(singles).toBe(1);
  });

  it("двое на одной карточке дают группу, ключ это card_id", () => {
    const { groups } = toGroups(parseCardsPsv(psv("B-2|2|2|C1|2|9|2", "A-1|1|2|C1|2|9|2")));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.main).toBe("C1");
    expect(groups[0]!.skus.map((x) => x.offer)).toEqual(["A-1", "B-2"]);   // отсортировано
  });

  it("неполнота против объявленного размера видна, а не замолчана", () => {
    // OZON объявляет 5 вариантов, в каталоге лежат двое: остальные вне нашего снимка.
    const { short } = toGroups(parseCardsPsv(psv("A-1|1|2|C1|5|9|5", "B-2|2|2|C1|5|9|5")));
    expect(short).toHaveLength(1);
    expect(short[0]!.declared).toBe(5);
    expect(short[0]!.skus).toHaveLength(2);
  });

  it("разные карточки не склеиваются", () => {
    const { groups } = toGroups(parseCardsPsv(psv("A-1|1|2|C1|2|9|2", "A-2|2|2|C1|2|9|2", "B-1|3|2|C2|1|8|1")));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.main).toBe("C1");
  });
});

describe("поиск выгрузки", () => {
  it("папки нет - файла нет, и это не ошибка", () => {
    expect(latestCardsFile("нет-такой-папки")).toBeNull();
    expect(CABINET_DIR).toBe("tools/reakciya/data-cabinet");
  });
});
