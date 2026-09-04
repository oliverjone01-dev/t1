// Локальный dry-run конвейера Маркета на СИНТЕТИКЕ (без сети, без ключа): генерирует orders.ndjson
// и catalog.json в отдельный каталог (YM_DATA_DIR обязателен и != data-ym), чтобы прогнать
// derive -> join -> build -> smoke и убедиться, что параметризованная сборка живёт с данными Маркета.
// Артикулы берём из fixtures/cogs_prod_sku.csv (реальные артикулы GG, синтетические заказы).
// Никогда не пишет в data-ym/: синтетика в отчёты не попадает (CLAUDE.md §14: fixtures - только референс).
import { readFileSync, mkdirSync } from "node:fs";
import { parseCogsSku } from "../../cogs.js";
import { parseOrder } from "../../connector/ym-partner.js";
import { normalizeOrder } from "./derive-lib.js";
import { writeNdjson, writeJson, yp, YM_DIR } from "./common.js";

if (!process.env.YM_DATA_DIR || /(^|\/)data-ym\/?$/.test(process.env.YM_DATA_DIR)) { console.error("dryrun: задай YM_DATA_DIR на scratch-каталог (не data-ym)"); process.exit(2); }
mkdirSync(YM_DIR, { recursive: true });

let seed = 20260904;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pad = (n: number) => String(n).padStart(2, "0");

const arts = parseCogsSku(readFileSync("fixtures/cogs_prod_sku.csv", "utf-8")).filter((r) => r.offer).slice(0, 40);
const items: Record<string, any> = {};
for (const a of arts) items[a.offer] = { name: `GENGLASS ${a.model}`, marketSku: String(100000000 + Math.floor(rnd() * 9e7)), category: "Мебель", price: Math.round(a.cost * (2.2 + rnd())), basicPrice: null, stock: rnd() < 0.15 ? 0 : Math.floor(rnd() * 20), business: rnd() < 0.5 ? "1023124" : "74986385", campaigns: ["21000001"], seen: new Date().toISOString() };
writeJson(yp("catalog.json"), { platform: "ym", generated_at: new Date().toISOString(), items }, 0);

const orders: any[] = [];
const today = new Date();
let id = 700000;
for (let day = new Date(Date.UTC(2026, 1, 6)); day < today; day.setUTCDate(day.getUTCDate() + 1)) {
  const n = Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) {
    const a = arts[Math.floor(rnd() * arts.length)]!;
    const price = items[a.offer].price;
    const cnt = rnd() < 0.85 ? 1 : 2;
    const ageDays = Math.round((today.getTime() - day.getTime()) / 864e5);
    const r = rnd();
    const status = ageDays < 3 ? "PROCESSING" : ageDays < 7 ? "DELIVERY" : r < 0.08 ? "CANCELLED_IN_PROCESSING" : r < 0.12 ? "PARTIALLY_RETURNED" : "DELIVERED";
    const cd = `${pad(day.getUTCDate())}-${pad(day.getUTCMonth() + 1)}-${day.getUTCFullYear()}`;
    const sd = new Date(day); sd.setUTCDate(sd.getUTCDate() + (status === "DELIVERED" || status === "PARTIALLY_RETURNED" ? 4 : 1));
    const sds = `${pad(sd.getUTCDate())}-${pad(sd.getUTCMonth() + 1)}-${sd.getUTCFullYear()}`;
    const mp = rnd() < 0.3 ? Math.round(price * 0.05) : 0;
    const fee = Math.round(price * cnt * 0.13), del = 350 * cnt;
    const actual = status === "DELIVERED" || status === "PARTIALLY_RETURNED";
    orders.push({
      id: id++, creationDate: cd, statusUpdateDate: sds, status, paymentType: "PREPAID", fake: false,
      items: [{ offerName: items[a.offer].name, marketSku: Number(items[a.offer].marketSku), shopSku: a.offer, count: cnt, initialCount: cnt,
        prices: [{ type: "BUYER", costPerItem: price - mp, total: (price - mp) * cnt }, ...(mp ? [{ type: "MARKETPLACE", costPerItem: mp, total: mp * cnt }] : [])],
        details: status === "PARTIALLY_RETURNED" ? [{ itemStatus: "RETURNED", itemCount: 1, updateDate: sds }] : [] }],
      commissions: [{ type: "FEE", actual: actual ? fee : null, predicted: fee }, { type: "AGENCY", actual: actual ? Math.round(price * cnt * 0.012) : null, predicted: Math.round(price * cnt * 0.012) }, { type: "DELIVERY_TO_CUSTOMER", actual: actual ? del : null, predicted: del }],
      payments: actual ? [{ id: `p${id}`, date: sds, type: "PAYMENT", source: "PAYMENT", total: price * cnt - fee - del }] : [],
    });
  }
}
const rows = orders.flatMap((o) => normalizeOrder(parseOrder(o), "21000001", "1023124"));
writeNdjson(yp("orders.ndjson"), rows);
console.log(`dryrun: синтетика -> ${YM_DIR}: заказов ${orders.length}, строк ${rows.length}, артикулов ${arts.length}. В data-ym НЕ пишет.`);
