// Read-only contract probe. Never publishes raw postings, customer details or credentials.
import { mkdirSync, writeFileSync } from 'node:fs';
import { OzonSeller } from '../../connector/ozon-seller.js';

const clientId=process.env.OZON_SELLER_CLIENT_ID??'', apiKey=process.env.OZON_SELLER_API_KEY??'';
if(!clientId||!apiKey) throw new Error('Missing Seller API credentials');
const seller=new OzonSeller({clientId,apiKey});
const now=new Date(), to=new Date(now.getTime()-86400000).toISOString().slice(0,10), from=new Date(now.getTime()-35*86400000).toISOString().slice(0,10);
const result:Record<string,unknown>={loaded_at:now.toISOString(),from,to};
const shape=(v:any,depth=5):any=>Array.isArray(v)?{array:v.length,sample:v.length?shape(v[0],depth):null}:v&&typeof v==='object'?depth?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,shape(x,depth-1)])):'object':v===null?'null':typeof v;
const pick=(v:any,keys:string[])=>Object.fromEntries(keys.filter(k=>v?.[k]!==undefined).map(k=>[k,v[k]]));
const safePosting=(p:any)=>({
 ...pick(p,['posting_number','status','substatus','in_process_at','created_at','shipment_date','shipment_date_without_delay','delivering_date','fact_delivery_date','is_express','is_multibox','cancellation','delivery_method']),
 analytics_data:pick(p.analytics_data,['delivery_type','is_premium','is_legal','warehouse_id','warehouse','delivery_date_begin','delivery_date_end']),
 products:(p.products??[]).map((x:any)=>pick(x,['sku','offer_id','quantity','price'])),
});
async function probe(name:string,fn:()=>Promise<any>,sample:(d:any)=>any=(d:any)=>d){
 try{const d=await fn();result[name]={ok:true,shape:shape(d),data:sample(d)};console.log('PROBE',name,'OK');}
 catch(e){let msg=String((e as Error).message);for(const s of [clientId,apiKey])if(s)msg=msg.split(s).join('***');result[name]={ok:false,error:msg.slice(0,1000)};console.log('PROBE',name,'FAILED');}
}
await probe('postings',()=>seller.postings(from,to),d=>({count:d.length,samples:[...d.filter((p:any)=>p.src==='FBS'&&p.status==='cancelled').slice(0,5),...d.filter((p:any)=>p.src==='FBS'&&p.status==='delivered').slice(-3),...d.filter((p:any)=>p.src==='FBS'&&p.status!=='delivered'&&p.status!=='cancelled').slice(-3)].map((p:any)=>safePosting(p.raw))}));
await probe('rating_summary',()=>(seller as any).post('/v1/rating/summary',{}));
await probe('rating_history',()=>(seller as any).post('/v1/rating/history',{date_from:from+'T00:00:00Z',date_to:to+'T23:59:59Z',ratings:['rating_general_indicator_fbs_rfbs']}));
await probe('rating_index',()=>(seller as any).post('/v1/rating/index/fbs/info',{}));
await probe('rating_postings',()=>(seller as any).post('/v1/rating/index/fbs/posting/list',{limit:100,offset:0}));
await probe('rating_postings_filter',()=>(seller as any).post('/v1/rating/index/fbs/posting/list',{filter:{},limit:100,offset:0}));
await probe('fbs_fields',()=>(seller as any).post('/v4/posting/fbs/list',{cursor:'',filter:{since:from+'T00:00:00Z',to:to+'T23:59:59Z'},limit:100,sort_dir:'desc',with:{analytics_data:true,financial_data:false}}),d=>({keys:Object.keys(d),samples:(d.postings??d.result?.postings??[]).slice(0,3).map(safePosting)}));
await probe('fbs_get',()=>(seller as any).post('/v3/posting/fbs/get',{posting_number:'03224814-0251-1',with:{analytics_data:true,financial_data:false}}),d=>safePosting(d.result??d));
await probe('returns',()=>(seller as any).post('/v1/returns/list',{filter:{logistic_return_date:{time_from:from+'T00:00:00Z',time_to:to+'T23:59:59Z'}},limit:500,last_id:0}),d=>({has_next:d.has_next,last_id:d.last_id,samples:(d.returns??d.result?.returns??[]).slice(0,5).map((r:any)=>({...pick(r,['id','posting_number','return_reason_name','type','schema','visual','status','created_at','return_date','logistic_return_date','returned_at']),product:pick(r.product,['sku','offer_id','quantity','price']),logistic:pick(r.logistic,['return_date','returned_to_seller_date','final_moment','technical_return_moment'])}))}));
await probe('accrual_types',()=>seller.accrualTypes());
await probe('accrual_day',()=>seller.accrualByDay(to),d=>({count:d.length,samples:d.slice(0,4).map((r:any)=>pick(r,['accrual_id','date','total_amount','accrued_category','posting','item_fees','non_item_fee','container_fees']))}));
mkdirSync('probe-output',{recursive:true});writeFileSync('probe-output/problems-probe.json',JSON.stringify(result,null,2));
