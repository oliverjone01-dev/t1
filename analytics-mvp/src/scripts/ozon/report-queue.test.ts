import { describe, it, expect, vi } from "vitest";
import { reportCsv, type QueueState } from "./report-queue.js";

function fixture() {
  let state: QueueState = { ready: {} }, now = 0;
  const store = { read: () => structuredClone(state), write: (s: QueueState) => { state = structuredClone(s); } };
  const time = { now: () => now, sleep: async (ms: number) => { now += ms; } };
  const perf = { requestStatistics: vi.fn(async () => "uuid1"), statisticsState: vi.fn(async () => ({ state: "RUNNING" })), downloadStatistics: vi.fn(async (uuid: string) => `csv:${uuid}`) };
  const call = (deadline: number, cid = "1") => reportCsv(perf, cid, "2026-10-16", "2026-10-22", deadline, store, time);
  return { store, time, perf, call };
}
describe("Performance: один активный отчёт, возобновляемый после дедлайна", () => {
  it("истёкший бюджет не создаёт новый отчёт", async () => {
    const f = fixture(); await expect(f.call(0)).rejects.toThrow("дедлайна");
    expect(f.perf.requestStatistics).not.toHaveBeenCalled();
  });
  it("тайм-аут сохраняет UUID, следующий прогон продолжает его без нового POST", async () => {
    const f = fixture(); await expect(f.call(10_000)).rejects.toThrow("UUID сохранён");
    expect(f.store.read().active?.uuid).toBe("uuid1");
    f.perf.statisticsState.mockResolvedValue({ state: "OK" });
    expect(await f.call(20_000)).toBe("csv:uuid1");
    expect(f.perf.requestStatistics).toHaveBeenCalledTimes(1);
    expect(f.store.read()).toEqual({ ready: {} });
  });
  it("другой сборщик сначала освобождает активный слот, сохраняя готовый UUID владельцу", async () => {
    const f = fixture(); await expect(f.call(10_000, "2")).rejects.toThrow();
    f.perf.statisticsState.mockResolvedValue({ state: "DONE" });
    f.perf.requestStatistics.mockResolvedValue("uuid2");
    expect(await f.call(20_000, "1")).toBe("csv:uuid2");
    expect(await f.call(20_000, "2")).toBe("csv:uuid1");
    expect(f.perf.requestStatistics).toHaveBeenCalledTimes(2);
  });
  it("ожидание дольше 60 опросов допустимо внутри общего бюджета", async () => {
    const f = fixture(); let n = 0;
    f.perf.statisticsState.mockImplementation(async () => ({ state: ++n > 65 ? "READY" : "RUNNING" }));
    expect(await f.call(400_000)).toBe("csv:uuid1");
    expect(f.perf.statisticsState).toHaveBeenCalledTimes(66);
  });
  it("429 старого незарегистрированного отчёта повторяется, 401 не маскируется", async () => {
    const f = fixture(); f.perf.requestStatistics.mockRejectedValueOnce(new Error("HTTP 429: active limit"));
    f.perf.statisticsState.mockResolvedValue({ state: "OK" });
    expect(await f.call(20_000)).toBe("csv:uuid1");
    const g = fixture(); g.perf.requestStatistics.mockRejectedValue(new Error("HTTP 401"));
    await expect(g.call(20_000)).rejects.toThrow("401"); expect(g.perf.requestStatistics).toHaveBeenCalledTimes(1);
  });
  it("ошибка скачивания оставляет готовый UUID для следующей попытки", async () => {
    const f = fixture(); f.perf.statisticsState.mockResolvedValue({ state: "OK" });
    f.perf.downloadStatistics.mockRejectedValueOnce(new Error("HTTP 503"));
    await expect(f.call(20_000)).rejects.toThrow("503");
    expect(await f.call(20_000)).toBe("csv:uuid1");
    expect(f.perf.requestStatistics).toHaveBeenCalledTimes(1);
  });
  it("истёкший UUID не запирает очередь навсегда", async () => {
    const f = fixture(); await expect(f.call(10_000)).rejects.toThrow();
    f.perf.statisticsState.mockRejectedValueOnce(new Error("HTTP 404"));
    f.perf.statisticsState.mockResolvedValue({ state: "OK" });
    f.perf.requestStatistics.mockResolvedValue("renewed");
    expect(await f.call(20_000)).toBe("csv:renewed");
    expect(f.perf.requestStatistics).toHaveBeenCalledTimes(2);
  });
});
