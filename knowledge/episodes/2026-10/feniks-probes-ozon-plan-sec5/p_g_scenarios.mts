// Проба (г): сценарии второго порядка на фикстурах, код головы 49a7bf3 (planBlock), данные - копия data/ + оверлей.
// Запуск (из дерева головы, чтобы tsx нашёл зависимости):
//   cd <scratch>/head/analytics-mvp && npx tsx <этот файл> <head_tree> <data_dir> <scratch_dir>
// ФЕНИКС 2026-10-20, аудит PR #490. Реальные данные не меняются: оверлей пишется в scratch.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const [HEAD, DATA, SCR] = process.argv.slice(2);
const { planBlock } = await import(join(HEAD!, "src/scripts/plan-tab.ts"));

const nd = (f: string): any[] => readFileSync(join(DATA!, f), "utf-8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
const ORD = nd("orders_daily.ndjson"), PR = nd("prices_daily.ndjson");
const toNd = (rows: any[]) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";

function run(name: string, today: string, overlay: Record<string, any[]>, arts: string[]) {
  const dir = join(SCR!, "scen_" + name); mkdirSync(dir, { recursive: true });
  for (const [f, rows] of Object.entries(overlay)) writeFileSync(join(dir, f), toNd(rows));
  const dp = (f: string) => existsSync(join(dir, f)) ? join(dir, f) : join(DATA!, f);
  const b = planBlock(today, dp);
  const s: string = b.html;
  const i = s.indexOf('<summary class="sec">5. Цена');
  const t = s.slice(s.indexOf("<table", i), s.indexOf("</table>", s.indexOf("<table", i)));
  const th = [...t.matchAll(/<th([^>]*)>(.*?)<\/th>/gs)].map((m) => ({ title: (m[1]!.match(/title="([^"]*)"/) ?? [])[1] ?? "", text: m[2]!.replace(/<[^>]+>/g, "").trim() }));
  const clean = (x: string) => x.replace(/<div class="muted s">/g, " ~").replace(/<br>/g, " | ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const rows = [...t.slice(t.indexOf("<tbody>")).matchAll(/<tr>(.*?)<\/tr>/gs)].map((m) => [...m[1]!.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((c) => clean(c[1]!)));
  console.log(`\n=== ${name} (today ${today})`);
  for (const h of th.filter((h) => /С 15\.10|Смены|Заказы/.test(h.text))) console.log(`  th «${h.text}» title «${h.title}»`);
  for (const r of rows) if (arts.includes(r[1]!.split(" ~")[0]!.trim())) console.log(`  ${r[1]!.split(" ~")[0]} | 14.10 ${r[2]} | смены ${r[3]} | сейчас ${r[4]} | статус ${r[6]} | з01-14 ${r[7]} | с15 ${r[8]} | Δ ${r[9]}`);
  // карточка KONUX в блоке 1 - для сравнения (инвариант (в), переименование)
  const b1 = s.slice(s.indexOf("<th>Карточка</th>")); const kon = [...b1.matchAll(/<tr class="crow"[^>]*>(.*?)<\/tr>/gs)].map((m) => [...m[1]!.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((c) => clean(c[1]!))).find((r) => r[0]!.includes("KONUX"));
  if (kon) console.log(`  блок 1 KONUX: С 15.10 = ${kon[2]}, 01-14.10 = ${kon[5]}`);
  const od = (s.match(/заказы по ([0-9.]+)/) ?? [])[1]; console.log(`  шапка блока: заказы по ${od}`);
}

const K = "GGT-35-5-1-100-180";
const kSku = ORD.find((o) => o.offer === K)!.sku;
// S0 контроль: оверлея нет, today 20.10
run("S0_control", "2026-10-20", {}, [K, "GGT-03-3-3-E-16080", "GGM-02-2-1", "GGT-46-3-3-100"]);
// S1 окно длиннее 14 дней: +1 заказ K в день 19.10..05.11, today 06.11 (OD_LAST 05.11 -> nIn режется до 14)
const extra: any[] = [];
for (let d = new Date("2026-10-19T00:00:00Z"); d <= new Date("2026-11-05T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
  const ds = d.toISOString().slice(0, 10);
  extra.push({ order: "FX-" + ds, d: ds, t: ds + "T09:00:00.000000Z", status: "delivered", scheme: "FBO", sku: kSku, offer: K, units: 1, revenue: 50000 });
}
run("S1_window_over_14d", "2026-11-06", { "orders_daily.ndjson": [...ORD, ...extra] }, [K]);
console.log(`  ожидание: с15 = 7 + ${extra.length} = ${7 + extra.length} шт за 22 дня (15.10-05.11); верный темп ${((7 + extra.length) / 22 * 7).toFixed(2)} шт/нед, Δ ${((7 + extra.length) / 22 * 7 - 4).toFixed(1)}; `
  + `по окну плана 15-28.10: ${7 + 10} шт / 14 дн -> Δ ${((17) / 14 * 7 - 4).toFixed(1)}; код делит на nIn = 14`);
// S1b граница: OD_LAST ровно 28.10 (14 дней) - ошибки ещё нет; 29.10 - уже есть
const upTo = (last: string) => extra.filter((o) => o.d <= last);
run("S1b_OD_LAST_28_10", "2026-10-29", { "orders_daily.ndjson": [...ORD, ...upTo("2026-10-28")] }, [K]);
run("S1c_OD_LAST_29_10", "2026-10-30", { "orders_daily.ndjson": [...ORD, ...upTo("2026-10-29")] }, [K]);
// S2 два снимка в один день (строки одного дня, порядок в файле решает): GGT-46-2-2-100, 19.10
const A = "GGT-46-2-2-100";
const i19 = PR.findIndex((r) => r.offer === A && r.d === "2026-10-19");
const dipFirst = [...PR.slice(0, i19), { d: "2026-10-19", offer: A, price: 90000 }, ...PR.slice(i19)];        // 90 000 раньше, 94 900 позже в файле
const dipLast = [...PR.slice(0, i19 + 1), { d: "2026-10-19", offer: A, price: 90000 }, ...PR.slice(i19 + 1)];  // 94 900 раньше, 90 000 позже
run("S2a_two_snapshots_dip_first", "2026-10-20", { "prices_daily.ndjson": dipFirst }, [A]);
run("S2b_two_snapshots_dip_last", "2026-10-20", { "prices_daily.ndjson": dipLast }, [A]);
// S3 день без снимка между сменами: убрать снимок 16.10 у GGT-03-3-3-E-16080 и 17.10 у GGT-46-3-3-100
const gap = PR.filter((r) => !((r.offer === "GGT-03-3-3-E-16080" && r.d === "2026-10-16") || (r.offer === "GGT-46-3-3-100" && r.d === "2026-10-17")));
run("S3_missing_snapshot", "2026-10-20", { "prices_daily.ndjson": gap }, ["GGT-03-3-3-E-16080", "GGT-46-3-3-100"]);
// S4 окно с 15.10 длиной 0: выгрузка заказов кончается 13.10
run("S4_no_window_OD_LAST_lt_start", "2026-10-14", { "orders_daily.ndjson": ORD.filter((o) => o.d <= "2026-10-13") }, [K, "GGM-18-2-2", "GGT-48-2-2-100-180"]);
// S5 окно 1 день: выгрузка кончается 15.10
run("S5_window_1d", "2026-10-16", { "orders_daily.ndjson": ORD.filter((o) => o.d <= "2026-10-15") }, [K, "GGM-18-2-2", "GGT-35-1-3-100-180", "GGL-09-2"]);
// S6 переименование артикула плана: строки K с 15.10 получают новый offer (тот же SKU)
run("S6_rename_offer", "2026-10-20", { "orders_daily.ndjson": ORD.map((o) => o.offer === K && o.d >= "2026-10-15" ? { ...o, offer: K + "-R" } : o) }, [K]);
