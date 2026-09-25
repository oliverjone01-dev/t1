#!/usr/bin/env node
// nch-groups-alltime.mjs - НЧ по группам с запуска по сегодня: показы → клики → CTR → CPC → расход → визиты → лиды → CR → CPL.
// Вход: data/nch_history_<CID>.json (по вчера) + data/direct_today.json (сегодня). Выход: data/nch_groups_alltime_<CID>.csv
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const CID = process.env.CAMPAIGN_ID || '712877525';
const h = JSON.parse(readFileSync(join(DATA, `nch_history_${CID}.json`)));
const t = JSON.parse(readFileSync(join(DATA, 'direct_today.json')));
const tg = t.groups?.[CID] || { direct: [], metrika: [] };
const names = Object.fromEntries(h.groups.map(g => [g.id, g.name]));
const G = {};
const acc = gid => G[gid] ||= { imp: 0, clicks: 0, spend: 0, at: 0, visits: 0, leads: 0, contacts: 0, first: null, last: null };
const rows = [...h.direct.filter(r => r.date < t.date), ...tg.direct.map(r => ({ ...r, date: t.date }))];
for (const r of rows) { const a = acc(r.gid); a.imp += r.imp; a.clicks += r.clicks; a.spend += r.spend;
  if (r.crit_type === 'AUTOTARGETING') a.at += r.spend; if (r.imp) { a.first = a.first && a.first < r.date ? a.first : r.date; a.last = a.last && a.last > r.date ? a.last : r.date; }
  names[r.gid] ||= r.group; }
const lastLead = {};
for (const r of [...h.metrika.filter(r => r.date < t.date), ...tg.metrika.map(r => ({ ...r, date: t.date }))]) {
  const a = acc(r.gid); a.visits += r.visits; a.leads += r.leads; a.contacts += r.contacts;
  if (r.leads && (!lastLead[r.gid] || lastLead[r.gid] < r.date)) lastLead[r.gid] = r.date; }
const f = (a) => ({ ctr: a.imp ? (a.clicks / a.imp * 100).toFixed(1) : '', cpc: a.clicks ? Math.round(a.spend / a.clicks) : '',
  cr: a.clicks ? (a.leads / a.clicks * 100).toFixed(1) : '', cpl: a.leads ? Math.round(a.spend / a.leads) : '', at: a.spend ? Math.round(a.at / a.spend * 100) : '' });
const T = Object.values(G).reduce((s, a) => { for (const k of ['imp', 'clicks', 'spend', 'at', 'visits', 'leads', 'contacts']) s[k] += a[k]; return s; }, { imp: 0, clicks: 0, spend: 0, at: 0, visits: 0, leads: 0, contacts: 0 });
const out = ['group_id;family;group;imp;clicks;ctr;cpc;spend;spend_share;at_share;visits;leads;contacts;cr;cpl;last_lead'];
for (const [gid, a] of Object.entries(G).sort((x, y) => y[1].spend - x[1].spend)) {
  const n = names[gid] || (gid ? `? ${gid}` : '(без группы)'); const x = f(a);
  out.push([gid, n.split(' | ')[0], n, a.imp, a.clicks, x.ctr, x.cpc, Math.round(a.spend), (a.spend / T.spend * 100).toFixed(1), x.at, a.visits, a.leads, a.contacts, x.cr, x.cpl, lastLead[gid] || ''].join(';')); }
{ const x = f(T); out.push(['', 'ИТОГО', `${h.dateFrom}..${t.date}`, T.imp, T.clicks, x.ctr, x.cpc, Math.round(T.spend), 100, x.at, T.visits, T.leads, T.contacts, x.cr, x.cpl, ''].join(';')); }
writeFileSync(join(DATA, `nch_groups_alltime_${CID}.csv`), '﻿' + out.join('\n') + '\n');
console.log(out.join('\n'));
