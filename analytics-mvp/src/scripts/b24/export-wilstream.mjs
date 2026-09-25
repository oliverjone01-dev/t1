// Разовый экспорт всех контактов, пришедших от колл-центра Wilstream (обзвон мастерских
// памятников для GLASS-MEMORY). Бежит только в GitHub Actions (нужен B24_WEBHOOK_URL).
// Где ищем (все воронки, без ограничения по дате):
//  1) источник: справочник SOURCE (поле SOURCE_ID) и пользовательские поля контакта/сделки/лида
//     с названием «Источник», значение которых похоже на Wilstream;
//  2) контакты, сделки, лиды с этим источником + сделки на стадиях WILSTREAM / ОБЗВОН WL
//     и сущности со словом Wilstream в названии;
//  3) письма-анкеты Wilstream (из них достаём название мастерской, город, телефоны, ФИО).
// Пишет exports/wilstream-contacts.xlsx (несколько листов) и exports/wilstream-log.txt.
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const RX = /wil+\s*-?\s*str|вил+\s*-?\s*стр|вильстр/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOG = [];
const log = (...a) => { const s = a.join(" "); LOG.push(s); console.log(s); };

async function call(method, params = {}) {
  let last;
  for (let a = 0; a < 6; a++) {
    try {
      const res = await fetch(`${BASE}/${method}.json`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params), signal: AbortSignal.timeout(30000),
      });
      const j = await res.json();
      if (j.error) {
        if (/QUERY_LIMIT|OPERATION_TIME_LIMIT/i.test(String(j.error))) { await sleep(1200); continue; }
        throw new Error(`${method}: ${j.error_description || j.error}`);
      }
      return j;
    } catch (e) { last = e; await sleep(600 * (a + 1)); }
  }
  throw last;
}
async function listAll(method, params) {
  const all = []; let start = 0;
  for (;;) {
    const j = await call(method, { ...params, start });
    const b = Array.isArray(j.result) ? j.result : (j.result && j.result.items) || [];
    all.push(...b);
    if (j.next === undefined || !b.length) break; start = j.next;
  }
  return all;
}
const safe = async (label, fn, dflt = []) => { try { return await fn(); } catch (e) { log(`! ${label}: ${e.message}`); return dflt; } };
const byId = (arr) => { const m = {}; for (const x of arr) m[String(x.ID)] = x; return m; };
const chunk = (a, n) => { const r = []; for (let i = 0; i < a.length; i += n) r.push(a.slice(i, i + n)); return r; };

// ---------- справочники ----------
const users = await safe("user.get", () => listAll("user.get", {}));
const uName = {}; for (const u of users) uName[String(u.ID)] = `${u.NAME || ""} ${u.LAST_NAME || ""}`.trim();
const sources = await safe("SOURCE", async () => (await call("crm.status.list", { filter: { ENTITY_ID: "SOURCE" } })).result || []);
const srcName = {}; for (const s of sources) srcName[s.STATUS_ID] = s.NAME;
const wSrc = sources.filter((s) => RX.test(s.NAME) || RX.test(s.STATUS_ID)).map((s) => s.STATUS_ID);
log(`Источники (SOURCE) всего ${sources.length}; похожие на Wilstream: ${wSrc.map((id) => `${id}=${srcName[id]}`).join(", ") || "нет"}`);

// Пользовательские поля «Источник» (UF_*) у контакта/сделки/лида/компании.
async function ufFilters(entity) {
  const f = await safe(`crm.${entity}.fields`, async () => (await call(`crm.${entity}.fields`)).result || {}, {});
  const out = [];
  for (const [code, d] of Object.entries(f)) {
    if (!code.startsWith("UF_")) continue;
    const title = [d.title, d.listLabel, d.formLabel, d.filterLabel].filter(Boolean).join(" / ");
    if (!/источник|source|откуда|канал/i.test(title)) continue;
    const items = (d.items || []).filter((it) => RX.test(it.VALUE || ""));
    log(`  ${entity}.${code} «${title}» тип ${d.type}; значений-Wilstream: ${items.map((i) => `${i.ID}=${i.VALUE}`).join(", ") || "-"}`);
    if (items.length) out.push({ code, values: items.map((i) => i.ID) });
    else if (d.type === "string") out.push({ code, like: true });
  }
  return out;
}
log("Пользовательские поля «Источник»:");
const UF = {};
for (const ent of ["contact", "deal", "lead", "company"]) UF[ent] = await ufFilters(ent);

// Список сущностей по набору фильтров (OR = несколько запросов, объединение по ID).
async function collect(entity, select, extraFilters) {
  const m = {};
  const add = (arr, why) => { for (const x of arr) { const k = String(x.ID); if (!m[k]) m[k] = { ...x, _why: new Set() }; m[k]._why.add(why); } };
  if (entity !== "company" && wSrc.length) add(await safe(`${entity} SOURCE_ID`, () => listAll(`crm.${entity}.list`, { filter: { SOURCE_ID: wSrc }, select })), "источник");
  for (const u of UF[entity] || []) {
    if (u.values) add(await safe(`${entity} ${u.code}`, () => listAll(`crm.${entity}.list`, { filter: { [u.code]: u.values }, select })), `поле ${u.code}`);
    if (u.like) for (const w of ["Wilstream", "Вилстрим"]) add(await safe(`${entity} ${u.code}~`, () => listAll(`crm.${entity}.list`, { filter: { [`%${u.code}`]: w }, select })), `поле ${u.code}`);
  }
  if (entity !== "company") for (const w of ["Wilstream", "Вилстрим"]) add(await safe(`${entity} SOURCE_DESCRIPTION~`, () => listAll(`crm.${entity}.list`, { filter: { "%SOURCE_DESCRIPTION": w }, select })), "описание источника");
  for (const [why, f] of extraFilters) add(await safe(`${entity} ${why}`, () => listAll(`crm.${entity}.list`, { filter: f, select })), why);
  return m;
}
const CSEL = ["ID", "NAME", "LAST_NAME", "SECOND_NAME", "POST", "PHONE", "EMAIL", "IM", "COMPANY_ID", "SOURCE_ID", "SOURCE_DESCRIPTION", "ASSIGNED_BY_ID", "DATE_CREATE", "COMMENTS", "ADDRESS", "ADDRESS_CITY", "ADDRESS_REGION", "ADDRESS_PROVINCE", "UF_*"];

// ---------- сделки: источник + стадии WILSTREAM/ОБЗВОН WL во всех воронках + название ----------
const cats = await safe("deal categories", async () => (await call("crm.dealcategory.list", {})).result || []);
const wStages = [];
for (const c of [{ ID: 0, NAME: "Общая" }, ...cats]) {
  const st = await safe(`stages ${c.ID}`, async () => (await call("crm.dealcategory.stage.list", { id: c.ID })).result || []);
  for (const s of st) if (RX.test(s.NAME) || /ОБЗВОН\s*WL/i.test(s.NAME)) wStages.push({ id: s.STATUS_ID, name: s.NAME, cat: c.NAME });
}
log(`Стадии сделок Wilstream: ${wStages.map((s) => `${s.cat} / ${s.name} (${s.id})`).join("; ") || "нет"}`);
const DSEL = ["ID", "TITLE", "CATEGORY_ID", "STAGE_ID", "CONTACT_ID", "COMPANY_ID", "SOURCE_ID", "SOURCE_DESCRIPTION", "ASSIGNED_BY_ID", "DATE_CREATE", "OPPORTUNITY", "COMMENTS", "UF_*"];
const deals = await collect("deal", DSEL, [
  ...(wStages.length ? [["стадия Wilstream", { STAGE_ID: wStages.map((s) => s.id) }]] : []),
  ["название", { "%TITLE": "Wilstream" }],
]);
log(`Сделок: ${Object.keys(deals).length}`);

// ---------- лиды ----------
const LSEL = ["ID", "TITLE", "NAME", "LAST_NAME", "SECOND_NAME", "COMPANY_TITLE", "POST", "PHONE", "EMAIL", "STATUS_ID", "SOURCE_ID", "SOURCE_DESCRIPTION", "ASSIGNED_BY_ID", "DATE_CREATE", "CONTACT_ID", "COMPANY_ID", "ADDRESS_CITY", "COMMENTS", "UF_*"];
const leads = await collect("lead", LSEL, [["название", { "%TITLE": "Wilstream" }]]);
log(`Лидов: ${Object.keys(leads).length}`);

// ---------- контакты: по источнику + привязанные к сделкам/лидам Wilstream ----------
const contacts = await collect("contact", CSEL, []);
log(`Контактов по источнику/полю: ${Object.keys(contacts).length}`);
const linkC = new Set();
for (const d of Object.values(deals)) if (+d.CONTACT_ID) linkC.add(String(d.CONTACT_ID));
for (const l of Object.values(leads)) if (+l.CONTACT_ID) linkC.add(String(l.CONTACT_ID));
// все контакты сделок (сделка может иметь несколько контактов)
for (const ids of chunk(Object.keys(deals), 1)) {
  const r = await safe("deal.contact.items", async () => (await call("crm.deal.contact.items.get", { id: ids[0] })).result || []);
  for (const x of r) linkC.add(String(x.CONTACT_ID));
}
const need = [...linkC].filter((id) => !contacts[id]);
for (const ids of chunk(need, 50)) {
  const r = await safe("contact by id", () => listAll("crm.contact.list", { filter: { ID: ids }, select: CSEL }));
  for (const x of r) contacts[String(x.ID)] = { ...x, _why: new Set(["привязан к сделке/лиду Wilstream"]) };
}
log(`Контактов всего: ${Object.keys(contacts).length}`);

// компании
const compIds = new Set();
for (const x of [...Object.values(contacts), ...Object.values(deals), ...Object.values(leads)]) if (+x.COMPANY_ID) compIds.add(String(x.COMPANY_ID));
const companies = {};
for (const ids of chunk([...compIds], 50)) {
  const r = await safe("company", () => listAll("crm.company.list", { filter: { ID: ids }, select: ["ID", "TITLE", "PHONE", "EMAIL", "WEB", "ADDRESS_CITY", "COMMENTS"] }));
  for (const x of r) companies[String(x.ID)] = x;
}

// ---------- письма-анкеты ----------
const acts = {};
const addActs = (arr) => { for (const a of arr) acts[String(a.ID)] = a; };
const ASEL = ["ID", "OWNER_TYPE_ID", "OWNER_ID", "SUBJECT", "DESCRIPTION", "CREATED", "DIRECTION", "PROVIDER_TYPE_ID"];
for (const w of ["Wilstream", "Вилстрим"]) addActs(await safe("activity subject", () => listAll("crm.activity.list", { filter: { "%SUBJECT": w }, select: ASEL })));
for (const ids of chunk(Object.keys(leads), 50)) addActs(await safe("activity lead", () => listAll("crm.activity.list", { filter: { OWNER_TYPE_ID: 1, OWNER_ID: ids }, select: ASEL })));
for (const ids of chunk(Object.keys(deals), 50)) addActs(await safe("activity deal", () => listAll("crm.activity.list", { filter: { OWNER_TYPE_ID: 2, OWNER_ID: ids }, select: ASEL })));
log(`Дел/писем просмотрено: ${Object.keys(acts).length}`);

const strip = (h) => String(h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
// Анкета Wilstream: «Метка: значение» подряд, часто без переносов строк.
const LABELS = ["Название проекта", "ID", "Дата статуса", "Телефон статуса", "Статус", "Оператор", "Код", "Название", "Регион", "Город", "Адрес", "Телефон", "ЧП", "Этап прозвона", "Комментарий", "Ф.И.О.", "Должность", "E-mail", "Примечание", "Устраивает ли текущий ассортимент продаж?", "Как планируете увеличивать прибыль?", "Хотелось бы что-то улучшить?", "Результат", "Дата и время звонка специалиста"];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LRX = new RegExp(`(${[...LABELS].sort((a, b) => b.length - a.length).map(esc).join("|")})\\s*:`, "g");
function parseForm(text) {
  const t = strip(text); const hits = []; let m;
  LRX.lastIndex = 0; while ((m = LRX.exec(t))) hits.push({ k: m[1], s: m.index, e: LRX.lastIndex });
  if (hits.length < 4) return null;
  const f = {};
  hits.forEach((h, i) => { const v = t.slice(h.e, i + 1 < hits.length ? hits[i + 1].s : t.length).replace(/\s+/g, " ").trim();
    const key = f[h.k] !== undefined ? h.k + " 2" : h.k; f[key] = v; });
  return f;
}
const forms = [];
for (const a of Object.values(acts)) {
  const f = parseForm(a.DESCRIPTION);
  if (!f || !(f["Название"] || f["Телефон"] || f["Ф.И.О."])) continue;
  forms.push({ a, f });
}
log(`Анкет распознано: ${forms.length}`);

// ---------- нормализация и листы ----------
const normPhone = (v) => { const d = String(v || "").replace(/\D/g, ""); if (!d) return "";
  if (d.length === 11 && (d[0] === "7" || d[0] === "8")) return "+7" + d.slice(1); if (d.length === 10) return "+7" + d; return "+" + d; };
const phonesOf = (arr) => [...new Set((arr || []).map((p) => normPhone(p.VALUE)).filter(Boolean))].join(", ");
const valsOf = (arr) => [...new Set((arr || []).map((p) => String(p.VALUE || "").trim()).filter(Boolean))].join(", ");
const phonesTxt = (s) => [...new Set(String(s || "").split(/[,;]\s*|\s{2,}/).map(normPhone).filter((x) => x.length >= 12))].join(", ");
const fio = (x) => [x.LAST_NAME, x.NAME, x.SECOND_NAME].filter(Boolean).join(" ");
const B24 = new URL(BASE).origin + "/crm";
const ownerName = { 1: "лид", 2: "сделка", 3: "контакт", 4: "компания" };

const shC = [["ID контакта", "ФИО", "Должность", "Компания", "Телефон", "Email", "Мессенджеры", "Город/адрес", "Источник", "Описание источника", "Почему в списке", "Ответственный", "Создан", "Комментарий", "Ссылка"]];
for (const c of Object.values(contacts).sort((a, b) => String(a.DATE_CREATE).localeCompare(String(b.DATE_CREATE)))) {
  const co = companies[String(c.COMPANY_ID)] || {};
  shC.push([c.ID, fio(c), c.POST || "", co.TITLE || "", phonesOf(c.PHONE) || phonesOf(co.PHONE), valsOf(c.EMAIL) || valsOf(co.EMAIL), valsOf(c.IM),
    [c.ADDRESS_REGION, c.ADDRESS_PROVINCE, c.ADDRESS_CITY, c.ADDRESS].filter(Boolean).join(", ") || co.ADDRESS_CITY || "",
    srcName[c.SOURCE_ID] || c.SOURCE_ID || "", strip(c.SOURCE_DESCRIPTION).trim(), [...c._why].join("; "), uName[String(c.ASSIGNED_BY_ID)] || "",
    String(c.DATE_CREATE || "").slice(0, 10), strip(c.COMMENTS).replace(/\s+/g, " ").trim().slice(0, 500), `${B24}/contact/details/${c.ID}/`]);
}
const shF = [["Дата анкеты", "Мастерская / организация", "Регион", "Город", "Адрес", "Телефоны", "Контактное лицо", "Должность", "E-mail", "Мессенджеры (примечание)", "Результат звонка", "Когда звонить", "Комментарий оператора", "ID Wilstream", "Где в Б24", "Ссылка"]];
const seenF = new Set();
for (const { a, f } of forms.sort((x, y) => String(x.a.CREATED).localeCompare(String(y.a.CREATED)))) {
  const key = f["ID"] || (f["Название"] + "|" + f["Телефон"]); if (seenF.has(key)) continue; seenF.add(key);
  const ph = phonesTxt([f["Телефон"], f["Телефон 2"], f["Телефон статуса"]].filter(Boolean).join(", "));
  const typ = ownerName[a.OWNER_TYPE_ID] || a.OWNER_TYPE_ID, path = { 1: "lead", 2: "deal", 3: "contact", 4: "company" }[a.OWNER_TYPE_ID];
  shF.push([String(f["Дата статуса"] || a.CREATED || "").slice(0, 16), f["Название"] || "", f["Регион"] || "", f["Город"] || "", f["Адрес"] || "", ph,
    f["Ф.И.О."] || "", f["Должность"] || "", (f["E-mail"] || "").replace(/^Телефон.*/, ""), f["Примечание"] || "", f["Результат"] || f["Статус"] || "",
    f["Дата и время звонка специалиста"] || "", f["Комментарий"] || "", f["ID"] || "", `${typ} ${a.OWNER_ID}`, path ? `${B24}/${path}/details/${a.OWNER_ID}/` : ""]);
}
const catName = { 0: "Общая" }; for (const c of cats) catName[c.ID] = c.NAME;
const shD = [["ID сделки", "Название", "Воронка", "Стадия", "Контакт", "Телефон", "Email", "Компания", "Сумма", "Источник", "Почему в списке", "Ответственный", "Создана", "Ссылка"]];
const stName = {}; for (const s of wStages) stName[s.id] = s.name;
for (const d of Object.values(deals)) {
  const c = contacts[String(d.CONTACT_ID)] || {}, co = companies[String(d.COMPANY_ID)] || {};
  shD.push([d.ID, d.TITLE || "", catName[d.CATEGORY_ID] || d.CATEGORY_ID, stName[d.STAGE_ID] || d.STAGE_ID, fio(c), phonesOf(c.PHONE) || phonesOf(co.PHONE), valsOf(c.EMAIL) || valsOf(co.EMAIL),
    co.TITLE || "", +d.OPPORTUNITY || 0, srcName[d.SOURCE_ID] || d.SOURCE_ID || "", [...d._why].join("; "), uName[String(d.ASSIGNED_BY_ID)] || "", String(d.DATE_CREATE || "").slice(0, 10), `${B24}/deal/details/${d.ID}/`]);
}
const shL = [["ID лида", "Название", "Статус", "Контакт", "Компания", "Телефон", "Email", "Источник", "Почему в списке", "Ответственный", "Создан", "Ссылка"]];
for (const l of Object.values(leads)) shL.push([l.ID, l.TITLE || "", l.STATUS_ID, fio(l), l.COMPANY_TITLE || "", phonesOf(l.PHONE), valsOf(l.EMAIL), srcName[l.SOURCE_ID] || l.SOURCE_ID || "",
  [...l._why].join("; "), uName[String(l.ASSIGNED_BY_ID)] || "", String(l.DATE_CREATE || "").slice(0, 10), `${B24}/lead/details/${l.ID}/`]);
log(`Итог: контактов ${shC.length - 1}, анкет ${shF.length - 1}, сделок ${shD.length - 1}, лидов ${shL.length - 1}`);

// ---------- xlsx (OOXML, ZIP без сжатия) ----------
const X = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
const colL = (n) => { let s = ""; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const sheetXml = (aoa) => {
  const w = aoa[0].map((_, ci) => Math.min(60, Math.max(10, ...aoa.slice(0, 200).map((r) => String(r[ci] ?? "").length + 2))));
  let rx = "";
  aoa.forEach((row, ri) => { let cells = "";
    row.forEach((v, ci) => { const ref = colL(ci) + (ri + 1);
      cells += typeof v === "number" && isFinite(v) ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${ri === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${X(v)}</t></is></c>`; });
    rx += `<row r="${ri + 1}">${cells}</row>`; });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${w.map((x, i) => `<col min="${i + 1}" max="${i + 1}" width="${x}" customWidth="1"/>`).join("")}</cols><sheetData>${rx}</sheetData><autoFilter ref="A1:${colL(aoa[0].length - 1)}${aoa.length}"/></worksheet>`;
};
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0 ^ -1; for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC[(c ^ buf[i]) & 0xff]; return (c ^ -1) >>> 0; };
const zip = (files) => { const parts = [], central = []; let off = 0;
  for (const f of files) { const nm = Buffer.from(f.name, "utf8"), data = f.data, crc = crc32(data); const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26);
    parts.push(lh, nm, data); const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nm.length, 28); cd.writeUInt32LE(off, 42);
    central.push(Buffer.concat([cd, nm])); off += lh.length + nm.length + data.length; }
  const cdBuf = Buffer.concat(central); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cdBuf, end]); };
const E = (s) => Buffer.from(s, "utf8");
const sheets = [["Контакты", shC], ["Анкеты из писем", shF], ["Сделки", shD], ["Лиды", shL], ["Как собрано", [["Журнал выгрузки"], ...LOG.map((s) => [s])]]];
const xlsx = zip([
  { name: "[Content_Types].xml", data: E(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`) },
  { name: "_rels/.rels", data: E(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
  { name: "xl/workbook.xml", data: E(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([n], i) => `<sheet name="${X(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${sheets.map(([, a], i) => a.length > 1 && i < 4 ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${X(sheets[i][0])}'!$A$1:$${colL(a[0].length - 1)}$${a.length}</definedName></definedNames>` : "").join("").replace(/<\/definedNames><definedNames>/g, "")}</workbook>`) },
  { name: "xl/_rels/workbook.xml.rels", data: E(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
  { name: "xl/styles.xml", data: E(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`) },
  ...sheets.map(([, a], i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: E(sheetXml(a)) })),
]);
mkdirSync("exports", { recursive: true });
writeFileSync("exports/wilstream-contacts.xlsx", xlsx);
writeFileSync("exports/wilstream-log.txt", LOG.join("\n") + "\n");
console.log("Готово -> exports/wilstream-contacts.xlsx");
