#!/usr/bin/env node
// direct-research.mjs - добор данных для плана по трём поисковым РК (read-only, токены из env):
//  1) Директ: группа × блок показа (Slot: премиум / остальные) - доля показов в премиуме;
//  2) Метрика: лиды по реальному поисковому запросу Директа (lastsignDirectSearchPhrase);
//  3) Wordstat topRequests по сид-фразам (новые интенты рядом с «интерьерными»);
//  4) Keys.so: пробы методов по ключевой фразе (кто рекламируется, их запросы) + сохранение ответов.
// Каждый блок независим: сбой одного не валит остальные, ошибки пишутся в errors[].
// Запуск: CAMPAIGN_IDS="712877525 712877517 712877513" node yandex-direct/dashboard/direct-research.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
mkdirSync(DATA, { recursive: true });
const DTOKEN = process.env.YANDEX_DIRECT_TOKEN, DLOGIN = process.env.YANDEX_DIRECT_LOGIN || '';
const MTOKEN = process.env.YANDEX_METRIKA_TOKEN, COUNTER = process.env.YANDEX_METRIKA_COUNTER || '104369223';
const WTOKEN = process.env.YANDEX_OAUTH_TOKEN, KTOKEN = process.env.KEYSO_TOKEN || process.env.KEYSSO_API_KEY;
const CIDS = (process.env.CAMPAIGN_IDS || '712877525 712877517 712877513').split(/\s+/).filter(Boolean);
const D_FROM = process.env.DATE_FROM || '2026-07-19';
const D_TO = new Date(Date.now() + 3 * 3600e3 - 86400e3).toISOString().slice(0, 10);
const GOAL_LEADS = 487033158, GOAL_CONTACTS = 477925360;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = x => x == null ? 0 : Number(x) || 0;
const errors = [];
const out = { generated_at: new Date().toISOString(), dateFrom: D_FROM, dateTo: D_TO, campaigns: CIDS, errors };
const safe = async (name, fn) => { try { return await fn(); } catch (e) { errors.push(`${name}: ${e.message}`); console.log(`WARN ${name}: ${e.message}`); return null; } };

async function directReport(name, cid, params) {
  const body = { params: { SelectionCriteria: { DateFrom: D_FROM, DateTo: D_TO, Filter: [{ Field: 'CampaignId', Operator: 'EQUALS', Values: [cid] }] },
    ReportName: `${name}-${cid}-${Date.now()}`, DateRangeType: 'CUSTOM_DATE', Format: 'TSV', IncludeVAT: 'YES', IncludeDiscount: 'NO', ...params } };
  for (let i = 0; i < 30; i++) {
    const res = await fetch('https://api.direct.yandex.com/json/v5/reports', { method: 'POST', body: JSON.stringify(body), headers: {
      Authorization: `Bearer ${DTOKEN}`, ...(DLOGIN ? { 'Client-Login': DLOGIN } : {}), 'Content-Type': 'application/json; charset=utf-8',
      'Accept-Language': 'ru', processingMode: 'auto', returnMoneyInMicros: 'false', skipReportSummary: 'true' } });
    if (res.status === 200) {
      const lines = (await res.text()).trim().split('\n'); const cols = lines[1].split('\t');
      return lines.slice(2).filter(Boolean).map(l => { const v = l.split('\t'); return Object.fromEntries(cols.map((c, k) => [c, v[k] === '--' ? null : v[k]])); });
    }
    if (res.status === 201 || res.status === 202) { await sleep(6000); continue; }
    if (res.status >= 500) { await sleep(3000 * (i + 1)); continue; }
    throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  throw new Error('report не готов');
}

async function metrika(params) {
  const res = []; for (let offset = 1; ; offset += 10000) {
    const qs = new URLSearchParams({ ids: COUNTER, accuracy: 'full', limit: '10000', offset: String(offset), date1: D_FROM, date2: D_TO, ...params });
    const r = await fetch(`https://api-metrika.yandex.net/stat/v1/data?${qs}`, { headers: { Authorization: `OAuth ${MTOKEN}` } });
    const j = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 300));
    res.push(...j.data); if (res.length >= j.total_rows || !j.data.length) return res;
  }
}

// 1) Доля показов в премиуме по группам
out.slots = {};
for (const cid of CIDS) {
  out.slots[cid] = await safe(`slot ${cid}`, async () => (await directReport('slot', cid, {
    FieldNames: ['AdGroupId', 'AdGroupName', 'Slot', 'Impressions', 'Clicks', 'Cost'], ReportType: 'CUSTOM_REPORT' }))
    .map(r => ({ gid: r.AdGroupId, group: r.AdGroupName, slot: r.Slot, imp: num(r.Impressions), clicks: num(r.Clicks), spend: num(r.Cost) })));
  console.log(`slots ${cid}: ${out.slots[cid]?.length ?? 'ERR'}`);
}

// 2) Лиды по поисковому запросу (Метрика)
out.search_phrases = {};
for (const cid of CIDS) {
  out.search_phrases[cid] = await safe(`phrases ${cid}`, async () => (await metrika({
    dimensions: 'ym:s:lastsignDirectSearchPhrase,ym:s:lastsignDirectBannerGroup',
    metrics: `ym:s:visits,ym:s:bounceRate,ym:s:goal${GOAL_LEADS}reaches,ym:s:goal${GOAL_CONTACTS}reaches`,
    filters: `ym:s:lastsignUTMCampaign=='peregorodki_${cid}'` }))
    .map(r => ({ query: r.dimensions[0].name, gid: String(r.dimensions[1].id ?? ''), group: r.dimensions[1].name,
      visits: r.metrics[0], bounce: r.metrics[1], leads: r.metrics[2], contacts: r.metrics[3] })));
  console.log(`phrases ${cid}: ${out.search_phrases[cid]?.length ?? 'ERR'}`);
}
// Органика: по каким фразам приходят и конвертят (что ищут, чего нет в рекламе)
out.organic_phrases = await safe('organic', async () => (await metrika({
  dimensions: 'ym:s:lastsignSearchPhrase', metrics: `ym:s:visits,ym:s:goal${GOAL_LEADS}reaches`,
  filters: "ym:s:lastsignTrafficSource=='organic'", date1: '2026-06-01' }))
  .map(r => ({ query: r.dimensions[0].name, visits: r.metrics[0], leads: r.metrics[1] })));

// 3) Wordstat topRequests
const SEEDS = ['интерьерные перегородки', 'дизайнерские перегородки', 'стеклянные перегородки в квартиру', 'стеклянная перегородка в комнату',
  'перегородки на заказ', 'раздвижные стеклянные двери', 'складные перегородки', 'перегородка гармошка', 'лофт перегородки',
  'перегородка с дверью', 'зеркальные перегородки', 'стеклянные перегородки', 'перегородка в спальню', 'перегородка для кабинета',
  'остекление проема', 'стеклянная стена в квартире', 'стеклянные двери межкомнатные'];
out.wordstat = {};
if (WTOKEN) for (const s of SEEDS) {
  out.wordstat[s] = await safe(`wordstat ${s}`, async () => {
    const r = await fetch('https://api.wordstat.yandex.net/v1/topRequests', { method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8', Authorization: `Bearer ${WTOKEN}` },
      body: JSON.stringify({ phrase: s, regions: [1], devices: ['phone', 'desktop', 'tablet'] }) });
    const t = await r.text(); if (!r.ok) throw new Error(`HTTP ${r.status} ${t.slice(0, 200)}`); return JSON.parse(t);
  });
  await sleep(1200);
} else errors.push('wordstat: нет YANDEX_OAUTH_TOKEN');

// 4) Keys.so: пробы методов по ключевой фразе
out.keyso = {};
if (KTOKEN) {
  const KH = { 'X-Keyso-TOKEN': KTOKEN, 'auth-token': KTOKEN, Accept: 'application/json' };
  const KW = ['интерьерные перегородки', 'дизайнерские перегородки', 'стеклянные перегородки в квартиру'];
  const probes = kw => [
    `/report/simple/keyword_dashboard?base=msk&keyword=${encodeURIComponent(kw)}`,
    `/report/simple/keyword/context/ads?base=msk&keyword=${encodeURIComponent(kw)}&per_page=50`,
    `/report/simple/keyword/concurents?base=msk&keyword=${encodeURIComponent(kw)}&per_page=50`,
    `/report/simple/keyword/organic/serp?base=msk&keyword=${encodeURIComponent(kw)}`,
    `/report/simple/similarkeys?base=msk&keyword=${encodeURIComponent(kw)}&per_page=100`,
    `/tools/similar_keywords?base=msk&keyword=${encodeURIComponent(kw)}&per_page=100`,
  ];
  for (const kw of KW) { out.keyso[kw] = {};
    for (const p of probes(kw)) {
      out.keyso[kw][p.split('?')[0]] = await safe(`keyso ${p.split('?')[0]}`, async () => {
        const r = await fetch('https://api.keys.so' + p, { headers: KH }); const t = await r.text();
        return { status: r.status, body: t.length > 200000 ? t.slice(0, 200000) : t };
      });
      await sleep(700);
    }
  }
  // Спека API, чтобы выбрать правильные методы на следующий прогон
  for (const u of ['https://api.keys.so/swagger.json', 'https://api.keys.so/api-docs', 'https://api.keys.so/documentation', 'https://api.keys.so/openapi.json'])
    out.keyso['spec ' + u] = await safe(`spec ${u}`, async () => { const r = await fetch(u); const t = await r.text(); return { status: r.status, body: t.slice(0, 300000) }; });
} else errors.push('keyso: нет KEYSO_TOKEN');

writeFileSync(join(DATA, 'research_search_rk.json'), JSON.stringify(out, null, 1));
console.log(`OK research_search_rk.json, errors: ${errors.length}`);
