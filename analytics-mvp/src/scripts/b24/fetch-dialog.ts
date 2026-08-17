// Снимок КОММУНИКАЦИЙ Bitrix24 за окно (по умолчанию 7 дней) для страницы /dialog/.
// СКОУП GG: сделки воронки «Заказы RF» (CATEGORY_ID, по умолчанию 49) + воронка «Лиды».
// Хронология по сделке/лиду: звонки, письма, WhatsApp/Telegram/MAX (Wazzup из комментариев),
// Открытые линии, дела/TODO, заметки. Пишет dialog/data/dialog.json.
// Активности + комментарии тянем поэлементно батчами по 25 (50 подкоманд) с параллельностью.
// Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/fetch-dialog.ts
import { writeFileSync, mkdirSync } from "node:fs";

const WH = process.env.B24_WEBHOOK_URL;
if (!WH) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const BASE = WH.replace(/\/+$/, "");
const PORTAL = process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru";
const DAYS = Math.max(1, Number(process.env.DIALOG_DAYS || 7));
const CATEGORY_ID = process.env.DIALOG_CATEGORY ?? "49"; // воронка сделок GG «Заказы RF»
const WITH_LEADS = process.env.DIALOG_NOLEADS !== "1";   // воронка «Лиды» (по умолчанию включена)
const OUT = "dialog/data/dialog.json";
const EBATCH = 25;  // сущностей на batch (25×2 = 50 подкоманд - максимум)
const CONC = 4;     // параллельных batch-запросов
const BODY_CAP = 4000;

const nowD = new Date();
const fromD = new Date(nowD.getTime() - DAYS * 864e5);
const iso = (d: Date) => d.toISOString().slice(0, 19);
const FROM = iso(fromD), TO = iso(nowD);
const fromMs = fromD.getTime(), toMs = nowD.getTime();

const enc = (s: string) => encodeURIComponent(s);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const selQ = (arr: string[]) => arr.map((f, i) => `&select[${i}]=${f}`).join("");

async function callB24(method: string, payload: string): Promise<any> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${BASE}/${method}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: payload });
      const j: any = await res.json();
      if (j.error && /QUERY_LIMIT|OVERLOAD/i.test(String(j.error))) { await sleep(400 * (attempt + 1)); continue; }
      return j;
    } catch (e) { if (attempt === 5) throw e; await sleep(400 * (attempt + 1)); }
  }
  return {};
}
async function b24Batch(cmds: Record<string, string>): Promise<{ result: any; next: any }> {
  let payload = "halt=0";
  for (const k of Object.keys(cmds)) payload += `&cmd[${enc(k)}]=${encodeURIComponent(cmds[k] ?? "")}`;
  const j = await callB24("batch", payload);
  const r = j.result || {};
  return { result: r.result || {}, next: r.result_next || {} };
}
async function listB24(method: string, filterStr: string, selectArr: string[]): Promise<any[]> {
  const out: any[] = []; let start = 0;
  const sel = (selectArr || []).map((f, i) => `select[${i}]=${f}`).join("&");
  for (;;) {
    const r = await callB24(method, `${filterStr}${sel ? "&" + sel : ""}&start=${start}`);
    const items = r.result && r.result.items ? r.result.items : (r.result || []);
    out.push(...items);
    if (r.next === undefined || r.next === null) break;
    start = r.next;
  }
  return out;
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
    const r = await callB24("user.get", `FILTER[ACTIVE]=true&start=${start}`);
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
  const u = ((await callB24("user.get", `ID=${k}`)).result || [])[0];
  uCache[k] = u ? `${u.LAST_NAME || ""} ${u.NAME || ""}`.trim() : k;
  return uCache[k];
}
async function buildCallMap(): Promise<Record<string, any>> {
  const map: Record<string, any> = {}; let start = 0;
  for (;;) {
    const r = await callB24("voximplant.statistic.get", `FILTER[>CALL_START_DATE]=${enc(FROM)}&FILTER[<=CALL_START_DATE]=${enc(TO)}&SORT=CALL_START_DATE&ORDER=ASC&start=${start}`);
    if (r.error) break;
    for (const c of (r.result || [])) if (c.CRM_ACTIVITY_ID) map[String(c.CRM_ACTIVITY_ID)] = { type: String(c.CALL_TYPE), dur: c.CALL_DURATION, rec: c.CALL_RECORD_URL || "", recId: c.RECORD_FILE_ID || "", tr: c.TRANSCRIPT_ID || "" };
    if (r.next === undefined || r.next === null) break; start = r.next;
  }
  return map;
}

function activityToEvent(a: any, mgrName: string, callMap: Record<string, any>): any {
  const p = String(a.PROVIDER_ID || "").toUpperCase();
  if (/SMS|NOTIFICATION|REST_APP/.test(p)) return null;
  const dir = a.DIRECTION === "1" ? "входящее" : a.DIRECTION === "2" ? "исходящее" : "-";
  const who = a.DIRECTION === "1" ? "Клиент" : mgrName;
  const subj = stripHtml(a.SUBJECT), desc = stripHtml(a.DESCRIPTION);
  if (a.TYPE_ID === "2" || /CALL|VOX/.test(p)) {
    const ci = callMap[String(a.ID)]; let body = "Звонок", link = "";
    if (ci) {
      link = ci.rec || "";
      const hasRec = ci.rec || ci.recId;
      body = `Звонок ${ci.type === "2" ? "входящий" : ci.type === "1" ? "исходящий" : ""}${ci.dur ? ", " + durfmt(ci.dur) : ""}`;
      body += ci.tr ? " · есть расшифровка" : (hasRec ? " · запись есть (в карточке Б24), транскрипта нет" : "");
    } else if (subj) body = subj;
    return { raw: a.CREATED, dir, who, type: "Звонок", title: subj || "Звонок", body, status: a.COMPLETED === "Y" ? "состоялся" : "не состоялся", dur: ci && ci.dur ? durfmt(ci.dur) : "", link, src: "act#" + a.ID };
  }
  if (a.TYPE_ID === "4" || /EMAIL|MAIL/.test(p))
    return { raw: a.CREATED, dir, who, type: "Письмо", title: subj, body: cap((subj ? "Тема: " + subj + "\n" : "") + (desc || "")), status: a.COMPLETED === "Y" ? "обработано" : "", dur: "", link: "", src: "act#" + a.ID };
  if (/IMOPENLINES|IMCONNECTOR|IMOL/.test(p))
    return { raw: a.CREATED, dir, who, type: "Мессенджер ОЛ", title: subj, body: cap(desc || subj || "Сессия Открытой линии"), status: "", dur: "", link: "", src: "act#" + a.ID };
  if (a.TYPE_ID === "6" || /CRM_TODO/.test(p))
    return { raw: a.CREATED, dir: "-", who: mgrName, type: "Дело", title: subj, body: cap(desc || subj), status: a.COMPLETED === "Y" ? "выполнено" : (a.END_TIME && a.END_TIME < TO ? "просрочено" : "запланировано"), dur: "", link: "", src: "act#" + a.ID };
  return { raw: a.CREATED, dir, who, type: "Активность", title: subj, body: cap(desc || subj), status: a.COMPLETED === "Y" ? "выполнено" : "", dur: "", link: "", src: "act#" + a.ID };
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
  console.log(`Диалог GG: окно ${FROM} -> ${TO} (${DAYS} дн), сделки воронки ${CATEGORY_ID}${WITH_LEADS ? " + лиды" : ""}`);
  const employees = await buildEmployeeSet();
  const callMap = await buildCallMap();
  console.log(`Сотрудников ${Object.keys(employees).length / 2 | 0}, звонков со статой ${Object.keys(callMap).length}`);

  // Скоуп: сделки воронки GG + лиды, активные в окне.
  const ents: Ent[] = [];
  const dealFlt = `filter[>=LAST_ACTIVITY_TIME]=${enc(FROM)}&filter[CATEGORY_ID]=${CATEGORY_ID}`;
  const deals = await listB24("crm.deal.list", dealFlt, ["ID", "TITLE", "ASSIGNED_BY_ID", "LEAD_ID"]);
  const leadToDeal: Record<string, string> = {}, dealSrcLead: Record<string, string> = {}, dealTitle: Record<string, string> = {}, leadTitle: Record<string, string> = {};
  for (const d of deals) {
    const id = String(d.ID); const t = stripHtml(d.TITLE) || ("Сделка " + id);
    ents.push({ kind: "deal", id, title: t, mgrId: String(d.ASSIGNED_BY_ID || "") });
    dealTitle[id] = t;
    if (d.LEAD_ID && String(d.LEAD_ID) !== "0") { leadToDeal[String(d.LEAD_ID)] = id; dealSrcLead[id] = String(d.LEAD_ID); }
  }
  let leadsN = 0;
  if (WITH_LEADS) {
    // Скоуп лидов: созданные в окне (DATE_CREATE - реальный intake, фильтр работает) + лиды-источники
    // сделок в скоупе (для пути лид->сделка). LAST_ACTIVITY_TIME у лидов Bitrix игнорирует и отдаёт ВСЕ
    // лиды портала (десятки тысяч), поэтому им не пользуемся.
    const leadInfo: Record<string, any> = {};
    const leadIds = new Set<string>();
    const created = await listB24("crm.lead.list", `filter[>=DATE_CREATE]=${enc(FROM)}`, ["ID", "TITLE", "ASSIGNED_BY_ID"]);
    for (const l of created) { const id = String(l.ID); leadIds.add(id); leadInfo[id] = l; }
    for (const lid of Object.keys(leadToDeal)) leadIds.add(lid);
    // добрать инфо для лидов-источников, созданных до окна
    for (const id of leadIds) {
      if (leadInfo[id]) continue;
      try { const l = (await callB24("crm.lead.get", `id=${id}`)).result; if (l) leadInfo[id] = l; } catch { /* пропуск */ }
    }
    for (const id of leadIds) {
      const l = leadInfo[id]; const t = l ? (stripHtml(l.TITLE) || ("Лид " + id)) : ("Лид " + id);
      ents.push({ kind: "lead", id, title: t, mgrId: String((l && l.ASSIGNED_BY_ID) || "") }); leadTitle[id] = t;
    }
    leadsN = leadIds.size;
  }
  console.log(`Скоуп: сделок ${deals.length} + лидов ${leadsN} = ${ents.length} сущностей`);

  // Активности + комментарии поэлементно, батчами по 25 (50 подкоманд), параллельность CONC.
  const aSel = ["ID", "TYPE_ID", "PROVIDER_ID", "DIRECTION", "SUBJECT", "DESCRIPTION", "CREATED", "END_TIME", "COMPLETED", "RESPONSIBLE_ID"];
  const cSel = ["ID", "CREATED", "COMMENT", "AUTHOR_ID"];
  const actQ = (ot: number) => `?filter[OWNER_TYPE_ID]=${ot}&filter[>CREATED]=${enc(FROM)}&filter[<=CREATED]=${enc(TO)}&order[CREATED]=ASC${selQ(aSel)}`;
  const cmtQ = (et: string) => `?filter[ENTITY_TYPE]=${et}&filter[>CREATED]=${enc(FROM)}&filter[<=CREATED]=${enc(TO)}&order[CREATED]=ASC${selQ(cSel)}`;
  const actsBy: Record<string, any[]> = {}, cmtsBy: Record<string, any[]> = {};
  const chunks: Ent[][] = [];
  for (let i = 0; i < ents.length; i += EBATCH) chunks.push(ents.slice(i, i + EBATCH));
  let done = 0;
  const runChunk = async (slice: Ent[]) => {
    const cmds: Record<string, string> = {};
    slice.forEach((e, j) => {
      const ot = e.kind === "deal" ? 2 : 1;
      cmds["a" + j] = `crm.activity.list${actQ(ot)}&filter[OWNER_ID]=${e.id}`;
      cmds["c" + j] = `crm.timeline.comment.list${cmtQ(e.kind)}&filter[ENTITY_ID]=${e.id}`;
    });
    const { result } = await b24Batch(cmds);
    slice.forEach((e, j) => { const key = e.kind + ":" + e.id; actsBy[key] = result["a" + j] || []; cmtsBy[key] = result["c" + j] || []; });
    done += slice.length;
    if (done % (EBATCH * 4) < EBATCH) console.log(`  обработано ${done}/${ents.length}`);
  };
  let ci = 0;
  await Promise.all(Array.from({ length: CONC }, async () => { for (;;) { const idx = ci++; if (idx >= chunks.length) break; await runChunk(chunks[idx]!); } }));

  const events: any[] = [];
  const seen: Record<string, 1> = {};
  const counts: Record<string, number> = {};
  const mgrSet: Record<string, 1> = {};
  for (const e of ents) {
    const key = e.kind + ":" + e.id;
    const mgr = await userName(e.mgrId);
    // Пара «лид↔сделка»: у сделки - её сделка + лид-источник; у лида - лид + сделка, в которую он ушёл.
    let leadId = "", dealId = "", leadT = "", dealT = "";
    if (e.kind === "deal") { dealId = e.id; dealT = e.title; leadId = dealSrcLead[e.id] || ""; leadT = leadId ? (leadTitle[leadId] || "") : ""; }
    else { leadId = e.id; leadT = e.title; dealId = leadToDeal[e.id] || ""; dealT = dealId ? (dealTitle[dealId] || "") : ""; }
    const pair = leadId + "|" + dealId;
    const evs: any[] = [];
    for (const a of (actsBy[key] || [])) { const ev = activityToEvent(a, mgr, callMap); if (ev) evs.push(ev); }
    for (const c of (cmtsBy[key] || [])) evs.push(commentToEvent(c, employees, await userName(c.AUTHOR_ID)));
    for (const ev of evs) {
      const ms = Date.parse(ev.raw); if (isNaN(ms) || ms < fromMs || ms > toMs) continue;
      // дедуп по паре: одно и то же Wazzup-сообщение висит и на лиде, и на сделке (одинаковый ID).
      const uid = pair + "|" + ev.src;
      if (seen[uid]) continue; seen[uid] = 1;
      counts[ev.type] = (counts[ev.type] || 0) + 1;
      if (mgr) mgrSet[mgr] = 1;
      events.push({ ts: ms, dt: ev.raw, stage: e.kind, leadId, dealId, leadT, dealT, mgr, type: ev.type, dir: ev.dir, who: ev.who, title: ev.title, body: ev.body, status: ev.status, dur: ev.dur, link: ev.link, src: ev.src });
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
