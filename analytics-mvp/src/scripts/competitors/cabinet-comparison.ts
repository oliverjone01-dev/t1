import {cabinetClientHelpers,cabinetShell,stamp} from '../ozon/cabinet-data-page.js';
import {competitorHeaders,escapeHtml as esc,jsonHtml} from '../ozon/cabinet-supplements.js';
import {competitorSourceSwitch} from './source-switch.js';

type Watch = {sku:string;role:string;model:string;seller:string;pair_own:string};
type Cabinet = {
 source_updated_at:string;
 captured_at:string;
 watch:Watch[];
 exports:{days:number;kind:string;rows:(string|number|null)[][]}[];
};

const metrics = [
 ['Заказано, штуки','шт.'],
 ['Заказано на сумму, ₽','₽'],
 ['Средняя цена, ₽','₽'],
 ['Остаток на конец периода, штуки','шт.'],
 ['Показы всего',''],
 ['Просмотры карточки',''],
 ['Конверсия из показа в заказ, %','%'],
 ['Доля выкупа, %','%'],
 ['Доля рекламных расходов, %','%'],
];

export function cabinetComparisonPage(c:Cabinet|null){
 const nav=competitorSourceSwitch('comparison');
 const title='GENGLASS · Сравнение с конкурентами';
 if(!c) return cabinetShell(title,nav+'<section><p>Проверенные выгрузки Ozon ещё не доступны.</p></section>','','competitors');
 const own=new Map(c.watch.filter(row=>row.role==='own'||row.role==='own_variant').map(row=>[row.sku,row]));
 const groups=new Map<string,{product:Watch;rivals:Watch[]}>();
 for(const rival of c.watch){
  const product=own.get(rival.pair_own);
  if(rival.role!=='comp'||!product)continue;
  const group=groups.get(product.sku)??{product,rivals:[]};
  group.rivals.push(rival);
  groups.set(product.sku,group);
 }
 const pairs=[...groups.values()];
 const needed=new Set(pairs.flatMap(g=>[g.product.sku,...g.rivals.map(r=>r.sku)]));
 const columns=metrics.map(([header])=>competitorHeaders.indexOf(header!));
 const windows=Object.fromEntries([7,28].map(days=>{
  const rows=new Map<string,{name:string|null;seller:string|null;values:(number|null)[]}>();
  const exports=c.exports.filter(e=>e.days===days);
  for(const kind of ['genglass-all','tables','mirrors']){
   for(const row of exports.find(e=>e.kind===kind)?.rows??[]){
    const sku=String(row[0]);
    if(!needed.has(sku)||rows.has(sku))continue;
    rows.set(sku,{name:typeof row[1]==='string'?row[1]:null,seller:typeof row[3]==='string'?row[3]:null,
     values:columns.map(i=>typeof row[i]==='number'?row[i] as number:null)});
   }
  }
  return [days,Object.fromEntries(rows)];
 }));

 const html=nav+`<section><h2>Наши товары и их конкуренты</h2>
 <p class="note">Кабинет Ozon обновил данные ${esc(stamp(c.source_updated_at))}. Выгрузки получены ${esc(stamp(c.captured_at))}.</p>
 <label>Период <select id="compare-window"><option value="28">28 дней</option><option value="7">7 дней</option></select></label>
 <label>Наш товар <select id="compare-product"></select></label>
 <label>Показатель графика <select id="compare-metric">${metrics.map(([name],i)=>`<option value="${i}">${esc(name)}</option>`).join('')}</select></label>
 <p id="compare-coverage" role="status"></p>
 <div id="compare-chart" aria-label="График сравнения"></div>
 <div class="scroll"><table><thead><tr><th>Товар</th>${metrics.map(([name])=>`<th>${esc(name)}</th>`).join('')}</tr></thead><tbody id="compare-rows"></tbody></table></div>
 <p class="note">Каждая колонка сравнивает товары за одно выбранное окно. Если SKU отсутствует в выгрузке, значения остаются пустыми. График показывает итоги окна по каждому SKU.</p></section>`;
 const js=cabinetClientHelpers+`
 const pairs=${jsonHtml(pairs)}, windows=${jsonHtml(windows)}, metrics=${jsonHtml(metrics)};
 const period=$('#compare-window'), products=$('#compare-product'), metric=$('#compare-metric');
 function updateProducts(){
  const rows=windows[period.value], old=products.value;
  const complete=g=>rows[g.product.sku]&&g.rivals.some(r=>rows[r.sku]);
  const sorted=[...pairs].sort((a,b)=>Number(Boolean(complete(b)))-Number(Boolean(complete(a))));
  products.innerHTML=sorted.map(g=>'<option value="'+esc(g.product.sku)+'">'+esc(g.product.model)+' · '+esc(g.product.sku)+(complete(g)?'':' · неполные данные')+'</option>').join('');
  if(sorted.some(g=>g.product.sku===old))products.value=old;
  render();
 }
 function render(){
  const rows=windows[period.value], group=pairs.find(g=>g.product.sku===products.value);
  if(!group){$('#compare-coverage').textContent='В списке наблюдения пока нет сопоставлений.';return;}
  const compared=pairs.reduce((n,g)=>n+g.rivals.filter(r=>rows[g.product.sku]&&rows[r.sku]).length,0);
  const count=pairs.reduce((n,g)=>n+g.rivals.length,0);
  $('#compare-coverage').textContent='Обе стороны найдены у '+compared+' из '+count+' пар за выбранное окно.';
  const index=Number(metric.value), unit=metrics[index][1];
  const items=[group.product,...group.rivals].map((p,i)=>({
   p,row:rows[p.sku],value:rows[p.sku]?.values[index]??null, own:i===0
  }));
  const max=Math.max(0,...items.map(x=>x.value??0));
  const label=x=>(x.own?'GENGLASS':x.row?.seller||x.p.seller)+' · SKU '+x.p.sku;
  $('#compare-chart').innerHTML=items.map(x=>{
   const value=x.value==null?'Нет данных':fmt(x.value)+(unit?' '+unit:'');
   const bar=x.value==null||max<=0?'':'<div style="width:'+Math.max(0,x.value/max*100)+'%;height:10px;border-radius:5px;background:'+(x.own?'#22d3ee':'#a78bfa')+'"></div>';
   return '<div style="margin:12px 0"><strong>'+esc(label(x))+'</strong> · '+value+'<div style="background:#263342;border-radius:5px;margin-top:5px">'+bar+'</div></div>';
  }).join('');
  $('#compare-rows').innerHTML=items.map(x=>{
   const title=x.row?.name||x.p.model;
   const link='<a href="https://www.ozon.ru/product/'+esc(x.p.sku)+'/">'+esc(label(x))+'</a>';
   return '<tr><td>'+link+'<br>'+esc(title)+'</td>'+metrics.map((_,i)=>'<td>'+fmt(x.row?.values[i])+'</td>').join('')+'</tr>';
  }).join('');
 }
 period.onchange=updateProducts;
 products.onchange=metric.onchange=render;
 updateProducts();
 `;
 return cabinetShell(title,html,js,'competitors');
}
