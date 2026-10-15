import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { goalPath, cardStatus, spendStatus, weekSum, daysIn, drange, planBlock, PLAN_FILE } from "./plan-tab.js";

const OCT = { mid: 355, lo: 300, hi: 429 };

describe("goalPath", () => {
  it("до 17.10 цель идёт по базе («плохо») ровно по дням", () => {
    expect(goalPath(OCT, 16, "mid")).toBeCloseTo(300 / 31 * 16);
    expect(goalPath(OCT, 16, "hi")).toBeCloseTo(goalPath(OCT, 16, "lo"));
  });
  it("31.10 сходится к цели месяца в каждом сценарии", () => {
    for (const sc of ["lo", "mid", "hi"] as const) expect(goalPath(OCT, 31, sc)).toBeCloseTo(OCT[sc]);
  });
  it("коридор не перекрещивается", () => {
    for (let d = 1; d <= 31; d++) expect(goalPath(OCT, d, "lo")).toBeLessThanOrEqual(goalPath(OCT, d, "hi"));
  });
});

describe("cardStatus", () => {
  it("нет заказов в данных - «нет данных», а не «отстаём»", () => expect(cardStatus(null, 31, 5)).toBe("нет данных"));
  it("первые 2 дня - «рано»", () => expect(cardStatus(0, 31, 2)).toBe("рано"));
  it("сравнение с путём порог × дни / 14", () => {
    expect(cardStatus(7, 14, 7)).toBe("идём");
    expect(cardStatus(6, 14, 7)).toBe("отстаём");
  });
});

describe("spendStatus - расход: меньше значит лучше (Иван 15.10)", () => {
  it("ноль и недотрата - в плане", () => { expect(spendStatus(0)).toBe("в плане"); expect(spendStatus(40)).toBe("в плане"); });
  it("пороги 100 и 120", () => {
    expect(spendStatus(100)).toBe("в плане"); expect(spendStatus(110)).toBe("выше плана"); expect(spendStatus(121)).toBe("перерасход");
  });
  it("нет данных - не ноль", () => expect(spendStatus(null)).toBe("нет данных"));
});

describe("weekSum / daysIn", () => {
  const m = new Map([["2026-10-15", 100], ["2026-10-16", 50]]);
  it("неделя после последнего дня источника - null, а не ноль", () => expect(weekSum(m, "2026-10-22", "2026-10-28", "2026-10-16")).toBeNull());
  it("неполная неделя обрезается последним днём и знает число дней", () => expect(weekSum(m, "2026-10-15", "2026-10-21", "2026-10-16")).toEqual([150, 2]));
  it("день без строки внутри окна - ноль (расхода не было)", () => expect(weekSum(m, "2026-10-15", "2026-10-21", "2026-10-17")).toEqual([150, 3]));
  it("daysIn ограничен 0..14", () => {
    expect(daysIn("2026-10-15", "")).toBe(0); expect(daysIn("2026-10-15", "2026-10-15")).toBe(1); expect(daysIn("2026-10-15", "2026-11-30")).toBe(14);
  });
  it("drange включает оба конца", () => expect(drange("2026-10-30", "2026-11-01")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]));
});

// ---------- сборка на маленьком наборе данных
function fixture(extra: Record<string, unknown[]> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "plan-"));
  const nd = (f: string, rows: unknown[]) => writeFileSync(join(dir, f), rows.map((r) => JSON.stringify(r)).join("\n"));
  const tri = { mid: 1, lo: 1, hi: 1 };
  writeFileSync(join(dir, PLAN_FILE), JSON.stringify({
    start: "2026-10-15", check: "2026-10-29", window: ["2026-10-15", "2026-10-28"], min_budget_sku: 1500, min_campaign_budget: 2000,
    cards: [{ main_art: "A-1", short: "АЛЬФА", name: "", u_wk_base: 2, click_new: 20000, n_min: 1, threshold: 6, threshold_price: null, min_arts: ["A-2"] }],
    to_min: [{ cid: "77", art: "Z-1" }],
    price: [{ art: "A-1", name: "", when: "15.10", price_new: 900, step: "-10%" }],
    goal: { units: { oct: OCT, nov: OCT }, turn_mln: { oct: tri, nov: tri }, pay_mln: { oct: tri, nov: tri }, nov_rollback: { units: 1, pay_mln: 1 } },
  }));
  writeFileSync(join(dir, "card_groups.json"), JSON.stringify({ groups: [{ main: "1", skus: [{ sku: "1", offer: "A-1" }, { sku: "2", offer: "A-2" }] }] }));
  nd("sku_views.ndjson", [
    { date: "2026-10-15", sku: "1", views: 100, vsearch: 50, pdp: 10, cart: 2, units: 1 },
    { date: "2026-10-15", sku: "9", views: 900, vsearch: 500, pdp: 90, cart: 8, units: 3 },
  ]);
  nd("orders_daily.ndjson", extra.orders ?? [
    { d: "2026-10-15", status: "delivered", sku: "1", units: 2, revenue: 1000 },
    { d: "2026-10-15", status: "cancelled", sku: "2", units: 5, revenue: 5000 },
    { d: "2026-10-16", status: "awaiting_deliver", sku: "2", units: 1, revenue: 900 },
    { d: "2026-10-16", status: "delivered", sku: "9", units: 4, revenue: 100 },
  ]);
  nd("ads_sku_daily.ndjson", [
    { d: "2026-10-15", cid: "5", sku: "1", sp: 3000 }, { d: "2026-10-15", cid: "77", sku: "8", sp: 2500 },
    { d: "2026-10-15", cid: "28753239", sku: "1", sp: 99999 },
  ]);
  nd("ads_daily.ndjson", [{ d: "2026-10-15", id: "5", cl: 40 }]);
  nd("prices_daily.ndjson", [{ d: "2026-10-16", offer: "A-1", price: 1000 }]);
  nd("gap_daily.ndjson", [{ date: "2026-10-16", art: "A-1", gap_pct: 5 }]);
  nd("funnel_tests.ndjson", []);
  return (f: string) => join(dir, f);
}
const pd = (js: string) => JSON.parse(js.slice("window.PD=".length, js.indexOf(";\n")));

describe("planBlock", () => {
  it("нет файла плана - блока нет, страница собирается без него", () => {
    const dir = mkdtempSync(join(tmpdir(), "plan-none-"));
    expect(planBlock("2026-10-16", (f) => join(dir, f))).toBeNull();
  });
  it("заказы карточки - все её товары без отмен; магазин - все товары", () => {
    const b = planBlock("2026-10-17", fixture())!;
    const D = pd(b.js); const j = D.days.indexOf("2026-10-15"), k = D.days.indexOf("2026-10-16");
    expect(D.ser[0].orders[j]).toBe(2);           // отмена 5 шт не считается
    expect(D.ser[0].orders[k]).toBe(1);           // второй товар карточки идёт в карточку
    expect(D.store.orders[k]).toBe(5);
    expect(D.ser[0].orders[k + 1]).toBeNull();    // после последнего дня источника - пропуск, не ноль
  });
  it("расход: «Оплата за заказ» не клик; главный и кампания на минимум считаются отдельно", () => {
    const D = pd(planBlock("2026-10-17", fixture())!.js);
    const main = D.spend[0].rows[0].w[1], camp = D.spend[2].rows[0].w[1];
    expect(main).toEqual([3000, 1]);
    expect(camp).toEqual([2500, 1]);
  });
  it("цена не снижена и выпал из бустинга - видно в статусах", () => {
    const D = pd(planBlock("2026-10-17", fixture())!.js);
    expect(D.price_st["не снижена"]).toBe(1);
    expect(D.price_st.eb).toBe(1);
  });
  it("на корректных данных предупреждений инварианта нет", () => {
    expect(planBlock("2026-10-17", fixture())!.warnings).toEqual([]);
  });
  it("в данных страницы нет «</script>»", () => {
    expect(planBlock("2026-10-17", fixture())!.js.includes("</script")).toBe(false);
  });
});
