import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

export const numericFields=['cap','buyer','stock_ozon','stock_seller','commission_fbo','commission_fbs','logistics_fbo_min','logistics_fbo_max','logistics_fbs_min','logistics_fbs_max','acquiring','gap_pct'] as const;
export const textFields=['sku','art','name','status','price_index','auto_promo'] as const;
export type CatalogItem = Record<typeof numericFields[number],number|null>&Record<typeof textFields[number],string|null>;
export type Catalog = {day:string;captured_at:string;phase:string;source:string;source_sha256:string;expected:number|null;items:CatalogItem[]};
const date=(s:any)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const stamp=(s:any)=>typeof s==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(s)&&Number.isFinite(Date.parse(s));
const msk=(s:string)=>new Date(Date.parse(s)+3*3600000).toISOString().slice(0,10);
const keys=(x:any,allowed:readonly string[])=>{if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!allowed.includes(k)))throw Error('Supplement unexpected fields');};
const safe=(v:any)=>typeof v==='string'&&v.length<=3000&&!/\/(?:Users|home)\/|\b(?:Bearer |ghp_|sk-proj-)/.test(v);
export const competitorHeaders=["SKU", "Название товара", "Ссылка на товар", "Продавец", "Бренд", "Категория 1 уровня", "Категория 3 уровня", "Признак товара", "Заказано на сумму, ₽", "Динамика оборота, %", "Заказано, штуки", "Средняя цена, ₽", "Минимальная цена, ₽", "Доля выкупа, %", "Упущенные продажи", "Дней без остатка", "Среднесуточные продажи, ₽", "Среднесуточные продажи, штуки", "Остаток на конец периода, штуки", "Схема работы", "Объем товара, л", "Показы всего", "Просмотры в поиске и каталоге", "Просмотры карточки", "Конверсия из показа в заказ, %", "В корзину из поиска и каталога, %", "В корзину из карточки, %", "Скидка от медианной цены, %", "Доля суммы заказов по акциям, %", "Дней в акциях", "Дней с продвижением", "Доля рекламных расходов, %", "Дата создания карточки товара"];
export function validateSupplements(raw:any){
 if(raw.catalogs!==undefined){
  if(!Array.isArray(raw.catalogs)||raw.catalogs.length>1500)throw Error('Catalog list');
  const seen=new Set<string>();
  for(const r of raw.catalogs){
   keys(r,['day','captured_at','phase','source','source_sha256','expected','items']);
   const key=r.day+'|'+r.phase;
   if(!date(r.day)||!stamp(r.captured_at)||msk(r.captured_at)!==r.day||!['утро','вечер','once'].includes(r.phase)||seen.has(key))throw Error('Catalog date/key');
   seen.add(key);
   if(r.source!=='ozon-catalog-xlsx'||!/^[0-9a-f]{64}$/.test(r.source_sha256)||!Array.isArray(r.items)||!r.items.length||r.items.length>20000)throw Error('Catalog provenance');
   if(r.expected!==null&&(!Number.isSafeInteger(r.expected)||r.expected!==r.items.length))throw Error('Catalog coverage');
   const skus=new Set(),arts=new Set();
   for(const x of r.items){
    keys(x,[...numericFields,...textFields]);
    if(!/^\d+$/.test(x.sku)||!safe(x.art)||!x.art||skus.has(x.sku)||arts.has(x.art))throw Error('Catalog product key');
    skus.add(x.sku);arts.add(x.art);
    for(const k of textFields)if(x[k]!==null&&!safe(x[k]))throw Error('Catalog text');
    for(const k of numericFields)if(x[k]!==null&&(!Number.isFinite(x[k])||x[k]<0))throw Error('Catalog number');
    const gap=x.cap>0&&x.buyer!==null&&x.buyer<=x.cap?100*(1-x.buyer/x.cap):null;
    if(gap===null?x.gap_pct!==null:x.gap_pct===null||Math.abs(gap-x.gap_pct)>1e-7)throw Error('Catalog price gap');
   }
  }
 }
 if(raw.competitors!==undefined){
  const c=raw.competitors;keys(c,['captured_at','source_updated_at','exports','watch']);
  if(!stamp(c.captured_at)||!stamp(c.source_updated_at)||Date.parse(c.source_updated_at)>Date.parse(c.captured_at)||!Array.isArray(c.exports)||c.exports.length!==6)throw Error('Competitor provenance');
  const seen=new Set();
  const canonical=competitorHeaders;
  for(const e of c.exports){
   keys(e,['kind','days','headers','rows','sha256']);
   if(!['genglass-all','tables','mirrors'].includes(e.kind)||![7,28].includes(e.days)||seen.has(e.kind+e.days)||!/^[0-9a-f]{64}$/.test(e.sha256))throw Error('Competitor window/key');
   seen.add(e.kind+e.days);
   if(!Array.isArray(e.headers)||new Set(e.headers).size!==e.headers.length||JSON.stringify(e.headers)!==JSON.stringify(canonical)||e.headers[0]!=='SKU'||e.headers.some((v:any)=>!safe(v))||!Array.isArray(e.rows)||!e.rows.length||e.rows.length>20000)throw Error('Competitor columns');
   const skus=new Set();
   for(const row of e.rows){
    if(!Array.isArray(row)||row.length!==e.headers.length||!/^\d+$/.test(row[0])||skus.has(row[0]))throw Error('Competitor duplicate/schema');
    skus.add(row[0]);
    for(const v of row)if(v!==null&&!(typeof v==='number'?Number.isFinite(v):safe(v)))throw Error('Competitor value');
   }
  }
  if(!Array.isArray(c.watch)||!c.watch.length||c.watch.length>5000)throw Error('Competitor watchlist');
  const skus=new Set();
  for(const w of c.watch){keys(w,['sku','role','model','seller','pair_own']);if(!/^\d+$/.test(w.sku)||skus.has(w.sku)||!['own','own_variant','comp','comp_pending'].includes(w.role)||Object.values(w).some(v=>!safe(v)))throw Error('Competitor watch identity');skus.add(w.sku);}
 }
}
export function supplements(dir:string):{catalogs:Catalog[];competitors:any|null}{
 const p=join(dir,'cabinet_capture.json');if(!existsSync(p))return {catalogs:[],competitors:null};
 const raw=JSON.parse(readFileSync(p,'utf8'));validateSupplements(raw);
 return {catalogs:raw.catalogs??[],competitors:raw.competitors??null};
}
export function catalogGaps(catalogs:Catalog[]){
 const rows=new Map<string,any>();
 for(const c of [...catalogs].sort((a,b)=>Date.parse(a.captured_at)-Date.parse(b.captured_at)))for(const r of c.items){
  rows.set(c.day+'|'+r.art,{date:c.day,art:r.art,sku:r.sku,gap_pct:r.gap_pct,site_to_seller:r.cap&&r.buyer!==null?r.buyer/r.cap:null,cap:r.cap,buyer:r.buyer,src:'catalog_realization',price_basis:'realization',ts:c.captured_at});
 }
 return [...rows.values()];
}
export const escapeHtml=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const jsonHtml=(v:unknown)=>JSON.stringify(v).replace(/</g,'\\u003c');
