#!/usr/bin/env node
// nch-families-quality.mjs - семейства групп НЧ: воронка + объём трафика + позиции + качество визитов + доля АТ.
// Вход: data/nch_quality_<CID>.json. Выход: data/nch_families_quality_<CID>.csv
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const CID = process.env.CAMPAIGN_ID || '712877525';
const q = JSON.parse(readFileSync(join(DATA, `nch_quality_${CID}.json`)));
const fam = n => (n || '?').split(' | ')[0];
const gname = {}; q.groups.forEach(r => gname[r.gid] = r.group);
const F = {};
const acc = k => F[k] ||= { groups: new Set(), imp: 0, clicks: 0, spend: 0, at: 0, atClicks: 0, tvW: 0, tvImp: 0, posW: 0, posImp: 0, cposW: 0, cposCl: 0,
  visits: 0, bounceW: 0, depthW: 0, durW: 0, leads: 0, contacts: 0 };
for (const r of q.groups) { const a = acc(fam(r.group)); a.groups.add(r.gid); a.imp += r.imp; a.clicks += r.clicks; a.spend += r.spend;
  if (r.crit_type === 'AUTOTARGETING') { a.at += r.spend; a.atClicks += r.clicks; }
  if (r.traffic_volume != null && r.imp) { a.tvW += r.traffic_volume * r.imp; a.tvImp += r.imp; }
  if (r.imp_pos != null && r.imp) { a.posW += r.imp_pos * r.imp; a.posImp += r.imp; }
  if (r.click_pos != null && r.clicks) { a.cposW += r.click_pos * r.clicks; a.cposCl += r.clicks; } }
for (const v of q.visits) { const a = acc(fam(gname[v.gid] || v.group)); a.visits += v.visits; a.bounceW += v.bounce * v.visits;
  a.depthW += v.depth * v.visits; a.durW += v.duration * v.visits; a.leads += v.leads; a.contacts += v.contacts; }
const r1 = x => Math.round(x * 10) / 10;
const lines = ['family;groups;imp;clicks;ctr;cpc;spend;at_share_spend;at_share_clicks;traffic_volume;imp_pos;click_pos;visits;bounce;depth;duration_s;leads;contacts;cr;cpl'];
for (const [k, a] of Object.entries(F).sort((x, y) => y[1].spend - x[1].spend)) lines.push([k, a.groups.size, a.imp, a.clicks,
  a.imp ? r1(a.clicks / a.imp * 100) : '', a.clicks ? Math.round(a.spend / a.clicks) : '', Math.round(a.spend),
  a.spend ? Math.round(a.at / a.spend * 100) : '', a.clicks ? Math.round(a.atClicks / a.clicks * 100) : '',
  a.tvImp ? Math.round(a.tvW / a.tvImp) : '', a.posImp ? r1(a.posW / a.posImp) : '', a.cposCl ? r1(a.cposW / a.cposCl) : '',
  a.visits, a.visits ? Math.round(a.bounceW / a.visits) : '', a.visits ? r1(a.depthW / a.visits) : '', a.visits ? Math.round(a.durW / a.visits) : '',
  a.leads, a.contacts, a.clicks ? r1(a.leads / a.clicks * 100) : '', a.leads ? Math.round(a.spend / a.leads) : ''].join(';'));
writeFileSync(join(DATA, `nch_families_quality_${CID}.csv`), '﻿' + lines.join('\n') + '\n');
console.log(lines.join('\n'));
