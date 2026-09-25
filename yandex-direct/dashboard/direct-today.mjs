#!/usr/bin/env node
// direct-today.mjs - трафик за сегодня (МСК): Директ по кампаниям + Метрика (визиты, лиды) по кампаниям и часам.
// Read-only: Reports API (TODAY), campaigns.get, stat Метрики. Токены из env.
// Запуск: node yandex-direct/dashboard/direct-today.mjs

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

const GOAL_LEADS = 487033158;      // CRM | Все лиды
const GOAL_CONTACTS = 477925360;   // Отправка контактов
const now = new Date();
const TODAY = new Date(now.getTime() + 3 * 3600e3).toISOString().slice(0, 10); // дата МСК
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = x => x == null ? 0 : Number(x) || 0;
const dH = () => ({
  Authorization: `Bearer ${DTOKEN}`, ...(DLOGIN ? { 'Client-Login': DLOGIN } : {}),
  'Content-Type': 'application/json; charset=utf-8', 'Accept-Language': 'ru',
});

async function directApi(service, params) {
  const res = await fetch(`https://api.direct.yandex.com/json/v5/${service}`, { method: 'POST', headers: dH(), body: JSON.stringify({ method: 'get', params }) });
  const j = await res.json();
  if (j.error) throw new Error(`${service}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function directReport(name, params) {
  const body = { params: { SelectionCriteria: {}, ReportName: `${name}-${Date.now()}`, DateRangeType: 'TODAY',
    Format: 'TSV', IncludeVAT: 'YES', IncludeDiscount: 'NO', ...params } };
  for (let i = 0; i < 20; i++) {
    const res = await fetch('https://api.direct.yandex.com/json/v5/reports', {
      method: 'POST', headers: { ...dH(), processingMode: 'online', returnMoneyInMicros: 'false', skipReportSummary: 'true' },
      body: JSON.stringify(body),
    });
    if (res.status === 200) {
      const lines = (await res.text()).trim().split('\n');
      const cols = lines[1].split('\t');
      return lines.slice(2).filter(Boolean).map(l => { const v = l.split('\t'); return Object.fromEntries(cols.map((c, k) => [c, v[k] === '--' ? null : v[k]])); });
    }
    if (res.status === 201 || res.status === 202) { await sleep(5000); continue; }
    if (res.status >= 500) { await sleep(3000 * (i + 1)); continue; }
    throw new Error(`report ${name}: HTTP ${res.status} ${await res.text()}`);
  }
  throw new Error(`report ${name}: не готов`);
}

async function metrika(params) {
  const qs = new URLSearchParams({ ids: COUNTER, accuracy: 'full', limit: '1000', date1: TODAY, date2: TODAY, ...params });
  const res = await fetch(`https://api-metrika.yandex.net/stat/v1/data?${qs}`, { headers: { Authorization: `OAuth ${MTOKEN}` } });
  const j = await res.json();
  if (j.errors) throw new Error(`metrika: ${JSON.stringify(j.errors)}`);
  return j.data;
}

const M = `ym:s:visits,ym:s:bounceRate,ym:s:goal${GOAL_LEADS}reaches,ym:s:goal${GOAL_CONTACTS}reaches`;
const mrow = r => ({ visits: r.metrics[0], bounce: +r.metrics[1].toFixed(1), leads: r.metrics[2], contacts: r.metrics[3] });

const camps = (await directApi('campaigns', { SelectionCriteria: {}, FieldNames: ['Id', 'Name', 'State', 'Status'] })).Campaigns || [];
const direct = (await directReport('today-camp', {
  FieldNames: ['CampaignId', 'CampaignName', 'Impressions', 'Clicks', 'Cost', 'AvgCpc', 'Ctr'],
  ReportType: 'CAMPAIGN_PERFORMANCE_REPORT',
})).map(r => ({ cid: r.CampaignId, name: r.CampaignName, imp: num(r.Impressions), clicks: num(r.Clicks), spend: num(r.Cost) }));

const byUtm = (await metrika({ dimensions: 'ym:s:lastsignUTMCampaign', metrics: M, sort: '-ym:s:visits' }))
  .map(r => ({ utm: r.dimensions[0].name, ...mrow(r) }));
const byHourAd = (await metrika({ dimensions: 'ym:s:hour', metrics: M, filters: "ym:s:lastsignTrafficSource=='ad'", sort: 'ym:s:hour' }))
  .map(r => ({ hour: r.dimensions[0].name, ...mrow(r) }));
const bySource = (await metrika({ dimensions: 'ym:s:lastsignTrafficSource', metrics: M, sort: '-ym:s:visits' }))
  .map(r => ({ source: r.dimensions[0].name, ...mrow(r) }));

const out = { date: TODAY, generated_at: now.toISOString(), timezone: 'Europe/Moscow',
  campaigns: camps.map(c => ({ id: c.Id, name: c.Name, state: c.State, status: c.Status })),
  direct, metrika_by_utm: byUtm, metrika_ad_by_hour: byHourAd, metrika_by_source: bySource };
writeFileSync(join(DATA, 'direct_today.json'), JSON.stringify(out, null, 1));
console.log(`OK direct_today.json ${TODAY}: direct rows ${direct.length}, utm ${byUtm.length}, hours ${byHourAd.length}`);
