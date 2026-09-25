#!/usr/bin/env node
// nch-intents.mjs - группы НЧ по интентам (по фразе группы из API) и воронка за всё время:
// показы → клики → расход → визиты → лиды (Метрика, цель CRM «Все лиды») → CPL.
// Вход: data/nch_history_<CID>.json + data/nch_structure_<CID>.json. Выход: data/nch_intents_<CID>.csv
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const CID = process.env.CAMPAIGN_ID || '712877525';
const h = JSON.parse(readFileSync(join(DATA, `nch_history_${CID}.json`)));
const s = JSON.parse(readFileSync(join(DATA, `nch_structure_${CID}.json`)));

// Интент по фразе группы; порядок = приоритет
const RULES = [
  ['1 Заказ / покупка', /\[(заказ|купить|изготовление|установкой|производителя)\]/],
  ['2 Цена', /\[цена\]/],
  ['3 Гео (Москва)', /\[москв/],
  ['4 Зонирование', /\[зонирования\]/],
  ['5 Помещение', /\[(кухни|кухней|гостиной|студии|комнату|межкомнатн)/],
];
const intentOf = phrase => {
  for (const [name, re] of RULES) if (re.test(phrase)) return name;
  return (phrase.match(/\[/g) || []).length <= 2 ? '7 Базовый тип' : '6 Уточнение исполнения';
};
const groups = s.groups.map(g => {
  const phrases = s.keywords.filter(k => k.AdGroupId === g.Id && k.Keyword !== '---autotargeting');
  const phrase = phrases.map(k => k.Keyword.split(' -')[0]).join(' / ');
  return { id: String(g.Id), name: g.Name, phrase, intent: intentOf(phrase) };
});
const byId = Object.fromEntries(groups.map(g => [g.id, g]));
const z = () => ({ imp: 0, clicks: 0, spend: 0, at: 0, visits: 0, leads: 0, contacts: 0, n: 0, active: 0 });
const G = Object.fromEntries(groups.map(g => [g.id, z()]));
for (const r of h.direct) { const a = G[r.gid]; if (!a) continue; a.imp += r.imp; a.clicks += r.clicks; a.spend += r.spend; if (r.crit_type === 'AUTOTARGETING') a.at += r.spend; }
for (const r of h.metrika) { const a = G[r.gid]; if (!a) continue; a.visits += r.visits; a.leads += r.leads; a.contacts += r.contacts; }
const I = {};
for (const g of groups) { const a = I[g.intent] ||= z(); const x = G[g.id]; for (const k of ['imp', 'clicks', 'spend', 'at', 'visits', 'leads', 'contacts']) a[k] += x[k]; a.n++; if (x.imp) a.active++; }
const T = Object.values(I).reduce((t, a) => { for (const k in a) t[k] += a[k]; return t; }, z());
const row = a => ({ imp: a.imp, clicks: a.clicks, ctr: a.imp ? +(a.clicks / a.imp * 100).toFixed(1) : 0, cpc: a.clicks ? Math.round(a.spend / a.clicks) : 0,
  spend: Math.round(a.spend), at_share: a.spend ? Math.round(a.at / a.spend * 100) : 0, visits: a.visits, leads: a.leads,
  cr: a.clicks ? +(a.leads / a.clicks * 100).toFixed(1) : 0, cpl: a.leads ? Math.round(a.spend / a.leads) : null });
const lines = ['level;intent;group_id;group;phrase;groups;active;imp;clicks;ctr;cpc;spend;spend_share;at_share;visits;leads;cr;cpl'];
for (const [k, a] of Object.entries(I).sort()) { const r = row(a); lines.push(['intent', k, '', '', '', a.n, a.active, r.imp, r.clicks, r.ctr, r.cpc, r.spend, Math.round(a.spend / T.spend * 100), r.at_share, r.visits, r.leads, r.cr, r.cpl ?? ''].join(';')); }
{ const r = row(T); lines.push(['total', 'ИТОГО', '', '', '', T.n, T.active, r.imp, r.clicks, r.ctr, r.cpc, r.spend, 100, r.at_share, r.visits, r.leads, r.cr, r.cpl ?? ''].join(';')); }
for (const g of groups.sort((a, b) => a.intent.localeCompare(b.intent) || G[b.id].spend - G[a.id].spend)) { const r = row(G[g.id]); lines.push(['group', g.intent, g.id, g.name, g.phrase, 1, G[g.id].imp ? 1 : 0, r.imp, r.clicks, r.ctr, r.cpc, r.spend, +(G[g.id].spend / T.spend * 100).toFixed(1), r.at_share, r.visits, r.leads, r.cr, r.cpl ?? ''].join(';')); }
const unattributed = h.metrika.filter(r => !byId[r.gid]).reduce((s, r) => s + r.leads, 0);
writeFileSync(join(DATA, `nch_intents_${CID}.csv`), '﻿' + lines.join('\n') + '\n');
console.log(lines.filter(l => !l.startsWith('group;')).join('\n'));
console.log(`лидов Метрики без группы: ${unattributed}; период ${h.dateFrom}..${h.dateTo}`);
