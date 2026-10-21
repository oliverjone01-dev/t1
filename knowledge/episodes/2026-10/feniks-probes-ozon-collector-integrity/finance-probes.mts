import{mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
const root='/Users/gengroup/Documents/Codex/t1/analytics-mvp/src';const {OzonSeller}=await import(root+'/connector/ozon-seller.ts');const {main:acq}=await import(root+'/scripts/ozon/acq-sku-daily.ts');const {main:pnl}=await import(root+'/scripts/ozon/pnl-accrual-daily.ts');
const fixture=mkdtempSync(join(tmpdir(),'feniks-finance-'));process.chdir(fixture);mkdirSync('data');process.argv=['node','fixture.mts','2026-02-06','2026-10-20'];process.env.OZON_SELLER_CLIENT_ID='fixture';process.env.OZON_SELLER_API_KEY='fixture';globalThis.fetch=async()=>{throw new Error('network forbidden')};
const put=(name:string,r:any[])=>writeFileSync('data/'+name,r.map(x=>JSON.stringify(x)).join('\n')+'\n');
(OzonSeller.prototype as any).postings=async()=>[{posting_number:'old19',date:'2026-10-19',status:'delivered',products:[{sku:'123',price:100,qty:1}]},{posting_number:'old20',date:'2026-10-20',status:'delivered',products:[{sku:'123',price:200,qty:1}]}];
(OzonSeller.prototype as any).accrualTypes=async()=>[{id:1,name:'Acquiring',description:''},{id:2,name:'PayPerClick',description:''}];
(OzonSeller.prototype as any).accrualPostings=async()=>[];
(OzonSeller.prototype as any).accrualByDay=async(day:string)=>day==='2026-10-19'?[{date:day,item_fees:{fees:[{sku:'123',fees:[{type_id:1,accrued:{amount:-10}}]}]},non_item_fee:{type_id:2,accrued:{amount:-10}}}]:[];
put('acq_sku_daily.ndjson',[{d:'2026-10-19',sku:'123',acq:-10},{d:'2026-10-20',sku:'123',acq:-20}]);
let error='';try{await acq()}catch(e:any){error=e.message}
console.log(JSON.stringify({id:'FIN1-silent-empty-day-acq',error,rows:readFileSync('data/acq_sku_daily.ndjson','utf8'),status:existsSync('data/collector_status.json')?JSON.parse(readFileSync('data/collector_status.json','utf8')):null}));
put('pnl_account_accrual_daily.ndjson',[{d:'2026-10-19',adv:-10},{d:'2026-10-20',adv:-20}]);
error='';try{await pnl()}catch(e:any){error=e.message}
console.log(JSON.stringify({id:'FIN2-silent-empty-day-pnl',error,rows:readFileSync('data/pnl_account_accrual_daily.ndjson','utf8'),status:existsSync('data/collector_status.json')?JSON.parse(readFileSync('data/collector_status.json','utf8')):null}));
