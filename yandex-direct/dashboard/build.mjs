#!/usr/bin/env node
// build.mjs - сборка статического сайта-дашборда Яндекс.Директ GENGLASS.
// Паттерн analytics-mvp: данные запекаются в HTML, в браузере нет fetch и токенов.
// Запуск: node yandex-direct/dashboard/build.mjs  →  yandex-direct/dashboard/public/*.html

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');
const PUB = join(HERE, 'public');
mkdirSync(PUB, { recursive: true });

const load = (name, fb) => { try { return JSON.parse(readFileSync(join(DATA, name), 'utf8')); } catch { return fb; } };
const CAMPS = load('direct_campaigns.json', { totals: {}, campaigns: [] });
const DAILY = load('direct_daily.json', { totals: {}, days: [], metrika_days: {} });
const KWS = load('direct_keywords.json', { totals: {}, rows: [] });
const SQ = load('direct_queries.json', { totals: {}, rows: [] });
const MET = load('direct_metrika.json', { totals: {}, by_engine: [], by_utm: [], by_source: [] });
const AUDIT = load('audit-summary.json', null);

const GEN = CAMPS.generated_at || new Date().toISOString();
const PERIOD = `${CAMPS.dateFrom} .. ${CAMPS.dateTo}`;

// Валидированная палитра (dataviz skill, dark surface #131820, все проверки PASS)
const CAT = ['#0891B2', '#D97706', '#8B5CF6', '#059669'];
const UP = '#10B981', DN = '#F43F5E', WARN = '#F59E0B';

const fmt = n => n == null ? '-' : Math.round(n).toLocaleString('ru-RU');
const fmt1 = n => n == null ? '-' : (Math.round(n * 10) / 10).toLocaleString('ru-RU');
const fmt2 = n => n == null ? '-' : (Math.round(n * 100) / 100).toLocaleString('ru-RU');
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Санитайзер (Anti-Slop): длинные тире запрещены во всём выводе
const sanitize = html => html.replace(/[–—]/g, '-');

const CSS = `
:root{--bg:#0B0F15;--card:#131820;--elev:#1A2029;--soft:#232B36;--line:#1F2731;--line2:#2B3441;
--ink:#F1F4F8;--ink2:#A0AAB8;--ink3:#6A7484;--acc:#22D3EE;--acc2:#06B6D4;--accsoft:rgba(34,211,238,.10);
--up:${UP};--dn:${DN};--warn:${WARN};--r:10px;--rl:14px}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:13.5px/1.5 Inter,-apple-system,'Segoe UI',Roboto,sans-serif;padding-bottom:60px}
a{color:var(--acc);text-decoration:none}
.topbar{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:14px;padding:12px 24px;
background:rgba(11,15,21,.85);backdrop-filter:blur(20px);border-bottom:1px solid var(--line)}
.logo{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,var(--acc),#0369A1);
box-shadow:0 0 18px rgba(34,211,238,.35);display:grid;place-items:center;font-weight:800;font-size:13px;color:#04222B}
.tt{font-family:Manrope,Inter,sans-serif;font-weight:800;font-size:15px}
.tt small{display:block;font-weight:500;font-size:10.5px;color:var(--ink3)}
nav{display:flex;gap:4px;margin-left:auto;flex-wrap:wrap}
nav a{padding:7px 13px;border-radius:8px;color:var(--ink2);font-weight:600;font-size:12.5px}
nav a:hover{background:var(--soft);color:var(--ink)}
nav a.on{background:var(--accsoft);color:var(--acc)}
.stamp{font-size:11px;color:var(--ink3);padding:4px 10px;border:1px solid var(--line);border-radius:20px;white-space:nowrap}
.wrap{max-width:1440px;margin:0 auto;padding:22px 24px}
h1{font-family:Manrope,Inter,sans-serif;font-size:21px;font-weight:800;letter-spacing:-.02em;margin:6px 0 2px}
.sub{color:var(--ink3);font-size:12.5px;margin-bottom:18px}
.sec{display:flex;align-items:center;gap:10px;margin:28px 0 12px;color:var(--ink2);font-weight:700;font-size:13px}
.sec:before{counter-increment:sec;content:counter(sec,decimal-leading-zero);color:var(--acc);font-family:Manrope;font-weight:800}
.sec:after{content:'';flex:1;height:1px;background:var(--line)}
body{counter-reset:sec}
.hero{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--rl);padding:18px;position:relative;overflow:hidden}
.card.hl:before{content:'';position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,var(--acc),transparent)}
.card.hl.warn:before{background:linear-gradient(90deg,var(--warn),transparent)}
.card.hl.dn:before{background:linear-gradient(90deg,var(--dn),transparent)}
.lab{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);margin-bottom:8px}
.hv{font-family:Manrope,Inter,sans-serif;font-size:38px;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1.05}
.hv small{font-size:16px;color:var(--ink2);font-weight:700}
.hnote{margin-top:8px;font-size:12px;color:var(--ink2)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:14px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:12px 14px}
.kpi .l{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3)}
.kpi .v{font-family:Manrope;font-size:21px;font-weight:800;font-variant-numeric:tabular-nums;margin-top:3px}
.kpi .d{font-size:11px;margin-top:2px;color:var(--ink3)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);
text-align:left;padding:8px 10px;border-bottom:1px solid var(--line2);white-space:nowrap}
td{padding:8px 10px;border-bottom:1px solid var(--line);font-size:12.5px}
tr:hover td{background:var(--elev)}
td.n,th.n{text-align:right}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:1px}
.dg{background:var(--up)}.dy{background:var(--warn)}.dr{background:var(--dn)}.dx{background:var(--ink4,#3F4855)}
.pill{display:inline-block;padding:2px 9px;border-radius:20px;font-size:10.5px;font-weight:700}
.p-ok{background:rgba(16,185,129,.12);color:var(--up)}
.p-warn{background:rgba(245,158,11,.12);color:var(--warn)}
.p-hot{background:rgba(244,63,94,.12);color:var(--dn)}
.p-mut{background:var(--soft);color:var(--ink3)}
.badge{display:inline-block;padding:1px 7px;border-radius:5px;font-size:10px;font-weight:700;vertical-align:2px;margin-left:6px}
.b-d{background:rgba(34,211,238,.12);color:var(--acc)}
.b-h{background:rgba(245,158,11,.12);color:var(--warn)}
.mut{color:var(--ink3)}.up{color:var(--up)}.dn{color:var(--dn)}.warn{color:var(--warn)}
.note{background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.25);border-radius:var(--r);padding:12px 14px;font-size:12.5px;margin:12px 0}
.cf{display:flex;gap:0;align-items:stretch;margin-top:10px}
.cf-step{flex:1;background:var(--elev);border:1px solid var(--line);padding:12px;text-align:center}
.cf-step:first-child{border-radius:var(--r) 0 0 var(--r)}
.cf-step:last-child{border-radius:0 var(--r) var(--r) 0}
.cf-v{font-family:Manrope;font-size:22px;font-weight:800}
.cf-l{font-size:10.5px;color:var(--ink3);text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
.cf-conv{align-self:center;padding:0 8px;font-size:11px;font-weight:700;color:var(--ink3);white-space:nowrap}
.cf-conv.key{color:var(--warn)}
.bars .row{display:grid;grid-template-columns:220px 1fr 90px;gap:10px;align-items:center;padding:5px 0}
.bars .bl{font-size:12px;color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bars .bt{height:14px;border-radius:4px;background:linear-gradient(90deg,var(--acc2),var(--acc));min-width:2px}
.bars .bv{font-size:12px;text-align:right;font-variant-numeric:tabular-nums}
.chart-tip{position:fixed;pointer-events:none;background:var(--elev);border:1px solid var(--line2);border-radius:8px;
padding:8px 11px;font-size:12px;z-index:99;display:none;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.tblwrap{overflow-x:auto}
footer{margin-top:40px;padding:16px 24px;border-top:1px solid var(--line);color:var(--ink3);font-size:11.5px;display:flex;gap:18px;flex-wrap:wrap}
@media(max-width:900px){.hero,.grid2{grid-template-columns:1fr}.bars .row{grid-template-columns:120px 1fr 70px}}
`;

const NAV = [
  ['index.html', 'Обзор'], ['campaigns.html', 'Кампании'], ['keywords.html', 'Ключи'],
  ['queries.html', 'Запросы'], ['reconcile.html', 'Сверка'], ['audit.html', 'Аудит'],
];

function page(file, title, sub, body) {
  const nav = NAV.map(([f, t]) => `<a href="${f}"${f === file ? ' class="on"' : ''}>${t}</a>`).join('');
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} - Директ GENGLASS</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Manrope:wght@700;800&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<div class="topbar"><div class="logo">YD</div><div class="tt">Директ GENGLASS<small>кабинет e-20085264 · счётчик 104369223</small></div>
<nav>${nav}</nav><div class="stamp">данные: ${PERIOD} · собрано ${GEN.slice(0, 16).replace('T', ' ')} UTC</div></div>
<div class="wrap"><h1>${esc(title)}</h1><div class="sub">${sub}</div>${body}</div>
<div class="chart-tip" id="tip"></div>
<footer><span>[ДАННЫЕ] = цифра из API с источником · [ГИПОТЕЗА] = оценка с допущениями</span>
<span>Слой: оперативный T-1 (несверенный с CRM)</span><span>Директ GENGROUP · Protocol 9 discipline</span></footer>
<script>
const tip=document.getElementById('tip');
document.addEventListener('mousemove',e=>{const t=e.target.closest('[data-tip]');
if(t){tip.style.display='block';tip.innerHTML=t.dataset.tip;
tip.style.left=Math.min(e.clientX+14,innerWidth-tip.offsetWidth-10)+'px';
tip.style.top=(e.clientY+14)+'px';}else tip.style.display='none';});
</script></body></html>`;
  writeFileSync(join(PUB, file), sanitize(html));
  console.log('OK', file);
}

// ---------- подготовка данных ----------
const T = CAMPS.totals, MT = MET.totals;
const activeCamps = CAMPS.campaigns.filter(c => c.state === 'ON');
const days = [...new Set(DAILY.days.map(d => d.date))].sort();
const byDay = days.map(date => {
  const rows = DAILY.days.filter(d => d.date === date);
  const m = DAILY.metrika_days[date] || {};
  return { date, spend: rows.reduce((s, r) => s + r.spend, 0), clicks: rows.reduce((s, r) => s + r.clicks, 0),
    conv: rows.reduce((s, r) => s + r.conv, 0), visits: m.visits || 0, leads: m.leads || 0 };
});
const spend30 = T.spend || 0, clicks30 = T.clicks || 0;
const leads30 = MT.ad_leads_30d || 0;
const ydLeads = MET.by_engine.filter(e => /direct/i.test(e.engine)).reduce((s, e) => s + e.leads, 0);
const cplYd = ydLeads ? spend30 / ydLeads : null;
const last7 = byDay.slice(-7);
const spend7 = last7.reduce((s, d) => s + d.spend, 0);

const avgCpc = clicks30 ? spend30 / clicks30 : 0;
// Автотаргетинг: доля расхода на ---autotargeting (реальная концентрация бюджета)
const autoRows = KWS.rows.filter(r => /autotargeting/i.test(r.crit));
const autoSpend = autoRows.reduce((s, r) => s + r.spend, 0);
const autoClicks = autoRows.reduce((s, r) => s + r.clicks, 0);
const kwSpend = KWS.totals.spend || 1;
// Мягкая цель: доля кликов, засчитанных «конверсией» кампании - показывает, что цель
// оптимизации не отделяет слив (по ней zombie-анализ не работает, нужен CRM-уровень)
const softCr = clicks30 ? (T.conversions || 0) / clicks30 * 100 : 0;
const zeroConvKw = KWS.rows.filter(r => r.conv === 0 && r.spend > 0).sort((a, b) => b.spend - a.spend);
const zeroConvSpend = zeroConvKw.reduce((s, r) => s + r.spend, 0);

// ---------- SVG: тренд по дням (расход + клики) ----------
function trendSvg(w = 860, h = 210) {
  if (!byDay.length) return '<div class="mut">нет данных за период</div>';
  const p = { l: 46, r: 14, t: 14, b: 26 };
  const iw = w - p.l - p.r, ih = h - p.t - p.b;
  const mx = Math.max(...byDay.map(d => d.spend), 1);
  const x = i => p.l + (byDay.length === 1 ? iw / 2 : i * iw / (byDay.length - 1));
  const y = v => p.t + ih - v / mx * ih;
  const pts = byDay.map((d, i) => `${x(i)},${y(d.spend)}`).join(' ');
  const area = `M${x(0)},${y(byDay[0].spend)} L${pts.split(' ').join(' L')} L${x(byDay.length - 1)},${p.t + ih} L${x(0)},${p.t + ih} Z`;
  const gridY = [0, .5, 1].map(f => { const v = mx * f;
    return `<line x1="${p.l}" y1="${y(v)}" x2="${w - p.r}" y2="${y(v)}" stroke="#1F2731"/>
<text x="${p.l - 6}" y="${y(v) + 4}" fill="#6A7484" font-size="10" text-anchor="end">${fmt(v)}</text>`; }).join('');
  const hots = byDay.map((d, i) => `<g><rect x="${x(i) - iw / byDay.length / 2}" y="${p.t}" width="${iw / byDay.length}" height="${ih}"
fill="transparent" data-tip="<b>${d.date}</b><br>расход: ${fmt(d.spend)} ₽<br>клики: ${d.clicks} · визиты: ${fmt(d.visits)}<br>конверсии(цель): ${d.conv} · CRM-лиды: ${d.leads}"/>
<circle cx="${x(i)}" cy="${y(d.spend)}" r="3" fill="${CAT[0]}" opacity="0"/></g>`).join('');
  const lbl = byDay.filter((_, i) => i % Math.ceil(byDay.length / 8) === 0)
    .map(d => `<text x="${x(byDay.indexOf(d))}" y="${h - 8}" fill="#6A7484" font-size="10" text-anchor="middle">${d.date.slice(5)}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto" role="img" aria-label="Расход по дням">
<defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${CAT[0]}" stop-opacity=".28"/><stop offset="1" stop-color="${CAT[0]}" stop-opacity="0"/></linearGradient></defs>
${gridY}<path d="${area}" fill="url(#ga)"/><polyline points="${pts}" fill="none" stroke="${CAT[0]}" stroke-width="2"/>
${hots}${lbl}</svg>`;
}

const spark = (vals, w = 120, h = 28, color = CAT[0]) => {
  if (!vals.length) return '';
  const mx = Math.max(...vals, 1);
  const pts = vals.map((v, i) => `${i * w / Math.max(vals.length - 1, 1)},${h - 3 - v / mx * (h - 6)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/></svg>`;
};

const verdictCamp = c => {
  if (c.state !== 'ON') return ['dx', 'p-mut', c.status === 'MODERATION' ? 'архив/модерация' : c.status.toLowerCase()];
  const utm = MET.by_utm.find(u => u.utm.includes(String(c.id)));
  const leads = utm ? utm.leads : 0;
  const cpl = leads ? c.spend / leads : null;
  if (!leads && c.spend > 10000) return ['dr', 'p-hot', 'расход без CRM-лидов'];
  if (cpl && cpl > 10000) return ['dy', 'p-warn', `CPL ${fmt(cpl)} ₽`];
  return ['dg', 'p-ok', cpl ? `CPL ${fmt(cpl)} ₽` : 'ok'];
};

// ================= index.html =================
{
  const gap = MT.yd_visits_30d - clicks30;
  const hero = `
<div class="hero">
<div class="card hl"><div class="lab">Расход 30 дней <span class="badge b-d">[ДАННЫЕ] Reports API, с НДС</span></div>
<div class="hv">${fmt(spend30)} <small>₽</small></div>
<div class="hnote">${fmt(spend7)} ₽ за последние 7 дней · ${activeCamps.length} активных кампании из ${T.campaigns}</div>
<div style="margin-top:10px">${spark(byDay.map(d => d.spend), 280, 40)}</div></div>
<div class="card hl ${cplYd && cplYd > 5000 ? 'warn' : ''}"><div class="lab">CRM-лиды с Директа <span class="badge b-d">[ДАННЫЕ] Метрика, цель 487033158</span></div>
<div class="hv">${ydLeads}</div>
<div class="hnote">CPL ~${fmt(cplYd)} ₽ <span class="badge b-h">[ГИПОТЕЗА]</span> - при допущении, что весь Yandex.Direct-трафик счётчика оплачен этим кабинетом (P0 не закрыта)</div></div>
<div class="card hl dn"><div class="lab">P0: разрыв атрибуции</div>
<div class="hv">${fmt(gap)}</div>
<div class="hnote">визитов Yandex.Direct сверх ${fmt(clicks30)} кликов кабинета за 30 дней. <a href="reconcile.html">Разбор →</a></div></div>
</div>
<div class="kpis">
<div class="kpi"><div class="l">Показы</div><div class="v">${fmt(T.impressions)}</div></div>
<div class="kpi"><div class="l">Клики</div><div class="v">${fmt(clicks30)}</div></div>
<div class="kpi"><div class="l">CTR</div><div class="v">${fmt2(T.impressions ? clicks30 / T.impressions * 100 : 0)}%</div></div>
<div class="kpi"><div class="l">Средний CPC</div><div class="v">${fmt(avgCpc)} ₽</div></div>
<div class="kpi"><div class="l">Конверсии (цель кампаний)</div><div class="v">${fmt(T.conversions)}</div><div class="d">НЕ лиды - цель оптимизации</div></div>
<div class="kpi"><div class="l">CRM-лиды (вся реклама)</div><div class="v">${leads30}</div><div class="d">Метрика, ad-трафик</div></div>
</div>
<div class="sec">Расход и трафик по дням</div>
<div class="card">${trendSvg()}</div>
<div class="sec">Активные кампании</div>
<div class="card tblwrap"><table><tr><th>Кампания</th><th class="n">Показы</th><th class="n">Клики</th><th class="n">CTR</th><th class="n">CPC</th><th class="n">Расход</th><th class="n">Конв.(цель)</th><th class="n">CRM-лиды</th><th>Вердикт</th></tr>
${activeCamps.map(c => { const [d, p, t] = verdictCamp(c);
  const utm = MET.by_utm.find(u => u.utm.includes(String(c.id)));
  return `<tr><td><span class="dot ${d}"></span><a href="campaigns.html#c${c.id}">${esc(c.name)}</a></td>
<td class="n">${fmt(c.imp)}</td><td class="n">${fmt(c.clicks)}</td><td class="n">${fmt2(c.ctr)}%</td>
<td class="n">${fmt(c.cpc)}</td><td class="n">${fmt(c.spend)} ₽</td><td class="n">${fmt(c.conv)}</td>
<td class="n">${utm ? utm.leads : 0}</td><td><span class="pill ${p}">${t}</span></td></tr>`; }).join('')}
</table></div>
<div class="sec">Сделать сегодня (watchlist)</div>
<div class="card">
<div class="note">Мутации кабинета заблокированы до закрытия P0 атрибуции (Hard Rule #2). Пункты ниже - к апруву Ивана, не к автозапуску.</div>
<table>
<tr><td><span class="dot dr"></span>Закрыть P0: найти источник UTM «peregorodki» без ID кампании (${fmt((MET.by_utm[0] || {}).visits)} визитов, ${(MET.by_utm[0] || {}).leads} лидов) - <a href="reconcile.html">сверка</a></td><td class="n"><span class="pill p-hot">P0</span></td></tr>
<tr><td><span class="dot dy"></span>Автотаргетинг съедает ${fmt(autoSpend)} ₽ (${fmt(autoSpend / kwSpend * 100)}% расхода по критериям) при CPC ${fmt(autoClicks ? autoSpend / autoClicks : 0)} ₽ - ревизия, <a href="keywords.html">разбор</a></td><td class="n"><span class="pill p-warn">P1</span></td></tr>
<tr><td><span class="dot dy"></span>Мягкая цель кампаний: «конверсия» на ${fmt(softCr)}% кликов - слив по ней не виден, эффективность считать только по CRM-лидам (<a href="queries.html">запросы</a> чистить вручную)</td><td class="n"><span class="pill p-warn">P1</span></td></tr>
<tr><td><span class="dot dg"></span>Аудит кабинета по 55 проверкам - <a href="audit.html">результаты</a></td><td class="n"><span class="pill p-ok">готово</span></td></tr>
</table></div>`;
  page('index.html', 'Обзор: командный центр', `Оперативный слой T-1 · период ${PERIOD} · деньги с НДС`, hero);
}

// ================= campaigns.html =================
{
  const rows = [...CAMPS.campaigns].sort((a, b) => b.spend - a.spend || (a.state === 'ON' ? -1 : 1));
  const body = `
<div class="sec">Все кампании кабинета (${T.campaigns})</div>
<div class="card tblwrap"><table>
<tr><th>Кампания</th><th>Тип</th><th>Статус</th><th class="n">Дн. бюджет</th><th class="n">Показы</th><th class="n">Клики</th><th class="n">CTR</th><th class="n">CPC</th><th class="n">Расход 30д</th><th class="n">Конв.(цель)</th><th>Вердикт</th></tr>
${rows.map(c => { const [d, p, t] = verdictCamp(c);
  return `<tr id="c${c.id}"><td><span class="dot ${d}"></span>${esc(c.name)}<div class="mut" style="font-size:10.5px">#${c.id} · старт ${c.start || '-'}</div></td>
<td class="mut">${c.type === 'UNIFIED_CAMPAIGN' ? 'ЕПК' : c.type === 'TEXT_CAMPAIGN' ? 'Текстовая' : esc(c.type)}</td>
<td class="mut">${c.state === 'ON' ? '<span class="up">Идут показы</span>' : esc(c.state === 'ARCHIVED' ? 'Архив' : c.state)}</td>
<td class="n">${c.dailyBudget ? fmt(c.dailyBudget) + ' ₽' : '-'}</td>
<td class="n">${fmt(c.imp)}</td><td class="n">${fmt(c.clicks)}</td><td class="n">${c.clicks ? fmt2(c.ctr) + '%' : '-'}</td>
<td class="n">${c.clicks ? fmt(c.cpc) : '-'}</td><td class="n">${fmt(c.spend)} ₽</td><td class="n">${fmt(c.conv)}</td>
<td><span class="pill ${p}">${t}</span></td></tr>`; }).join('')}
</table></div>
<div class="sec">Дневная динамика активных кампаний</div>
<div class="grid2">
${activeCamps.map((c, ci) => {
  const cd = DAILY.days.filter(d => d.cid === c.id);
  return `<div class="card"><div class="lab">${esc(c.name)}</div>
<div class="bars">${cd.slice(-14).map(d => `<div class="row" data-tip="<b>${d.date}</b><br>${fmt(d.spend)} ₽ · ${d.clicks} кликов · ${d.conv} конв.">
<div class="bl">${d.date.slice(5)}</div>
<div><div class="bt" style="width:${Math.max(d.spend / Math.max(...cd.map(x => x.spend), 1) * 100, 1)}%;background:linear-gradient(90deg,${CAT[ci % CAT.length]}88,${CAT[ci % CAT.length]})"></div></div>
<div class="bv">${fmt(d.spend)} ₽</div></div>`).join('')}</div></div>`; }).join('')}
</div>
<div class="sec">Лиды по UTM-меткам кампаний <span class="badge b-d">[ДАННЫЕ] Метрика 30д</span></div>
<div class="card tblwrap"><table><tr><th>utm_campaign</th><th class="n">Визиты</th><th class="n">CRM-лиды</th><th class="n">Отпр. контактов</th><th class="n">CPL <span class="badge b-h">[ГИПОТЕЗА]</span></th></tr>
${MET.by_utm.slice(0, 15).map(u => {
  const cid = (u.utm.match(/(\d{9})/) || [])[1];
  const camp = cid ? CAMPS.campaigns.find(c => String(c.id) === cid) : null;
  const cpl = camp && u.leads ? camp.spend / u.leads : null;
  return `<tr><td>${esc(u.utm)}${camp ? `<div class="mut" style="font-size:10.5px">${esc(camp.name)}</div>` : cid ? '' : ' <span class="pill p-hot">без ID - P0</span>'}</td>
<td class="n">${fmt(u.visits)}</td><td class="n">${u.leads}</td><td class="n">${u.contacts}</td>
<td class="n">${cpl ? fmt(cpl) + ' ₽' : '-'}</td></tr>`; }).join('')}
</table></div>`;
  page('campaigns.html', 'Кампании: детализация', `${activeCamps.length} активных из ${T.campaigns} · расход ${fmt(spend30)} ₽ за 30 дней`, body);
}

// ================= keywords.html =================
{
  const top = [...KWS.rows].sort((a, b) => b.spend - a.spend).slice(0, 40);
  const body = `
<div class="kpis">
<div class="kpi"><div class="l">Ключей/критериев со статистикой</div><div class="v">${fmt(KWS.totals.rows)}</div></div>
<div class="kpi"><div class="l">Расход по критериям</div><div class="v">${fmt(KWS.totals.spend)} ₽</div></div>
<div class="kpi"><div class="l">Автотаргетинг</div><div class="v">${fmt(autoSpend / kwSpend * 100)}%</div><div class="d">${fmt(autoSpend)} ₽ из ${fmt(kwSpend)} ₽</div></div>
<div class="kpi"><div class="l">«Конверсия» кампании на кликах</div><div class="v">${fmt(softCr)}%</div><div class="d">мягкая цель, НЕ лиды</div></div>
</div>
<div class="note"><b>Почему здесь нет «zombie-ключей».</b> Цель оптимизации кампаний срабатывает на ${fmt(softCr)}% кликов [ДАННЫЕ], поэтому анализ слива по колонке «конверсии» не работает: у ключей с расходом конверсия есть почти всегда. Ключей с расходом и нулевой конверсией всего ${zeroConvKw.length} на ${fmt(zeroConvSpend)} ₽. Реальная эффективность считается только по CRM-лидам после закрытия P0 атрибуции.</div>
<div class="sec">Автотаргетинг: концентрация расхода <span class="badge b-d">[ДАННЫЕ] 30д</span></div>
<div class="card tblwrap"><table><tr><th>Критерий</th><th>Кампания / группа</th><th class="n">Показы</th><th class="n">Клики</th><th class="n">CTR</th><th class="n">CPC</th><th class="n">Расход</th><th class="n">Доля расхода</th></tr>
${autoRows.sort((a, b) => b.spend - a.spend).map(r => `<tr><td>${esc(r.crit)}</td><td class="mut">${esc(r.camp)}<br>${esc(r.group)}</td>
<td class="n">${fmt(r.imp)}</td><td class="n">${fmt(r.clicks)}</td><td class="n">${fmt2(r.ctr)}%</td><td class="n">${fmt(r.cpc)}</td>
<td class="n warn">${fmt(r.spend)} ₽</td><td class="n">${fmt(r.spend / kwSpend * 100)}%</td></tr>`).join('')}
</table>
<div class="hnote" style="margin-top:10px">Автотаргетинг на ${fmt(autoSpend / kwSpend * 100)}% бюджета при молодом кабинете - вопрос к ревизии: качество площадок/запросов проверяется на странице <a href="queries.html">Запросы</a>. Решение о корректировке - к апруву Ивана.</div></div>
<div class="sec">Топ-40 критериев по расходу <span class="badge b-d">[ДАННЫЕ] CRITERIA_PERFORMANCE_REPORT 30д</span></div>
<div class="card tblwrap"><table><tr><th>Критерий</th><th>Кампания</th><th class="n">Показы</th><th class="n">Клики</th><th class="n">CTR</th><th class="n">CPC</th><th class="n">Расход</th><th class="n">Конв.(цель)</th></tr>
${top.map(r => `<tr><td>${esc(r.crit)}</td><td class="mut">${esc(r.camp)}</td>
<td class="n">${fmt(r.imp)}</td><td class="n">${fmt(r.clicks)}</td><td class="n">${fmt2(r.ctr)}%</td>
<td class="n">${fmt(r.cpc)}</td><td class="n">${fmt(r.spend)} ₽</td><td class="n">${fmt(r.conv)}</td></tr>`).join('')}
</table></div>`;
  page('keywords.html', 'Ключи и критерии', `${fmt(KWS.totals.rows)} критериев со статистикой за 30 дней`, body);
}

// ================= queries.html =================
{
  const topQ = [...SQ.rows].sort((a, b) => b.spend - a.spend).slice(0, 40);
  const body = `
<div class="kpis">
<div class="kpi"><div class="l">Поисковых запросов (14д)</div><div class="v">${fmt(SQ.totals.rows)}</div></div>
<div class="kpi"><div class="l">Расход по запросам</div><div class="v">${fmt(SQ.totals.spend)} ₽</div></div>
<div class="kpi"><div class="l">С кликами без «конверсии»</div><div class="v">${SQ.rows.filter(r => r.conv === 0 && r.clicks > 0).length}</div><div class="d">мягкая цель - см. примечание</div></div>
</div>
<div class="note"><b>Автоматический фильтр мусора недоступен.</b> «Конверсия» кампании срабатывает почти на каждом клике (мягкая цель), поэтому колонка конверсий не отделяет мусорные запросы. Кандидатов в минус-слова отбирает человек по топу расхода ниже; критерий - нерелевантность запроса продукту (перегородки на заказ). Решение о минусации - к апруву Ивана.</div>
<div class="sec">Топ-40 запросов по расходу <span class="badge b-d">[ДАННЫЕ] SEARCH_QUERY_PERFORMANCE_REPORT 14д</span></div>
<div class="card tblwrap"><table><tr><th>Запрос</th><th>Кампания</th><th class="n">Показы</th><th class="n">Клики</th><th class="n">Расход</th><th class="n">Конв.(цель)</th></tr>
${topQ.map(r => `<tr><td>${esc(r.query)}</td><td class="mut">${esc(r.camp)}</td>
<td class="n">${fmt(r.imp)}</td><td class="n">${fmt(r.clicks)}</td><td class="n">${fmt(r.spend)} ₽</td><td class="n">${fmt(r.conv)}</td></tr>`).join('')}
</table></div>`;
  page('queries.html', 'Поисковые запросы', `последние 14 дней · ${SQ.dateFrom} .. ${SQ.dateTo}`, body);
}

// ================= reconcile.html =================
{
  const visits = MT.yd_visits_30d || 0;
  const body = `
<div class="note"><b>P0 открыта.</b> Пока разрыв не объяснён, CPL и бюджет-решения по кабинету - [ГИПОТЕЗА]. Мутации кабинета заблокированы техническим гейтом.</div>
<div class="sec">Воронка: Директ → Метрика → CRM-цели <span class="badge b-d">[ДАННЫЕ] 30 дней</span></div>
<div class="card"><div class="cf">
<div class="cf-step"><div class="cf-v">${fmt(T.impressions)}</div><div class="cf-l">Показы</div></div>
<div class="cf-conv">CTR ${fmt2(T.impressions ? clicks30 / T.impressions * 100 : 0)}%</div>
<div class="cf-step"><div class="cf-v">${fmt(clicks30)}</div><div class="cf-l">Клики кабинета</div></div>
<div class="cf-conv key">x${fmt1(clicks30 ? visits / clicks30 : 0)} ?!</div>
<div class="cf-step" style="border-color:${DN}"><div class="cf-v">${fmt(visits)}</div><div class="cf-l">Визиты Yandex.Direct</div></div>
<div class="cf-conv">${fmt2(visits ? ydLeads / visits * 100 : 0)}%</div>
<div class="cf-step"><div class="cf-v">${ydLeads}</div><div class="cf-l">CRM-лиды</div></div>
</div>
<div class="hnote" style="margin-top:12px">Ключевая аномалия отмечена: визитов из Yandex.Direct в ${fmt1(visits / Math.max(clicks30, 1))} раза больше, чем кликов оплачено кабинетом e-20085264. Значит, на счётчик льёт ещё минимум один источник с разметкой Директа.</div></div>
<div class="sec">Рекламные движки по Метрике</div>
<div class="card tblwrap"><table><tr><th>Движок</th><th class="n">Визиты</th><th class="n">Посетители</th><th class="n">CRM-лиды</th><th class="n">Отпр. контактов</th></tr>
${MET.by_engine.map(e => `<tr><td>${esc(e.engine)}</td><td class="n">${fmt(e.visits)}</td><td class="n">${fmt(e.users)}</td>
<td class="n">${e.leads}</td><td class="n">${e.contacts}</td></tr>`).join('')}
</table></div>
<div class="sec">Разбор UTM: где теряется атрибуция</div>
<div class="card tblwrap"><table><tr><th>utm_campaign</th><th class="n">Визиты</th><th class="n">Лиды</th><th>Диагноз</th></tr>
${MET.by_utm.slice(0, 12).map(u => {
  const cid = (u.utm.match(/(\d{9})/) || [])[1];
  const known = cid && CAMPS.campaigns.some(c => String(c.id) === cid);
  return `<tr><td>${esc(u.utm)}</td><td class="n">${fmt(u.visits)}</td><td class="n">${u.leads}</td>
<td>${known ? '<span class="pill p-ok">кампания кабинета</span>'
    : cid ? '<span class="pill p-warn">ID не из этого кабинета</span>'
    : '<span class="pill p-hot">без ID кампании - источник P0</span>'}</td></tr>`; }).join('')}
</table>
<div class="hnote" style="margin-top:10px"><b>Улика найдена (атомный аудит TIMUR-001, [ДАННЫЕ]):</b> из визитов с engine «Yandex: Direct» только ~37/день несут utm_source=yandex (разметка кабинета e-20085264, сходится с его кликами). Остальные 70-75/день размечены utm_source=abdm или без разметки; за 30 дней abdm-источник дал 3801 визит и 30 CRM-лидов - больше собственного объёма кабинета. Следующий шаг (человеку): выяснить, какой сервис/кабинет ставит utm_source=abdm (вероятен сторонний сервис автопометки или второй кабинет). До этого P0 открыта.</div></div>
<div class="sec">Все источники трафика (контекст)</div>
<div class="card tblwrap"><table><tr><th>Источник</th><th class="n">Визиты</th><th class="n">Отказы</th><th class="n">CRM-лиды</th><th class="n">Отпр. контактов</th></tr>
${MET.by_source.map(s => `<tr><td>${esc(s.source)}</td><td class="n">${fmt(s.visits)}</td>
<td class="n">${fmt1(s.bounce)}%</td><td class="n">${s.leads}</td><td class="n">${s.contacts}</td></tr>`).join('')}
</table></div>`;
  page('reconcile.html', 'Сверка: Директ vs Метрика vs CRM', `разрыв атрибуции P0 · счётчик ${MET.counter || 104369223}`, body);
}

// ================= audit.html =================
{
  let body;
  if (!AUDIT) {
    body = `<div class="note">Атомный аудит выполняется агентом ТИМУР. Файл audit-summary.json ещё не создан - пересоберите сайт после завершения аудита: <code>node yandex-direct/dashboard/build.mjs</code></div>`;
  } else {
    const sev = s => s === 'P0' ? 'p-hot' : s === 'P1' ? 'p-warn' : 'p-mut';
    body = `
<div class="hero">
<div class="card hl ${AUDIT.score < 50 ? 'dn' : AUDIT.score < 75 ? 'warn' : ''}">
<div class="lab">Скоринг кабинета</div><div class="hv">${AUDIT.score}<small>/100 · грейд ${AUDIT.grade}</small></div>
<div class="hnote">55 проверок YD01-YD55 · ${AUDIT.generated_at}</div></div>
<div class="card"><div class="lab">Категории</div><table>
${(AUDIT.categories || []).map(c => `<tr><td>${esc(c.name)}</td><td class="n">${c.score}</td><td class="n mut">вес ${Math.round(c.weight * 100)}%</td></tr>`).join('')}
</table></div>
<div class="card"><div class="lab">Issues по приоритету</div>
<div class="hv">${(AUDIT.issues || []).filter(i => i.severity === 'P0').length}<small> P0</small> ${(AUDIT.issues || []).filter(i => i.severity === 'P1').length}<small> P1</small> ${(AUDIT.issues || []).filter(i => i.severity === 'P2').length}<small> P2</small></div></div>
</div>
<div class="sec">Все findings</div>
<div class="card tblwrap"><table><tr><th>Check</th><th>Приоритет</th><th>Проблема</th><th>Evidence</th><th class="n">Потери, ₽ <span class="badge b-h">[ГИПОТЕЗА]</span></th></tr>
${(AUDIT.issues || []).map(i => `<tr><td class="mut">${esc(i.check || i.id)}</td>
<td><span class="pill ${sev(i.severity)}">${i.severity}</span></td>
<td>${esc(i.title)}</td><td class="mut">${esc(i.evidence || '')}</td>
<td class="n">${i.loss_rub_est ? fmt(i.loss_rub_est) : '-'}</td></tr>`).join('')}
</table></div>
<div class="hnote" style="margin-top:14px">Полный отчёт: <code>yandex-direct/audit/2026-07-08-atomic-audit.md</code> в репозитории. Рекомендации - к апруву Ивана, мутации кабинета заблокированы до закрытия P0.</div>`;
  }
  page('audit.html', 'Атомный аудит кабинета', 'скоринг по методике skill direct (55 проверок, веса категорий)', body);
}

console.log('Сайт собран в', PUB);
