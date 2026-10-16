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

  it("артикулы прежней карты, которых нет в API, остаются в своей карточке, даже если её нет в API; API важнее прежней карты", () => {
    const prev: MapFile = { generated_note: "", source: "cabinet", imported_at: "2026-09-23",
      groups: [{ model: "", main: "1000", declared: 3, skus: [{ sku: "01", offer: "A0-1" }, { sku: "99", offer: "OLD" }] },
               { model: "", main: "7777", declared: 2, skus: [{ sku: "02", offer: "A0-2" }, { sku: "98", offer: "GONE" }] }] };
    const { map, stats } = buildCardMap(many(20), prev, "d");
    const g = map!.groups.find((x) => x.main === "1000")!;
    expect(g.skus.map((s) => s.offer)).toEqual(["A0-1", "A0-2", "OLD"]);
    // A0-2 по API в 1000 (moved), карточка 7777 в API пропала - в ней остаётся один GONE, одиночка в карту не идёт
    expect(map!.groups.some((x) => x.main === "7777")).toBe(false);
    expect(stats).toMatchObject({ carried: 2, moved: 1, added: 38 });
    const prev2: MapFile = { ...prev, groups: [...prev.groups, { model: "", main: "8888", declared: 2, skus: [{ sku: "1", offer: "X1" }, { sku: "2", offer: "X2" }] }] };
    expect(buildCardMap(many(20), prev2, "d").map!.groups.find((x) => x.main === "8888")!.skus.map((s) => s.offer)).toEqual(["X1", "X2"]);
  });

  it("fail-closed: обрезанный ответ не добирается прежней картой (Codex P1) и меньше 90 % запрошенных - не пишем", () => {
    const prev = buildCardMap(many(30), null, "2026-09-23").map!;
    const cut = buildCardMap(many(1), prev, "2026-10-16");
    expect(cut.map).toBeNull(); expect(cut.why).toMatch(/карточек в ответе API 1/);
    const few = buildCardMap(many(20), null, "d", 60);
    expect(few.map).toBeNull(); expect(few.why).toMatch(/40 товаров из 60/);
    expect(buildCardMap(many(20), null, "d", 44).map).not.toBeNull();
  });

  it("fail-closed: пустой SKU, «0» или один SKU у двух артикулов - карту не пишем (ФЕНИКС G2)", () => {
    expect(buildCardMap([...many(20), it_("Z-1", 5, ""), it_("Z-2", 5, "77")], null, "d").why).toMatch(/Z-1: пустой SKU/);
    expect(buildCardMap([...many(20), it_("Z-1", 5, "0"), it_("Z-2", 5, "77")], null, "d").map).toBeNull();
    expect(buildCardMap([...many(20), it_("Z-1", 5, "01"), it_("Z-2", 5, "77")], null, "d").why).toMatch(/SKU 01 у A0-1 и Z-1/);
  });
});
