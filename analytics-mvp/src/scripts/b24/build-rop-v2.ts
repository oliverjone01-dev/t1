// Собирает v2 РОП-дашборд (rop/rop-command-v2.template.html) в public/rop-command-v2.html.
// Логика идентична build-rop.ts (те же исключения GM, тот же DATA-контракт),
// только paths шаблона/выхода другие. v1 остаётся жив параллельно.
// Feature flag реализован на уровне workflow: /rop-preview/ копирует v1 либо v2.
//
// Запуск: npx tsx src/scripts/b24/build-rop-v2.ts (после fetch-rop.ts + build-rop.ts).

import { readFileSync, writeFileSync } from "node:fs";

const TPL = "rop/rop-command-v2.template.html";
const SRC = "rop/data/rop.json";
const PLAN = "rop/plan/plan.json";
const PLAN_ID = process.env.PLAN_SHEET_ID || "14jm7EvJcZSMvmWe2leRG8hHfIvpCLDzY";
const OUT = "public/rop-command-v2.html";
const TODAY = process.env.ROP_TODAY || new Date().toISOString().slice(0, 10);

const rop = JSON.parse(readFileSync(SRC, "utf-8"));
const tpl = readFileSync(TPL, "utf-8");
let plan: any = null;
try { plan = JSON.parse(readFileSync(PLAN, "utf-8")); } catch { plan = null; }

// Исключения (решение Ивана 2026-06-26): GM-сотрудники + Glass Memory dir
const EXCLUDE_MGR = new Set([
  "Виктория Преснякова", "Денис Белов", "Юлия Мавлина", "Системный пользователь MGM",
]);
const keepRec = (r: any) => !EXCLUDE_MGR.has(r.mgr) && r.dir !== "glass-memory";
rop.deals = rop.deals.filter(keepRec);
rop.leads = rop.leads.filter(keepRec);

const DIRS = ["genglass", "glass-memory", "metal_gm", "gen-group", "gentero", "valonti"];
const sum = (arr: any[], f: (x: any) => number) => arr.reduce((s, x) => s + (f(x) || 0), 0);
const ddiff = (a?: string, b?: string): number | null => {
  if (!a || !b) return null; const t1 = Date.parse(a), t2 = Date.parse(b);
  return isNaN(t1) || isNaN(t2) ? null : Math.round((t2 - t1) / 86400000 * 100) / 100;
};
const dwellOf = (d: any): number | null => {
  if (d.won || d.lost) return null;
  const h = d.hist || []; const at = h.length ? h[h.length - 1][1] : d.created;
  return ddiff(at, TODAY);
};

const deals = rop.deals.map((d: any) => ({
  id: d.id, mgr: d.mgr, stage: d.stage, won: d.won, lost: d.lost, budget: d.budget,
  created: d.created, closed: d.closed, source: d.source, client: d.client,
  assort: d.assort, reason: d.reason, touchReal: d.touchReal || 0, touchAll: d.touchAll || 0, cycle: d.cycle,
  stageCode: d.stageCode, dir: d.dir, hist: d.hist || [], dwellCur: dwellOf(d),
  title: d.title,
}));

const qualOf = (sc: string) =>
  sc === "CONVERTED" ? "квал" : (["JUNK", "1", "2", "3"].includes(sc) ? "неквал" : "в работе");
const leads = rop.leads.map((l: any) => ({
  id: l.id, mgr: l.mgr, status: l.status, qual: qualOf(l.statusCode),
  created: l.created, closed: l.closed, source: l.source, dir: l.dir,
}));

const dd = deals.map((d: any) => d.created).filter(Boolean).sort();
const from = dd[0] || TODAY;
const to = TODAY;

const byDir = (arr: any[]) => {
  const m: Record<string, number> = {}; DIRS.forEach((x) => (m[x] = 0));
  for (const r of arr) if (r.dir && r.dir !== "не указано") m[r.dir] = (m[r.dir] || 0) + 1;
  return m;
};
const dq = {
  leadTotal: leads.length,
  leadEmpty: leads.filter((l: any) => l.dir === "не указано").length,
  leadByDir: byDir(leads),
  dealTotal: deals.length,
  dealByDir: byDir(deals),
  dirList: DIRS,
};

const PIPE = ["C49:NEW", "C49:UC_LRFLH9", "C49:PREPARATION", "C49:UC_OGZUU0", "C49:PREPAYMENT_INVOIC",
  "C49:3", "C49:UC_8JTBV2", "C49:EXECUTING", "C49:FINAL_INVOICE", "C49:1", "C49:2", "C49:WON"];
const ord: Record<string, number> = {}; PIPE.forEach((c, i) => (ord[c] = i));
const reached = (d: any) => d.won ? ord["C49:WON"] : (d.lost ? 0 : (ord[d.stageCode] ?? 0));
const FUN: Array<[string, string]> = [
  ["Новая сделка", "C49:NEW"], ["Квалификация", "C49:UC_LRFLH9"], ["Формируется предложение", "C49:PREPARATION"],
  ["Предложение отправлено", "C49:PREPAYMENT_INVOIC"], ["Принимают решение", "C49:3"], ["Предоплата", "C49:EXECUTING"],
  ["В производстве", "C49:FINAL_INVOICE"], ["В логистике", "C49:2"], ["Успешно", "C49:WON"],
];
const funnel = FUN.map(([name, code]) => {
  const th = ord[code];
  const r = deals.filter((d: any) => reached(d) >= th);
  return { name, count: r.length, money: sum(r, (x) => x.budget), dwell: 0, conv: 0 };
});
funnel.forEach((f, k) => (f.conv = k === 0 ? 1 : (funnel[k - 1].count ? f.count / funnel[k - 1].count : 0)));

const KEYS: Array<[string, string]> = [
  ["C49:PREPAYMENT_INVOIC", "КП отправлено"], ["C49:3", "Принимают решение"], ["C49:UC_8JTBV2", "Долгострой"],
];
const keyStageStats = KEYS.map(([code, name]) => {
  const inS = deals.filter((d: any) => d.stageCode === code);
  return { code, name, curCount: inS.length, curMoney: sum(inS, (x) => x.budget),
    curMedDwell: 0, medDwell: 0, curNoReal: inS.length, curRealCover: 0, avgReal: 0 };
});

const staff: Record<string, any> = {};
const ensure = (n: string) => (staff[n] ??= { name: n, dept: [], leads: 0, deals: 0, won: 0 });
for (const d of deals) { const s = ensure(d.mgr); s.deals++; if (d.won) s.won++; }
for (const l of leads) ensure(l.mgr).leads++;
const intStaff = Object.values(staff);

const NOT_OP = new Set(["Дмитрий Янчоглов", "Алиса Алексеева"]);
const isSysName = (n: string) => /систем|^id\s?\d/i.test(n || "");
const isSalesRep = (s: any) => !NOT_OP.has(s.name) && !isSysName(s.name);
const opUsers = Object.values(staff)
  .filter((s: any) => s.deals > 0 && isSalesRep(s)).sort((a: any, b: any) => b.deals - a.deals).map((s: any) => s.name);

const DATA = {
  from, to, deals, leads, groups: [], keyStageStats, funnel, dq, opUsers, intStaff,
  sysUsers: [], deptOf: {},
  refs: rop.refs || {},
  generatedAt: rop.generated_at || null,
  plan: plan || null,
  planUrl: `https://docs.google.com/spreadsheets/d/${PLAN_ID}/edit`,
  planCsv: `https://docs.google.com/spreadsheets/d/${PLAN_ID}/gviz/tq?tqx=out:csv`,
};

const i = tpl.indexOf("const DATA=");
if (i < 0) { console.error("В шаблоне нет 'const DATA='"); process.exit(1); }
let j = tpl.indexOf("{", i), depth = 0, end = -1;
for (let k = j; k < tpl.length; k++) { const c = tpl[k]; if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { end = k; break; } } }
const out = tpl.slice(0, i) + "const DATA=" + JSON.stringify(DATA) + tpl.slice(end + 1);
writeFileSync(OUT, out);

console.log(`build-rop-v2: сделок ${deals.length}, лидов ${leads.length}, период ${from}..${to}`);
console.log(`funnel[0]=${funnel[0].count} funnel[Успешно]=${funnel[funnel.length - 1].count} | opUsers ${opUsers.length}`);
console.log(`-> ${OUT} (${(out.length / 1048576).toFixed(1)} MB)`);
