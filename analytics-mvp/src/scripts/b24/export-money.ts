// ВЫГРУЗКА ДЕНЕГ ПО СДЕЛКЕ -> CSV для Google-таблицы (задача Богдана).
// По каждой сделке собираем: бюджет сделки (OPPORTUNITY) + суммы «С/С» из смарт-процессов
// Расчёт / Калькулятор / Закупка / Производство GG / Производство GM. Столбцы «с/с» в каждом СП
// НЕ хардкодим по одному - находим динамически по названию поля (с/с / себестоимость) и типу
// (money/double/integer) через crm.item.fields, поэтому выгрузка переживёт добавление новых
// с/с-полей. ID сделки - кликабельной ссылкой (=HYPERLINK) в первом столбце.
//
// Импорт: открой Google-таблицу -> Файл -> Импорт -> Загрузка -> money.csv -> «Заменить лист».
// Ссылки и суммы подтянутся (Google парсит =HYPERLINK и числа при импорте, разделитель - запятая).
//
// Запуск: B24_WEBHOOK_URL=... B24_PORTAL=https://glassmemory.bitrix24.ru \
//         npx tsx src/scripts/b24/export-money.ts > money.csv
// (или без редиректа - файл пишется в prod/data/money.csv)

import { writeFileSync, mkdirSync } from "node:fs";

const BASE = (process.env.B24_WEBHOOK_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("Нет B24_WEBHOOK_URL"); process.exit(1); }
const PORTAL = (process.env.B24_PORTAL || "https://glassmemory.bitrix24.ru").replace(/\/+$/, "");
const OUT = "prod/data/money.csv";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Смарт-процессы, где лежит себестоимость. Порядок = порядок столбцов в таблице.
const SP = [
  { etid: 1060, key: "Расчёт" },
  { etid: 1056, key: "Калькулятор" },
  { etid: 1074, key: "Закупка" },
  { etid: 1086, key: "Производство GG" },
  // Производство GM (1120) исключено: это Metal-GM, другой бизнес (решение Ивана).
] as const;

// Что считаем «с/с»: название содержит с/с/себестоимость. Тип - число ИЛИ строка (в Закупке
// «С/С Стекло/Фурнитура/Дерево» сделаны текстом, но хранят числа - парсим их). enumeration/file/
// employee/date/crm/boolean НЕ берём. «Бюджет заказ» - это цена продажи, не с/с - исключаем.
const SS_LABEL = /с\s*\/\s*с|себестоим/i;
const SS_EXCLUDE = /бюджет|наценк|прибыл|сумма налога|режим расч|комментар/i;
const SS_NUM = /^(money|double|integer|string)$/i;
const lbl = (d: any) => d.formLabel || d.listLabel || d.editFormLabel || d.title || "";
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : 0; };

async function call(method: string, params: any = {}): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${BASE}/${method}.json`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params), signal: AbortSignal.timeout(30000),
      });
      const j: any = await res.json();
      if (j.error) {
        if (/QUERY_LIMIT|OPERATION_TIME_LIMIT/i.test(String(j.error))) { await sleep(1200); attempt--; continue; }
        throw new Error(`${method}: ${j.error_description || j.error}`);
      }
      return j;
    } catch (e) { lastErr = e; await sleep(600 * (attempt + 1)); }
  }
  throw lastErr;
}

// Найти в СП поля-себестоимости (динамически, по названию+типу).
async function ssFields(etid: number): Promise<string[]> {
  const fields: Record<string, any> = (await call("crm.item.fields", { entityTypeId: etid })).result?.fields || {};
  const out: string[] = [];
  for (const [id, def] of Object.entries(fields)) {
    const t = String(lbl(def)), type = String(def.type || "");
    if (SS_LABEL.test(t) && !SS_EXCLUDE.test(t) && SS_NUM.test(type)) { out.push(id); console.error(`SPFIELD\t${etid}\t${id}\t${t}`); }
  }
  return out;
}

// Все карточки СП с постраничной выборкой по id.
async function itemsAll(etid: number, select: string[]): Promise<any[]> {
  const all: any[] = []; let lastId = 0;
  for (;;) {
    const r = (await call("crm.item.list", { entityTypeId: etid, select, filter: { ">id": lastId }, order: { id: "ASC" } })).result?.items || [];
    if (!r.length) break;
    all.push(...r); lastId = r[r.length - 1].id;
    if (r.length < 50) break; // crm.item.list отдаёт по 50
  }
  return all;
}

(async () => {
  // 1) Сделки: id, название, ответственный, бюджет, срок, дата закрытия.
  const deals: any[] = [];
  let start = 0;
  for (;;) {
    const r = await call("crm.deal.list", {
      select: ["ID", "TITLE", "OPPORTUNITY", "ASSIGNED_BY_ID", "CLOSEDATE", "STAGE_ID", "CATEGORY_ID",
        "UTM_SOURCE", "UTM_MEDIUM", "UTM_CAMPAIGN", "UTM_CONTENT", "UTM_TERM"],
      order: { ID: "DESC" }, start,
    });
    const items: any[] = r.result || [];
    deals.push(...items);
    if (r.next == null) break; start = r.next;
  }
  const dealById = new Map<string, any>();
  for (const d of deals) dealById.set(String(d.ID), { title: d.TITLE, opp: num(d.OPPORTUNITY), mgr: d.ASSIGNED_BY_ID, close: d.CLOSEDATE, stage: d.STAGE_ID, cat: String(d.CATEGORY_ID || ""),
    utm: [d.UTM_SOURCE, d.UTM_MEDIUM, d.UTM_CAMPAIGN, d.UTM_CONTENT, d.UTM_TERM].map((v) => String(v ?? "").replace(/[\t\n|]/g, " ")), ss: {} as Record<string, number> });

  // 2) По каждому СП: найти с/с-поля, стянуть карточки, просуммировать с/с на сделку.
  for (const sp of SP) {
    let ss: string[] = [];
    try { ss = await ssFields(sp.etid); } catch (e) { console.error(`СП ${sp.etid}: fields error ${e}`); continue; }
    console.error(`СП ${sp.etid} «${sp.key}»: с/с-поля = ${ss.join(", ") || "нет"}`);
    if (!ss.length) continue;
    let items: any[] = [];
    try { items = await itemsAll(sp.etid, ["id", "parentId2", ...ss]); } catch (e) { console.error(`СП ${sp.etid}: items error ${e}`); continue; }
    for (const it of items) {
      const dealId = String(it.parentId2 || "");
      const rec = dealById.get(dealId);
      if (!rec) continue; // карточка не привязана к сделке (или сделки нет в выгрузке)
      const sum = ss.reduce((s, f) => s + num(it[f]), 0);
      rec.ss[sp.key] = (rec.ss[sp.key] || 0) + sum;
      // Дамп по карточке СП: etid, id карточки, сделка, сумма и значения по каждому полю.
      // Нужен, чтобы проверить двойной счёт (итог+компоненты внутри СП, одна с/с в разных СП)
      // и дать прямые ссылки на карточки. Только карточки с ненулевой с/с.
      if (sum > 0) console.error(`SPITEM\t${sp.etid}\t${it.id}\t${dealId}\t${Math.round(sum)}\t${ss.map((f) => Math.round(num(it[f]))).join("|")}`);
    }
  }

  // 3) CSV. Первый столбец - кликабельная ссылка на сделку.
  const esc = (s: any) => { const t = String(s ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const link = (id: string) => `=HYPERLINK("${PORTAL}/crm/deal/details/${id}/","${id}")`;
  const cols = ["Сделка", "Название", "Ответственный(id)", "Бюджет сделки", ...SP.map((s) => `${s.key} с/с`), "Σ с/с", "Маржа", "Стадия", "Дата закрытия"];
  const lines = [cols.join(",")];
  const rows = [...dealById.entries()].sort((a, b) => +b[0] - +a[0]);
  for (const [id, r] of rows) {
    const ssVals = SP.map((s) => Math.round(r.ss[s.key] || 0));
    const ssTot = ssVals.reduce((a, b) => a + b, 0);
    // строку с полностью нулевыми деньгами пропускаем, чтобы не раздувать таблицу
    if (!r.opp && !ssTot) continue;
    // Компактный дамп в stderr - чтобы вытащить с/с через лог CI (артефакт-blob недоступен
    // из песочницы). Только сделки с заполненной с/с. Формат: SSROW<TAB>id opp ssTot stage.
    if (ssTot > 0) console.error(`SSROW\t${id}\t${Math.round(r.opp)}\t${ssTot}\t${String(r.stage || "")}`);
    lines.push([
      esc(link(id)), esc(r.title), esc(r.mgr), Math.round(r.opp),
      ...ssVals, ssTot, Math.round(r.opp - ssTot), esc(r.stage), esc(r.close),
    ].join(","));
  }
  const csv = "﻿" + lines.join("\n"); // BOM - чтобы Excel/Google не ломали кириллицу
  mkdirSync("prod/data", { recursive: true });
  writeFileSync(OUT, csv);
  console.error(`\nГотово: ${rows.length} сделок -> ${OUT}. Столбцы: ${cols.join(" | ")}`);
  // Дамп UTM в конце (попадёт в хвост лога CI): только C49 с непустым utm_source.
  // Формат: UTMROW<TAB>id<TAB>source<TAB>medium<TAB>campaign<TAB>content<TAB>term.
  let utmN = 0;
  for (const [id, rr] of dealById) if (rr.cat === "49" && rr.utm[0]) { console.error(`UTMROW\t${id}\t${rr.utm.join("\t")}`); utmN++; }
  console.error(`UTM-строк (C49 с utm_source): ${utmN}`);
  process.stdout.write(csv); // и в stdout - удобно посмотреть в логе CI или redirect > money.csv
})();
