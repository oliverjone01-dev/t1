// Разовая live-проба Bitrix24 (read-only): найти контакт по email и его сделки,
// плюс лид по трекинг-параметру (u2i-...). Печатает результат со ссылками в лог Actions.
// Запуск: B24_WEBHOOK_URL=... EMAIL=... PARAM=... npx tsx src/scripts/b24/probe-lookup.ts
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
  for (;;) {
    const j = await call(method, { ...params, start });
    (j.result || []).forEach((r: any) => all.push(r));
    if (j.next === undefined) break; start = j.next;
  }
  return all;
}
const dealUrl = (id: any) => `${PORTAL}/crm/deal/details/${id}/`;
const leadUrl = (id: any) => `${PORTAL}/crm/lead/details/${id}/`;
const contUrl = (id: any) => `${PORTAL}/crm/contact/details/${id}/`;

async function main() {
  console.log(`Портал ${PORTAL}\nEMAIL=${EMAIL}\nPARAM=${PARAM}\n`);

  if (EMAIL) {
    console.log("=== КОНТАКТ ПО EMAIL ===");
    let contactIds: string[] = [];
    try {
      const dup = await call("crm.duplicate.findbycomm", { type: "EMAIL", values: [EMAIL], entity_type: "CONTACT" });
      contactIds = (dup.result?.CONTACT || dup.result || []).map(String);
    } catch (e) { console.log("findbycomm CONTACT:", (e as any)?.message); }
    console.log(`Найдено контактов: ${contactIds.length} -> ${contactIds.join(", ") || "-"}`);
    for (const cid of contactIds) {
      const c = (await call("crm.contact.get", { id: cid })).result;
      console.log(`\nКонтакт #${cid} ${((c?.NAME||"")+" "+(c?.LAST_NAME||"")).trim()} : ${contUrl(cid)}`);
      const deals = await listAll("crm.deal.list", {
        filter: { CONTACT_ID: cid },
        select: ["ID", "TITLE", "CATEGORY_ID", "STAGE_ID", "OPPORTUNITY", "DATE_CREATE", "LEAD_ID"],
        order: { DATE_CREATE: "DESC" },
      });
      console.log(`  Сделок у контакта: ${deals.length}`);
      for (const d of deals) console.log(`   Сделка #${d.ID} · C${d.CATEGORY_ID} · ${d.STAGE_ID} · ${Number(d.OPPORTUNITY)||0} · ${String(d.DATE_CREATE).slice(0,10)} · lead=${d.LEAD_ID||"-"}\n     ${dealUrl(d.ID)}`);
    }
    try {
      const dupL = await call("crm.duplicate.findbycomm", { type: "EMAIL", values: [EMAIL], entity_type: "LEAD" });
      const lids = (dupL.result?.LEAD || dupL.result || []).map(String);
      console.log(`\nЛидов с этим email: ${lids.length} -> ${lids.join(", ") || "-"}`);
      for (const lid of lids) console.log(`   Лид #${lid}: ${leadUrl(lid)}`);
    } catch (e) { console.log("findbycomm LEAD:", (e as any)?.message); }
  }

  if (PARAM) {
    console.log("\n=== ЛИД ПО ПАРАМЕТРУ ===");
    const fields = ["UTM_TERM", "UTM_CONTENT", "UTM_CAMPAIGN", "UTM_SOURCE", "UTM_MEDIUM", "TITLE", "SOURCE_DESCRIPTION"];
    let found = false;
    for (const f of fields) {
      try {
        const rows = await listAll("crm.lead.list", { filter: { [f]: PARAM }, select: ["ID", "TITLE", "STATUS_ID", "DATE_CREATE", f] });
        if (rows.length) { found = true; console.log(`Поле ${f}: ${rows.length} лид(ов)`); for (const r of rows) console.log(`   Лид #${r.ID} · ${r.STATUS_ID} · ${String(r.DATE_CREATE).slice(0,10)} · ${f}="${r[f]}"\n     ${leadUrl(r.ID)}`); }
      } catch { /* поле недоступно */ }
    }
    try {
      const rows = await listAll("crm.lead.list", { filter: { "%TITLE": PARAM }, select: ["ID", "TITLE", "STATUS_ID", "DATE_CREATE"] });
      if (rows.length) { found = true; console.log(`Частичное совпадение в TITLE: ${rows.length}`); for (const r of rows) console.log(`   Лид #${r.ID} · «${r.TITLE}»\n     ${leadUrl(r.ID)}`); }
    } catch { /* */ }
    if (!found) console.log("По известным трекинг-полям лид не найден. Возможно, параметр в кастомном поле (UF_*) или в источнике openlines.");
  }
  console.log("\nГотово.");
}
main().catch((e) => { console.error("Проба упала:", e instanceof Error ? e.message : e); process.exit(1); });
