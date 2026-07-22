// Прямой коннектор Bitrix24 (read-only) -> economics/data/economics.json для дашборда
// ЭКОНОМИКА СДЕЛОК. По сделкам воронки «GG Заказы РФ» (CATEGORY_ID=49) за последние
// ECON_WINDOW_DAYS дней (по умолчанию 60): бюджет (КП) + оценка Калькулятора + факт-себестоимость
// по слоям: Расчёт (металл, комплектующие), Закупка (стекло), Производство (сборка/покраска).
// Калькулятор в сумму факта НЕ входит - это оценка менеджера, по которой выставлен КП, её
// сравниваем с фактом по материалам. Плюс товары сделки с количеством.
//
// с/с-поля классифицируются ПО НАЗВАНИЮ (структура полей в Bitrix «грязная» - дубли, поля
// «удалить»), поэтому маппинг переживает переименования. Точный состав факта уточняется с ПТО.
//
// Сеть к glassmemory.bitrix24.ru -> бежит в GitHub Actions (economics-cron.yml).
// Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/fetch-economics.ts

import { writeFileSync, mkdirSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL в окружении"); process.exit(1); }
const OUT = "economics/data/economics.json";
const ONLY_CATEGORY = 49;
const WINDOW_DAYS = Number(process.env.ECON_WINDOW_DAYS || 60);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Роль каждого СП в факт-себестоимости: какие материалы он поставляет (по модели Богдана).
// Калькулятор - отдельно (оценка, все материалы для сравнения). Металл/комплектующие берём из
// Расчёта, стекло - из Закупки, работу/сборку - из Производства.
const SP = [
  { etid: 1060, key: "Расчёт", layer: ["metal", "kompl"] },
  { etid: 1074, key: "Закупка", layer: ["glass"] },
  { etid: 1086, key: "Производство GG", layer: ["work"] },
  { etid: 1056, key: "Калькулятор", layer: [] }, // оценка: total + разбивка для сравнения
] as const;

// Классификация с/с-поля по названию в материал.
const MAT: Record<string, RegExp> = {
  glass: /стекл|зеркал/i,
  metal: /металл|сталь|алюмин/i,
  kompl: /фурнитур|комплект|дерев|профил/i,
  work: /раскрой|сварк|зачист|нарезк|трубогиб|листогиб|покрас|токарн|слесар|гибк|сверл|зинковк|производствен|работ/i,
};
// «денежное» с/с-поле: тип money/double/integer/string и название про с/с или материал/работу.
const SS_HINT = /с\s*\/\s*с|себестоим|стоим|раскрой|сварк|зачист|нарезк|трубогиб|листогиб|покрас|токарн|слесар|гибк|сверл|зинковк|металл|сталь|алюмин|стекл|зеркал|фурнитур|дерев|профил/i;
const SS_EXCL = /бюджет|наценк|прибыл|сумма налога|режим расч|комментар|номер|заказ|дата|срок|описан|коммент/i;
const SS_TYPES = /^(money|double|integer|string)$/i;
// Итоговое поле работы в Производстве (чтобы не суммировать операции поверх итога).
const WORK_ITOGO = /себестоимость производственная/i;
// Итог Калькулятора (гасит двойной счёт «ПЦ С/С за объём/1шт»).
const CALC_ITOGO = /с\s*\/\s*с\s*итог/i;

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

// Поля СП: классифицируем денежные с/с-поля по материалам + отдельно итоги (work/calc).
async function spFieldMap(etid: number) {
  const fields: Record<string, any> = (await call("crm.item.fields", { entityTypeId: etid })).result?.fields || {};
  const byMat: Record<string, string[]> = { metal: [], glass: [], kompl: [], work: [] };
  let workItogo: string | null = null, calcItogo: string | null = null;
  const all: string[] = [];
  for (const [id, def] of Object.entries(fields)) {
    const t = String(lbl(def)).trim(), type = String((def as any).type || "");
    if (!SS_TYPES.test(type)) continue;
    if (!SS_HINT.test(t) || SS_EXCL.test(t)) continue;
    if (WORK_ITOGO.test(t)) workItogo = id;
    if (CALC_ITOGO.test(t)) calcItogo = id;
    for (const m of Object.keys(MAT)) if (MAT[m].test(t)) { byMat[m].push(id); all.push(id); break; }
  }
  return { byMat, workItogo, calcItogo, all: [...new Set(all.concat(workItogo || [], calcItogo || []).filter(Boolean) as string[])] };
}

async function itemsAll(etid: number, select: string[]): Promise<any[]> {
  const all: any[] = []; let lastId = 0;
  for (;;) {
    const j = await call("crm.item.list", { entityTypeId: etid, select, filter: { ">id": lastId }, order: { id: "ASC" }, start: -1 });
    const batch: any[] = (j.result && j.result.items) || [];
    if (!batch.length) break;
    all.push(...batch); lastId = Number(batch[batch.length - 1].id);
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
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  console.log(`Bitrix -> ${OUT} (воронка ${ONLY_CATEGORY}, сделки с ${cutoff})`);

  const users = await pageAll("user.get", {});
  const userName: Record<string, string> = {};
  for (const u of users) userName[String(u.ID)] = `${u.LAST_NAME || ""} ${u.NAME || ""}`.trim() || `id${u.ID}`;
  const stages = await pageAll("crm.status.list", { filter: {} });
  const stageName: Record<string, string> = {};
  for (const s of stages) stageName[s.STATUS_ID] = s.NAME;

  // 1) Сделки воронки 49 за окно (по дате создания). Это опорный список.
  const dealRows: any[] = await pageAll("crm.deal.list", {
    filter: { CATEGORY_ID: ONLY_CATEGORY, ">=DATE_CREATE": cutoff },
    select: ["ID", "TITLE", "OPPORTUNITY", "ASSIGNED_BY_ID", "STAGE_ID", "DATE_CREATE", "CLOSEDATE", "CLOSED"],
    order: { ID: "DESC" },
  });
  const deal: Record<string, any> = {};
  for (const d of dealRows) deal[String(d.ID)] = {
    id: Number(d.ID), title: d.TITLE || "", mgr: userName[String(d.ASSIGNED_BY_ID)] || null,
    stage: stageName[d.STAGE_ID] || d.STAGE_ID || null, budget: Math.round(num(d.OPPORTUNITY)),
    created: d10(d.DATE_CREATE), closed: d10(d.CLOSEDATE), isClosed: d.CLOSED === "Y", kpVia: new Set<string>(),
    calc: { total: 0, metal: 0, glass: 0, kompl: 0, work: 0 },
    raschet: { total: 0, metal: 0, kompl: 0 }, zakupka: { glass: 0 }, prod: { fact: 0 }, products: [] as any[],
  };
  const inWindow = new Set(Object.keys(deal));
  console.log(`Сделок воронки ${ONLY_CATEGORY} за ${WINDOW_DAYS} дн: ${inWindow.size}`);

  // 2) По каждому СП: с/с-поля -> вклад в слои факта (или оценку Калькулятора) на сделку.
  for (const sp of SP) {
    const fm = await spFieldMap(sp.etid);
    if (!fm.all.length) { console.log(`СП ${sp.etid} «${sp.key}»: денежных с/с-полей не найдено`); continue; }
    const items = await itemsAll(sp.etid, ["id", "parentId2", ...fm.all]);
    let touched = 0;
    for (const it of items) {
      const did = String(it.parentId2 || ""); if (!did || !inWindow.has(did)) continue;
      const rec = deal[did]; touched++;
      const sumMat = (m: string) => (fm.byMat[m] || []).reduce((s, f) => s + num(it[f]), 0);
      if (sp.key === "Калькулятор") {
        rec.kpVia.add("Калькулятор");
        rec.calc.total += fm.calcItogo ? num(it[fm.calcItogo]) : (sumMat("metal") + sumMat("glass") + sumMat("kompl") + sumMat("work"));
        rec.calc.metal += sumMat("metal"); rec.calc.glass += sumMat("glass"); rec.calc.kompl += sumMat("kompl"); rec.calc.work += sumMat("work");
      } else if (sp.key === "Расчёт") {
        rec.kpVia.add("Расчёт");
        rec.raschet.metal += sumMat("metal"); rec.raschet.kompl += sumMat("kompl");
      } else if (sp.key === "Закупка") {
        rec.zakupka.glass += sumMat("glass");
      } else if (sp.key === "Производство GG") {
        rec.prod.fact += fm.workItogo ? num(it[fm.workItogo]) : sumMat("work");
      }
    }
    console.log(`СП ${sp.etid} «${sp.key}»: карточек ${items.length}, привязано к окну ${touched}`);
  }

  // 3) Товары сделки с количеством (crm.item.productrow.list, ownerType 'D').
  const ids = [...inWindow];
  let prodDeals = 0;
  for (const id of ids) {
    try {
      const rows: any[] = (await call("crm.item.productrow.list", { filter: { "=ownerType": "D", "=ownerId": Number(id) } })).result?.productRows || [];
      if (rows.length) {
        deal[id].products = rows.map((r) => ({ name: r.productName || "", qty: Number(r.quantity) || 0, price: Math.round(num(r.price)) }));
        prodDeals++;
      }
    } catch { /* сделка без товарных строк */ }
  }
  console.log(`Товарные строки подтянуты по ${prodDeals} сделкам из ${ids.length}`);

  // 4) Сборка. total Расчёта = металл+комплектующие (стекло - из Закупки, работа - из Производства).
  const deals = ids.map((id) => {
    const r = deal[id];
    r.raschet.total = r.raschet.metal + r.raschet.kompl;
    const ssActual = r.raschet.total + r.zakupka.glass + r.prod.fact;
    if (!r.budget && !ssActual && !r.calc.total) return null;
    return {
      id: r.id, title: r.title, mgr: r.mgr, stage: r.stage, funnel: "GG Заказы РФ",
      created: r.created, closed: r.closed, isClosed: r.isClosed,
      kpVia: [...r.kpVia].join(" + ") || null, budget: r.budget,
      calc: r.calc, raschet: r.raschet, zakupka: r.zakupka, prod: r.prod,
      ssActual: Math.round(ssActual), margin: r.budget - Math.round(ssActual), products: r.products,
    };
  }).filter(Boolean) as any[];
  deals.sort((a, b) => b.id - a.id);

  const out = {
    generated_at: new Date().toISOString(), category: ONLY_CATEGORY, windowDays: WINDOW_DAYS,
    funnelName: "GG Заказы РФ",
    materials: [
      { key: "metal", label: "Металл", src: "Расчёт", col: "--metal" },
      { key: "glass", label: "Стекло", src: "Закупка", col: "--glass" },
      { key: "kompl", label: "Комплектующие", src: "Расчёт", col: "--kompl" },
      { key: "work", label: "Работа/производство", src: "Производство", col: "--work" },
    ],
    deals,
  };
  mkdirSync("economics/data", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  const B = deals.reduce((a, d) => a + d.budget, 0), F = deals.reduce((a, d) => a + d.ssActual, 0);
  console.log(`Готово: ${deals.length} сделок, КП ${B.toLocaleString("ru")} ₽, факт ${F.toLocaleString("ru")} ₽, маржа ${(B - F).toLocaleString("ru")} ₽`);
}

main().catch((e) => { console.error(e); process.exit(1); });
