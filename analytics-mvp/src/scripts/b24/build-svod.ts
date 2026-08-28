// Сводный дашборд качества работы менеджеров («СВОД») для песочницы /dialog-experiments/.
// Склеивает ТРИ готовых источника - ничего не пересчитывает заново и НЕ придумывает цифр:
//   1) dialog/data/dialog.json  - снимок коммуникаций + scoring (движок score-dialog.ts):
//      рейтинги, 6 секций регламента, очереди сделок, вероятности, потери в рублях.
//   2) rop.json (ветка rop-dashboard-v1, ночной синк) - продажи месяца по менеджерам.
//      Путь через env ROP_JSON (в CI подкладывается из worktree Диминой ветки).
//   3) plan.json (там же) - план выручки месяца из Google-таблицы руководителя.
// Имена менеджеров в двух системах в разном порядке («Фамилия Имя» vs «Имя Фамилия») -
// сшиваем по множеству слов имени.
// Запуск: ROP_JSON=/tmp/rop.json PLAN_JSON=/tmp/plan.json npx tsx src/scripts/b24/build-svod.ts
import { readFileSync, writeFileSync } from "node:fs";

const DLG = "dialog/data/dialog.json";
const TRD = "dialog/data/trend.json";
const TPL = "dialog/svod.template.html";
const OUT = "public/svod.html";
const ROP = process.env.ROP_JSON || "/tmp/rop.json";
const PLAN = process.env.PLAN_JSON || "/tmp/plan.json";

const dlg = JSON.parse(readFileSync(DLG, "utf-8"));
const trend = JSON.parse(readFileSync(TRD, "utf-8"));
const rop = JSON.parse(readFileSync(ROP, "utf-8"));
let plan: any = null;
try { plan = JSON.parse(readFileSync(PLAN, "utf-8")); } catch { plan = null; }

const sc = dlg.scoring || {};
if (!sc.managers || !sc.deals) { console.error("В dialog.json нет scoring.managers/deals - снимок собран старым движком"); process.exit(1); }

// --- Продажи текущего месяца из rop.json (правило «продажа от предоплаты», как в РОП/GG) ---
const SOLD = new Set(["C49:EXECUTING", "C49:FINAL_INVOICE", "C49:1", "C49:2", "C49:WON"]);
const isSold = (d: any) => d.won || (SOLD.has(d.stageCode) && !d.lost);
const soldDate = (d: any) => { if (d.won && d.closed) return d.closed; for (const h of (d.hist || [])) if (SOLD.has(h[0])) return h[1]; return d.closed || d.created; };
const ropGen: string = rop.generated_at || "";
const MONTH = (ropGen || new Date().toISOString()).slice(0, 7);

const tokens = (s: string) => new Set(String(s || "").toLowerCase().split(/\s+/).filter(Boolean));
const sameName = (a: string, b: string) => { const ta = tokens(a), tb = tokens(b); if (!ta.size || !tb.size) return false; for (const t of ta) if (!tb.has(t)) return false; return ta.size === tb.size; };

const monthAgg: Record<string, { wonN: number; wonRub: number }> = {};
for (const d of rop.deals || []) {
  if (!isSold(d)) continue;
  const sd = String(soldDate(d) || "");
  if (sd.slice(0, 7) !== MONTH) continue;
  (monthAgg[d.mgr] ||= { wonN: 0, wonRub: 0 });
  monthAgg[d.mgr].wonN++; monthAgg[d.mgr].wonRub += d.budget || 0;
}
const deptWonRub = Object.values(monthAgg).reduce((s, x) => s + x.wonRub, 0);
const deptWonN = Object.values(monthAgg).reduce((s, x) => s + x.wonN, 0);

// План месяца из Google-таблицы (rev). Персональных планов в системе НЕТ - и мы их не выдумываем.
const planRow = plan && Array.isArray(plan.months) ? plan.months.find((m: any) => m.month === MONTH) : null;
const planRev = planRow ? planRow.rev : null;

// --- managers: scoring + продажи месяца ---
const managers = (sc.managers as any[]).map((m) => {
  const key = Object.keys(monthAgg).find((n) => sameName(n, m.mgr));
  const mm = key ? monthAgg[key] : { wonN: 0, wonRub: 0 };
  return { ...m, wonN: mm.wonN, wonRub: mm.wonRub };
});

// --- deals: только поля, нужные СВОДу (страница лёгкая, события не тащим) ---
const deals = (sc.deals as any[]).map((d) => ({
  dealId: d.dealId, isLead: d.isLead, title: d.title, mgr: d.mgr,
  stage: d.stage, stageCode: d.stageCode, budget: d.budget || 0,
  prob: d.prob, base: d.base, uKey: d.uKey, urgency: d.urgency,
  outcome: d.outcome, won: d.won, lost: d.lost,
  next: d.next || "", silenceD: d.silenceD, respMed: d.respMed,
  ballWait: d.ballWait, nextStep: d.nextStep, lastDt: d.lastDt,
}));

const DATA = {
  meta: {
    dlgFrom: dlg.from, dlgTo: dlg.to, dlgDays: dlg.days, dlgGenerated: dlg.generatedAt,
    ropGenerated: ropGen, month: MONTH, planRev,
    planSource: plan ? "Google-таблица руководителя (plan.json)" : null,
    portal: dlg.portal, scope: dlg.scope,
  },
  sections: sc.sections, deptMedians: sc.deptMedians, metricDefs: sc.metricDefs,
  baseRates: sc.baseRates, calibratedAt: sc.calibratedAt, baseFallback: sc.baseFallback,
  minSample: sc.minSample, queues: sc.queues, aiDemo: sc.aiDemo,
  managers, deals, deptWonRub, deptWonN,
  trend: trend.days || [],
};

const tpl = readFileSync(TPL, "utf-8");
const i = tpl.indexOf("const DATA=");
if (i < 0) { console.error("В шаблоне нет 'const DATA='"); process.exit(1); }
let j = tpl.indexOf("{", i), depth = 0, end = -1;
for (let k = j; k < tpl.length; k++) { const c = tpl[k]; if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { end = k; break; } } }
const out = tpl.slice(0, i) + "const DATA=" + JSON.stringify(DATA) + tpl.slice(end + 1);
writeFileSync(OUT, out);
console.log(`build-svod: менеджеров ${managers.length}, сделок ${deals.length}, месяц ${MONTH}, план ${planRev ?? "нет"}, продано ${deptWonRub}`);
console.log(`-> ${OUT} (${(out.length / 1048576).toFixed(1)} MB)`);
