#!/usr/bin/env node
// nch-positions.mjs - фактические позиции кликов НЧ из UTM-меток (utm_content: gbid, position_type, position, device, match_type).
// Метрика: визиты и лиды по lastsignUTMContent для utm_campaign=peregorodki_<CID>. Read-only. Токен из env.
// Запуск: CAMPAIGN_ID=712877525 DATE_FROM=2026-07-19 node yandex-direct/dashboard/nch-positions.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
mkdirSync(DATA, { recursive: true });
const MTOKEN = process.env.YANDEX_METRIKA_TOKEN;
const COUNTER = process.env.YANDEX_METRIKA_COUNTER || '104369223';
if (!MTOKEN) { console.error('ERROR: нет YANDEX_METRIKA_TOKEN в env'); process.exit(1); }
const CID = process.env.CAMPAIGN_ID || '712877525';
const D_FROM = process.env.DATE_FROM || '2026-07-19';
const D_TO = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const GOAL_LEADS = 487033158, GOAL_CONTACTS = 477925360;

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

const parse = s => Object.fromEntries((s || '').split('|').map(p => { const i = p.indexOf(':'); return i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [p, '']; }));
const rows = (await metrika({
  dimensions: 'ym:s:date,ym:s:lastsignUTMContent,ym:s:lastsignUTMTerm',
  metrics: `ym:s:visits,ym:s:bounceRate,ym:s:pageDepth,ym:s:goal${GOAL_LEADS}reaches,ym:s:goal${GOAL_CONTACTS}reaches`,
  filters: `ym:s:lastsignUTMCampaign=='peregorodki_${CID}'`,
})).map(r => {
  const c = parse(r.dimensions[1].name), t = parse(r.dimensions[2].name);
  return { date: r.dimensions[0].name, gid: c.gbid || '', ad_id: c.ad_id || '', position_type: c.position_type || '', position: c.position || '',
    device: c.device || '', match_type: c.match_type || '', matched_keyword: c.matched_keyword || '', keyword: t.keyword || '', key_id: t.key_id || '',
    visits: r.metrics[0], bounce: r.metrics[1], depth: r.metrics[2], leads: r.metrics[3], contacts: r.metrics[4] };
});
writeFileSync(join(DATA, `nch_positions_${CID}.json`), JSON.stringify({ campaign_id: CID, dateFrom: D_FROM, dateTo: D_TO, generated_at: new Date().toISOString(), rows }, null, 1));
console.log(`OK nch_positions_${CID}.json rows ${rows.length}`);
