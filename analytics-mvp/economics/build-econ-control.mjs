import { readFileSync, writeFileSync, existsSync } from "node:fs";
const J = JSON.parse(readFileSync("economics/data/econ-recon.json", "utf8"));
const PORTAL = J.b24Portal || "https://glassmemory.bitrix24.ru";

const ORDER = ["Калькулятор GG", "Расчёт", "Закупка", "Производство  GG", "Сборка", "Логистика", "Монтаж"];
const SHORT = { "Калькулятор GG": "Кальк.", "Расчёт": "Расчёт", "Закупка": "Закупка", "Производство  GG": "Произв.", "Сборка": "Сборка", "Логистика": "Логист.", "Монтаж": "Монтаж" };
const etidByKey = {};
for (const s of J.spMeta) etidByKey[s.title] = s.etid;

const STAGE_ORDER = ["Новая сделка", "Формирование ТЗ", "Расчёт", "КП отправлено", "Принимают решение", "Долгострой", "Предоплата получена", "Заказ в производстве", "Заказ произведен", "Заказ отправлен", "Сделка успешна", "Сделка провалена"];
const RANK = {}; STAGE_ORDER.forEach((s, i) => RANK[s] = i);
const PROD_RANK = { "Предоплата получена": 3, "Заказ в производстве": 4, "Заказ произведен": 5, "Заказ отправлен": 5, "Сделка успешна": 5 };
const MOVE_DATE = "2026-03-01";
const SP_TL = [
  { k: "Расчёт", created: "2026-03-03", real: "2026-03-03", cards: 1006 },
  { k: "Калькулятор GG", created: "2026-03-02", real: "2026-03-06", cards: 1030 },
  { k: "Закупка", created: "2026-03-11", real: "2026-03-11", cards: 705 },
  { k: "Сборка", created: "2026-03-19", real: "2026-03-19", cards: 650 },
  { k: "Логистика", created: "2026-03-31", real: "2026-03-31", cards: 646 },
  { k: "Производство  GG", created: "2026-04-01", real: "2026-04-01", cards: 420 },
  { k: "Замер", created: "2026-04-01", real: "2026-04-01", cards: 13 },
  { k: "Монтаж", created: "2026-03-31", real: "2026-03-31", cards: 2 },
];

const BAKED_AT = new Date().toISOString(); // штамп сборки (версия) - для v.txt и авто-перезагрузки

// --- Динамика здоровья цепочки: история метрик между снимками разведки ---
// Считаем те же цифры, что рисует чип (запуск % и с/с %), но серверно, и храним по снимкам.
// Один снимок разведки (generated_at) = одна запись. Дельта считается к предыдущему снимку.
const EXCL_N = /сумма|налог|наценк|прибыл|бюджет|коэфф|адрес|номер|исполнител|отч[её]т|тип доставки|данные из сп|^id |удалить|расход материал|макет|шаблон|обрешет|домгласс|полная себестоимость по заказу/i;
const realMoneyN = (arr) => (arr || []).filter((m) => !EXCL_N.test(m.label));
function chainMetrics() {
  const N = J.deals.length || 1;
  return ORDER.map((k) => {
    let L = 0, F = 0;
    for (const d of J.deals) { const s = (d.sps || []).find((x) => x.key === k); if (s) { L++; if (realMoneyN(s.money).length > 0) F++; } }
    return { key: k, pL: Math.round((100 * L) / N), pF: L ? Math.round((100 * F) / L) : 0, L, F };
  });
}
const HIST_PATH = "economics/data/econ-control-history.json";
let hist = [];
try { if (existsSync(HIST_PATH)) hist = JSON.parse(readFileSync(HIST_PATH, "utf8")) || []; } catch { hist = []; }
if (!Array.isArray(hist)) hist = [];
const curEntry = { gen: J.generated_at, at: BAKED_AT, chain: chainMetrics() };
hist = hist.filter((h) => h.gen !== J.generated_at); // тот же снимок разведки не плодит записи
const prevEntry = hist.length ? hist[hist.length - 1] : null;
hist.push(curEntry);
hist = hist.slice(-120); // ~15 суток при cron каждые 3 часа
writeFileSync(HIST_PATH, JSON.stringify(hist));
const chainPrev = {};
if (prevEntry) for (const c of prevEntry.chain) chainPrev[c.key] = { pL: c.pL, pF: c.pF };

const payload = { generated_at: J.generated_at, bakedAt: BAKED_AT, since: J.since || null, portal: PORTAL, order: ORDER, short: SHORT, etid: etidByKey, stageOrder: STAGE_ORDER, rank: RANK, prodRank: PROD_RANK, moveDate: MOVE_DATE, spTimeline: SP_TL, chainPrev, chainPrevAt: prevEntry ? prevEntry.gen : null, deals: J.deals };

const HTML = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Контроль экономики сделок</title>
<style>
:root{--bg:#0B0F15;--card:#131820;--elev:#1A2029;--border:#1F2731;--ink:#F1F4F8;--ink-2:#A0AAB8;--ink-3:#6A7484;--ink-4:#3F4855;--up:#10B981;--warn:#F59E0B;--dn:#F43F5E;--info:#A78BFA;--accent:#22D3EE}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.45 -apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:1760px;margin:0 auto;padding:18px 18px 80px}
h1{font-size:21px;margin:0 0 4px}
.sub{color:var(--ink-2);font-size:12.5px;margin:0 0 14px;max-width:1200px}
.ver{color:var(--ink-3);font-size:12px;margin:0 0 12px}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:8px;margin:6px 0 10px}
.kt{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:9px 12px;cursor:pointer;transition:border-color .1s}
.kt:hover{border-color:var(--accent)} .kt.act{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.kt .v{font-size:20px;font-weight:800;line-height:1.1} .kt .l{font-size:11px;color:var(--ink-2);margin-top:3px}
.kt.good .v{color:var(--up)} .kt.weak .v{color:var(--warn)} .kt.loss .v{color:var(--dn)} .kt.noprice .v{color:var(--warn)} .kt.noss .v{color:var(--ink-3)} .kt.draft .v{color:var(--info)}
.midrow{display:flex;gap:14px;align-items:flex-start;margin:8px 0 12px}
.filtcol{flex:1 1 340px;min-width:300px;display:flex;flex-direction:column;gap:8px}
.filtcol .bar{margin:0}.midrow .byst{margin:0}
@media(max-width:1180px){.midrow{flex-direction:column}.filtcol,.midrow .byst{width:100%}}
.byst{margin:0 0 12px;overflow:auto}
.byst table{border-collapse:collapse;font-size:12px;min-width:0;width:auto}
.byst th,.byst td{padding:5px 10px;border-bottom:1px solid var(--border);white-space:nowrap;text-align:right}
.byst th:first-child,.byst td:first-child{text-align:left}
.byst th{color:var(--ink-3);text-transform:uppercase;font-size:10.5px;letter-spacing:.03em}
.byst td.bc{cursor:pointer} .byst td.bc:hover{background:rgba(255,255,255,.06)} .byst td.selc{background:rgba(34,211,238,.14);box-shadow:inset 0 0 0 1px var(--accent)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}
.tile{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px}
.tile .v{font-size:21px;font-weight:800}.tile .l{color:var(--ink-2);font-size:11.5px;margin-top:2px}.tile .n{color:var(--ink-3);font-size:10.5px;margin-top:4px}
h3{font-size:12px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.04em;margin:16px 0 8px}
.chain{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}
.chip{background:var(--card);border:1px solid var(--border);border-radius:999px;padding:6px 12px;font-size:12px;display:flex;gap:8px;align-items:center}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block}
.trend{font-size:10.5px;font-weight:800;margin-left:1px;font-variant-numeric:tabular-nums}
.trend.up{color:var(--up)}.trend.dn{color:var(--dn)}.trend.flat{color:var(--ink-4)}
.g{background:var(--up)}.y{background:var(--warn)}.r{background:var(--dn)}.o{background:var(--ink-3)}
.tl{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.tlc{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:9px 11px;font-size:11.5px}
.tlc b{font-size:12.5px}.tlc .d{color:var(--ink-3);margin-top:3px;font-size:11px}
.tlc-h{display:flex;gap:6px;align-items:center;margin-bottom:3px}
.tlc-m{font-size:11.5px;color:var(--ink);margin-bottom:5px}
.months{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.mo{background:var(--elev);border:1px solid var(--border);border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;color:var(--ink-2)}
.mo:hover{border-color:var(--accent)}
.mo.move{background:rgba(245,158,11,.14);border-color:var(--warn);color:var(--warn);font-weight:700;cursor:default}
.mo.act{background:var(--accent);color:#04222a;border-color:var(--accent);font-weight:700}
.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin:10px 0 10px}
.bar input,.bar select{background:var(--elev);border:1px solid var(--border);color:var(--ink);border-radius:8px;padding:7px 10px;font-size:12.5px}
.bar input[type=text]{min-width:200px}
.bar label{display:flex;gap:6px;align-items:center;color:var(--ink-2);font-size:12px;cursor:pointer;user-select:none}
.presets{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.pbtn{background:var(--elev);border:1px solid var(--border);color:var(--ink-2);border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer}
.pbtn:hover{border-color:var(--accent)}.pbtn.act{background:var(--accent);color:#04222a;border-color:var(--accent);font-weight:700}
.seg{display:inline-flex;background:var(--elev);border:1px solid var(--border);border-radius:8px;overflow:hidden}
.seg button{background:transparent;border:0;border-right:1px solid var(--border);color:var(--ink-3);font:inherit;font-size:12px;padding:6px 11px;cursor:pointer;transition:.15s;white-space:nowrap}
.seg button:last-child{border-right:0}
.seg button:hover:not(.on){color:var(--ink)}
.seg button.on{background:var(--accent);color:#04222a;font-weight:700}
.dbtn{background:var(--accent);border:1px solid var(--accent);color:#04222a;border-radius:8px;padding:7px 12px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.dsep{color:var(--ink-4)}
.cnt{color:var(--ink-3);font-size:12px;margin-left:auto}
.scrollx{overflow:auto;max-height:74vh;border:1px solid var(--border);border-radius:12px}
table{border-collapse:collapse;width:100%;font-size:12px;min-width:1380px}
th,td{padding:7px 9px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap}
th{position:sticky;top:0;background:var(--elev);z-index:2;font-size:11px;color:var(--ink-2);text-transform:uppercase;letter-spacing:.03em;cursor:pointer;user-select:none}
th:hover{color:var(--ink)} th .ar{color:var(--accent);font-size:10px}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
tr.drow:hover td{background:rgba(255,255,255,.02)}
tr.drow{cursor:pointer}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.st{font-size:11px;padding:2px 8px;border-radius:999px;background:var(--elev);border:1px solid var(--border);color:var(--ink-2)}
.cell-g{color:var(--up);font-weight:700}.cell-y{color:var(--warn)}.cell-o{color:var(--ink-4)}.cell-dn{color:var(--dn);font-weight:800}
.exp{color:var(--ink-3);display:inline-block;width:12px}
.dots{display:inline-flex;gap:3px;align-items:center;flex-wrap:wrap;max-width:96px;justify-content:flex-end}
.sd{width:7px;height:7px;border-radius:50%;border:1px solid var(--ink-4);display:inline-block}
.sd.on{background:var(--up);border-color:var(--up)}
.sd.mono{background:var(--ink-4)}
.dmore{color:var(--ink-3);font-size:10px;margin-left:2px}
.flag{font-size:11px;padding:2px 7px;border-radius:6px;font-weight:700}
.flag.ok{background:rgba(16,185,129,.14);color:var(--up)}
.flag.warn{background:rgba(245,158,11,.14);color:var(--warn)}
.flag.bad{background:rgba(244,63,94,.16);color:var(--dn)}
.flag.lost{background:rgba(106,116,132,.14);color:var(--ink-3)}
.izd td{background:#0E141C}
.izd .izcol{color:var(--accent);text-align:center;width:22px}
.izd .iname{color:var(--ink-2);padding-left:6px}
.detail td{background:#0E141C;padding:12px 16px;white-space:normal}
.dgrid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.dh{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-3);margin:0 0 6px}
.dtab{width:100%;border-collapse:collapse;font-size:12px;min-width:0}
.dtab td,.dtab th{padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap;text-align:left}
.spblock{margin-bottom:8px}.spname{font-weight:700;font-size:12px}
.card-line{color:var(--ink-2);font-size:11.5px;margin:2px 0 2px 10px}
.foot{color:var(--ink-3);font-size:11.5px;margin-top:16px;max-width:1300px}
</style></head>
<body><div class="wrap">
<h1>Контроль экономики сделок</h1>
<p class="ver">Воронка «GG Заказы РФ» (49) · с/с и Маржа - за партию (с/с за шт × кол-во) · обновлено <span id="gen"></span></p>
<h3>Смарт-процессы: запуск / внесённая с/с (стрелка - к прошлому снимку) · создан и первая боевая сделка</h3>
<div class="tl" id="tl"></div>
<h3>Ключевые метрики (клик - фильтр таблицы)</h3>
<div class="kpi" id="kpi"></div>

<div class="midrow">
<div class="byst" id="byst"></div>
<div class="filtcol">
<div class="bar">
  <input type="text" id="q" placeholder="Поиск: номер или название">
  <select id="fstage"><option value="">все этапы</option></select>
  <select id="fmgr"><option value="">все менеджеры</option></select>
  <label>с <input type="date" id="dfrom"></label>
  <span class="dsep">–</span>
  <label>по <input type="date" id="dto"></label>
  <button class="dbtn" id="applyRange">ОК</button>
  <label><input type="checkbox" id="fnoprod"> без товаров</label>
  <label><input type="checkbox" id="fgap"> произв. без с/с</label>
  <label><input type="checkbox" id="fpart"> неполная с/с</label>
  <span class="cnt" id="cnt"></span>
</div>
<div class="presets" id="presets"></div>
</div>
</div>

<div class="scrollx"><table id="tbl"><thead></thead><tbody></tbody></table></div>
</div>
<script>
const DATA=${JSON.stringify(payload)};
document.getElementById('gen').textContent=new Date(DATA.generated_at).toLocaleString('ru')+' · версия '+new Date(DATA.bakedAt).toLocaleString('ru');
// авто-обновление как у РОП: опрашиваем v.txt, при новой сборке перезагружаем
function autoReload(){ if(!DATA.bakedAt||location.search.indexOf('cb=')>=0)return; setInterval(function(){ fetch('v.txt?ts='+Date.now()).then(function(r){return r.ok?r.text():'';}).then(function(t){ t=(t||'').trim(); if(t&&t!==DATA.bakedAt) location.replace(location.pathname+'?cb='+Date.now()); }).catch(function(){}); }, 180000); }
autoReload();
const ORDER=DATA.order, SHORT=DATA.short, PORTAL=DATA.portal, RANK=DATA.rank, PROD=DATA.prodRank, MOVE=DATA.moveDate;
const EXCL=/сумма|налог|наценк|прибыл|бюджет|коэфф|адрес|номер|исполнител|отч[её]т|тип доставки|данные из сп|^id |удалить|расход материал|макет|шаблон|обрешет|домгласс|полная себестоимость по заказу/i;
const ITOG=/производственная с\\/с|с\\/?с итог|расчет с\\/с итого|себестоимость производ/i;
function realMoney(arr){ return (arr||[]).filter(m=>!EXCL.test(m.label)); }
function spCost(sp){ if(!sp) return null; const f=realMoney(sp.money); if(!f.length) return {v:0,empty:true}; const it=f.find(m=>ITOG.test(m.label)); return {v: it?it.value:f.reduce((a,m)=>a+m.value,0), empty:false, fields:f}; }
function byKey(d,key){ return d.sps.find(s=>s.key===key); }
function ssCardsOf(sp){ return sp?(sp.cards||[]).filter(c=>!c.bad&&realMoney(c.money).length>0).length:0; }
const fmt=v=>v>=1e6?(v/1e6).toFixed(1).replace('.',',')+' млн':v>=1000?Math.round(v/1000)+'к':Math.round(v)+'';
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dealUrl=id=>PORTAL+'/crm/deal/details/'+id+'/';
const spUrl=(etid,card)=>PORTAL+'/crm/type/'+etid+'/details/'+card+'/';
const ruD=s=>{ if(!s)return''; const p=s.split('-'); return p[2]+'.'+p[1]+'.'+p[0]; };
const posOf=d=>(d.products||[]).length;
const qtyOf=d=>(d.products||[]).reduce((a,p)=>a+(+p.qty||0),0);
// с/с за партию = Σ по карточкам (с/с за 1 шт × Кол-во товара). Поля с/с в Bitrix - за 1 шт,
// бюджет и «Сумма» - за партию, поэтому маржу считаем на одной базе (за партию).
function spBatch(sp){ if(!sp) return {v:0,empty:true}; let v=0,any=false; for(const c of (sp.cards||[])){ if(c.bad)continue; const b=cardBatch(c); if(b>0){any=true; v+=b;} } return {v,empty:!any}; }
function prodSS(d){ const pr=spBatch(byKey(d,'Производство  GG')),ra=spBatch(byKey(d,'Расчёт')),za=spBatch(byKey(d,'Закупка'));
  const base=(pr&&!pr.empty)?pr.v:((ra&&!ra.empty)?ra.v:0); const glass=(za&&!za.empty)?za.v:0; return base+glass; }
// ячейка Маржа с чтением минуса: бюджет≈0 при наличии с/с = «нет цены» (ложный минус); цена реальная < с/с = «убыток»
function marginCell(d,ss,marginShown){
  if(!(marginShown&&ss)) return '<td class="num" title="маржа считается со стадии производства"><span class="cell-o">-</span></td>';
  const m=d.budget-ss;
  if(m>=0) return '<td class="num" title="бюджет за партию − с/с за партию">'+fmt(m)+'</td>';
  const lowPrice=d.budget<=100||d.budget<ss*0.05;
  const tag=lowPrice?'нет цены':'убыток', fl=lowPrice?'warn':'bad';
  const tip=lowPrice?('бюджет '+fmt(d.budget)+' не заполнен, а с/с '+fmt(ss)+' есть - минус ложный, проставить цену'):('цена '+fmt(d.budget)+' ниже с/с '+fmt(ss)+' - убыток по данным, разобрать');
  return '<td class="num" title="'+esc(tip)+'"><span class="cell-dn">'+fmt(m)+'</span> <span class="flag '+fl+'">'+tag+'</span></td>';
}
function rankOf(d){ return RANK[d.stage]!==undefined?RANK[d.stage]:2; }
function prodRankOf(d){ return PROD[d.stage]||0; }
// полнота с/с: сколько карточек с с/с против числа позиций
function coverage(d){ const pos=posOf(d); let best=0; for(const k of ['Расчёт','Производство  GG','Закупка','Калькулятор GG']){ const n=ssCardsOf(byKey(d,k)); if(n>best)best=n; }
  if(best===0) return {cls:'',t:'-',r:-1};
  if(pos===0) return {cls:'warn',t:'с/с есть, товаров 0',r:0.5};
  if(best>=pos) return {cls:'ok',t:'полная',r:1};
  return {cls:'warn',t:'частичная '+best+'/'+pos,r:best/pos}; }
function gate(d){ if(/провал/i.test(d.stage)) return {cls:'lost',t:'провалена'};
  const pr=spCost(byKey(d,'Производство  GG')); const est=spCost(byKey(d,'Расчёт'))||spCost(byKey(d,'Калькулятор GG')); const p5=prodRankOf(d);
  if(p5>=5){ if(!pr||pr.empty) return {cls:'bad',t:'нет с/с производства'}; return {cls:'ok',t:'с/с есть'}; }
  if(p5>=4){ if(!pr||pr.empty) return {cls:'warn',t:'в произв., с/с нет'}; return {cls:'ok',t:'ок'}; }
  if(rankOf(d)>=3){ if(!est||est.empty) return {cls:'warn',t:'КП без расчёта'}; return {cls:'ok',t:'ок'}; }
  return {cls:'',t:''}; }

const N=DATA.deals.length;

const CP=DATA.chainPrev||{}, CPat=DATA.chainPrevAt;
function trend(cur,prev){ if(prev===null||prev===undefined)return ''; const d=cur-prev; if(d===0)return '<span class="trend flat" title="без изменений">=</span>'; const up=d>0; return '<span class="trend '+(up?'up':'dn')+'" title="было '+prev+'%">'+(up?'▲':'▼')+Math.abs(d)+'</span>'; }
const cpTip=CPat?('к снимку '+new Date(CPat).toLocaleString('ru')):'первый снимок - динамики пока нет';
// здоровье цепочки вшито в карточку таймлайна каждого смарта
function spHealth(k){ let L=0,F=0; for(const d of DATA.deals){ const s=byKey(d,k); if(s){L++; const c=spCost(s); if(c&&!c.empty)F++;} }
  const pL=Math.round(100*L/N), pF=L?Math.round(100*F/L):0; const dot=L===0?'o':F===0?'r':pF>=70?'g':'y';
  const pv=CP[k]; return {pL,pF,dot,L,tL:pv?trend(pL,pv.pL):'',tF:pv?trend(pF,pv.pF):''}; }
document.getElementById('tl').innerHTML=DATA.spTimeline.map(s=>{ const h=spHealth(s.k);
  return '<div class="tlc" title="'+esc(cpTip)+'">'
    +'<div class="tlc-h"><span class="dot '+h.dot+'"></span><b>'+esc(SHORT[s.k]||s.k)+'</b></div>'
    +'<div class="tlc-m">запуск '+h.pL+'% '+h.tL+' · с/с '+(h.L?h.pF+'% '+h.tF:'нет')+'</div>'
    +'<div class="d">создан '+ruD(s.created)+' · 1-я боевая '+ruD(s.real)+'</div>'
    +'<div class="d">боевых карточек '+s.cards+'</div></div>'; }).join('');

const present=new Set(DATA.deals.map(d=>d.stage));
const fstage=document.getElementById('fstage');
DATA.stageOrder.filter(s=>present.has(s)).forEach(s=>fstage.insertAdjacentHTML('beforeend','<option>'+esc(s)+'</option>'));
const mgrs=[...new Set(DATA.deals.map(d=>d.mgr).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
const fmgr=document.getElementById('fmgr'); mgrs.forEach(m=>fmgr.insertAdjacentHTML('beforeend','<option>'+esc(m)+'</option>'));

const today=DATA.deals.reduce((mx,d)=>d.created>mx?d.created:mx, '2026-01-01');
function daysAgo(n){ const t=new Date(today+'T00:00:00Z'); t.setUTCDate(t.getUTCDate()-n); return t.toISOString().slice(0,10); }
// пресеты периода по образцу РОП: сегмент-пилюля + диапазон с–по с кнопкой ОК
const PSET=[['today','Сегодня'],['yest','Вчера'],['7','7 дн'],['30','30 дн'],['60','60 дн'],['90','90 дн'],['all','Всё'],['mig','После переезда']];
function econSetPeriod(p){ const df=document.getElementById('dfrom'), dt=document.getElementById('dto');
  if(p==='all'){ df.value=''; dt.value=''; }
  else if(p==='today'){ df.value=today; dt.value=today; }
  else if(p==='yest'){ df.value=daysAgo(1); dt.value=daysAgo(1); }
  else if(p==='mig'){ df.value='2026-04-01'; dt.value=''; }
  else { df.value=daysAgo(+p-1); dt.value=today; } }
const pdiv=document.getElementById('presets');
const clearPeriod=()=>{ [...pdiv.querySelectorAll('.seg button')].forEach(x=>x.classList.remove('on')); };
pdiv.innerHTML='<span style="color:var(--ink-3);font-size:11.5px;align-self:center;margin-right:6px">Период:</span><div class="seg">'+PSET.map(p=>'<button data-p="'+p[0]+'"'+(p[0]==='mig'?' title="сделки, созданные после переезда - операционка с апреля 2026"':'')+'>'+esc(p[1])+'</button>').join('')+'</div>';
pdiv.addEventListener('click',e=>{ const b=e.target.closest('.seg button'); if(!b)return; clearPeriod(); b.classList.add('on'); econSetPeriod(b.dataset.p); render(); });
document.getElementById('applyRange').addEventListener('click',()=>{ clearPeriod(); render(); });

let sortIdx=0, sortDir=-1; // по умолчанию переопределим на «Полнота с/с» ниже, чтобы заполненные сделки были сверху
// услуги = товарные строки по названию (доставка/монтаж/замер/логистика/сборка), это ДАННЫЕ, не остаток.
const SVC=/доставк|монтаж|логист|сборк|подъ[её]м|пронос|разгруз|замер|установк|услуг|пэк/i;
const svcRows=d=>(d.products||[]).filter(p=>SVC.test(p.name||''));
const goodRows=d=>(d.products||[]).filter(p=>!SVC.test(p.name||''));
const sumRows=rs=>rs.reduce((a,p)=>a+(+p.price||0)*(+p.qty||0),0);
const svcSum=d=>sumRows(svcRows(d));
const goodsQty=d=>goodRows(d).reduce((a,p)=>a+(+p.qty||0),0);
const goodsPos=d=>goodRows(d).length;
const spN=ORDER.length, SP0=9;
// «Позиций» = число наименований (товарных строк). «Штук» = суммарное количество изделий.
const COLS=['Сделка','Название','Менеджер','Этап','Создана','Бюджет','Позиций','Штук','Услуги ₽',...ORDER.map(k=>SHORT[k]||k),'Σ с/с','Маржа','Полнота с/с','Статус'];
const I_SS=SP0+spN, I_MRG=SP0+spN+1, I_COV=SP0+spN+2, I_STAT=SP0+spN+3;
function sortVal(d,i){
  if(i===0)return d.id; if(i===1)return (d.title||'').toLowerCase(); if(i===2)return (d.mgr||'').toLowerCase();
  if(i===3)return rankOf(d); if(i===4)return d.created||''; if(i===5)return d.budget; if(i===6)return goodsPos(d); if(i===7)return goodsQty(d); if(i===8)return svcSum(d);
  if(i>=SP0&&i<SP0+spN){ const c=spCost(byKey(d,ORDER[i-SP0])); return c?(c.empty?-1:c.v):-2; }
  if(i===I_SS)return prodSS(d);
  if(i===I_MRG){ const pr=spCost(byKey(d,'Производство  GG')); return (pr&&!pr.empty)||prodRankOf(d)>=5? d.budget-prodSS(d) : -1e15; }
  if(i===I_COV)return coverage(d).r;
  if(i===I_STAT)return rankOf(d);
  return 0;
}
function head(){ document.querySelector('#tbl thead').innerHTML='<tr>'+COLS.map((h,i)=>'<th class="'+((i>=5&&i!==I_COV&&i!==I_STAT)?'num':'')+'" data-i="'+i+'">'+esc(h)+(i===sortIdx?' <span class="ar">'+(sortDir>0?'▲':'▼')+'</span>':'')+'</th>').join('')+'</tr>';
  document.querySelectorAll('#tbl thead th').forEach(th=>th.addEventListener('click',()=>{ const i=+th.dataset.i; if(i===sortIdx)sortDir=-sortDir; else{sortIdx=i;sortDir=(i===0?-1:1);} head(); render(); })); }

// ячейка СП на уровне сделки: точки по товарам в этом смарте (одна на карточку).
// Горит = товар вернул с/с из смарта; тусклая = товар ещё в смарте (данные не вернулись).
function cellSP(d,k){ const s=byKey(d,k); if(!s) return '<td class="num cell-o">·</td>';
  const cards=(s.cards||[]).filter(c=>!c.bad); if(!cards.length) return '<td class="num cell-o">·</td>';
  const lit=cards.filter(c=>realMoney(c.money).length>0).length; const cap=14;
  let dots=''; cards.slice(0,cap).forEach(c=>{ dots+='<span class="sd'+(realMoney(c.money).length>0?' on':'')+'"></span>'; });
  const more=cards.length>cap?('<span class="dmore">+'+(cards.length-cap)+'</span>'):'';
  const c=spCost(s); const title=(c&&!c.empty?fmt(c.v)+' с/с · ':'')+lit+' из '+cards.length+' карточек с с/с';
  return '<td title="'+esc(title)+'"><span class="dots">'+dots+more+'</span></td>'; }

const OPEN=new Set();
// с/с одной карточки: поле-итог, иначе сумма денежных полей
// с/с одной карточки за штуку: итог-поле, но не больше суммы своих компонент
// (защита от опечаток в Bitrix - напр. 39111 вместо ~3900: итог > компонент = мусор -> берём компоненты)
function cardSS(c){ const f=realMoney(c.money); if(!f.length)return 0; const it=f.find(m=>ITOG.test(m.label));
  const comp=f.filter(m=>!ITOG.test(m.label)).reduce((a,m)=>a+m.value,0);
  if(it) return comp>0?Math.min(it.value,comp):it.value;
  return comp; }
// множитель партии: поля с/с в Bitrix записаны либо ЗА ШТУКУ (тогда «Сумма»≈«Металл-сталь»×кол-во),
// либо УЖЕ ЗА ПАРТИЮ (тогда «Сумма»≈«Металл-сталь»). Определяем по каждой карточке, чтобы не завышать.
function cardMult(c){ const raw=c.money||[]; const q=Math.max(1,+c.qty||1);
  const S=(raw.find(m=>/^сумма$/i.test(m.label))||{}).value||0;
  const M=(raw.find(m=>/металл-сталь/i.test(m.label))||{}).value||0;
  if(M>0&&S>0&&Math.abs(S-M*q)<Math.abs(S-M))return q; // с/с за штуку -> умножаем
  return 1; }                                          // с/с уже за партию -> не умножаем
function cardBatch(c){ const u=cardSS(c); return u?u*cardMult(c):0; } // с/с карточки за партию
// изделия сделки: группируем карточки СП по артикулу, с/с по каждому смарту
function izdelia(d){
  const g={};
  for(const s of d.sps){ for(const c of (s.cards||[])){ if(c.bad)continue; const ss=cardSS(c); const q=Math.max(1,+c.qty||1); const key=c.art||(ss>0?'(без артикула)':null); if(key===null)continue;
    const it=g[key]=g[key]||{art:c.art||'(без артикула)',qty:0,sp:{}};
    if((+c.qty||0)>it.qty)it.qty=+c.qty||0;
    const e=it.sp[s.key]=it.sp[s.key]||{vU:0,vB:0,cards:[]}; e.vU+=ss; e.vB+=cardBatch(c); e.cards.push({id:c.id,etid:s.etid}); } }
  return Object.values(g).filter(it=>it.art!=='(без артикула)'||Object.values(it.sp).some(e=>e.vB>0));
}
function izdRow(d,g){
  // Σ с/с за партию = производственная база (Производство, иначе Расчёт) + стекло (Закупка), уже × кол-во
  const baseB=((g.sp['Производство  GG']&&g.sp['Производство  GG'].vB)||(g.sp['Расчёт']&&g.sp['Расчёт'].vB)||0);
  const baseU=((g.sp['Производство  GG']&&g.sp['Производство  GG'].vU)||(g.sp['Расчёт']&&g.sp['Расчёт'].vU)||0);
  const glassB=(g.sp['Закупка']&&g.sp['Закупка'].vB)||0, glassU=(g.sp['Закупка']&&g.sp['Закупка'].vU)||0;
  const ssTot=baseB+glassB, ssU=baseU+glassU;
  const perU=k=>{ const e=g.sp[k]; if(!e||!e.vB)return ''; return (g.qty&&Math.abs(e.vB-e.vU*g.qty)<1)?(fmt(e.vU)+'/шт × '+g.qty+' шт = '+fmt(e.vB)):('с/с за партию '+fmt(e.vB)); };
  const spCells=ORDER.map(k=>{ const e=g.sp[k]; if(!e||!e.vB) return '<td class="num cell-o">·</td>';
    return '<td class="num cell-g" title="'+esc(perU(k))+'"><a href="'+spUrl(e.cards[0].etid,e.cards[0].id)+'" target="_blank" onclick="event.stopPropagation()">'+fmt(e.vB)+'</a></td>'; }).join('');
  const cov=(baseB>0)?'<span class="flag ok">есть</span>':'<span class="cell-o">-</span>';
  const ssTip='с/с за партию '+fmt(ssTot);
  return '<tr class="izd">'
    +'<td class="izcol">↳</td>'
    +'<td class="iname" title="'+esc(g.art)+'">'+esc(g.art)+'</td>'
    +'<td></td><td></td><td></td><td></td>'
    +'<td></td>'
    +'<td class="num">'+(g.qty?g.qty+' <span class="cell-o">шт</span>':'')+'</td>'
    +'<td></td>'
    +spCells
    +'<td class="num" title="'+esc(ssTip)+'">'+(ssTot?fmt(ssTot):'<span class="cell-o">-</span>')+'</td>'
    +'<td class="num cell-o">-</td>'
    +'<td>'+cov+'</td>'
    +'<td></td>'
    +'</tr>';
}
// строка услуг (доставка/монтаж/замер по товарным строкам) в той же таблице
function svcRow(d,svc){ const sum=sumRows(svc);
  return '<tr class="izd"><td class="izcol">↳</td>'
    +'<td class="iname" title="'+esc(svc.map(p=>p.name+' '+fmt((+p.price||0)*(+p.qty||0))).join('; '))+'">Услуги: доставка / монтаж / замер</td>'
    +'<td></td><td></td><td></td><td></td>'
    +'<td class="num">'+svc.length+'</td>'
    +'<td></td>'
    +'<td class="num cell-g">'+fmt(sum)+'</td>'
    +ORDER.map(()=>'<td class="num cell-o">·</td>').join('')
    +'<td class="num cell-o">-</td><td class="num cell-o">-</td><td></td><td></td></tr>'; }
// строка-заглушка, когда в карточках нет изделий с артикулом
function emptyRow(d){ return '<tr class="izd"><td class="izcol">↳</td><td colspan="'+(COLS.length-1)+'" class="iname">изделий с артикулом в карточках нет'+(d.sps.length?' (смарты запущены, артикул не заполнен)':'; смарты не запущены')+'</td></tr>'; }

// --- Верхние метрики: классификация сделки по запасу маржинальности ---
const MARG_WEAK=20; // [ГИПОТЕЗА] порог слабого запаса, % от бюджета - калибруется с финансами
function hasAnySS(d){ return (d.sps||[]).some(s=>(s.cards||[]).some(c=>!c.bad&&realMoney(c.money).length>0)); }
function classify(d){
  if(!hasAnySS(d)) return 'noss';                       // нет данных о с/с
  const ss=prodSS(d);
  if(ss<=0) return 'draft';                             // с/с только в калькуляторе (черновик)
  if(d.budget<=100||d.budget<ss*0.05) return 'noprice'; // бюджет не заполнен, с/с есть
  const m=d.budget-ss;
  if(m<=0) return 'loss';                               // убыток/ноль
  if(m/d.budget*100 < MARG_WEAK) return 'weak';         // слабый запас
  return 'good';                                        // с запасом
}
const TILES=[
  {k:'',label:'Всего',desc:'все сделки в текущем диапазоне'},
  {k:'good',label:'С запасом',desc:'маржа ≥ '+MARG_WEAK+'% бюджета'},
  {k:'weak',label:'Слабый запас',desc:'маржа 0-'+MARG_WEAK+'% бюджета'},
  {k:'loss',label:'Убыток / ноль',desc:'с/с ≥ цены при заполненной цене'},
  {k:'noprice',label:'Нет цены',desc:'бюджет ≈0, а с/с есть - проставить цену'},
  {k:'draft',label:'Черновой расчёт',desc:'с/с только в калькуляторе, Расчёт/Производство пусто'},
  {k:'noss',label:'Без с/с',desc:'нет данных о с/с ни в одном смарте'}
];
let quick='';
function passesBase(d){
  const q=document.getElementById('q').value.trim().toLowerCase();
  const fs=document.getElementById('fstage').value, fm=document.getElementById('fmgr').value;
  const df=document.getElementById('dfrom').value, dt=document.getElementById('dto').value;
  const noprod=document.getElementById('fnoprod').checked, gap=document.getElementById('fgap').checked, part=document.getElementById('fpart').checked;
  if(q && !(String(d.id).includes(q)||(d.title||'').toLowerCase().includes(q))) return false;
  if(fs && d.stage!==fs) return false;
  if(fm && d.mgr!==fm) return false;
  if(df && (d.created||'')<df) return false;
  if(dt && (d.created||'')>dt) return false;
  if(noprod && d.hasProducts) return false;
  if(gap && gate(d).cls!=='bad') return false;
  if(part){ const r=coverage(d).r; if(!(r>=0&&r<1)) return false; }
  return true;
}
function renderKPI(base){
  const cnt={}; for(const d of base){ const c=classify(d); cnt[c]=(cnt[c]||0)+1; } cnt['']=base.length;
  document.getElementById('kpi').innerHTML=TILES.map(t=>'<div class="kt '+t.k+(quick===t.k?' act':'')+'" data-q="'+t.k+'" title="'+esc(t.desc)+'"><div class="v">'+(cnt[t.k]||0)+'</div><div class="l">'+esc(t.label)+'</div></div>').join('');
}
function matchQuick(d){ if(!quick)return true; if(quick==='hasss')return classify(d)!=='noss'; return classify(d)===quick; }
function renderByStage(base){
  const byS={}; for(const d of base){ const s=d.stage||'(без этапа)'; (byS[s]=byS[s]||[]).push(d); }
  const order=DATA.stageOrder.filter(s=>byS[s]); for(const s of Object.keys(byS)) if(!order.includes(s)) order.push(s);
  const cur=document.getElementById('fstage').value, cq=quick;
  // ячейка = клик по этапу+классу: показать именно эти сделки
  const cell=(s,qk,v,cls)=>'<td class="bc'+(cls?' '+cls:'')+(cur===s&&cq===qk?' selc':'')+'" data-stage="'+esc(s)+'" data-q="'+qk+'">'+v+'</td>';
  let rows='<tr><th>Этап</th><th>Сделок</th><th>С с/с</th><th>Без с/с</th><th>С запасом</th><th>Слабый</th><th>Убыток/0</th><th>Нет цены</th></tr>';
  for(const s of order){ const L=byS[s]; const c={}; for(const d of L){ const k=classify(d); c[k]=(c[k]||0)+1; } const withSS=L.length-(c.noss||0);
    rows+='<tr class="br" data-stage="'+esc(s)+'">'
      +'<td class="bname bc'+(cur===s&&!cq?' selc':'')+'" data-stage="'+esc(s)+'" data-q="">'+esc(s)+'</td>'
      +cell(s,'',L.length)+cell(s,'hasss',withSS)+cell(s,'noss',c.noss||0)
      +cell(s,'good',c.good||0,'cell-g')+cell(s,'weak',c.weak||0,'cell-y')+cell(s,'loss',c.loss||0,'cell-dn')+cell(s,'noprice',c.noprice||0)+'</tr>'; }
  document.getElementById('byst').innerHTML='<table>'+rows+'</table>';
}
function render(){
  const base=DATA.deals.filter(passesBase);
  renderKPI(base); renderByStage(base);
  let list=base.filter(matchQuick);
  list.sort((a,b)=>{ const x=sortVal(a,sortIdx),y=sortVal(b,sortIdx); return (x<y?-1:x>y?1:0)*sortDir; });
  let rows='';
  for(const d of list){
    const ss=prodSS(d); const pr=spCost(byKey(d,'Производство  GG')); const g=gate(d); const cv=coverage(d);
    const marginShown=(pr&&!pr.empty)||prodRankOf(d)>=5; const op=OPEN.has(d.id);
    const goods=goodRows(d), svc=svcRows(d), gQty=goodsQty(d), sSum=svcSum(d);
    rows+='<tr class="drow" data-id="'+d.id+'">'
      +'<td><span class="exp">'+(op?'▾':'▸')+'</span> <a href="'+dealUrl(d.id)+'" target="_blank" onclick="event.stopPropagation()">'+d.id+'</a></td>'
      +'<td title="'+esc(d.title)+'">'+esc((d.title||'').slice(0,38))+'</td>'
      +'<td>'+esc(d.mgr||'')+'</td>'
      +'<td><span class="st">'+esc(d.stage||'')+'</span></td>'
      +'<td class="num">'+ruD(d.created)+'</td>'
      +'<td class="num">'+fmt(d.budget)+'</td>'
      +'<td class="num" title="наименований (товарных строк): '+goods.length+'">'+(goods.length?goods.length:'<span class="cell-o">-</span>')+'</td>'
      +'<td class="num" title="'+esc(goods.map(p=>p.name+' x'+p.qty).join('; ').slice(0,300))+'">'+(goods.length?gQty+' <span class="cell-o">шт</span>':'<span class="cell-o">-</span>')+'</td>'
      +'<td class="num" title="'+esc(svc.map(p=>p.name+' '+fmt((+p.price||0)*(+p.qty||0))).join('; ').slice(0,300))+'">'+(svc.length?'<span class="cell-g">'+fmt(sSum)+'</span> <span class="cell-o">('+svc.length+')</span>':'<span class="cell-o">-</span>')+'</td>'
      +ORDER.map(k=>cellSP(d,k)).join('')
      +'<td class="num" title="с/с за партию (с/с за шт × кол-во товара)">'+(ss?fmt(ss):'<span class="cell-o">-</span>')+'</td>'
      +marginCell(d,ss,marginShown)
      +'<td>'+(cv.cls?'<span class="flag '+cv.cls+'">'+esc(cv.t)+'</span>':'<span class="cell-o">-</span>')+'</td>'
      +'<td><span class="flag '+(g.cls||'')+'">'+esc(g.t||'')+'</span></td>'
      +'</tr>';
    if(op){ const izd=izdelia(d); izd.forEach(g=>rows+=izdRow(d,g)); const svc=svcRows(d); if(svc.length)rows+=svcRow(d,svc); if(!izd.length&&!svc.length)rows+=emptyRow(d); }
  }
  document.querySelector('#tbl tbody').innerHTML=rows;
  document.getElementById('cnt').textContent='показано '+list.length+' из '+DATA.deals.length;
}
document.querySelector('#tbl tbody').addEventListener('click',e=>{ if(e.target.closest('a'))return; const tr=e.target.closest('tr.drow'); if(!tr)return; const id=+tr.dataset.id; if(OPEN.has(id))OPEN.delete(id); else OPEN.add(id); render(); });
['q','fstage','fmgr','dfrom','dto','fnoprod','fgap','fpart'].forEach(id=>document.getElementById(id).addEventListener('input',render));
document.getElementById('kpi').addEventListener('click',e=>{ const t=e.target.closest('.kt'); if(!t)return; const k=t.dataset.q; quick=(quick===k)?'':k; render(); });
document.getElementById('byst').addEventListener('click',e=>{ const td=e.target.closest('td.bc'); if(!td)return; const s=td.dataset.stage, qk=td.dataset.q||''; const sel=document.getElementById('fstage');
  if(sel.value===s&&quick===qk){ sel.value=''; quick=''; } else { sel.value=s; quick=qk; } render(); });
sortIdx=I_COV; sortDir=-1; // старт: сделки с заполненной с/с (горящие точки, разворот) - сверху
head(); render();
</script></body></html>`;

writeFileSync("public/econ-control.html", HTML.replace(/—/g, "-"));
console.log("written", HTML.length, "bytes");
