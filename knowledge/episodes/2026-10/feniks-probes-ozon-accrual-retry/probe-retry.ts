// ФЕНИКС live-проба PR #485: реальный код OzonSeller.post -> withRetry(ACCRUAL_RETRY) -> pause, подменены только fetch и setTimeout.
// setTimeout вызывается сразу (0 мс), но запрошенная пауза записывается: так видно реальную политику без ожидания минут.
import { OzonSeller } from "/home/user/t1-wt/analytics-mvp/src/connector/ozon-seller.ts";

const origST = globalThis.setTimeout;
let delays: number[] = [];
let calls: string[] = [];
(globalThis as any).setTimeout = (fn: any, ms?: number, ...a: any[]) => { delays.push(ms ?? 0); return origST(fn, 0, ...a); };

type Plan = (n: number, path: string, body: any) => { status: number; json?: any };
function mockFetch(plan: Plan) {
  let n = 0;
  (globalThis as any).fetch = async (url: string, init: any) => {
    const path = String(url).replace("https://api-seller.ozon.ru", "");
    const body = JSON.parse(init?.body ?? "{}");
    calls.push(path + (body.date ? `#${body.date}${body.last_id ? "/" + body.last_id : ""}` : body.posting_numbers ? `#n=${body.posting_numbers.length}` : ""));
    const r = plan(n++, path, body);
    return { ok: r.status < 400, status: r.status, text: async () => `mock ${r.status}`, json: async () => r.json ?? {} } as any;
  };
}
const reset = () => { delays = []; calls = []; };
const s = new OzonSeller({ clientId: "x", apiKey: "y" } as any);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const out: Record<string, any> = {};

async function run() {
  // a) 450 постингов, всё 200: 3 пачки, паузы 300 только между пачками
  reset(); mockFetch(() => ({ status: 200, json: { posting_accruals: [] } }));
  await s.accrualPostings(Array.from({ length: 450 }, (_, i) => "p" + i));
  out.a_batches = { calls, delays };

  // b) 429 x8, потом 200: успех на 9-й попытке, 8 пауз бэкоффа
  reset(); mockFetch((n) => (n < 8 ? { status: 429 } : { status: 200, json: { posting_accruals: [] } }));
  await s.accrualPostings(["p1"]);
  out.b_429x8_ok = { attempts: calls.length, delays, total_s: sum(delays) / 1000 };

  // c) 429 навсегда: бросает после 9 попыток (fail-closed на вызов)
  reset(); mockFetch(() => ({ status: 429 }));
  try { await s.accrualPostings(["p1"]); out.c_429_forever = "NO THROW (FAIL)"; } catch (e: any) { out.c_429_forever = { threw: e?.name, status: e?.status, attempts: calls.length, total_s: sum(delays) / 1000 }; }

  // d) 4xx кроме 429 - без повторов; 5xx - с повторами
  for (const st of [400, 401, 403, 404, 409]) {
    reset(); mockFetch(() => ({ status: st }));
    try { await s.accrualPostings(["p1"]); out["d_" + st] = "NO THROW"; } catch (e: any) { out["d_" + st] = { status: e?.status, attempts: calls.length, delays: delays.length }; }
  }
  reset(); mockFetch((n) => (n < 2 ? { status: 503 } : { status: 200, json: { posting_accruals: [] } }));
  await s.accrualPostings(["p1"]); out.d_503 = { attempts: calls.length, delays };

  // e) прочие методы (post без retry) - прежняя политика 5/1000/30000
  reset(); mockFetch(() => ({ status: 429 }));
  try { await (s as any).post("/v1/other", {}); } catch (e: any) { out.e_default_post = { attempts: calls.length, delays, total_s: sum(delays) / 1000 }; }

  // f) by-day: 2 дня, у первого 2 страницы - пауза 300 только между страницами одного дня, между днями нет
  reset(); mockFetch((_n, _p, b) => (b.date === "2026-10-01" && !b.last_id ? { status: 200, json: { accruals: [{ a: 1 }], last_id: "L1" } } : { status: 200, json: { accruals: [{ a: 2 }], last_id: "" } }));
  await s.accrualByDay("2026-10-01"); await s.accrualByDay("2026-10-02");
  out.f_byday = { calls, delays };

  // g) цикл acq/pnlacc при вечном 429 на by-day: try { accrualByDay } catch { continue } - сколько «стоит» один день
  reset(); mockFetch(() => ({ status: 429 }));
  let skipped = 0; const perDay: number[] = [];
  for (const day of ["2026-10-01", "2026-10-02", "2026-10-03"]) {
    const before = sum(delays);
    try { await s.accrualByDay(day); } catch { skipped++; perDay.push((sum(delays) - before) / 1000); continue; }
  }
  out.g_byday_forever = { skipped, per_day_wait_s: perDay, attempts: calls.length };

  // h) распределение суммарной паузы ACCRUAL_RETRY при исчерпании (Монте-Карло 2000 прогонов на коде)
  const tot: number[] = [];
  for (let i = 0; i < 2000; i++) { reset(); mockFetch(() => ({ status: 429 })); try { await s.accrualTypes(); } catch { /* */ } tot.push(sum(delays) / 1000); }
  tot.sort((x, y) => x - y);
  out.h_exhaust_s = { min: tot[0], p50: tot[1000], max: tot[1999], max_single_delay_ms: Math.max(...delays) };
  console.log(JSON.stringify(out, null, 1));
}
run().catch((e) => { console.error("PROBE ERROR", e); process.exit(2); });
