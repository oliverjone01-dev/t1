// Разовая диагностика: где в API лежит резюме звонка от BitrixGPT.
// В карточке лида/сделки резюме показывается в боковой панели BitrixGPT («Резюме»),
// а в таймлайне рядом со звонком висит плашка «Обработан BitrixGPT». Нужно понять,
// доступен ли этот текст через REST и в каком поле.
//
// Запуск: B24_WEBHOOK_URL=... PROBE_ENTITY=lead PROBE_ID=50489 npx tsx src/scripts/b24/probe-ai-summary.ts
const WH = process.env.B24_WEBHOOK_URL;
const ENT = (process.env.PROBE_ENTITY || "lead").toLowerCase();
const ID = process.env.PROBE_ID || "50489";
if (!WH) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const BASE = WH.replace(/\/+$/, "");
const OWNER_TYPE = ENT === "deal" ? 2 : 1;   // 1 - лид, 2 - сделка

async function call(method: string, params: any = {}): Promise<any> {
  try {
    const res = await fetch(`${BASE}/${method}.json`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params), signal: AbortSignal.timeout(30000),
    });
    return await res.json();
  } catch (e: any) { return { error: "fetch_failed", error_description: e.message }; }
}
const short = (s: any, n = 300) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);

(async () => {
  console.log(`=== ПРОБА: ${ENT} ${ID} (OWNER_TYPE_ID=${OWNER_TYPE}) ===\n`);

  // 1. Все активности сущности со всеми полями
  const acts = (await call("crm.activity.list", {
    filter: { OWNER_TYPE_ID: OWNER_TYPE, OWNER_ID: ID },
    select: ["*", "SETTINGS", "DESCRIPTION", "PROVIDER_ID", "PROVIDER_TYPE_ID", "ASSOCIATED_ENTITY_ID", "FILES"],
    order: { CREATED: "ASC" },
  })).result || [];
  console.log(`--- активностей: ${acts.length} ---`);
  for (const a of acts) {
    console.log(`\n[act ${a.ID}] TYPE_ID=${a.TYPE_ID} PROVIDER_ID=${a.PROVIDER_ID} PROVIDER_TYPE_ID=${a.PROVIDER_TYPE_ID || "-"} CREATED=${a.CREATED}`);
    console.log(`   SUBJECT: ${short(a.SUBJECT, 120)}`);
    console.log(`   DESCRIPTION (${String(a.DESCRIPTION || "").length} симв): ${short(a.DESCRIPTION, 400)}`);
    console.log(`   ASSOCIATED_ENTITY_ID=${a.ASSOCIATED_ENTITY_ID || "-"} ORIGINATOR_ID=${a.ORIGINATOR_ID || "-"} ORIGIN_ID=${a.ORIGIN_ID || "-"}`);
    const st = a.SETTINGS && !Array.isArray(a.SETTINGS) ? a.SETTINGS : null;
    if (st) console.log(`   SETTINGS: ${short(JSON.stringify(st), 700)}`);
    // полная карточка активности: в list часть полей режется
    const full = (await call("crm.activity.get", { id: a.ID })).result;
    if (full) {
      const extra = Object.keys(full).filter((k) => !(k in a));
      if (extra.length) console.log(`   поля только в get: ${extra.join(", ")}`);
      for (const k of extra) {
        const v = full[k];
        if (v && typeof v === "object") console.log(`     ${k}: ${short(JSON.stringify(v), 400)}`);
        else if (String(v || "").length > 40) console.log(`     ${k}: ${short(v, 400)}`);
      }
    }
  }

  // 2. Комментарии таймлайна
  const cmts = (await call("crm.timeline.comment.list", {
    filter: { ENTITY_ID: ID, ENTITY_TYPE: ENT }, select: ["ID", "CREATED", "COMMENT", "AUTHOR_ID", "FILES"],
  })).result || [];
  console.log(`\n--- комментариев таймлайна: ${cmts.length} ---`);
  for (const c of cmts) console.log(`[cmt ${c.ID}] ${c.CREATED}: ${short(c.COMMENT, 300)}`);

  // 3. Звонки сущности в статистике телефонии: есть ли ссылка на расшифровку
  const vox = (await call("voximplant.statistic.get", {
    FILTER: { CRM_ENTITY_TYPE: ENT.toUpperCase(), CRM_ENTITY_ID: ID },
  })).result || [];
  console.log(`\n--- звонков в voximplant.statistic: ${Array.isArray(vox) ? vox.length : 0} ---`);
  for (const v of (Array.isArray(vox) ? vox : [])) {
    console.log(`[call ${v.CALL_ID}] activity=${v.CRM_ACTIVITY_ID} длит=${v.CALL_DURATION} запись=${v.CALL_RECORD_URL ? "есть" : "нет"} TRANSCRIPT_ID=${v.TRANSCRIPT_ID || "-"} ключи: ${Object.keys(v).join(",")}`);
  }

  // 4. Какие вообще методы REST относятся к ИИ, копайлоту и расшифровкам
  const all: string[] = (await call("methods")).result || [];
  const ai = all.filter((m) => /ai|copilot|transcri|summar|speech|gpt|voice/i.test(m));
  console.log(`\n--- методов всего ${all.length}, похожих на ИИ/расшифровку: ${ai.length} ---`);
  console.log(ai.join("\n") || "(нет)");

  // 4b. Что вообще разрешено этому вебхуку и есть ли лог-записи таймлайна
  const sc = await call("scope", {});
  console.log(`\n--- права вебхука (scope): ${JSON.stringify(sc.result || sc.error || "-")}`);
  const scFull = await call("scope", { full: true });
  console.log(`--- все возможные scope портала: ${short(JSON.stringify(scFull.result || scFull.error || "-"), 900)}`);

  const lm = await call("crm.timeline.logmessage.list", { entityTypeId: OWNER_TYPE, entityId: ID });
  const lmr = lm.result;
  console.log(`\n--- crm.timeline.logmessage.list: ${lm.error ? lm.error + " " + short(lm.error_description, 80) : "ок"}`);
  const lmArr = Array.isArray(lmr) ? lmr : (lmr && (lmr.logMessages || lmr.items)) || [];
  for (const it of lmArr) console.log(`  [log ${it.id || it.ID}] ${short(JSON.stringify(it), 400)}`);

  // 5. Проверка гипотез: существуют ли такие методы вообще
  const guesses = [
    "ai.engine.list", "ai.prompt.list", "ai.text.list", "copilot.call.summary.get",
    "crm.timeline.logmessage.list", "crm.timeline.note.get", "crm.timeline.item.list",
    "voximplant.transcript.get", "telephony.transcript.get", "crm.activity.todo.list",
    "ai.engine.list", "crm.ai.call.summary.get", "crm.activity.aicall.get",
    "crm.timeline.aicall.get", "crm.timeline.comment.fields", "crm.activity.fields",
  ];
  console.log(`\n--- проверка методов-кандидатов ---`);
  for (const m of guesses) {
    const r = await call(m, {});
    const err = r.error ? `${r.error}: ${short(r.error_description, 90)}` : "ОТВЕТИЛ";
    console.log(`  ${m.padEnd(34)} -> ${err}`);
  }
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
