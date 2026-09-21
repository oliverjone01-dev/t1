// Граница инкремента заказов. Проверяем ровно тот случай, из-за которого кабинет зеркал остался
// без истории: одна общая граница на файл закрывала бэкфилл кампании, которую завели позже.
import { describe, it, expect } from "vitest";
import { campaignHighWater, campaignFrom } from "./orders.js";

const FLOOR = "2026-02-01";

describe("граница сбора заказов считается по кампании, а не по файлу", () => {
  const rows = [
    { campaign: "мебель", created: "2026-02-01" },
    { campaign: "мебель", created: "2026-09-19" },
    { campaign: "зеркала", created: "2026-07-05" },
  ];
  const hw = campaignHighWater(rows);

  it("у каждой кампании своя верхняя граница", () => {
    expect(hw.get("мебель")).toBe("2026-09-19");
    expect(hw.get("зеркала")).toBe("2026-07-05");
  });

  it("кампания продолжает со следующего дня после собранного", () => {
    expect(campaignFrom(hw, "мебель", FLOOR)).toBe("2026-09-20");
    expect(campaignFrom(hw, "зеркала", FLOOR)).toBe("2026-07-06");
  });

  it("кампания без истории тянется с FLOOR, а не с завтра по чужой границе", () => {
    // Это и был баг: общая граница по файлу давала новой кампании «2026-09-20», и её история
    // не собиралась НИКОГДА - доставался только хвост перетяжки по дате обновления.
    expect(campaignFrom(hw, "новая", FLOOR)).toBe(FLOOR);
  });

  it("пустые campaign/created не создают ключей", () => {
    const h = campaignHighWater([{ campaign: "", created: "2026-05-01" }, { campaign: "x", created: "" }, {}]);
    expect(h.size).toBe(0);
  });
});
