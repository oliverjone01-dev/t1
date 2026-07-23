// РАЗОВАЯ ДИАГНОСТИКА (read-only): почему у лидов из Открытой линии (онлайн-чат)
// пустые поля Roistat визит и ClientID, хотя данные приходят системным сообщением
// «Переданы дополнительные данные».
//
// Что делает (только читает, ничего не меняет):
//   1) находит коды полей лида под Roistat / ClientID / yclid / _ym_uid (по названию);
//   2) находит свежие лиды из Открытой линии;
//   3) для каждого печатает текущие значения этих полей (видим, что пусто);
//   4) ищет текст «Переданы дополнительные данные» в делах/таймлайне/диалоге,
//      достаёт Roistat visit ID и Yandex Client ID регуляркой и показывает,
//      ГДЕ именно они лежат и КАК их взять из REST.
//
// Запуск:  B24_WEBHOOK_URL=https://<portal>/rest/<user>/<token>/ npx tsx analytics-mvp/src/scripts/b24/probe-openline-tracking.ts [LEAD_ID ...]
// Если LEAD_ID не передать - возьмёт 3 свежих лида с «Открытая линия» в названии.

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(method: string, params: any = {}): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${BASE}/${method}.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(30000),
      });
      const j: any = await res.json();
      if (j.error) {
        if (/QUERY_LIMIT|OPERATION_TIME_LIMIT/i.test(String(j.error))) { await sleep(1200); continue; }
        throw new Error(`${method}: ${j.error_description || j.error}`);
      }
      return j;
    } catch (e) { lastErr = e; await sleep(600 * (attempt + 1)); }
  }
  throw lastErr;
}

const lbl = (d: any) => d.formLabel || d.listLabel || d.editFormLabel || d.title || "";

// Вытащить идентификаторы из любого текста системного сообщения.
function extract(text: string) {
  const pick = (re: RegExp) => { const m = text.match(re); return m ? m[1] : ""; };
  return {
    roistat_visit: pick(/Roistat\s*visit\s*ID[\s:>|]*([0-9]{3,})/i) || pick(/Roistat\s*visit[\s:>|]*([0-9]{3,})/i),
    client_id:     pick(/Yandex\s*Client\s*ID[\s:>|]*([0-9]{6,})/i),
    ym_uid:        pick(/_?ym_uid[\s:>|]*([0-9]{6,})/i),
  };
}

(async () => {
  // 1) КОДЫ ПОЛЕЙ ЛИДА под наши идентификаторы
  const f = await call("crm.lead.fields");
  const fields: Record<string, any> = f.result || {};
  console.log("=== ПОЛЯ ЛИДА-КАНДИДАТЫ (Roistat / ClientID / yclid / ym_uid) ===");
  const wanted: Record<string, RegExp> = {
    roistat: /roistat/i, clientid: /client\s*id/i, yclid: /yclid/i, ym_uid: /ym[_ ]?uid/i,
  };
  const fieldCode: Record<string, string> = {};
  for (const [id, def] of Object.entries(fields)) {
    const t = String(lbl(def)) + " " + id;
    for (const [key, re] of Object.entries(wanted)) {
      if (re.test(t) && !fieldCode[key]) { fieldCode[key] = id; console.log(`  ${key.padEnd(9)} -> ${id}  («${lbl(def)}», type=${def.type})`); }
    }
  }
  for (const key of Object.keys(wanted)) if (!fieldCode[key]) console.log(`  ${key.padEnd(9)} -> НЕ НАЙДЕНО поле по названию`);

  // 2) ЛИДЫ ИЗ ОТКРЫТОЙ ЛИНИИ (по названию), либо из argv
  const argIds = process.argv.slice(2).filter((x) => /^\d+$/.test(x));
  let leadIds = argIds;
  if (!leadIds.length) {
    const list = await call("crm.lead.list", {
      filter: { "%TITLE": "Открытая линия" },
      order: { DATE_CREATE: "DESC" },
      select: ["ID", "TITLE", "SOURCE_ID", "DATE_CREATE"],
      start: 0,
    });
    leadIds = (list.result || []).slice(0, 3).map((l: any) => String(l.ID));
    console.log(`\nСвежие лиды «Открытая линия»: ${leadIds.join(", ") || "не найдено"}`);
  }

  const selectFields = ["ID", "TITLE", "SOURCE_ID", ...Object.values(fieldCode)];

  for (const leadId of leadIds) {
    console.log(`\n================ ЛИД #${leadId} ================`);
    const g = await call("crm.lead.get", { id: leadId });
    const ld = g.result || {};
    console.log(`«${ld.TITLE}» source=${ld.SOURCE_ID}`);
    console.log("Текущие значения полей (ждём: пусто):");
    for (const [key, code] of Object.entries(fieldCode)) console.log(`  ${key.padEnd(9)} ${code} = ${JSON.stringify(ld[code] ?? null)}`);

    // 3) Где лежит текст «Переданы дополнительные данные» - пробуем несколько источников
    let found: any = null; let foundVia = "";
    const scan = (src: string, text: string) => {
      if (found || !text) return;
      if (/дополнительные данные|Roistat visit|Yandex Client ID/i.test(text)) {
        const ex = extract(text);
        if (ex.roistat_visit || ex.client_id) { found = ex; foundVia = src; }
      }
    };

    // 3a) Дела (activities) лида - в т.ч. провайдер Открытой линии
    try {
      const act = await call("crm.activity.list", {
        filter: { OWNER_TYPE_ID: 1, OWNER_ID: leadId },
        select: ["ID", "PROVIDER_ID", "PROVIDER_TYPE_ID", "SUBJECT", "DESCRIPTION", "ASSOCIATED_ENTITY_ID", "SETTINGS"],
      });
      for (const a of act.result || []) {
        scan(`activity#${a.ID}[${a.PROVIDER_ID}].DESCRIPTION`, String(a.DESCRIPTION || ""));
        scan(`activity#${a.ID}.SUBJECT`, String(a.SUBJECT || ""));
        // Открытая линия: у дела есть привязка к чату (ASSOCIATED_ENTITY_ID / SETTINGS)
        const chatId = a.ASSOCIATED_ENTITY_ID || (a.SETTINGS && (a.SETTINGS.CHAT_ID || a.SETTINGS.chatId));
        if (chatId && !found) {
          try {
            const dlg = await call("im.dialog.messages.get", { DIALOG_ID: `chat${chatId}`, LIMIT: 50 });
            for (const m of (dlg.result?.messages || [])) scan(`im chat${chatId} msg#${m.id}`, String(m.text || ""));
          } catch (e: any) { /* im может быть недоступен вебхуку - не критично */ }
        }
      }
      console.log(`  дел (activities): ${(act.result || []).length}`);
    } catch (e: any) { console.log(`  crm.activity.list: ${e.message}`); }

    // 3b) Комментарии таймлайна
    try {
      const tc = await call("crm.timeline.comment.list", { filter: { ENTITY_TYPE: "lead", ENTITY_ID: leadId }, select: ["ID", "COMMENT"] });
      for (const c of tc.result || []) scan(`timeline#${c.ID}`, String(c.COMMENT || ""));
    } catch (e: any) { /* метод может быть закрыт правами */ }

    if (found) {
      console.log(`  >>> НАЙДЕНО через: ${foundVia}`);
      console.log(`      Roistat visit = ${found.roistat_visit || "-"}`);
      console.log(`      ClientID      = ${found.client_id || "-"}`);
      console.log(`      _ym_uid       = ${found.ym_uid || "-"}`);
      if (found.client_id && found.client_id === found.ym_uid) console.log(`      ВНИМАНИЕ: ClientID == _ym_uid - это cookie, не настоящий getClientID (совпадает с ранним подозрением)`);
    } else {
      console.log(`  >>> текст «Переданы дополнительные данные» через REST не найден ни в делах, ни в таймлайне, ни в диалоге.`);
      console.log(`      Значит нужен доступ к чату Открытой линии (imopenlines/im scope у вебхука) - добавить его и повторить.`);
    }
  }

  console.log(`\nИТОГ: коды полей для writer -> ${JSON.stringify(fieldCode)}`);
  console.log(`Следующий шаг: writer читает тот же источник (foundVia) и делает crm.lead.update этих полей. Запись в боевой CRM - только после апрува.`);
})();
