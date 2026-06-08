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
input[type=date]{background:var(--surface);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:6px 8px;font:inherit;font-size:12.5px;color-scheme:dark}
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
`;

const NAV: Array<[string, string, string]> = [
  ["Обзор", "obzor.html", "Обзор"],
  ["Товары", "tovary.html", "Товары"],
  ["Воронка", "voronka.html", "Воронка"],
  ["Маркетинг и цена", "#", "Маркетинг и цена"],
  ["Кампании", "#", "Кампании"],
  ["Карточки", "#", "Карточки"],
  ["Деньги", "#", "Деньги"],
];

// Общий движок: данные + витрины + период/сравнение. draw(cur,cmp) определяет страница.
const ENGINE = `
const F=DATA.facts, SK=DATA.skus, MAX=DATA.max, FLOOR=DATA.floor;
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
function prevEqual(from,to){const len=between(from,to).length;const pt=ad(from,-1);let pf=ad(pt,-(len-1));if(pf<FLOOR)pf=FLOOR;return{from:pf,to:pt};}
function periodFor(kind){const to=MAX;let from;if(kind==='7')from=ad(to,-6);else if(kind==='30')from=ad(to,-29);else if(kind==='90')from=ad(to,-89);else from=FLOOR;if(from<FLOOR)from=FLOOR;return{from,to};}
function areaSvg(vals,stroke){const w=460,h=150,max=Math.max(1,...vals),n=vals.length,st=w/Math.max(1,n-1);const pts=vals.map((v,i)=>(i*st).toFixed(1)+','+(h-(v/max)*(h-14)).toFixed(1));const line='M'+pts.join(' L');const area=line+' L'+w+','+h+' L0,'+h+' Z';return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="150" preserveAspectRatio="none"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+stroke+'" stop-opacity=".30"/><stop offset="1" stop-color="'+stroke+'" stop-opacity="0"/></linearGradient></defs><path d="'+area+'" fill="url(#ag)"/><path d="'+line+'" fill="none" stroke="'+stroke+'" stroke-width="2.2"/></svg>';}
let state={kind:'30',cur:null,cmp:null,compare:false};
function apply(){let cur,cmp;if(state.kind==='custom')cur={from:document.getElementById('cf').value,to:document.getElementById('ct').value};else cur=periodFor(state.kind);if(state.compare)cmp={from:document.getElementById('pf').value,to:document.getElementById('pt').value};else cmp=prevEqual(cur.from,cur.to);state.cur=cur;state.cmp=cmp;document.getElementById('period').textContent=cur.from+'..'+cur.to+'  против  '+cmp.from+'..'+cmp.to;draw(cur,cmp);}
function initControls(){const cr=document.getElementById('customRow'),cm=document.getElementById('cmpRow');document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{document.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));c.classList.add('on');state.kind=c.dataset.k;if(cr)cr.style.display=state.kind==='custom'?'flex':'none';apply();}));document.getElementById('cmpBtn').addEventListener('click',()=>{state.compare=!state.compare;document.getElementById('cmpBtn').classList.toggle('on',state.compare);if(cm)cm.style.display=state.compare?'flex':'none';if(state.compare){const pe=prevEqual(state.cur.from,state.cur.to);document.getElementById('pf').value=pe.from;document.getElementById('pt').value=pe.to;}apply();});const ac=document.getElementById('applyCustom');if(ac)ac.addEventListener('click',apply);const am=document.getElementById('applyCmp');if(am)am.addEventListener('click',apply);const c30=periodFor('30');if(document.getElementById('cf')){document.getElementById('cf').value=c30.from;document.getElementById('ct').value=c30.to;}}
function kpiCard(lab,cur,prev,goodUp,fmt){const d=prev===0?0:(cur-prev)/prev;const up=d>=0,good=goodUp?up:!up;return '<div class="card kpi"><div class="lab">'+lab+'</div><div class="val num">'+fmt(cur)+'</div><div class="d '+(good?'up':'down')+'">'+(up?'▲':'▼')+' '+pct(d)+'</div></div>';}
function boot(staticFn){if(staticFn)staticFn();initControls();apply();}
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
  ${sections}
  <footer>${footer}</footer>
</div>
<script>const DATA=${dataJson};
${ENGINE}
${pageJs}
</script></body></html>`;
}

const FOOT_OPS = `Все цифры - <b>[ДАННЫЕ]</b> из дневной истории OZON (оперативный слой T-1). Период и сравнение считаются в браузере. Маржа/P&L - после коннектора транзакций (Фаза 2).`;

// ---------------- Товары ----------------
export function renderTovary(model: unknown): string {
  const sections = `
  <h2>Срез периода</h2><div class="grid" id="kpis"></div>
  <div class="two">
    <div><h2>ABC × XYZ матрица</h2><div class="card"><div class="matrix" id="matrix"></div>
      <div class="note">строки - вклад в оборот (A/B/C), столбцы - стабильность спроса (X ровный · Y переменный · Z рваный). Лево-верх = опора, право-низ = случайные.</div></div></div>
    <div><h2>BCG по линиям (рост × доля)</h2><div class="card"><svg id="bcg" viewBox="0 0 460 260" width="100%" height="260"></svg></div></div>
  </div>
  <h2>Хитмап заказов · линия × месяц (вся история)</h2><div class="card" id="heatcard"></div>
  <h2>Товары по линиям · клик раскрывает SKU и дневной тренд</h2>
  <div class="card" style="padding:0"><table><thead><tr>
    <th>Линия / SKU</th><th class="r">Оборот</th><th class="r">Доля</th><th class="r">Заказы</th><th class="r">CR</th><th class="r">Ср.чек</th><th class="r">ABC·XYZ</th>
  </tr></thead><tbody id="rows"></tbody></table></div>`;
  const js = `
function drawHeat(){const hm=heatmap();const maxU=Math.max(1,...hm.lines.flatMap(l=>Object.values(l.byMonth)));const shade=u=>{if(!u)return '#141416';const t=u/maxU,r=Math.round(40+t*215),g=Math.round(24+t*44),b=Math.round(22+t*26);return 'rgb('+r+','+g+','+b+')';};let h='<table><thead><tr><th>Линия</th>'+hm.months.map(m=>'<th class="r">'+m.slice(5)+'.'+m.slice(2,4)+'</th>').join('')+'<th class="r">Итого</th></tr></thead><tbody>';hm.lines.forEach(l=>{h+='<tr><td>'+l.line+'</td>'+hm.months.map(m=>{const u=l.byMonth[m]||0;return '<td class="r" style="background:'+shade(u)+';color:'+(u>maxU*0.4?'#0A0A0B':'#F5F5F6')+';font-weight:600;border-radius:6px">'+(u||'')+'</td>';}).join('')+'<td class="r num"><b>'+l.total+'</b></td></tr>';});document.getElementById('heatcard').innerHTML=h+'</tbody></table>';}
function draw(cur,cmp){
  const tc=totals(win(cur.from,cur.to)),tp=totals(win(cmp.from,cmp.to));
  const cro=c=>Math.round((c.views?c.units/c.views:0)*1000)/10,aov=c=>Math.round(c.units?c.rev/c.units:0);
  document.getElementById('kpis').innerHTML=[kpiCard('Оборот, ₽',tc.rev,tp.rev,true,mln),kpiCard('Заказы',tc.units,tp.units,true,rub),kpiCard('CR показ-заказ, %',cro(tc),cro(tp),true,v=>v),kpiCard('Средний чек, ₽',aov(tc),aov(tp),true,rub),kpiCard('Возвраты',tc.ret,tp.ret,false,rub),kpiCard('SKU с продажами',tc.sku,tp.sku,true,rub)].join('');
  const views=skuViews(cur.from,cur.to),mx=matrix(views),cls=['A','B','C'],xs=['X','Y','Z'];
  const col=(a,x)=>{const s=(a==='A'?0:a==='B'?1:2)+(x==='X'?0:x==='Y'?1:2);return ['#173b2c','#1d4636','#3a3f1e','#46361e','#4a2a1e','#4a221f'][Math.min(s,5)];};
  let mh='<div class="maxis"></div>'+xs.map(x=>'<div class="maxis">'+x+'</div>').join('');cls.forEach(a=>{mh+='<div class="maxis">'+a+'</div>';xs.forEach(x=>{const c=mx[a+x];mh+='<div class="mcell" style="background:'+col(a,x)+'"><div class="c">'+c.count+'</div><div class="r num">'+mln(c.rev)+' ₽</div></div>';});});document.getElementById('matrix').innerHTML=mh;
  const bc=bcg(cur.from,cur.to,cmp.from,cmp.to),W=460,H=260,pad=34,maxShare=Math.max(10,...bc.map(d=>d.share)),gmax=Math.max(20,...bc.map(d=>Math.abs(d.growth))),X=s=>pad+(s/maxShare)*(W-pad-10),Y=g=>H/2-(g/gmax)*(H/2-20),qc={star:'#34D399',cow:'#6AA8FF',question:'#F2B544',dog:'#FF5A5F'};
  let bs='<line x1="'+pad+'" y1="'+(H/2)+'" x2="'+W+'" y2="'+(H/2)+'" stroke="#2A2A2D"/><line x1="'+X(maxShare/2)+'" y1="6" x2="'+X(maxShare/2)+'" y2="'+(H-6)+'" stroke="#2A2A2D"/><text x="'+(W-6)+'" y="'+(H/2-6)+'" fill="#5E5E64" font-size="10" text-anchor="end">доля →</text><text x="'+(pad+4)+'" y="14" fill="#5E5E64" font-size="10">рост ↑</text>';bc.forEach(d=>{const cx=X(d.share),cy=Y(d.growth),r=Math.max(6,Math.min(26,Math.sqrt(d.rev)/120));bs+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+qc[d.quadrant]+'" fill-opacity="0.35" stroke="'+qc[d.quadrant]+'"/><text x="'+cx+'" y="'+(cy-r-3)+'" fill="#F5F5F6" font-size="10" text-anchor="middle">'+d.line+'</text>';});document.getElementById('bcg').innerHTML=bs;
  const lm=new Map();for(const v of views){let a=lm.get(v.line);if(!a){a=[];lm.set(v.line,a);}a.push(v);}const totRev=views.reduce((s,v)=>s+v.rev,0)||1;
  const lines=[...lm.entries()].map(([line,sk])=>({line,sk,rev:sk.reduce((s,v)=>s+v.rev,0),units:sk.reduce((s,v)=>s+v.units,0)})).sort((a,b)=>b.rev-a.rev);
  const spark=ser=>{const w=120,h=26,mx=Math.max(1,...ser),st=w/Math.max(1,ser.length-1);const p=ser.map((v,i)=>i*st+','+(h-(v/mx)*(h-3))).join(' ');return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"><polyline fill="none" stroke="#FF4438" stroke-width="1.6" points="'+p+'"/></svg>';};
  const bg=(t,c)=>'<span class="pill b-'+c+'">'+t+'</span>';let rh='';
  lines.forEach((l,li)=>{rh+='<tr class="line-row" data-li="'+li+'"><td><span class="caret">▸</span><span class="dot" style="background:#FF4438"></span><b>'+l.line+'</b> <span class="sub">'+l.sk.length+' SKU</span></td><td class="r num">'+mln(l.rev)+'</td><td class="r num">'+(Math.round(l.rev/totRev*1000)/10)+'%</td><td class="r num">'+rub(l.units)+'</td><td class="r"></td><td class="r"></td><td class="r"></td></tr>';l.sk.forEach(s=>{rh+='<tr class="sku-row" data-li="'+li+'" style="display:none"><td class="nm">'+s.name+'</td><td class="r num">'+mln(s.rev)+'</td><td class="r num">'+s.share+'%</td><td class="r num">'+rub(s.units)+'</td><td class="r num">'+s.conv+'</td><td class="r num">'+rub(s.aov)+'</td><td class="r">'+bg(s.abc,s.abc)+' '+bg(s.xyz,s.xyz)+'</td></tr>';rh+='<tr class="sku-row" data-li="'+li+'" style="display:none"><td colspan="7" style="padding-top:0"><span class="sub">тренд заказов по дням: </span>'+spark(series(s.sku,cur.from,cur.to))+'</td></tr>';});});
  document.getElementById('rows').innerHTML=rh;document.querySelectorAll('.line-row').forEach(tr=>tr.addEventListener('click',()=>{const li=tr.dataset.li;tr.classList.toggle('open');document.querySelectorAll('.sku-row[data-li="'+li+'"]').forEach(r=>{r.style.display=r.style.display==='none'?'table-row':'none';});}));
}
boot(drawHeat);`;
  return shell("Товары", sections, js, JSON.stringify(model), FOOT_OPS + " Группировка по линии (модель-уровень - после джойна offer_id с таксономией).");
}

// ---------------- Обзор ----------------
export function renderOverview(model: unknown): string {
  const sections = `
  <h2>Срез периода</h2><div class="grid" id="kpis"></div>
  <div class="two">
    <div><h2>Оборот по дням</h2><div class="card"><div id="trend"></div><div class="note" id="trendNote"></div></div></div>
    <div><h2>Движения по линиям (рост к пред. периоду)</h2><div class="card" id="movers"></div></div>
  </div>
  <h2>Оборот по линиям за период</h2><div class="card" id="lineBars"></div>`;
  const js = `
function draw(cur,cmp){
  const tc=totals(win(cur.from,cur.to)),tp=totals(win(cmp.from,cmp.to));
  const cro=c=>Math.round((c.views?c.units/c.views:0)*1000)/10,aov=c=>Math.round(c.units?c.rev/c.units:0);
  document.getElementById('kpis').innerHTML=[kpiCard('Оборот, ₽',tc.rev,tp.rev,true,mln),kpiCard('Заказы',tc.units,tp.units,true,rub),kpiCard('Средний чек, ₽',aov(tc),aov(tp),true,rub),kpiCard('CR показ-заказ, %',cro(tc),cro(tp),true,v=>v),kpiCard('Возвраты',tc.ret,tp.ret,false,rub),kpiCard('SKU с продажами',tc.sku,tp.sku,true,rub)].join('');
  const dr=dailyRev(cur.from,cur.to);document.getElementById('trend').innerHTML=areaSvg(dr.map(d=>d.rev),tc.rev>=tp.rev?'#34D399':'#FF4438');
  document.getElementById('trendNote').textContent='с '+cur.from+' по '+cur.to+' · пик дня '+mln(Math.max(...dr.map(d=>d.rev)))+' ₽';
  const lg=linesGrowth(cur.from,cur.to,cmp.from,cmp.to).sort((a,b)=>b.growth-a.growth);
  let mh='<table><tbody>';lg.forEach(d=>{const up=d.growth>=0;mh+='<tr><td>'+d.line+'</td><td class="r num">'+mln(d.rev)+'</td><td class="r '+(up?'up':'down')+'">'+pct(d.growth)+'</td></tr>';});mh+='</tbody></table>';document.getElementById('movers').innerHTML=mh;
  const a=aggLine(win(cur.from,cur.to));const arr=[...a.values()].sort((x,y)=>y.rev-x.rev);const max=Math.max(1,...arr.map(x=>x.rev));let lb='';arr.forEach(x=>{lb+='<div style="display:grid;grid-template-columns:120px 1fr 90px;align-items:center;gap:10px;margin:7px 0"><div class="sub">'+x.line+'</div><div style="background:#1E1E20;border-radius:7px;overflow:hidden"><div style="height:22px;width:'+(x.rev/max*100)+'%;background:linear-gradient(90deg,#FF4438,#b5392f);border-radius:7px"></div></div><div class="r num">'+mln(x.rev)+' ₽</div></div>';});document.getElementById('lineBars').innerHTML=lb;
}
boot();`;
  return shell("Обзор", sections, js, JSON.stringify(model), FOOT_OPS);
}

// ---------------- Воронка ----------------
export function renderFunnel(model: unknown): string {
  const sections = `
  <h2>Срез периода</h2><div class="grid" id="kpis"></div>
  <h2>Воронка: показ → корзина → заказ → доставка</h2>
  <div class="card" id="funnel"></div>
  <h2>Потери</h2><div class="grid" id="leaks"></div>
  <h2>Возвраты по линиям</h2><div class="card" id="retLines"></div>`;
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
