#!/usr/bin/env node
// nch-query-overlap.mjs - пересечение поисковых запросов групп A (конвертят) и B (клики без лидов) в НЧ.
// Сравнение: 1) дословно, 2) по «смыслу» (стемы 5 букв, без стоп-слов, без порядка), 3) по интенту внутри запроса.
// Вход: nch_quality_<CID>.json (запросы), nch_categories_<CID>.csv (категории). Выход: nch_query_overlap_<CID>.csv
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const CID = process.env.CAMPAIGN_ID || '712877525';
const q = JSON.parse(readFileSync(join(DATA, `nch_quality_${CID}.json`)));
const L = readFileSync(join(DATA, `nch_categories_${CID}.csv`), 'utf8').replace(/^﻿/, '').trim().split('\n');
const H = L[0].split(';'); const cat = {}, gname = {};
for (const l of L.slice(1)) { const o = Object.fromEntries(l.split(';').map((v, i) => [H[i], v])); cat[o.id] = o.cat[0]; gname[o.id] = o.name; }

const STOP = new Set(['для', 'в', 'на', 'с', 'и', 'из', 'по', 'под', 'от', 'до', 'к', 'о', 'а', 'же', 'ли', 'или', 'между', 'без', 'со']);
const stem = w => w.length > 5 ? w.slice(0, 5) : w;
const norm = s => [...new Set(s.toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я0-9]+/).filter(w => w && !STOP.has(w)).map(stem))].sort().join(' ');
const INT = [
  ['заказ/покупка', /заказ|купит|куплю|изготов|производ|установ|монтаж|под ключ|по размер|индивидуал/],
  ['цена', /цен|стоим|сколько|недорог|дешев|прайс|калькул/],
  ['гео', /москв|мо\b|подмоск|балаших|мытищ|химк|люберц|одинцов|красногорск|подольск|королев|питер|спб|санкт/],
  ['зонирование', /зонир/],
  ['помещение', /кухн|гостин|студи|(?<!меж)комнат|спальн|гардероб|балкон|ванн|прихож|квартир|\bдом\b|\bдома\b|дач|коттедж/],
  ['офис/коммерция', /офис|магазин|кафе|ресторан|салон|\bсклад(а|ов|е)?\b|торгов/],
  ['инфо/идеи', /фото|идеи|как |своими|сделать|варианты|дизайн интерьер|пример|видео|чертеж|схем/],
  ['не наш продукт', /гипсокартон|гкл|кирпич|пеноблок|шторы|ширм|ткан|дерев|мдф|лдсп|пластик|жалюзи|душев|стеллаж|шкаф/],
];
const intents = s => { const t = s.toLowerCase(); const r = INT.filter(([, re]) => re.test(t)).map(([n]) => n); return r.length ? r : ['чистый продукт']; };

const rows = q.queries.filter(r => r.clicks > 0).map(r => ({ ...r, cat: cat[r.gid] || '?', norm: norm(r.query), intents: intents(r.query) }));
const byCat = c => rows.filter(r => r.cat === c);
const A = byCat('A'), B = byCat('B');
const sum = (rs, k) => rs.reduce((s, r) => s + r[k], 0);
console.log(`запросов с кликами: A ${A.length} (${sum(A, 'clicks')} кл, ${Math.round(sum(A, 'spend'))} ₽), B ${B.length} (${sum(B, 'clicks')} кл, ${Math.round(sum(B, 'spend'))} ₽)`);

// 1-2. Дословно и по смыслу
const exA = new Set(A.map(r => r.query.toLowerCase())), nA = new Set(A.map(r => r.norm));
const exB = B.filter(r => exA.has(r.query.toLowerCase())), smB = B.filter(r => nA.has(r.norm));
console.log(`B дословно как в A: ${exB.length} запросов, ${sum(exB, 'clicks')} кл, ${Math.round(sum(exB, 'spend'))} ₽`);
console.log(`B по смыслу как в A: ${smB.length} запросов, ${sum(smB, 'clicks')} кл, ${Math.round(sum(smB, 'spend'))} ₽ (${Math.round(sum(smB, 'clicks') / sum(B, 'clicks') * 100)}% кликов B)`);

// 3. Интенты внутри запросов
const dist = rs => { const o = {}; const t = sum(rs, 'clicks'); for (const r of rs) for (const i of r.intents) { const a = o[i] ||= { q: 0, c: 0, s: 0 }; a.q++; a.c += r.clicks; a.s += r.spend; } return { o, t }; };
const dA = dist(A), dB = dist(B);
const names = [...new Set([...Object.keys(dA.o), ...Object.keys(dB.o)])];
console.log('\nинтент запроса | A: кликов (доля) | B: кликов (доля) | B расход');
const out = ['intent;a_queries;a_clicks;a_share;b_queries;b_clicks;b_share;b_spend'];
for (const n of names.sort((x, y) => ((dB.o[y]?.c || 0) + (dA.o[y]?.c || 0)) - ((dB.o[x]?.c || 0) + (dA.o[x]?.c || 0)))) {
  const a = dA.o[n] || { q: 0, c: 0, s: 0 }, b = dB.o[n] || { q: 0, c: 0, s: 0 };
  console.log(`${n} | ${a.c} (${Math.round(a.c / dA.t * 100)}%) | ${b.c} (${Math.round(b.c / dB.t * 100)}%) | ${Math.round(b.s)}`);
  out.push([n, a.q, a.c, (a.c / dA.t * 100).toFixed(1), b.q, b.c, (b.c / dB.t * 100).toFixed(1), Math.round(b.s)].join(';'));
}
// Пересекающиеся по смыслу: где один и тот же смысл живёт в A и в B
const S = {}; for (const r of [...A, ...B]) { const a = S[r.norm] ||= { A: { c: 0, s: 0, g: new Set(), ex: r.query }, B: { c: 0, s: 0, g: new Set(), ex: '' } }; const x = a[r.cat]; x.c += r.clicks; x.s += r.spend; x.g.add(gname[r.gid]); if (r.cat === 'B' && !x.ex) x.ex = r.query; }
const both = Object.entries(S).filter(([, v]) => v.A.c && v.B.c).sort((x, y) => (y[1].A.c + y[1].B.c) - (x[1].A.c + x[1].B.c));
console.log(`\nсмыслов, которые есть и в A, и в B: ${both.length}`);
for (const [k, v] of both.slice(0, 25)) console.log(`«${v.A.ex}» | A ${v.A.c} кл в ${[...v.A.g].join(', ')} | B ${v.B.c} кл / ${Math.round(v.B.s)} ₽ в ${[...v.B.g].join(', ')}`);
out.push('', 'norm;example;a_clicks;a_groups;b_clicks;b_spend;b_groups');
for (const [k, v] of both) out.push([k, v.A.ex, v.A.c, [...v.A.g].join(' / '), v.B.c, Math.round(v.B.s), [...v.B.g].join(' / ')].join(';'));
// B-запросы, чей продукт/интент не пересекается с A вообще
const onlyB = B.filter(r => !nA.has(r.norm));
const dOB = dist(onlyB);
console.log(`\nB без пересечения с A: ${onlyB.length} запросов, ${sum(onlyB, 'clicks')} кл, ${Math.round(sum(onlyB, 'spend'))} ₽; интенты: ` + Object.entries(dOB.o).sort((x, y) => y[1].c - x[1].c).map(([n, a]) => `${n} ${a.c}`).join(', '));
writeFileSync(join(DATA, `nch_query_overlap_${CID}.csv`), '﻿' + out.join('\n') + '\n');
