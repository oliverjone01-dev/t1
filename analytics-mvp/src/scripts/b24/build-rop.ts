// Запекает живые данные Bitrix (rop/data/rop.json) в дашборд РОПа.
// Шаблон: rop/rop-command.template.html (чистый MVP). Выход: public/rop-command.html.
// Воспроизводит контракт DATA, который ждёт MVP: deals, leads, from, to, dq, funnel,
// keyStageStats, intStaff, opUsers (+ неиспользуемые stubs groups/sysUsers/deptOf).
//
// dwell (время в стадии) и касания (touchReal/touchAll) требуют истории стадий/активностей
// = фаза 2; пока 0. Воронка считается приближённо по ТЕКУЩЕЙ стадии (точная — с историей, ф.2).
//
// Запуск: npx tsx src/scripts/b24/build-rop.ts (после fetch-rop.ts).

import { readFileSync, writeFileSync } from "node:fs";

const TPL = "rop/rop-command.template.html";
const SRC = "rop/data/rop.json";
const PLAN = "rop/plan/plan.json"; // помесячный план (из Google Таблицы); опционален
const PLAN_ID = process.env.PLAN_SHEET_ID || "14jm7EvJcZSMvmWe2leRG8hHfIvpCLDzY";
const OUT = "public/rop-command.html";
const TODAY = process.env.ROP_TODAY || new Date().toISOString().slice(0, 10);

const rop = JSON.parse(readFileSync(SRC, "utf-8"));
const tpl = readFileSync(TPL, "utf-8");
// План - необязателен: если файла нет, дашборд откатывается к ручному полю «План выручки/мес».
let plan: any = null;
try { plan = JSON.parse(readFileSync(PLAN, "utf-8")); } catch { plan = null; }

// --- Исключения (решение Ивана 2026-06-26, уточнено): из дашборда РОП убираем ТОЛЬКО ---
//  - сотрудников Glass Memory: Виктория Преснякова, Денис Белов, Юлия Мавлина;
//  - системный аккаунт Glass Memory (Системный пользователь MGM);
//  - направление бизнеса Glass Memory (dir = glass-memory).
// Остальных (вкл. Системный пользователь GG/KZ/V, Дмитрий Янчоглов, миграционные) ОСТАВЛЯЕМ.
const EXCLUDE_MGR = new Set([
  "Виктория Преснякова", "Денис Белов", "Юлия Мавлина", "Системный пользователь MGM",
]);
const keepRec = (r: any) => !EXCLUDE_MGR.has(r.mgr) && r.dir !== "glass-memory";
const _dBefore = rop.deals.length, _lBefore = rop.leads.length;
rop.deals = rop.deals.filter(keepRec);
rop.leads = rop.leads.filter(keepRec);
console.log(`Исключения GM/системные: сделок -${_dBefore - rop.deals.length} (осталось ${rop.deals.length}), лидов -${_lBefore - rop.leads.length} (осталось ${rop.leads.length})`);

const DIRS = ["genglass", "glass-memory", "metal_gm", "gen-group", "gentero", "valonti"];
const sum = (arr: any[], f: (x: any) => number) => arr.reduce((s, x) => s + (f(x) || 0), 0);
const ddiff = (a?: string, b?: string): number | null => {
  if (!a || !b) return null; const t1 = Date.parse(a), t2 = Date.parse(b);
  return isNaN(t1) || isNaN(t2) ? null : Math.round((t2 - t1) / 86400000 * 100) / 100;
};
// dwellCur = дней в текущей стадии (для открытых сделок), из истории стадий.
const dwellOf = (d: any): number | null => {
  if (d.won || d.lost) return null;
  const h = d.hist || []; const at = h.length ? h[h.length - 1][1] : d.created;
  return ddiff(at, TODAY);
};

// --- deals -> схема MVP (+ hist/dwellCur из истории стадий; касания = фаза 2) ---
const deals = rop.deals.map((d: any) => ({
  id: d.id, mgr: d.mgr, stage: d.stage, won: d.won, lost: d.lost, budget: d.budget,
  created: d.created, closed: d.closed, source: d.source, client: d.client,
  assort: d.assort, reason: d.reason, touchReal: d.touchReal || 0, touchAll: d.touchAll || 0, cycle: d.cycle,
  stageCode: d.stageCode, dir: d.dir, hist: d.hist || [], dwellCur: dwellOf(d),
}));

// --- leads -> схема MVP (+ qual) ---
const qualOf = (sc: string) =>
  sc === "CONVERTED" ? "квал" : (["JUNK", "1", "2", "3"].includes(sc) ? "неквал" : "в работе");
const leads = rop.leads.map((l: any) => ({
  id: l.id, mgr: l.mgr, status: l.status, qual: qualOf(l.statusCode),
  created: l.created, closed: l.closed, source: l.source, dir: l.dir,
}));

// --- from / to ---
const dd = deals.map((d: any) => d.created).filter(Boolean).sort();
const from = dd[0] || TODAY;
const to = TODAY;

// --- dq (data quality, точный расчёт) ---
const byDir = (arr: any[]) => {
  const m: Record<string, number> = {}; DIRS.forEach((x) => (m[x] = 0));
  for (const r of arr) if (r.dir && r.dir !== "не указано") m[r.dir] = (m[r.dir] || 0) + 1;
  return m;
};
const leadByDir = byDir(leads), dealByDir = byDir(deals);
dealByDir["не указано"] = deals.filter((d: any) => d.dir === "не указано").length;
const leadQualByDir: Record<string, number> = {}; DIRS.forEach((x) => (leadQualByDir[x] = 0));
let leadQualEmpty = 0;
const leadStatByDir: Record<string, any> = {};
DIRS.forEach((x) => (leadStatByDir[x] = { s: 0, f: 0, p: 0, conv: 0 }));
for (const l of leads) {
  const d = l.dir && l.dir !== "не указано" ? l.dir : null;
  const bucket = l.qual === "квал" ? "s" : l.qual === "неквал" ? "f" : "p";
  if (d && leadStatByDir[d]) { leadStatByDir[d][bucket]++; if (l.qual === "квал") { leadStatByDir[d].conv++; leadQualByDir[d]++; } }
  else if (l.qual === "квал") leadQualEmpty++;
}
const dq = {
  leadTotal: leads.length,
  leadEmpty: leads.filter((l: any) => l.dir === "не указано").length,
  leadByDir, dealTotal: deals.length, dealByDir, leadQualByDir, leadQualEmpty,
  dirList: DIRS, leadStatByDir,
};

// --- funnel (кумулятивно по конвейеру; приближение по текущей стадии, dwell=ф.2) ---
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

// --- keyStageStats (3 ключевые стадии; curCount/curMoney точно, dwell/касания=ф.2) ---
const KEYS: Array<[string, string]> = [
  ["C49:PREPAYMENT_INVOIC", "КП отправлено"], ["C49:3", "Принимают решение"], ["C49:UC_8JTBV2", "Долгострой"],
];
const keyStageStats = KEYS.map(([code, name]) => {
  const inS = deals.filter((d: any) => d.stageCode === code);
  return { code, name, curCount: inS.length, curMoney: sum(inS, (x) => x.budget),
    curMedDwell: 0, medDwell: 0, curNoReal: inS.length, curRealCover: 0, avgReal: 0 };
});

// --- intStaff (по сотрудникам: лиды/сделки/выигрыши) ---
const staff: Record<string, any> = {};
const ensure = (n: string) => (staff[n] ??= { name: n, dept: [], leads: 0, deals: 0, won: 0 });
for (const d of deals) { const s = ensure(d.mgr); s.deals++; if (d.won) s.won++; }
for (const l of leads) ensure(l.mgr).leads++;
const intStaff = Object.values(staff);

// --- opUsers (продавцы: менеджеры со сделками, по убыванию) ---
const opUsers = Object.values(staff)
  .filter((s: any) => s.deals > 0).sort((a: any, b: any) => b.deals - a.deals).map((s: any) => s.name);

const DATA = {
  from, to, deals, leads, groups: [], keyStageStats, funnel, dq, opUsers, intStaff,
  sysUsers: [], deptOf: {},
  // Метка свежести: когда данные сняты из Bitrix (для видимого штампа на странице).
  generatedAt: rop.generated_at || null,
  // Помесячный план (из Google Таблицы через plan-to-json). null = ручное поле плана.
  plan: plan || null,
  // Ссылки на таблицу плана: edit - открыть; csv (gviz, CORS-дружелюбный) - живое чтение кнопкой.
  planUrl: `https://docs.google.com/spreadsheets/d/${PLAN_ID}/edit`,
  planCsv: `https://docs.google.com/spreadsheets/d/${PLAN_ID}/gviz/tq?tqx=out:csv`,
};

// --- инъекция в шаблон (замена литерала const DATA={...}) ---
const i = tpl.indexOf("const DATA=");
if (i < 0) { console.error("В шаблоне нет 'const DATA='"); process.exit(1); }
let j = tpl.indexOf("{", i), depth = 0, end = -1;
for (let k = j; k < tpl.length; k++) { const c = tpl[k]; if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { end = k; break; } } }
const out = tpl.slice(0, i) + "const DATA=" + JSON.stringify(DATA) + tpl.slice(end + 1);
writeFileSync(OUT, out);

console.log(`build-rop: сделок ${deals.length}, лидов ${leads.length}, период ${from}..${to}`);
console.log(`funnel[0]=${funnel[0].count} funnel[Успешно]=${funnel[funnel.length - 1].count} | opUsers ${opUsers.length} | intStaff ${intStaff.length}`);
console.log(`-> ${OUT} (${(out.length / 1048576).toFixed(1)} MB)`);
