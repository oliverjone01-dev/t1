// Повторы методов начислений видны в логе (ФЕНИКС #485 rework 1): путь, попытка, пауза.
import { describe, it, expect, vi, afterEach } from "vitest";
import { OzonSeller } from "./ozon-seller.js";

const resp = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as any;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OzonSeller: лог повторов", () => {
  it("accrual/types: два 429, затем успех - два warn с путём, попыткой из 8 и паузой", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(resp(429, { message: "rate limit per second" }))
      .mockResolvedValueOnce(resp(429, { message: "rate limit per second" }))
      .mockResolvedValueOnce(resp(200, { accrual_types: [{ id: 1, name: "a", description: "" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = new OzonSeller({ clientId: "x", apiKey: "y" } as any).accrualTypes();
    await vi.runAllTimersAsync();
    expect(await p).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toMatch(/^OZON \/v1\/finance\/accrual\/types: HTTP 429, повтор 1\/8 через \d+\.\d с$/);
    expect(warn.mock.calls[1][0]).toMatch(/повтор 2\/8/);
  });

  it("4xx кроме 429 не повторяется и не пишет warn", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(400, { message: "bad" })));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(new OzonSeller({ clientId: "x", apiKey: "y" } as any).accrualTypes()).rejects.toThrow(/HTTP 400/);
    expect(warn).not.toHaveBeenCalled();
  });
});
