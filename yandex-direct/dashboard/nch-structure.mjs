#!/usr/bin/env node
// nch-structure.mjs - текущая структура кампании по API (read-only, только get-методы):
// кампания (стратегия, НБ, минус-слова), группы (минус-слова, наборы минус-слов),
// ключи и автотаргетинг (статус, ставки, категории АТ), корректировки ставок.
// Запуск: CAMPAIGN_ID=712877525 node yandex-direct/dashboard/nch-structure.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
mkdirSync(DATA, { recursive: true });

const DTOKEN = process.env.YANDEX_DIRECT_TOKEN;
const DLOGIN = process.env.YANDEX_DIRECT_LOGIN || '';
if (!DTOKEN) { console.error('ERROR: нет YANDEX_DIRECT_TOKEN в env'); process.exit(1); }
const CID = Number(process.env.CAMPAIGN_ID || '712877525');

async function get(service, params, version = 'v5') {
  const res = await fetch(`https://api.direct.yandex.com/json/${version}/${service}`, {
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

// Пагинация get-методов (Limit 10000)
async function getAll(service, params, key) {
  const out = [];
  for (let offset = 0; ; offset += 10000) {
    const r = await get(service, { ...params, Page: { Limit: 10000, Offset: offset } });
    out.push(...(r[key] || []));
    if (!r.LimitedBy) return out;
  }
}

const errors = [];
const safe = async (name, fn) => { try { return await fn(); } catch (e) { errors.push(`${name}: ${e.message}`); console.log(`WARN ${name}: ${e.message}`); return null; } };

// ---------- Кампания ----------
const camp = await safe('campaigns', async () => (await get('campaigns', {
  SelectionCriteria: { Ids: [CID] },
  FieldNames: ['Id', 'Name', 'State', 'Status', 'StartDate', 'NegativeKeywords', 'DailyBudget', 'ExcludedSites'],
  TextCampaignFieldNames: ['BiddingStrategy', 'Settings', 'CounterIds', 'PriorityGoals', 'RelevantKeywords', 'AttributionModel', 'NegativeKeywordSharedSetIds'],
})).Campaigns?.[0]);

// ---------- Группы ----------
const groups = await safe('adgroups', () => getAll('adgroups', {
  SelectionCriteria: { CampaignIds: [CID] },
  FieldNames: ['Id', 'Name', 'Status', 'ServingStatus', 'Type', 'NegativeKeywords', 'NegativeKeywordSharedSetIds', 'RegionIds', 'TrackingParams'],
}, 'AdGroups'));

// ---------- Ключи + автотаргетинг ----------
const kwFields = ['Id', 'Keyword', 'AdGroupId', 'State', 'Status', 'ServingStatus', 'Bid', 'StrategyPriority', 'UserParam1'];
let keywords = await safe('keywords+AT', () => getAll('keywords', {
  SelectionCriteria: { CampaignIds: [CID] }, FieldNames: [...kwFields, 'AutotargetingCategories'],
}, 'Keywords'));
if (!keywords) keywords = await safe('keywords', () => getAll('keywords', {
  SelectionCriteria: { CampaignIds: [CID] }, FieldNames: kwFields,
}, 'Keywords'));

// ---------- Наборы минус-слов ----------
const setIds = [...new Set([
  ...(camp?.TextCampaign?.NegativeKeywordSharedSetIds?.Items || []),
  ...(groups || []).flatMap(g => g.NegativeKeywordSharedSetIds?.Items || []),
])];
const sharedSets = setIds.length ? await safe('negativekeywordsharedsets', async () =>
  (await get('negativekeywordsharedsets', { SelectionCriteria: { Ids: setIds }, FieldNames: ['Id', 'Name', 'NegativeKeywords'] })).NegativeKeywordSharedSets) : [];

// ---------- Корректировки ставок ----------
const bidmods = await safe('bidmodifiers', () => getAll('bidmodifiers', {
  SelectionCriteria: { CampaignIds: [CID], Levels: ['CAMPAIGN', 'AD_GROUP'] },
  FieldNames: ['Id', 'CampaignId', 'AdGroupId', 'Level', 'Type'],
  MobileAdjustmentFieldNames: ['BidModifier', 'OperatingSystemType'],
  DesktopAdjustmentFieldNames: ['BidModifier'],
  TabletAdjustmentFieldNames: ['BidModifier', 'OperatingSystemType'],
  DemographicsAdjustmentFieldNames: ['Gender', 'Age', 'BidModifier', 'Enabled'],
  RetargetingAdjustmentFieldNames: ['RetargetingConditionId', 'BidModifier', 'Accessible', 'Enabled'],
  RegionalAdjustmentFieldNames: ['RegionId', 'BidModifier', 'Enabled'],
  SerpLayoutAdjustmentFieldNames: ['SerpLayout', 'BidModifier', 'Enabled'],
  IncomeGradeAdjustmentFieldNames: ['Grade', 'BidModifier', 'Enabled'],
}, 'BidModifiers'));

const out = {
  campaign_id: String(CID), generated_at: new Date().toISOString(), errors,
  campaign: camp, groups, keywords, shared_sets: sharedSets, bidmodifiers: bidmods,
};
writeFileSync(join(DATA, `nch_structure_${CID}.json`), JSON.stringify(out, null, 1));
console.log(`OK nch_structure_${CID}.json: groups ${groups?.length} keywords ${keywords?.length} bidmods ${bidmods?.length} errors ${errors.length}`);
