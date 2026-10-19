// ФЕНИКС iter4. Приёмка T4: на фикстуре plan-tab.test.ts (fixture() без extra, сегодня 17.10) факт спидометра рекламы = 3000
// (клик главного кампании 5; 400 ₽ кампании 77 из 11 «на минимум» и 99 999 ₽ CPO не входят; минимальный клик - нет строк).
// Рекламные данные, план и card_groups - дословно из fixture() plan-tab.test.ts da0a36b; воронка и заказы урезаны (на рекламу не влияют).
// Вывод: ads_month {from 15.10, to 15.10, pre false, fact 3000, plan 3071}. npx tsx t4_fact.mts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const SP = "/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/";
const { planBlock, PLAN_FILE } = await import(SP + "tree_da0a36b/analytics-mvp/src/scripts/plan-tab.ts");
const OCT = { mid: 355, lo: 300, hi: 429 };
const dir = mkdtempSync(join(tmpdir(), "fx-t4-"));
const nd = (f: string, rows: unknown[]) => writeFileSync(join(dir, f), rows.map((r) => JSON.stringify(r)).join("\n"));
const tri = { mid: 1, lo: 1, hi: 1 };
writeFileSync(join(dir, PLAN_FILE), JSON.stringify({
  start: "2026-10-15", check: "2026-10-29", window: ["2026-10-15", "2026-10-28"], min_budget_sku: 1500, min_campaign_budget: 2000,
  cards: [{ main_art: "A-1", short: "АЛЬФА", name: "", u_wk_base: 2, click_new: 20000, n_min: 1, threshold: 6, threshold_price: null, min_arts: ["A-2"] }],
  to_min: [{ cid: "77", art: "Z-1" }], price: [{ art: "A-1", name: "", when: "15.10", price_new: 900, step: "-10%" }],
  goal: { units: { oct: OCT, nov: OCT }, turn_mln: { oct: tri, nov: tri }, pay_mln: { oct: tri, nov: tri }, nov_rollback: { units: 1, pay_mln: 1 } },
}));
writeFileSync(join(dir, "card_groups.json"), JSON.stringify({ groups: [{ main: "1", skus: [{ sku: "1", offer: "A-1" }, { sku: "2", offer: "A-2" }] }] }));
nd("sku_views.ndjson", [{ date: "2026-10-15", sku: "1", views: 100, vsearch: 50, pdp: 10, cart: 2, units: 1 }]);
nd("orders_daily.ndjson", [{ d: "2026-10-15", status: "delivered", sku: "1", units: 2, revenue: 1000 }, { d: "2026-10-16", status: "delivered", sku: "9", units: 4, revenue: 100 }]);
nd("ads_sku_daily.ndjson", [
  { d: "2026-10-15", cid: "5", sku: "1", sp: 3000 }, { d: "2026-10-15", cid: "77", sku: "8", sp: 2500 },
  { d: "2026-10-15", cid: "28753239", sku: "1", sp: 99999 }, { d: "2026-10-15", cid: "77", sku: "1", sp: 400 },
  { d: "2026-10-16", cid: "77", sku: "8", sp: 2600 },
]);
nd("ads_daily.ndjson", [{ d: "2026-10-15", id: "5", sp: 3000, cl: 40 }, { d: "2026-10-15", id: "77", sp: 2500, cl: 10 },
  { d: "2026-10-16", id: "5", sp: 1000, cl: 10 }, { d: "2026-10-16", id: "77", sp: 2600, cl: 10 }]);
writeFileSync(join(dir, "ads_sku_state.json"), JSON.stringify({ "5": "2026-10-16", "77": "2026-10-17" }));
nd("prices_daily.ndjson", [{ d: "2026-10-16", offer: "A-1", price: 1000 }]);
nd("gap_daily.ndjson", [{ date: "2026-10-16", art: "A-1", gap_pct: 5 }]);
nd("funnel_tests.ndjson", []);
const b = planBlock("2026-10-17", (f: string) => join(dir, f))!;
const D = JSON.parse(b.js.slice("window.PD=".length, b.js.indexOf(";\n")));
console.log("ads_month", JSON.stringify(D.ads_month));
