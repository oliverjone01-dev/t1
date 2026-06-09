import { describe, it, expect, vi } from "vitest";
import { withRetry, HttpError, defaultRetryable } from "./retry.js";

const noSleep = async () => {};

describe("defaultRetryable", () => {
  it("ретраит 429 и 5xx, не ретраит 4xx", () => {
    expect(defaultRetryable(new HttpError(429, "rate"))).toBe(true);
    expect(defaultRetryable(new HttpError(503, "down"))).toBe(true);
    expect(defaultRetryable(new HttpError(403, "forbidden"))).toBe(false);
    expect(defaultRetryable(new HttpError(400, "bad"))).toBe(false);
  });
  it("ретраит сетевую ошибку без статуса", () => {
    expect(defaultRetryable(new Error("ECONNRESET"))).toBe(true);
  });
});

describe("withRetry", () => {
  it("возвращает результат без ретраев при успехе", async () => {
    const fn = vi.fn(async () => 42);
    expect(await withRetry(fn, { sleep: noSleep })).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("ретраит 429 и доходит до успеха", async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      if (++n < 3) throw new HttpError(429, "Too Many Requests");
      return "ok";
    });
    const onRetry = vi.fn();
    const res = await withRetry(fn, { sleep: noSleep, onRetry });
    expect(res).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("не ретраит 403 и пробрасывает сразу", async () => {
    const fn = vi.fn(async () => {
      throw new HttpError(403, "forbidden");
    });
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toThrow("forbidden");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("сдаётся после N ретраев и бросает последнюю ошибку", async () => {
    const fn = vi.fn(async () => {
      throw new HttpError(429, "rate");
    });
    await expect(withRetry(fn, { retries: 3, sleep: noSleep })).rejects.toThrow("rate");
    expect(fn).toHaveBeenCalledTimes(4); // 1 + 3 ретрая
  });

  it("backoff растёт экспоненциально (проверяем переданные задержки)", async () => {
    const delays: number[] = [];
    let n = 0;
    const fn = async () => {
      if (++n < 4) throw new HttpError(500, "x");
      return 1;
    };
    await withRetry(fn, {
      baseMs: 100,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });
    // базы 100, 200, 400 (плюс джиттер до 25%)
    expect(delays.length).toBe(3);
    expect(delays[0]).toBeGreaterThanOrEqual(100);
    expect(delays[0]).toBeLessThan(125);
    expect(delays[1]).toBeGreaterThanOrEqual(200);
    expect(delays[2]).toBeGreaterThanOrEqual(400);
  });
});
