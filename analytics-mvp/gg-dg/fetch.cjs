/* Read-only Bitrix collector. No customer names, contacts, titles or comments leave this process. */
const {writeFileSync, renameSync, mkdirSync} = require('node:fs');
const {dirname} = require('node:path');
const SOURCE_ID = 'UC_NQ3QUI';
const SOURCE_NAME = 'Заявка с ДГ';
const base = process.env.B24_WEBHOOK_URL;
if (!base) throw new Error('B24_WEBHOOK_URL is not configured');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function call(method, params = {}) {
  for (let attempt=0; attempt<4; attempt++) {
    await sleep(550);
    let response;
    try { response = await fetch(base.replace(/\/$/,'')+'/'+method+'.json', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(params),signal:AbortSignal.timeout(45000)}); }
    catch { if(attempt===3) throw new Error(method+': network failure'); await sleep(1000*2**attempt); continue; }
    const json = await response.json();
    if ([429,503].includes(response.status) || ['QUERY_LIMIT_EXCEEDED','OPERATION_TIME_LIMIT'].includes(json.error)) {
      if(attempt===3) throw new Error(method+': rate limit'); await sleep(2000*2**attempt); continue;
    }
    if (!response.ok || json.error) throw new Error(method+': '+(json.error||response.status));
    return json;
  }
}
async function list(method, params) {
  let rows=[], start=0, expected=null;
  for(let page=0; page<1000; page++) {
    const j=await call(method,{...params,start});
    if(!Array.isArray(j.result)) throw new Error(method+': expected list');
    if(expected===null && j.total!==undefined) expected=Number(j.total);
    rows.push(...j.result);
    if(j.next===undefined || j.next===null) {
      if(expected!==null && expected!==rows.length) throw new Error(method+': total mismatch');
      if(new Set(rows.map(x=>String(x.ID))).size!==rows.length) throw new Error(method+': duplicate IDs');
      return rows;
    }
    if(Number(j.next)<=start) throw new Error(method+': invalid pagination');
    start=Number(j.next);
  }
  throw new Error(method+': pagination limit');
}
function numberOrNull(v) { if(v===null||v===undefined||v==='') return null; const n=Number(v); if(!Number.isFinite(n)) throw new Error('Invalid CRM amount'); return n; }
async function main() {
  const statuses=await list('crm.status.list',{});
  const source=statuses.find(s=>s.ENTITY_ID==='SOURCE'&&s.STATUS_ID===SOURCE_ID);
  if(source?.NAME!==SOURCE_NAME) throw new Error('CRM source identity changed');
  const leadFields=['ID','SOURCE_ID','STATUS_ID','STATUS_SEMANTIC_ID','ASSIGNED_BY_ID','DATE_CREATE','DATE_CLOSED'];
  const dealFields=['ID','SOURCE_ID','LEAD_ID','CATEGORY_ID','STAGE_ID','STAGE_SEMANTIC_ID','ASSIGNED_BY_ID','DATE_CREATE','CLOSEDATE','OPPORTUNITY','CURRENCY_ID'];
  const leads=await list('crm.lead.list',{filter:{SOURCE_ID},select:leadFields,order:{ID:'ASC'}});
  const directDeals=await list('crm.deal.list',{filter:{SOURCE_ID},select:dealFields,order:{ID:'ASC'}});
  const linked=[];
  for(let i=0;i<leads.length;i+=40) linked.push(...await list('crm.deal.list',{filter:{'@LEAD_ID':leads.slice(i,i+40).map(x=>x.ID)},select:dealFields,order:{ID:'ASC'}}));
  const leadIDs=new Set(leads.map(l=>String(l.ID)));
  const deals=[...new Map([...directDeals,...linked].map(d=>[String(d.ID),d])).values()];
  if(leads.some(l=>l.SOURCE_ID!==SOURCE_ID) || deals.some(d=>d.SOURCE_ID!==SOURCE_ID&&!leadIDs.has(String(d.LEAD_ID)))) throw new Error('Out-of-scope record returned');
  const owners=[...new Set([...leads,...deals].map(r=>String(r.ASSIGNED_BY_ID)))];
  const managers=[];
  for(const id of owners) {
    const users=(await call('user.get',{ID:id})).result;
    const u=Array.isArray(users)?users.find(u=>String(u.ID)===id):null;
    managers.push({id,name:u?[u.NAME,u.LAST_NAME].filter(Boolean).join(' '):'Сотрудник #'+id,active:u?.ACTIVE??null});
  }
  const stat=(entity,code)=>statuses.find(s=>s.ENTITY_ID===entity&&s.STATUS_ID===code);
  const result={schemaVersion:1,generatedAt:new Date().toISOString(),source:{id:SOURCE_ID,name:SOURCE_NAME},portal:'https://glassmemory.bitrix24.ru',managers,
    leads:leads.map(l=>{const s=stat('STATUS',l.STATUS_ID); if(!s) throw new Error('Unknown lead status '+l.STATUS_ID); return {id:String(l.ID),sourceId:l.SOURCE_ID,managerId:String(l.ASSIGNED_BY_ID),createdAt:l.DATE_CREATE,statusCode:l.STATUS_ID,status:s.NAME,semantic:l.STATUS_SEMANTIC_ID||s.SEMANTICS||(l.STATUS_ID==='CONVERTED'?'S':['JUNK','1','2','3'].includes(l.STATUS_ID)?'F':'P')};}),
    deals:deals.map(d=>{const entity=Number(d.CATEGORY_ID)?'DEAL_STAGE_'+d.CATEGORY_ID:'DEAL_STAGE';const s=stat(entity,d.STAGE_ID);if(!s) throw new Error('Unknown deal stage '+d.STAGE_ID);return {id:String(d.ID),sourceId:d.SOURCE_ID||null,attribution:d.SOURCE_ID===SOURCE_ID?'source':'lead',leadId:d.LEAD_ID?String(d.LEAD_ID):null,managerId:String(d.ASSIGNED_BY_ID),createdAt:d.DATE_CREATE,categoryId:String(d.CATEGORY_ID),stageCode:d.STAGE_ID,stage:s.NAME,stageOrder:Number(s.SORT),semantic:d.STAGE_SEMANTIC_ID||s.SEMANTICS||(d.STAGE_ID.endsWith(':WON')?'S':d.STAGE_ID.endsWith(':LOSE')?'F':'P'),amount:numberOrNull(d.OPPORTUNITY),currency:d.CURRENCY_ID||null};}),
    verification:{leadTotal:leads.length,directDealTotal:directDeals.length,linkedOnlyDealTotal:deals.length-directDeals.length,pagination:'all pages; total and unique IDs checked'}};
  const {validate}=require(process.env.GG_DG_CORE||'./metrics.cjs'); validate(result);
  const json=JSON.stringify(result,null,2)+'\n';
  if(process.env.GG_DG_STDOUT==='1') process.stdout.write(json);
  else { const out=process.argv[2]; if(!out) throw new Error('Usage: node fetch.cjs <output.json>');mkdirSync(dirname(out),{recursive:true});writeFileSync(out+'.tmp',json);renameSync(out+'.tmp',out); console.log(`GG&DG: ${leads.length} leads, ${deals.length} deals; ${result.generatedAt}`); }
}
main().catch(e=>{console.error(e.message);process.exit(1)});
