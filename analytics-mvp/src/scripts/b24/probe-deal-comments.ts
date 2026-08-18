// Разовая диагностика: найти всех пользователей с заданной фамилией (PROBE_LASTNAME)
// и показать, кто из них реально ведёт сделки: ID, активность, отдел, счётчики по C49.
const WH = process.env.B24_WEBHOOK_URL;
const LAST = process.env.PROBE_LASTNAME || "Лобова";
if (!WH) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const BASE = WH.replace(/\/+$/, "");

async function call(method: string, params: any = {}): Promise<any> {
  const res = await fetch(`${BASE}/${method}.json`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
  return res.json();
}
async function countDeals(uid: string, extra: any = {}): Promise<number> {
  const r = await call("crm.deal.list", { filter: { CATEGORY_ID: 49, ASSIGNED_BY_ID: uid, ...extra }, select: ["ID"], start: 0 });
  return r.total ?? (r.result || []).length;
}

(async () => {
  const users = ((await call("user.get", { FILTER: { LAST_NAME: LAST } })).result) || [];
  console.log(`=== пользователей с фамилией «${LAST}»: ${users.length} ===`);
  for (const u of users) {
    const id = String(u.ID);
    const total = await countDeals(id);
    const open = await countDeals(id, { "!STAGE_ID": ["C49:WON", "C49:LOSE"] });
    const won = await countDeals(id, { STAGE_ID: "C49:WON" });
    const acts = await call("crm.activity.list", { filter: { RESPONSIBLE_ID: id, ">CREATED": "2026-07-01T00:00:00" }, select: ["ID"], start: 0 });
    console.log(`\n--- ID ${id}: ${u.NAME || ""} ${u.LAST_NAME || ""} ---`);
    console.log(`   ACTIVE=${u.ACTIVE} | должность: ${u.WORK_POSITION || "-"} | отдел: ${JSON.stringify(u.UF_DEPARTMENT || [])}`);
    console.log(`   email: ${u.EMAIL || "-"} | вход последний: ${u.LAST_LOGIN || "-"} | регистрация: ${(u.DATE_REGISTER || "").slice(0, 10)}`);
    console.log(`   сделки C49: всего ${total}, открытых ${open}, выиграно ${won} | активностей с 01.07: ${acts.total ?? (acts.result || []).length}`);
  }
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
