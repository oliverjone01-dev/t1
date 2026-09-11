// РАЗВЕДКА ДАТ (read-only): какие поля-даты есть у сделки воронки 49 и у СП «Производство»,
// и насколько они заполнены на живом окне. Нужна, чтобы под «Срок сдачи» (план по договору)
// и «Дата готовности фактическая» (по цеху сборки) выбрать РЕАЛЬНЫЕ поля, а не угадывать.
// Ничего не пишет в CRM и в репозиторий - только печатает сводку в лог.
// Запуск: B24_WEBHOOK_URL=... [ECON_WINDOW_DAYS=60] npx tsx src/scripts/b24/econ-date-probe.ts

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const CAT = 49;
const SINCE = process.env.ECON_SINCE || "2026-04-01";
const WINDOW_DAYS = Number(process.env.ECON_WINDOW_DAYS || 60);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lbl = (d: any) => d.formLabel || d.listLabel || d.editFormLabel || d.title || "";
const isDate = (t: any) => /^(date|datetime)$/i.test(String(t || ""));
const has = (v: any) => v !== null && v !== undefined && String(v).trim() !== "" && !/^0000-00-00/.test(String(v));

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
const pct = (n: number, d: number) => d ? Math.round(100 * n / d) : 0;
const HINT = /срок|сдач|готов|отгруз|завершен|договор|устн|план|дедлайн|deadline|дата/i;

(async () => {
  const cutoff = SINCE || new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  console.error(`ОКНО: сделки воронки ${CAT} с ${cutoff}`);

  // 1) Поля-даты СДЕЛКИ
  const dfs: Record<string, any> = (await call("crm.deal.fields", {})).result || {};
  const dealDate: { id: string; label: string; type: string }[] = [];
  for (const [id, def] of Object.entries<any>(dfs)) if (isDate(def.type)) dealDate.push({ id, label: String(lbl(def)), type: String(def.type) });
  console.error(`\n=== ПОЛЯ-ДАТЫ СДЕЛКИ (${dealDate.length}) ===`);
  for (const f of dealDate) console.error(`DEAL-DATEFIELD\t${f.id}\t${f.type}\t${f.label}`);

  // 2) Сделки окна, заполненность каждого поля-даты
  const sel = ["ID", "STAGE_ID", ...dealDate.map((f) => f.id)];
  const deals = await pageAll("crm.deal.list", { filter: { CATEGORY_ID: CAT, ">=DATE_CREATE": cutoff }, select: sel, order: { ID: "DESC" } });
  const N = deals.length;
  const fill: Record<string, number> = {};
  for (const d of deals) for (const f of dealDate) if (has(d[f.id])) fill[f.id] = (fill[f.id] || 0) + 1;
  console.error(`\n=== ЗАПОЛНЕННОСТЬ ПОЛЕЙ-ДАТ СДЕЛКИ (сделок в окне: ${N}) ===`);
  dealDate.map((f) => ({ ...f, n: fill[f.id] || 0 })).sort((a, b) => b.n - a.n)
    .forEach((f) => console.error(`DEAL-FILL\t${pct(f.n, N)}%\t${f.n}/${N}\t${f.id}\t${f.label}${HINT.test(f.label) ? "\t<< КАНДИДАТ" : ""}`));

  // 3) СП «Производство» - найти тип и его поля-даты
  const types: any[] = (await call("crm.type.list", {})).result?.types || [];
  const prod = types.map((t) => ({ etid: Number(t.entityTypeId), title: String(t.title || "") })).filter((t) => /производств/i.test(t.title));
  console.error(`\n=== СП «Производство» (${prod.length}): ${prod.map((p) => `${p.etid}:${p.title}`).join(" · ") || "не найдено"} ===`);
  for (const sp of prod) {
    let fields: Record<string, any>;
    try { fields = (await call("crm.item.fields", { entityTypeId: sp.etid })).result?.fields || {}; } catch (e) { console.error(`SP-ERR\t${sp.etid}\t${String(e)}`); continue; }
    const spDate: { id: string; label: string; type: string }[] = [];
    for (const [id, def] of Object.entries<any>(fields)) if (isDate(def.type)) spDate.push({ id, label: String(lbl(def)), type: String(def.type) });
    console.error(`\n--- ${sp.etid} «${sp.title}»: поля-даты (${spDate.length}) ---`);
    for (const f of spDate) console.error(`SP-DATEFIELD\t${sp.etid}\t${f.id}\t${f.type}\t${f.label}`);
    // заполненность на карточках, привязанных к сделкам окна
    const winIds = new Set(deals.map((d) => String(d.ID)));
    const items = await itemsAll(sp.etid, ["id", "parentId2", ...spDate.map((f) => f.id)]);
    let linked = 0; const sfill: Record<string, number> = {};
    for (const it of items) { const did = String(it.parentId2 || ""); if (!winIds.has(did)) continue; linked++; for (const f of spDate) if (has(it[f.id])) sfill[f.id] = (sfill[f.id] || 0) + 1; }
    console.error(`--- ${sp.etid} «${sp.title}»: карточек к окну ${linked}; заполненность дат ---`);
    spDate.map((f) => ({ ...f, n: sfill[f.id] || 0 })).sort((a, b) => b.n - a.n)
      .forEach((f) => console.error(`SP-FILL\t${sp.etid}\t${pct(f.n, linked)}%\t${f.n}/${linked}\t${f.id}\t${f.label}${HINT.test(f.label) ? "\t<< КАНДИДАТ" : ""}`));
  }
  console.error("\nГотово (read-only).");
})();
