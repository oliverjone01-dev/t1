#!/usr/bin/env node
// nch-quality.mjs - почему группы не конвертят: объём трафика и позиции (Директ), качество визитов (Метрика),
// поисковые запросы по группам. Период - с запуска по вчера. Read-only. Токены из env.
// Запуск: CAMPAIGN_ID=712877525 DATE_FROM=2026-07-19 node yandex-direct/dashboard/nch-quality.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
mkdirSync(DATA, { recursive: true });
const DTOKEN = process.env.YANDEX_DIRECT_TOKEN;
const DLOGIN = process.env.YANDEX_DIRECT_LOGIN || '';
const MTOKEN = process.env.YANDEX_METRIKA_TOKEN;
const COUNTER = process.env.YANDEX_METRIKA_COUNTER || '104369223';
if (!DTOKEN || !MTOKEN) { console.error('ERROR: нет YANDEX_DIRECT_TOKEN / YANDEX_METRIKA_TOKEN в env'); process.exit(1); }
const CID = process.env.CAMPAIGN_ID || '712877525';
const D_FROM = process.env.DATE_FROM || '2026-07-19';
const D_TO = new Date(Date.now() + 3 * 3600e3 - 86400e3).toISOString().slice(0, 10); // вчера МСК
const GOAL_LEADS = 487033158, GOAL_CONTACTS = 477925360;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = x => x == null ? null : (Number(x) || 0);

async function directReport(name, params) {
  const body = { params: { SelectionCriteria: { DateFrom: D_FROM, DateTo: D_TO, Filter: [{ Field: 'CampaignId', Operator: 'EQUALS', Values: [CID] }] },
    ReportName: `${name}-${Date.now()}`, DateRangeType: 'CUSTOM_DATE', Format: 'TSV', IncludeVAT: 'YES', IncludeDiscount: 'NO', ...params } };
  for (let i = 0; i < 30; i++) {
    const res = await fetch('https://api.direct.yandex.com/json/v5/reports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${DTOKEN}`, ...(DLOGIN ? { 'Client-Login': DLOGIN } : {}),
        'Content-Type': 'application/json; charset=utf-8', 'Accept-Language': 'ru',
        processingMode: 'auto', returnMoneyInMicros: 'false', skipReportSummary: 'true' },
      body: JSON.stringify(body),
    });
    if (res.status === 200) {
      const lines = (await res.text()).trim().split('\n');
      const cols = lines[1].split('\t');
      return lines.slice(2).filter(Boolean).map(l => { const v = l.split('\t'); return Object.fromEntries(cols.map((c, k) => [c, v[k] === '--' ? null : v[k]])); });
    }
    if (res.status === 201 || res.status === 202) { await sleep(6000); continue; }
    if (res.status >= 500) { await sleep(3000 * (i + 1)); continue; }
    throw new Error(`report ${name}: HTTP ${res.status} ${await res.text()}`);
  }
  throw new Error(`report ${name}: не готов`);
}

async function metrika(params) {
  const qs = new URLSearchParams({ ids: COUNTER, accuracy: 'full', limit: '10000', date1: D_FROM, date2: D_TO, ...params });
  const res = await fetch(`https://api-metrika.yandex.net/stat/v1/data?${qs}`, { headers: { Authorization: `OAuth ${MTOKEN}` } });
  const j = await res.json();
  if (j.errors) throw new Error(`metrika: ${JSON.stringify(j.errors)}`);
  return j.data;
}

const errors = [];
// 1. Группа × тип условия: объём трафика, позиции, отказы/глубина по данным Директа
const base = ['AdGroupId', 'AdGroupName', 'CriterionType', 'Impressions', 'Clicks', 'Cost', 'AvgTrafficVolume'];
let groups;
try {
  groups = await directReport('q-groups', { FieldNames: [...base, 'AvgImpressionPosition', 'AvgClickPosition', 'BounceRate', 'AvgPageviews'], ReportType: 'CUSTOM_REPORT' });
} catch (e) {
  errors.push(`groups+pos: ${e.message}`); console.log(`WARN ${e.message}`);
  groups = await directReport('q-groups-min', { FieldNames: base, ReportType: 'CUSTOM_REPORT' });
}
groups = groups.map(r => ({ gid: r.AdGroupId, group: r.AdGroupName, crit_type: r.CriterionType,
  imp: num(r.Impressions), clicks: num(r.Clicks), spend: num(r.Cost), traffic_volume: num(r.AvgTrafficVolume),
  imp_pos: num(r.AvgImpressionPosition), click_pos: num(r.AvgClickPosition), bounce_direct: num(r.BounceRate), depth_direct: num(r.AvgPageviews) }));
console.log(`OK groups ${groups.length}`);

// 2. Поисковые запросы по группам
const queries = (await directReport('q-sq', {
  FieldNames: ['AdGroupId', 'Query', 'CriterionType', 'Criterion', 'Impressions', 'Clicks', 'Cost', 'BounceRate'],
  ReportType: 'SEARCH_QUERY_PERFORMANCE_REPORT',
})).map(r => ({ gid: r.AdGroupId, query: r.Query, crit_type: r.CriterionType, criterion: r.Criterion,
  imp: num(r.Impressions), clicks: num(r.Clicks), spend: num(r.Cost), bounce: num(r.BounceRate) }));
console.log(`OK queries ${queries.length}`);

// 3. Метрика: качество визитов по группам
let visits = [];
try {
  visits = (await metrika({ dimensions: 'ym:s:lastsignDirectBannerGroup',
    metrics: `ym:s:visits,ym:s:bounceRate,ym:s:pageDepth,ym:s:avgVisitDurationSeconds,ym:s:goal${GOAL_LEADS}reaches,ym:s:goal${GOAL_CONTACTS}reaches`,
    filters: `ym:s:lastsignUTMCampaign=='peregorodki_${CID}'` }))
    .map(r => ({ gid: String(r.dimensions[0].id ?? ''), group: r.dimensions[0].name, visits: r.metrics[0], bounce: r.metrics[1],
      depth: r.metrics[2], duration: r.metrics[3], leads: r.metrics[4], contacts: r.metrics[5] }));
} catch (e) { errors.push(`metrika: ${e.message}`); }
// Посадочные страницы по группам
let landings = [];
try {
  landings = (await metrika({ dimensions: 'ym:s:lastsignDirectBannerGroup,ym:s:startURLPath',
    metrics: `ym:s:visits,ym:s:bounceRate,ym:s:goal${GOAL_LEADS}reaches`, filters: `ym:s:lastsignUTMCampaign=='peregorodki_${CID}'` }))
    .map(r => ({ gid: String(r.dimensions[0].id ?? ''), landing: r.dimensions[1].name, visits: r.metrics[0], bounce: r.metrics[1], leads: r.metrics[2] }));
} catch (e) { errors.push(`landings: ${e.message}`); }
console.log(`OK metrika visits ${visits.length}, landings ${landings.length}, errors ${errors.length}`);

writeFileSync(join(DATA, `nch_quality_${CID}.json`), JSON.stringify({ campaign_id: CID, dateFrom: D_FROM, dateTo: D_TO,
  generated_at: new Date().toISOString(), errors, groups, queries, visits, landings }, null, 1));
console.log(`OK nch_quality_${CID}.json`);
