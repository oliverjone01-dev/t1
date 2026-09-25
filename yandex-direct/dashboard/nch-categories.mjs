#!/usr/bin/env node
// nch-categories.mjs - три категории групп НЧ и достаточность данных, свод по интентам.
// A: есть лиды; B: есть клики, нет лидов; C: нет кликов.
// Достаточность: P(лидов <= факт | ожидание = клики × CR кампании) по Пуассону. <10% = данных хватает, группа хуже средней.
// Вход: nch_groups_alltime_<CID>.csv, nch_structure_<CID>.json, nch_quality_<CID>.json [, nch_positions_<CID>.json]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const CID = process.env.CAMPAIGN_ID || '712877525';
const s = JSON.parse(readFileSync(join(DATA, `nch_structure_${CID}.json`)));
const q = JSON.parse(readFileSync(join(DATA, `nch_quality_${CID}.json`)));
const csv = readFileSync(join(DATA, `nch_groups_alltime_${CID}.csv`), 'utf8').replace(/^﻿/, '').trim().split('\n');
const hdr = csv[0].split(';'); const idx = k => hdr.indexOf(k);
const G = {}; let tot = null;
for (const l of csv.slice(1)) { const v = l.split(';'); const o = Object.fromEntries(hdr.map((h, i) => [h, v[i]])); if (o.family === 'ИТОГО') tot = o; else if (o.group_id) G[o.group_id] = o; }
const CR = +tot.leads / +tot.clicks; const CPL = +tot.spend / +tot.leads;
const pos = existsSync(join(DATA, `nch_positions_${CID}.json`)) ? JSON.parse(readFileSync(join(DATA, `nch_positions_${CID}.json`))).rows : [];

const RULES = [['1 Заказ / покупка', /\[(заказ|купить|изготовление|установкой|производителя)\]/], ['2 Цена', /\[цена\]/], ['3 Гео', /\[москв/],
  ['4 Зонирование', /\[зонирования\]/], ['5 Помещение', /\[(кухни|кухней|гостиной|студии|комнату|межкомнатн)/]];
const intentOf = p => { for (const [n, re] of RULES) if (re.test(p)) return n; return (p.match(/\[/g) || []).length <= 2 ? '7 Базовый тип' : '6 Уточнение исполнения'; };
// P(X <= k) при Пуассоне с λ
const pois = (k, lam) => { let s = 0, t = Math.exp(-lam); for (let i = 0; i <= k; i++) { s += t; t *= lam / (i + 1); } return s; };
const Q = {}; for (const r of q.groups) { const a = Q[r.gid] ||= { tvW: 0, tvI: 0, pW: 0, pI: 0, cW: 0, cC: 0 };
  if (r.traffic_volume != null && r.imp) { a.tvW += r.traffic_volume * r.imp; a.tvI += r.imp; }
  if (r.imp_pos != null && r.imp) { a.pW += r.imp_pos * r.imp; a.pI += r.imp; }
  if (r.click_pos != null && r.clicks) { a.cW += r.click_pos * r.clicks; a.cC += r.clicks; } }
const P = {}; for (const r of pos) { const a = P[r.gid] ||= { v: 0, prem: 0, other: 0, pos1: 0, posW: 0, posN: 0, mob: 0 };
  a.v += r.visits; if (r.position_type === 'premium') a.prem += r.visits; else if (r.position_type) a.other += r.visits;
  const n = parseInt(r.position); if (n) { a.posW += n * r.visits; a.posN += r.visits; if (n === 1) a.pos1 += r.visits; }
  if (r.device === 'mobile') a.mob += r.visits; }

const out = [];
for (const g of s.groups) {
  const id = String(g.Id); const o = G[id] || { imp: 0, clicks: 0, spend: 0, leads: 0, visits: 0 };
  const phrase = s.keywords.filter(k => k.AdGroupId === g.Id && k.Keyword !== '---autotargeting').map(k => k.Keyword.split(' -')[0]).join(' / ');
  const clicks = +o.clicks || 0, leads = +o.leads || 0, spend = +o.spend || 0;
  const cat = leads > 0 ? 'A конвертит' : clicks > 0 ? 'B клики без лидов' : 'C нет кликов';
  const p = pois(leads, clicks * CR);
  const qa = Q[id] || {}, pa = P[id] || {};
  out.push({ id, name: g.Name, phrase, intent: intentOf(phrase), cat, imp: +o.imp || 0, clicks, spend: Math.round(spend), visits: +o.visits || 0, leads,
    expected: +(clicks * CR).toFixed(2), p_chance: +p.toFixed(2),
    enough: cat === 'C нет кликов' ? 'нет данных' : (p < 0.1 ? (leads ? 'хватает: хуже средней' : 'хватает: не конвертит') : (clicks * CR >= 1 ? 'в пределах случайности' : 'мало данных')),
    tv: qa.tvI ? Math.round(qa.tvW / qa.tvI) : '', imp_pos: qa.pI ? +(qa.pW / qa.pI).toFixed(1) : '', click_pos: qa.cC ? +(qa.cW / qa.cC).toFixed(1) : '',
    utm_visits: pa.v || 0, utm_premium: pa.v ? Math.round(pa.prem / pa.v * 100) : '', utm_pos_avg: pa.posN ? +(pa.posW / pa.posN).toFixed(1) : '',
    utm_pos1: pa.posN ? Math.round(pa.pos1 / pa.posN * 100) : '', utm_mobile: pa.v ? Math.round(pa.mob / pa.v * 100) : '' });
}
const keys = Object.keys(out[0]);
writeFileSync(join(DATA, `nch_categories_${CID}.csv`), '﻿' + [keys.join(';'), ...out.sort((a, b) => a.cat.localeCompare(b.cat) || b.spend - a.spend).map(r => keys.map(k => r[k]).join(';'))].join('\n') + '\n');
// Свод: интент × категория
const S = {}; for (const r of out) { const k = r.intent; const a = S[k] ||= {}; const c = a[r.cat] ||= { n: 0, imp: 0, clicks: 0, spend: 0, leads: 0 }; c.n++; c.imp += r.imp; c.clicks += r.clicks; c.spend += r.spend; c.leads += r.leads; }
console.log(`CR кампании ${(CR * 100).toFixed(2)}%, CPL ${Math.round(CPL)}`);
for (const [k, a] of Object.entries(S).sort()) { const t = Object.values(a).reduce((s, c) => ({ n: s.n + c.n, clicks: s.clicks + c.clicks, leads: s.leads + c.leads, spend: s.spend + c.spend }), { n: 0, clicks: 0, leads: 0, spend: 0 });
  console.log(`${k} | групп ${t.n} | клики ${t.clicks} лиды ${t.leads} ожид ${(t.clicks * CR).toFixed(1)} P ${pois(t.leads, t.clicks * CR).toFixed(2)} | ` +
    Object.entries(a).sort().map(([c, x]) => `${c[0]}:${x.n}гр/${x.clicks}кл/${x.leads}л/${x.spend}₽`).join('  ')); }
const C = {}; for (const r of out) { const c = C[r.cat] ||= { n: 0, imp: 0, clicks: 0, spend: 0, leads: 0, tvW: 0, tvN: 0 }; c.n++; c.imp += r.imp; c.clicks += r.clicks; c.spend += r.spend; c.leads += r.leads; if (r.tv !== '') { c.tvW += r.tv * (r.imp || 1); c.tvN += (r.imp || 1); } }
for (const [k, c] of Object.entries(C).sort()) console.log(k, JSON.stringify({ ...c, tv: c.tvN ? Math.round(c.tvW / c.tvN) : null }));
console.log('B по достаточности:', JSON.stringify(out.filter(r => r.cat[0] === 'B').reduce((a, r) => (a[r.enough] = (a[r.enough] || 0) + 1, a), {})));
