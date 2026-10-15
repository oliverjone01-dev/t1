// ФЕНИКС iter2, PR #477 @ 3121423. R2 (база 628695b против головы на живых файлах) + P1-P7 + новые края.
// Запуск из analytics-mvp: npx tsx ../knowledge/episodes/2026-10/feniks-probes-ozon-chat-2x/iter2/r2_regress.mts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SP = "/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad/";
const HEAD = "/home/user/t1/analytics-mvp/src/scripts/";
const DATA = "/home/user/t1/analytics-mvp/data/";
const FB = await import(SP + "base/funnel-tests.ts");
const FH = await import(HEAD + "funnel-tests.ts");
const GB = await import(SP + "base/gap-daily.ts");
const GH = await import(HEAD + "gap-daily.ts");

const aggOf = (ft: any) => { const m = new Map<string, string>(); for (const [id, byRole] of ft.agg) for (const [role, byDay] of byRole) for (const [d, r] of byDay) m.set(`${id}|${role}|${d}`, `${r.search_views}|${r.n}`); return m; };
const artOf = (ft: any) => { const a: string[] = []; for (const [art, byDay] of ft.byArt) for (const [d, r] of byDay) a.push(`${art}|${d}|${r.search_views}|${r.search_position}|${r.ordered_units}`); return a.sort(); };
const eq = (x: string[], y: string[]) => x.length === y.length && x.every((v, i) => v === y[i]);
const b = FB.readFunnelTests(DATA + "funnel_tests.ndjson"), h = FH.readFunnelTests(DATA + "funnel_tests.ndjson");
console.log("R2 rows база", b.rows.length, "голова", h.rows.length, "| bad", b.bad.length, h.bad.length, "| first/last", b.first, b.last, "/", h.first, h.last, "| partial", h.partial.length);
const ab = aggOf(b), ah = aggOf(h);
const changed = [...ab.keys()].filter((k) => ab.get(k) !== ah.get(k));
const onlyB = [...ab.keys()].filter((k) => !ah.has(k)), onlyH = [...ah.keys()].filter((k) => !ab.has(k));
console.log("R2 агрегаты: всего база", ab.size, "голова", ah.size, "| изменилось", changed.length, "| пропало", onlyB.length, "| новых", onlyH.length);
console.log("   изменённые даты:", [...new Set(changed.map((k) => k.split("|")[2]))].sort().join(","), "| тесты:", [...new Set(changed.map((k) => k.split("|")[0]))].join(","));
console.log("R2 byArt совпадает", eq(artOf(b), artOf(h)), "| roleOf совпадает", eq([...b.roleOf].map(String).sort(), [...h.roleOf].map(String).sort()));
// каждый изменённый агрегат должен стать значением группы control из файла
const ctl = new Map<string, string>();
for (const r of h.rows) if (FH.AGG_ROLES.has(r.role) && r.group === "control") ctl.set(`${r.test_id}|${r.role}|${r.date}`, `${r.search_views}|${r.n}`);
console.log("   изменённые = группа control:", changed.every((k) => ah.get(k) === ctl.get(k)), "| все агрегаты с группой в карте = control:", [...ah.keys()].filter((k) => ctl.has(k)).every((k) => ah.get(k) === ctl.get(k)));
const gb = GB.readGapDaily(DATA + "gap_daily.ndjson"), gh = GH.readGapDaily(DATA + "gap_daily.ndjson");
console.log("R2 gap совпадает", eq(gb.rows.map((r: any) => `${r.date}|${r.art}|${r.gap_pct}`).sort(), gh.rows.map((r: any) => `${r.date}|${r.art}|${r.gap_pct}`).sort()), gh.rows.length);

const dir = mkdtempSync(join(tmpdir(), "fx2-"));
const ok = { date: "2026-10-14", art: "A-1", role: "test_ad", test_id: "t1", search_position: 10, search_views: 400, pdp_views: 40, hits_to_cart: 4, ordered_units: 1 };
let n = 0;
const run = (rows: object[]) => { const p = join(dir, `f${++n}.ndjson`); writeFileSync(p, rows.map((r) => JSON.stringify(r)).join("\n")); return FH.readFunnelTests(p); };
let r = run([{ ...ok }, { ...ok, date: "2026-10-15", search_views: 90 }]);
console.log("P1 легаси без full и ts за сегодня: в ряду", r.byArt.get("A-1")?.has("2026-10-15"), "(остаток: до первого съёма с ts)");
r = run([{ ...ok }, { ...ok, date: "2026-10-15", search_views: 90, full: true, ts: "2026-10-15T13:05:00+03:00" }]);
console.log("P2 full:true при ts внутри дня: в ряду", r.byArt.get("A-1")?.has("2026-10-15"), "partialDay", r.partialDay);
r = run([{ ...ok, date: "2026-10-13" }, { ...ok, full: false, ts: "2026-10-14T21:00:00+03:00" }, { ...ok, date: "2026-10-15", full: false, ts: "2026-10-15T21:00:00+03:00" }]);
console.log("P3 застрявший 14.10: last", r.last, "partialDay", r.partialDay, "partial", r.partial.map((x: any) => x.date).join(","));
const agg = (group: string, sv: number, extra: object = {}) => ({ date: "2026-10-16", test_id: "cpc_bid_down", art: `AGG:cpc_bid_down:${group}`, group, role: "agg_median", n: 11, n_nonzero: 11, search_position: 50, search_views: sv, pdp_views: 1, hits_to_cart: 0, ordered_units: 0, ...extra });
const ra = run([agg("control", 21), agg("test", 118)]), rb = run([agg("test", 118), agg("control", 21)]);
console.log("P4 группы: rows", ra.rows.length, "| контроль при test последним", FH.aggDay(ra, "cpc_bid_down", "agg_median", "2026-10-16")?.search_views, "| при control последним", FH.aggDay(rb, "cpc_bid_down", "agg_median", "2026-10-16")?.search_views);
const rc = run([agg("control", 21), { ...agg("test", 118), group: undefined }]);
console.log("P4b группа только в art (поля group нет): контроль", FH.aggDay(rc, "cpc_bid_down", "agg_median", "2026-10-16")?.search_views, "(21 - верно)");
const rd = run([agg("control", 21), agg("Test", 118)]);
console.log("P4c группа «Test» с заглавной: контроль", FH.aggDay(rd, "cpc_bid_down", "agg_median", "2026-10-16")?.search_views, "(21 - верно)");
r = run([{ ...ok }, { ...ok, date: "2026-10-15", full: false, ts: "2026-10-15T17:10:00Z" }]);
console.log("P5 ts в UTC: partialTs", r.partialTs, "-> «срез", (/T(\d{2}:\d{2})/.exec(r.partialTs) ?? [])[1], "МСК», на деле 20:10");
r = run([{ ...ok }, { ...ok, date: "2026-10-15", search_views: 90, full: true, ts: "2026-10-15T21:30:00" }]);
console.log("P8 ts без пояса 21:30 (вечер 15.10) при ошибочном full:true: в ряду", r.byArt.get("A-1")?.has("2026-10-15"), "(движок читает как UTC: 00:30 МСК 16.10)");
r = run([{ ...ok, date: "2026-10-15", full: false, ts: "вечер" }]);
console.log("P9 ts не время: bad", r.bad.length, r.bad[0]?.why);
