// Разовая диагностика: отдаёт ли телефония ТРАНСКРИБАЦИЮ звонка через REST.
// 1) methods - полный список методов, доступных вебхуку (ищем transcript/copilot/ai/telephony).
// 2) voximplant.statistic.get - ПОЛНЫЕ сырые поля по звонкам (TRANSCRIPT_ID, RECORD_FILE_ID и пр.).
// 3) Пробуем методы-кандидаты чтения транскрипта, если они есть в списке.
// DEAL_ID через env (берём лид-источник сделки, там живут звонки).

const WH = process.env.B24_WEBHOOK_URL;
const DEAL_ID = (process.env.DEAL_ID || "99683").split(",")[0]!.trim();
if (!WH) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const BASE = WH.replace(/\/+$/, "");

async function call(method: string, params: any = {}): Promise<any> {
  const res = await fetch(`${BASE}/${method}.json`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
  return res.json();
}

(async () => {
  // --- 1. Какие методы вообще доступны вебхуку ---
  const m = await call("methods", { full: true });
  const list: string[] = Array.isArray(m.result) ? m.result : Object.keys(m.result || {});
  console.log(`=== ДОСТУПНО МЕТОДОВ: ${list.length} ===`);
  const interesting = list.filter((x) => /transcri|copilot|\bai\b|voximplant|telephony|call/i.test(x)).sort();
  console.log("--- всё про телефонию/AI/транскрипты ---");
  for (const x of interesting) console.log("   " + x);

  // --- 2. Сырая статистика по звонкам лида ---
  const deal = (await call("crm.deal.get", { id: DEAL_ID })).result;
  const leadId = String(deal.LEAD_ID || "");
  console.log(`\n=== ЗВОНКИ лида ${leadId} (сделка ${DEAL_ID}) ===`);
  const acts = ((await call("crm.activity.list", { filter: { OWNER_TYPE_ID: 1, OWNER_ID: leadId, TYPE_ID: 2 }, select: ["ID", "CREATED", "SUBJECT"] })).result) || [];
  const actIds = acts.map((a: any) => String(a.ID));
  console.log("activity IDs звонков:", actIds.join(", "));

  const st = await call("voximplant.statistic.get", { FILTER: { ">CALL_START_DATE": "2026-08-17T00:00:00", "<=CALL_START_DATE": "2026-08-18T00:00:00" }, SORT: "CALL_START_DATE", ORDER: "ASC" });
  const rows = (st.result || []).filter((c: any) => actIds.includes(String(c.CRM_ACTIVITY_ID)));
  console.log(`строк статистики по этим звонкам: ${rows.length}`);
  for (const c of rows) {
    console.log(`\n--- звонок CALL_ID=${c.CALL_ID} (activity ${c.CRM_ACTIVITY_ID}) ПОЛНЫЕ ПОЛЯ ---`);
    console.log(JSON.stringify(c, null, 1));
  }

  // --- 3. Пробуем прочитать транскрипт кандидатными методами ---
  const cands = ["voximplant.transcript.get", "telephony.transcript.get", "voximplant.statistic.transcript.get", "telephony.externalCall.transcript.get"];
  console.log("\n=== ПРОБА МЕТОДОВ ЧТЕНИЯ ТРАНСКРИПТА ===");
  const cid = rows[0] ? rows[0].CALL_ID : "";
  const tid = rows.map((r: any) => r.TRANSCRIPT_ID).find((x: any) => x) || "";
  console.log(`CALL_ID=${cid || "-"} TRANSCRIPT_ID=${tid || "(пусто во всех строках)"}`);
  for (const meth of cands) {
    const r = await call(meth, tid ? { TRANSCRIPT_ID: tid } : { CALL_ID: cid });
    console.log(`   ${meth}: ${r.error ? "ERR " + (r.error_description || r.error) : "OK " + JSON.stringify(r.result).slice(0, 300)}`);
  }
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
