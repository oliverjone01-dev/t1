import { describe, it, expect, vi, afterEach } from "vitest";
import { batchCampaigns, CAMPAIGN_BATCH, OzonPerformance } from "./ozon-performance.js";

afterEach(()=>vi.unstubAllGlobals());

describe("Performance report transport: Moscow calendar boundaries",()=>{
  it.each([
    ["2026-10-14","2026-10-20",7],
    ["2026-12-31","2027-01-01",2],
    ["2026-10-20","2026-10-20",1],
  ] as const)("%s..%s is exactly %i complete Moscow days",async(from,to,days)=>{
    const bodies:any[]=[];
    vi.stubGlobal("fetch",vi.fn(async(url:string,options:any)=>{
      if(url.endsWith("/token")) return new Response(JSON.stringify({access_token:"fixture",expires_in:1800}));
      bodies.push(JSON.parse(options.body));return new Response(JSON.stringify({UUID:"fixture-report"}));
    }));
    const client=new OzonPerformance({clientId:"fixture",clientSecret:"fixture"});
    expect(await client.requestStatistics(["1"],from,to,"DATE")).toBe("fixture-report");
    const body=bodies[0], start=Date.parse(body.from),end=Date.parse(body.to);
    expect(start).toBe(Date.parse(`${from}T00:00:00+03:00`));
    expect(end).toBe(Date.parse(`${to}T23:59:59+03:00`));
    expect((end-start+1000)/86400000).toBe(days);
    expect(Date.parse(`${from}T00:30:00+03:00`)).toBeGreaterThanOrEqual(start);
    expect(Date.parse(`${to}T23:30:00+03:00`)).toBeLessThanOrEqual(end);
    expect(body.groupBy).toBe("DATE");
  });
});

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
