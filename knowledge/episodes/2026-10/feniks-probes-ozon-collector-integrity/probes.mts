import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root='/Users/gengroup/Documents/Codex/t1/analytics-mvp/src';
const ci=await import(root+'/scripts/ozon/collector-integrity.ts');
const {OzonSeller}=await import(root+'/connector/ozon-seller.ts');
const {OzonPerformance}=await import(root+'/connector/ozon-performance.ts');
const {attributionReport}=await import(root+'/scripts/ozon/attribution-report.ts');
const {main:adsSku}=await import(root+'/scripts/ozon/ad-sku-daily.ts');
const {main:attr}=await import(root+'/scripts/ozon/ad-attribution-daily.ts');
const {sourceHealth,healthHtml}=await import(root+'/scripts/ozon/source-health.ts');
const output:any[]=[];
const record=(id:string,data:any)=>{output.push({id,...data});console.log(JSON.stringify(output.at(-1)));};
const fixture=mkdtempSync(join(tmpdir(),'feniks-integrity-'));process.chdir(fixture);mkdirSync('data');
process.argv=['node','fixture.mts'];
for(const key of ['OZON_PERF_CLIENT_ID','OZON_PERF_SECRET','OZON_SELLER_CLIENT_ID','OZON_SELLER_API_KEY'])process.env[key]='fixture';
globalThis.fetch=async()=>{throw new Error('external network forbidden in independent audit fixture')};
const put=(file:string,value:any,nd=false)=>writeFileSync('data/'+file,nd?value.map((r:any)=>JSON.stringify(r)).join('\n')+'\n':JSON.stringify(value));
const raw=(file:string)=>readFileSync('data/'+file,'utf8');
const day=ci.closedDay();
const goodHeader='День;SKU;Название товара;Расход;Продано товаров;Продажи в продвижении';
const dmy=day.split('-').reverse().join('.');
(OzonPerformance.prototype as any).campaigns=async()=>[{id:'1',paymentType:'CPC'},{id:'2',paymentType:'CPO'}];
(OzonPerformance.prototype as any).dailyStats=async()=>[{id:'1',date:day,spent:100},{id:'2',date:day,spent:1000}];
(OzonPerformance.prototype as any).requestStatistics=async(_ids:any,from:string,to:string)=>to;
(OzonPerformance.prototype as any).statisticsState=async()=>({state:'OK'});
(OzonPerformance.prototype as any).downloadStatistics=async(to:string)=>`${goodHeader}\n${to.split('-').reverse().join('.')};123;valid;100;1;500\n${to.split('-').reverse().join('.')};;MALFORMED MISSING SKU;25;1;100\n`;
put('ads_sku_daily.ndjson',[{d:day,cid:'1',sku:'123',sp:100,om:500,ca:0},{d:day,cid:'1',sku:'456',sp:25,om:100,ca:0}],true);
put('ads_sku_state.json',{'1':ci.shiftDay(day,-2)});
const old=raw('ads_sku_daily.ndjson');let error='';try{await adsSku()}catch(e:any){error=e.message}
record('CSV1-missing-SKU-partial',{error,changed:old!==raw('ads_sku_daily.ndjson'),rows:raw('ads_sku_daily.ndjson').trim().split('\n').length,state:JSON.parse(raw('ads_sku_state.json'))});
(OzonPerformance.prototype as any).downloadStatistics=async()=>`${goodHeader};Добавления в корзину\n${dmy};123;valid;100;1;500;BROKEN\n`;
const r=await attributionReport(new OzonPerformance({clientId:'x',clientSecret:'y'}),'1',day,day,Date.now()+60000);
record('CSV2-invalid-cart',{rows:r});
// New pagination: repeat cursor must fail instead of accepting truncated result.
let n=0; (OzonSeller.prototype as any).post=async()=>({accruals:[{date:day}],last_id:'same'});
try{await new OzonSeller({clientId:'x',apiKey:'y'}).accrualByDay(day);record('PAGE1-repeat',{blocked:false})}catch(e:any){record('PAGE1-repeat',{blocked:true,error:e.message})}
let i=0;(OzonSeller.prototype as any).post=async()=>{i++;return i===1?{accruals:[{date:day}],last_id:'next'}:{accruals:[{date:day}],last_id:''}};
record('PAGE2-valid-two',{rows:(await new OzonSeller({clientId:'x',apiKey:'y'}).accrualByDay(day)).length});
// Missing last_id silently terminates even when the response envelope is otherwise valid.
(OzonSeller.prototype as any).post=async()=>({accruals:[{date:day}]});
record('PAGE3-no-cursor',{rows:(await new OzonSeller({clientId:'x',apiKey:'y'}).accrualByDay(day)).length,note:'cannot distinguish full final page from missing contract field without API evidence'});
put('views.ndjson',[{date:ci.shiftDay(day,-2),sku:'123',views:9},{date:day,sku:'123',views:1}],true);
const vb=raw('views.ndjson');let c=0;
try{await ci.collectDaily({path:'data/views.ndjson',floor:ci.shiftDay(day,-1),to:day,date:(r:any)=>r.date,key:(r:any)=>`${r.date}|${r.sku}`,load:async(d:string)=>{if(++c===2)throw new Error('503');return [{date:d,sku:'123',views:2}]}})}catch(e:any){record('DAILY1-failure',{error:e.message,unchanged:vb===raw('views.ndjson'),ledger:existsSync('data/views.ndjson.completed.json')})}
put('ads_daily.ndjson',[{d:day,id:'1',sp:100}],true);put('ads_attr_daily.ndjson',[],true);put('ads_periods.json',{p7:{top_spend:[{id:'1'}],camp_meta:{'1':{instr:'Оплата за клик'}}}});
record('HEALTH1-visible-gap',{rows:sourceHealth(join(fixture,'data')).filter((r:any)=>r.source.includes('Полнота')),htmlWarning:healthHtml(join(fixture,'data')).includes('требуют внимания')});
writeFileSync('/private/tmp/ozon-integrity-audit/probes.json',JSON.stringify(output,null,2));
