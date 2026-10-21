// ФЕНИКС, аудит PR #492 iter2 (2026-10-20): fail-closed списков отправлений после a95fd4b.
// fetch подменён, живой API не вызывается. Гоняет НАСТОЯЩИЙ OzonSeller ветки.
// P1/P2 - дрейф контракта (ожидание: ошибка); V1-V4 - законные ответы (ожидание: без ошибки);
// R1 - зависимость от того, что OZON всегда присылает has_next булевым (ожидание: ошибка, это и есть риск).
// P4/P5 - остаток iter1, в iter2 не чинился (следующий PR).
//
// Запуск: npx tsx iter2-probe_connector.mts <путь к src/connector/ozon-seller.ts ветки>
import { pathToFileURL } from "node:url";

const modPath = process.argv[2];
if (!modPath) { console.error("usage: iter2-probe_connector.mts <ozon-seller.ts>"); process.exit(2); }
const { OzonSeller, moneyOf }: any = await import(pathToFileURL(modPath).href);
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
const post = (n: string, extra: any = {}) => ({ posting_number: n, status: "delivered", in_process_at: "2026-10-19T10:00:00Z",
  products: [{ sku: 1, offer_id: "A", quantity: 1, price: { amount: "100.00", currency: "RUB" } }], ...extra });
const page = (prefix: string, k: number) => Array.from({ length: k }, (_, i) => post(`${prefix}-${i}`));

async function run(id: string, want: "throw" | "ok", fbo: any[], fbs: any[]) {
  let i = 0, j = 0;
  (globalThis as any).fetch = async (url: string) => ok(String(url).includes("fbo") ? fbo[Math.min(i++, fbo.length - 1)] : fbs[Math.min(j++, fbs.length - 1)]);
  let got: string;
  try { const out = await new OzonSeller({ clientId: "x", apiKey: "y" }).postings("2026-02-06", "2026-10-19");
    got = `ok n=${out.length} fbo=${out.filter((p: any) => p.src === "FBO").length} fbs=${out.filter((p: any) => p.src === "FBS").length} dates=${[...new Set(out.map((p: any) => p.date))].join(",")}`; }
  catch (e: any) { got = "throw: " + String(e?.message ?? e).slice(0, 150); }
  const pass = (want === "throw") === got.startsWith("throw");
  console.log(`${pass ? "OK  " : "MISS"} ${id}: ожидание ${want} | ${got}`);
}

const end = { postings: [], has_next: false, cursor: "" };
await run("P1 FBO ключ items вместо postings", "throw", [{ items: page("fbo", 5), has_next: false }], [end]);
await run("P2 FBS hasNext вместо has_next, полная страница", "throw", [end], [{ postings: page("fbs", 100), hasNext: true, cursor: "c1" }]);
await run("P3 has_next=true, курсор не сдвинулся", "throw", [{ postings: page("fbo", 100), has_next: true, cursor: "" }], [end]);
await run("V1 ответ в обёртке result", "ok", [{ result: { postings: page("fbo", 2), has_next: false } }], [{ result: { postings: page("fbs", 3), has_next: false } }]);
await run("V2 пустое окно FBO: postings [], has_next false", "ok", [end], [{ postings: page("fbs", 1), has_next: false, cursor: "" }]);
await run("V3 две страницы FBS по курсору", "ok", [end], [{ postings: page("fbs", 100), has_next: true, cursor: "c1" }, { postings: page("fbs2", 7), has_next: false, cursor: "" }]);
await run("V4 has_next=true и пустая страница", "ok", [end], [{ postings: page("fbs", 3), has_next: true, cursor: "c1" }, { postings: [], has_next: true, cursor: "c2" }]);
await run("R1 последняя страница без has_next (proto3 опускает false)", "throw", [{ postings: page("fbo", 34), cursor: "" }], [end]);
await run("P4 FBS без in_process_at: дата из shipment_date (остаток iter1)", "throw", [end],
  [{ postings: [{ ...post("fbs-x"), in_process_at: undefined, shipment_date: "2026-10-22T08:00:00Z" }], has_next: false }]);

console.log("\nP5 moneyOf (остаток iter1, ожидание для нечитаемого: null или ошибка):");
for (const [k, v] of [["{units,nanos}", { units: 10, nanos: 5e8 }], ["{amount:'1 234,50'}", { amount: "1 234,50" }], ["null", null]] as Array<[string, unknown]>)
  console.log(`   ${k} -> ${JSON.stringify(moneyOf(v))}`);
