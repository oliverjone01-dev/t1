// Проба (г) iter2: сценарии на фикстурах, код головы 299cc0c (planBlock), данные - копия data/ + оверлей в scratch.
// Запуск (из дерева головы, чтобы tsx нашёл зависимости):
//   cd <scratch>/head/analytics-mvp && npx tsx <этот файл> <head_tree> <data_dir> <scratch_dir>
// Каждый сценарий пишет <scratch>/scen2_<name>/sec.html (html блока) - его пересчитывает p_b_orders_independent_iter2.py.
// ФЕНИКС 2026-10-20, аудит PR #490 iter2. Реальные данные не меняются.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const [HEAD, DATA, SCR] = process.argv.slice(2);
const M = await import(join(HEAD!, "src/scripts/plan-tab.ts"));
const { planBlock, ordWindow, daysIn } = M;

const nd = (f: string): any[] => readFileSync(join(DATA!, f), "utf-8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
const ORD = nd("orders_daily.ndjson"), PR = nd("prices_daily.ndjson");
const toNd = (rows: any[]) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
const dec = (x: string) => x.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function deltaCell(raw: string): string {
  if (raw.trim() === "-") return "-";
  if (raw.startsWith('<span class="muted"')) {
    const v = raw.match(/<span[^>]*>(.*?)<\/span>/s)![1]!; const n = (raw.match(/<div class="muted s">(.*?)<\/div>/s) ?? [])[1] ?? "";
    return `СЕРЫЙ ${v} «${dec(n)}»`;
  }
  const col = (raw.match(/color:([^"]+)"/) ?? [])[1] ?? "?";
  return `${col === "#34D399" ? "ЗЕЛЁНЫЙ" : col === "#FF7A7E" ? "КРАСНЫЙ" : col} ${raw.replace(/<[^>]+>/g, "")}`;
}

function run(name: string, today: string, overlay: Record<string, any[]>, arts: string[]) {
  const dir = join(SCR!, "scen2_" + name); mkdirSync(dir, { recursive: true });
  for (const [f, rows] of Object.entries(overlay)) writeFileSync(join(dir, f), toNd(rows));
  const dp = (f: string) => existsSync(join(dir, f)) ? join(dir, f) : join(DATA!, f);
  const b = planBlock(today, dp);
  const s: string = b.html;
  writeFileSync(join(dir, "sec.html"), s);
  const i = s.indexOf('<summary class="sec">5. Цена');
  const j = s.indexOf("<table", i), k = s.indexOf("</table>", j);
  const t = s.slice(j, k);
  const th = [...t.matchAll(/<th([^>]*)>(.*?)<\/th>/gs)].map((m) => ({ title: (m[1]!.match(/title="([^"]*)"/) ?? [])[1] ?? "", text: m[2]!.replace(/<[^>]+>/g, "").trim() }));
  const clean = (x: string) => x.replace(/<div class="muted s">/g, " ~").replace(/<br>/g, " | ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const rows = [...t.slice(t.indexOf("<tbody>")).matchAll(/<tr>(.*?)<\/tr>/gs)].map((m) => [...m[1]!.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((c) => c[1]!));
  console.log(`\n=== ${name} (today ${today})`);
  for (const h of th.filter((h) => /С 15\.10|Δ/.test(h.text))) console.log(`  th «${h.text}» title «${dec(h.title)}»`);
  for (const r of rows) {
    const a = clean(r[1]!).split(" ~")[0]!.trim();
    if (arts.includes(a)) console.log(`  ${a} | смены ${clean(r[3]!)} | з01-14 ${clean(r[7]!)} | с15 ${clean(r[8]!)} | Δ ${deltaCell(r[9]!)}`);
  }
  const sl = (s.slice(k, k + 1500).match(/<\/table><\/div><div class="muted s">(.*?)<\/div>/s) ?? [])[1];
  console.log(`  строка под таблицей: «${sl ?? "НЕТ"}»`);
  const st = { gray: 0, green: 0, red: 0, other: 0, dash: 0 };
  for (const r of rows) { const d = deltaCell(r[9]!); if (d === "-") st.dash++; else if (d.startsWith("СЕРЫЙ")) st.gray++; else if (d.startsWith("ЗЕЛЁНЫЙ")) st.green++; else if (d.startsWith("КРАСНЫЙ")) st.red++; else st.other++; }
  console.log(`  ячейки Δ: ${JSON.stringify(st)} из ${rows.length}`);
  const b1 = s.slice(s.indexOf("<th>Карточка</th>"));
  const kon = [...b1.matchAll(/<tr class="crow"[^>]*>(.*?)<\/tr>/gs)].map((m) => [...m[1]!.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((c) => clean(c[1]!))).find((r) => r[0]!.includes("KONUX"));
  if (kon) console.log(`  блок 1 KONUX: С 15.10 = ${kon[2]}, 01-14.10 = ${kon[5]}`);
  const od = (s.match(/заказы по ([0-9.]+)/) ?? [])[1]; console.log(`  шапка блока: заказы по ${od}`);
}

const K = "GGT-35-5-1-100-180";
const kSku = ORD.find((o) => o.offer === K)!.sku;
const skuOf = (a: string) => ORD.find((o) => o.offer === a)?.sku ?? "0";
const mkOrd = (art: string, from: string, to: string, offer = art, tag = "FX"): any[] => {
  const out: any[] = [];
  for (let d = new Date(from + "T00:00:00Z"); d <= new Date(to + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    out.push({ order: `${tag}-${art}-${ds}`, d: ds, t: ds + "T09:00:00.000000Z", status: "delivered", scheme: "FBO", sku: art === K ? kSku : skuOf(art), offer, units: 1, revenue: 50000 });
  }
  return out;
};

// S0 контроль
run("S0_control", "2026-10-20", {}, [K, "GGT-03-3-3-E-16080", "GGM-02-2-1", "GGT-46-3-3-100", "GGM-01-1"]);
// S1 окно длиннее 14 дней: +1 заказ K в день 19.10..05.11, today 06.11
const extra = mkOrd(K, "2026-10-19", "2026-11-05");
run("S1_orders_to_0511", "2026-11-06", { "orders_daily.ndjson": [...ORD, ...extra] }, [K]);
console.log(`  ожидание: окно 15-28.10, 14 дн; K = 7 + 10 = 17 шт; Δ = 17/14*7 - 8/14*7 = +4,5; KONUX блока 1 = 14 + 10 = 24 >= 17`);
const upTo = (last: string) => extra.filter((o) => o.d <= last);
run("S1b_orders_to_2810", "2026-10-29", { "orders_daily.ndjson": [...ORD, ...upTo("2026-10-28")] }, [K]);
run("S1c_orders_to_2910", "2026-10-30", { "orders_daily.ndjson": [...ORD, ...upTo("2026-10-29")] }, [K]);
// S4 окно 0 дней
run("S4_no_window", "2026-10-14", { "orders_daily.ndjson": ORD.filter((o) => o.d <= "2026-10-13") }, [K, "GGM-18-2-2", "GGT-48-2-2-100-180"]);
// S5 окно 1 день
run("S5_window_1d", "2026-10-16", { "orders_daily.ndjson": ORD.filter((o) => o.d <= "2026-10-15") }, [K, "GGM-18-2-2", "GGT-35-1-3-100-180"]);
// S6 переименование offer K с 15.10, окно 4 дня
run("S6_rename_4d", "2026-10-20", { "orders_daily.ndjson": ORD.map((o) => o.offer === K && o.d >= "2026-10-15" ? { ...o, offer: K + "-R" } : o) }, [K]);
// S6b переименование при окне 11 дней: заказы K с 15.10 и новые 19-25.10 под новым offer (тот же SKU)
run("S6b_rename_11d", "2026-10-26", { "orders_daily.ndjson": [...ORD.map((o) => o.offer === K && o.d >= "2026-10-15" ? { ...o, offer: K + "-R" } : o), ...mkOrd(K, "2026-10-19", "2026-10-25", K + "-R")] }, [K]);
// S7 окно 11 дней (заказы по 25.10): K +7 (смена 15.10); GGT-35-2-3 без смен +4 (n=6); GGM-02-2-1 смена 19.10 +2 (n=6); GGM-01-1 без смен (n=1)
const s7 = [...mkOrd(K, "2026-10-19", "2026-10-25"), ...mkOrd("GGT-35-2-3-100-180", "2026-10-19", "2026-10-22"), ...mkOrd("GGM-02-2-1", "2026-10-20", "2026-10-21")];
run("S7_window_11d", "2026-10-26", { "orders_daily.ndjson": [...ORD, ...s7] }, [K, "GGT-35-2-3-100-180", "GGM-02-2-1", "GGM-01-1", "GGM-18-2-2", "GGT-35-1-3-100-180", "GGT-03-3-3-E-16080"]);
// S7b граница порога дней: заказы по 20.10 (6 дн) и по 21.10 (7 дн), K +1 в день с 19.10
run("S7b_6d", "2026-10-21", { "orders_daily.ndjson": [...ORD, ...mkOrd(K, "2026-10-19", "2026-10-20")] }, [K]);
run("S7c_7d", "2026-10-22", { "orders_daily.ndjson": [...ORD, ...mkOrd(K, "2026-10-19", "2026-10-21")] }, [K]);
// S8 смена цены в конце окна: GGT-35-2-3 без смен до 26.10, 27.10 -> 110 000; заказы по 28.10; +1 заказ в день 19-26.10 (до смены)
const A8 = "GGT-35-2-3-100-180";
const pr8 = [...PR];
for (let d = 21; d <= 28; d++) pr8.push({ d: `2026-10-${d}`, offer: A8, price: d >= 27 ? 110000 : 121898 });
run("S8_late_change_2710", "2026-10-29", { "orders_daily.ndjson": [...ORD, ...mkOrd(A8, "2026-10-19", "2026-10-26"), ...mkOrd(K, "2026-10-19", "2026-10-28")], "prices_daily.ndjson": pr8 }, [A8, K]);
console.log(`  ${A8}: 8 из 8 добавленных заказов окна - до смены 27.10; в окне 15-28.10 по новой цене 2 дня из 14`);
// S9 окно плана длиннее 14 дней (если план поменяют): ordWindow и daysIn напрямую
console.log(`\n=== S9 ordWindow при окне плана 15.10-04.11 и заказах по 05.11: ${JSON.stringify(ordWindow("2026-10-15", "2026-11-04", "2026-11-05"))}; дней в окне по календарю 21; daysIn(15.10, 04.11) = ${daysIn("2026-10-15", "2026-11-04")}`);
