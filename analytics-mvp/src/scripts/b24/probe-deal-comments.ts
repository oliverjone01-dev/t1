// Разовая диагностика (ничего не коммитит): валидируем правило «Wazzup-переписка vs своя заметка»
// в КОММЕНТАРИЯХ таймлайна (crm.timeline.comment). Прямая интеграция Wazzup пишет диалог в
// комментарии, а не в crm.activity/Открытую линию, поэтому наш снимок его не видит.
//
// DEAL_ID может быть списком через запятую. По каждой сделке печатаем сводку:
//   всего комментов | Wazzup (по маркеру wazzup24.com) | свои заметки | авторы каждой группы |
//   аномалии (Wazzup не от служебного юзера / заметка от служебного) | ответственный (кому вешаем диалог).

const WH = process.env.B24_WEBHOOK_URL;
const IDS = (process.env.DEAL_ID || "99627").split(",").map((s) => s.trim()).filter(Boolean);
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

const isWazzup = (c: any): boolean => String(c.COMMENT || "").toLowerCase().includes("wazzup24.com");
const speaker = (c: any): string => {
  // формат Wazzup: "[img]...[/img]&nbsp; <Имя>: <текст>" -> вытащить <Имя>
  const t = String(c.COMMENT || "").replace(/\[img\][^\[]*\[\/img\]/gi, "").replace(/&nbsp;/g, " ").trim();
  const m = t.match(/^([^:\n]{1,60}):/);
  return m ? m[1].trim() : "?";
};

const nameCache: Record<string, string> = {};
async function uname(id: string): Promise<string> {
  if (nameCache[id]) return nameCache[id];
  try {
    const u = (await call("user.get", { ID: id })).result?.[0];
    nameCache[id] = u ? `${u.NAME || ""} ${u.LAST_NAME || ""}`.trim() || `id${id}` : `id${id}`;
  } catch { nameCache[id] = `id${id}`; }
  return nameCache[id];
}

async function commentsFor(entityType: string, entityId: string): Promise<any[]> {
  try {
    const r = await call("crm.timeline.comment.list", {
      filter: { ENTITY_ID: entityId, ENTITY_TYPE: entityType },
      order: { CREATED: "ASC" },
    });
    return r.result || [];
  } catch (e: any) { console.log(`  (${entityType} ${entityId}) ошибка: ${e.message}`); return []; }
}

(async () => {
  for (const DEAL_ID of IDS) {
    let deal: any;
    try { deal = (await call("crm.deal.get", { id: DEAL_ID })).result; }
    catch (e: any) { console.log(`\n### Сделка ${DEAL_ID}: ошибка ${e.message}`); continue; }
    const mgr = await uname(String(deal.ASSIGNED_BY_ID));
    const cs = await commentsFor("deal", DEAL_ID);
    const waz = cs.filter(isWazzup), notes = cs.filter((c) => !isWazzup(c));
    const authorsOf = async (arr: any[]) => {
      const ids = [...new Set(arr.map((c) => String(c.AUTHOR_ID)))];
      const named = await Promise.all(ids.map(async (id) => `${id}=${await uname(id)}`));
      return named.join(", ") || "-";
    };
    const speakers = [...new Set(waz.map(speaker))];
    const last = waz.length ? waz[waz.length - 1].CREATED : "-";
    // аномалии: Wazzup не от служебного (6485) ИЛИ заметка ОТ служебного
    const wazNon6485 = waz.filter((c) => String(c.AUTHOR_ID) !== "6485").length;
    const note6485 = notes.filter((c) => String(c.AUTHOR_ID) === "6485").length;

    console.log(`\n### Сделка ${DEAL_ID} | ответственный ${deal.ASSIGNED_BY_ID}=${mgr} | стадия "${deal.STAGE_ID}"`);
    console.log(`  комментов: ${cs.length} | Wazzup: ${waz.length} | свои заметки: ${notes.length} | последнее Wazzup: ${last}`);
    console.log(`  авторы Wazzup: ${await authorsOf(waz)}`);
    console.log(`  авторы заметок: ${await authorsOf(notes)}`);
    console.log(`  собеседники (префиксы Wazzup): ${speakers.join(" | ") || "-"}`);
    console.log(`  АНОМАЛИИ: Wazzup не от 6485 = ${wazNon6485} | заметка от 6485 = ${note6485}`);
  }
})().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
