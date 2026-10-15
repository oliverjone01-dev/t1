// ФЕНИКС, PR #477 @ 889c35b. Пробы R2 (регресс на живых данных) и P1-P6 (фикстуры двух съёмов в день).
// База - 628695b (merge-base), модули вынуты `git show` в scratch/base. Голова - рабочее дерево 889c35b.
// Запуск из analytics-mvp: npx tsx ../knowledge/episodes/2026-10/feniks-probes-ozon-chat-2x/c3_regress.mts
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SP = "/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad/";
const HEAD = "/home/user/t1/analytics-mvp/src/scripts/";
const DATA = "/home/user/t1/analytics-mvp/data/";
const FB = await import(SP + "base/funnel-tests.ts");
const FH = await import(HEAD + "funnel-tests.ts");
const GB = await import(SP + "base/gap-daily.ts");
const GH = await import(HEAD + "gap-daily.ts");

// ---------- R2: живые файлы, база против головы
const ser = (ft: any) => {
  const agg: string[] = [];
  for (const [id, byRole] of ft.agg) for (const [role, byDay] of byRole) for (const [d, r] of byDay) agg.push(`${id}|${role}|${d}|${r.search_views}|${r.n}`);
  const art: string[] = [];
  for (const [a, byDay] of ft.byArt) for (const [d, r] of byDay) art.push(`${a}|${d}|${r.search_views}|${r.search_position}|${r.ordered_units}`);
  const role = [...ft.roleOf].map(([a, r]: [string, string]) => `${a}|${r}`);
  return { agg: agg.sort(), art: art.sort(), role: role.sort(), first: ft.first, last: ft.last, rows: ft.rows.length, bad: ft.bad.length };
};
const b = ser(FB.readFunnelTests(DATA + "funnel_tests.ndjson"));
const h = ser(FH.readFunnelTests(DATA + "funnel_tests.ndjson"));
const eq = (x: string[], y: string[]) => x.length === y.length && x.every((v, i) => v === y[i]);
console.log("R2 funnel: rows база", b.rows, "голова", h.rows, "| bad", b.bad, h.bad, "| first/last", b.first, b.last, "/", h.first, h.last);
console.log("R2 funnel: agg совпадает", eq(b.agg, h.agg), b.agg.length, "| byArt совпадает", eq(b.art, h.art), b.art.length, "| roleOf совпадает", eq(b.role, h.role));
const gb = GB.readGapDaily(DATA + "gap_daily.ndjson"), gh = GH.readGapDaily(DATA + "gap_daily.ndjson");
const gs = (g: any) => g.rows.map((r: any) => `${r.date}|${r.art}|${r.gap_pct}`).sort();
console.log("R2 gap: rows база", gb.rows.length, "голова", gh.rows.length, "совпадает", eq(gs(gb), gs(gh)), "| days", gb.days.length, gh.days.length);

// ---------- фикстуры
const dir = mkdtempSync(join(tmpdir(), "fx-ft-"));
const ok = { date: "2026-10-14", art: "A-1", role: "test_ad", test_id: "t1", search_position: 10, search_views: 400, pdp_views: 40, hits_to_cart: 4, ordered_units: 1 };
const run = (name: string, rows: object[]) => {
  const p = join(dir, name + ".ndjson");
  writeFileSync(p, rows.map((r) => JSON.stringify(r)).join("\n"));
  return FH.readFunnelTests(p);
};
// P1: старая строка без full за сегодняшний день (как в живом файле за 15.10, срез ~13:00)
let r = run("p1", [{ ...ok }, { ...ok, date: "2026-10-15", search_views: 90 }]);
console.log("P1 легаси-строка за сегодня без full: в ряду", r.byArt.get("A-1")?.has("2026-10-15"), "last", r.last, "partial", r.partial.length);
// P2: противоречие - full:true, а момент съёма внутри того же дня
r = run("p2", [{ ...ok }, { ...ok, date: "2026-10-15", search_views: 90, full: true, ts: "2026-10-15T13:05:00+03:00", snap: "вечер" }]);
console.log("P2 full:true при ts 15.10 13:05 за дату 15.10: в ряду", r.byArt.get("A-1")?.has("2026-10-15"), "показы", r.byArt.get("A-1")?.get("2026-10-15")?.search_views, "bad", r.bad.length);
// P3: утро не прошло - 14.10 остался full:false, 15.10 вечер full:false
r = run("p3", [{ ...ok, date: "2026-10-13" }, { ...ok, full: false, ts: "2026-10-14T21:00:00+03:00" }, { ...ok, date: "2026-10-15", full: false, ts: "2026-10-15T21:00:00+03:00" }]);
const days3 = [...new Set(r.rows.map((x: any) => x.date))].sort();
console.log("P3 застрявший неполный 14.10: last", r.last, "partialDay", r.partialDay, "partial", r.partial.map((x: any) => x.date), "дни ряда", days3, "missingDays по ряду", FH.missingDays(r.byArt.get("A-1"), days3));
// P4: агрегаты двух групп одного теста (как в живом файле: group test / control, art AGG:<id>:<group>)
const agg = (group: string, sv: number) => ({ date: "2026-10-16", test_id: "cpc_bid_down", art: `AGG:cpc_bid_down:${group}`, group, role: "agg_median", n: 11, n_nonzero: 11, search_position: 50, search_views: sv, pdp_views: 1, hits_to_cart: 0, ordered_units: 0 });
r = run("p4a", [agg("control", 21), agg("test", 118)]);
const r4b = run("p4b", [agg("test", 118), agg("control", 21)]);
console.log("P4 две группы агрегата: строк в rows", r.rows.length, "| контроль, если test записан последним:", FH.aggDay(r, "cpc_bid_down", "agg_median", "2026-10-16")?.search_views, "(должно быть 21) | если control последним:", FH.aggDay(r4b, "cpc_bid_down", "agg_median", "2026-10-16")?.search_views);
// P5: ts в UTC вместо МСК - что увидит строка «срез ЧЧ:ММ МСК» (build-tests.ts:3410 берёт ЧЧ:ММ из строки как есть)
r = run("p5", [{ ...ok }, { ...ok, date: "2026-10-15", full: false, ts: "2026-10-15T17:10:00Z" }]);
console.log("P5 ts в UTC:", r.partialTs, "-> на странице «срез", (/T(\d{2}:\d{2})/.exec(r.partialTs) ?? [])[1], "МСК», на деле 20:10 МСК");
// P6: товар в двух ролях в незакрытый день - строка «день не закрыт» суммирует строки, не товары
r = run("p6", [{ ...ok }, { ...ok, date: "2026-10-15", full: false, ts: "2026-10-15T21:00:00+03:00", search_views: 100 },
  { ...ok, date: "2026-10-15", role: "control", test_id: "t2", full: false, ts: "2026-10-15T21:00:00+03:00", search_views: 100 }]);
const pr = r.partial.filter((x: any) => x.date === r.partialDay && !FH.AGG_ROLES.has(x.role));
console.log("P6 один товар в двух ролях: строк в сумме", pr.length, "показы", pr.reduce((a: number, x: any) => a + x.search_views, 0), "(товар один, показов 100)");
// P7: формы test_id у одного товара утром и вечером - ключ разный, обе строки живут
r = run("p7", [{ ...ok, date: "2026-10-15", full: false, test_id: "", ts: "2026-10-15T08:00:00+03:00", search_views: 30 },
  { ...ok, date: "2026-10-15", full: false, test_id: "t1", ts: "2026-10-15T21:00:00+03:00", search_views: 90 }]);
console.log("P7 test_id '' утром и 't1' вечером: partial строк", r.partial.length, "сумма показов", r.partial.reduce((a: number, x: any) => a + x.search_views, 0), "(верно 90)");
void readFileSync;
