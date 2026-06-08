// Рендер сервиса в утверждённом Orbi-стиле. Самодостаточный HTML, данные инлайн.
// Страница "Товары": KPI, ABC-XYZ матрица, BCG, хитмап месяц x линия, таблица с
// раскрытием в SKU и дневным трендом.

export const DS_CSS = `
:root{
  --bg:#0A0A0B;--surface:#161617;--raised:#1E1E20;--line:#2A2A2D;
  --txt:#F5F5F6;--mut:#8A8A90;--mut2:#5E5E64;
  --brand:#FF4438;--good:#34D399;--bad:#FF5A5F;--warn:#F2B544;--info:#6AA8FF;
  --r-card:16px;--r-ctl:10px;--pad:22px;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);
  font:14px/1.55 "SF Pro Display","SF Pro Text",-apple-system,BlinkMacSystemFont,Inter,"Helvetica Neue",sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.num{font-variant-numeric:tabular-nums}
.wrap{max-width:1200px;margin:0 auto;padding:24px;position:relative;z-index:1}
.aurora{position:fixed;inset:-22% 0 auto 0;height:480px;z-index:0;pointer-events:none;
  background:radial-gradient(60% 120% at 50% 0%, transparent 40%, rgba(255,120,40,.45) 47%, rgba(255,60,120,.4) 55%, rgba(120,90,255,.36) 63%, rgba(70,170,255,.32) 71%, transparent 80%);
  filter:blur(40px);opacity:.42;transform:scaleY(.7)}
header{display:flex;align-items:center;gap:14px;justify-content:space-between;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:40px;height:40px;border-radius:11px;background:#1E1E20;border:1px solid #34343a;display:grid;place-items:center;color:#fff;font-weight:800;font-size:15px;letter-spacing:-.02em}
h1{font-size:19px;margin:0;font-weight:680;letter-spacing:-.01em}
.sub{color:var(--mut);font-size:12.5px}
nav{display:flex;gap:4px;margin:20px 0 6px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:0}
.tab{padding:9px 14px;border-radius:10px 10px 0 0;color:var(--mut);font-size:13.5px;text-decoration:none;border:1px solid transparent;border-bottom:none}
.tab.on{color:var(--txt);background:var(--surface);border-color:var(--line)}
.tab.soon{opacity:.5}
.chips{display:flex;gap:6px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:4px}
.chip{padding:6px 13px;border-radius:999px;color:var(--mut);font-size:13px;cursor:pointer;border:0;background:transparent;font:inherit}
.chip.on{background:var(--raised);color:var(--txt)}
.tag{display:inline-block;padding:4px 11px;border-radius:999px;background:var(--surface);border:1px solid var(--line);color:var(--mut);font-size:11.5px;font-weight:500}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.09em;color:var(--mut);margin:30px 0 13px;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:13px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-card);padding:var(--pad);position:relative;overflow:hidden}
.kpi .lab{color:var(--mut);font-size:12px}
.kpi .val{font-size:26px;font-weight:680;margin-top:6px;letter-spacing:-.02em}
.kpi .d{font-size:12.5px;margin-top:5px}
.up{color:var(--good)}.down{color:var(--bad)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:13px}
@media(max-width:820px){.two{grid-template-columns:1fr}}
.pill{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:700}
.matrix{display:grid;grid-template-columns:30px repeat(3,1fr);gap:6px}
.mcell{border-radius:9px;padding:10px;min-height:62px;border:1px solid var(--line)}
.mcell .c{font-size:18px;font-weight:680}
.mcell .r{font-size:11px;opacity:.8}
.maxis{color:var(--mut);font-size:11px;display:grid;place-items:center}
table{width:100%;border-collapse:collapse}
th,td{padding:10px 12px;border-bottom:1px solid var(--line);font-size:13px;text-align:left}
th{color:var(--mut);font-weight:500;font-size:12px}
td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}
tr.line-row{cursor:pointer}
tr.line-row:hover{background:var(--raised)}
tr.sku-row td{background:#121214;font-size:12.5px;color:var(--mut)}
tr.sku-row .nm{color:var(--txt)}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:9px;vertical-align:middle}
.b-abc{background:rgba(255,68,56,.16);color:#ff7a70}
.b-A{background:rgba(52,211,153,.16);color:var(--good)}
.b-B{background:rgba(106,168,255,.16);color:var(--info)}
.b-C{background:rgba(138,138,144,.18);color:#a8a8ad}
.b-X{background:rgba(52,211,153,.16);color:var(--good)}
.b-Y{background:rgba(242,181,68,.16);color:var(--warn)}
.b-Z{background:rgba(255,90,95,.16);color:var(--bad)}
.note{color:var(--mut);font-size:12px;margin-top:9px}
.caret{display:inline-block;width:14px;color:var(--mut);transition:transform .15s}
.open .caret{transform:rotate(90deg)}
footer{margin-top:36px;border-top:1px solid var(--line);padding-top:14px;color:var(--mut);font-size:12px}
`;

interface Model {
  generatedAt: string;
  freshness: string;
  windows: { cur: { from: string; to: string }; cmp: { from: string; to: string } };
  kpis: Record<string, { cur: number; pct: number; goodUp: boolean }>;
  matrix: Record<string, { count: number; revenue: number }>;
  bcg: Array<{ line: string; revenue: number; sharePct: number; growth: number; quadrant: string }>;
  heatmap: { months: string[]; lines: Array<{ line: string; byMonth: Record<string, number>; total: number }> };
  lines: Array<{
    line: string; revenue: number; units: number; revShare: number;
    skus: Array<{ sku: string; name: string; abc: string; xyz: string; cv: number; revenue: number; units: number; convOrd: number; aov: number; series: number[] }>;
  }>;
}

const NAV = [
  ["Обзор", "soon"], ["Товары", "on"], ["Воронка", "soon"], ["Маркетинг и цена", "soon"],
  ["Кампании", "soon"], ["Карточки", "soon"], ["Деньги", "soon"],
];

export function renderTovary(model: Model): string {
  const json = JSON.stringify(model);
  const nav = NAV.map(([t, s]) => `<a class="tab ${s}" href="#">${t}${s === "soon" ? " ·" : ""}</a>`).join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GENGLASS · Товары</title><style>${DS_CSS}</style></head>
<body><div class="aurora"></div><div class="wrap">
  <header>
    <div class="brand"><div class="logo">GG</div>
      <div><h1>GENGLASS · аналитика OZON</h1><div class="sub" id="fresh"></div></div>
    </div>
    <div class="chips"><button class="chip">7д</button><button class="chip on">30д</button><button class="chip">90д</button><button class="chip">Год</button></div>
  </header>
  <nav>${nav}</nav>

  <h2>Срез периода (текущие 30 дней против предыдущих)</h2>
  <div class="grid" id="kpis"></div>

  <div class="two">
    <div>
      <h2>ABC × XYZ матрица</h2>
      <div class="card"><div class="matrix" id="matrix"></div>
        <div class="note">строки - вклад в оборот (A/B/C), столбцы - стабильность спроса (X ровный · Y переменный · Z рваный). Левый-верх = опора бизнеса, правый-низ = случайные продажи.</div>
      </div>
    </div>
    <div>
      <h2>BCG по линиям (рост × доля)</h2>
      <div class="card"><svg id="bcg" viewBox="0 0 460 260" width="100%" height="260"></svg></div>
    </div>
  </div>

  <h2>Хитмап заказов · линия × месяц</h2>
  <div class="card" id="heatcard"></div>

  <h2>Товары по линиям · клик по строке раскрывает SKU и дневной тренд</h2>
  <div class="card" style="padding:0">
    <table><thead><tr>
      <th>Линия / SKU</th><th class="r">Оборот</th><th class="r">Доля</th><th class="r">Заказы</th><th class="r">CR заказ</th><th class="r">Ср.чек</th><th class="r">ABC·XYZ</th>
    </tr></thead><tbody id="rows"></tbody></table>
  </div>

  <footer>
    <div>Все цифры - <b>[ДАННЫЕ]</b> из дневной истории OZON (оперативный слой). Маржа и P&L появятся после коннектора транзакций (Фаза 2). Группировка по линии (модель-уровень - после джойна offer_id с таксономией).</div>
    <div class="note" id="gen"></div>
  </footer>
</div>
<script>
const M=${json};
const rub=n=>new Intl.NumberFormat('ru-RU').format(Math.round(n));
const mln=n=>(n>=1e6?(n/1e6).toFixed(2)+' М':rub(n));
const pct=p=>(p>=0?'+':'')+(Math.round(p*1000)/10)+'%';
document.getElementById('fresh').textContent='свежесть '+M.freshness+' · '+M.windows.cur.from+'..'+M.windows.cur.to+' против '+M.windows.cmp.from+'..'+M.windows.cmp.to;
document.getElementById('gen').textContent='сгенерировано '+M.generatedAt;

// KPI
const KPI=[['Оборот, ₽','revenue',v=>mln(v)],['Заказы','units',rub],['CR показ-заказ, %','cr_order',v=>v],['Средний чек, ₽','aov',rub],['Возвраты','returns',rub],['SKU с продажами','skuCount',rub]];
document.getElementById('kpis').innerHTML=KPI.map(([lab,k,f])=>{const m=M.kpis[k];const up=m.pct>=0;const good=m.goodUp?up:!up;return '<div class="card kpi"><div class="lab">'+lab+'</div><div class="val num">'+f(m.cur)+'</div><div class="d '+(good?'up':'down')+'">'+(up?'▲':'▼')+' '+pct(m.pct)+'</div></div>';}).join('');

// ABC-XYZ матрица
const cls=['A','B','C'],xs=['X','Y','Z'];
const cellColor=(a,x)=>{const score=(a==='A'?0:a==='B'?1:2)+(x==='X'?0:x==='Y'?1:2);const cols=['#173b2c','#1d4636','#3a3f1e','#46361e','#4a2a1e','#4a221f'];return cols[Math.min(score,5)];};
let mh='<div class="maxis"></div>'+xs.map(x=>'<div class="maxis">'+x+'</div>').join('');
cls.forEach(a=>{mh+='<div class="maxis">'+a+'</div>';xs.forEach(x=>{const c=M.matrix[a+x]||{count:0,revenue:0};mh+='<div class="mcell" style="background:'+cellColor(a,x)+'"><div class="c">'+c.count+'</div><div class="r num">'+mln(c.revenue)+' ₽</div></div>';});});
document.getElementById('matrix').innerHTML=mh;

// BCG scatter
(function(){const W=460,H=260,pad=34;const xs2=M.bcg.map(d=>d.sharePct);const maxShare=Math.max(10,...xs2);const gs=M.bcg.map(d=>d.growth);const gmax=Math.max(20,...gs.map(Math.abs));const x=s=>pad+(s/maxShare)*(W-pad-10);const y=g=>H/2-(g/gmax)*(H/2-20);const qcol={star:'#34D399',cow:'#6AA8FF',question:'#F2B544',dog:'#FF5A5F'};let s='<line x1="'+pad+'" y1="'+(H/2)+'" x2="'+W+'" y2="'+(H/2)+'" stroke="#2A2A2D"/><line x1="'+x(maxShare/2)+'" y1="6" x2="'+x(maxShare/2)+'" y2="'+(H-6)+'" stroke="#2A2A2D"/>';s+='<text x="'+(W-6)+'" y="'+(H/2-6)+'" fill="#5E5E64" font-size="10" text-anchor="end">доля рынка →</text>';s+='<text x="'+(pad+4)+'" y="14" fill="#5E5E64" font-size="10">рост ↑</text>';M.bcg.forEach(d=>{const cx=x(d.sharePct),cy=y(d.growth);const r=Math.max(6,Math.min(26,Math.sqrt(d.revenue)/120));s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+qcol[d.quadrant]+'" fill-opacity="0.35" stroke="'+qcol[d.quadrant]+'"/>';s+='<text x="'+cx+'" y="'+(cy-r-3)+'" fill="#F5F5F6" font-size="10" text-anchor="middle">'+d.line+'</text>';});document.getElementById('bcg').innerHTML=s;})();

// Хитмап
(function(){const mo=M.heatmap.months;const maxU=Math.max(1,...M.heatmap.lines.flatMap(l=>Object.values(l.byMonth)));const shade=u=>{if(!u)return '#141416';const t=u/maxU;const r=Math.round(40+t*215),g=Math.round(24+t*44),b=Math.round(22+t*26);return 'rgb('+r+','+g+','+b+')';};let h='<table><thead><tr><th>Линия</th>'+mo.map(m=>'<th class="r">'+m.slice(5)+'.'+m.slice(2,4)+'</th>').join('')+'<th class="r">Итого</th></tr></thead><tbody>';M.heatmap.lines.forEach(l=>{h+='<tr><td>'+l.line+'</td>'+mo.map(m=>{const u=l.byMonth[m]||0;return '<td class="r" style="background:'+shade(u)+';color:'+(u>maxU*0.4?'#0A0A0B':'#F5F5F6')+';font-weight:600;border-radius:6px">'+(u||'')+'</td>';}).join('')+'<td class="r num"><b>'+l.total+'</b></td></tr>';});h+='</tbody></table>';document.getElementById('heatcard').innerHTML=h;})();

// Таблица по линиям с раскрытием
const spark=(series)=>{const w=120,h=26,max=Math.max(1,...series);const step=w/Math.max(1,series.length-1);const pts=series.map((v,i)=>i*step+','+(h-(v/max)*(h-3))).join(' ');return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"><polyline fill="none" stroke="#FF4438" stroke-width="1.6" points="'+pts+'"/></svg>';};
const badge=(t,c)=>'<span class="pill b-'+c+'">'+t+'</span>';
let rh='';
M.lines.forEach((l,li)=>{
  rh+='<tr class="line-row" data-li="'+li+'"><td><span class="caret">▸</span><span class="dot" style="background:#FF4438"></span><b>'+l.line+'</b> <span class="sub">'+l.skus.length+' SKU</span></td><td class="r num">'+mln(l.revenue)+'</td><td class="r num">'+l.revShare+'%</td><td class="r num">'+rub(l.units)+'</td><td class="r"></td><td class="r"></td><td class="r"></td></tr>';
  l.skus.forEach(s=>{
    rh+='<tr class="sku-row" data-li="'+li+'" style="display:none"><td class="nm">'+s.name+'</td><td class="r num">'+mln(s.revenue)+'</td><td class="r num">'+s.revShare+'%</td><td class="r num">'+rub(s.units)+'</td><td class="r num">'+s.convOrd+'</td><td class="r num">'+rub(s.aov)+'</td><td class="r">'+badge(s.abc,s.abc)+' '+badge(s.xyz,s.xyz)+'</td></tr>';
    rh+='<tr class="sku-row trend" data-li="'+li+'" style="display:none"><td colspan="7" style="padding-top:0"><span class="sub">тренд заказов по дням: </span>'+spark(s.series)+'</td></tr>';
  });
});
document.getElementById('rows').innerHTML=rh;
document.querySelectorAll('.line-row').forEach(tr=>tr.addEventListener('click',()=>{const li=tr.dataset.li;tr.classList.toggle('open');document.querySelectorAll('.sku-row[data-li="'+li+'"]').forEach(r=>{r.style.display=r.style.display==='none'?'table-row':'none';});}));
</script></body></html>`;
}
