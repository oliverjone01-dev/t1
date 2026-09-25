#!/usr/bin/env node
// nch-history.mjs - история кампании «Поиск НЧ» (712877525) с даты запуска.
// Директ: день × группа × тип условия (фраза / автотаргетинг), показы → клики → расход → лиды.
// Метрика: день × группа Директа, визиты и лиды (цели CRM «Все лиды» / «Отправка контактов»).
// Read-only: Reports API, adgroups.get, stat Метрики. Токены из env, в файл не пишутся.
// Запуск: CAMPAIGN_ID=712877525 DATE_FROM=2026-07-19 node yandex-direct/dashboard/nch-history.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
mkdirSync(DATA, { recursive: true });

const DTOKEN = process.env.YANDEX_DIRECT_TOKEN;
const DLOGIN = process.env.YANDEX_DIRECT_LOGIN || '';
const MTOKEN = process.env.YANDEX_METRIKA_TOKEN;
const COUNTER = process.env.YANDEX_METRIKA_COUNTER || '104369223';
if (!DTOKEN || !MTOKEN) { console.error('ERROR: нет YANDEX_DIRECT_TOKEN / YANDEX_METRIKA_TOKEN в env'); process.exit(1); }

const CID = process.env.CAMPAIGN_ID || '712877525';
const D_FROM = process.env.DATE_FROM || '2026-07-19';
const GOAL_LEADS = 487033158;      // CRM | Все лиды
const GOAL_CONTACTS = 477925360;   // Отправка контактов

const iso = d => d.toISOString().slice(0, 10);
const D_TO = iso(new Date(Date.now() - 86400000)); // вчера - полный день
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = x => x == null ? 0 : Number(x) || 0;

const dHeaders = () => ({
  Authorization: `Bearer ${DTOKEN}`,
  ...(DLOGIN ? { 'Client-Login': DLOGIN } : {}),
  'Content-Type': 'application/json; charset=utf-8',
  'Accept-Language': 'ru',
});

async function directApi(service, params) {
  const res = await fetch(`https://api.direct.yandex.com/json/v5/${service}`, {
    method: 'POST', headers: dHeaders(), body: JSON.stringify({ method: 'get', params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${service}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function directReport(name, params) {
  const body = { params: {
    SelectionCriteria: { DateFrom: D_FROM, DateTo: D_TO,
      Filter: [{ Field: 'CampaignId', Operator: 'EQUALS', Values: [CID] }] },
    ReportName: `${name}-${Date.now()}`,
    DateRangeType: 'CUSTOM_DATE', Format: 'TSV', IncludeVAT: 'YES', IncludeDiscount: 'NO',
    ...params,
  } };
  for (let i = 0; i < 20; i++) {
    const res = await fetch('https://api.direct.yandex.com/json/v5/reports', {
      method: 'POST',
      headers: { ...dHeaders(), processingMode: 'auto', returnMoneyInMicros: 'false', skipReportSummary: 'true' },
      body: JSON.stringify(body),
    });
    if (res.status === 200) {
      const lines = (await res.text()).trim().split('\n');
      // строка 0 - заголовок отчёта, 1 - имена колонок (summary отключён)
      const cols = lines[1].split('\t');
      return lines.slice(2).map(l => {
        const v = l.split('\t');
        return Object.fromEntries(cols.map((c, k) => [c, v[k] === '--' ? null : v[k]]));
      });
    }
    if (res.status === 201 || res.status === 202) { await sleep(6000); continue; }
    if (res.status >= 500) { await sleep(3000 * (i + 1)); continue; }
    throw new Error(`report ${name}: HTTP ${res.status} ${await res.text()}`);
  }
  throw new Error(`report ${name}: не готов после 20 попыток`);
}

async function metrika(params) {
  const out = [];
  for (let offset = 1; ; offset += 10000) {
    const qs = new URLSearchParams({ ids: COUNTER, accuracy: 'full', limit: '10000', offset: String(offset), ...params });
    const res = await fetch(`https://api-metrika.yandex.net/stat/v1/data?${qs}`, {
      headers: { Authorization: `OAuth ${MTOKEN}` },
    });
    const j = await res.json();
    if (j.errors) throw new Error(`metrika: ${JSON.stringify(j.errors)}`);
    out.push(...j.data);
    if (out.length >= j.total_rows || !j.data.length) return out;
  }
}

// ---------- 1. Группы (сущности) ----------
const ag = await directApi('adgroups', {
  SelectionCriteria: { CampaignIds: [Number(CID)] },
  FieldNames: ['Id', 'Name', 'Status', 'ServingStatus', 'Type'],
});
const groups = (ag.AdGroups || []).map(g => ({
  id: String(g.Id), name: g.Name, status: g.Status, serving: g.ServingStatus, type: g.Type,
}));
console.log(`OK adgroups: ${groups.length}`);

// ---------- 2. Директ: день × группа × тип условия ----------
const goalCols = [`Conversions_${GOAL_LEADS}_LSC`, `Conversions_${GOAL_CONTACTS}_LSC`];
const rows = await directReport('nch-daily', {
  FieldNames: ['Date', 'AdGroupId', 'AdGroupName', 'CriterionType', 'Impressions', 'Clicks', 'Cost', 'Conversions'],
  ReportType: 'CUSTOM_REPORT',
  Goals: [String(GOAL_LEADS), String(GOAL_CONTACTS)],
  AttributionModels: ['LSC'],
});
const direct = rows.map(r => ({
  date: r.Date, gid: r.AdGroupId, group: r.AdGroupName, crit_type: r.CriterionType,
  imp: num(r.Impressions), clicks: num(r.Clicks), spend: num(r.Cost),
  leads_direct: num(r[goalCols[0]]), contacts_direct: num(r[goalCols[1]]),
}));
console.log(`OK direct rows: ${direct.length}`);

// Все цели кампании (как в интерфейсе, без фильтра по цели) - чтобы сверить «380 конверсий».
const rowsAll = await directReport('nch-daily-allgoals', {
  FieldNames: ['Date', 'AdGroupId', 'Conversions'],
  ReportType: 'CUSTOM_REPORT',
});
const convAll = rowsAll.map(r => ({ date: r.Date, gid: r.AdGroupId, conv_all: num(r.Conversions) }));

// ---------- 3. Метрика: день × группа Директа ----------
const mFilter = `ym:s:lastsignUTMCampaign=='peregorodki_${CID}'`;
const mMetrics = `ym:s:visits,ym:s:bounceRate,ym:s:goal${GOAL_LEADS}reaches,ym:s:goal${GOAL_CONTACTS}reaches`;
let metrikaRows = [], metrikaMode = 'DirectBannerGroup';
try {
  const m = await metrika({ date1: D_FROM, date2: D_TO, dimensions: 'ym:s:date,ym:s:lastsignDirectBannerGroup',
    metrics: mMetrics, filters: mFilter });
  metrikaRows = m.map(r => ({ date: r.dimensions[0].name, gid: String(r.dimensions[1].id ?? ''),
    group: r.dimensions[1].name, visits: r.metrics[0], bounce: r.metrics[1], leads: r.metrics[2], contacts: r.metrics[3] }));
} catch (e) {
  // Фолбэк: gbid из utm_content (шаблон ссылки: utm_content=gbid:{gbid}|...)
  console.log(`WARN DirectBannerGroup: ${e.message}; фолбэк на utm_content`);
  metrikaMode = 'utm_content.gbid';
  const m = await metrika({ date1: D_FROM, date2: D_TO, dimensions: 'ym:s:date,ym:s:lastsignUTMContent',
    metrics: mMetrics, filters: mFilter });
  const agg = {};
  for (const r of m) {
    const gid = (/gbid:(\d+)/.exec(r.dimensions[1].name || '') || [])[1] || '';
    const k = `${r.dimensions[0].name}|${gid}`;
    const a = agg[k] ||= { date: r.dimensions[0].name, gid, visits: 0, leads: 0, contacts: 0 };
    a.visits += r.metrics[0]; a.leads += r.metrics[2]; a.contacts += r.metrics[3];
  }
  metrikaRows = Object.values(agg);
}
console.log(`OK metrika rows: ${metrikaRows.length} (${metrikaMode})`);

const out = {
  campaign_id: CID, dateFrom: D_FROM, dateTo: D_TO, generated_at: new Date().toISOString(),
  goals: { leads: GOAL_LEADS, contacts: GOAL_CONTACTS, attribution: 'LSC' },
  metrika_mode: metrikaMode,
  groups, direct, conv_all: convAll, metrika: metrikaRows,
};
writeFileSync(join(DATA, `nch_history_${CID}.json`), JSON.stringify(out, null, 1));
console.log(`OK nch_history_${CID}.json`);
