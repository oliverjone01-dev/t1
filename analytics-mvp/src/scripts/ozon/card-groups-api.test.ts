import { describe, it, expect } from "vitest";
import { buildCardMap, type MapFile } from "./card-groups-api.js";

const it_ = (offer: string, model: number | null, sku = "1", count = 0) =>
  ({ offer_id: offer, sku, model_info: model == null ? undefined : { model_id: model, count } });
const many = (n: number) => Array.from({ length: n }, (_, k) => [it_(`A${k}-1`, 1000 + k, `${k}1`, 3), it_(`A${k}-2`, 1000 + k, `${k}2`, 3)]).flat();

describe("карта карточек из Seller API", () => {
  it("группирует по model_id, одиночки не идут в карту, declared = count OZON", () => {
    const { map, stats } = buildCardMap([...many(20), it_("SOLO", 9)], null, "2026-10-16");
    expect(map?.groups).toHaveLength(20);
    expect(map?.groups[0]).toEqual({ model: "карточка 1000", main: "1000", declared: 3, skus: [{ sku: "01", offer: "A0-1" }, { sku: "02", offer: "A0-2" }] });
    expect(map?.imported_at).toBe("2026-10-16");
    expect(map?.source).toBe("seller-api-model_info");
    expect(stats.added).toBe(40);
  });

  it("fail-closed: меньше 90 % с model_id - карту не пишем", () => {
    const items = [...many(20), ...Array.from({ length: 5 }, (_, k) => it_(`N${k}`, null))];
    const { map, why } = buildCardMap(items, null, "2026-10-16");
    expect(map).toBeNull(); expect(why).toMatch(/model_id прочитан у 40 из 45/);
  });

  it("fail-closed: меньше 20 карточек и пустой ответ - карту не пишем", () => {
    expect(buildCardMap(many(19), null, "d").map).toBeNull();
    expect(buildCardMap([], null, "d").why).toMatch(/ни одного товара/);
  });

  it("артикул прежней карты, которого нет в API, остаётся в своей карточке; сменившие карточку считаются", () => {
    const prev: MapFile = { generated_note: "", source: "cabinet", imported_at: "2026-09-23",
      groups: [{ model: "", main: "1000", declared: 3, skus: [{ sku: "01", offer: "A0-1" }, { sku: "99", offer: "OLD" }] },
               { model: "", main: "7777", declared: 2, skus: [{ sku: "02", offer: "A0-2" }, { sku: "98", offer: "GONE" }] }] };
    const { map, stats } = buildCardMap(many(20), prev, "d");
    const g = map!.groups.find((x) => x.main === "1000")!;
    expect(g.skus.map((s) => s.offer)).toEqual(["A0-1", "A0-2", "OLD"]);
    expect(map!.groups.some((x) => x.main === "7777")).toBe(false);   // карточки нет в API - GONE не тащим
    expect(stats).toMatchObject({ carried: 1, moved: 1, added: 38 });
  });
});
