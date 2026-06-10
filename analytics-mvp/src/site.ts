// Рендер сервиса в Orbi-стиле. История встроена в страницу, клиентский движок
// витрин считает за выбранный период (7/30/90/Всё/свой) и сравнение - в браузере.
// Несколько страниц на общем движке: Товары, Обзор, Воронка.
// Факт: [date, sku, rev, units, views, cart, deliv, ret, canc]

export const DS_CSS = `
:root{--bg:#0A0A0B;--surface:#161617;--raised:#1E1E20;--line:#2A2A2D;--txt:#F5F5F6;--mut:#8A8A90;--mut2:#5E5E64;--brand:#FF4438;--good:#34D399;--bad:#FF5A5F;--warn:#F2B544;--info:#6AA8FF;--r-card:16px;--r-ctl:10px;--pad:22px;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.55 "SF Pro Display","SF Pro Text",-apple-system,BlinkMacSystemFont,Inter,"Helvetica Neue",sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.num{font-variant-numeric:tabular-nums}
.wrap{max-width:1200px;margin:0 auto;padding:24px;position:relative;z-index:1}
.aurora{position:fixed;inset:-22% 0 auto 0;height:480px;z-index:0;pointer-events:none;background:radial-gradient(60% 120% at 50% 0%, transparent 40%, rgba(255,120,40,.45) 47%, rgba(255,60,120,.4) 55%, rgba(120,90,255,.36) 63%, rgba(70,170,255,.32) 71%, transparent 80%);filter:blur(40px);opacity:.42;transform:scaleY(.7)}
header{display:flex;align-items:center;gap:14px;justify-content:space-between;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:40px;height:40px;border-radius:11px;background:#1E1E20;border:1px solid #34343a;display:grid;place-items:center;color:#fff;font-weight:800;font-size:15px;letter-spacing:-.02em}
h1{font-size:19px;margin:0;font-weight:680;letter-spacing:-.01em}
.sub{color:var(--mut);font-size:12.5px}
nav{display:flex;gap:4px;margin:20px 0 6px;flex-wrap:wrap;border-bottom:1px solid var(--line)}
.tab{padding:9px 14px;border-radius:10px 10px 0 0;color:var(--mut);font-size:13.5px;text-decoration:none;border:1px solid transparent;border-bottom:none}
.tab.on{color:var(--txt);background:var(--surface);border-color:var(--line)}
.tab.soon{opacity:.45}
.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:16px 0}
.chips{display:flex;gap:6px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:4px}
.chip{padding:6px 13px;border-radius:999px;color:var(--mut);font-size:13px;cursor:pointer;border:0;background:transparent;font:inherit}
.chip.on{background:var(--raised);color:var(--txt)}
.btn{padding:7px 13px;border-radius:var(--r-ctl);border:1px solid var(--line);background:var(--surface);color:var(--txt);font:inherit;cursor:pointer;font-size:13px}
.btn.on{border-color:var(--brand);color:#fff}
.dates{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:var(--mut);font-size:12.5px}
input[type=date],select{background:var(--surface);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:6px 8px;font:inherit;font-size:12.5px;color-scheme:dark}
input[type=search]{background:var(--surface);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:6px 10px;font:inherit;font-size:12.5px;color-scheme:dark;min-width:230px}
th.sortable{cursor:pointer;user-select:none}th.sortable:hover{color:var(--txt)}.sc{color:var(--warn);font-weight:700}
.na{color:var(--mut)}
.tag{display:inline-block;padding:4px 11px;border-radius:999px;background:var(--surface);border:1px solid var(--line);color:var(--mut);font-size:11.5px;font-weight:500}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.09em;color:var(--mut);margin:30px 0 13px;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:13px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-card);padding:var(--pad);position:relative;overflow:hidden}
.kpi .lab{color:var(--mut);font-size:12px}.kpi .val{font-size:26px;font-weight:680;margin-top:6px;letter-spacing:-.02em}.kpi .d{font-size:12.5px;margin-top:5px}
.up{color:var(--good)}.down{color:var(--bad)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:13px}@media(max-width:820px){.two{grid-template-columns:1fr}}
.pill{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:700}
.matrix{display:grid;grid-template-columns:30px repeat(3,1fr);gap:6px}
.mcell{border-radius:9px;padding:10px;min-height:62px;border:1px solid var(--line)}.mcell .c{font-size:18px;font-weight:680}.mcell .r{font-size:11px;opacity:.8}
.maxis{color:var(--mut);font-size:11px;display:grid;place-items:center}
table{width:100%;border-collapse:collapse}
th,td{padding:10px 12px;border-bottom:1px solid var(--line);font-size:13px;text-align:left}
th{color:var(--mut);font-weight:500;font-size:12px}
td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}
tr.line-row{cursor:pointer}tr.line-row:hover{background:var(--raised)}
tr.sku-row td{background:#121214;font-size:12.5px;color:var(--mut)}tr.sku-row .nm{color:var(--txt)}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:9px;vertical-align:middle}
.b-A{background:rgba(52,211,153,.16);color:var(--good)}.b-B{background:rgba(106,168,255,.16);color:var(--info)}.b-C{background:rgba(138,138,144,.18);color:#a8a8ad}
.b-X{background:rgba(52,211,153,.16);color:var(--good)}.b-Y{background:rgba(242,181,68,.16);color:var(--warn)}.b-Z{background:rgba(255,90,95,.16);color:var(--bad)}
.note{color:var(--mut);font-size:12px;margin-top:9px}
.caret{display:inline-block;width:14px;color:var(--mut);transition:transform .15s}.open .caret{transform:rotate(90deg)}
.funnel-row{display:grid;grid-template-columns:130px 1fr 150px;align-items:center;gap:12px;margin:8px 0}
.funnel-bar{height:34px;border-radius:8px;background:linear-gradient(90deg,#FF4438,#b5392f);display:flex;align-items:center;padding-left:12px;color:#fff;font-weight:680;font-size:14px;min-width:46px}
.funnel-conv{color:var(--mut);font-size:12px}
footer{margin-top:36px;border-top:1px solid var(--line);padding-top:14px;color:var(--mut);font-size:12px}
.tscroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.lnk{color:var(--mut);text-decoration:none;font-size:12px}.lnk:hover{color:var(--brand)}
.wgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-bottom:14px}
@media(max-width:760px){
.wrap{padding:14px}:root{--pad:16px}
.grid{grid-template-columns:1fr 1fr}
.kpi .val{font-size:21px}
h1{font-size:16px}
.tscroll table{min-width:620px}
th,td{white-space:nowrap;padding:8px 10px}
.funnel-row{grid-template-columns:84px 1fr 96px}
.wgrid{grid-template-columns:1fr 1fr}
}
`;

const NAV: Array<[string, string, string]> = [
  ["Обзор", "obzor.html", "Обзор"],
  ["Товары", "tovary.html", "Товары"],
  ["Воронка", "voronka.html", "Воронка"],
  ["Маркетинг и цена", "marketing.html", "Маркетинг и цена"],
  ["Кампании", "campaigns.html", "Кампании"],
  ["Карточки", "cards.html", "Карточки"],
  ["Деньги", "money.html", "Деньги"],
  ["Ассистент", "assistant.html", "Ассистент"],
];

// Общий движок: данные + витрины + период/сравнение. draw(cur,cmp) определяет страница.
const ENGINE = `
const F=DATA.facts, SK=DATA.skus, MAX=DATA.max, FLOOR=DATA.floor, TX=DATA.tax||{}, CG=DATA.cogs||{}, TXS=DATA.txsku||{}, OFF=DATA.offers||{};
const ozUrl=s=>'https://www.ozon.ru/product/'+s;
const cabUrl=s=>OFF[s]?'https://seller.ozon.ru/app/products?search='+encodeURIComponent(OFF[s]):null;
const skuLinks=s=>' <a class="lnk" target="_blank" rel="noopener" title="публичная карточка OZON" href="'+ozUrl(s)+'">&#8599;</a>'+(cabUrl(s)?' <a class="lnk" target="_blank" rel="noopener" title="поиск по артикулу в кабинете продавца" href="'+cabUrl(s)+'">&#9881;</a>':'');
const catOf=s=>TX[s]?TX[s][0]:'', subOf=s=>TX[s]?TX[s][1]:'', modelOf=s=>TX[s]?TX[s][3]:SK[s][1];
const cogsOf=s=>CG[s]||0;
const txTake=s=>{const t=TXS[s];return (t&&t.accruals>0)?Math.round(t.amount/t.accruals*1000)/10:null;};
const rub=n=>new Intl.NumberFormat('ru-RU').format(Math.round(n));
const mln=n=>(Math.abs(n)>=1e6?(n/1e6).toFixed(2)+' М':rub(n));
const pct=p=>(p>=0?'+':'')+(Math.round(p*1000)/10)+'%';
function ad(s,n){const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function between(a,b){const o=[];let d=a;while(d<=b){o.push(d);d=ad(d,1);}return o;}
function win(from,to){return F.filter(f=>f[0]>=from&&f[0]<=to);}
function aggSku(rows){const m=new Map();for(const f of rows){let a=m.get(f[1]);if(!a){a={sku:f[1],rev:0,units:0,views:0,cart:0,deliv:0,ret:0,canc:0};m.set(f[1],a);}a.rev+=f[2];a.units+=f[3];a.views+=f[4];a.cart+=f[5];a.deliv+=f[6];a.ret+=f[7];a.canc+=f[8];}return m;}
function aggLine(rows){const m=new Map();for(const f of rows){const ln=SK[f[1]][1];let a=m.get(ln);if(!a){a={line:ln,rev:0,units:0};m.set(ln,a);}a.rev+=f[2];a.units+=f[3];}return m;}
function totals(rows){let rev=0,units=0,views=0,cart=0,deliv=0,ret=0,canc=0;const sk=new Set();for(const f of rows){rev+=f[2];units+=f[3];views+=f[4];cart+=f[5];deliv+=f[6];ret+=f[7];canc+=f[8];if(f[3]>0)sk.add(f[1]);}return{rev,units,views,cart,deliv,ret,canc,sku:sk.size};}
function abc(items){const s=[...items].sort((a,b)=>b.rev-a.rev);const tot=s.reduce((x,y)=>x+y.rev,0)||1;const o=new Map();let c=0;for(const it of s){c+=it.rev;const sh=c/tot;o.set(it.key,sh<=.8?'A':sh<=.95?'B':'C');}return o;}
function xyz(rows,from,to){const ds=between(from,to);const byk=new Map();for(const f of rows){let d=byk.get(f[1]);if(!d){d=new Map();byk.set(f[1],d);}d.set(f[0],(d.get(f[0])||0)+f[3]);}const o=new Map();for(const[k,dm]of byk){const ser=ds.map(x=>dm.get(x)||0);const mean=ser.reduce((a,b)=>a+b,0)/ser.length;const v=ser.reduce((a,b)=>a+(b-mean)*(b-mean),0)/ser.length;const cv=mean===0?Infinity:Math.sqrt(v)/mean;o.set(k,cv<=.5?'X':cv<=1?'Y':'Z');}return o;}
function skuViews(from,to){const rows=win(from,to);const ag=aggSku(rows);const items=[...ag.values()].map(a=>({key:a.sku,rev:a.rev}));const aM=abc(items),xM=xyz(rows,from,to);const tot=items.reduce((s,x)=>s+x.rev,0)||1;return [...ag.values()].map(a=>({sku:a.sku,name:SK[a.sku][0],line:SK[a.sku][1],rev:a.rev,units:a.units,views:a.views,ret:a.ret,abc:aM.get(a.sku),xyz:xM.get(a.sku),conv:Math.round((a.views?a.units/a.views:0)*1000)/10,aov:Math.round(a.units?a.rev/a.units:0),share:Math.round(a.rev/tot*1000)/10})).sort((a,b)=>b.rev-a.rev);}
function matrix(views){const c={};for(const a of['A','B','C'])for(const x of['X','Y','Z'])c[a+x]={count:0,rev:0};for(const v of views){const k=c[v.abc+v.xyz];k.count++;k.rev+=v.rev;}return c;}
function bcg(cf,ct,pf,pt){const a=aggLine(win(cf,ct)),b=aggLine(win(pf,pt));const tot=[...a.values()].reduce((s,x)=>s+x.rev,0)||1;const sh=[...a.values()].map(x=>x.rev/tot).sort((p,q)=>p-q);const med=sh.length?sh[Math.floor(sh.length/2)]:0;return [...a.values()].map(la=>{const prev=(b.get(la.line)||{rev:0}).rev;const g=prev?(la.rev-prev)/prev:0;const s=la.rev/tot;const q=(s>=med&&g>=0)?'star':s>=med?'cow':g>=0?'question':'dog';return{line:la.line,rev:la.rev,share:Math.round(s*1000)/10,growth:Math.round(g*1000)/10,quadrant:q};}).sort((x,y)=>y.rev-x.rev);}
function linesGrowth(cf,ct,pf,pt){const a=aggLine(win(cf,ct)),b=aggLine(win(pf,pt));return [...a.values()].map(la=>{const prev=(b.get(la.line)||{rev:0}).rev;const g=prev?(la.rev-prev)/prev:(la.rev>0?1:0);return{line:la.line,rev:la.rev,prev,growth:g};});}
function heatmap(){const ms=new Set(),lm=new Map();for(const f of F){const mo=f[0].slice(0,7);ms.add(mo);const ln=SK[f[1]][1];let bm=lm.get(ln);if(!bm){bm={};lm.set(ln,bm);}bm[mo]=(bm[mo]||0)+f[3];}const months=[...ms].sort();const lines=[...lm.entries()].map(([line,byMonth])=>({line,byMonth,total:Object.values(byMonth).reduce((a,b)=>a+b,0)})).sort((a,b)=>b.total-a.total);return{months,lines};}
function dailyRev(from,to){const ds=between(from,to);const m=new Map();for(const f of F)if(f[0]>=from&&f[0]<=to){const e=m.get(f[0])||{rev:0,units:0};e.rev+=f[2];e.units+=f[3];m.set(f[0],e);}return ds.map(d=>({date:d,rev:(m.get(d)||{}).rev||0,units:(m.get(d)||{}).units||0}));}
function series(sku,from,to){const ds=between(from,to);const m=new Map();for(const f of F)if(f[1]===sku&&f[0]>=from&&f[0]<=to)m.set(f[0],(m.get(f[0])||0)+f[3]);return ds.map(d=>m.get(d)||0);}
function prevEqual(from,to){const len=between(from,to).length;const pt=ad(from,-1);let pf=ad(pt,-(len-1)),clip=false;if(pf<FLOOR){pf=FLOOR;clip=true;}return{from:pf,to:pt,clip};}
function periodFor(kind){const to=MAX;let from;if(kind==='7')from=ad(to,-6);else if(kind==='30')from=ad(to,-29);else if(kind==='90')from=ad(to,-89);else from=FLOOR;if(from<FLOOR)from=FLOOR;return{from,to};}
function areaSvg(vals,stroke){const w=460,h=150,max=Math.max(1,...vals),n=vals.length,st=w/Math.max(1,n-1);const pts=vals.map((v,i)=>(i*st).toFixed(1)+','+(h-(v/max)*(h-14)).toFixed(1));const line='M'+pts.join(' L');const area=line+' L'+w+','+h+' L0,'+h+' Z';return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="150" preserveAspectRatio="none"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+stroke+'" stop-opacity=".30"/><stop offset="1" stop-color="'+stroke+'" stop-opacity="0"/></linearGradient></defs><path d="'+area+'" fill="url(#ag)"/><path d="'+line+'" fill="none" stroke="'+stroke+'" stroke-width="2.2"/></svg>';}
let state={kind:'30',cur:null,cmp:null,compare:false};
function swap(w){if(w&&w.from&&w.to&&w.from>w.to){const t=w.from;w.from=w.to;w.to=t;}return w;}
function apply(){let cur,cmp;if(state.kind==='custom')cur=swap({from:document.getElementById('cf').value,to:document.getElementById('ct').value});else cur=periodFor(state.kind);if(!cur.from||!cur.to){document.getElementById('period').textContent='укажите обе даты периода';return;}if(state.compare){cmp=swap({from:document.getElementById('pf').value,to:document.getElementById('pt').value});if(!cmp.from||!cmp.to)cmp=prevEqual(cur.from,cur.to);}else cmp=prevEqual(cur.from,cur.to);state.cur=cur;state.cmp=cmp;document.getElementById('period').textContent=cur.from+'..'+cur.to+'  против  '+cmp.from+'..'+cmp.to+(cmp.clip?' · неполная база сравнения (обрезана началом истории '+FLOOR+')':'');draw(cur,cmp);}
function initControls(){const cr=document.getElementById('customRow'),cm=document.getElementById('cmpRow');document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{document.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));c.classList.add('on');state.kind=c.dataset.k;if(cr)cr.style.display=state.kind==='custom'?'flex':'none';apply();}));document.getElementById('cmpBtn').addEventListener('click',()=>{state.compare=!state.compare;document.getElementById('cmpBtn').classList.toggle('on',state.compare);if(cm)cm.style.display=state.compare?'flex':'none';if(state.compare){const pe=prevEqual(state.cur.from,state.cur.to);document.getElementById('pf').value=pe.from;document.getElementById('pt').value=pe.to;}apply();});const ac=document.getElementById('applyCustom');if(ac)ac.addEventListener('click',apply);const am=document.getElementById('applyCmp');if(am)am.addEventListener('click',apply);const c30=periodFor('30');if(document.getElementById('cf')){document.getElementById('cf').value=c30.from;document.getElementById('ct').value=c30.to;}}
function kpiCard(lab,cur,prev,goodUp,fmt){if(!prev){return '<div class="card kpi"><div class="lab">'+lab+'</div><div class="val num">'+fmt(cur)+'</div><div class="d sub">нет базы сравнения</div></div>';}const d=(cur-prev)/prev;const up=d>=0,good=goodUp?up:!up;return '<div class="card kpi"><div class="lab">'+lab+'</div><div class="val num">'+fmt(cur)+'</div><div class="d '+(good?'up':'down')+'">'+(up?'▲':'▼')+' '+pct(d)+'</div></div>';}
function boot(staticFn){if(staticFn)staticFn();const dq=document.getElementById('dq');if(dq){const fr=DATA.fresh||{};dq.textContent='история по '+MAX+' (слой T-1)'+(fr.partial?' · последний день может быть неполным - сравнение занижает текущий период':'');}initControls();apply();}
`;

const CONTROLS = `
  <div class="controls">
    <div class="chips">
      <button class="chip" data-k="7">7д</button>
      <button class="chip on" data-k="30">30д</button>
      <button class="chip" data-k="90">90д</button>
      <button class="chip" data-k="all">Всё</button>
      <button class="chip" data-k="custom">Свой</button>
    </div>
    <button class="btn" id="cmpBtn">Сравнить период</button>
  </div>
  <div class="controls dates" id="customRow" style="display:none">период: <input type="date" id="cf"> .. <input type="date" id="ct"> <button class="btn" id="applyCustom">Применить</button></div>
  <div class="controls dates" id="cmpRow" style="display:none">сравнить с: <input type="date" id="pf"> .. <input type="date" id="pt"> <button class="btn" id="applyCmp">Применить</button></div>
`;

function shell(active: string, sections: string, pageJs: string, dataJson: string, footer: string): string {
  const nav = NAV.map(([t, href, key]) => {
    const cls = key === active ? "tab on" : href === "#" ? "tab soon" : "tab";
    const suffix = href === "#" ? " ·" : "";
    return `<a class="${cls}" href="${href}">${t}${suffix}</a>`;
  }).join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GENGLASS · ${active}</title><style>${DS_CSS}</style></head>
<body><div class="aurora"></div><div class="wrap">
  <header><div class="brand"><div class="logo">GG</div>
    <div><h1>GENGLASS · аналитика OZON</h1><div class="sub" id="period"></div></div></div>
    <span class="tag">оперативный слой T-1</span></header>
  <nav>${nav}</nav>
  ${CONTROLS}
  <div class="note" id="dq"></div>
  ${sections}
  <footer>${footer}</footer>
</div>
<script>const DATA=${dataJson};
${ENGINE}
${pageJs}
</script></body></html>`;
}

const FOOT_OPS = `Все цифры - <b>[ДАННЫЕ]</b> из дневной истории OZON (оперативный слой T-1). Период и сравнение считаются в браузере. Маржа/P&L - после коннектора транзакций (Фаза 2).`;

// Статичная страница-снимок (реклама/цены - их нет в дневной истории, показываем
// фиксированное окно без интерактивного пересчёта).
export function staticPage(active: string, periodLabel: string, sections: string, footer: string): string {
  const nav = NAV.map(([t, href, key]) => {
    const cls = key === active ? "tab on" : href === "#" ? "tab soon" : "tab";
    return `<a class="${cls}" href="${href}">${t}${href === "#" ? " ·" : ""}</a>`;
  }).join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GENGLASS · ${active}</title><style>${DS_CSS}</style></head>
<body><div class="aurora"></div><div class="wrap">
  <header><div class="brand"><div class="logo">GG</div>
    <div><h1>GENGLASS · аналитика OZON</h1><div class="sub">${periodLabel}</div></div></div>
    <span class="tag">оперативный слой · снимок</span></header>
  <nav>${nav}</nav>
  ${sections}
  <footer>${footer}</footer>
</div></body></html>`;
}

// ---------------- Товары ----------------
export function renderTovary(model: unknown): string {
  const sections = `
  <h2>Срез периода</h2><div class="grid" id="kpis"></div>
  <div class="two">
    <div><h2>ABC × XYZ матрица</h2><div class="card"><div class="matrix" id="matrix"></div>
      <div class="note">строки - вклад в оборот (A/B/C), столбцы - стабильность спроса (X ровный · Y переменный · Z рваный). Лево-верх = опора, право-низ = случайные.</div></div></div>
    <div><h2>BCG по линиям (рост × доля)</h2><div class="card"><svg id="bcg" viewBox="0 0 460 260" width="100%" height="260"></svg></div></div>
  </div>
  <h2>Хитмап заказов · линия × месяц (вся история)</h2><div class="card" style="padding:0"><div class="tscroll" id="heatcard"></div></div>
  <h2>Товары · группировка по модели</h2>
  <div class="controls dates"><input id="qTov" type="search" placeholder="поиск: модель, артикул, SKU" autocomplete="off"><select id="fCat"></select><select id="fSub"></select><select id="fLine"></select><span class="sub" id="found"></span></div>
  <div class="card" style="padding:0"><div class="tscroll"><table><thead><tr id="tovHead">
    <th>Модель / SKU</th><th class="r sortable" data-s="rev">Оборот<span class="sc"></span></th><th class="r sortable" data-s="share">Доля<span class="sc"></span></th><th class="r sortable" data-s="units">Заказы<span class="sc"></span></th><th class="r">Ср.чек</th><th class="r sortable" data-s="margin">Маржа вал.<span class="sc"></span></th><th class="r sortable" data-s="after">После сборов<span class="sc"></span></th><th class="r">ABC·XYZ</th>
  </tr></thead><tbody id="rows"></tbody></table></div></div>
  <div class="note">клик по модели раскрывает SKU и дневной тренд; &#8599; - публичная карточка OZON, &#9881; - поиск по артикулу в кабинете продавца (где артикул известен). На телефоне таблица скроллится горизонтально. <b>Маржа вал.</b> = (выручка-С\\С)/выручка, реагирует на период (покрытие С\\С зависит от периода - см. карточку «Валовая маржа»). <b>После сборов</b> = к начислению / выручка начисленная по транзакциям: после комиссии и услуг операции; НЕ включает канальную логистику/эквайринг, поэтому выше полного М3 на странице Деньги. Снимок 30 дней (не пересчитывается под период). Покрытие: валовая маржа - 143 SKU (С\\С), после сборов - 172 SKU (транзакции); комплектные продажи не разнесены.</div>`;
  const js = `
function drawHeat(){const hm=heatmap();const maxU=Math.max(1,...hm.lines.flatMap(l=>Object.values(l.byMonth)));const shade=u=>{if(!u)return '#141416';const t=u/maxU,r=Math.round(40+t*215),g=Math.round(24+t*44),b=Math.round(22+t*26);return 'rgb('+r+','+g+','+b+')';};let h='<table><thead><tr><th>Линия</th>'+hm.months.map(m=>'<th class="r">'+m.slice(5)+'.'+m.slice(2,4)+'</th>').join('')+'<th class="r">Итого</th></tr></thead><tbody>';hm.lines.forEach(l=>{h+='<tr><td>'+l.line+'</td>'+hm.months.map(m=>{const u=l.byMonth[m]||0;return '<td class="r" style="background:'+shade(u)+';color:'+(u>maxU*0.4?'#0A0A0B':'#F5F5F6')+';font-weight:600;border-radius:6px">'+(u||'')+'</td>';}).join('')+'<td class="r num"><b>'+l.total+'</b></td></tr>';});document.getElementById('heatcard').innerHTML=h+'</tbody></table>';}
function draw(cur,cmp){
  const tc=totals(win(cur.from,cur.to)),tp=totals(win(cmp.from,cmp.to));
  const cro=c=>Math.round((c.views?c.units/c.views:0)*1000)/10,aov=c=>Math.round(c.units?c.rev/c.units:0);
  const views=skuViews(cur.from,cur.to),mx=matrix(views),cls=['A','B','C'],xs=['X','Y','Z'];
  let gCur=0,rCov=0,rAll=0;for(const v of views){rAll+=v.rev;const c=cogsOf(v.sku);if(c>0){gCur+=v.rev-c*v.units;rCov+=v.rev;}}
  const gmPct=rCov>0?Math.round(gCur/rCov*1000)/10:0,covPct=Math.round(rCov/(rAll||1)*100);
  const marginCard='<div class="card kpi"><div class="lab">Валовая маржа, % <span class="pill b-Y">по С\\\\С</span></div><div class="val num">'+gmPct+'%</div><div class="d" style="color:'+(covPct<80?'#F2B544':'#34D399')+'">покрытие С\\\\С: '+covPct+'% оборота</div><div class="d sub">остальные '+(100-covPct)+'% без С\\\\С - не экстраполировать</div></div>';
  document.getElementById('kpis').innerHTML=[kpiCard('Оборот, ₽',tc.rev,tp.rev,true,mln),kpiCard('Заказы',tc.units,tp.units,true,rub),marginCard,kpiCard('Средний чек, ₽',aov(tc),aov(tp),true,rub),kpiCard('Возвраты',tc.ret,tp.ret,false,rub),kpiCard('SKU с продажами',tc.sku,tp.sku,true,rub)].join('');
  const col=(a,x)=>{const s=(a==='A'?0:a==='B'?1:2)+(x==='X'?0:x==='Y'?1:2);return ['#173b2c','#1d4636','#3a3f1e','#46361e','#4a2a1e','#4a221f'][Math.min(s,5)];};
  let mh='<div class="maxis"></div>'+xs.map(x=>'<div class="maxis">'+x+'</div>').join('');cls.forEach(a=>{mh+='<div class="maxis">'+a+'</div>';xs.forEach(x=>{const c=mx[a+x];mh+='<div class="mcell" style="background:'+col(a,x)+'"><div class="c">'+c.count+'</div><div class="r num">'+mln(c.rev)+' ₽</div></div>';});});document.getElementById('matrix').innerHTML=mh;
  const bc=bcg(cur.from,cur.to,cmp.from,cmp.to),W=460,H=260,pad=34,maxShare=Math.max(10,...bc.map(d=>d.share)),gmax=Math.max(20,...bc.map(d=>Math.abs(d.growth))),X=s=>pad+(s/maxShare)*(W-pad-10),Y=g=>H/2-(g/gmax)*(H/2-20),qc={star:'#34D399',cow:'#6AA8FF',question:'#F2B544',dog:'#FF5A5F'};
  let bs='<line x1="'+pad+'" y1="'+(H/2)+'" x2="'+W+'" y2="'+(H/2)+'" stroke="#2A2A2D"/><line x1="'+X(maxShare/2)+'" y1="6" x2="'+X(maxShare/2)+'" y2="'+(H-6)+'" stroke="#2A2A2D"/><text x="'+(W-6)+'" y="'+(H/2-6)+'" fill="#5E5E64" font-size="10" text-anchor="end">доля →</text><text x="'+(pad+4)+'" y="14" fill="#5E5E64" font-size="10">рост ↑</text>';bc.forEach(d=>{const cx=X(d.share),cy=Y(d.growth),r=Math.max(6,Math.min(26,Math.sqrt(d.rev)/120));bs+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+qc[d.quadrant]+'" fill-opacity="0.35" stroke="'+qc[d.quadrant]+'"/><text x="'+cx+'" y="'+(cy-r-3)+'" fill="#F5F5F6" font-size="10" text-anchor="middle">'+d.line+'</text>';});document.getElementById('bcg').innerHTML=bs;
  if(!window._fInit){initFilters();window._fInit=true;}
  const fc=document.getElementById('fCat').value,fs=document.getElementById('fSub').value,fl=document.getElementById('fLine').value;
  const fv=views.filter(v=>(!fc||catOf(v.sku)===fc)&&(!fs||subOf(v.sku)===fs)&&(!fl||(TX[v.sku]?TX[v.sku][2]:v.line)===fl));
  const totRev=fv.reduce((s,v)=>s+v.rev,0)||1;
  const lm=new Map();for(const v of fv){const mk=modelOf(v.sku);let a=lm.get(mk);if(!a){a=[];lm.set(mk,a);}a.push(v);}
  let groups=[...lm.entries()].map(([model,sk])=>{let mg=0,mr=0,ta=0,tac=0;sk.forEach(s=>{const c=cogsOf(s.sku);if(c>0){mg+=s.rev-c*s.units;mr+=s.rev;}const t=TXS[s.sku];if(t&&t.accruals>0){ta+=t.amount;tac+=t.accruals;}});const rev=sk.reduce((s,v)=>s+v.rev,0),units=sk.reduce((s,v)=>s+v.units,0);return{model,sk,rev,units,share:Math.round(rev/totRev*1000)/10,margin:mr>0?Math.round(mg/mr*1000)/10:null,after:tac>0?Math.round(ta/tac*1000)/10:null};});
  const q=(window._tovQ||'').trim().toLowerCase();
  if(q)groups=groups.filter(g=>g.model.toLowerCase().indexOf(q)>=0||g.sk.some(s=>(s.name||'').toLowerCase().indexOf(q)>=0||(OFF[s.sku]||'').toLowerCase().indexOf(q)>=0||String(s.sku).indexOf(q)>=0));
  const so=window._tovSort||{col:'rev',dir:-1},nv=v=>v==null?-Infinity:v;groups.sort((a,b)=>(nv(a[so.col])-nv(b[so.col]))*so.dir);
  document.querySelectorAll('#tovHead .sortable').forEach(th=>{const sc=th.querySelector('.sc');if(sc)sc.textContent=th.dataset.s===so.col?(so.dir<0?' ▾':' ▴'):'';});
  document.getElementById('found').textContent='моделей '+groups.length+' · SKU '+groups.reduce((s,g)=>s+g.sk.length,0)+(q?' · фильтр «'+q+'»':'');
  const spark=ser=>{const w=120,h=26,mx=Math.max(1,...ser),st=w/Math.max(1,ser.length-1);const p=ser.map((v,i)=>i*st+','+(h-(v/mx)*(h-3))).join(' ');return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"><polyline fill="none" stroke="#FF4438" stroke-width="1.6" points="'+p+'"/></svg>';};
  const bg=(t,c)=>'<span class="pill b-'+c+'">'+t+'</span>',na='<span class="na">н/д</span>';let rh='';
  if(!groups.length)rh='<tr><td colspan="8" class="note">ничего не найдено'+(q?' по запросу «'+q+'»':'')+'</td></tr>';
  groups.forEach((g,li)=>{const mm=g.margin!=null?g.margin+'%':na,tm=g.after!=null?g.after+'%':na;
    rh+='<tr class="line-row" data-li="'+li+'"><td><span class="caret">▸</span><span class="dot" style="background:#FF4438"></span><b>'+g.model+'</b> <span class="sub">'+g.sk.length+' SKU</span></td><td class="r num">'+mln(g.rev)+'</td><td class="r num">'+g.share+'%</td><td class="r num">'+rub(g.units)+'</td><td class="r"></td><td class="r num">'+mm+'</td><td class="r num">'+tm+'</td><td class="r"></td></tr>';
    g.sk.forEach(s=>{const c=cogsOf(s.sku);const sm=(c>0&&s.rev>0)?(Math.round((s.rev-c*s.units)/s.rev*1000)/10)+'%':na;const cTxt=c>0?'С\\\\С '+rub(c)+' ₽':'нет С\\\\С';const tt=txTake(s.sku);
      rh+='<tr class="sku-row" data-li="'+li+'" style="display:none"><td class="nm">'+s.name+skuLinks(s.sku)+'</td><td class="r num">'+mln(s.rev)+'</td><td class="r num">'+s.share+'%</td><td class="r num">'+rub(s.units)+'</td><td class="r num">'+rub(s.aov)+'</td><td class="r num" title="'+cTxt+'">'+sm+'</td><td class="r num">'+(tt!=null?tt+'%':na)+'</td><td class="r">'+bg(s.abc,s.abc)+' '+bg(s.xyz,s.xyz)+'</td></tr>';
      rh+='<tr class="sku-row" data-li="'+li+'" style="display:none"><td colspan="9" style="padding-top:0"><span class="sub">'+cTxt+' · тренд заказов по дням: </span>'+spark(series(s.sku,cur.from,cur.to))+'</td></tr>';});});
  document.getElementById('rows').innerHTML=rh;document.querySelectorAll('.line-row').forEach(tr=>tr.addEventListener('click',()=>{const li=tr.dataset.li;tr.classList.toggle('open');document.querySelectorAll('.sku-row[data-li="'+li+'"]').forEach(r=>{r.style.display=r.style.display==='none'?'table-row':'none';});}));
}
function initFilters(){
  const cats=new Set(),subs=new Set(),lines=new Set();
  for(const k in TX){cats.add(TX[k][0]);subs.add(TX[k][1]);lines.add(TX[k][2]);}
  const fill=(id,vals,label)=>{const el=document.getElementById(id);el.innerHTML='<option value="">'+label+'</option>'+[...vals].filter(Boolean).sort().map(v=>'<option>'+v+'</option>').join('');el.addEventListener('change',()=>draw(state.cur,state.cmp));};
  fill('fCat',cats,'Все категории');fill('fSub',subs,'Все подкатегории');fill('fLine',lines,'Все линии');
  const qi=document.getElementById('qTov');if(qi)qi.addEventListener('input',()=>{window._tovQ=qi.value;draw(state.cur,state.cmp);});
  document.querySelectorAll('#tovHead .sortable').forEach(th=>th.addEventListener('click',()=>{const col=th.dataset.s,cur=window._tovSort||{col:'rev',dir:-1};window._tovSort=(cur.col===col)?{col,dir:-cur.dir}:{col,dir:-1};draw(state.cur,state.cmp);}));
}
boot(drawHeat);`;
  return shell("Товары", sections, js, JSON.stringify(model), FOOT_OPS + " Группировка по линии (модель-уровень - после джойна offer_id с таксономией).");
}

// ---------------- Обзор ----------------
export function renderOverview(model: unknown): string {
  const sections = `
  <h2>Срез периода</h2><div class="grid" id="kpis"></div>
  <h2>Риск out-of-stock · остаток 0 при живых продажах <span class="pill b-Z">снимок 30д</span></h2>
  <div class="card" style="padding:0"><div class="tscroll" id="oos"></div></div>
  <div class="note" id="oosNote"></div>
  <div class="two">
    <div><h2>Оборот по дням</h2><div class="card"><div id="trend"></div><div class="note" id="trendNote"></div></div></div>
    <div><h2>Движения по линиям (рост к пред. периоду)</h2><div class="card" style="padding:0"><div class="tscroll" id="movers"></div></div></div>
  </div>
  <h2>Оборот по линиям за период</h2><div class="card" id="lineBars"></div>`;
  const js = `
function draw(cur,cmp){
  const tc=totals(win(cur.from,cur.to)),tp=totals(win(cmp.from,cmp.to));
  const cro=c=>Math.round((c.views?c.units/c.views:0)*1000)/10,aov=c=>Math.round(c.units?c.rev/c.units:0);
  const views=skuViews(cur.from,cur.to);let gC=0,rCov=0;const vbl={};for(const v of views){const c=cogsOf(v.sku);if(c>0){gC+=v.rev-c*v.units;rCov+=v.rev;let e=vbl[v.line];if(!e){e={g:0,rc:0};vbl[v.line]=e;}e.g+=v.rev-c*v.units;e.rc+=v.rev;}}
  const gm=rCov>0?Math.round(gC/rCov*1000)/10:0,cov=Math.round(rCov/(tc.rev||1)*100);
  const marginCard='<div class="card kpi"><div class="lab">Валовая маржа, % <span class="pill b-Y">по С\\\\С</span></div><div class="val num">'+gm+'%</div><div class="d" style="color:'+(cov<80?'#F2B544':'#34D399')+'">покрытие С\\\\С: '+cov+'% оборота</div><div class="d sub">остальные '+(100-cov)+'% без С\\\\С - не экстраполировать</div></div>';
  document.getElementById('kpis').innerHTML=[kpiCard('Оборот, ₽',tc.rev,tp.rev,true,mln),kpiCard('Заказы',tc.units,tp.units,true,rub),marginCard,kpiCard('Средний чек, ₽',aov(tc),aov(tp),true,rub),kpiCard('CR показ-заказ, %',cro(tc),cro(tp),true,v=>v),kpiCard('SKU с продажами',tc.sku,tp.sku,true,rub)].join('');
  const dr=dailyRev(cur.from,cur.to);document.getElementById('trend').innerHTML=areaSvg(dr.map(d=>d.rev),tc.rev>=tp.rev?'#34D399':'#FF4438');
  document.getElementById('trendNote').textContent='с '+cur.from+' по '+cur.to+(dr.length?' · пик дня '+mln(Math.max(...dr.map(d=>d.rev)))+' ₽':' · нет данных');
  const lmarg=l=>vbl[l]&&vbl[l].rc>0?(Math.round(vbl[l].g/vbl[l].rc*1000)/10)+'%':'-';
  const lg=linesGrowth(cur.from,cur.to,cmp.from,cmp.to).sort((a,b)=>b.growth-a.growth);
  let mh='<table><thead><tr><th>Линия</th><th class="r">Оборот</th><th class="r">Рост</th><th class="r">Маржа</th></tr></thead><tbody>';lg.forEach(d=>{const up=d.growth>=0;mh+='<tr><td>'+d.line+'</td><td class="r num">'+mln(d.rev)+'</td><td class="r '+(up?'up':'down')+'">'+pct(d.growth)+'</td><td class="r num">'+lmarg(d.line)+'</td></tr>';});mh+='</tbody></table>';document.getElementById('movers').innerHTML=mh;
  const a=aggLine(win(cur.from,cur.to));const arr=[...a.values()].sort((x,y)=>y.rev-x.rev);const max=Math.max(1,...arr.map(x=>x.rev));let lb='';arr.forEach(x=>{lb+='<div style="display:grid;grid-template-columns:120px 1fr 90px;align-items:center;gap:10px;margin:7px 0"><div class="sub">'+x.line+'</div><div style="background:#1E1E20;border-radius:7px;overflow:hidden"><div style="height:22px;width:'+(x.rev/max*100)+'%;background:linear-gradient(90deg,#FF4438,#b5392f);border-radius:7px"></div></div><div class="r num">'+mln(x.rev)+' ₽</div></div>';});document.getElementById('lineBars').innerHTML=lb;
}
function drawOos(){const o=DATA.oos||[];const el=document.getElementById('oos'),nt=document.getElementById('oosNote');
  if(!o.length){el.innerHTML='<div class="note" style="padding:14px">по снимку 30д все продающиеся SKU с остатком - риска нет</div>';nt.textContent='';return;}
  let h='<table><thead><tr><th>Товар</th><th>Линия</th><th class="r">Заказы 30д</th><th class="r">Остаток</th></tr></thead><tbody>';
  o.forEach(x=>{h+='<tr><td>'+x.name+skuLinks(x.sku)+'</td><td class="sub">'+x.line+'</td><td class="r num">'+x.units+'</td><td class="r num down">0 · нет в наличии</td></tr>';});
  el.innerHTML=h+'</tbody></table>';
  nt.textContent='карточка с нулевым остатком выпадает из выдачи OZON за часы, а реклама типа «вывод в топ» может продолжать тратить бюджет. Упущенный оборот не считаем - истории остатков по дням пока нет (поток P1).';}
boot(drawOos);`;
  return shell("Обзор", sections, js, JSON.stringify(model), FOOT_OPS);
}

// ---------------- Воронка ----------------
export function renderFunnel(model: unknown): string {
  const sections = `
  <h2>Срез периода</h2><div class="grid" id="kpis"></div>
  <h2>Воронка: показ → корзина → заказ → доставка</h2>
  <div class="card" id="funnel"></div>
  <h2>Потери</h2><div class="grid" id="leaks"></div>
  <h2>Возвраты по линиям</h2><div class="card" style="padding:0"><div class="tscroll" id="retLines"></div></div>`;
  const js = `
function draw(cur,cmp){
  const tc=totals(win(cur.from,cur.to)),tp=totals(win(cmp.from,cmp.to));
  const cro=c=>Math.round((c.views?c.units/c.views:0)*1000)/10;
  document.getElementById('kpis').innerHTML=[kpiCard('Показы',tc.views,tp.views,true,rub),kpiCard('В корзину',tc.cart,tp.cart,true,rub),kpiCard('Заказы',tc.units,tp.units,true,rub),kpiCard('CR показ-заказ, %',cro(tc),cro(tp),true,v=>v),kpiCard('Возвраты',tc.ret,tp.ret,false,rub),kpiCard('Отмены',tc.canc,tp.canc,false,rub)].join('');
  const stages=[['Показы',tc.views],['В корзину',tc.cart],['Заказы',tc.units],['Доставлено',tc.deliv]];const max=Math.max(1,tc.views);let fh='';stages.forEach((s,i)=>{const w=Math.max(3,s[1]/max*100);const conv=i>0&&stages[i-1][1]>0?Math.round(s[1]/stages[i-1][1]*1000)/10:null;fh+='<div class="funnel-row"><div class="sub">'+s[0]+'</div><div class="funnel-bar" style="width:'+w+'%">'+rub(s[1])+'</div><div class="funnel-conv">'+(conv!==null?'CR к пред.: '+conv+'%':'')+'</div></div>';});document.getElementById('funnel').innerHTML=fh;
  const retRate=tc.units+tc.ret>0?Math.round(tc.ret/(tc.units+tc.ret)*1000)/10:0;const cancRate=tc.units+tc.canc>0?Math.round(tc.canc/(tc.units+tc.canc)*1000)/10:0;const cartDrop=tc.cart>0?Math.round((1-tc.units/tc.cart)*1000)/10:0;
  document.getElementById('leaks').innerHTML=[ '<div class="card kpi"><div class="lab">Возврат, %</div><div class="val num">'+retRate+'%</div></div>','<div class="card kpi"><div class="lab">Отмена, %</div><div class="val num">'+cancRate+'%</div></div>','<div class="card kpi"><div class="lab">Брошено в корзине, %</div><div class="val num">'+cartDrop+'%</div></div>' ].join('');
  // возвраты по линиям
  const a=aggSku(win(cur.from,cur.to));const lm=new Map();for(const v of a.values()){let e=lm.get(SK[v.sku][1]);if(!e){e={line:SK[v.sku][1],ret:0,units:0};lm.set(SK[v.sku][1],e);}e.ret+=v.ret;e.units+=v.units;}
  const arr=[...lm.values()].sort((x,y)=>y.ret-x.ret);let rl='<table><thead><tr><th>Линия</th><th class="r">Заказы</th><th class="r">Возвраты</th><th class="r">Возврат %</th></tr></thead><tbody>';arr.forEach(x=>{const rr=x.units+x.ret>0?Math.round(x.ret/(x.units+x.ret)*1000)/10:0;rl+='<tr><td>'+x.line+'</td><td class="r num">'+rub(x.units)+'</td><td class="r num">'+rub(x.ret)+'</td><td class="r num '+(rr>5?'down':'')+'">'+rr+'%</td></tr>';});document.getElementById('retLines').innerHTML=rl+'</tbody></table>';
}
boot();`;
  return shell("Воронка", sections, js, JSON.stringify(model), FOOT_OPS);
}

// ---------------- Карточки ----------------
export function renderCards(model: unknown): string {
  const sections = `
  <h2>Срез периода</h2><div class="grid" id="kpis"></div>
  <h2>Карточки на ремонт · трафик есть, заказов мало</h2>
  <div class="card" style="padding:0"><div class="tscroll"><table><thead><tr>
    <th>Товар</th><th>Линия</th><th class="r">Показы</th><th class="r">Заказы</th><th class="r">CR заказ</th><th class="r">Оборот</th>
  </tr></thead><tbody id="fix"></tbody></table></div></div>
  <div class="note">кандидаты: показов выше медианы, конверсия в заказ ниже 0,2%. Чинить фото/описание/цену. &#8599; - публичная карточка OZON, &#9881; - поиск по артикулу в кабинете (где артикул известен).</div>
  <h2>Высокие возвраты</h2>
  <div class="card" style="padding:0"><div class="tscroll"><table><thead><tr>
    <th>Товар</th><th>Линия</th><th class="r">Заказы</th><th class="r">Возвраты</th><th class="r">Возврат %</th>
  </tr></thead><tbody id="ret"></tbody></table></div></div>`;
  const js = `
function draw(cur,cmp){
  const v=skuViews(cur.from,cur.to),tc=totals(win(cur.from,cur.to)),tp=totals(win(cmp.from,cmp.to));
  const cro=c=>Math.round((c.views?c.units/c.views:0)*1000)/10;
  const vs=v.map(x=>x.views).sort((a,b)=>a-b),medV=vs[Math.floor(vs.length/2)]||0;
  const fix=v.filter(x=>x.views>=Math.max(3000,medV)&&x.conv<0.2).sort((a,b)=>b.views-a.views).slice(0,25);
  const ret=v.map(x=>({...x,rr:x.units+x.ret>0?Math.round(x.ret/(x.units+x.ret)*1000)/10:0})).filter(x=>x.ret>0).sort((a,b)=>b.rr-a.rr).slice(0,20);
  document.getElementById('kpis').innerHTML=[
    '<div class="card kpi"><div class="lab">Кандидатов на переделку</div><div class="val num">'+fix.length+'</div></div>',
    kpiCard('CR показ-заказ, %',cro(tc),cro(tp),true,x=>x),
    kpiCard('Возвраты, шт',tc.ret,tp.ret,false,rub),
    '<div class="card kpi"><div class="lab">Показов суммарно</div><div class="val num">'+rub(tc.views)+'</div></div>'
  ].join('');
  document.getElementById('fix').innerHTML=fix.length?fix.map(x=>'<tr><td>'+x.name+skuLinks(x.sku)+'</td><td class="sub">'+x.line+'</td><td class="r num">'+rub(x.views)+'</td><td class="r num">'+rub(x.units)+'</td><td class="r num down">'+x.conv+'</td><td class="r num">'+mln(x.rev)+'</td></tr>').join(''):'<tr><td colspan="6" class="note">нет кандидатов в этом периоде</td></tr>';
  document.getElementById('ret').innerHTML=ret.length?ret.map(x=>'<tr><td>'+x.name+skuLinks(x.sku)+'</td><td class="sub">'+x.line+'</td><td class="r num">'+rub(x.units)+'</td><td class="r num">'+rub(x.ret)+'</td><td class="r num '+(x.rr>5?'down':'')+'">'+x.rr+'%</td></tr>').join(''):'<tr><td colspan="5" class="note">возвратов в этом периоде нет</td></tr>';
}
boot();`;
  return shell("Карточки", sections, js, JSON.stringify(model), FOOT_OPS + " Индекс цены (дороже/дешевле рынка) - на странице Маркетинг, после подтяжки цен.");
}

// ---------------- Деньги ----------------
export function renderMoney(model: unknown): string {
  const sections = `
  <h2>Сверенный P&L · закрытые месяцы (из подписанных Актов OZON)</h2>
  <div class="grid" id="pnl"></div>
  <div class="note" id="pnlMeta"></div>
  <div class="note">Сверенный слой. За незакрытые месяцы (май-июнь) чистая прибыль не показывается - не выдумывается (DOC_05 §1.2). Метод разнесения Акта - открытый риск G3 (двойной счёт "Базовое вознаграждение"), цифры с оговоркой.</div>
  <h2>Операционный P&L по транзакциям · 30 дней (реальные сборы OZON)</h2>
  <div class="card" id="txpnl"></div>
  <div class="note">Реальные сборы из /v3/finance/transaction (комиссия, логистика, эквайринг, подписки). Это канальный водопад М1→М3, работает и для незакрытого периода. С\С и реклама тут НЕ вычитаются: базис единиц у начисления и заказов разный, чистая прибыль - только из Актов. Маржа по С\С - на странице Товары. Декомпозиция строки «Прочие удержания» не документирована отчётом OZON - уточняется по детальному финотчёту (задача оперблоку, до закрытия цифра с оговоркой).</div>
  <h2>Оборот по месяцам · оперативный слой (GMV, не прибыль)</h2>
  <div class="card" id="gmv"></div>
  <h2>Оборот за выбранный период (для контекста)</h2>
  <div class="grid" id="kpis"></div>`;
  const js = `
function draw(cur,cmp){
  const tc=totals(win(cur.from,cur.to)),tp=totals(win(cmp.from,cmp.to));
  document.getElementById('kpis').innerHTML=[kpiCard('Оборот, ₽ (GMV)',tc.rev,tp.rev,true,mln),kpiCard('Заказы',tc.units,tp.units,true,rub)].join('');
}
function drawStatic(){
  const C=DATA.closed;let cum=0;let ph='';
  C.forEach(m=>{cum+=m.profit;const margin=Math.round(m.profit/m.realization*1000)/10;const pos=m.profit>=0;ph+='<div class="card"><div class="sub">'+m.label+'</div><div class="val num" style="font-size:24px;font-weight:680;color:'+(pos?'#34D399':'#FF5A5F')+'">'+mln(m.profit)+' ₽</div><div class="sub" style="margin-top:6px">реализация '+mln(m.realization)+' · маржа '+margin+'%</div></div>';});
  ph+='<div class="card" style="border-color:#34343a"><div class="sub">Накоплено (фев-апр)</div><div class="val num" style="font-size:24px;font-weight:680">'+mln(cum)+' ₽</div><div class="sub" style="margin-top:6px">чистая прибыль</div></div>';
  document.getElementById('pnl').innerHTML=ph;
  const M=DATA.closedMeta||{};document.getElementById('pnlMeta').innerHTML='Последний закрытый месяц: <b>'+(M.lastLabel||'-')+'</b> · Акты обновлены '+(M.updated||'-')+(M.stale?' <span class="pill b-Z">Актам больше 45 дней - сверенный слой устарел, запросить закрытие месяца</span>':'');
  const P=DATA.opnl;if(P&&P.accruals){let feesAbs=0;for(const k in (P.breakdown||{}))feesAbs+=Math.abs(P.breakdown[k]);const totalDed=P.accruals-P.payout;const other=Math.max(0,Math.round(totalDed-feesAbs));const f=n=>Math.round(n/P.accruals*1000)/10;let w='<div class="wgrid">'+'<div class="card kpi"><div class="lab">Выручка начисленная (М1)</div><div class="val num">'+mln(P.accruals)+' ₽</div><div class="sub">'+P.dateFrom+'..'+P.dateTo+'</div></div>'+'<div class="card kpi"><div class="lab">Сборы OZON (комиссия+услуги)</div><div class="val num" style="color:#FF5A5F">-'+mln(feesAbs)+' ₽</div><div class="sub">'+f(feesAbs)+'% выручки</div></div>'+'<div class="card kpi"><div class="lab">Прочие удержания (реклама/прочее)</div><div class="val num" style="color:#F2B544">-'+mln(other)+' ₽</div><div class="sub">'+f(other)+'% выручки · декомпозиция уточняется</div></div>'+'<div class="card kpi"><div class="lab">К начислению (М3)</div><div class="val num" style="color:#34D399">'+mln(P.payout)+' ₽</div><div class="sub">'+f(P.payout)+'% выручки</div></div></div>';w+='<div class="tscroll"><table><thead><tr><th>Статья сбора</th><th class="r">Сумма</th><th class="r">% выручки</th></tr></thead><tbody>';for(const k in (P.breakdown||{})){const v=P.breakdown[k];w+='<tr><td>'+k+'</td><td class="r num down">'+mln(v)+' ₽</td><td class="r num">'+f(Math.abs(v))+'%</td></tr>';}w+='<tr><td class="sub">Прочие удержания (реклама и пр., вне комиссии за продажу)</td><td class="r num down">-'+mln(other)+' ₽</td><td class="r num">'+f(other)+'%</td></tr><tr><td><b>Итого удержано</b></td><td class="r num down"><b>-'+mln(totalDed)+' ₽</b></td><td class="r num">'+f(totalDed)+'%</td></tr></tbody></table></div>';document.getElementById('txpnl').innerHTML=w;}
  const bm={};for(const f of F){const mo=f[0].slice(0,7);bm[mo]=(bm[mo]||0)+f[2];}const ms=Object.keys(bm).sort();const max=Math.max(1,...Object.values(bm));
  let g='';ms.forEach(m=>{g+='<div style="display:grid;grid-template-columns:80px 1fr 110px;align-items:center;gap:10px;margin:8px 0"><div class="sub">'+m+'</div><div style="background:#1E1E20;border-radius:7px"><div style="height:24px;width:'+(bm[m]/max*100)+'%;background:linear-gradient(90deg,#8AA0FF,#6377d6);border-radius:7px"></div></div><div class="r num">'+mln(bm[m])+' ₽</div></div>';});document.getElementById('gmv').innerHTML=g;
}
boot(drawStatic);`;
  return shell("Деньги", sections, js, JSON.stringify(model), `Сверенный слой - <b>[ДАННЫЕ]</b> из подписанных Актов (фев-апр). Оперативный GMV - из дневной истории. Слои не смешиваются. Маржа по SKU - после коннектора транзакций (Фаза 2).`);
}

// ---------------- Ассистент (детерминированный аналитик по витринам) ----------------
export function renderAssistant(model: unknown): string {
  const sections = `
  <h2>Аналитик по данным · спросите своими словами</h2>
  <div class="card">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <input id="q" placeholder="например: сводка за период · что выросло · где горит реклама · топ маржа · карточки на ремонт" style="flex:1;min-width:260px;background:var(--raised);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:10px 12px;font:inherit">
      <button class="btn on" id="ask">Спросить</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn qq">Сводка за период</button>
      <button class="btn qq">Что выросло и упало</button>
      <button class="btn qq">Где горит реклама</button>
      <button class="btn qq">Топ по марже</button>
      <button class="btn qq">Карточки на ремонт</button>
      <button class="btn qq">Возвраты</button>
    </div>
  </div>
  <div id="answer"></div>`;
  const js = `
let lastQ='Сводка за период';
function badge(mix){return mix?'<span class="pill b-Y">[СМЕШАННЫЙ СЛОЙ: факт + гипотеза]</span>':'<span class="pill b-A">[ДАННЫЕ]</span>';}
function ansCard(title,html,mix){return '<div class="card" style="margin-top:13px"><div style="font-weight:680;margin-bottom:8px">'+title+' '+badge(mix)+'</div><div class="tscroll">'+html+'</div></div>';}
function gmFor(cur){const v=skuViews(cur.from,cur.to);let g=0,rc=0;for(const x of v){const c=cogsOf(x.sku);if(c>0){g+=x.rev-c*x.units;rc+=x.rev;}}return rc>0?{gm:Math.round(g/rc*1000)/10,cov:Math.round(rc/(v.reduce((s,y)=>s+y.rev,0)||1)*100)}:{gm:0,cov:0};}
function answer(q){
  const cur=state.cur,cmp=state.cmp;const per=cur.from+'..'+cur.to;
  const tc=totals(win(cur.from,cur.to)),tp=totals(win(cmp.from,cmp.to));
  const dg=(a,b)=>b>0?Math.round((a-b)/b*1000)/10:0;
  const lg=linesGrowth(cur.from,cur.to,cmp.from,cmp.to).sort((a,b)=>b.growth-a.growth);
  const A=DATA.ads||{};const At=A.totals||{};
  q=(q||'').toLowerCase();
  const themes=[/реклам|дрр|слив|кампан|бюджет/,/маржа|прибыл|зарабат|себес|рентаб/,/возврат|брак|отмен/,/карточк|конверс|переделать|трафик/,/выросл|упал|динам|движен|лучш|хуж/];
  const nHit=themes.filter(t=>t.test(q)).length;
  let pre='';
  if(nHit>1)pre='<div class="note">В вопросе несколько тем - отвечаю на первую, остальные спросите отдельно.</div>';
  const known=nHit>0||/сводк|итог|как дела|обзор/.test(q)||q.trim()==='';
  if(!known)pre='<div class="note">Не распознал вопрос точно - показываю сводку. Умею: реклама/ДРР, маржа, возвраты, карточки, динамика.</div>';
  if(/реклам|дрр|слив|кампан|бюджет/.test(q)){
    const burn=(A.burners||[]).slice(0,5);const freed=(A.burners||[]).reduce((s,b)=>s+(b.o===0&&b.line!=='прочее'?b.sp:0),0);
    let h='<div class="sub">ДРР канала <b>'+(At.drr||0)+'%</b> · расход '+mln(At.spend||0)+' ₽ · ROAS '+((At.adRevenue/At.spend)||0).toFixed(1)+'x (снимок 30 дней)</div><table style="margin-top:8px"><thead><tr><th>Кампания</th><th class="r">Расход</th><th class="r">Заказы</th><th class="r">ДРР</th></tr></thead><tbody>'+burn.map(b=>'<tr><td>'+b.off+'</td><td class="r num">'+rub(b.sp)+'</td><td class="r num">'+b.o+'</td><td class="r num down">'+(b.drr||'0 зак.')+'</td></tr>').join('')+'</tbody></table><div class="note">Высвобождение бюджета от отключения нулевых товарных кампаний: <b>'+mln(freed)+' ₽/мес</b> <span class="pill b-Y">[ГИПОТЕЗА]</span> - это прекращение расхода, не «возврат денег». Допущения: спрос не переедет в органику; атрибуция last-click не видит ассист-касаний; кампания-агрегатор «оплата за заказ» исключена. Пилот: 2 кампании, 14 дней, чекпоинт 23.06.</div>';
    return pre+ansCard('Реклама за снимок 30 дней',h,true);
  }
  if(/маржа|прибыл|зарабат|себес|рентаб/.test(q)){
    const g=gmFor(cur);const vbl={};const v=skuViews(cur.from,cur.to);for(const x of v){const c=cogsOf(x.sku);if(c>0){let e=vbl[x.line];if(!e){e={g:0,rc:0};vbl[x.line]=e;}e.g+=x.rev-c*x.units;e.rc+=x.rev;}}
    const ml=Object.keys(vbl).map(k=>({line:k,m:Math.round(vbl[k].g/vbl[k].rc*1000)/10})).sort((a,b)=>b.m-a.m);
    let h='<div class="sub">Валовая маржа по С\\\\С: <b>'+g.gm+'%</b> (покрытие '+g.cov+'% оборота). После сборов OZON канал отдаёт ~46% выручки (полный М3, см. Деньги).</div><table style="margin-top:8px"><thead><tr><th>Линия</th><th class="r">Вал. маржа</th></tr></thead><tbody>'+ml.map(x=>'<tr><td>'+x.line+'</td><td class="r num">'+x.m+'%</td></tr>').join('')+'</tbody></table>';
    return pre+ansCard('Маржа за '+per,h);
  }
  if(/возврат|брак|отмен/.test(q)){
    const a=aggSku(win(cur.from,cur.to));const lm={};for(const x of a.values()){let e=lm[SK[x.sku][1]];if(!e){e={ret:0,units:0};lm[SK[x.sku][1]]=e;}e.ret+=x.ret;e.units+=x.units;}
    const arr=Object.keys(lm).map(k=>({line:k,rr:lm[k].units+lm[k].ret>0?Math.round(lm[k].ret/(lm[k].units+lm[k].ret)*1000)/10:0,ret:lm[k].ret})).sort((x,y)=>y.rr-x.rr);
    let h='<div class="sub">Всего возвратов: <b>'+tc.ret+'</b> ('+pct(dg(tc.ret,tp.ret))+' к пред.)</div><table style="margin-top:8px"><thead><tr><th>Линия</th><th class="r">Возвраты</th><th class="r">Возврат %</th></tr></thead><tbody>'+arr.filter(x=>x.ret>0).map(x=>'<tr><td>'+x.line+'</td><td class="r num">'+x.ret+'</td><td class="r num '+(x.rr>5?'down':'')+'">'+x.rr+'%</td></tr>').join('')+'</tbody></table>';
    return pre+ansCard('Возвраты за '+per,h);
  }
  if(/карточк|конверс|переделать|трафик|заказов мало/.test(q)){
    const v=skuViews(cur.from,cur.to);const vs=v.map(x=>x.views).sort((a,b)=>a-b);const medV=vs[Math.floor(vs.length/2)]||0;
    const fix=v.filter(x=>x.views>=Math.max(3000,medV)&&x.conv<0.2).sort((a,b)=>b.views-a.views).slice(0,10);
    let h='<div class="sub">'+fix.length+' кандидатов: показов выше медианы, конверсия в заказ ниже 0.2%</div><table style="margin-top:8px"><thead><tr><th>Товар</th><th class="r">Показы</th><th class="r">Заказы</th><th class="r">CR</th></tr></thead><tbody>'+fix.map(x=>'<tr><td>'+x.name+'</td><td class="r num">'+rub(x.views)+'</td><td class="r num">'+rub(x.units)+'</td><td class="r num down">'+x.conv+'</td></tr>').join('')+'</tbody></table>';
    return pre+ansCard('Карточки на ремонт за '+per,h);
  }
  if(/выросл|упал|динам|движен|лучш|хуж/.test(q)){
    let h='<table><thead><tr><th>Линия</th><th class="r">Оборот</th><th class="r">Рост</th></tr></thead><tbody>'+lg.map(d=>'<tr><td>'+d.line+'</td><td class="r num">'+mln(d.rev)+'</td><td class="r '+(d.growth>=0?'up':'down')+'">'+pct(d.growth)+'</td></tr>').join('')+'</tbody></table>';
    return pre+ansCard('Динамика по линиям за '+per,h);
  }
  // сводка по умолчанию
  if(tc.units===0)return pre+ansCard('Сводка за '+per,'<div class="sub">Нет продаж в выбранном периоде - менять окно сверху.</div>');
  const g=gmFor(cur);const up=lg[0],dn=lg[lg.length-1];
  let h='<div style="font-size:15px;line-height:1.7">Оборот <b>'+mln(tc.rev)+' ₽</b> ('+pct(dg(tc.rev,tp.rev))+' к пред.), заказов <b>'+tc.units+'</b> ('+pct(dg(tc.units,tp.units))+').<br>Валовая маржа <b>'+g.gm+'%</b> по С\\\\С (покрытие '+g.cov+'%). ДРР канала <b>'+(At.drr||0)+'%</b> (снимок 30д, отдельный период).<br>Лучше всех растёт <b>'+(up?up.line:'-')+'</b> ('+(up?pct(up.growth):'')+'), хуже всех <b>'+(dn?dn.line:'-')+'</b> ('+(dn?pct(dn.growth):'')+').<br>Возвратов '+tc.ret+', SKU с продажами '+tc.sku+'.</div>';
  return pre+ansCard('Сводка за '+per,h);
}
function run(q){lastQ=q;document.getElementById('answer').innerHTML=answer(q);}
function draw(cur,cmp){if(lastQ)document.getElementById('answer').innerHTML=answer(lastQ);}
document.getElementById('ask').addEventListener('click',()=>run(document.getElementById('q').value||lastQ));
document.getElementById('q').addEventListener('keydown',e=>{if(e.key==='Enter')run(e.target.value||lastQ);});
document.querySelectorAll('.qq').forEach(b=>b.addEventListener('click',()=>{document.getElementById('q').value=b.textContent;run(b.textContent);}));
boot();`;
  return shell("Ассистент", sections, js, JSON.stringify(model), `Детерминированный аналитик: считает ответы из встроенных витрин (история + снимки), <b>не генеративный ИИ</b> - ноль выдумок, каждая цифра [ДАННЫЕ]. Реклама - снимок 30 дней. Период берётся из переключателя сверху.`);
}
