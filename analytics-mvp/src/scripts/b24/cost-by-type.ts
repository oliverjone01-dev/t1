// Себестоимость по типу изделия для сделок ОКНА (апрель-август, cat49, чек>1).
// Берём сделки и тип изделия из rop.json (снимок в этой же ветке), тянем с/с из смарт-
// процессов (Расчёт/Калькулятор/Закупка/Производство GG), матчим по id и АГРЕГИРУЕМ по
// ассортименту + по стадии (КП / предоплата). Компактный итог в stderr (строки COSTAGG),
// чтобы прочитать из лога без гигантской выгрузки. Ничего не коммитит.
// Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/cost-by-type.ts
import { readFileSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SP = [
  { etid: 1060, key: "Расчёт" }, { etid: 1056, key: "Калькулятор" },
  { etid: 1074, key: "Закупка" }, { etid: 1086, key: "Производство GG" },
] as const;
const SS_LABEL = /с\s*\/\s*с|себестоим/i;
const SS_EXCLUDE = /бюджет|наценк|прибыл|сумма налога|режим расч|комментар/i;
const SS_NUM = /^(money|double|integer|string)$/i;
const lbl = (d: any) => d.formLabel || d.listLabel || d.editFormLabel || d.title || "";
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
const KP = new Set(["C49:PREPAYMENT_INVOIC", "C49:3", "C49:UC_8JTBV2"]);
const SUCC = new Set(["C49:EXECUTING", "C49:FINAL_INVOICE", "C49:1", "C49:2", "C49:WON"]);

async function call(method: string, params: any = {}): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${BASE}/${method}.json`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params), signal: AbortSignal.timeout(30000) });
      const j: any = await res.json();
      if (j.error) { if (/QUERY_LIMIT|OPERATION_TIME_LIMIT/i.test(String(j.error))) { await sleep(1200); attempt--; continue; } throw new Error(`${method}: ${j.error_description || j.error}`); }
      return j;
    } catch (e) { lastErr = e; await sleep(600 * (attempt + 1)); }
  }
  throw lastErr;
}
async function ssFields(etid: number): Promise<string[]> {
  const fields: Record<string, any> = (await call("crm.item.fields", { entityTypeId: etid })).result?.fields || {};
  const out: string[] = [];
  for (const [id, def] of Object.entries(fields)) { const t = String(lbl(def)); if (SS_LABEL.test(t) && !SS_EXCLUDE.test(t) && SS_NUM.test(String(def.type || ""))) out.push(id); }
  return out;
}
async function itemsAll(etid: number, select: string[]): Promise<any[]> {
  const all: any[] = []; let lastId = 0;
  for (;;) { const r = (await call("crm.item.list", { entityTypeId: etid, select, filter: { ">id": lastId }, order: { id: "ASC" } })).result?.items || []; if (!r.length) break; all.push(...r); lastId = r[r.length - 1].id; if (r.length < 50) break; }
  return all;
}

(async () => {
  // окно из rop.json
  const j = JSON.parse(readFileSync("rop/data/rop.json", "utf8"));
  const D = (j.deals || j).filter((x: any) => x.created >= "2026-04-01" && x.created <= "2026-08-31" && x.budget > 1 && (KP.has(x.stageCode) || SUCC.has(x.stageCode)));
  const byId = new Map<string, any>();
  for (const x of D) byId.set(String(x.id), { assort: x.assort || "нет данных", budget: x.budget, stage: x.stageCode, ss: 0 });
  console.error(`Окно (дошли до КП, чек>1): ${D.length} сделок`);

  // с/с из СП -> на сделку окна
  for (const sp of SP) {
    const ss = await ssFields(sp.etid);
    if (!ss.length) { console.error(`СП ${sp.etid} ${sp.key}: с/с-полей нет`); continue; }
    const items = await itemsAll(sp.etid, ["id", "parentId2", ...ss]);
    let hit = 0;
    for (const it of items) { const rec = byId.get(String(it.parentId2 || "")); if (!rec) continue; rec.ss += ss.reduce((s, f) => s + num(it[f]), 0); hit++; }
    console.error(`СП ${sp.etid} ${sp.key}: полей ${ss.length}, карточек ${items.length}, попало в окно ${hit}`);
  }

  // агрегат по типу изделия
  const norm = (a: string) => /перегородк/i.test(a) ? (/душев/i.test(a) ? "Душевые перегородки" : "Лофт перегородки") : a;
  const g: Record<string, any> = {};
  let covN = 0, covBud = 0, covSS = 0;
  for (const [, r] of byId) {
    const k = norm(r.assort); const a = (g[k] = g[k] || { n: 0, ssN: 0, bud: 0, ss: 0, kpN: 0, pdN: 0 });
    a.n++; a.bud += r.budget;
    if (r.ss > 0) { a.ssN++; a.ss += r.ss; covN++; covBud += r.budget; covSS += r.ss; if (SUCC.has(r.stage)) a.pdN++; else a.kpN++; }
  }
  console.error(`ПОКРЫТИЕ: с/с заполнена у ${covN} из ${D.length} сделок (${Math.round(100 * covN / D.length)}%); их бюджет ${(covBud / 1e6).toFixed(1)} млн, с/с ${(covSS / 1e6).toFixed(1)} млн, маржа ${Math.round(100 * (1 - covSS / covBud))}%`);
  console.error("COSTAGG\tтип\tвсего_сделок\tс_сс_шт\tбюджет_сс_млн\tсс_млн\tмаржа%\tна_КП\tна_предопл");
  for (const [k, a] of Object.entries(g).sort((x: any, y: any) => y[1].ss - x[1].ss)) {
    if (!a.ssN) continue;
    console.error(`COSTAGG\t${k}\t${a.n}\t${a.ssN}\t${(a.bud / 1e6).toFixed(1)}\t${(a.ss / 1e6).toFixed(1)}\t${Math.round(100 * (1 - a.ss / a.bud))}\t${a.kpN}\t${a.pdN}`);
  }
  console.error("COSTAGG-DONE");
})();
