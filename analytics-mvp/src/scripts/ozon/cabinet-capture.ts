import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

const metrics = ['views','search_views','pdp_views','cart','ordered_units'] as const;
type Metric = typeof metrics[number];
export type CaptureItem = {sku:string;scheme:string|null;search_position:number|null} & Record<Metric,number|null>;
export type CabinetCapture = {version:1;company:'GENGLASS';day:string;captured_at:string;phase:string;day_in_progress:boolean;
 scope:{expected:number;received:number;matched:number;missing:number;extra:number;status:'partial'|'complete'};
 totals:Record<Metric,number|null>;items:CaptureItem[];source:string;not_refreshed:string[]};
export type CaptureFile = {version:1;company:'GENGLASS';snapshots:CabinetCapture[]};
const keys=(o:any,allowed:string[])=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!allowed.includes(k)))throw Error('Cabinet capture: unexpected fields');};
const count=(x:any)=>Number.isSafeInteger(x)&&x>=0;
export function validateCaptureFile(raw:any):CaptureFile {
 keys(raw,['version','company','snapshots']);
 if(raw.version!==1||raw.company!=='GENGLASS'||!Array.isArray(raw.snapshots))throw Error('Cabinet capture: contract');
 const seen=new Set<string>();
 for(const r of raw.snapshots){
  keys(r,['version','company','day','captured_at','phase','day_in_progress','scope','totals','items','source','not_refreshed']);
  const k=r.day+'|'+r.phase;
  if(r.version!==1||r.company!=='GENGLASS'||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||new Date(r.day).toISOString().slice(0,10)!==r.day||!Number.isFinite(Date.parse(r.captured_at))||!/(?:Z|[+-]\d\d:\d\d)$/.test(r.captured_at)||!['утро','вечер','once'].includes(r.phase)||typeof r.day_in_progress!=='boolean'||seen.has(k))throw Error('Cabinet capture: date/key');
  seen.add(k);
  if(r.source!=='ozon-native-daily-product-report'||!Array.isArray(r.not_refreshed)||r.not_refreshed.some((x:any)=>typeof x!=='string'||!/^[a-z_]+$/.test(x)))throw Error('Cabinet capture: provenance');
  keys(r.scope,['expected','received','matched','missing','extra','status']);keys(r.totals,[...metrics]);
  const s=r.scope;
  if(![s.expected,s.received,s.matched,s.missing,s.extra].every(count)||s.expected===0||s.received===0||s.matched+s.missing!==s.expected||s.matched+s.extra!==s.received||s.status!==(s.missing?'partial':'complete')||!Array.isArray(r.items)||!r.items.length)throw Error('Cabinet capture: scope');
  const sku=new Set<string>(),itemKeys=new Set<string>();
  for(const item of r.items){
   keys(item,['sku','scheme','search_position',...metrics]);
   const key=item.sku+'|'+item.scheme;
   if(typeof item.sku!=='string'||!/^\d+$/.test(item.sku)||!(item.scheme===null||['FBO','FBS','FBS, FBO','FBO, FBS','realFBS','rFBS'].includes(item.scheme))||itemKeys.has(key))throw Error('Cabinet capture: item key');
   sku.add(item.sku);itemKeys.add(key);
   if(item.search_position!==null&&(!Number.isFinite(item.search_position)||item.search_position<0))throw Error('Cabinet capture: position');
   for(const field of metrics)if(item[field]!==null&&!count(item[field]))throw Error('Cabinet capture: metric');
  }
  if(sku.size!==s.received)throw Error('Cabinet capture: received count');
  for(const field of metrics){
   const total=r.items.every((x:any)=>x[field]!==null)?r.items.reduce((a:number,x:any)=>a+x[field],0):null;
   if(r.totals[field]!==total)throw Error('Cabinet capture: totals');
  }
 }
 return raw;
}
export function readCaptureFile(dir:string):CaptureFile|null {
 const p=join(dir,'cabinet_capture.json');return existsSync(p)?validateCaptureFile(JSON.parse(readFileSync(p,'utf8'))):null;
}
export function latestCapture(file:CaptureFile):CabinetCapture|null {
 return [...file.snapshots].sort((a,b)=>a.day.localeCompare(b.day)||a.captured_at.localeCompare(b.captured_at)).at(-1)??null;
}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const value=(n:number|null)=>n===null?'нет данных':n.toLocaleString('ru-RU');
export function captureHistoryHtml(file:CaptureFile):string {
 const days=[...new Set(file.snapshots.map(r=>r.day))].sort().reverse();
 const rows=days.map(day=>latestCapture({...file,snapshots:file.snapshots.filter(r=>r.day===day)})!);
 const stamp=(r:CabinetCapture)=>new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(r.captured_at));
 return `<section class="kt-card cabinet-history" style="margin:16px;padding:16px;border:1px solid #eab308;border-radius:8px"><h2>Дневные отчёты кабинета</h2><p>Для каждой даты показана последняя выгрузка. Утренний и вечерний снимки одного дня не складываются. Даты этого блока независимы от выбранного периода истории API.</p><div class="tscroll" style="overflow:auto"><table><thead><tr><th>Дата данных</th><th>Снято, МСК</th><th>Охват SKU</th><th>Показы</th><th>Поиск и каталог</th><th>Посещения карточек</th><th>Корзины</th><th>Заказано, шт.</th><th>Состояние дня</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.day)}</td><td>${esc(stamp(r))}</td><td>${r.scope.matched} из ${r.scope.expected}; дополнительно ${r.scope.extra}; отсутствуют ${r.scope.missing}</td>${metrics.map(k=>`<td>${value(r.totals[k])}</td>`).join('')}<td>${r.day_in_progress?'День не завершён':'Дневной отчёт'}</td></tr>`).join('')}</tbody></table></div></section>`;
}
export function cabinetCaptureHtml(dir:string):string {
 const file=readCaptureFile(dir),r=file&&latestCapture(file);if(!r)return '';
 const when=new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(r.captured_at));
 const labels:Record<Metric,string>={views:'Показы всего',search_views:'Показы в поиске и каталоге',pdp_views:'Посещения карточек',cart:'Добавления в корзину',ordered_units:'Заказано товаров'};
 const rows=[...r.items].sort((a,b)=>(b.views??-1)-(a.views??-1)).slice(0,20);
 return `<section class="kt-card cabinet-capture" style="margin:16px;padding:16px;border:1px solid #eab308;border-radius:8px"><h2>Оперативный срез кабинета Ozon</h2><p>Дата данных: ${esc(r.day)}. Снято ${esc(when)} МСК. ${r.day_in_progress?'День не завершён.':'Дневной отчёт.'}</p><p>Выгружено ${r.scope.received} SKU. Из ожидаемого списка получено ${r.scope.matched} из ${r.scope.expected}; не наблюдались ${r.scope.missing}. ${r.scope.extra?'Дополнительно в отчёте: '+r.scope.extra+' SKU.':''}</p><p>Показатели ниже относятся к этому срезу. История API сохраняется отдельно.</p><table><tbody>${metrics.map(k=>`<tr><th style="text-align:left;padding:4px 16px 4px 0">${labels[k]}</th><td>${value(r.totals[k])}</td></tr>`).join('')}</tbody></table><details><summary>20 SKU с наибольшим числом показов</summary><div style="overflow:auto"><table><thead><tr><th>SKU</th><th>Показы</th><th>Посещения</th><th>Корзины</th><th>Заказано, шт.</th><th>Позиция в поиске</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.sku)}</td><td>${value(x.views)}</td><td>${value(x.pdp_views)}</td><td>${value(x.cart)}</td><td>${value(x.ordered_units)}</td><td>${value(x.search_position)}</td></tr>`).join('')}</tbody></table></div></details><p style="opacity:.75">Цена по карте, соинвест, состав бустинга и фактический тариф FBS этим отчётом не обновлялись.</p></section>` + captureHistoryHtml(file!);
}
