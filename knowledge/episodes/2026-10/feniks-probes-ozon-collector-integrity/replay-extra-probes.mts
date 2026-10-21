import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
const root='/private/tmp/ozon-integrity-audit/audited-source/analytics-mvp/src';
const {OzonPerformance}=await import(root+'/connector/ozon-performance.ts');
const {main:ads}=await import(root+'/scripts/ozon/ads-daily.ts');
const {collectDaily,closedDay,validateRows,shiftDay}=await import(root+'/scripts/ozon/collector-integrity.ts');
const {sourceHealth}=await import(root+'/scripts/ozon/source-health.ts');
const fixture=mkdtempSync(join(tmpdir(),'feniks-extra-'));process.chdir(fixture);mkdirSync('data');process.argv=['node','fixture.mts'];process.env.OZON_PERF_CLIENT_ID='fixture';process.env.OZON_PERF_SECRET='fixture';globalThis.fetch=async()=>{throw new Error('network forbidden')};
const put=(p:string,x:any)=>writeFileSync('data/'+p,x.map((r:any)=>JSON.stringify(r)).join('\n')+'\n');const day=closedDay();
const row=(id:string,sp:number)=>({d:day,id,off:id,sp,o:1,om:500,vw:10,cl:2,ca:1});
put('ads_daily.ndjson',[row('1',100),row('2',50)]);
(OzonPerformance.prototype as any).campaigns=async()=>[{id:'1',paymentType:'CPC'},{id:'2',paymentType:'CPC'}];
(OzonPerformance.prototype as any).dailyStats=async()=>[{id:'1',date:day,title:'A',spent:100,orders:1,ordersMoney:500,views:10,clicks:2,toCart:1}];
let error='';try{await ads()}catch(e:any){error=e.message}
console.log(JSON.stringify({id:'ADS1-partial-campaign-day',error,remaining:readFileSync('data/ads_daily.ndjson','utf8').trim().split('\n').map(l=>JSON.parse(l)),health:sourceHealth(join(fixture,'data')).filter((x:any)=>x.source==='Расход кампаний'||x.source==='Полнота атрибуции кампаний')}));
const before=[{date:day,sku:'123',views:10}];put('views.ndjson',before);
let accepted=false;try{validateRows([{date:day,views:11}],(r:any)=>`${r.date}|${r.sku}`);accepted=true}catch{}
await collectDaily({path:'data/views.ndjson',floor:day,to:day,date:(r:any)=>r.date,key:(r:any)=>`${r.date}|${r.sku}`,load:async()=>[{date:day,views:11}]});
console.log(JSON.stringify({id:'KEY1-missing-SKU',accepted,result:readFileSync('data/views.ndjson','utf8'),ledger:existsSync('data/views.ndjson.completed.json')}));
