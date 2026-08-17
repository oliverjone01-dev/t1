// Снимок КОММУНИКАЦИЙ Bitrix24 за окно (по умолчанию 7 дней) для страницы /dialog/.
// Хронология по сделкам: звонки, письма, WhatsApp/Telegram/MAX (Wazzup из комментариев),
// Открытые линии, дела/TODO, внутренние заметки. Пишет dialog/data/dialog.json.
// Порт логики Apps Script Ивана на Node (в Actions нет лимита 6 минут / ячеек Sheets).
// Запуск: B24_WEBHOOK_URL=... npx tsx src/scripts/b24/fetch-dialog.ts
import { writeFileSync, mkdirSync } from "node:fs";

const WH = process.env.B24_WEBHOOK_URL;
if (!WH) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const BASE = WH.replace(/\/+$/, "");
const PORTAL = process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru";
const DAYS = Math.max(1, Number(process.env.DIALOG_DAYS || 7));
const CATEGORY_ID = process.env.DIALOG_CATEGORY || ""; // "" = все воронки
const OUT = "dialog/data/dialog.json";
const CHUNK = 25; // сделок на batch (25×2 = 50 подкоманд - максимум batch)
const BODY_CAP = 4000;

const nowD = new Date();
const fromD = new Date(nowD.getTime() - DAYS * 864e5);
const iso = (d: Date) => d.toISOString().slice(0, 19);
const FROM = iso(fromD), TO = iso(nowD);
const fromMs = fromD.getTime(), toMs = nowD.getTime();

async function callB24(method: string, payload: string): Promise<any> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(`${BASE}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: payload,
      });
      const j: any = await res.json();
      if (j.error && /QUERY_LIMIT|OVERLOAD/i.test(String(j.error))) { await sleep(500 * (attempt + 1)); continue; }
      return j;
    } catch (e) { if (attempt === 4) throw e; await sleep(500 * (attempt + 1)); }
  }
  return {};
}
async function b24Batch(cmds: Record<string, string>): Promise<{ result: any; next: any }> {
  let payload = "halt=0";
  for (const k of Object.keys(cmds)) payload += `&cmd[${enc(k)}]=${encodeURIComponent(cmds[k])}`;
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

const enc = (s: string) => encodeURIComponent(s);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const selQ = (arr: string[]) => arr.map((f, i) => `&select[${i}]=${f}`).join("");
const nowISO = () => TO;
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
async function userName(id: any): Promise<string> {
  if (!id) return "";
  const k = String(id);
  if (uCache[k]) return uCache[k];
  const u = ((await callB24("user.get", `ID=${k}`)).result || [])[0];
  uCache[k] = u ? `${u.LAST_NAME || ""} ${u.NAME || ""}`.trim() : k;
  return uCache[k];
}
async function buildEmployeeSet(): Promise<Record<string, 1>> {
  const set: Record<string, 1> = {}; let start = 0;
  for (;;) {
    const r = await callB24("user.get", `FILTER[ACTIVE]=true&start=${start}`);
    for (const u of (r.result || [])) {
      const a = `${u.LAST_NAME || ""} ${u.NAME || ""}`.trim().toLowerCase();
      const b = `${u.NAME || ""} ${u.LAST_NAME || ""}`.trim().toLowerCase();
      if (a) set[a] = 1; if (b) set[b] = 1;
    }
    if (r.next === undefined || r.next === null) break; start = r.next;
  }
  return set;
}
async function buildCallMap(): Promise<Record<string, any>> {
  const map: Record<string, any> = {}; let start = 0;
  for (;;) {
    const r = await callB24("voximplant.statistic.get",
      `FILTER[>CALL_START_DATE]=${enc(FROM)}&FILTER[<=CALL_START_DATE]=${enc(TO)}&SORT=CALL_START_DATE&ORDER=ASC&start=${start}`);
    if (r.error) break;
    for (const c of (r.result || [])) {
      if (c.CRM_ACTIVITY_ID) map[String(c.CRM_ACTIVITY_ID)] = { type: String(c.CALL_TYPE), dur: c.CALL_DURATION, rec: c.CALL_RECORD_URL || "", tr: c.TRANSCRIPT_ID || "" };
    }
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
  const base = { raw: a.CREATED, dealId: "", dir, who };
  if (a.TYPE_ID === "2" || /CALL|VOX/.test(p)) {
    const ci = callMap[String(a.ID)]; let body = "Звонок", link = "";
    if (ci) {
      link = ci.rec || "";
      body = `Звонок ${ci.type === "2" ? "входящий" : ci.type === "1" ? "исходящий" : ""}${ci.dur ? ", " + durfmt(ci.dur) : ""}`;
      body += ci.tr ? " · расшифровка есть в Б24" : (ci.rec ? " · запись есть, транскрипт не сделан" : "");
    } else if (subj) body = subj;
    return { ...base, type: "Звонок", title: subj || "Звонок", body, status: a.COMPLETED === "Y" ? "состоялся" : "не состоялся", dur: ci && ci.dur ? durfmt(ci.dur) : "", link, src: "act#" + a.ID };
  }
  if (a.TYPE_ID === "4" || /EMAIL|MAIL/.test(p))
    return { ...base, type: "Письмо", title: subj, body: cap((subj ? "Тема: " + subj + "\n" : "") + (desc || "")), status: a.COMPLETED === "Y" ? "обработано" : "", dur: "", link: "", src: "act#" + a.ID };
  if (/IMOPENLINES|IMCONNECTOR|IMOL/.test(p))
    return { ...base, type: "Мессенджер ОЛ", title: subj, body: cap(desc || subj || "Сессия Открытой линии"), status: "", dur: "", link: "", src: "act#" + a.ID };
  if (a.TYPE_ID === "6" || /CRM_TODO/.test(p))
    return { raw: a.CREATED, dealId: "", dir: "-", who: mgrName, type: "Дело", title: subj, body: cap(desc || subj), status: a.COMPLETED === "Y" ? "выполнено" : (a.END_TIME && a.END_TIME < nowISO() ? "просрочено" : "запланировано"), dur: "", link: "", src: "act#" + a.ID };
  return { ...base, type: "Активность", title: subj, body: cap(desc || subj), status: a.COMPLETED === "Y" ? "выполнено" : "", dur: "", link: "", src: "act#" + a.ID };
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

async function main() {
  console.log(`Диалог: окно ${FROM} -> ${TO} (${DAYS} дн)${CATEGORY_ID ? `, воронка ${CATEGORY_ID}` : ", все воронки"}`);
  const employees = await buildEmployeeSet();
  const callMap = await buildCallMap();
  console.log(`Сотрудников ${Object.keys(employees).length}, звонков с записью/статой ${Object.keys(callMap).length}`);

  // Сделки в скоупе: активные в окне (LAST_ACTIVITY_TIME) - у них есть свежие касания/комментарии.
  let dflt = `filter[>=LAST_ACTIVITY_TIME]=${enc(FROM)}`;
  if (CATEGORY_ID) dflt += `&filter[CATEGORY_ID]=${CATEGORY_ID}`;
  const deals = await listB24("crm.deal.list", dflt, ["ID", "TITLE", "ASSIGNED_BY_ID", "CATEGORY_ID", "STAGE_ID"]);
  console.log(`Сделок в скоупе (активны в окне): ${deals.length}`);

  const actSel = ["ID", "TYPE_ID", "PROVIDER_ID", "DIRECTION", "SUBJECT", "DESCRIPTION", "CREATED", "END_TIME", "COMPLETED", "RESPONSIBLE_ID"];
  const cmtSel = ["ID", "CREATED", "COMMENT", "AUTHOR_ID"];
  const actQ = `?filter[OWNER_TYPE_ID]=2&filter[>CREATED]=${enc(FROM)}&filter[<=CREATED]=${enc(TO)}&order[CREATED]=ASC${selQ(actSel)}`;
  const cmtQ = `?filter[ENTITY_TYPE]=deal&filter[>CREATED]=${enc(FROM)}&filter[<=CREATED]=${enc(TO)}&order[CREATED]=ASC${selQ(cmtSel)}`;

  const events: any[] = [];
  const seen: Record<string, 1> = {};
  const counts: Record<string, number> = {};
  const mgrSet: Record<string, string> = {}; // name -> name (для фильтра)
  const overflow: any[] = [];

  const pushEvents = async (acts: any[], cmts: any[], d: any, mgr: string) => {
    const evs: any[] = [];
    for (const a of (acts || [])) { const e = activityToEvent(a, mgr, callMap); if (e) evs.push(e); }
    for (const c of (cmts || [])) evs.push(commentToEvent(c, employees, await userName(c.AUTHOR_ID)));
    for (const e of evs) {
      const ms = Date.parse(e.raw); if (isNaN(ms) || ms < fromMs || ms > toMs) continue;
      if (seen[e.src]) continue; seen[e.src] = 1;
      counts[e.type] = (counts[e.type] || 0) + 1;
      if (mgr) mgrSet[mgr] = mgr;
      events.push({ ts: ms, dt: e.raw, dealId: d.ID, dealTitle: stripHtml(d.TITLE), mgr, cat: String(d.CATEGORY_ID), type: e.type, dir: e.dir, who: e.who, title: e.title, body: e.body, status: e.status, dur: e.dur, link: e.link, src: e.src });
    }
  };

  for (let i = 0; i < deals.length; i += CHUNK) {
    const slice = deals.slice(i, i + CHUNK);
    const cmds: Record<string, string> = {};
    slice.forEach((d, j) => {
      cmds["a" + j] = `crm.activity.list${actQ}&filter[OWNER_ID]=${d.ID}`;
      cmds["c" + j] = `crm.timeline.comment.list${cmtQ}&filter[ENTITY_ID]=${d.ID}`;
    });
    const { result, next } = await b24Batch(cmds);
    for (let j = 0; j < slice.length; j++) {
      const d = slice[j]; const mgr = await userName(d.ASSIGNED_BY_ID);
      await pushEvents(result["a" + j] || [], result["c" + j] || [], d, mgr);
      if (next["a" + j] != null || next["c" + j] != null) overflow.push(d);
    }
    if (i % (CHUNK * 8) === 0) console.log(`  обработано сделок ${Math.min(i + CHUNK, deals.length)}/${deals.length}, событий ${events.length}`);
    await sleep(60);
  }
  // Редко: у сделки >50 записей за окно - полная догрузка.
  for (const d of overflow) {
    const mgr = await userName(d.ASSIGNED_BY_ID);
    const acts = await listB24("crm.activity.list", `filter[OWNER_TYPE_ID]=2&filter[OWNER_ID]=${d.ID}&filter[>CREATED]=${enc(FROM)}&filter[<=CREATED]=${enc(TO)}&order[CREATED]=ASC`, actSel);
    const cmts = await listB24("crm.timeline.comment.list", `filter[ENTITY_TYPE]=deal&filter[ENTITY_ID]=${d.ID}&filter[>CREATED]=${enc(FROM)}&filter[<=CREATED]=${enc(TO)}&order[CREATED]=ASC`, cmtSel);
    await pushEvents(acts, cmts, d, mgr);
  }

  events.sort((a, b) => a.ts - b.ts);
  const managers = Object.keys(mgrSet).sort().map((n) => n);
  const out = {
    generatedAt: new Date().toISOString(),
    from: FROM, to: TO, days: DAYS, category: CATEGORY_ID || "все",
    portal: PORTAL, dealsScanned: deals.length,
    managers, counts, events,
  };
  mkdirSync("dialog/data", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  const summary = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).map((k) => `${k}: ${counts[k]}`).join(" · ");
  console.log(`Готово: событий ${events.length}, менеджеров ${managers.length} -> ${OUT}`);
  console.log(`  ${summary}`);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
