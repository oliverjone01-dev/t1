// Один активный DATE-отчёт Performance на кабинет. UUID переживает дедлайн и смену сборщика.
import { existsSync, readFileSync } from "node:fs";
import { atomicText } from "./collector-integrity.js";

type Pending = { uuid: string; cid: string; from: string; to: string };
export type QueueState = { active?: Pending; ready: Record<string, Pending> };
export interface QueueStore { read(): QueueState; write(state: QueueState): void }
type Perf = { requestStatistics(ids: string[], from: string, to: string, group: string): Promise<string>;
  statisticsState(uuid: string): Promise<any>; downloadStatistics(uuid: string): Promise<string> };
const FILE = "data/ads_report_queue.json";
const disk: QueueStore = {
  read: () => {
    const s: QueueState = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : { ready: {} };
    if (!s.ready || typeof s.ready !== "object" || Array.isArray(s.ready)) throw new Error("Некорректная очередь отчётов");
    for (const p of [...Object.values(s.ready), ...(s.active ? [s.active] : [])]) {
      if (!p.uuid || !/^\d+$/.test(p.cid) || !/^\d{4}-\d{2}-\d{2}$/.test(p.from) || !/^\d{4}-\d{2}-\d{2}$/.test(p.to) || p.from > p.to) throw new Error("Некорректный UUID/диапазон очереди");
    }
    return s;
  },
  write: s => atomicText(FILE, JSON.stringify(s) + "\n"),
};
const key = (p: { cid: string; from: string; to: string }) => `${p.cid}|${p.from}|${p.to}`;
const gone = (e: unknown) => [404, 410].includes((e as { status?: number }).status ?? 0) || /\bHTTP\s+(404|410)\b/.test(String((e as Error).message));
const clock = { now: () => Date.now(), sleep: (ms: number) => new Promise<void>(r => setTimeout(r, ms)) };

export async function reportCsv(perf: Perf, cid: string, from: string, to: string, deadline: number,
  store: QueueStore = disk, time = clock): Promise<string> {
  const wanted = key({ cid, from, to });
  while (time.now() < deadline) {
    const s = store.read(), ready = s.ready[wanted];
    if (ready) {
      try {
        const csv = await perf.downloadStatistics(ready.uuid);
        delete s.ready[wanted]; store.write(s);
        return csv;
      } catch (e) {
        if (!gone(e)) throw e;
        delete s.ready[wanted]; store.write(s); continue;
      }
    }
    if (!s.active) {
      if (time.now() >= deadline) break;
      try {
        const uuid = await perf.requestStatistics([cid], from, to, "DATE");
        if (!uuid) throw new Error("Отчёт без UUID");
        s.active = { uuid, cid, from, to }; store.write(s);
      } catch (e) {
        // Старый отчёт, созданный до появления очереди, тоже может занимать слот.
        if ((e as { status?: number }).status !== 429 && !/\bHTTP\s+429\b/.test(String((e as Error).message))) throw e;
        await time.sleep(Math.min(5000, Math.max(0, deadline - time.now())));
        continue;
      }
    }
    if (time.now() >= deadline) break;
    const active = s.active!;
    let state: string;
    try { state = String((await perf.statisticsState(active.uuid)).state ?? ""); }
    catch (e) {
      if (!gone(e)) throw e;
      delete s.active; store.write(s); continue;
    }
    if (/\b(error|fail|failed|failure)\b/i.test(state)) {
      delete s.active; store.write(s);
      if (key(active) === wanted) throw new Error(`Отчёт ${cid}: ${state}`);
      continue;
    }
    if (/\b(ok|done|success|ready)\b/i.test(state)) {
      s.ready[key(active)] = active; delete s.active; store.write(s);
      continue;
    }
    await time.sleep(Math.min(5000, Math.max(0, deadline - time.now())));
  }
  throw new Error(`Отчёт ${cid} не завершён до дедлайна; UUID сохранён для продолжения`);
}
