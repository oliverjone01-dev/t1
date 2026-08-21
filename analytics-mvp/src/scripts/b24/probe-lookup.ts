// Разовая live-проба Bitrix24 (read-only): найти контакт/лид по email и его сделки,
// плюс лид по параметру (u2i-...) в ORIGIN_ID / UTM / UF / TITLE. Печатает в лог Actions.
import process from "node:process";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
const PORTAL = (process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru").replace(/\/+$/, "");
const EMAIL = process.env.EMAIL || "";
const PARAM = process.env.PARAM || "";
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }

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
  for (const d of deals) console.log(`   Сделка #${d.ID} · C${d.CATEGORY_ID} · ${d.STAGE_ID} · ${Number(d.OPPORTUNITY)||0} · ${String(d.DATE_CREATE).slice(0,10)} · lead=${d.LEAD_ID||"-"}\n     ${dealUrl(d.ID)}`);
}

async function main() {
  console.log(`Портал ${PORTAL}\nEMAIL=${EMAIL}\nPARAM=${PARAM}\n`);

  if (EMAIL) {
    console.log("=== ПОИСК ПО EMAIL ===");
    for (const et of ["CONTACT", "LEAD", "COMPANY"]) {
      try {
        const dup = await call("crm.duplicate.findbycomm", { type: "EMAIL", values: [EMAIL], entity_type: et });
        const ids = (dup.result?.[et] || dup.result || []).map(String);
        console.log(`findbycomm ${et}: ${ids.length} -> ${ids.join(", ") || "-"}`);
        for (const id of ids) {
          if (et === "CONTACT") { const c=(await call("crm.contact.get",{id})).result; console.log(` Контакт #${id} ${((c?.NAME||"")+" "+(c?.LAST_NAME||"")).trim()}: ${contUrl(id)}`); await dealsOfContact(id); }
          if (et === "LEAD") console.log(` Лид #${id}: ${leadUrl(id)}`);
          if (et === "COMPANY") console.log(` Компания #${id}: ${compUrl(id)}`);
        }
      } catch (e) { console.log(`findbycomm ${et}:`, (e as any)?.message); }
    }
    // Прямой list-фильтр (на случай, если findbycomm молчит)
    for (const [m, sel] of [["crm.contact.list", ["ID","NAME","LAST_NAME"]], ["crm.lead.list", ["ID","TITLE","STATUS_ID"]]] as any) {
      for (const flt of [{ EMAIL }, { "%EMAIL": EMAIL }]) {
        try { const rows = await listAll(m, { filter: flt, select: sel }); if (rows.length) console.log(`${m} ${JSON.stringify(flt)}: ${rows.length} -> ${rows.map((r:any)=>r.ID).join(", ")}`); } catch { /* поле недоступно */ }
      }
    }
  }

  if (PARAM) {
    console.log("\n=== ЛИД ПО ПАРАМЕТРУ ===");
    let fields = ["ORIGIN_ID", "ORIGINATOR_ID", "UTM_TERM", "UTM_CONTENT", "UTM_CAMPAIGN", "UTM_SOURCE", "UTM_MEDIUM", "TITLE", "SOURCE_DESCRIPTION"];
    // добираем все UF-поля лида
    try { const lf = (await call("crm.lead.fields", {})).result || {}; fields = fields.concat(Object.keys(lf).filter(k => k.startsWith("UF_"))); } catch { /* */ }
    let found = false;
    for (const f of fields) {
      try {
        const rows = await listAll("crm.lead.list", { filter: { [f]: PARAM }, select: ["ID", "TITLE", "STATUS_ID", "DATE_CREATE", "ORIGIN_ID"] });
        if (rows.length) { found = true; console.log(`Поле ${f}: ${rows.length} лид(ов)`); for (const r of rows) console.log(`   Лид #${r.ID} · ${r.STATUS_ID} · ${String(r.DATE_CREATE).slice(0,10)} · ORIGIN_ID=${r.ORIGIN_ID||"-"}\n     ${leadUrl(r.ID)}`); }
      } catch { /* */ }
    }
    // и по сделкам (вдруг параметр на сделке)
    for (const f of ["ORIGIN_ID", "UTM_TERM", "UTM_CONTENT"]) {
      try { const rows = await listAll("crm.deal.list", { filter: { [f]: PARAM }, select: ["ID","TITLE","STAGE_ID","DATE_CREATE"] }); if (rows.length) { found = true; console.log(`Сделки по ${f}: ${rows.length}`); for (const r of rows) console.log(`   Сделка #${r.ID}: ${dealUrl(r.ID)}`); } } catch { /* */ }
    }
    if (!found) console.log("Параметр не найден ни в ORIGIN_ID, ни в UTM/UF лида/сделки.");
  }
  console.log("\nГотово.");
}
main().catch((e) => { console.error("Проба упала:", e instanceof Error ? e.message : e); process.exit(1); });
