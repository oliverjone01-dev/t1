// Юнит-тесты чистой логики портов OZON (без сети). Покрывают замечания FENIX G5:
// операции с >1 товаром выкидываются, sku "0"/пустой пропускается, округление в конце,
// классификация рекламы, дробление окна дат на <=60 дней.
import { describe, it, expect } from "vitest";
import { aggregateBySku } from "./pnl-sku.js";
import { aggregateChannel } from "./pnl.js";
import { adLineOf, instrOf, plOf, statusOf, dateWindows } from "./ads.js";

describe("aggregateBySku (pnl-sku)", () => {
  it("суммирует только операции с одним товаром, пропускает multi и sku=0", () => {
    const ops = [
      { items: [{ sku: "100" }], accruals_for_sale: 1000.4, sale_commission: -200.6, amount: 700.5 },
      { items: [{ sku: "100" }], accruals_for_sale: 500.1, sale_commission: -100.1, amount: 350.2 },
      { items: [{ sku: "200" }, { sku: "201" }], accruals_for_sale: 999, sale_commission: -50, amount: 800 }, // multi -> skip
      { items: [{ sku: "0" }], accruals_for_sale: 123, sale_commission: -10, amount: 90 }, // sku 0 -> skip
      { items: [], amount: 5 }, // empty -> skip
      { items: [{ sku: "300" }], accruals_for_sale: 2000, sale_commission: -400, amount: 1500 },
    ];
    const r = aggregateBySku(ops);
    expect(r.singleItemOps).toBe(4); // 100,100,0,300 (single-item ops, до фильтра sku=0)
    expect(r.multiItemOps).toBe(1);
    expect(r.skuCount).toBe(2); // 100 и 300 (0 отфильтрован)
    expect(r.bySku["100"]).toEqual({ accruals: 1501, commission: -301, amount: 1051, ops: 2 }); // округление в конце
    expect(r.bySku["300"]).toEqual({ accruals: 2000, commission: -400, amount: 1500, ops: 1 });
    expect(r.bySku["0"]).toBeUndefined();
    expect(r.bySku["200"]).toBeUndefined();
  });
});

describe("aggregateChannel (pnl)", () => {
  it("агрегирует канал: fees=accruals-amount, услуги по статьям, логистика", () => {
    const ops = [
      { accruals_for_sale: 1000, sale_commission: -200, amount: 700, delivery_charge: -30, return_delivery_charge: -10, services: [{ name: "Эквайринг", price: -15 }, { name: "Логистика", price: -20 }] },
      { accruals_for_sale: 500, sale_commission: -100, amount: 350, services: [{ name: "Эквайринг", price: -5 }] },
    ];
    const r = aggregateChannel(ops);
    expect(r.ops).toBe(2);
    expect(r.accruals).toBe(1500);
    expect(r.commission).toBe(-300);
    expect(r.delivery).toBe(-40); // -30 + -10
    expect(r.payout).toBe(1050); // 700 + 350
    expect(r.fees).toBe(450); // 1500 - 1050
    expect(r.services).toEqual({ "Эквайринг": -20, "Логистика": -20 });
  });
});

describe("ads классификаторы", () => {
  it("adLineOf по артикулу кампании", () => {
    expect(adLineOf("GGT-03-3")).toBe("столы");
    expect(adLineOf("GGM-18")).toBe("зеркала/металл");
    expect(adLineOf("GGL-09")).toBe("свет");
    expect(adLineOf("TRUBIS Wood")).toBe("TRUBIS");
    expect(adLineOf("REF_VK кампания")).toBe("внешний трафик");
    expect(adLineOf("что-то")).toBe("прочее");
  });
  it("instrOf по типу оплаты/объекта", () => {
    expect(instrOf("SKU", "CPC")).toBe("Оплата за клик");
    expect(instrOf("ALL_SKU_PROMO", "CPO")).toBe("Оплата за заказ");
    expect(instrOf("SEARCH_PROMO", "")).toBe("Продвижение в поиске");
    expect(instrOf("SKU", "")).toBe("Трафареты");
  });
  it("plOf маппит площадки, statusOf - состояние", () => {
    expect(plOf(["PLACEMENT_TOP_PROMOTION", "PLACEMENT_PDP"])).toBe("Топ выдачи, Карточка товара");
    expect(plOf([])).toBe("-");
    expect(statusOf("CAMPAIGN_STATE_RUNNING")).toBe("активна");
    expect(statusOf("CAMPAIGN_STATE_STOPPED")).toBe("закрыта");
  });
});

describe("dateWindows (дробление окна)", () => {
  it("одно окно если <=60 дней", () => {
    expect(dateWindows("2026-05-20", "2026-06-18")).toEqual([["2026-05-20", "2026-06-18"]]);
  });
  it("режет 90 дней на куски <=60 без пропусков и нахлёстов", () => {
    const w = dateWindows("2026-03-12", "2026-06-09", 60);
    expect(w.length).toBe(2);
    expect(w[0]![0]).toBe("2026-03-12");
    expect(w[1]![1]).toBe("2026-06-09");
    // следующий кусок начинается на следующий день после конца предыдущего
    const prevEnd = new Date(w[0]![1] + "T00:00Z"); prevEnd.setUTCDate(prevEnd.getUTCDate() + 1);
    expect(w[1]![0]).toBe(prevEnd.toISOString().slice(0, 10));
  });
});
