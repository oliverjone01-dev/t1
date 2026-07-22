// Прямой коннектор Bitrix24 (read-only) -> economics/data/economics.json для дашборда
// ЭКОНОМИКА СДЕЛОК. По каждой сделке воронки «GG Заказы РФ» (CATEGORY_ID=49): бюджет
// (выручка портфеля) + себестоимость из смарт-процессов Расчёт(1060)/Калькулятор(1056)/
// Закупка(1074)/Производство GG(1086). Логика с/с - как в money-appsscript.gs (задача Богдана):
// поля с/с находятся по названию (включая текстовые поля стекла в Закупке), а двойной счёт
// в Калькуляторе гасится SS_PICK (берём только «РАСЧЕТ С/С ИТОГО»).
//
// Сеть нужна к glassmemory.bitrix24.ru -> бежит в GitHub Actions (economics-cron.yml).
// Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/fetch-economics.ts

import { writeFileSync, mkdirSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL в окружении"); process.exit(1); }
const OUT = "economics/data/economics.json";
const ONLY_CATEGORY = 49; // воронка «GG Заказы РФ»
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Смарт-процессы с себестоимостью. Порядок = порядок столбцов в дашборде.
const SP = [
  { etid: 1060, key: "Расчёт" },
  { etid: 1056, key: "Калькулятор" },
  { etid: 1074, key: "Закупка" },
  { etid: 1086, key: "Производство GG" },
] as const;

const SS_LABEL = /с\s*\/\s*с|себестоим/i;
const SS_EXCLUDE = /бюджет|наценк|прибыл|сумма налога|режим расч|комментар/i;
const SS_TYPES = /^(money|double|integer|string)$/i;
// Какие поля брать в конкретном СП (гасит двойной счёт). Пусто -> все поля с/с этого СП.
const SS_PICK: Record<number, string[]> = {
  1056: ["с/с итого"], // Калькулятор: только «РАСЧЕТ С/С ИТОГО»
};

const lbl = (d: any) => d.formLabel || d.listLabel || d.editFormLabel || d.title || "";
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
const d10 = (s?: string) => (s ? String(s).slice(0, 10) : null);

async function call(method: string, params: any = {}): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${BASE}/${method}.json`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params), signal: AbortSignal.timeout(30000),
      });
      const j: any = await res.json();
      if (j.error) {
        if (/QUERY_LIMIT|OPERATION_TIME_LIMIT/i.test(String(j.error))) { await sleep(1200); attempt--; continue; }
        throw new Error(`${method}: ${j.error_description || j.error}`);
      }
      return j;
    } catch (e) { lastErr = e; await sleep(600 * (attempt + 1)); }
  }
  throw lastErr;
}

// Поля-себестоимость СП (по названию+типу, с учётом SS_PICK).
async function ssFields(etid: number): Promise<string[]> {
  const fields: Record<string, any> = (await call("crm.item.fields", { entityTypeId: etid })).result?.fields || {};
  const pick = SS_PICK[etid];
  const out: string[] = [];
  for (const [id, def] of Object.entries(fields)) {
    const t = String(lbl(def)).trim(), type = String((def as any).type || "");
    if (!SS_TYPES.test(type)) continue;
    if (pick) {
      const lo = t.toLowerCase();
      if (pick.some((p) => lo.indexOf(p.toLowerCase()) >= 0)) out.push(id);
    } else if (SS_LABEL.test(t) && !SS_EXCLUDE.test(t)) out.push(id);
  }
  return out;
}

// Все карточки СП (пагинация по id).
async function itemsAll(etid: number, select: string[]): Promise<any[]> {
  const all: any[] = []; let lastId = 0;
  for (;;) {
    const j = await call("crm.item.list", { entityTypeId: etid, select, filter: { ">id": lastId }, order: { id: "ASC" }, start: -1 });
    const batch: any[] = (j.result && j.result.items) || [];
    if (!batch.length) break;
    all.push(...batch);
    lastId = Number(batch[batch.length - 1].id);
    if (batch.length < 50) break;
  }
  return all;
}

async function pageAll(method: string, params: any): Promise<any[]> {
  const all: any[] = []; let start = 0;
  for (;;) {
    const j = await call(method, { ...params, start });
    const batch: any[] = j.result || [];
    all.push(...batch);
    if (j.next === undefined || !batch.length) break;
    start = j.next;
  }
  return all;
}

async function main() {
  console.log(`Bitrix -> ${OUT} (воронка ${ONLY_CATEGORY})`);

  // Справочники: пользователи, воронки, стадии сделок.
  const users = await pageAll("user.get", {});
  const userName: Record<string, string> = {};
  for (const u of users) userName[String(u.ID)] = `${u.LAST_NAME || ""} ${u.NAME || ""}`.trim() || `id${u.ID}`;
  const cats: any[] = (await call("crm.category.list", { entityTypeId: 2 })).result?.categories || [];
  const catName: Record<string, string> = { "0": "Общая" };
  for (const c of cats) catName[String(c.id)] = c.name;
  const stages = await pageAll("crm.status.list", { filter: {} });
  const stageName: Record<string, string> = {};
  for (const s of stages) stageName[s.STATUS_ID] = s.NAME;
  console.log(`Справочники: пользователей ${users.length}, воронок ${cats.length}`);

  // По каждому СП: с/с-поля -> сумма с/с на сделку (parentId2).
  const bySs: Record<string, Record<string, number>> = {}; // dealId -> {spKey: сумма}
  for (const sp of SP) {
    const ss = await ssFields(sp.etid);
    console.log(`СП ${sp.etid} «${sp.key}»: с/с-поля = ${ss.join(", ") || "нет"}`);
    if (!ss.length) continue;
    const items = await itemsAll(sp.etid, ["id", "parentId2", ...ss]);
    for (const it of items) {
      const d = String(it.parentId2 || ""); if (!d) continue;
      const rec = (bySs[d] ||= {});
      const s = ss.reduce((x, f) => x + num(it[f]), 0);
      rec[sp.key] = (rec[sp.key] || 0) + s;
    }
    console.log(`  карточек ${items.length}`);
  }

  // Сделки: бюджет/название/стадия/ответственный/даты (только по сделкам с деньгами из СП).
  const ids = Object.keys(bySs);
  const info: Record<string, any> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const dl: any[] = (await call("crm.deal.list", { filter: { "@ID": chunk }, select: ["ID", "TITLE", "OPPORTUNITY", "ASSIGNED_BY_ID", "CATEGORY_ID", "STAGE_ID", "DATE_CREATE", "CLOSEDATE", "CLOSED"], start: -1 })).result || [];
    for (const d of dl) info[String(d.ID)] = d;
  }

  const deals = ids.map((id) => {
    const nf = info[id] || {};
    if (ONLY_CATEGORY != null && String(nf.CATEGORY_ID) !== String(ONLY_CATEGORY)) return null;
    const ss: Record<string, number> = {};
    let ssTotal = 0;
    for (const sp of SP) { const v = Math.round((bySs[id][sp.key] || 0)); ss[sp.key] = v; ssTotal += v; }
    const budget = Math.round(num(nf.OPPORTUNITY));
    if (!budget && !ssTotal) return null;
    return {
      id: Number(id), title: nf.TITLE || "",
      mgr: userName[String(nf.ASSIGNED_BY_ID)] || null,
      funnel: catName[String(nf.CATEGORY_ID)] || null,
      stage: stageName[nf.STAGE_ID] || nf.STAGE_ID || null,
      budget, ss, ssTotal, margin: budget - ssTotal,
      created: d10(nf.DATE_CREATE), closed: d10(nf.CLOSEDATE),
      isClosed: nf.CLOSED === "Y",
    };
  }).filter(Boolean) as any[];

  deals.sort((a, b) => b.id - a.id);
  const out = {
    generated_at: new Date().toISOString(),
    category: ONLY_CATEGORY,
    funnelName: catName[String(ONLY_CATEGORY)] || `воронка ${ONLY_CATEGORY}`,
    sp: SP.map((s) => ({ key: s.key, etid: s.etid })),
    deals,
  };
  mkdirSync("economics/data", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  const sumB = deals.reduce((a, d) => a + d.budget, 0), sumS = deals.reduce((a, d) => a + d.ssTotal, 0);
  console.log(`Готово: ${deals.length} сделок, бюджет ${sumB.toLocaleString("ru")} ₽, с/с ${sumS.toLocaleString("ru")} ₽, маржа ${(sumB - sumS).toLocaleString("ru")} ₽`);
}

main().catch((e) => { console.error(e); process.exit(1); });
