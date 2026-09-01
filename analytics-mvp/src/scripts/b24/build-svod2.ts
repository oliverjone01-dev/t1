// СВОД v2 - сборка сводного дашборда качества ОП (песочница /dialog-experiments/).
// Отличия от v1: воронка-конверсии вместо «Продано/План», свечи по 14+ дням истории,
// период пересчитывает ВСЕ блоки (состояние берётся из снимка на конец периода),
// «Мёрзнет портфель», ИИ-РОП срезы (тексты подаются готовым файлом AI_JSON - сборка
// НИЧЕГО не сочиняет, только раскладывает).
// Запуск: ROP_JSON=... PLAN_JSON=... HIST_JSON=dialog/data/history.json AI_JSON=dialog/data/ai-rop.json \
//         npx tsx src/scripts/b24/build-svod2.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DLG = "dialog/data/dialog.json";
const TPL = "dialog/svod2.template.html";
const OUT = process.env.OUT || "public/svod2.html";
const ROP = process.env.ROP_JSON || "/tmp/rop.json";
const HIST = process.env.HIST_JSON || "dialog/data/history.json";
const AI = process.env.AI_JSON || "dialog/data/ai-rop.json";

const noDash = (x: string) => String(x || "").replace(/\u2014/g, "-"); // em dash из названий CRM -> дефис (отображение)
const dlg = JSON.parse(readFileSync(DLG, "utf-8"));
const rop = JSON.parse(readFileSync(ROP, "utf-8"));
const hist = existsSync(HIST) ? JSON.parse(readFileSync(HIST, "utf-8")) : { days: [] };
const ai = existsSync(AI) ? JSON.parse(readFileSync(AI, "utf-8")) : null;

const sc = dlg.scoring || {};
if (!sc.managers || !sc.deals) { console.error("В dialog.json нет scoring - снимок старого движка"); process.exit(1); }

const SOLD = new Set(["C49:EXECUTING", "C49:FINAL_INVOICE", "C49:1", "C49:2", "C49:WON"]);
const isSold = (d: any) => d.won || (SOLD.has(d.stageCode) && !d.lost);
const ropGen: string = rop.generated_at || "";
const ropDay = ropGen.slice(0, 10);

const tokens = (s: string) => new Set(String(s || "").toLowerCase().split(/\s+/).filter(Boolean));
const sameName = (a: string, b: string) => { const ta = tokens(a), tb = tokens(b); if (!ta.size || !tb.size) return false; for (const t of ta) if (!tb.has(t)) return false; return ta.size === tb.size; };
const scoredCache: Record<string, string | null> = {};
const scoredName = (n: string) => { if (n in scoredCache) return scoredCache[n]; const hit = (sc.managers as any[]).find((m) => sameName(m.mgr, n)); return (scoredCache[n] = hit ? hit.mgr : null); };

// --- Когорта для воронки: сделки, созданные за последние 180 дней. Флаги достижения
// шагов - из истории стадий Битрикс24 (kp = «КП отправлено», sold = предоплата+).
const DEPTH_DAYS = 180;
const depthCut = new Date(new Date(ropGen || Date.now()).getTime() - DEPTH_DAYS * 864e5).toISOString().slice(0, 10);
const touched = (d: any) => { const s = new Set([d.stageCode]); for (const h of (d.hist || [])) s.add(h[0]); return s; };
// Дни массового переноса из старой CRM (у 05.03.2026 ~20 тыс «созданных» разом) - это не
// реальные когорты дня: исключаем дни, где созданий больше max(60, 10 медиан), с пометкой.
const createdByDay: Record<string, number> = {};
for (const d of rop.deals || []) { const c = String(d.created || "").slice(0, 10); if (c >= depthCut) createdByDay[c] = (createdByDay[c] || 0) + 1; }
const cVals = Object.values(createdByDay).sort((a, b) => a - b);
const cMed = cVals.length ? cVals[Math.floor(cVals.length / 2)] : 0;
const migDays = Object.keys(createdByDay).filter((d) => createdByDay[d] > Math.max(60, cMed * 10)).sort();
// R4 (ФЕНИКС): в когорту отдела входят только сделки 11 менеджеров разбора;
// тестовые и системные отсечены (бюджет <= 10 руб с "тест" в имени, системные владельцы)
const isTestDeal = (d: any) => (/(^|[^а-яё])тест/i.test(d.title || "") && (d.budget || 0) <= 10) || /систем|робот/i.test(d.mgr || "");
let cohortDropped = 0, cohortNoHist = 0;
const cohort: any[] = [];
for (const d of rop.deals || []) {
  const c = String(d.created || "").slice(0, 10);
  if (!c || c < depthCut || migDays.includes(c)) continue;
  const sn = scoredName(d.mgr);
  if (!sn || isTestDeal(d)) { cohortDropped++; continue; }
  if (!(d.hist || []).length) cohortNoHist++;
  const t = touched(d);
  const sold = [...SOLD].some((s) => t.has(s));
  cohort.push({ c, m: d.mgr, s: sn, tz: (t.has("C49:PREPARATION") || sold) ? 1 : 0, kp: (t.has("C49:PREPAYMENT_INVOIC") || sold) ? 1 : 0, sold: sold ? 1 : 0 });
}

// --- Мёрзнет портфель: открытые сделки по этапам, деньги старше 30 дней в этапе.
const open = (rop.deals || []).filter((d: any) => !d.won && !d.lost && !SOLD.has(d.stageCode));
const rotMap: Record<string, any[]> = {};
for (const d of open) {
  let ent = d.created;
  for (const h of (d.hist || [])) if (h[0] === d.stageCode) ent = h[1];
  const days = (new Date(ropGen).getTime() - new Date(ent).getTime()) / 864e5;
  (rotMap[d.stage] ||= []).push({ id: d.id, t: noDash(d.title).slice(0, 46), m: d.mgr, b: Math.round(d.budget || 0), days: Math.round(days) });
}
const rot = Object.entries(rotMap).map(([stage, arr]) => {
  const ds = arr.map((x) => x.days).sort((a, b) => a - b);
  const frozen = arr.filter((x) => x.days > 30 && x.b >= 10000).sort((a, b) => b.b - a.b); // мусорные бюджеты (1-21 руб) не считаем деньгами
  return { stage, n: arr.length, medD: ds[Math.floor(ds.length / 2)] || 0, frozenRub: frozen.reduce((s, x) => s + x.b, 0), frozenN: frozen.length, top: frozen.slice(0, 5) };
}).filter((r) => r.frozenRub > 0).sort((a, b) => b.frozenRub - a.frozenRub);

// --- Цикл сделки (для честного горизонта потенциала) - как в v1, по деньгам.
const histSoldDate = (d: any) => { for (const h of (d.hist || [])) if (SOLD.has(h[0])) return h[1]; return null; };
const MONTH = ropDay.slice(0, 7);
const cycBig: number[] = [], cycSmall: number[] = [];
for (const d of rop.deals || []) {
  if (!isSold(d)) continue;
  const hd = histSoldDate(d);
  if (!hd || String(hd).slice(0, 7) !== MONTH) continue;
  const days = (new Date(hd).getTime() - new Date(d.created).getTime()) / 864e5;
  if (days >= 0) ((d.budget || 0) >= 100000 ? cycBig : cycSmall).push(days);
}
const seg = (arr: number[]) => { if (arr.length < 15) return null; arr.sort((a, b) => a - b); const q = (p: number) => Math.round(arr[Math.min(arr.length - 1, Math.floor(arr.length * p))]); return { medD: q(.5), p75D: q(.75), p90D: q(.9), n: arr.length }; };
const cycle = { thr: 100000, big: seg(cycBig), small: seg(cycSmall) };

// --- Сделки недельного окна (риск/потенциал/дриллы) - как в v1.
const deals = (sc.deals as any[]).map((d) => ({
  id: d.dealId || d.leadId, lead: d.isLead ? 1 : 0, t: noDash(d.title).slice(0, 50), m: d.mgr,
  stage: d.stage, sc: d.stageCode, b: Math.round(d.budget || 0), p: d.prob,
  u: d.uKey, o: d.outcome, next: (d.next || "").slice(0, 160), sil: d.silenceD, rm: d.respMed,
}));

const DATA = {
  meta: {
    dlgFrom: dlg.from, dlgTo: dlg.to, dlgGenerated: dlg.generatedAt, ropGenerated: ropGen,
    portal: dlg.portal || "https://glassmemory.bitrix24.ru", scope: dlg.scope,
    depthDays: DEPTH_DAYS, depthCut, cycle, migDays,
    cohortDropped, cohortNoHist, rotNoHist: open.filter((d: any) => !(d.hist || []).length).length,
    aiGeneratedAt: ai ? ai.generatedAt : null, aiWindow: ai ? ai.window : null,
  },
  managers: (sc.managers as any[]).map((m) => ({ mgr: m.mgr, role: m.role, rating: m.rating, deals: m.deals, lossRub: Math.round(m.lossRub || 0), sections: m.sections })),
  queuesMeta: sc.queues, minSample: sc.minSample, calibratedAt: sc.calibratedAt,
  deals, cohort, rot, hist: hist.days || [],
  ai: ai || { mgrs: {}, dept: null, deals: {} },
};

const tpl = readFileSync(TPL, "utf-8");
const i = tpl.indexOf("const DATA=");
if (i < 0) { console.error("В шаблоне нет 'const DATA='"); process.exit(1); }
let j = tpl.indexOf("{", i), depth = 0, end = -1;
for (let k = j; k < tpl.length; k++) { const c = tpl[k]; if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { end = k; break; } } }
const out = tpl.slice(0, i) + "const DATA=" + JSON.stringify(DATA) + tpl.slice(end + 1);
writeFileSync(OUT, out);
console.log(`build-svod2: менеджеров ${DATA.managers.length}, сделок ${deals.length}, когорта ${cohort.length}, история ${DATA.hist.length} дн, ИИ-тексты ${ai ? "есть (" + (ai.generatedAt || "?") + ")" : "НЕТ"}`);
console.log(`-> ${OUT} (${(out.length / 1048576).toFixed(1)} MB)`);
