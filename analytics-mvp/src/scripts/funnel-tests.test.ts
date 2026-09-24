// Контракт файла воронки. Ошибка здесь тихая вдвойне: битая строка либо молча выпадает,
// либо втекает в агрегат и сдвигает разницу тест минус контроль.
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseRow, readFunnelTests, missingDays, aggDay } from "./funnel-tests.js";

const ok = {
  date: "2026-09-22", art: "GGT-03-1-3-S-40", role: "test_ad",
  search_position: 12, search_views: 100, pdp_views: 9, hits_to_cart: 2, ordered_units: 1,
};
const agg = {
  date: "2026-09-22", role: "agg_median", test_id: "boost_plus_exit",
  search_position: 14, search_views: 80, pdp_views: 6, hits_to_cart: 0, ordered_units: 0,
  n: 46, n_nonzero: { search_position: 44, search_views: 46, pdp_views: 43, hits_to_cart: 14, ordered_units: 6 },
};

describe("разбор товарной строки", () => {
  it("принимает строку контракта как есть", () => {
    expect(parseRow(ok)).toEqual({ ...ok, test_id: "", n: null, n_nonzero: null });
  });

  it("позиция может быть null: товара нет в выдаче", () => {
    const r = parseRow({ ...ok, search_position: null });
    expect(typeof r === "string" ? r : r.search_position).toBeNull();
  });

  it("ноль позицией не бывает и читается как «нет в выдаче»", () => {
    const r = parseRow({ ...ok, search_position: 0 });
    expect(typeof r === "string" ? r : r.search_position).toBeNull();
  });

  it("чужая роль отвергается с объяснением, а не молча", () => {
    expect(parseRow({ ...ok, role: "median" })).toContain("не из");
    expect(parseRow({ ...ok, role: "panel" })).toContain("не из");
  });

  it("обе тестовые роли принимаются и различимы", () => {
    for (const role of ["test_ad", "test_sibling", "control"]) {
      const r = parseRow({ ...ok, role });
      expect(typeof r === "string" ? r : r.role).toBe(role);
    }
  });

  it("кривая дата и пустой артикул отвергаются", () => {
    expect(parseRow({ ...ok, date: "22.09.2026" })).toContain("не вида");
    expect(parseRow({ ...ok, art: "  " })).toContain("без артикула");
  });

  it("отрицательное количество отвергается: это не «ноль с минусом»", () => {
    expect(parseRow({ ...ok, hits_to_cart: -1 })).toContain("не неотрицательное число");
  });
});

describe("разбор агрегатной строки", () => {
  it("принимает обе агрегатные роли с n и n_nonzero", () => {
    for (const role of ["agg_median", "agg_sum"]) {
      const r = parseRow({ ...agg, role });
      expect(typeof r === "string" ? r : r.role).toBe(role);
      expect(typeof r === "string" ? 0 : r.n).toBe(46);
    }
  });

  it("агрегат без test_id не принимается: непонятно, к какому тесту он относится", () => {
    const { test_id, ...rest } = agg;
    expect(parseRow(rest)).toContain("без test_id");
  });

  it("агрегат с артикулом не принимается: он относится к группе, а не к товару", () => {
    expect(parseRow({ ...agg, art: "GGM-02-1-1" })).toContain("агрегат относится к группе");
  });

  it("агрегат без n_nonzero отвергается: ноль без плотности неотличим от настоящего нуля", () => {
    const { n_nonzero, ...rest } = agg;
    expect(parseRow(rest)).toContain("без n_nonzero");
  });

  it("n_nonzero числом раскладывается на все метрики", () => {
    const r = parseRow({ ...agg, n_nonzero: 40 });
    expect(typeof r === "string" ? null : r.n_nonzero?.hits_to_cart).toBe(40);
  });

  it("n_nonzero больше n это ошибка выгрузки, а не данные", () => {
    expect(parseRow({ ...agg, n_nonzero: 99 })).toContain("от 0 до n");
    expect(parseRow({ ...agg, n_nonzero: { hits_to_cart: 99 } })).toContain("от 0 до n");
  });

  it("n без положительного значения отвергается: делить на ноль нечем", () => {
    expect(parseRow({ ...agg, n: 0 })).toContain("не положительное число");
  });
});

describe("чтение файла", () => {
  const dir = mkdtempSync(join(tmpdir(), "ft-"));
  const path = join(dir, "funnel_tests.ndjson");
  writeFileSync(path, [
    JSON.stringify(ok),
    JSON.stringify({ ...ok, date: "2026-09-23" }),
    JSON.stringify({ ...ok, art: "GGM-02-1-1", role: "control" }),
    JSON.stringify(agg),
    JSON.stringify({ ...agg, role: "agg_sum", hits_to_cart: 31 }),
    "{не json",
    JSON.stringify({ ...ok, role: "выдумка" }),
  ].join("\n"));

  const read = readFunnelTests(path);

  it("раскладывает товары и агрегаты по разным полкам", () => {
    expect(read.byArt.size).toBe(2);
    expect(read.agg.get("boost_plus_exit")?.size).toBe(2);
    expect(aggDay(read, "boost_plus_exit", "agg_sum", "2026-09-22")?.hits_to_cart).toBe(31);
  });

  it("роль артикула запоминается: по ней страница берёт контрольную группу", () => {
    expect(read.roleOf.get("GGM-02-1-1")).toBe("control");
    expect(read.roleOf.get(ok.art)).toBe("test_ad");
  });

  it("битые строки названы с номером и причиной, а не выброшены молча", () => {
    expect(read.bad.map((b) => b.line)).toEqual([6, 7]);
    expect(read.bad[1]!.why).toContain("не из");
  });

  it("границы файла берутся из самих строк", () => {
    expect([read.first, read.last]).toEqual(["2026-09-22", "2026-09-23"]);
  });

  it("отсутствие файла это не ошибка, а пустое чтение", () => {
    expect(readFunnelTests(join(dir, "нет-такого.ndjson")).exists).toBe(false);
  });
});

describe("поиск пропавших дней", () => {
  const all = ["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23"];
  const days = (ds: string[]) => new Map(ds.map((d) => [d, 1]));

  it("день, который есть у других, а у этого нет, считается потерей", () => {
    expect(missingDays(days(["2026-09-20", "2026-09-22"]), all)).toEqual(["2026-09-21", "2026-09-23"]);
  });

  it("правая граница общая по файлу: хвостовая пропажа видна", () => {
    // Ровно случай 22.09: четыре товара выпали и не вернулись.
    expect(missingDays(days(["2026-09-20", "2026-09-21"]), all)).toEqual(["2026-09-22", "2026-09-23"]);
  });

  it("левая граница своя: товар, вошедший позже, не светится за прошлые дни", () => {
    expect(missingDays(days(["2026-09-22", "2026-09-23"]), all)).toEqual([]);
  });
});
