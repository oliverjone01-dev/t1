// Разовая live-проба Bitrix24 (read-only): по каждой паре {email, param}
//  - email  -> контакт/лид/компания (findbycomm + list-фильтр) и сделки контакта
//  - param  -> лид/сделка через быстрый глобальный поиск (%SEARCH_CONTENT),
//              затем ORIGIN_ID/ORIGINATOR_ID/UTM, и только в крайнем случае - скан UF-полей.
// Многоцелевой: TARGETS='[{"email":"..","param":".."},..]' либо одиночные EMAIL/PARAM.
import process from "node:process";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
const PORTAL = (process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }

type Target = { email?: string; param?: string };
let targets: Target[] = [];
try { if (process.env.TARGETS) targets = JSON.parse(process.env.TARGETS); } catch { /* */ }
if (!targets.length) targets = [{ email: process.env.EMAIL || "", param: process.env.PARAM || "" }];

async function call(method: string, params: any = {}): Promise<any> {
  const res = await fetch(`${BASE}/${method}.json`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params), signal: AbortSignal.timeout(30000),
  });
  const j: any = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error_description || j.error}`);
  return j;
}
async function listAll(method: string, params: any): Promise<any[]> {
  const all: any[] = []; let start = 0;
  for (;;) { const j = await call(method, { ...params, start }); (j.result || []).forEach((r: any) => all.push(r)); if (j.next === undefined) break; start = j.next; }
  return all;
}
const dealUrl = (id: any) => `${PORTAL}/crm/deal/details/${id}/`;
const leadUrl = (id: any) => `${PORTAL}/crm/lead/details/${id}/`;
const contUrl = (id: any) => `${PORTAL}/crm/contact/details/${id}/`;
const compUrl = (id: any) => `${PORTAL}/crm/company/details/${id}/`;

async function dealsOfContact(cid: string) {
  const deals = await listAll("crm.deal.list", { filter: { CONTACT_ID: cid }, select: ["ID", "TITLE", "CATEGORY_ID", "STAGE_ID", "OPPORTUNITY", "DATE_CREATE", "LEAD_ID"], order: { DATE_CREATE: "DESC" } });
  console.log(`  Сделок у контакта #${cid}: ${deals.length}`);
  for (const d of deals) console.log(`   Сделка #${d.ID} · C${d.CATEGORY_ID} · ${d.STAGE_ID} · ${Number(d.OPPORTUNITY)||0}₽ · ${String(d.DATE_CREATE).slice(0,10)} · lead=${d.LEAD_ID||"-"}\n     ${dealUrl(d.ID)}`);
}

async function byEmail(EMAIL: string) {
  console.log(`=== ПОИСК ПО EMAIL: ${EMAIL} ===`);
  let any = false;
  for (const et of ["CONTACT", "LEAD", "COMPANY"]) {
    try {
      const dup = await call("crm.duplicate.findbycomm", { type: "EMAIL", values: [EMAIL], entity_type: et });
      const ids = (dup.result?.[et] || dup.result || []).map(String).filter(Boolean);
      if (ids.length) { any = true; console.log(`findbycomm ${et}: ${ids.join(", ")}`); }
      for (const id of ids) {
        if (et === "CONTACT") { const c=(await call("crm.contact.get",{id})).result; console.log(` Контакт #${id} ${((c?.NAME||"")+" "+(c?.LAST_NAME||"")).trim()}: ${contUrl(id)}`); await dealsOfContact(id); }
        if (et === "LEAD") { const l=(await call("crm.lead.get",{id})).result; console.log(` Лид #${id} ${l?.TITLE||""} · ${l?.STATUS_ID||""}: ${leadUrl(id)}`); }
        if (et === "COMPANY") console.log(` Компания #${id}: ${compUrl(id)}`);
      }
    } catch (e) { console.log(`findbycomm ${et}:`, (e as any)?.message); }
  }
  // list-фильтры на случай, если findbycomm молчит
  for (const [m, sel, url] of [["crm.contact.list", ["ID","NAME","LAST_NAME"], contUrl], ["crm.lead.list", ["ID","TITLE","STATUS_ID"], leadUrl], ["crm.company.list", ["ID","TITLE"], compUrl]] as any) {
    for (const flt of [{ EMAIL }, { "%EMAIL": EMAIL }]) {
      try { const rows = await listAll(m, { filter: flt, select: sel }); if (rows.length) { any = true; console.log(`${m} ${JSON.stringify(flt)}: ${rows.map((r:any)=>`#${r.ID} ${url(r.ID)}`).join("  ")}`); if (m==="crm.contact.list") for (const r of rows) await dealsOfContact(String(r.ID)); } } catch { /* */ }
    }
  }
  // глобальный поиск строки email (вдруг лежит в UF/комментарии)
  for (const [m, sel, url] of [["crm.lead.list", ["ID","TITLE","STATUS_ID"], leadUrl], ["crm.deal.list", ["ID","TITLE","CATEGORY_ID","STAGE_ID"], dealUrl]] as any) {
    try { const rows = await listAll(m, { filter: { "%SEARCH_CONTENT": EMAIL }, select: sel }); if (rows.length) { any = true; console.log(`${m} SEARCH_CONTENT: ${rows.map((r:any)=>`#${r.ID} ${url(r.ID)}`).join("  ")}`); } } catch { /* */ }
  }
  if (!any) console.log("  Email не найден ни как контакт/лид/компания, ни в SEARCH_CONTENT.");
}

async function byParam(PARAM: string) {
  console.log(`=== ПОИСК ПО ПАРАМЕТРУ: ${PARAM} ===`);
  let found = false;
  // 1) быстрый глобальный индекс поиска (то же, что строка поиска в UI)
  for (const [m, sel, url] of [["crm.lead.list", ["ID","TITLE","STATUS_ID","DATE_CREATE","ORIGIN_ID"], leadUrl], ["crm.deal.list", ["ID","TITLE","CATEGORY_ID","STAGE_ID","DATE_CREATE"], dealUrl]] as any) {
    try { const rows = await listAll(m, { filter: { "%SEARCH_CONTENT": PARAM }, select: sel }); if (rows.length) { found = true; console.log(`SEARCH_CONTENT ${m}: ${rows.length}`); for (const r of rows) console.log(`   #${r.ID} · ${r.STATUS_ID||r.STAGE_ID||""} · ${String(r.DATE_CREATE||"").slice(0,10)}\n     ${url(r.ID)}`); } } catch { /* */ }
  }
  // 2) точные системные поля источника
  for (const [m, url] of [["crm.lead.list", leadUrl], ["crm.deal.list", dealUrl]] as any) {
    for (const f of ["ORIGIN_ID", "ORIGINATOR_ID", "UTM_TERM", "UTM_CONTENT", "UTM_CAMPAIGN", "UTM_SOURCE"]) {
      try { const rows = await listAll(m, { filter: { [f]: PARAM }, select: ["ID","TITLE","STAGE_ID","STATUS_ID","DATE_CREATE"] }); if (rows.length) { found = true; console.log(`${m} ${f}: ${rows.map((r:any)=>`#${r.ID} ${url(r.ID)}`).join("  ")}`); } } catch { /* */ }
    }
  }
  // 3) крайняя мера - скан UF-полей лида (может быть медленно)
  if (!found) {
    try {
      const lf = (await call("crm.lead.fields", {})).result || {};
      for (const f of Object.keys(lf).filter(k => k.startsWith("UF_"))) {
        try { const rows = await listAll("crm.lead.list", { filter: { [f]: PARAM }, select: ["ID","TITLE","STATUS_ID","DATE_CREATE"] }); if (rows.length) { found = true; console.log(`UF ${f}: ${rows.map((r:any)=>`#${r.ID} ${leadUrl(r.ID)}`).join("  ")}`); } } catch { /* */ }
      }
    } catch { /* */ }
  }
  if (!found) console.log("  Параметр не найден (SEARCH_CONTENT/ORIGIN_ID/UTM/UF лида и сделки).");
}

async function main() {
  console.log(`Портал ${PORTAL}\nЦелей: ${targets.length}\n`);
  for (const t of targets) {
    console.log(`\n########## ЦЕЛЬ: email=${t.email||"-"} param=${t.param||"-"} ##########`);
    if (t.email) await byEmail(t.email);
    if (t.param) await byParam(t.param);
  }
  console.log("\nГотово.");
}
main().catch((e) => { console.error("Проба упала:", e instanceof Error ? e.message : e); process.exit(1); });
