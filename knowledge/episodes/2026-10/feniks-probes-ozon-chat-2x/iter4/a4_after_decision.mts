// ФЕНИКС iter4 @ da0a36b. Проба A4: спидометр «Реклама за месяц» после решения 29.10.
// Недельный спидометр (main) застывал на последней неделе плана 22-28.10. Месячный идёт дальше: 29-31.10 и ноябрь,
// а план считает клик всех 10 карточек, в том числе откатанных 29.10. Сценарий: откатили 5 карточек с наименьшим
// планом (клик вернулся к уровню 01-13.10, v4_ads.py), 5 оставленных тратят 150% своего плана.
// npx tsx a4_after_decision.mts
import { readFileSync } from "node:fs";
const SP = "/tmp/claude-0/-home-user-t1/67620a7f-7583-5c98-9212-3a5e79611236/scratchpad/";
const { adsMonthWindow } = await import(SP + "tree_da0a36b/analytics-mvp/src/scripts/plan-tab.ts");
const P = JSON.parse(readFileSync(SP + "data_753bf11/analytics-mvp/data/plan_2026-10-15_v3.json", "utf-8"));
for (const d of ["2026-10-28", "2026-10-29", "2026-10-31", "2026-11-01", "2026-11-03"]) console.log("последний полный день рекламы", d, "->", JSON.stringify(adsMonthWindow(d, P.start)));
// факт 01-13.10 по клику главного (v4_ads.py), в неделю
const pre: Record<string, number> = { "TRUBIS 160": 33636, KONUX: 55697, KUVINO: 37095, EVELIX: 3001, GENTRIS: 0, OSOLIS: 3698, "TRUBIS L120": 0, OZEVIS: 0, ARFEO: 0, ARKIS: 4708 };
const wk = P.cards.map((c: any) => ({ s: c.short, plan: c.click_new + c.n_min * P.min_budget_sku, old: (pre[c.short] ?? 0) / 13 * 7 }));
const sorted = [...wk].sort((a, b) => a.plan - b.plan); const back = new Set(sorted.slice(0, 5).map((x) => x.s));
const plan = wk.reduce((a: number, x: any) => a + x.plan, 0);
const fact = wk.reduce((a: number, x: any) => a + (back.has(x.s) ? x.old : 1.5 * x.plan), 0);
const keptPlan = wk.filter((x: any) => !back.has(x.s)).reduce((a: number, x: any) => a + x.plan, 0);
const keptFact = wk.filter((x: any) => !back.has(x.s)).reduce((a: number, x: any) => a + 1.5 * x.plan, 0);
console.log("откат:", [...back].join(", "));
console.log(`неделя после 29.10: план спидометра ${Math.round(plan)} (все 10), факт ${Math.round(fact)} -> ${Math.round(fact / plan * 100)}% (${fact / plan * 100 > 120 ? "перерасход" : fact / plan * 100 > 100 ? "выше плана" : "в плане"})`);
console.log(`по оставленным 5: план ${Math.round(keptPlan)}, факт ${Math.round(keptFact)} -> ${Math.round(keptFact / keptPlan * 100)}% (перерасход)`);
