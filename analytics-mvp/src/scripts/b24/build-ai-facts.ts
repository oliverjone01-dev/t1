// Факты для ночной генерации ИИ-РОП текстов: досье менеджеров + факты отдела +
// топ-сделки очередей. ЕДИНЫЙ код когорты со страницей (build-svod2.ts) - уроки
// ФЕНИКС-аудитов D1/D7: страница, досье и dept-факты обязаны считаться одним кодом.
// Выход двумя файлами под валидатор validate-ai-rop.mjs: SHEETS_OUT и ARGS_OUT.
// Запуск: ROP_JSON=... HIST_JSON=... SHEETS_OUT=... ARGS_OUT=... npx tsx src/scripts/b24/build-ai-facts.ts
import { readFileSync, writeFileSync } from "node:fs";

const DLG = process.env.DLG_JSON || "dialog/data/dialog.json";
const ROP = process.env.ROP_JSON || "/tmp/rop.json";
const HIST = process.env.HIST_JSON || "dialog/data/history.json";
const SHEETS_OUT = process.env.SHEETS_OUT || "/tmp/mgr-sheets.json";
const ARGS_OUT = process.env.ARGS_OUT || "/tmp/ai-args.json";

const dlg = JSON.parse(readFileSync(DLG, "utf-8"));
const rop = JSON.parse(readFileSync(ROP, "utf-8"));
const hist = JSON.parse(readFileSync(HIST, "utf-8")).days || [];
const sc = dlg.scoring || {};
if (!sc.managers || !sc.deals) { console.error("dialog.json без scoring"); process.exit(1); }

const SOLD = new Set(["C49:EXECUTING", "C49:FINAL_INVOICE", "C49:1", "C49:2", "C49:WON"]);
const tokens = (s: string) => new Set(String(s || "").toLowerCase().split(/\s+/).filter(Boolean));
const sameName = (a: string, b: string) => { const ta = tokens(a), tb = tokens(b); if (!ta.size || !tb.size) return false; for (const t of ta) if (!tb.has(t)) return false; return ta.size === tb.size; };
const isTestDeal = (d: any) => (/(^|[^а-яё])тест/i.test(d.title || "") && (d.budget || 0) <= 10) || /систем|робот/i.test(d.mgr || "");
const touched = (d: any) => { const s = new Set([d.stageCode]); for (const h of (d.hist || [])) s.add(h[0]); return s; };
// ФАЗА 0: флаги стадий честные, без "|| sold"; mk = продажи мимо стадии КП (дисциплина воронки)
const funnel = (set: any[]) => { const f = { created: set.length, tz: 0, kp: 0, sold: 0, mk: 0 }; for (const d of set) { const t = touched(d); const sold = [...SOLD].some((s) => t.has(s)); const kp = t.has("C49:PREPAYMENT_INVOIC"); if (sold) f.sold++; if (t.has("C49:PREPARATION")) f.tz++; if (kp) f.kp++; if (sold && !kp) f.mk++; } return f; };
const firstPaid = (d: any) => { for (const h of (d.hist || [])) if (SOLD.has(h[0])) return String(h[1]).slice(0, 10); return null; };

const scMgrs = (sc.managers as any[]).map((m) => m.mgr);
const inDept = (d: any) => scMgrs.some((s) => sameName(s, d.mgr)) && !isTestDeal(d);
const W0 = String(dlg.from).slice(0, 10), W1 = String(dlg.to).slice(0, 10);
const winLbl = (s: string) => s.slice(8, 10) + "." + s.slice(5, 7);
const MONTH = W1.slice(0, 7);

// продажи недели: первый вход в оплатную стадию внутри окна (метрика v2, зафиксирована аудитом)
const wk: Record<string, { n: number; rub: number }> = {};
for (const d of rop.deals || []) {
  const fp = firstPaid(d);
  if (!fp || fp < W0 || fp > W1) continue;
  (wk[d.mgr] ||= { n: 0, rub: 0 }); wk[d.mgr].n++; wk[d.mgr].rub += d.budget || 0;
}
const wkFor = (name: string) => { const k = Object.keys(wk).find((x) => sameName(x, name)); return k ? wk[k] : { n: 0, rub: 0 }; };

const augDeals = (rop.deals || []).filter((d: any) => String(d.created || "").slice(0, 7) === MONTH && inDept(d));
const wkDeals = (rop.deals || []).filter((d: any) => { const c = String(d.created || "").slice(0, 10); return c >= W0 && c <= W1 && inDept(d); });

const BADQ = ["waiting", "ready", "silent", "nostep", "nopush", "fakedone", "internal", "overdue", "promise", "refuse", "objection", "lowprob"];
const sheets: Record<string, any> = {};
for (const m of (sc.managers as any[])) {
  const my = (sc.deals as any[]).filter((d) => d.mgr === m.mgr);
  const bad = my.filter((d) => d.outcome === "open" && BADQ.includes(d.uKey)).sort((a, b) => (b.budget || 0) - (a.budget || 0));
  const traj = hist.filter((h: any) => h.mgrs[m.mgr]).map((h: any) => ({ d: h.day, r: h.mgrs[m.mgr].rating, loss: h.mgrs[m.mgr].lossRub }));
  const w = wkFor(m.mgr);
  sheets[m.mgr] = {
    role: m.role, rating: m.rating, deals: m.deals, lossRub: Math.round(m.lossRub || 0), lossPerDeal: Math.round(m.lossPerDeal || 0),
    sections: (m.sections || []).map((s: any) => ({ label: s.label, pos: s.pos, bad: s.bad, n: s.n })),
    traj, funnelAug: funnel(augDeals.filter((d: any) => sameName(d.mgr, m.mgr))),
    wonWeek: w.n, wonWeekRub: Math.round(w.rub),
    badDeals: bad.slice(0, 6).map((d) => ({ id: d.dealId || d.leadId, title: String(d.title || "").slice(0, 50), budget: Math.round(d.budget || 0), stage: d.stage, uKey: d.uKey, silenceD: d.silenceD, next: String(d.next || "").slice(0, 160), prob: d.prob })),
    okDeals: my.filter((d) => d.uKey === "ok").length,
  };
}

// границы недель по дневной истории (только дни с очередями)
const qdays = hist.filter((h: any) => h.hasQ);
const dayAt = (target: string) => { let best: any = null; for (const h of qdays) if (h.day <= target) best = h; return best || qdays[0]; };
const b0 = dayAt(W0), b1 = dayAt(W1);
const med = (arr: number[]) => { const a = arr.filter((x) => x != null).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const rMed = (h: any) => med(Object.values(h?.mgrs || {}).map((m: any) => m.rating));
const qb = (k: string) => ({ from: b0?.queues[k]?.n ?? 0, to: b1?.queues[k]?.n ?? 0, moneyTo: Math.round(b1?.queues[k]?.money ?? 0) });

// заморозка - тем же правилом, что страница (>30 дн, бюджет от 10 тыс)
const open = (rop.deals || []).filter((d: any) => !d.won && !d.lost && !SOLD.has(d.stageCode));
const rotMap: Record<string, number> = {};
for (const d of open) {
  let ent = d.created; for (const h of (d.hist || [])) if (h[0] === d.stageCode) ent = h[1];
  const days = (new Date(rop.generated_at).getTime() - new Date(ent).getTime()) / 864e5;
  if (days > 30 && (d.budget || 0) >= 10000) rotMap[d.stage] = (rotMap[d.stage] || 0) + Math.round(d.budget);
}
const frozen = Object.entries(rotMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

const crRows = Object.entries(sheets).filter(([, s]: any) => s.funnelAug.created >= 10)
  .map(([n, s]: any) => [n, Math.round(100 * s.funnelAug.sold / s.funnelAug.created)] as [string, number])
  .sort((a, b) => b[1] - a[1]);

const byMgr: Record<string, any> = {};
for (const [name, s] of Object.entries(sheets)) if ((s as any).wonWeek > 0) byMgr[name] = { n: (s as any).wonWeek, rub: (s as any).wonWeekRub };
const dept = {
  win: [winLbl(W0) + "." + W0.slice(0, 4), winLbl(W1) + "." + W1.slice(0, 4)],
  weekSales: {
    def: "продажа недели = ПЕРВЫЙ вход сделки менеджера отдела в оплатную стадию внутри окна, по истории стадий Битрикс24",
    total: { n: Object.values(byMgr).reduce((a: number, x: any) => a + x.n, 0), rub: Object.values(byMgr).reduce((a: number, x: any) => a + x.rub, 0) },
    byMgr,
  },
  deptRatingMedian: { [winLbl(W0)]: rMed(b0), [winLbl(W1)]: rMed(b1), note: (rMed(b1) ?? 0) >= (rMed(b0) ?? 0) ? "отдел вырос или ровно" : "отдел просел" },
  queuesBorders: { waiting: qb("waiting"), silent: qb("silent"), nopush: qb("nopush"), fakedone: qb("fakedone") },
  weekCohortFunnel: { note: "когорта сделок отдела, созданных в окно, тем же кодом что страница", ...funnel(wkDeals) },
  augustFunnel: { note: "когорта месяца: только менеджеры отдела, тесты/системные исключены (единый код со страницей)", ...funnel(augDeals) },
  frozen, bestCR: crRows[0] ? [crRows[0][0], crRows[0][1] + "% когорты месяца"] : null,
};

const OUq = (sc.deals as any[]).filter((d) => d.outcome === "open");
const topDeals: Record<string, any[]> = {};
for (const k of BADQ) {
  const arr = OUq.filter((d) => d.uKey === k && (d.budget || 0) > 0).sort((a, b) => b.budget - a.budget).slice(0, 3);
  if (arr.length) topDeals[k] = arr.map((d) => ({ id: d.dealId || d.leadId, title: String(d.title || "").slice(0, 50), mgr: d.mgr, budget: Math.round(d.budget), stage: d.stage, silenceD: d.silenceD, respMed: d.respMed, next: String(d.next || "").slice(0, 180), prob: d.prob }));
}

writeFileSync(SHEETS_OUT, JSON.stringify(sheets));
writeFileSync(ARGS_OUT, JSON.stringify({ dept, topDeals, window: winLbl(W0) + " - " + winLbl(W1) }));
console.log(`build-ai-facts: досье ${Object.keys(sheets).length}, неделя ${dept.win[0]}-${dept.win[1]}, продажи недели ${dept.weekSales.total.n}/${dept.weekSales.total.rub}, август ${dept.augustFunnel.created}/${dept.augustFunnel.sold}`);
