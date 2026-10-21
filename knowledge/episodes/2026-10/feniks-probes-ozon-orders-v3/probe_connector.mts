// ФЕНИКС, аудит PR #492 (2026-10-20): проба fail-open коннектора списков отправлений на фикстурах.
// Живой API не вызывается: fetch подменён, ответы - возможные будущие смены контракта OZON.
// Гоняет НАСТОЯЩИЙ OzonSeller и moneyOf ветки (распакованы git archive в scratch).
//
// Запуск: npx tsx probe_connector.mts <путь к src/connector/ozon-seller.ts ветки>
import { pathToFileURL } from "node:url";

const modPath = process.argv[2];
if (!modPath) { console.error("usage: probe_connector.mts <ozon-seller.ts>"); process.exit(2); }
const { OzonSeller, moneyOf }: any = await import(pathToFileURL(modPath).href);

const ok = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
const post = (n: string, extra: any = {}) => ({ posting_number: n, status: "delivered", in_process_at: "2026-10-19T10:00:00Z",
  products: [{ sku: 1, offer_id: "A", quantity: 1, price: { amount: "100.00", currency: "RUB" } }], ...extra });
const page = (prefix: string, k: number) => Array.from({ length: k }, (_, i) => post(`${prefix}-${i}`));

async function run(name: string, want: string, responses: Array<(path: string) => any>, fn: (s: any) => Promise<any>) {
  let i = 0;
  (globalThis as any).fetch = async (url: string) => ok(200, responses[Math.min(i++, responses.length - 1)]!(String(url)));
  let got: string;
  try { got = "ok: " + JSON.stringify(await fn(new OzonSeller({ clientId: "x", apiKey: "y" }))); }
  catch (e: any) { got = "throw: " + String(e?.message ?? e).slice(0, 140); }
  console.log(`${name}\n   ожидание: ${want}\n   факт:     ${got}\n   вызовов fetch: ${i}`);
}

const summary = (out: any[]) => ({ n: out.length, fbo: out.filter((p) => p.src === "FBO").length, fbs: out.filter((p) => p.src === "FBS").length,
  dates: [...new Set(out.map((p) => p.date))], prices: [...new Set(out.flatMap((p) => p.products.map((x: any) => x.price)))] });

// 1. FBO: OZON переименовал ключ списка (postings -> items). Ожидание fail-closed: ошибка формы.
await run("P1 FBO: ключ списка items вместо postings", "throw (неизвестная форма ответа)",
  [(u) => u.includes("fbo") ? { items: page("fbo", 5), has_next: false } : { postings: page("fbs", 3), has_next: false },
   (u) => ({ postings: page("fbs", 3), has_next: false })],
  async (s) => summary(await s.postings("2026-02-06", "2026-10-19")));

// 2. FBS: has_next переименован (hasNext): первая страница из 100, курсор есть. Ожидание: ошибка или все страницы.
await run("P2 FBS: has_next -> hasNext, полная страница 100 + курсор", "throw или >100 (не молчаливое усечение)",
  [(u) => u.includes("fbo") ? { postings: [], has_next: false } : { postings: page("fbs", 100), hasNext: true, cursor: "c1" }],
  async (s) => summary(await s.postings("2026-02-06", "2026-10-19")));

// 3. Курсор не сдвинулся при has_next - заявленный fail-closed автора.
await run("P3 has_next=true, тот же курсор", "throw (без нового курсора)",
  [() => ({ postings: page("fbo", 100), has_next: true, cursor: "" })],
  async (s) => summary(await s.postings("2026-02-06", "2026-10-19")));

// 4. FBS v4 без in_process_at (и без created_at, как в v4): дата заказа молча становится датой отгрузки.
await run("P4 FBS без in_process_at/created_at, есть shipment_date", "throw или date=null (не подмена базы даты)",
  [(u) => u.includes("fbo") ? { postings: [], has_next: false }
     : { postings: [{ ...post("fbs-x"), in_process_at: undefined, shipment_date: "2026-10-22T08:00:00Z" }], has_next: false }],
  async (s) => summary(await s.postings("2026-10-19", "2026-10-19")));

// 5. moneyOf на правдоподобных формах денег: пропуск должен быть null (data-guard шаг 4), не 0.
const forms: Array<[string, unknown]> = [
  ["{amount:'99.9',currency}", { amount: "99.9", currency: "RUB" }],
  ["'15.5'", "15.5"], ["20", 20],
  ["{units:10,nanos:5e8} (google.type.Money)", { units: 10, nanos: 500000000 }],
  ["{amount:'1 234,50'} (запятая)", { amount: "1 234,50", currency: "RUB" }],
  ["{price:{amount:'5'}} (вложено)", { price: { amount: "5" } }],
  ["null (поле пропало)", null], ["undefined", undefined],
];
console.log("\nP5 moneyOf (ожидание для нечитаемого: null или ошибка, не 0):");
for (const [k, v] of forms) console.log(`   ${k} -> ${JSON.stringify(moneyOf(v))}`);
