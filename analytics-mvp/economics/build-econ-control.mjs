import { readFileSync, writeFileSync } from "node:fs";
const J = JSON.parse(readFileSync("economics/data/econ-recon.json", "utf8"));
const PORTAL = J.b24Portal || "https://glassmemory.bitrix24.ru";

// СП-колонки (порядок цепочки). etid для ссылок берём из spMeta.
const ORDER = ["Калькулятор GG", "Расчёт", "Закупка", "Производство  GG", "Сборка", "Логистика", "Монтаж"];
const SHORT = { "Калькулятор GG": "Кальк.", "Расчёт": "Расчёт", "Закупка": "Закупка", "Производство  GG": "Произв.", "Сборка": "Сборка", "Логистика": "Логист.", "Монтаж": "Монтаж" };
const etidByKey = {};
for (const s of J.spMeta) etidByKey[s.title] = s.etid;

// ранг этапа по производственному прогрессу
const RANK = { "Новая сделка": 0, "Расчёт": 1, "Формирование ТЗ": 1, "Принимают решение": 2, "КП отправлено": 2, "Долгострой": 2, "Предоплата получена": 3, "Заказ в производстве": 4, "Заказ произведен": 5, "Заказ отправлен": 5, "Сделка успешна": 5 };
const LOST = /провал/i;

const payload = { generated_at: J.generated_at, windowDays: J.windowDays, portal: PORTAL, order: ORDER, short: SHORT, etid: etidByKey, rank: RANK, deals: J.deals };

const HTML = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Контроль экономики сделок</title>
<style>
:root{--bg:#0B0F15;--card:#131820;--elev:#1A2029;--border:#1F2731;--ink:#F1F4F8;--ink-2:#A0AAB8;--ink-3:#6A7484;--up:#10B981;--warn:#F59E0B;--dn:#F43F5E;--info:#A78BFA;--accent:#22D3EE}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.45 -apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:1600px;margin:0 auto;padding:20px 20px 80px}
h1{font-size:22px;margin:0 0 4px}
.sub{color:var(--ink-2);font-size:12.5px;margin:0 0 16px;max-width:1100px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}
.tile{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px}
.tile .v{font-size:22px;font-weight:800}
.tile .l{color:var(--ink-2);font-size:11.5px;margin-top:2px}
.tile .n{color:var(--ink-3);font-size:10.5px;margin-top:4px}
.chain{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 16px}
.chip{background:var(--card);border:1px solid var(--border);border-radius:999px;padding:6px 12px;font-size:12px;display:flex;gap:8px;align-items:center}
.chip b{font-weight:700}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block}
.g{background:var(--up)}.y{background:var(--warn)}.r{background:var(--dn)}.o{background:var(--ink-3)}
.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:12px;position:sticky;top:0;z-index:5}
.bar input[type=text],.bar select{background:var(--elev);border:1px solid var(--border);color:var(--ink);border-radius:8px;padding:7px 10px;font-size:12.5px}
.bar input[type=text]{min-width:240px}
.bar label{display:flex;gap:6px;align-items:center;color:var(--ink-2);font-size:12px;cursor:pointer;user-select:none}
.cnt{color:var(--ink-3);font-size:12px;margin-left:auto}
.scrollx{overflow-x:auto;border:1px solid var(--border);border-radius:12px}
table{border-collapse:collapse;width:100%;font-size:12px;min-width:1200px}
th,td{padding:7px 9px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap}
th{position:sticky;top:0;background:var(--elev);z-index:2;font-size:11px;color:var(--ink-2);text-transform:uppercase;letter-spacing:.03em}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
tr:hover td{background:rgba(255,255,255,.02)}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.st{font-size:11px;padding:2px 8px;border-radius:999px;background:var(--elev);border:1px solid var(--border);color:var(--ink-2)}
.cell-g{color:var(--up);font-weight:700}
.cell-y{color:var(--warn)}
.cell-o{color:var(--ink-4,#3F4855)}
.flag{font-size:11px;padding:2px 7px;border-radius:6px;font-weight:700}
.flag.ok{background:rgba(16,185,129,.14);color:var(--up)}
.flag.warn{background:rgba(245,158,11,.14);color:var(--warn)}
.flag.bad{background:rgba(244,63,94,.16);color:var(--dn)}
.flag.lost{background:rgba(106,116,132,.14);color:var(--ink-3)}
.foot{color:var(--ink-3);font-size:11.5px;margin-top:16px;max-width:1200px}
.miss{color:var(--dn)}
</style></head>
<body><div class="wrap">
<h1>Контроль экономики сделок</h1>
<p class="sub">Воронка «GG Заказы РФ» (49), окно <span id="win"></span> дней. Каждая строка - сделка со ссылкой, её бюджет, этап и запущенные смарт-процессы (ссылки на карточки). В ячейке СП: значение с/с если заполнено, «○ пусто» если СП запущен но с/с не внесена, «·» если не запущен. Цель: к этапу «Заказ произведён / Сделка успешна» строка должна быть зелёной - тогда с/с и маржа сходятся. Пустые ячейки на позднем этапе = дыра. Обновлено <span id="gen"></span>.</p>
<div class="tiles" id="tiles"></div>
<div class="chain" id="chain"></div>
<div class="bar">
  <input type="text" id="q" placeholder="Поиск: номер или название сделки">
  <select id="fstage"><option value="">все этапы</option></select>
  <label><input type="checkbox" id="fnoprod"> без товаров</label>
  <label><input type="checkbox" id="fgap"> произведено без с/с</label>
  <label><input type="checkbox" id="fany"> есть хоть какая-то с/с</label>
  <span class="cnt" id="cnt"></span>
</div>
<div class="scrollx"><table id="tbl"><thead></thead><tbody></tbody></table></div>
<p class="foot" id="foot"></p>
</div>
<script>
const DATA=${JSON.stringify(payload)};
document.getElementById('win').textContent=DATA.windowDays;
document.getElementById('gen').textContent=new Date(DATA.generated_at).toLocaleString('ru');
const ORDER=DATA.order, SHORT=DATA.short, PORTAL=DATA.portal, RANK=DATA.rank;
const EXCL=/сумма|налог|наценк|прибыл|бюджет|коэфф|адрес|номер|исполнител|отч[её]т|тип доставки|данные из сп|^id |удалить|расход материал|макет|шаблон|обрешет|домгласс|полная себестоимость по заказу/i;
const ITOG=/производственная с\\/с|с\\/?с итог|расчет с\\/с итого|себестоимость производ/i;
function spCost(sp){ if(!sp) return null; const f=sp.money.filter(m=>!EXCL.test(m.label)); if(!f.length) return {v:0,empty:true,card:sp.cardId,etid:sp.etid,fields:sp.money}; const it=f.find(m=>ITOG.test(m.label)); return {v: it?it.value:f.reduce((a,m)=>a+m.value,0), empty:false, card:sp.cardId, etid:sp.etid, fields:f}; }
function byKey(d,key){ return d.sps.find(s=>s.key===key); }
const fmt=v=>v>=1e6?(v/1e6).toFixed(1).replace('.',',')+' млн':v>=1000?Math.round(v/1000)+'к':Math.round(v)+'';
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dealUrl=id=>PORTAL+'/crm/deal/details/'+id+'/';
const spUrl=(etid,card)=>PORTAL+'/crm/type/'+etid+'/details/'+card+'/';

// производственная с/с сделки (без двойного счёта): Производство если есть, иначе Расчёт; + стекло из Закупки
function prodSS(d){ const pr=spCost(byKey(d,'Производство  GG')), ra=spCost(byKey(d,'Расчёт')), za=spCost(byKey(d,'Закупка'));
  const base=(pr&&!pr.empty)?pr.v:((ra&&!ra.empty)?ra.v:0); const glass=(za&&!za.empty)?za.v:0; return base+glass; }
function rankOf(d){ return RANK[d.stage]!==undefined?RANK[d.stage]:(/провал/i.test(d.stage)?-1:2); }
function gate(d){ const r=rankOf(d); if(/провал/i.test(d.stage)) return {cls:'lost',t:'провалена'};
  const pr=spCost(byKey(d,'Производство  GG')); const est=spCost(byKey(d,'Расчёт'))||spCost(byKey(d,'Калькулятор GG'));
  if(r>=5){ if(!pr||pr.empty) return {cls:'bad',t:'нет с/с производства'}; return {cls:'ok',t:'с/с есть'}; }
  if(r>=4){ if(!pr||pr.empty) return {cls:'warn',t:'в производстве, с/с нет'}; return {cls:'ok',t:'ок'}; }
  if(r>=2){ if(!est||est.empty) return {cls:'warn',t:'КП без расчёта'}; return {cls:'ok',t:'ок'}; }
  return {cls:'',t:''}; }

// tiles
const N=DATA.deals.length;
const withProd=DATA.deals.filter(d=>d.hasProducts).length;
const withRasch=DATA.deals.filter(d=>{const s=spCost(byKey(d,'Расчёт'));return s&&!s.empty;}).length;
const prodStage=DATA.deals.filter(d=>rankOf(d)>=4);
const prodStageSS=prodStage.filter(d=>{const s=spCost(byKey(d,'Производство  GG'));return s&&!s.empty;}).length;
const svcAny=DATA.deals.filter(d=>['Сборка','Логистика','Монтаж'].some(k=>{const s=spCost(byKey(d,k));return s&&!s.empty;})).length;
const tiles=[
 ['№',N,'сделок в окне',''],
 ['📦',Math.round(100*withProd/N)+'%','с товарными строками',withProd+' из '+N+', без товаров '+(N-withProd)],
 ['🧮',Math.round(100*withRasch/N)+'%','с расчётом с/с','Расчёт заполнен у '+withRasch],
 ['🏭',(prodStage.length?Math.round(100*prodStageSS/prodStage.length):0)+'%','произведённых с с/с',prodStageSS+' из '+prodStage.length+' в произв./успехе'],
 ['🚚',svcAny+' шт','сделок с с/с услуг','сборка/логистика/монтаж - стоимость почти не вносится'],
];
document.getElementById('tiles').innerHTML=tiles.map(t=>'<div class="tile"><div class="v">'+t[1]+'</div><div class="l">'+t[2]+'</div><div class="n">'+esc(t[3])+'</div></div>').join('');

// chain health
const chain=ORDER.map(k=>{ let launched=0,filled=0; for(const d of DATA.deals){ const s=byKey(d,k); if(s){launched++; const c=spCost(s); if(c&&!c.empty)filled++;} }
  const pctL=Math.round(100*launched/N), pctF=launched?Math.round(100*filled/launched):0;
  let dot='o'; if(launched===0)dot='o'; else if(filled===0)dot='r'; else if(pctF>=70)dot='g'; else dot='y';
  return '<span class="chip"><span class="dot '+dot+'"></span><b>'+esc(SHORT[k]||k)+'</b> запуск '+pctL+'% · с/с '+(launched?pctF+'%':'нет')+'</span>'; }).join('');
document.getElementById('chain').innerHTML='<span style="color:var(--ink-3);font-size:11.5px;align-self:center">Здоровье цепочки (доля сделок где СП запущен / из них с внесённой с/с):</span>'+chain;

// stage filter options
const stages=[...new Set(DATA.deals.map(d=>d.stage))];
document.getElementById('fstage').insertAdjacentHTML('beforeend',stages.map(s=>'<option>'+esc(s)+'</option>').join(''));

// table head
const head=['Сделка','Название','Менеджер','Этап','Бюджет',...ORDER.map(k=>SHORT[k]||k),'Σ с/с','Маржа','Статус'];
document.querySelector('#tbl thead').innerHTML='<tr>'+head.map((h,i)=>'<th'+(i>=4&&i<head.length-1?' class="num"':'')+'>'+esc(h)+'</th>').join('')+'</tr>';

function cellSP(d,k){ const s=byKey(d,k); if(!s) return '<td class="num cell-o">·</td>'; const c=spCost(s);
  const link=(v)=>'<a href="'+spUrl(s.etid,s.cardId)+'" target="_blank">'+v+'</a>';
  if(c.empty) return '<td class="num cell-y" title="СП запущен, с/с не внесена">'+link('○')+'</td>';
  return '<td class="num cell-g" title="'+esc(c.fields.map(m=>m.label+'='+m.value).join('; '))+'">'+link(fmt(c.v))+'</td>'; }

function render(){
  const q=document.getElementById('q').value.trim().toLowerCase();
  const fs=document.getElementById('fstage').value;
  const noprod=document.getElementById('fnoprod').checked;
  const gap=document.getElementById('fgap').checked;
  const any=document.getElementById('fany').checked;
  let rows='';let shown=0;
  for(const d of DATA.deals){
    if(q && !(String(d.id).includes(q)||(d.title||'').toLowerCase().includes(q))) continue;
    if(fs && d.stage!==fs) continue;
    if(noprod && d.hasProducts) continue;
    const g=gate(d);
    if(gap && g.cls!=='bad') continue;
    if(any){ const has=d.sps.some(s=>{const c=spCost(s);return c&&!c.empty;}); if(!has)continue; }
    shown++;
    const ss=prodSS(d);
    const pr=spCost(byKey(d,'Производство  GG'));
    const marginShown=(pr&&!pr.empty)||rankOf(d)>=5;
    rows+='<tr>'
      +'<td><a href="'+dealUrl(d.id)+'" target="_blank">'+d.id+'</a></td>'
      +'<td title="'+esc(d.title)+'">'+esc((d.title||'').slice(0,42))+'</td>'
      +'<td>'+esc(d.mgr||'')+'</td>'
      +'<td><span class="st">'+esc(d.stage||'')+'</span></td>'
      +'<td class="num">'+fmt(d.budget)+'</td>'
      +ORDER.map(k=>cellSP(d,k)).join('')
      +'<td class="num">'+(ss?fmt(ss):'<span class="cell-o">-</span>')+'</td>'
      +'<td class="num">'+(marginShown&&ss?fmt(d.budget-ss):'<span class="cell-o">-</span>')+'</td>'
      +'<td><span class="flag '+(g.cls||'')+'">'+esc(g.t||'')+'</span></td>'
      +'</tr>';
  }
  document.querySelector('#tbl tbody').innerHTML=rows;
  document.getElementById('cnt').textContent='показано '+shown+' из '+DATA.deals.length;
}
['q','fstage','fnoprod','fgap','fany'].forEach(id=>document.getElementById(id).addEventListener('input',render));
render();
document.getElementById('foot').innerHTML='Модель: КП (бюджет, что платит клиент) = с/с материалов + производство + услуги (доставка/монтаж) + наценка. Σ с/с здесь = производственная с/с (Производство, иначе Расчёт) + стекло из Закупки; это материал+производство, БЕЗ услуг и без полной себестоимости (монтаж/логистика/сборка в CRM не заполняются - см. «здоровье цепочки»). Маржа показана только когда есть производственная с/с, иначе «-» (данных нет). Значения с/с очищены от полей «Сумма»/«Сумма налога» (это цена и налог, не с/с). Источник: Bitrix24, воронка 49, окно '+DATA.windowDays+' дней. Точный состав с/с уточняется с ПТО.';
</script></body></html>`;

writeFileSync("public/econ-control.html", HTML.replace(/—/g, "-"));
console.log("written", HTML.length, "bytes");
