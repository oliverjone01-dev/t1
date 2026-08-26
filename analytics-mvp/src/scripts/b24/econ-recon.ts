// РАЗВЕДКА связей: сделка (воронка 49) <-> все смарт-процессы <-> все денежные поля.
// Задача - не считать маржу, а ПОКАЗАТЬ фактуру: какие СП вообще есть, какие денежные
// поля в них, насколько они заполнены, и по каждой сделке - какие СП запущены, какие
// поля денег и с какими значениями, со ссылками на карточки. Плюс товарные строки
// (есть/нет). Результат: economics/data/econ-recon.json (для экрана) + компактная сводка
// в stderr (ответы на вопросы: где нет товаров, у какой доли запущен Расчёт, доезжает ли
// факт-с/с производства). Только чтение, в CRM ничего не пишет.
// Запуск: B24_WEBHOOK_URL=... [ECON_WINDOW_DAYS=60] npx tsx src/scripts/b24/econ-recon.ts
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const OUT = "economics/data/econ-recon.json";
const CAT = 49;
const WINDOW_DAYS = Number(process.env.ECON_WINDOW_DAYS || 60);
// ECON_SINCE (абсолютная дата) имеет приоритет над окном в днях. По умолчанию - операционка
// после переезда (март 2026 = миграция 21466 сделок, её исключаем).
const SINCE = process.env.ECON_SINCE || "2026-04-01";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Денежное/стоимостное поле: тип money/double/integer/string и название про деньги/с-с/материал/услугу.
const MONEY_HINT = /с\s*\/\s*с|себестоим|стоим|цен|сумм|наценк|прибыл|маржа|бюджет|доставк|логист|монтаж|сборк|металл|сталь|алюмин|стекл|зеркал|фурнитур|дерев|профил|раскрой|сварк|зачист|нарезк|трубогиб|листогиб|покрас|токарн|слесар|гибк|сверл|зинковк|работ|материал/i;
const NOISE = /дата|срок|номер сделк|описан|коммент|ссылк|url|ответствен|статус|этап|воронк/i;
const MONEY_TYPES = /^(money|double|integer|string)$/i;
// Поля «Артикул» и «Кол-во товара» по карточкам СП (id из probe econ-tovar-probe) -
// чтобы собрать ИЗДЕЛИЯ (группировка карточек по артикулу) и с/с по каждому изделию.
const SP_ART: Record<number, { art?: string; qty?: string }> = {
  1060: { art: "ufCrm17_1772460985", qty: "ufCrm17_1773903995458" },
  1074: { art: "ufCrm19_1772433709", qty: "ufCrm19_1774931804" },
  1086: { art: "ufCrm23_1773571102", qty: "ufCrm23_1774846599942" },
};
const lbl = (d: any) => d.formLabel || d.listLabel || d.editFormLabel || d.title || "";
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
const d10 = (s?: string) => (s ? String(s).slice(0, 10) : null);
const SUCC = new Set(["EXECUTING", "FINAL_INVOICE", "1", "2", "WON"]); // предоплата+ (без префикса C49:)

async function call(method: string, params: any = {}): Promise<any> {
  let lastErr: any;
  for (let a = 0; a < 6; a++) {
    try {
      const res = await fetch(`${BASE}/${method}.json`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params), signal: AbortSignal.timeout(30000) });
      const j: any = await res.json();
      if (j.error) { if (/QUERY_LIMIT|OPERATION_TIME_LIMIT/i.test(String(j.error))) { await sleep(1200); a--; continue; } throw new Error(`${method}: ${j.error_description || j.error}`); }
      return j;
    } catch (e) { lastErr = e; await sleep(600 * (a + 1)); }
  }
  throw lastErr;
}
async function pageAll(method: string, params: any): Promise<any[]> {
  const all: any[] = []; let start = 0;
  for (;;) { const j = await call(method, { ...params, start }); const b: any[] = j.result || []; all.push(...b); if (j.next === undefined || !b.length) break; start = j.next; }
  return all;
}
async function itemsAll(etid: number, select: string[]): Promise<any[]> {
  const all: any[] = []; let lastId = 0;
  for (;;) { const j = await call("crm.item.list", { entityTypeId: etid, select, filter: { ">id": lastId }, order: { id: "ASC" }, start: -1 }); const b: any[] = (j.result && j.result.items) || []; if (!b.length) break; all.push(...b); lastId = Number(b[b.length - 1].id); if (b.length < 50) break; }
  return all;
}

(async () => {
  const cutoff = SINCE || new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);

  // 1) Все смарт-процессы (типы). Ищем в т.ч. Сборка/Логистика/Монтаж/Чертёж.
  const types: any[] = (await call("crm.type.list", {})).result?.types || [];
  const sps = types.map((t) => ({ etid: Number(t.entityTypeId), title: t.title })).filter((t) => t.etid >= 1000);
  console.error(`ТИПЫ СП (${sps.length}):`);
  for (const s of sps) console.error(`RECON-TYPE\t${s.etid}\t${s.title}`);

  // 2) Сделки воронки 49 за окно
  const stages = await pageAll("crm.status.list", { filter: {} });
  const stageName: Record<string, string> = {}; for (const s of stages) stageName[s.STATUS_ID] = s.NAME;
  const users = await pageAll("user.get", {});
  const uName: Record<string, string> = {}; for (const u of users) uName[String(u.ID)] = `${u.LAST_NAME || ""} ${u.NAME || ""}`.trim() || `id${u.ID}`;
  const dealRows = await pageAll("crm.deal.list", { filter: { CATEGORY_ID: CAT, ">=DATE_CREATE": cutoff }, select: ["ID", "TITLE", "OPPORTUNITY", "ASSIGNED_BY_ID", "STAGE_ID", "DATE_CREATE"], order: { ID: "DESC" } });
  const deal: Record<string, any> = {};
  for (const d of dealRows) deal[String(d.ID)] = { id: Number(d.ID), title: d.TITLE || "", mgr: uName[String(d.ASSIGNED_BY_ID)] || null, stageCode: String(d.STAGE_ID || "").replace(/^C49:/, ""), stage: stageName[d.STAGE_ID] || d.STAGE_ID, budget: Math.round(num(d.OPPORTUNITY)), created: d10(d.DATE_CREATE), sps: {} as Record<string, any>, products: [] as any[], hasProducts: false };
  const inWin = new Set(Object.keys(deal));
  console.error(`Сделок воронки ${CAT} за ${WINDOW_DAYS} дн (с ${cutoff}): ${inWin.size}`);

  // 3) По каждому СП: денежные поля -> инвентаризация (заполненность на карточках, привязанных к окну)
  //    + перенос значений на сделку.
  const spMeta: any[] = []; const inv: any[] = [];
  for (const sp of sps) {
    let fields: Record<string, any>;
    try { fields = (await call("crm.item.fields", { entityTypeId: sp.etid })).result?.fields || {}; } catch { continue; }
    const money: { id: string; label: string; type: string }[] = [];
    for (const [id, def] of Object.entries(fields)) { const t = String(lbl(def)).trim(), ty = String((def as any).type || ""); if (!MONEY_TYPES.test(ty)) continue; if (!MONEY_HINT.test(t) || NOISE.test(t)) continue; money.push({ id, label: t, type: ty }); }
    if (!money.length) continue;
    const ax = SP_ART[sp.etid] || {};
    const extra = [ax.art, ax.qty].filter(Boolean) as string[];
    const items = await itemsAll(sp.etid, ["id", "parentId2", ...money.map((m) => m.id), ...extra]);
    const fill: Record<string, number> = {}; let linkedItems = 0, linkedDeals = new Set<string>();
    for (const it of items) {
      const did = String(it.parentId2 || ""); if (!did || !inWin.has(did)) continue;
      linkedItems++; linkedDeals.add(did);
      const rec = deal[did]; const s = (rec.sps[sp.title] = rec.sps[sp.title] || { etid: sp.etid, cards: [] as any[], money: {} as Record<string, number> });
      const cardMoney: { label: string; value: number }[] = [];
      for (const m of money) { const v = num(it[m.id]); if (v) { fill[m.id] = (fill[m.id] || 0) + 1; s.money[m.label] = (s.money[m.label] || 0) + v; cardMoney.push({ label: m.label, value: Math.round(v) }); } }
      const art = ax.art ? String(it[ax.art] ?? "").trim() : "";
      const qty = ax.qty ? num(it[ax.qty]) : 0;
      s.cards.push({ id: it.id, money: cardMoney, art, qty });
    }
    spMeta.push({ etid: sp.etid, title: sp.title, fields: money });
    for (const m of money) inv.push({ etid: sp.etid, sp: sp.title, label: m.label, type: m.type, nonzero: fill[m.id] || 0, linked: linkedItems, fillPct: linkedItems ? Math.round(100 * (fill[m.id] || 0) / linkedItems) : 0 });
    console.error(`RECON-SP\t${sp.etid}\t${sp.title}\tденеж.полей ${money.length}\tкарточек→окно ${linkedItems}\tсделок ${linkedDeals.size}`);
  }

  // 4) Товарные строки
  let withProд = 0; const noProd: number[] = [];
  for (const id of inWin) {
    try { const rows: any[] = (await call("crm.item.productrow.list", { filter: { "=ownerType": "D", "=ownerId": Number(id) } })).result?.productRows || []; if (rows.length) { deal[id].products = rows.map((r) => ({ name: r.productName || "", qty: Number(r.quantity) || 0, price: Math.round(num(r.price)) })); deal[id].hasProducts = true; withProд++; } else noProd.push(Number(id)); } catch { noProd.push(Number(id)); }
  }

  // 5) JSON для экрана
  const deals = [...inWin].map((id) => { const r = deal[id]; return { id: r.id, title: r.title, mgr: r.mgr, stage: r.stage, stageCode: r.stageCode, budget: r.budget, created: r.created, hasProducts: r.hasProducts, products: r.products, sps: Object.entries(r.sps).map(([k, v]: any) => ({ key: k, etid: v.etid, cards: v.cards, money: Object.entries(v.money).map(([label, value]) => ({ label, value: Math.round(value as number) })) })) }; }).sort((a, b) => b.id - a.id);
  mkdirSync("economics/data", { recursive: true });
  writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), category: CAT, windowDays: WINDOW_DAYS, since: cutoff, b24Portal: (process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru").replace(/\/+$/, ""), spMeta, inventory: inv, deals }));

  // 6) Сводка ответов
  const N = inWin.size;
  const raschet = deals.filter((d) => d.sps.some((s) => /расч[её]т/i.test(s.key))).length;
  const anySS = deals.filter((d) => d.sps.some((s) => s.money.length)).length;
  const prodStage = deals.filter((d) => /производств|предоплат|успешн|заказ в произв/i.test(d.stage || "") || SUCC.has(d.stageCode));
  const prodStageWithFact = prodStage.filter((d) => d.sps.some((s) => /производство/i.test(s.key) && s.money.length));
  console.error("=========== СВОДКА ===========");
  console.error(`Всего сделок: ${N}`);
  console.error(`С товарными строками: ${withProд} (${Math.round(100 * withProд / N)}%); без товаров: ${noProd.length} (${Math.round(100 * noProd.length / N)}%)`);
  console.error(`Запущен СП Расчёт: ${raschet} (${Math.round(100 * raschet / N)}%)`);
  console.error(`Хоть какое-то денежное поле в любом СП: ${anySS} (${Math.round(100 * anySS / N)}%)`);
  console.error(`Дошли до производства/предоплаты+: ${prodStage.length}; из них с факт-с/с Производства: ${prodStageWithFact.length} (${prodStage.length ? Math.round(100 * prodStageWithFact.length / prodStage.length) : 0}%)  <= "реальная с/с почти не доезжает"`);
  // доля запуска по каждому СП
  for (const sp of spMeta) { const n = deals.filter((d) => d.sps.some((s) => s.key === sp.title)).length; console.error(`SP-LAUNCH\t${sp.title}\t${n}\t${Math.round(100 * n / N)}%`); }
  console.error(`Сделок без товарных строк (первые 60 ID): ${noProd.slice(0, 60).join(",")}`);
  console.error("RECON-DONE");
})();
