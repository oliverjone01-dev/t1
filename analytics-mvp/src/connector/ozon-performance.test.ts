import { describe, it, expect } from "vitest";
import { batchCampaigns, CAMPAIGN_BATCH } from "./ozon-performance.js";

describe("batchCampaigns - батч по 25 (DOC_02 §3.2)", () => {
  it("режет ровно по 25", () => {
    const ids = Array.from({ length: 60 }, (_, i) => String(i));
    const batches = batchCampaigns(ids);
    expect(batches.length).toBe(3);
    expect(batches[0]!.length).toBe(25);
    expect(batches[1]!.length).toBe(25);
    expect(batches[2]!.length).toBe(10);
  });
  it("CAMPAIGN_BATCH = 25", () => {
    expect(CAMPAIGN_BATCH).toBe(25);
  });
  it("пустой вход - пустой выход", () => {
    expect(batchCampaigns([])).toEqual([]);
  });
});
