// ФЕНИКС #485 iter2, пробы O1-O6: реальный OzonSeller @6426b50, подменены только fetch, setTimeout
// (пауза записывается, ждать не нужно) и console.warn (строки собираются).
// Запуск: cd /home/user/t1/analytics-mvp && npx tsx ../knowledge/episodes/2026-10/feniks-probes-ozon-accrual-retry-iter2/probe-onretry.mts
import { OzonSeller } from "../../../../analytics-mvp/src/connector/ozon-seller.ts";

type R = { status: number; body?: unknown; badJson?: boolean; netErr?: boolean };
const KEY = "SECRET-KEY-PROBE-7f3a";
const delays: number[] = [];
(globalThis as any).setTimeout = (fn: (...a: any[]) => void, ms?: number) => {
  delays.push(ms ?? 0);
  fn();
  return 0 as any;
};
let warns: string[] = [];
console.warn = (...a: any[]) => {
  warns.push(a.map(String).join(" "));
};

function script(seq: R[]) {
  let i = 0;
  (globalThis as any).fetch = async () => {
    const r = i < seq.length ? seq[i++] : seq[seq.length - 1];
    if (r.netErr) throw new TypeError("fetch failed");
    return {
      ok: r.status < 400,
      status: r.status,
      json: async () => {
        if (r.badJson) throw new SyntaxError("Unexpected token < in JSON");
        return r.body;
      },
      text: async () => JSON.stringify(r.body ?? {}),
    };
  };
}
const s = () => new OzonSeller({ clientId: "probe", apiKey: KEY } as any);
const T429: R = { status: 429, body: { message: "rate limit per second" } };
const OKT: R = { status: 200, body: { accrual_types: [{ id: 1, name: "a", description: "" }] } };

async function run(id: string, desc: string, f: () => Promise<unknown>) {
  warns = [];
  delays.length = 0;
  let res = "ok";
  try {
    await f();
  } catch (e: any) {
    res = "throw " + String(e?.message ?? e).slice(0, 70);
  }
  const total = delays.reduce((a, b) => a + b, 0);
  console.log(
    JSON.stringify({
      id, desc, result: res, warns: warns.length,
      first: warns[0] ?? null, last: warns[warns.length - 1] ?? null,
      sleeps: delays.length, total_s: +(total / 1000).toFixed(1),
      key_leak: warns.some((w) => w.includes(KEY)),
    }),
  );
}

async function main() {
  await run("O1", "accrualTypes: 429 x8, затем 200", async () => { script([...Array(8).fill(T429), OKT]); await s().accrualTypes(); });
  await run("O2", "accrualByDay: 429 навсегда", async () => { script([T429]); await s().accrualByDay("2026-10-15"); });
  await run("O3", "прочий метод (post без retry): 429 x2, затем 200", async () => { script([T429, T429, { status: 200, body: {} }]); await (s() as any).post("/v1/probe/default", {}); });
  await run("O4", "сеть: fetch отклонён 1 раз", async () => { script([{ status: 0, netErr: true }, OKT]); await s().accrualTypes(); });
  await run("O5", "200 с битым JSON 1 раз", async () => { script([{ status: 200, badJson: true }, OKT]); await s().accrualTypes(); });
  await run("O6", "прочий метод: 429 навсегда", async () => { script([T429]); await (s() as any).post("/v1/probe/default", {}); });
}
main();
