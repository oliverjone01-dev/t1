import {existsSync,readFileSync} from 'node:fs';
export type CpoCapture={version:1;from:string;to:string;captured_at:string;source:'ozon-cpo-order-export';orders_sha256:string;source_sha256:string[];sku:Array<{d:string;sku:string;offer:string;sp:number;n:number}>;report_days:Array<{d:string;sp:number;n:number}>;order_days:Array<{d:string;sp:number;rev:number;units:number}>;miss:Array<{month:string;n:number;sp:number}>;no_sku_sp:number;settings:{captured_at:string;scope:'all';active:boolean;bid_percent:number;promoted_products:number;products_period_from:string;products_period_to:string}};
const keys=(x:any,ks:string[])=>{if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!ks.includes(k))||ks.some(k=>!(k in x)))throw Error('CPO capture fields');};
const date=(x:any)=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
const stamp=(x:any)=>typeof x==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
const num=(x:any)=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const cents=(x:any)=>num(x)&&Math.abs(x*100-Math.round(x*100))<1e-5;
const count=(x:any)=>Number.isSafeInteger(x)&&x>=0;
export function validateCpo(x:any):CpoCapture{
 keys(x,['version','from','to','captured_at','source','orders_sha256','source_sha256','sku','report_days','order_days','miss','no_sku_sp','settings']);
 if(x.version!==1||!date(x.from)||!date(x.to)||x.from>x.to||!stamp(x.captured_at)||x.to>=new Date(Date.parse(x.captured_at)+10800000).toISOString().slice(0,10)||x.source!=='ozon-cpo-order-export'||!/^[a-f0-9]{64}$/.test(x.orders_sha256)||!Array.isArray(x.source_sha256)||!x.source_sha256.length||x.source_sha256.some((s:any)=>!/^[a-f0-9]{64}$/.test(s)))throw Error('CPO capture provenance');
 const sum=(rows:any[],k:string)=>rows.reduce((a,r)=>a+r[k],0), eq=(a:number,b:number)=>Math.abs(a-b)<.011;
 for(const [name,fields] of [['sku',['d','sku','offer','sp','n']],['report_days',['d','sp','n']],['order_days',['d','sp','rev','units']],['miss',['month','n','sp']]] as const){
  if(!Array.isArray(x[name])||x[name].length>100000)throw Error('CPO capture rows');const seen=new Set();
  for(const r of x[name]){keys(r,[...fields]);const key=name==='sku'?r.d+'|'+r.sku:name==='miss'?r.month:r.d;
   if(seen.has(key)||!cents(r.sp))throw Error('CPO capture duplicate/amount');seen.add(key);
   if(name==='miss'){if(!/^\d{4}-\d{2}$/.test(r.month)||r.month<x.from.slice(0,7)||r.month>x.to.slice(0,7)||!count(r.n))throw Error('CPO missing month');}
   else if(!date(r.d)||(name!=='order_days'&&(r.d<x.from||r.d>x.to)))throw Error('CPO capture row date');
   if(name==='sku'&&(!/^\d+$/.test(r.sku)||Number(r.sku)<=0||typeof r.offer!=='string'||!/^[\p{L}\p{N}_. /()-]{1,200}$/u.test(r.offer)||!count(r.n)))throw Error('CPO SKU identity/count');
   if(name==='report_days'&&!count(r.n))throw Error('CPO line count');
   if(name==='order_days'&&(!cents(r.rev)||!count(r.units)||r.d>x.to))throw Error('CPO order aggregate');
  }
 }
 if(!cents(x.no_sku_sp)||!eq(sum(x.report_days,'sp'),sum(x.sku,'sp')+x.no_sku_sp)||!eq(sum(x.report_days,'sp'),sum(x.order_days,'sp')+sum(x.miss,'sp')))throw Error('CPO capture conservation');
 const days=(Date.parse(x.to)-Date.parse(x.from))/86400000+1;if(x.report_days.length!==days)throw Error('CPO daily coverage');
 for(const d of x.report_days)if(sum(x.sku.filter((r:any)=>r.d===d.d),'sp')>d.sp+.011||sum(x.sku.filter((r:any)=>r.d===d.d),'n')>d.n)throw Error('CPO daily SKU total');
 keys(x.settings,['captured_at','scope','active','bid_percent','promoted_products','products_period_from','products_period_to']);const s=x.settings;
 if(!stamp(s.captured_at)||s.scope!=='all'||typeof s.active!=='boolean'||!num(s.bid_percent)||s.bid_percent>100||!count(s.promoted_products)||!date(s.products_period_from)||!date(s.products_period_to)||s.products_period_from>s.products_period_to)throw Error('CPO settings');
 return x;
}
export function readCpo(dp:(f:string)=>string):CpoCapture|null{const p=dp('cabinet_capture.json');if(!existsSync(p))return null;const c=JSON.parse(readFileSync(p,'utf8')).cpo;return c===undefined?null:validateCpo(c);}
export function cpoSkuRows(dp:(f:string)=>string,legacy:any[]):any[]{const c=readCpo(dp);return c?[...legacy.filter(r=>r.d<c.from||r.d>c.to),...c.sku]:legacy;}
export function cpoSettingsHtml(dp:(f:string)=>string){const c=readCpo(dp);if(!c)return '';const s=c.settings;return `<section class="kt-card" style="margin:16px;padding:16px;border:1px solid #334155"><h2>Оплата за заказ: текущая настройка</h2><p>«Все товары»: ${s.active?'продвижение активно':'продвижение остановлено'}, ставка ${s.bid_percent}%. В выбранном периоде кабинета ${s.products_period_from} — ${s.products_period_to} указано ${s.promoted_products} товаров в продвижении. Снято ${s.captured_at}.</p><p>Эта общая настройка не восстанавливает ставки прошлых дней и не подтверждает участие каждого отдельного SKU. Старый раздел «Выбранные товары» имеет самостоятельный статус.</p><p>Расход по товарам: ${c.from} — ${c.to}; даты и суммы из выгрузки CPO. Выручка связанных заказов относится к дате создания заказа, поэтому дневные ряды могут отличаться.</p><p>Точная разбивка нового CPO по отправлениям не опубликована. В таблицах по дате заказа расход и зависящие от него выплата/прибыль отмечены «нет данных» на затронутые даты. Расход по SKU и кампании доступен отдельно.</p></section>`;}
