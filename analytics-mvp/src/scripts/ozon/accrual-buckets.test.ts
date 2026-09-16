import { describe, it, expect } from "vitest";
import { bucketOfType, bucketMap } from "./accrual-buckets.js";

describe("bucketOfType (типы начислений OZON -> бакеты)", () => {
  it("комиссия за продажу", () => {
    expect(bucketOfType("SaleCommission")).toBe("commission");
    expect(bucketOfType("Вознаграждение за продажу")).toBe("commission");
  });
  it("эквайринг", () => expect(bucketOfType("Acquiring")).toBe("acquiring"));
  it("хранение/склад", () => {
    expect(bucketOfType("Placements")).toBe("storage");
    expect(bucketOfType("Размещение товаров на складах Ozon")).toBe("storage");
    expect(bucketOfType("Replenishment")).toBe("storage");
  });
  it("логистика/доставка/возвраты", () => {
    expect(bucketOfType("Logistic")).toBe("delivery");
    expect(bucketOfType("LastMileCourier")).toBe("delivery");
    expect(bucketOfType("ReturnFlowLogistic")).toBe("delivery");
    expect(bucketOfType("PickUpPointReturnAcceptance")).toBe("delivery");
  });
  it("реклама/продвижение", () => {
    expect(bucketOfType("PayPerClick")).toBe("ads");
    expect(bucketOfType("Promotion")).toBe("ads");
    expect(bucketOfType("Stencil")).toBe("ads");
    expect(bucketOfType("PremiumCashbackPromotion")).toBe("ads");
  });
  it("доставка от покупателя (компенсируется) - отдельный бакет", () => {
    expect(bucketOfType("RfbsBuyerDelivery")).toBe("buyerDelivery");
    expect(bucketOfType("RfbsClientDeliveryCharge")).toBe("buyerDelivery");
  });
  it("прочее по умолчанию", () => {
    expect(bucketOfType("PremiumSubscription")).toBe("other");
    expect(bucketOfType("Marking")).toBe("other");
    expect(bucketOfType("нечто новое от OZON")).toBe("other");
  });
  it("bucketMap строит id -> bucket", () => {
    const m = bucketMap([{ id: 69, name: "SaleCommission" }, { id: 1, name: "Acquiring" }, { id: 32, name: "Logistic" }]);
    expect(m).toEqual({ 69: "commission", 1: "acquiring", 32: "delivery" });
  });
});
