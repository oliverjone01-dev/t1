// Разовый экспорт контактов дизайнеров, архитекторов, декораторов и комплектаторов (B2B-партнёры).
// Бежит только в GitHub Actions (нужен B24_WEBHOOK_URL). Все воронки, без ограничения по дате.
// Где ищем:
//  1) тип клиента: справочники CONTACT_TYPE / COMPANY_TYPE и пользовательские поля «тип / категория /
//     кто клиент» у контакта, компании и сделки, значение которых похоже на профессию;
//  2) по названию: ФИО, должность и комментарий контакта, название компании;
//  3) по названию сделки -> контакты этих сделок.
// Пишет exports/designers-contacts.xlsx и exports/designers-log.txt.
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
// Профессии. «дизайнерск*» (дизайнерская мебель) - не профессия, отсекаем отдельно.
const RX = /дизайнер(?!ск)|дизайн[\s-]*(студ|бюро|проект|интерьер)|интерьерн|архитект|декоратор|комплектатор|комплектовщ|designer|architect|decorator|\bдиз\b|\bархи\b/i;
const KW = ["дизайнер", "архитект", "декоратор", "комплектатор", "комплектовщ", "дизайн-студ", "дизайн студ", "студия дизайна", "бюро", "designer", "architect", "дизайн интерьер", "интерьер"];
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
const status = async (ent) => safe(ent, async () => (await call("crm.status.list", { filter: { ENTITY_ID: ent } })).result || []);
const cTypes = await status("CONTACT_TYPE"), coTypes = await status("COMPANY_TYPE"), sources = await status("SOURCE");
const srcName = {}; for (const s of sources) srcName[s.STATUS_ID] = s.NAME;
const cTypeName = {}; for (const s of cTypes) cTypeName[s.STATUS_ID] = s.NAME;
const coTypeName = {}; for (const s of coTypes) coTypeName[s.STATUS_ID] = s.NAME;
const wCT = cTypes.filter((s) => RX.test(s.NAME)).map((s) => s.STATUS_ID);
const wCoT = coTypes.filter((s) => RX.test(s.NAME)).map((s) => s.STATUS_ID);
log(`Типы контакта: ${cTypes.map((s) => `${s.STATUS_ID}=${s.NAME}`).join(", ")}`);
log(`  подходят: ${wCT.map((id) => cTypeName[id]).join(", ") || "нет"}`);
log(`Типы компании: ${coTypes.map((s) => `${s.STATUS_ID}=${s.NAME}`).join(", ")}`);
log(`  подходят: ${wCoT.map((id) => coTypeName[id]).join(", ") || "нет"}`);

// Пользовательские поля-списки, где есть значение-профессия (тип клиента, категория, кто клиент...).
const ufLabel = {};
async function ufEnum(entity) {
  const f = await safe(`crm.${entity}.fields`, async () => (await call(`crm.${entity}.fields`)).result || {}, {});
  const out = [];
  for (const [code, d] of Object.entries(f)) {
    if (!code.startsWith("UF_")) continue;
    const title = [d.title, d.listLabel, d.formLabel, d.filterLabel].filter(Boolean).join(" / ");
    const items = (d.items || []).filter((it) => RX.test(it.VALUE || ""));
    for (const it of d.items || []) ufLabel[`${code}:${it.ID}`] = it.VALUE;
    if (items.length) { out.push({ code, title, values: items.map((i) => i.ID) }); log(`  ${entity}.${code} «${title}»: ${items.map((i) => i.VALUE).join(", ")}`); }
  }
  return out;
}
log("Пользовательские поля со значением-профессией:");
const UF = {}; for (const ent of ["contact", "company", "deal"]) UF[ent] = await ufEnum(ent);

const CSEL = ["ID", "NAME", "LAST_NAME", "SECOND_NAME", "POST", "PHONE", "EMAIL", "IM", "WEB", "COMPANY_ID", "TYPE_ID", "SOURCE_ID", "ASSIGNED_BY_ID", "DATE_CREATE", "COMMENTS", "ADDRESS_CITY", "UF_*"];
const contacts = {};
const addC = (arr, why) => { for (const x of arr) { const k = String(x.ID); if (!contacts[k]) contacts[k] = { ...x, _why: new Set() }; contacts[k]._why.add(why); } };
if (wCT.length) addC(await safe("contact TYPE_ID", () => listAll("crm.contact.list", { filter: { TYPE_ID: wCT }, select: CSEL })), "тип контакта");
for (const u of UF.contact) addC(await safe(`contact ${u.code}`, () => listAll("crm.contact.list", { filter: { [u.code]: u.values }, select: CSEL })), `поле «${u.title}»`);
for (const fld of ["NAME", "LAST_NAME", "SECOND_NAME", "POST", "COMMENTS"]) for (const w of KW) {
  const r = await safe(`contact %${fld} ${w}`, () => listAll("crm.contact.list", { filter: { [`%${fld}`]: w }, select: CSEL }));
  // «бюро»/«интерьер» шумят - оставляем только то, что проходит общий фильтр профессий
  addC(r.filter((x) => RX.test([x.NAME, x.LAST_NAME, x.SECOND_NAME, x.POST, x.COMMENTS].join(" "))), fld === "POST" ? "должность" : fld === "COMMENTS" ? "комментарий" : "ФИО/название контакта");
}
log(`Контактов по типу/названию: ${Object.keys(contacts).length}`);

// Компании-профессионалы -> их контакты
const COSEL = ["ID", "TITLE", "COMPANY_TYPE", "PHONE", "EMAIL", "WEB", "ADDRESS_CITY", "UF_*"];
const pros = {};
const addCo = (arr, why) => { for (const x of arr) { const k = String(x.ID); if (!pros[k]) pros[k] = { ...x, _why: new Set() }; pros[k]._why.add(why); } };
if (wCoT.length) addCo(await safe("company type", () => listAll("crm.company.list", { filter: { COMPANY_TYPE: wCoT }, select: COSEL })), "тип компании");
for (const u of UF.company) addCo(await safe(`company ${u.code}`, () => listAll("crm.company.list", { filter: { [u.code]: u.values }, select: COSEL })), `поле компании «${u.title}»`);
for (const w of KW) addCo((await safe(`company %TITLE ${w}`, () => listAll("crm.company.list", { filter: { "%TITLE": w }, select: COSEL }))).filter((x) => RX.test(x.TITLE)), "название компании");
log(`Компаний-профессионалов: ${Object.keys(pros).length}`);
for (const ids of chunk(Object.keys(pros), 50)) addC(await safe("contact by company", () => listAll("crm.contact.list", { filter: { COMPANY_ID: ids }, select: CSEL })), "контакт компании-профессионала");

// Сделки по названию/полю -> их контакты
const DSEL = ["ID", "TITLE", "CATEGORY_ID", "STAGE_ID", "CONTACT_ID", "COMPANY_ID", "OPPORTUNITY", "DATE_CREATE", "CLOSEDATE", "CLOSED", "ASSIGNED_BY_ID", "SOURCE_ID", "UF_*"];
const deals = {};
const addD = (arr, why) => { for (const x of arr) { const k = String(x.ID); if (!deals[k]) deals[k] = { ...x, _why: new Set() }; deals[k]._why.add(why); } };
for (const w of KW) addD((await safe(`deal %TITLE ${w}`, () => listAll("crm.deal.list", { filter: { "%TITLE": w }, select: DSEL }))).filter((x) => RX.test(x.TITLE)), "название сделки");
for (const u of UF.deal) addD(await safe(`deal ${u.code}`, () => listAll("crm.deal.list", { filter: { [u.code]: u.values }, select: DSEL })), `поле сделки «${u.title}»`);
log(`Сделок по названию/полю: ${Object.keys(deals).length}`);
const dealC = new Set(Object.values(deals).map((d) => String(d.CONTACT_ID)).filter((x) => +x));
const needC = [...dealC].filter((id) => !contacts[id]);
for (const ids of chunk(needC, 50)) addC(await safe("contact by id", () => listAll("crm.contact.list", { filter: { ID: ids }, select: CSEL })), "контакт сделки-профессионала");
log(`Контактов всего: ${Object.keys(contacts).length}`);

// Все сделки найденных контактов (для объёма и даты последней сделки)
const allD = {};
for (const ids of chunk(Object.keys(contacts), 50)) for (const x of await safe("deals by contact", () => listAll("crm.deal.list", { filter: { CONTACT_ID: ids }, select: ["ID", "CONTACT_ID", "OPPORTUNITY", "DATE_CREATE", "STAGE_ID", "CLOSED"] }))) allD[String(x.ID)] = x;
const byC = {}; for (const x of Object.values(allD)) (byC[String(x.CONTACT_ID)] ||= []).push(x);
const WON = (s) => /WON$/.test(String(s || ""));
// компании контактов
const compIds = new Set(); for (const c of Object.values(contacts)) if (+c.COMPANY_ID && !pros[String(c.COMPANY_ID)]) compIds.add(String(c.COMPANY_ID));
const companies = { ...pros };
for (const ids of chunk([...compIds], 50)) for (const x of await safe("company", () => listAll("crm.company.list", { filter: { ID: ids }, select: COSEL }))) companies[String(x.ID)] = x;

const normPhone = (v) => { const d = String(v || "").replace(/\D/g, ""); if (!d) return "";
  if (d.length === 11 && (d[0] === "7" || d[0] === "8")) return "+7" + d.slice(1); if (d.length === 10) return "+7" + d; return "+" + d; };
const phonesOf = (arr) => [...new Set((arr || []).map((p) => normPhone(p.VALUE)).filter(Boolean))].join(", ");
const valsOf = (arr) => [...new Set((arr || []).map((p) => String(p.VALUE || "").trim()).filter(Boolean))].join(", ");
const fio = (x) => [x.LAST_NAME, x.NAME, x.SECOND_NAME].filter(Boolean).join(" ");
const B24 = new URL(BASE).origin + "/crm";
const prof = (s) => { const t = String(s || "").toLowerCase();
  return /архитект|architect/.test(t) ? "архитектор" : /декоратор|decorator/.test(t) ? "декоратор" : /комплект/.test(t) ? "комплектатор" : /дизайн|designer|\bдиз\b|интерьер/.test(t) ? "дизайнер" : ""; };
const ufText = (x) => Object.entries(x).filter(([k]) => k.startsWith("UF_")).map(([k, v]) => [].concat(v).map((i) => ufLabel[`${k}:${i}`]).filter(Boolean).join(" ")).join(" ");

const shC = [["ID контакта", "ФИО / название", "Профессия", "Должность", "Компания", "Телефон", "Email", "Мессенджеры", "Сайт", "Город", "Тип контакта", "Сделок", "Из них успешных", "Сумма сделок", "Последняя сделка", "Почему в списке", "Ответственный", "Создан", "Ссылка"]];
const rows = Object.values(contacts).map((c) => {
  const co = companies[String(c.COMPANY_ID)] || {}, ds = byC[String(c.ID)] || [];
  const txt = [fio(c), c.POST, co.TITLE, cTypeName[c.TYPE_ID], ufText(c), coTypeName[co.COMPANY_TYPE], c.COMMENTS].join(" ");
  const last = ds.map((x) => String(x.DATE_CREATE).slice(0, 10)).sort().pop() || "";
  return [c.ID, fio(c), prof(txt) || "уточнить", c.POST || "", co.TITLE || "", phonesOf(c.PHONE) || phonesOf(co.PHONE), valsOf(c.EMAIL) || valsOf(co.EMAIL), valsOf(c.IM), valsOf(c.WEB) || valsOf(co.WEB),
    c.ADDRESS_CITY || co.ADDRESS_CITY || "", cTypeName[c.TYPE_ID] || c.TYPE_ID || "", ds.length, ds.filter((x) => WON(x.STAGE_ID)).length, ds.reduce((s, x) => s + (+x.OPPORTUNITY || 0), 0), last,
    [...c._why].join("; "), uName[String(c.ASSIGNED_BY_ID)] || "", String(c.DATE_CREATE || "").slice(0, 10), `${B24}/contact/details/${c.ID}/`];
}).sort((a, b) => b[13] - a[13] || String(b[14]).localeCompare(String(a[14])));
shC.push(...rows);
const shCo = [["ID компании", "Название", "Тип компании", "Телефон", "Email", "Сайт", "Город", "Почему в списке", "Ссылка"]];
for (const x of Object.values(pros)) shCo.push([x.ID, x.TITLE || "", coTypeName[x.COMPANY_TYPE] || x.COMPANY_TYPE || "", phonesOf(x.PHONE), valsOf(x.EMAIL), valsOf(x.WEB), x.ADDRESS_CITY || "", [...x._why].join("; "), `${B24}/company/details/${x.ID}/`]);
const shD = [["ID сделки", "Название", "Контакт", "Телефон", "Сумма", "Создана", "Стадия", "Почему в списке", "Ответственный", "Ссылка"]];
for (const d of Object.values(deals).sort((a, b) => String(b.DATE_CREATE).localeCompare(String(a.DATE_CREATE)))) {
  const c = contacts[String(d.CONTACT_ID)] || {};
  shD.push([d.ID, d.TITLE || "", fio(c), phonesOf(c.PHONE), +d.OPPORTUNITY || 0, String(d.DATE_CREATE || "").slice(0, 10), d.STAGE_ID, [...d._why].join("; "), uName[String(d.ASSIGNED_BY_ID)] || "", `${B24}/deal/details/${d.ID}/`]);
}
const cnt = {}; for (const r of rows) cnt[r[2]] = (cnt[r[2]] || 0) + 1;
log(`Итог: контактов ${rows.length} (${Object.entries(cnt).map(([k, v]) => `${k} ${v}`).join(", ")}), с телефоном ${rows.filter((r) => r[5]).length}, компаний ${shCo.length - 1}, сделок по названию ${shD.length - 1}`);

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
const sheets = [["Контакты", shC], ["Компании", shCo], ["Сделки по названию", shD], ["Как собрано", [["Журнал выгрузки"], ...LOG.map((s) => [s])]]];
const xlsx = zip([
  { name: "[Content_Types].xml", data: E(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`) },
  { name: "_rels/.rels", data: E(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
  { name: "xl/workbook.xml", data: E(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([n], i) => `<sheet name="${X(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${sheets.map(([, a], i) => a.length > 1 && i < 3 ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${X(sheets[i][0])}'!$A$1:$${colL(a[0].length - 1)}$${a.length}</definedName></definedNames>` : "").join("").replace(/<\/definedNames><definedNames>/g, "")}</workbook>`) },
  { name: "xl/_rels/workbook.xml.rels", data: E(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
  { name: "xl/styles.xml", data: E(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`) },
  ...sheets.map(([, a], i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: E(sheetXml(a)) })),
]);
mkdirSync("exports", { recursive: true });
writeFileSync("exports/designers-contacts.xlsx", xlsx);
writeFileSync("exports/designers-log.txt", LOG.join("\n") + "\n");
console.log("Готово -> exports/designers-contacts.xlsx");
