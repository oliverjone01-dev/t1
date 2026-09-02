// Помесячная динамика по каналам: апрель-август 2026.
// Метрика: лиды по UTM Source и по типу трафика (SEO/реклама/прямые), по месяцам.
// Директ: расход и клики по месяцам. Выход: yandex-direct/data/monthly-channels.json.
// Read-only. Токены из env (YANDEX_DIRECT_TOKEN/LOGIN, YANDEX_METRIKA_TOKEN/COUNTER).
import { writeFileSync, mkdirSync } from 'node:fs';

const DTOKEN = process.env.YANDEX_DIRECT_TOKEN;
const DLOGIN = process.env.YANDEX_DIRECT_LOGIN || '';
const MTOKEN = process.env.YANDEX_METRIKA_TOKEN;
const COUNTER = process.env.YANDEX_METRIKA_COUNTER || '104369223';
if (!DTOKEN || !MTOKEN) { console.error('нет токенов'); process.exit(1); }
const GOAL_LEADS = 487033158, GOAL_CONTACTS = 477925360;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Календарные месяцы; август по 24-е (как в отчёте Ивана).
const MONTHS = [
  ['2026-04', '2026-04-01', '2026-04-30'],
  ['2026-05', '2026-05-01', '2026-05-31'],
  ['2026-06', '2026-06-01', '2026-06-30'],
  ['2026-07', '2026-07-01', '2026-07-31'],
  ['2026-08', '2026-08-01', '2026-08-24'],
];

async function ym(params) {
  const qs = new URLSearchParams({ ids: COUNTER, accuracy: 'full', limit: '500', ...params });
  const res = await fetch(`https://api-metrika.yandex.net/stat/v1/data?${qs}`, { headers: { Authorization: `OAuth ${MTOKEN}` } });
  const j = await res.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j;
}

async function directMonthSpend(d1, d2) {
  const body = { params: {
    SelectionCriteria: { DateFrom: d1, DateTo: d2 },
    FieldNames: ['Cost', 'Clicks', 'Conversions'],
    ReportName: `m-${d1}-${Date.now()}`, ReportType: 'CAMPAIGN_PERFORMANCE_REPORT',
    DateRangeType: 'CUSTOM_DATE', Format: 'TSV', IncludeVAT: 'YES', IncludeDiscount: 'NO',
  } };
  for (let i = 0; i < 15; i++) {
    const res = await fetch('https://api.direct.yandex.com/json/v5/reports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${DTOKEN}`, ...(DLOGIN ? { 'Client-Login': DLOGIN } : {}),
        'Content-Type': 'application/json; charset=utf-8', 'Accept-Language': 'ru', skipReportHeader: 'true', skipReportSummary: 'true' },
      body: JSON.stringify(body),
    });
    if (res.status === 200) {
      const tsv = (await res.text()).trim();
      let cost = 0, clicks = 0, conv = 0;
      for (const line of tsv.split('\n')) { const c = line.split('\t'); if (c.length >= 3) { cost += +c[0] || 0; clicks += +c[1] || 0; conv += +c[2] || 0; } }
      return { spend: Math.round(cost), clicks, conv };
    }
    if (res.status === 201 || res.status === 202) { await sleep(4000); continue; }
    throw new Error(`Direct report ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  throw new Error('Direct report timeout');
}

(async () => {
  const out = { generated_at: new Date().toISOString(), goal: 'CRM Все лиды (487033158)', months: MONTHS.map(m => m[0]),
    utmsource: {}, bysource: {}, direct_spend: [], direct_clicks: [], direct_conv: [] };

  for (const [mon, d1, d2] of MONTHS) {
    const us = await ym({ date1: d1, date2: d2, dimensions: 'ym:s:lastsignUTMSource',
      metrics: `ym:s:visits,ym:s:goal${GOAL_LEADS}reaches,ym:s:goal${GOAL_CONTACTS}reaches`, sort: `-ym:s:goal${GOAL_LEADS}reaches` });
    for (const r of (us.data || [])) {
      const src = r.dimensions[0].name || '(не указан)';
      (out.utmsource[src] = out.utmsource[src] || Array(MONTHS.length).fill(0));
      out.utmsource[src][MONTHS.findIndex(m => m[0] === mon)] = Math.round(r.metrics[1]);
    }
    const bs = await ym({ date1: d1, date2: d2, dimensions: 'ym:s:lastsignTrafficSource',
      metrics: `ym:s:visits,ym:s:goal${GOAL_LEADS}reaches,ym:s:bounceRate`, sort: '-ym:s:visits' });
    for (const r of (bs.data || [])) {
      const t = r.dimensions[0].name || '?';
      (out.bysource[t] = out.bysource[t] || Array(MONTHS.length).fill(0));
      out.bysource[t][MONTHS.findIndex(m => m[0] === mon)] = Math.round(r.metrics[1]);
    }
    const dm = await directMonthSpend(d1, d2);
    out.direct_spend.push(dm.spend); out.direct_clicks.push(dm.clicks); out.direct_conv.push(dm.conv);
    console.error(`${mon}: utm-src ${(us.data || []).length}, traffic-types ${(bs.data || []).length}, Директ spend ${dm.spend} clicks ${dm.clicks}`);
  }

  mkdirSync('yandex-direct/data', { recursive: true });
  writeFileSync('yandex-direct/data/monthly-channels.json', JSON.stringify(out, null, 1) + '\n');
  console.error('MONTHS\t' + out.months.join('\t'));
  for (const [s, arr] of Object.entries(out.utmsource)) if (arr.some(x => x > 0)) console.error(`UTMSRC\t${s}\t${arr.join('\t')}`);
  for (const [s, arr] of Object.entries(out.bysource)) if (arr.some(x => x > 0)) console.error(`TRAFFIC\t${s}\t${arr.join('\t')}`);
  console.error(`DIRECTSPEND\t${out.direct_spend.join('\t')}`);
  console.error(`DIRECTCLICKS\t${out.direct_clicks.join('\t')}`);
  console.error('Готово: yandex-direct/data/monthly-channels.json');
})();
