#!/usr/bin/env node
// account-history.mjs - аккаунт Директа по дням × кампаниям + Метрика (визиты, лиды) по дням × utm_campaign.
// Для разложения CPL = CPC / CR по периодам. Read-only: Reports API + stat Метрики. Токены из env.
// Запуск: DATE_FROM=2026-06-01 node yandex-direct/dashboard/account-history.mjs

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
const D_FROM = process.env.DATE_FROM || '2026-06-01';
const D_TO = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // сегодня МСК (неполный день)
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = x => x == null ? 0 : Number(x) || 0;

async function directReport(name, params) {
  const body = { params: { SelectionCriteria: { DateFrom: D_FROM, DateTo: D_TO }, ReportName: `${name}-${Date.now()}`,
    DateRangeType: 'CUSTOM_DATE', Format: 'TSV', IncludeVAT: 'YES', IncludeDiscount: 'NO', ...params } };
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
  const out = [];
  for (let offset = 1; ; offset += 10000) {
    const qs = new URLSearchParams({ ids: COUNTER, accuracy: 'full', limit: '10000', offset: String(offset), date1: D_FROM, date2: D_TO, ...params });
    const res = await fetch(`https://api-metrika.yandex.net/stat/v1/data?${qs}`, { headers: { Authorization: `OAuth ${MTOKEN}` } });
    const j = await res.json();
    if (j.errors) throw new Error(`metrika: ${JSON.stringify(j.errors)}`);
    out.push(...j.data);
    if (out.length >= j.total_rows || !j.data.length) return out;
  }
}

const direct = (await directReport('acc-daily', {
  FieldNames: ['Date', 'CampaignId', 'CampaignName', 'CampaignType', 'AdNetworkType', 'Impressions', 'Clicks', 'Cost'],
  ReportType: 'CUSTOM_REPORT',
})).map(r => ({ date: r.Date, cid: r.CampaignId, name: r.CampaignName, ctype: r.CampaignType, net: r.AdNetworkType,
  imp: num(r.Impressions), clicks: num(r.Clicks), spend: num(r.Cost) }));
console.log(`OK direct rows ${direct.length}`);

const M = `ym:s:visits,ym:s:bounceRate,ym:s:goal${GOAL_LEADS}reaches,ym:s:goal${GOAL_CONTACTS}reaches`;
const mUtm = (await metrika({ dimensions: 'ym:s:date,ym:s:lastsignUTMCampaign', metrics: M, filters: "ym:s:lastsignTrafficSource=='ad'" }))
  .map(r => ({ date: r.dimensions[0].name, utm: r.dimensions[1].name, visits: r.metrics[0], bounce: r.metrics[1], leads: r.metrics[2], contacts: r.metrics[3] }));
const mEngine = (await metrika({ dimensions: 'ym:s:date,ym:s:lastsignAdvEngine', metrics: M, filters: "ym:s:lastsignTrafficSource=='ad'" }))
  .map(r => ({ date: r.dimensions[0].name, engine: r.dimensions[1].name, visits: r.metrics[0], leads: r.metrics[2], contacts: r.metrics[3] }));
const mAll = (await metrika({ dimensions: 'ym:s:date', metrics: M }))
  .map(r => ({ date: r.dimensions[0].name, visits: r.metrics[0], leads: r.metrics[2], contacts: r.metrics[3] }));
console.log(`OK metrika utm ${mUtm.length}, engine ${mEngine.length}, all ${mAll.length}`);

writeFileSync(join(DATA, 'account_history.json'), JSON.stringify({ dateFrom: D_FROM, dateTo: D_TO, generated_at: new Date().toISOString(),
  goals: { leads: GOAL_LEADS, contacts: GOAL_CONTACTS }, direct, metrika_ad_by_utm: mUtm, metrika_ad_by_engine: mEngine, metrika_all: mAll }, null, 1));
console.log('OK account_history.json');
