// Разовый экспорт: контакты сделок воронки 49 (GG Заказы РФ) на стадиях от
// «Предоплата получена» до «Сделка успешна» включительно, за последний год.
// Выгружает ID/название/стадию/сумму/дату/ФИО контакта/телефон/email/компанию/менеджера
// в .xlsx (без внешних зависимостей). Телефона нет -> пустая ячейка.
//
// Бежит ТОЛЬКО в GitHub Actions (нужен доступ к glassmemory.bitrix24.ru).
// Запуск: B24_WEBHOOK_URL=... node src/scripts/b24/export-won-contacts.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL в окружении"); process.exit(1); }
const CAT = process.env.EXPORT_CAT || "49";
const STAGES = ["C49:EXECUTING", "C49:FINAL_INVOICE", "C49:1", "C49:2", "C49:WON"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    const b = j.result || []; all.push(...b);
    if (j.next === undefined || !b.length) break; start = j.next;
  }
  return all;
}

const now = new Date();
const from = new Date(now.getTime() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
console.log(`Период создания с ${from} | воронка ${CAT} | стадии: ${STAGES.join(", ")}`);

const deals = await listAll("crm.deal.list", {
  order: { STAGE_ID: "ASC", DATE_CREATE: "DESC" },
  filter: { CATEGORY_ID: CAT, STAGE_ID: STAGES, ">=DATE_CREATE": from },
  select: ["ID", "TITLE", "STAGE_ID", "ASSIGNED_BY_ID", "OPPORTUNITY", "DATE_CREATE", "CONTACT_ID", "COMPANY_ID"],
});
console.log(`Сделок найдено: ${deals.length}`);

let stageName = {};
try {
  const st = (await call("crm.status.list", { filter: { ENTITY_ID: `DEAL_STAGE_${CAT}` } })).result || [];
  for (const s of st) stageName[s.STATUS_ID] = s.NAME;
} catch (e) { console.warn("Имена стадий:", e.message); }
const SNM = { "C49:EXECUTING": "Предоплата получена", "C49:FINAL_INVOICE": "Заказ в производстве", "C49:1": "Заказ произведен", "C49:2": "Заказ отправлен", "C49:WON": "Сделка успешна" };
const stName = (c) => stageName[c] || SNM[c] || c;

const users = await listAll("user.get", {});
const uName = {};
for (const u of users) uName[String(u.ID)] = `${u.NAME || ""} ${u.LAST_NAME || ""}`.trim() || `id${u.ID}`;

const cids = [...new Set(deals.map((d) => String(d.CONTACT_ID || "")).filter((x) => x && x !== "0"))];
const contact = {};
for (let i = 0; i < cids.length; i += 50) {
  const rows = await listAll("crm.contact.list", { filter: { ID: cids.slice(i, i + 50) }, select: ["ID", "NAME", "LAST_NAME", "SECOND_NAME", "PHONE", "EMAIL"] });
  for (const c of rows) contact[String(c.ID)] = c;
}
console.log(`Контактов подтянуто: ${Object.keys(contact).length} из ${cids.length}`);

const coids = [...new Set(deals.map((d) => String(d.COMPANY_ID || "")).filter((x) => x && x !== "0"))];
const company = {};
for (let i = 0; i < coids.length; i += 50) {
  const rows = await listAll("crm.company.list", { filter: { ID: coids.slice(i, i + 50) }, select: ["ID", "TITLE", "PHONE"] });
  for (const c of rows) company[String(c.ID)] = c;
}

const firstOf = (arr) => { if (!arr || !arr.length) return ""; const p = arr.find((x) => x && x.VALUE) || arr[0]; return p && p.VALUE ? String(p.VALUE) : ""; };
const rows = deals.map((d) => {
  const c = contact[String(d.CONTACT_ID || "")];
  const co = company[String(d.COMPANY_ID || "")];
  const fio = c ? [c.LAST_NAME, c.NAME, c.SECOND_NAME].filter(Boolean).join(" ") : "";
  let phone = c ? firstOf(c.PHONE) : "";
  if (!phone && co) phone = firstOf(co.PHONE);
  return [
    d.ID, d.TITLE || "", stName(d.STAGE_ID), Number(d.OPPORTUNITY) || 0,
    (d.DATE_CREATE || "").slice(0, 10), fio, phone, c ? firstOf(c.EMAIL) : "",
    co ? (co.TITLE || "") : "", uName[String(d.ASSIGNED_BY_ID)] || "",
  ];
});
const withPhone = rows.filter((r) => r[6]).length;

// ---- минимальный писатель .xlsx (OOXML, ZIP без сжатия, без зависимостей) ----
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
const colL = (n) => { let s = ""; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const sheetXml = (aoa) => {
  let rx = "";
  aoa.forEach((row, ri) => {
    let cells = "";
    row.forEach((v, ci) => {
      const ref = colL(ci) + (ri + 1);
      if (typeof v === "number" && isFinite(v)) cells += `<c r="${ref}"><v>${v}</v></c>`;
      else cells += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    });
    rx += `<row r="${ri + 1}">${cells}</row>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="2" max="2" width="42"/><col min="6" max="6" width="26"/><col min="7" max="7" width="18"/><col min="8" max="9" width="24"/><col min="10" max="10" width="22"/></cols><sheetData>${rx}</sheetData></worksheet>`;
};
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0 ^ -1; for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC[(c ^ buf[i]) & 0xff]; return (c ^ -1) >>> 0; };
const zip = (files) => {
  const parts = [], central = []; let off = 0; const enc = (s) => Buffer.from(s, "utf8");
  for (const f of files) {
    const nm = enc(f.name), data = f.data, crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nm.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, nm, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8); cd.writeUInt16LE(0, 10); cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nm.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(off, 42);
    central.push(Buffer.concat([cd, nm]));
    off += lh.length + nm.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cdBuf, end]);
};
const enc = (s) => Buffer.from(s, "utf8");
const headers = ["ID сделки", "Название", "Стадия", "Сумма, ₽", "Создана", "Контакт (ФИО)", "Телефон", "Email", "Компания", "Менеджер"];
const aoa = [headers, ...rows];
const xlsx = zip([
  { name: "[Content_Types].xml", data: enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`) },
  { name: "_rels/.rels", data: enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
  { name: "xl/workbook.xml", data: enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Контакты" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
  { name: "xl/_rels/workbook.xml.rels", data: enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`) },
  { name: "xl/worksheets/sheet1.xml", data: enc(sheetXml(aoa)) },
]);
mkdirSync("exports", { recursive: true });
writeFileSync("exports/won-contacts.xlsx", xlsx);
console.log(`Готово: ${rows.length} строк -> exports/won-contacts.xlsx | с телефоном: ${withPhone}`);
