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

// --- Пер-сделочные записи продаж за последние 180 дней - для фильтра периодов на фронте.
// Каждая запись: имя в РОПе (m), имя в разборе диалогов (s, null если менеджера там нет),
// дата предоплаты (d), бюджет (b). Глубже 180 дней СВОД не показывает - подписано на странице.
const DEPTH_DAYS = 180;
const depthCut = new Date(new Date(ropGen || Date.now()).getTime() - DEPTH_DAYS * 864e5).toISOString().slice(0, 10);
// (soldRecs собираются ниже, после managers - нужен маппинг имён)

// --- Цикл сделки создание -> предоплата, только по датам ИЗ ИСТОРИИ стадий (fallback на
// created дал бы фиктивные нули). Считаем по продажам текущего месяца.
const histSoldDate = (d: any) => { for (const h of (d.hist || [])) if (SOLD.has(h[0])) return h[1]; return null; };
const cycles: number[] = [];
for (const d of rop.deals || []) {
  if (!isSold(d)) continue;
  const hd = histSoldDate(d);
  if (!hd || String(hd).slice(0, 7) !== MONTH) continue;
  const days = (new Date(hd).getTime() - new Date(d.created).getTime()) / 864e5;
  if (days >= 0) cycles.push(days);
}
cycles.sort((a, b) => a - b);
const q = (p: number) => cycles.length ? Math.round(cycles[Math.min(cycles.length - 1, Math.floor(cycles.length * p))]) : null;
const cycle = cycles.length >= 20 ? { medD: q(0.5), p75D: q(0.75), p90D: q(0.9), n: cycles.length } : null;
const deptWonRub = Object.values(monthAgg).reduce((s, x) => s + x.wonRub, 0);
const deptWonN = Object.values(monthAgg).reduce((s, x) => s + x.wonN, 0);

// План месяца из Google-таблицы (rev). Персональных планов в системе НЕТ - и мы их не выдумываем.
// Соседние месяцы отдаём тоже: фронт показывает предупреждение, если план месяца резко
// выбивается из ряда (например 20 млн между 10 и 7,5) - такое надо сверять с владельцем таблицы.
const months: any[] = plan && Array.isArray(plan.months) ? plan.months : [];
const mIdx = months.findIndex((m: any) => m.month === MONTH);
const planRev = mIdx >= 0 ? months[mIdx].rev : null;
const planPrev = mIdx > 0 ? months[mIdx - 1].rev : null;
const planNext = mIdx >= 0 && months[mIdx + 1] ? months[mIdx + 1].rev : null;

// --- managers: scoring + продажи месяца ---
const managers = (sc.managers as any[]).map((m) => {
  const key = Object.keys(monthAgg).find((n) => sameName(n, m.mgr));
  const mm = key ? monthAgg[key] : { wonN: 0, wonRub: 0 };
  return { ...m, wonN: mm.wonN, wonRub: mm.wonRub };
});

// Продавцы, у которых есть продажи месяца в rop.json, но которых нет в недельном разборе
// диалогов (другой отдел, уволенные, разовые). Отдаём фронту явно, чтобы сумма колонки
// «Продано за месяц» сходилась с плиткой отдела до копейки - без «дыры» в цифрах.
const hiddenNames = Object.keys(monthAgg).filter((n) => !(sc.managers as any[]).some((m) => sameName(m.mgr, n)));

// Записи продаж для фильтра периодов (см. DEPTH_DAYS выше)
const scoredByRop: Record<string, string | null> = {};
const scoredName = (ropName: string) => {
  if (ropName in scoredByRop) return scoredByRop[ropName];
  const hit = (sc.managers as any[]).find((m) => sameName(m.mgr, ropName));
  return (scoredByRop[ropName] = hit ? hit.mgr : null);
};
const soldRecs: { m: string; s: string | null; d: string; b: number }[] = [];
for (const d of rop.deals || []) {
  if (!isSold(d)) continue;
  const sd = String(soldDate(d) || "").slice(0, 10);
  if (!sd || sd < depthCut) continue;
  soldRecs.push({ m: d.mgr, s: scoredName(d.mgr), d: sd, b: d.budget || 0 });
}
const hiddenMgr = {
  n: hiddenNames.reduce((s, n) => s + monthAgg[n].wonN, 0),
  rub: hiddenNames.reduce((s, n) => s + monthAgg[n].wonRub, 0),
  names: hiddenNames.map((n) => ({ name: n, rub: monthAgg[n].wonRub })).sort((a, b) => b.rub - a.rub),
};

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
    ropGenerated: ropGen, month: MONTH, planRev, planPrev, planNext,
    cycle, depthDays: DEPTH_DAYS,
    planSource: plan ? "Google-таблица руководителя (plan.json)" : null,
    portal: dlg.portal, scope: dlg.scope,
  },
  sections: sc.sections, deptMedians: sc.deptMedians, metricDefs: sc.metricDefs,
  baseRates: sc.baseRates, calibratedAt: sc.calibratedAt, baseFallback: sc.baseFallback,
  minSample: sc.minSample, queues: sc.queues, aiDemo: sc.aiDemo,
  managers, deals, deptWonRub, deptWonN, hiddenMgr, soldRecs,
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
