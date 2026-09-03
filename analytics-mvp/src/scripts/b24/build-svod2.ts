// СВОД v2 - сборка сводного дашборда качества ОП (песочница /dialog-experiments/).
// Отличия от v1: воронка-конверсии вместо «Продано/План», свечи по 14+ дням истории,
// период пересчитывает ВСЕ блоки (состояние берётся из снимка на конец периода),
// «Мёрзнет портфель», ИИ-РОП срезы (тексты подаются готовым файлом AI_JSON - сборка
// НИЧЕГО не сочиняет, только раскладывает).
// Запуск: ROP_JSON=... PLAN_JSON=... HIST_JSON=dialog/data/history.json AI_JSON=dialog/data/ai-rop.json \
//         npx tsx src/scripts/b24/build-svod2.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { kuratorAudit } from "./pamyatka-rules";

const DLG = "dialog/data/dialog.json";
const TPL = "dialog/svod2.template.html";
const OUT = process.env.OUT || "public/svod2.html";
const ROP = process.env.ROP_JSON || "/tmp/rop.json";
const HIST = process.env.HIST_JSON || "dialog/data/history.json";
const AI = process.env.AI_JSON || "dialog/data/ai-rop.json";
const PHR = process.env.PHRASES_JSON || "dialog/data/phrases.json";

const noDash = (x: string) => String(x || "").replace(/\u2014/g, "-"); // em dash из названий CRM -> дефис (отображение)
const dlg = JSON.parse(readFileSync(DLG, "utf-8"));
const rop = JSON.parse(readFileSync(ROP, "utf-8"));
const hist = existsSync(HIST) ? JSON.parse(readFileSync(HIST, "utf-8")) : { days: [] };
const ai = existsSync(AI) ? JSON.parse(readFileSync(AI, "utf-8")) : null;
const phrases = existsSync(PHR) ? JSON.parse(readFileSync(PHR, "utf-8")) : { phrases: [] };

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
  // ФАЗА 0 (аудит СПАРТАК/ФЕНИКС): флаги стадий ЧЕСТНЫЕ и независимые - без "|| sold".
  // Продажа, оформленная мимо стадии, стадию НЕ засчитывает: это отдельный сигнал
  // дисциплины воронки (mk = продана мимо «КП отправлено»).
  const kp = t.has("C49:PREPAYMENT_INVOIC") ? 1 : 0;
  cohort.push({ c, m: d.mgr, s: sn, tz: t.has("C49:PREPARATION") ? 1 : 0, kp, dec: t.has("C49:3") ? 1 : 0, sold: sold ? 1 : 0, mk: (sold && !kp) ? 1 : 0 });
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

// ===== ФИЧА 1: «Долг по ответам» - из журнала событий недельного окна =====
// Пары «клиент написал -> мы ответили» + текущий непогашенный долг. Проверено на
// аудите СПАРТАКА: 486 пар, обрыв ответа клиента после суток (79% -> 56% по пересчёту ФЕНИКСА 03.09).
const evAll = (dlg.events || []).filter((e: any) => e.ts && (e.dir === "входящее" || e.dir === "исходящее") && (e.dealId || e.leadId)).sort((a: any, b: any) => a.ts - b.ts);
const evByObj: Record<string, any[]> = {};
for (const e of evAll) { const k = (e.dealId ? "d" : "l") + (e.dealId || e.leadId); (evByObj[k] ||= []).push(e); }
const scByKey: Record<string, any> = {};
for (const d of (sc.deals as any[])) scByKey[(d.isLead ? "l" : "d") + d.dealId] = d;
const NOWTS = new Date(dlg.to).getTime();
const debt: any[] = [];
for (const [k, list] of Object.entries(evByObj)) {
  const d = scByKey[k]; if (!d || d.outcome !== "open") continue;
  let lastIn: any = null, lastOut: any = null;
  for (const e of list) { if (e.dir === "входящее") lastIn = e; else lastOut = e; }
  if (lastIn && (!lastOut || lastOut.ts < lastIn.ts))
    debt.push({ id: d.dealId || d.leadId, lead: d.isLead ? 1 : 0, m: d.mgr, b: Math.round(d.budget || 0), t: noDash(d.title).slice(0, 42), ageH: Math.round((NOWTS - lastIn.ts) / 36e5), u: d.uKey, next: String(d.next || "").slice(0, 140) });
}
debt.sort((a, b) => b.b - a.b);
const pairs: { day: string; respMin: number; back: number }[] = [];
for (const list of Object.values(evByObj)) {
  for (let i = 0; i < list.length; i++) {
    if (list[i].dir !== "входящее") continue;
    let j = i + 1; while (j < list.length && list[j].dir === "входящее") j++;
    if (j >= list.length) continue;
    const respMin = (list[j].ts - list[i].ts) / 6e4;
    if (respMin < 0) continue;
    let back = 0; for (let m2 = j + 1; m2 < list.length; m2++) if (list[m2].dir === "входящее" && (list[m2].ts - list[j].ts) <= 72 * 36e5) { back = 1; break; }
    pairs.push({ day: new Date(list[j].ts).toISOString().slice(0, 10), respMin: Math.round(respMin), back });
    i = j - 1;
  }
}
const rDays = [...new Set(pairs.map((p2) => p2.day))].sort();
const replyLine = rDays.map((day) => { const pp = pairs.filter((p2) => p2.day === day); return { day, n: pp.length, back: pp.filter((p2) => p2.back).length }; });
const over24 = pairs.filter((p2) => p2.respMin > 1440);
const replyStats = { pairs: pairs.length, back: pairs.filter((p2) => p2.back).length, deptPct: pairs.length ? Math.round(100 * pairs.filter((p2) => p2.back).length / pairs.length) : 0, over24: over24.length, over24back: over24.filter((p2) => p2.back).length };

// ===== ФИЧА 2: труба и дожим по менеджерам (Wilson 95%) =====
const wilson = (k2: number, n2: number): [number, number] => { if (!n2) return [0, 0]; const pr = k2 / n2, z = 1.96, z2 = z * z, den = 1 + z2 / n2; const c2 = (pr + z2 / (2 * n2)) / den, mrg = z * Math.sqrt((pr * (1 - pr) + z2 / (4 * n2)) / n2) / den; return [Math.max(0, c2 - mrg), Math.min(1, c2 + mrg)]; };
const pipeF = { created: cohort.length, tz: 0, kp: 0, dec: 0, sold: 0, mk: 0 };
for (const c2 of cohort) { pipeF.tz += c2.tz; pipeF.kp += c2.kp; pipeF.dec += c2.dec; pipeF.sold += c2.sold; pipeF.mk += c2.mk; }
const pipeByM: Record<string, { kp: number; sold: number; mk: number }> = {};
for (const c2 of cohort) { (pipeByM[c2.s] ||= { kp: 0, sold: 0, mk: 0 }); pipeByM[c2.s].kp += c2.kp; if (c2.sold && c2.kp) pipeByM[c2.s].sold++; pipeByM[c2.s].mk += c2.mk; }
const deptPipe = { kp: 0, sold: 0 };
for (const v of Object.values(pipeByM)) { deptPipe.kp += v.kp; deptPipe.sold += v.sold; }
const [dplo, dphi] = wilson(deptPipe.sold, deptPipe.kp);
const mrows = Object.entries(pipeByM).filter(([, v]) => v.kp >= 20).map(([m2, v]) => { const [lo, hi] = wilson(v.sold, v.kp); return { m: m2, kp: v.kp, sold: v.sold, cr: Math.round(1000 * v.sold / v.kp) / 10, lo: Math.round(lo * 1000) / 10, hi: Math.round(hi * 1000) / 10, mk: v.mk }; }).sort((a, b) => b.cr - a.cr);

// ===== ФИЧА 3: стык лид -> сделка (честный режим: полного слоя лидов в снимке НЕТ) =====
const leadIds = new Set<string>(); for (const e of evAll) if (e.leadId && !e.dealId) leadIds.add(String(e.leadId));
const stik = { leads: dlg.leadCount || 0, seen: leadIds.size, note: "по остальным лидам снимок не выгружает ни владельца, ни статуса - подключение полного слоя лидов = задача фетчера (фаза 2)" };

// ===== КУРАТОР ПО ПАМЯТКЕ v2.3 (согласовано Иваном 03.09: отдел видит всех) =====
// Правила и точность живут в pamyatka-rules.ts - ЕДИНЫЙ код с ночными фактами
// (урок ФЕНИКС D1/D7: страница и досье обязаны считаться одним кодом).
const kurator = kuratorAudit(dlg, (k) => scByKey[k] || null, noDash);

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
  debt, replyLine, replyStats, phrases: phrases.phrases || [], pipe: { F: pipeF, mrows, dept: { ...deptPipe, cr: deptPipe.kp ? Math.round(1000 * deptPipe.sold / deptPipe.kp) / 10 : 0, lo: Math.round(dplo * 1000) / 10, hi: Math.round(dphi * 1000) / 10 } }, stik, kurator,
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
