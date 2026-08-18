// Разовая диагностика (ничего не коммитит): где в Bitrix24 лежит ТЕКСТ транскрибации
// звонка. voximplant.statistic.get даёт только TRANSCRIPT_ID (флаг). Ищем текст: в самой
// активности звонка, в таймлайне сделки, и пробуем методы-кандидаты.
// DAYS и SAMPLE через env.

const WH = process.env.B24_WEBHOOK_URL;
if (!WH) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const BASE = WH.replace(/\/+$/, "");
const DAYS = Math.max(1, Number(process.env.DAYS || 30));
const SAMPLE = Math.max(1, Number(process.env.SAMPLE || 3));
const enc = (s: string) => encodeURIComponent(s);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(method: string, payload: string): Promise<any> {
  const res = await fetch(`${BASE}/${method}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: payload });
  return res.json();
}
async function tryCall(label: string, method: string, payload: string) {
  try { const j = await call(method, payload); if (j.error) console.log(`  [${label}] ${method}: error ${j.error} ${j.error_description || ""}`); else { const s = JSON.stringify(j.result); console.log(`  [${label}] ${method}: OK ${s.length > 900 ? s.slice(0, 900) + "…" : s}`); } }
  catch (e: any) { console.log(`  [${label}] ${method}: искл %{e.message}`); }
}

(async () => {
  const now = new Date(); const from = new Date(now.getTime() - DAYS * 864e5);
  const F = from.toISOString().slice(0, 19), T = now.toISOString().slice(0, 19);
  // 1. звонки за окно
  const rows: any[] = []; let start = 0;
  for (;;) {
    const j = await call("voximplant.statistic.get", `FILTER[>CALL_START_DATE]=${enc(F)}&FILTER[<=CALL_START_DATE]=${enc(T)}&SORT=CALL_START_DATE&ORDER=DESC&start=${start}`);
    if (j.error) { console.log("voximplant.statistic.get error:", j.error, j.error_description); break; }
    rows.push(...(j.result || []));
    if (j.next === undefined || j.next === null) break; start = j.next; if (rows.length > 3000) break;
  }
  const withTr = rows.filter((r) => r.TRANSCRIPT_ID && String(r.TRANSCRIPT_ID) !== "0" && String(r.TRANSCRIPT_ID) !== "");
  console.log(`Звонков за ${DAYS} дн: ${rows.length}, с TRANSCRIPT_ID: ${withTr.length}`);
  if (rows[0]) { console.log("=== ПОЛЯ voximplant.statistic (первая запись) ==="); console.log(JSON.stringify(rows[0], null, 1)); }
  const samples = (withTr.length ? withTr : rows).slice(0, SAMPLE);
  for (const r of samples) {
    console.log(`\n=== ЗВОНОК call#${r.ID} act#${r.CRM_ACTIVITY_ID} transcriptId=${r.TRANSCRIPT_ID} rec=${(r.CALL_RECORD_URL || "").slice(0, 60)} ===`);
    if (r.CRM_ACTIVITY_ID) {
      try {
        const act = (await call("crm.activity.get", `id=${r.CRM_ACTIVITY_ID}`)).result;
        if (act) {
          console.log("  активность поля:", Object.keys(act).join(", "));
          console.log("  PROVIDER_ID=", act.PROVIDER_ID, "| PROVIDER_TYPE_ID=", act.PROVIDER_TYPE_ID);
          console.log("  DESCRIPTION:", String(act.DESCRIPTION || "").slice(0, 400));
          if (act.SETTINGS) console.log("  SETTINGS:", JSON.stringify(act.SETTINGS).slice(0, 600));
        }
      } catch (e: any) { console.log("  crm.activity.get искл:", e.message); }
    }
    // методы-кандидаты на текст транскрипта
    await tryCall("trGet", "voximplant.transcript.get", `CALL_ID=${r.CALL_ID || r.ID}`);
    await tryCall("statSel", "voximplant.statistic.get", `FILTER[ID]=${r.ID}&select[0]=TRANSCRIPT&select[1]=TRANSCRIPT_TEXT`);
    await sleep(50);
  }
  console.log("\n(ИТОГ пробы 18.08.2026: текст транскрипта вебхуком не отдаётся. Методов чтения нет,\n TRANSCRIPT_ID у внешней телефонии пустой. Доступны запись RECORD_FILE_ID и AI-резюме BitrixGPT.)");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
