// Снимок КОММУНИКАЦИЙ Bitrix24 за окно (по умолчанию 7 дней) для страницы /dialog/.
// СКОУП как в дашборде GG: сделки воронки «Заказы RF» (CATEGORY_ID, по умолчанию 49) + лиды.
// Хронология по сделке/лиду: звонки, письма, WhatsApp/Telegram/MAX (Wazzup из комментариев),
// Открытые линии, дела/TODO, заметки. Путь лид->сделка (по LEAD_ID) сливается в один диалог.
// ВАЖНО: запросы шлём JSON-телом (как fetch-rop), иначе Bitrix игнорирует фильтры с >=/<=.
// Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/fetch-dialog.ts
import { writeFileSync, mkdirSync } from "node:fs";

const WH = process.env.B24_WEBHOOK_URL;
if (!WH) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const BASE = WH.replace(/\/+$/, "");
const PORTAL = process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru";
const DAYS = Math.max(1, Number(process.env.DIALOG_DAYS || 7));
const CATEGORY_ID = process.env.DIALOG_CATEGORY ?? "49";
const WITH_LEADS = process.env.DIALOG_NOLEADS !== "1";
const OUT = "dialog/data/dialog.json";
const EBATCH = 25;  // сущностей на batch (25×2 = 50 подкоманд - максимум)
const CONC = 4;
const BODY_CAP = 4000;

const nowD = new Date();
const fromD = new Date(nowD.getTime() - DAYS * 864e5);
const iso = (d: Date) => d.toISOString().slice(0, 19);
const FROM = iso(fromD), TO = iso(nowD);
const fromMs = fromD.getTime(), toMs = nowD.getTime();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Запрос к Bitrix JSON-телом (как fetch-rop): фильтры-объекты применяются корректно.
async function call(method: string, params: any = {}): Promise<any> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${BASE}/${method}.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(30000),
      });
      const j: any = await res.json();
      if (j.error) { if (/QUERY_LIMIT|OPERATION_TIME_LIMIT|OVERLOAD/i.test(String(j.error))) { await sleep(1200); continue; } return j; }
      return j;
    } catch (e) { if (attempt === 5) throw e; await sleep(600 * (attempt + 1)); }
  }
  return {};
}
// Пагинация списка (start/next), params-объект.
async function listAll(method: string, params: any): Promise<any[]> {
  const out: any[] = []; let start = 0;
  for (;;) {
    const j = await call(method, { ...params, start });
    const items = j.result && j.result.items ? j.result.items : (j.result || []);
    out.push(...items);
    if (j.next === undefined || j.next === null || !items.length) break;
    start = j.next;
  }
  return out;
}
// Batch: cmd - объект {ключ: "method?query"}. Возвращает {result, next}.
async function callBatch(cmds: Record<string, string>): Promise<{ result: any; next: any }> {
  const j = await call("batch", { halt: 0, cmd: cmds });
  const r = j.result || {};
  return { result: r.result || {}, next: r.result_next || {} };
}

function stripHtml(s: any): string {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n")
    .replace(/\[\/?[a-z][^\]]*\]/gi, " ").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&quot;/gi, '"').replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
const durfmt = (sec: any) => { const s = parseInt(sec, 10) || 0; return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const cap = (s: string) => (s.length > BODY_CAP ? s.slice(0, BODY_CAP) + " …[обрезано]" : s);

const uCache: Record<string, string> = {};
async function buildEmployeeSet(): Promise<Record<string, 1>> {
  const set: Record<string, 1> = {}; let start = 0;
  for (;;) {
    const r = await call("user.get", { FILTER: { ACTIVE: true }, start });
    for (const u of (r.result || [])) {
      const a = `${u.LAST_NAME || ""} ${u.NAME || ""}`.trim().toLowerCase();
      const b = `${u.NAME || ""} ${u.LAST_NAME || ""}`.trim().toLowerCase();
      if (a) set[a] = 1; if (b) set[b] = 1;
      uCache[String(u.ID)] = `${u.LAST_NAME || ""} ${u.NAME || ""}`.trim() || String(u.ID);
    }
    if (r.next === undefined || r.next === null) break; start = r.next;
  }
  return set;
}
async function userName(id: any): Promise<string> {
  if (!id) return "";
  const k = String(id);
  if (uCache[k]) return uCache[k];
  const u = ((await call("user.get", { ID: k })).result || [])[0];
  uCache[k] = u ? `${u.LAST_NAME || ""} ${u.NAME || ""}`.trim() : k;
  return uCache[k];
}
async function buildCallMap(): Promise<Record<string, any>> {
  const map: Record<string, any> = {}; let start = 0;
  for (;;) {
    const r = await call("voximplant.statistic.get", { FILTER: { ">CALL_START_DATE": FROM, "<=CALL_START_DATE": TO }, SORT: "CALL_START_DATE", ORDER: "ASC", start });
    if (r.error) break;
    for (const c of (r.result || [])) if (c.CRM_ACTIVITY_ID) map[String(c.CRM_ACTIVITY_ID)] = { type: String(c.CALL_TYPE), dur: c.CALL_DURATION, rec: c.CALL_RECORD_URL || "", recId: c.RECORD_FILE_ID || "", tr: c.TRANSCRIPT_ID || "" };
    if (r.next === undefined || r.next === null) break; start = r.next;
  }
  return map;
}

// Время звонка для подписи резюме: «17.08 14:09».
function shortDT(s: any): string {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}.${m[2]} ${m[4]}:${m[5]}` : "";
}
// Срок дела. У новых дел (CRM_TODO) время стоит в DEADLINE, у старых активностей - в END_TIME;
// START_TIME остаётся запасным. Bitrix отдаёт «пустой» срок сентинелом 9999-… и 1970-…, такие режем.
function dueOf(a: any): string {
  for (const v of [a.DEADLINE, a.END_TIME, a.START_TIME]) {
    const s = String(v || "");
    if (!/^\d{4}-\d{2}-\d{2}T/.test(s)) continue;
    const y = Number(s.slice(0, 4));
    if (y < 2000 || y > 2100) continue;
    return s;
  }
  return "";
}
function activityToEvent(a: any, mgrName: string, callMap: Record<string, any>, callRefs: Record<string, any>): any {
  const p = String(a.PROVIDER_ID || "").toUpperCase();
  if (/SMS|NOTIFICATION|REST_APP/.test(p)) return null;
  const dir = a.DIRECTION === "1" ? "входящее" : a.DIRECTION === "2" ? "исходящее" : "-";
  const who = a.DIRECTION === "1" ? "Клиент" : mgrName;
  const subj = stripHtml(a.SUBJECT), desc = stripHtml(a.DESCRIPTION);
  const st = a.SETTINGS && !Array.isArray(a.SETTINGS) ? a.SETTINGS : {};
  if (a.TYPE_ID === "2" || /CALL|VOX/.test(p)) {
    const ci = callMap[String(a.ID)]; let body = "Звонок", link = "";
    const f = Array.isArray(a.FILES) ? a.FILES[0] : null;   // запись звонка в карточке
    if (ci) {
      link = ci.rec || (f && f.url) || "";
      const hasRec = ci.rec || ci.recId || (f && f.url);
      body = `Звонок ${ci.type === "2" ? "входящий" : ci.type === "1" ? "исходящий" : ""}${ci.dur ? ", " + durfmt(ci.dur) : ""}`;
      body += ci.tr ? " · есть расшифровка" : (hasRec ? " · запись есть (в карточке Б24), транскрипта нет" : "");
    } else { if (subj) body = subj; if (f && f.url) { link = f.url; body += " · запись есть (в карточке Б24)"; } }
    return { raw: a.CREATED, dir, who, type: "Звонок", title: subj || "Звонок", body, status: a.COMPLETED === "Y" ? "состоялся" : "не состоялся", dur: ci && ci.dur ? durfmt(ci.dur) : "", link, src: "act#" + a.ID };
  }
  // Резюме BitrixGPT: дело с меткой IS_AI_CREATED. ASSOCIATED_ENTITY_ID - ID звонка-источника.
  if (st.IS_AI_CREATED === true || st.IS_AI_CREATED === "true") {
    const src = String(a.ASSOCIATED_ENTITY_ID || "");
    const c = src ? callRefs[src] : null;
    const ref = c ? `к звонку #${src} · ${shortDT(c.CREATED)}${c.SUBJECT ? " · " + stripHtml(c.SUBJECT) : ""}` : "";
    return { raw: a.CREATED, dir: "-", who: "BitrixGPT", type: "Резюме BitrixGPT", title: subj, body: cap(desc || subj), status: "", dur: "", link: "", ref, refId: src, src: "act#" + a.ID };
  }
  if (a.TYPE_ID === "4" || /EMAIL|MAIL/.test(p))
    return { raw: a.CREATED, dir, who, type: "Письмо", title: subj, body: cap((subj ? "Тема: " + subj + "\n" : "") + (desc || "")), status: a.COMPLETED === "Y" ? "обработано" : "", dur: "", link: "", src: "act#" + a.ID };
  if (/IMOPENLINES|IMCONNECTOR|IMOL/.test(p))
    return { raw: a.CREATED, dir, who, type: "Мессенджер ОЛ", title: subj, body: cap(desc || subj || "Сессия Открытой линии"), status: "", dur: "", link: "", src: "act#" + a.ID };
  if (a.TYPE_ID === "6" || /CRM_TODO/.test(p)) {
    const due = dueOf(a);
    const status = a.COMPLETED === "Y" ? "выполнено" : (due && due < TO ? "просрочено" : "запланировано");
    return { raw: a.CREATED, dir: "-", who: mgrName, type: "Дело", title: subj, body: cap(desc || subj), status, due, dur: "", link: "", src: "act#" + a.ID };
  }
  return { raw: a.CREATED, dir, who, type: "Активность", title: subj, body: cap(desc || subj), status: a.COMPLETED === "Y" ? "выполнено" : "", due: dueOf(a), dur: "", link: "", src: "act#" + a.ID };
}
function commentToEvent(c: any, employees: Record<string, 1>, authorName: string): any {
  const raw = String(c.COMMENT || "");
  if (/wazzup24\.com/i.test(raw)) {
    let chan = "WhatsApp";
    const mi = raw.match(/wazzup24\.com\/images\/bitrix\/(\w+)\.(?:png|svg|jpg)/i);
    if (mi) { const k = (mi[1] || "").toLowerCase(); chan = k === "max" ? "MAX" : k === "telegram" ? "Telegram" : (k === "whatsapp" || k === "wapp") ? "WhatsApp" : k === "instagram" ? "Instagram" : k.charAt(0).toUpperCase() + k.slice(1); }
    let body = stripHtml(raw.replace(/\[img\][^\[]*\[\/img\]/gi, " ").replace(/&nbsp;/gi, " "));
    let nm = "", tx = body; const idx = body.indexOf(":");
    if (idx > 0 && idx < 40) { nm = body.slice(0, idx).trim(); tx = body.slice(idx + 1).trim(); }
    const isEmp = nm && employees[nm.toLowerCase()];
    return { raw: c.CREATED, type: "Сообщение " + chan, dir: isEmp ? "исходящее" : "входящее", who: nm || "—", title: "", body: cap(tx), status: "", dur: "", link: "", src: "cmt#" + c.ID };
  }
  return { raw: c.CREATED, type: "Комментарий-заметка", dir: "-", who: authorName, title: "", body: cap(stripHtml(raw)), status: "", dur: "", link: "", src: "cmt#" + c.ID };
}

type Ent = { kind: "deal" | "lead"; id: string; title: string; mgrId: string };

async function main() {
  console.log(`Диалог GG: окно ${FROM} -> ${TO} (${DAYS} дн), воронка ${CATEGORY_ID}${WITH_LEADS ? " + лиды" : ""}`);
  const employees = await buildEmployeeSet();
  const callMap = await buildCallMap();
  console.log(`Сотрудников ${Object.keys(employees).length / 2 | 0}, звонков со статой ${Object.keys(callMap).length}`);

  // Сделки воронки GG, активные в окне (фильтр-объект применяется, т.к. JSON-тело).
  const ents: Ent[] = [];
  const leadToDeal: Record<string, string> = {}, dealSrcLead: Record<string, string> = {}, dealTitle: Record<string, string> = {}, leadTitle: Record<string, string> = {};
  const deals = await listAll("crm.deal.list", { select: ["ID", "TITLE", "ASSIGNED_BY_ID", "LEAD_ID"], filter: { CATEGORY_ID: CATEGORY_ID, ">=LAST_ACTIVITY_TIME": FROM } });
  for (const d of deals) {
    const id = String(d.ID); const t = stripHtml(d.TITLE) || ("Сделка " + id);
    ents.push({ kind: "deal", id, title: t, mgrId: String(d.ASSIGNED_BY_ID || "") });
    dealTitle[id] = t;
    if (d.LEAD_ID && String(d.LEAD_ID) !== "0") { leadToDeal[String(d.LEAD_ID)] = id; dealSrcLead[id] = String(d.LEAD_ID); }
  }
  let leadsN = 0;
  if (WITH_LEADS) {
    // Лиды: созданные в окне (реальный intake отдела продаж) + источники сделок в скоупе.
    const leads = await listAll("crm.lead.list", { select: ["ID", "TITLE", "ASSIGNED_BY_ID"], filter: { ">=DATE_CREATE": FROM } });
    const leadInfo: Record<string, any> = {}; const leadIds = new Set<string>();
    for (const l of leads) { const id = String(l.ID); leadInfo[id] = l; leadIds.add(id); }
    for (const lid of Object.keys(leadToDeal)) leadIds.add(lid);
    for (const id of leadIds) { if (leadInfo[id]) continue; try { const l = (await call("crm.lead.get", { id })).result; if (l) leadInfo[id] = l; } catch { /* пропуск */ } }
    for (const id of leadIds) {
      const l = leadInfo[id]; const t = l ? (stripHtml(l.TITLE) || ("Лид " + id)) : ("Лид " + id);
      ents.push({ kind: "lead", id, title: t, mgrId: String((l && l.ASSIGNED_BY_ID) || "") }); leadTitle[id] = t;
    }
    leadsN = leadIds.size;
  }
  console.log(`Скоуп: сделок ${deals.length} + лидов ${leadsN} = ${ents.length} сущностей`);

  // Активности + комментарии поэлементно, батчами по 25 (JSON-тело в call), параллельность CONC.
  // В batch-cmd используем только >CREATED (одиночный >, парсится); верхнюю границу режем на клиенте.
  const aSel = "&select[0]=ID&select[1]=TYPE_ID&select[2]=PROVIDER_ID&select[3]=DIRECTION&select[4]=SUBJECT&select[5]=DESCRIPTION&select[6]=CREATED&select[7]=END_TIME&select[8]=COMPLETED&select[9]=RESPONSIBLE_ID&select[10]=SETTINGS&select[11]=ASSOCIATED_ENTITY_ID&select[12]=FILES&select[13]=START_TIME&select[14]=DEADLINE";
  const cSel = "&select[0]=ID&select[1]=CREATED&select[2]=COMMENT&select[3]=AUTHOR_ID";
  const actsBy: Record<string, any[]> = {}, cmtsBy: Record<string, any[]> = {};
  const chunks: Ent[][] = [];
  for (let i = 0; i < ents.length; i += EBATCH) chunks.push(ents.slice(i, i + EBATCH));
  let done = 0;
  const runChunk = async (slice: Ent[]) => {
    const cmds: Record<string, string> = {};
    slice.forEach((e, j) => {
      const ot = e.kind === "deal" ? 2 : 1;
      cmds["a" + j] = `crm.activity.list?filter[OWNER_TYPE_ID]=${ot}&filter[OWNER_ID]=${e.id}&filter[>CREATED]=${encodeURIComponent(FROM)}&order[CREATED]=ASC${aSel}`;
      cmds["c" + j] = `crm.timeline.comment.list?filter[ENTITY_TYPE]=${e.kind}&filter[ENTITY_ID]=${e.id}&filter[>CREATED]=${encodeURIComponent(FROM)}&order[CREATED]=ASC${cSel}`;
    });
    const { result } = await callBatch(cmds);
    slice.forEach((e, j) => { const key = e.kind + ":" + e.id; actsBy[key] = result["a" + j] || []; cmtsBy[key] = result["c" + j] || []; });
    done += slice.length;
    if (done % (EBATCH * 4) < EBATCH) console.log(`  обработано ${done}/${ents.length}`);
  };
  let ci = 0;
  await Promise.all(Array.from({ length: CONC }, async () => { for (;;) { const idx = ci++; if (idx >= chunks.length) break; await runChunk(chunks[idx]!); } }));

  // Справочник звонков для привязки AI-резюме (ASSOCIATED_ENTITY_ID -> звонок).
  // Всё загруженное кладём сразу; недостающие (звонок старше окна) добираем точечно.
  const callRefs: Record<string, any> = {};
  const needRef = new Set<string>();
  for (const list of Object.values(actsBy)) for (const a of list) {
    if (a.TYPE_ID === "2" || /CALL|VOX/.test(String(a.PROVIDER_ID || "").toUpperCase())) callRefs[String(a.ID)] = a;
    const s = a.SETTINGS && !Array.isArray(a.SETTINGS) ? a.SETTINGS : {};
    if ((s.IS_AI_CREATED === true || s.IS_AI_CREATED === "true") && a.ASSOCIATED_ENTITY_ID) needRef.add(String(a.ASSOCIATED_ENTITY_ID));
  }
  for (const id of needRef) {
    if (callRefs[id]) continue;
    try { const r = (await call("crm.activity.get", { id })).result; if (r) callRefs[id] = r; } catch { /* пропуск */ }
  }

  const events: any[] = [];
  const seen: Record<string, 1> = {};
  const counts: Record<string, number> = {};
  const mgrSet: Record<string, 1> = {};
  for (const e of ents) {
    const key = e.kind + ":" + e.id;
    const mgr = await userName(e.mgrId);
    let leadId = "", dealId = "", leadT = "", dealT = "";
    if (e.kind === "deal") { dealId = e.id; dealT = e.title; leadId = dealSrcLead[e.id] || ""; leadT = leadId ? (leadTitle[leadId] || "") : ""; }
    else { leadId = e.id; leadT = e.title; dealId = leadToDeal[e.id] || ""; dealT = dealId ? (dealTitle[dealId] || "") : ""; }
    const pair = leadId + "|" + dealId;
    const evs: any[] = [];
    for (const a of (actsBy[key] || [])) { const ev = activityToEvent(a, mgr, callMap, callRefs); if (ev) evs.push(ev); }
    for (const c of (cmtsBy[key] || [])) evs.push(commentToEvent(c, employees, await userName(c.AUTHOR_ID)));
    for (const ev of evs) {
      const ms = Date.parse(ev.raw); if (isNaN(ms) || ms < fromMs || ms > toMs) continue;
      const uid = pair + "|" + ev.src;
      if (seen[uid]) continue; seen[uid] = 1;
      counts[ev.type] = (counts[ev.type] || 0) + 1;
      if (mgr) mgrSet[mgr] = 1;
      events.push({ ts: ms, dt: ev.raw, stage: e.kind, leadId, dealId, leadT, dealT, mgr, type: ev.type, dir: ev.dir, who: ev.who, title: ev.title, body: ev.body, status: ev.status, dur: ev.dur, link: ev.link, ref: ev.ref || "", src: ev.src });
    }
  }
  events.sort((a, b) => a.ts - b.ts);
  const leadKeys = new Set(events.filter((e) => e.leadId).map((e) => e.leadId));
  const dealKeys = new Set(events.filter((e) => e.dealId).map((e) => e.dealId));
  const managers = Object.keys(mgrSet).sort();
  const out = { generatedAt: new Date().toISOString(), from: FROM, to: TO, days: DAYS, scope: `Заказы RF (воронка ${CATEGORY_ID})${WITH_LEADS ? " + Лиды" : ""}`, portal: PORTAL, dealsScanned: ents.length, dealCount: dealKeys.size, leadCount: leadKeys.size, managers, counts, events };
  mkdirSync("dialog/data", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  const summary = Object.keys(counts).sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0)).map((k) => `${k}: ${counts[k] ?? 0}`).join(" · ");
  console.log(`Готово: событий ${events.length}, сделок ${dealKeys.size} + лидов ${leadKeys.size}, менеджеров ${managers.length} -> ${OUT}`);
  console.log(`  ${summary}`);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
