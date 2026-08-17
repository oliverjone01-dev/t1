// Разовая диагностика (ничего не коммитит): из чего состоят КОММЕНТАРИИ таймлайна
// сделки (crm.timeline.comment). Прямая интеграция WhatsApp пишет диалог сюда, а не
// в crm.activity и не в Открытую линию, поэтому наш снимок его не видит. Задача пробы -
// показать автора каждого комментария и ПОЛНЫЙ набор полей, чтобы решить, как отличать
// клиентскую переписку от внутренних заметок (по сервисному автору интеграции / метке / паттерну).

const WH = process.env.B24_WEBHOOK_URL;
const DEAL_ID = process.env.DEAL_ID || "99627";
if (!WH) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const base = WH.replace(/\/+$/, "");

async function call(method: string, params: any = {}): Promise<any> {
  const res = await fetch(`${base}/${method}.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const j: any = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error} ${j.error_description || ""}`);
  return j;
}

function short(s: any, n = 140): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

async function commentsFor(entityType: string, entityId: string): Promise<any[]> {
  try {
    const r = await call("crm.timeline.comment.list", {
      filter: { ENTITY_ID: entityId, ENTITY_TYPE: entityType },
      order: { CREATED: "ASC" },
    });
    return r.result || [];
  } catch (e: any) {
    console.log(`  (${entityType} ${entityId}) ошибка: ${e.message}`);
    return [];
  }
}

(async () => {
  const deal = (await call("crm.deal.get", { id: DEAL_ID })).result;
  console.log(`Сделка ${DEAL_ID}: "${deal.TITLE}" | LEAD_ID=${deal.LEAD_ID} CONTACT_ID=${deal.CONTACT_ID} COMPANY_ID=${deal.COMPANY_ID} ASSIGNED_BY_ID=${deal.ASSIGNED_BY_ID}`);

  const targets: Array<[string, string]> = [["deal", DEAL_ID]];
  if (deal.LEAD_ID && String(deal.LEAD_ID) !== "0") targets.push(["lead", String(deal.LEAD_ID)]);
  if (deal.CONTACT_ID && String(deal.CONTACT_ID) !== "0") targets.push(["contact", String(deal.CONTACT_ID)]);

  const authorIds = new Set<string>();
  const buckets: any[] = [];
  for (const [t, id] of targets) {
    const cs = await commentsFor(t, id);
    buckets.push(...cs);
    console.log(`\n=== КОММЕНТАРИИ ${t} ${id}: ${cs.length} ===`);
    for (const c of cs) {
      authorIds.add(String(c.AUTHOR_ID));
      const files = Array.isArray(c.FILES) ? c.FILES.length : (c.FILES ? 1 : 0);
      console.log(`  #${c.ID} ${c.CREATED} автор=${c.AUTHOR_ID} файлы=${files} | ${short(c.COMMENT)}`);
    }
  }

  if (buckets.length) {
    console.log("\n=== СЫРОЙ первый комментарий (ВСЕ поля - ищем метку провайдера/направления) ===");
    console.log(JSON.stringify(buckets[0], null, 1));
  }

  console.log("\n=== АВТОРЫ комментариев (кто сервисный пользователь интеграции) ===");
  for (const id of authorIds) {
    try {
      const u = (await call("user.get", { ID: id })).result?.[0];
      console.log(`  ${id}: ${u ? `${u.NAME || ""} ${u.LAST_NAME || ""} | должн=${u.WORK_POSITION || ""} | ${u.EMAIL || ""} | active=${u.ACTIVE}` : "не найден"}`);
    } catch (e: any) {
      console.log(`  ${id}: ошибка ${e.message}`);
    }
  }

  const acts = (await call("crm.activity.list", {
    filter: { OWNER_TYPE_ID: 2, OWNER_ID: DEAL_ID },
    select: ["ID", "TYPE_ID", "PROVIDER_ID", "PROVIDER_TYPE_ID", "DIRECTION", "SUBJECT", "CREATED"],
  })).result || [];
  console.log(`\n=== АКТИВНОСТИ сделки (crm.activity - то, что считаем касаниями СЕЙЧАС): ${acts.length} ===`);
  for (const a of acts) {
    console.log(`  #${a.ID} ${a.CREATED} TYPE=${a.TYPE_ID} PROVIDER=${a.PROVIDER_ID}/${a.PROVIDER_TYPE_ID} dir=${a.DIRECTION} | ${short(a.SUBJECT, 80)}`);
  }
})().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
