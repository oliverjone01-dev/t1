#!/usr/bin/env node
// make-snapshots.mjs - снимки данных Яндекс.Директ + Метрика для дашборда.
// Контракт analytics-mvp: каждый снимок = {dateFrom, dateTo, generated_at, totals, ...}.
// Read-only: только Reports API / get-методы / stat Метрики. Токены из env.
// Запуск: node yandex-direct/dashboard/make-snapshots.mjs

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

const GOAL_LEADS = 487033158;      // CRM | Все лиды
const GOAL_CONTACTS = 477925360;   // Отправка контактов

const iso = d => d.toISOString().slice(0, 10);
const today = new Date();
const D_TO = iso(new Date(today.getTime() - 86400000)); // вчера - полный день
const D_FROM_30 = iso(new Date(today.getTime() - 30 * 86400000));
const D_FROM_14 = iso(new Date(today.getTime() - 14 * 86400000));
const GEN = new Date().toISOString();

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function directApi(service, params) {
  const res = await fetch(`https://api.direct.yandex.com/json/v5/${service}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DTOKEN}`,
      ...(DLOGIN ? { 'Client-Login': DLOGIN } : {}),
      'Content-Type': 'application/json; charset=utf-8',
      'Accept-Language': 'ru',
    },
    body: JSON.stringify({ method: 'get', params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${service}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function directReport(name, fields, dateFrom, dateTo, reportType) {
  const body = { params: {
    SelectionCriteria: { DateFrom: dateFrom, DateTo: dateTo },
    FieldNames: fields,
    ReportName: `${name}-${Date.now()}`,
    ReportType: reportType,
    DateRangeType: 'CUSTOM_DATE', Format: 'TSV', IncludeVAT: 'YES', IncludeDiscount: 'NO',
  } };
  for (let i = 0; i < 12; i++) {
    const res = await fetch('https://api.direct.yandex.com/json/v5/reports', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DTOKEN}`,
        ...(DLOGIN ? { 'Client-Login': DLOGIN } : {}),
        'Content-Type': 'application/json; charset=utf-8',
        'Accept-Language': 'ru', processingMode: 'auto', returnMoneyInMicros: 'false',
      },
      body: JSON.stringify(body),
    });
    if (res.status === 200) {
      const text = await res.text();
      const lines = text.trim().split('\n');
      // строка 0 - заголовок отчёта, 1 - имена колонок, последняя - "Total rows: N"
      const cols = lines[1].split('\t');
      return lines.slice(2, -1).map(l => {
        const v = l.split('\t');
        return Object.fromEntries(cols.map((c, i) => [c, v[i] === '--' ? null : v[i]]));
      });
    }
    if (res.status === 201 || res.status === 202) { await sleep(6000); continue; }
    if (res.status >= 500) { await sleep(3000 * (i + 1)); continue; } // транзиентные 5xx/DNS прокси
    throw new Error(`report ${name}: HTTP ${res.status} ${await res.text()}`);
  }
  throw new Error(`report ${name}: не готов после 12 попыток`);
}

async function metrika(params) {
  const qs = new URLSearchParams({ ids: COUNTER, accuracy: 'full', limit: '1000', ...params });
  const res = await fetch(`https://api-metrika.yandex.net/stat/v1/data?${qs}`, {
    headers: { Authorization: `OAuth ${MTOKEN}` },
  });
  const j = await res.json();
  if (j.errors) throw new Error(`metrika: ${JSON.stringify(j.errors)}`);
  return j;
}

const num = x => x == null ? 0 : Number(x) || 0;
const put = (name, obj) => {
  writeFileSync(join(DATA, name), JSON.stringify(obj, null, 1));
  console.log(`OK ${name}`);
};

// ---------- 1. Кампании (сущности) ----------
const camps = await directApi('campaigns', {
  SelectionCriteria: {},
  FieldNames: ['Id', 'Name', 'Type', 'Status', 'State', 'StatusPayment', 'DailyBudget', 'StartDate'],
  TextCampaignFieldNames: ['BiddingStrategy'],
  UnifiedCampaignFieldNames: ['BiddingStrategy'],
});
const campaigns = (camps.Campaigns || []).map(c => ({
  id: c.Id, name: c.Name, type: c.Type, status: c.Status, state: c.State,
  payment: c.StatusPayment, start: c.StartDate,
  dailyBudget: c.DailyBudget ? c.DailyBudget.Amount / 1e6 : null,
  strategy: c.TextCampaign?.BiddingStrategy?.Search?.BiddingStrategyType
    || c.UnifiedCampaign?.BiddingStrategy?.Search?.BiddingStrategyType || null,
}));

// ---------- 2. Отчёты Директа ----------
const F = ['CampaignId', 'CampaignName', 'Impressions', 'Clicks', 'Cost', 'Conversions'];
const daily = await directReport('daily', ['Date', ...F], D_FROM_30, D_TO, 'CAMPAIGN_PERFORMANCE_REPORT');
const byCamp = await directReport('bycamp', [...F, 'Ctr', 'AvgCpc'], D_FROM_30, D_TO, 'CAMPAIGN_PERFORMANCE_REPORT');
const crit = await directReport('crit',
  ['CampaignName', 'AdGroupName', 'Criteria', 'CriteriaId', 'Impressions', 'Clicks', 'Ctr', 'AvgCpc', 'Cost', 'Conversions'],
  D_FROM_30, D_TO, 'CRITERIA_PERFORMANCE_REPORT');
const sq = await directReport('sq',
  ['CampaignName', 'AdGroupName', 'Query', 'Impressions', 'Clicks', 'Cost', 'Conversions'],
  D_FROM_14, D_TO, 'SEARCH_QUERY_PERFORMANCE_REPORT');

// ---------- 3. Метрика ----------
const mDaily = await metrika({
  date1: D_FROM_30, date2: D_TO,
  dimensions: 'ym:s:date',
  metrics: `ym:s:visits,ym:s:users,ym:s:bounceRate,ym:s:goal${GOAL_LEADS}reaches,ym:s:goal${GOAL_CONTACTS}reaches`,
  filters: "ym:s:lastsignTrafficSource=='ad'", sort: 'ym:s:date',
});
const mEngine = await metrika({
  date1: D_FROM_30, date2: D_TO,
  dimensions: 'ym:s:lastsignAdvEngine',
  metrics: `ym:s:visits,ym:s:users,ym:s:goal${GOAL_LEADS}reaches,ym:s:goal${GOAL_CONTACTS}reaches`,
  filters: "ym:s:lastsignTrafficSource=='ad'", sort: '-ym:s:visits',
});
const mUtm = await metrika({
  date1: D_FROM_30, date2: D_TO,
  dimensions: 'ym:s:lastsignUTMCampaign',
  metrics: `ym:s:visits,ym:s:goal${GOAL_LEADS}reaches,ym:s:goal${GOAL_CONTACTS}reaches`,
  sort: '-ym:s:visits',
});
const mSources = await metrika({
  date1: D_FROM_30, date2: D_TO,
  dimensions: 'ym:s:lastsignTrafficSource',
  metrics: `ym:s:visits,ym:s:users,ym:s:bounceRate,ym:s:goal${GOAL_LEADS}reaches,ym:s:goal${GOAL_CONTACTS}reaches`,
  sort: '-ym:s:visits',
});

// ---------- 4. Снимки ----------
const hdr = { dateFrom: D_FROM_30, dateTo: D_TO, generated_at: GEN };

// direct_campaigns.json - сущности + 30d статистика
const statById = Object.fromEntries(byCamp.map(r => [r.CampaignId, r]));
put('direct_campaigns.json', { ...hdr,
  totals: {
    campaigns: campaigns.length,
    active: campaigns.filter(c => c.state === 'ON').length,
    moderation: campaigns.filter(c => c.status === 'MODERATION').length,
    spend: byCamp.reduce((s, r) => s + num(r.Cost), 0),
    clicks: byCamp.reduce((s, r) => s + num(r.Clicks), 0),
    impressions: byCamp.reduce((s, r) => s + num(r.Impressions), 0),
    conversions: byCamp.reduce((s, r) => s + num(r.Conversions), 0),
  },
  campaigns: campaigns.map(c => {
    const s = statById[String(c.id)] || {};
    return { ...c, imp: num(s.Impressions), clicks: num(s.Clicks), ctr: num(s.Ctr),
      cpc: num(s.AvgCpc), spend: num(s.Cost), conv: num(s.Conversions) };
  }),
});

// direct_daily.json - день x кампания + метрика-день (рекламный трафик)
const mDailyMap = Object.fromEntries((mDaily.data || []).map(r =>
  [r.dimensions[0].name, { visits: r.metrics[0], users: r.metrics[1], bounce: r.metrics[2], leads: r.metrics[3], contacts: r.metrics[4] }]));
put('direct_daily.json', { ...hdr,
  totals: {
    spend: daily.reduce((s, r) => s + num(r.Cost), 0),
    clicks: daily.reduce((s, r) => s + num(r.Clicks), 0),
    ad_visits: (mDaily.totals || [0])[0],
    ad_leads: (mDaily.totals || [0, 0, 0, 0])[3],
  },
  days: daily.map(r => ({ date: r.Date, cid: num(r.CampaignId), camp: r.CampaignName,
    imp: num(r.Impressions), clicks: num(r.Clicks), spend: num(r.Cost), conv: num(r.Conversions) })),
  metrika_days: mDailyMap,
});

// direct_keywords.json
put('direct_keywords.json', { ...hdr,
  totals: { rows: crit.length, spend: crit.reduce((s, r) => s + num(r.Cost), 0) },
  rows: crit.map(r => ({ camp: r.CampaignName, group: r.AdGroupName, crit: r.Criteria,
    id: num(r.CriteriaId), imp: num(r.Impressions), clicks: num(r.Clicks), ctr: num(r.Ctr),
    cpc: num(r.AvgCpc), spend: num(r.Cost), conv: num(r.Conversions) })),
});

// direct_queries.json (14 дней)
put('direct_queries.json', { dateFrom: D_FROM_14, dateTo: D_TO, generated_at: GEN,
  totals: { rows: sq.length, spend: sq.reduce((s, r) => s + num(r.Cost), 0) },
  rows: sq.map(r => ({ camp: r.CampaignName, group: r.AdGroupName, query: r.Query,
    imp: num(r.Impressions), clicks: num(r.Clicks), spend: num(r.Cost), conv: num(r.Conversions) })),
});

// direct_metrika.json - сверка
put('direct_metrika.json', { ...hdr, counter: Number(COUNTER),
  goals: { leads: GOAL_LEADS, contacts: GOAL_CONTACTS },
  totals: {
    direct_clicks_30d: byCamp.reduce((s, r) => s + num(r.Clicks), 0),
    ad_visits_30d: (mEngine.data || []).reduce((s, r) => s + r.metrics[0], 0),
    yd_visits_30d: (mEngine.data || []).filter(r => /direct/i.test(r.dimensions[0].name))
      .reduce((s, r) => s + r.metrics[0], 0),
    ad_leads_30d: (mEngine.data || []).reduce((s, r) => s + r.metrics[2], 0),
  },
  by_engine: (mEngine.data || []).map(r => ({ engine: r.dimensions[0].name,
    visits: r.metrics[0], users: r.metrics[1], leads: r.metrics[2], contacts: r.metrics[3] })),
  by_utm: (mUtm.data || []).slice(0, 100).map(r => ({ utm: r.dimensions[0].name,
    visits: r.metrics[0], leads: r.metrics[1], contacts: r.metrics[2] })),
  by_source: (mSources.data || []).map(r => ({ source: r.dimensions[0].name,
    visits: r.metrics[0], users: r.metrics[1], bounce: r.metrics[2], leads: r.metrics[3], contacts: r.metrics[4] })),
});

console.log('Снимки готовы:', D_FROM_30, '..', D_TO);
