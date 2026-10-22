import { readFileSync } from 'node:fs';

export type Metric = 'price'|'sitePrice'|'apiSellerPrice'|'priceDifference'|'orders28'|'revenue28'|'rating'|'reviews'|'reviewChange7'|'stock'|'stockFbsCatalog'|'categoryRank'|'searchPosition'|'keywordsCount'|'searchVisibility'|'crSearchToCard'|'crCardToCart'|'crCartToOrder';
export type HistoryKey='price'|'orders'|'reviews'|'rating'|'stock'|'searchPosition'|'keywordsCount'|'searchVisibility';
export type Point={date:string;observed:boolean|null}&Record<HistoryKey,number|null>;
type Ref={file:string;sha256:string;field:string;collectedAt?:string;date?:string};
export type Product={sku:string;own:boolean;modelId:string;article:string|null;seller:string;name:string;attributes:Record<string,unknown>;metrics:Record<Metric,number|null>;metricDate:string;history:Point[];dailyVerified:boolean;observedDays:number|null;provenance:{mpstats:Ref;catalog:Ref;cabinet?:Ref;api?:Ref};keywords:{period:{d1:string;d2:string};rows:{query:string;avg_position:number|null;positions:(number|null)[]}[];source:Ref}[]};
export type Pair={ownSku:string;competitorSku:string;modelId:string;row:number;mappingCell:string;comment:string|null;group:string|null;comparison:{ownSku:string;status:string;differences:string[];missing:string[]}};
export type MatchedSnapshot={schemaVersion:1;period:{d1:string;d2:string};models:{id:string;name:string;rank:number|null}[];products:Record<string,Product>;pairs:Pair[];pendingOriginal:{sku:string;seller:string;name:string;row:number}[];excluded:{sku:string;row:number;reason:string;color:string}[];source:{workbook:string;workbookSha256:string;mappingSheet:string;mappingColumns:string;mpstatsBundleSha256:string}};
const metrics:Metric[]=['price','sitePrice','apiSellerPrice','priceDifference','orders28','revenue28','rating','reviews','reviewChange7','stock','stockFbsCatalog','categoryRank','searchPosition','keywordsCount','searchVisibility','crSearchToCard','crCardToCart','crCartToOrder'];
const historyKeys:HistoryKey[]=['price','orders','reviews','rating','stock','searchPosition','keywordsCount','searchVisibility'];
function assert(ok:unknown,message:string):asserts ok{if(!ok)throw new Error('competitors: '+message);}
const numeric=(n:unknown)=>n===null||typeof n==='number'&&Number.isFinite(n);

export function validateMatchedSnapshot(input:unknown):MatchedSnapshot{
 const s=input as MatchedSnapshot;
 assert(s&&s.schemaVersion===1,'unsupported snapshot');
 assert(/^\d{4}-\d{2}-\d{2}$/.test(s.period?.d1)&&/^\d{4}-\d{2}-\d{2}$/.test(s.period?.d2),'invalid period');
 const days=Math.round((Date.parse(s.period.d2)-Date.parse(s.period.d1))/864e5)+1;
 assert(days===28&&s.period.d1==='2026-09-23'&&s.period.d2==='2026-10-20','unapproved reporting period');
 assert(Array.isArray(s.models)&&Array.isArray(s.pairs)&&s.pairs.length>0,'no mapping');
 const modelIds=new Set(s.models.map(m=>m.id));assert(modelIds.size===s.models.length,'duplicate model');
 const pairKeys=new Set<string>(),productIds=new Set<string>();
 for(const r of s.pairs){
  assert(/^\d+$/.test(r.ownSku)&&/^\d+$/.test(r.competitorSku),'invalid SKU');
  const key=r.ownSku+'|'+r.competitorSku;assert(!pairKeys.has(key),'duplicate pair');pairKeys.add(key);
  const a=s.products[r.ownSku],b=s.products[r.competitorSku];
  assert(a?.own===true&&b?.own===false,'mapping roles');
  assert(modelIds.has(r.modelId)&&a.modelId===r.modelId,'mapping model');
  assert(/^[AI]\d+$/.test(r.mappingCell)&&r.row>0,'mapping cell');
  productIds.add(r.ownSku);productIds.add(r.competitorSku);
 }
 assert(productIds.size===Object.keys(s.products).length,'unmapped product');
 for(const [sku,p] of Object.entries(s.products)){
  assert(sku===p.sku&&productIds.has(sku),'product key');
  assert(metrics.every(k=>numeric(p.metrics[k])),'non-finite metric '+sku);
  assert(p.metrics.price===null||p.metrics.price>0,'invalid price '+sku);
  assert(p.metrics.rating===null||p.metrics.rating>=0&&p.metrics.rating<=5,'invalid rating');
  assert(['crSearchToCard','crCardToCart','crCartToOrder'].every(k=>p.metrics[k as Metric]===null),'unconfirmed CR');
  assert(p.history.length===days,'history length '+sku);
  p.history.forEach((h,i)=>{
   const expected=new Date(Date.parse(s.period.d1)+i*864e5).toISOString().slice(0,10);
   assert(h.date===expected,'history dates '+sku);
   assert(historyKeys.every(k=>numeric(h[k])),'invalid history '+sku);
   assert(h.observed===true||h.observed===false||h.observed===null,'observation flag');
   assert(h.observed!==false||historyKeys.every(k=>h[k]===null),'no_data is not null '+sku);
   assert(p.dailyVerified?h.observed!==null:h.observed===null,'coverage flag mismatch');
  });
  assert(p.dailyVerified?p.observedDays===p.history.filter(h=>h.observed===true).length:p.observedDays===null,'observation count');
  assert(p.metrics.price===p.history[days-1]?.price,'price is not the closing calendar observation');
  assert(Array.isArray(p.keywords),'missing keyword reports');
  for(const report of p.keywords){
   assert(report.period.d1===s.period.d1&&report.period.d2===s.period.d2,'keyword period');
   assert(new Set(report.rows.map(r=>r.query)).size===report.rows.length,'duplicate query');
   assert(report.rows.every(r=>typeof r.query==='string'&&numeric(r.avg_position)&&r.positions.length===days&&r.positions.every(numeric)),'invalid query report');
  }
  if(p.own){
   assert(p.provenance.api?.date===s.period.d2&&p.provenance.cabinet?.date===s.period.d2,'mixed own price dates');
   assert(p.provenance.api?.field==='price'&&p.provenance.cabinet?.field==='site','mixed own price meanings');
   const expected=p.metrics.price===null||p.metrics.sitePrice===null?null:p.metrics.price-p.metrics.sitePrice;
   assert(p.metrics.priceDifference===expected,'invalid price difference');
  }else assert(p.metrics.sitePrice===null&&p.metrics.apiSellerPrice===null&&p.metrics.priceDifference===null,'own prices on rival');
  for(const ref of [...Object.values(p.provenance),...p.keywords.map(r=>r.source)]){
   assert(ref&&/^[a-f0-9]{64}$/.test(ref.sha256),'source hash');
   assert(!/[\/\\]/.test(ref.file),'source path is not a basename');
  }
 }
 assert(s.excluded.every(r=>!s.pairs.some(p=>p.competitorSku===r.sku)),'excluded competitor assigned');
 const text=JSON.stringify(s);
 assert(!/\/Users\/|config\.toml|mcp\.mpstats\.io|"(?:siteRow|apiRow|catalogRaw|dailyRaw|token|api_key|access_token)"/i.test(text),'private source payload');
 return s;
}
export const loadMatchedSnapshot=(file:string):MatchedSnapshot=>validateMatchedSnapshot(JSON.parse(readFileSync(file,'utf8')));
