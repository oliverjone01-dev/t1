// Помесячный CPL Директа: кабинет, цели «Все лиды» и «качественные», апрель-август.
const DTOKEN=process.env.YANDEX_DIRECT_TOKEN,DLOGIN=process.env.YANDEX_DIRECT_LOGIN||'';
if(!DTOKEN){console.error('нет токена');process.exit(1);}
const GOAL_LEADS=487033158,GOAL_CONTACTS=477925360;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const MONTHS=[['апр','2026-04-01','2026-04-30'],['май','2026-05-01','2026-05-31'],['июн','2026-06-01','2026-06-30'],['июл','2026-07-01','2026-07-31'],['авг','2026-08-01','2026-08-24']];
async function dg(d1,d2,goal){
  const params={SelectionCriteria:{DateFrom:d1,DateTo:d2},FieldNames:['Cost','Clicks','Conversions'],
    ReportName:`c${goal}-${d1}-${Date.now()}`,ReportType:'CAMPAIGN_PERFORMANCE_REPORT',
    DateRangeType:'CUSTOM_DATE',Format:'TSV',IncludeVAT:'YES',IncludeDiscount:'NO'};
  if(goal){params.Goals=[goal];params.AttributionModels=['LSC'];}
  for(let i=0;i<15;i++){
    const res=await fetch('https://api.direct.yandex.com/json/v5/reports',{method:'POST',
      headers:{Authorization:`Bearer ${DTOKEN}`,...(DLOGIN?{'Client-Login':DLOGIN}:{}),'Content-Type':'application/json; charset=utf-8','Accept-Language':'ru',skipReportHeader:'true',skipReportSummary:'true'},
      body:JSON.stringify({params})});
    if(res.status===200){const t=(await res.text()).trim();let cost=0,cv=0;for(const l of t.split('\n')){const c=l.split('\t');if(c.length>=3){cost+=+c[0]||0;cv+=+c[2]||0;}}return{spend:Math.round(cost/1e6),conv:cv};}
    if(res.status===201||res.status===202){await sleep(4000);continue;}
    throw new Error(`${res.status}: ${(await res.text()).slice(0,150)}`);
  }
  throw new Error('timeout');
}
(async()=>{
  for(const[m,d1,d2] of MONTHS){
    const b=await dg(d1,d2,null),l=await dg(d1,d2,GOAL_LEADS),q=await dg(d1,d2,GOAL_CONTACTS);
    const cpl=l.conv?Math.round(b.spend/l.conv):0,cpq=q.conv?Math.round(b.spend/q.conv):0;
    console.error(`DCPL\t${m}\tspend ${b.spend}\tвсе ${l.conv}\tCPL ${cpl}\tкач ${q.conv}\tCPQL ${cpq}`);
  }
})();
