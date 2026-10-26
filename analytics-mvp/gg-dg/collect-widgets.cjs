'use strict';
// Run the GG collector with a source-scoped query adapter. Its enrichment and field
// mappings remain the reference implementation; every list is paginated and checked.
const fs=require('node:fs'), path=require('node:path'), {stripTypeScriptTypes}=require('node:module');
const SOURCE_ID='UC_NQ3QUI', SOURCE_NAME='Заявка с ДГ';
const DG_REASON_FIELDS=['UF_CRM_1730742511284','UF_CRM_1782316574481','UF_CRM_1785837642607'];
function assertLeadReasonFields(fields){for(const field of DG_REASON_FIELDS)if(fields[field]?.type!=='string')throw Error('DG lead reason field unavailable or changed: '+field);}
function leadReason(row){
  const status=String(row.STATUS_ID||'');
  if(status==='1')return 'СПАМ';if(status==='2')return 'Дубль';
  if(!['JUNK','3'].includes(status))return null;
  const value=String(status==='JUNK'?(row[DG_REASON_FIELDS[0]]||''):(row[DG_REASON_FIELDS[2]]||row[DG_REASON_FIELDS[1]]||'')).trim().toLowerCase().replace(/\s+/g,' ');
  if(!value)return 'Не заполнена';
  // Only observed operational labels leave CRM; arbitrary free text stays behind the CRM link.
  const labels={'тест':'Тест','некачественный лид':'Некачественный лид','предложение о сотрудничестве':'Предложение о сотрудничестве','не возьмем в работу':'Не возьмем в работу','не сделаем':'Не сделаем'};
  return Object.hasOwn(labels,value)?labels[value]:'Другая причина (см. CRM)';
}
function once(s,from,to){if(s.split(from).length!==2)throw Error('GG collector contract changed: '+from.slice(0,90));return s.replace(from,to);}
function adapt(source,mask){
  let s=source.replace(/\r\n/g,'\n');
  s=`const DG_REASON_FIELDS=${JSON.stringify(DG_REASON_FIELDS)};\n${leadReason.toString()}\n${assertLeadReasonFields.toString()}\n`+s;
  s=once(s,'const leadFields: any = (await call("crm.lead.fields", {})).result || {};','const leadFields: any = (await call("crm.lead.fields", {})).result || {}; assertLeadReasonFields(leadFields);');
  s=once(s,'import { maskDeep } from "../../lib/mask-contacts.mjs";',mask.replace(/^export\s+/gm,''));
  s=once(s,'const OUT = "rop/data/rop.json";','const OUT = process.env.GG_DG_OUTPUT || "/tmp/gg-dg-widgets.json";');
  s=once(s,'const LIGHT = (process.env.ROP_LIGHT || "") === "1";','const LIGHT = false;');
  s=once(s,'const DATE_FROM = process.env.ROP_DATE_FROM || "";','const DATE_FROM = "";');
  s=once(s,'const d10 = (s?: string) => (s ? String(s).slice(0, 10) : null);',`const d10 = (s?: string) => { if(!s)return null; if(/^\\d{4}-\\d{2}-\\d{2}$/.test(s))return s; const d=new Date(s);if(!Number.isFinite(+d))throw Error('Invalid CRM date');return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(d); };`);
  const start=s.indexOf('async function listSharded('),end=s.indexOf('// История стадий',start);
  if(start<0||end<0)throw Error('Missing GG list adapter anchors');
  s=s.slice(0,start)+SCOPED_LIST+s.slice(end);
  s=once(s,'const dealRows = await listAll("crm.deal.list", { select: dealSelect, filter: { CATEGORY_ID: DEAL_CATEGORY, ...dateFilter } });',`
  if(sourceName['${SOURCE_ID}']!=='${SOURCE_NAME}')throw Error('DG source dictionary changed');
  SC.leads=await strictList('crm.lead.list',{select:['ID','TITLE','STATUS_ID','ASSIGNED_BY_ID','OPPORTUNITY','CURRENCY_ID','DATE_CREATE','DATE_MODIFY','DATE_CLOSED','SOURCE_ID',UF_LEAD_DIR,...DG_REASON_FIELDS],filter:{SOURCE_ID:'${SOURCE_ID}'}});
  const direct=await strictList('crm.deal.list',{select:dealSelect,filter:{SOURCE_ID:'${SOURCE_ID}'}});
  const linked=await scopedChunks('crm.deal.list',{select:dealSelect},'@LEAD_ID',SC.leads.map(x=>x.ID));
  const leadIDs=new Set(SC.leads.map(x=>String(x.ID)));
  const dealRows=[...new Map([...direct,...linked].map(d=>[String(d.ID),d])).values()];
  if(SC.leads.some(l=>l.SOURCE_ID!=='${SOURCE_ID}')||dealRows.some(d=>d.SOURCE_ID!=='${SOURCE_ID}'&&!leadIDs.has(String(d.LEAD_ID))))throw Error('Foreign CRM record');
  SC.deals=dealRows;
  `);
  s=once(s,'const leadRows = await listAll("crm.lead.list", { select: leadSelect, filter: { ...dateFilter } });','const leadRows = SC.leads;');
  s=once(s,'}).filter((l) => !EXCLUDE_LEAD_DIRS.includes(l.dir));','});');
  s=once(s,'category: Number(DEAL_CATEGORY),','category: Number(d.CATEGORY_ID), sourceId: d.SOURCE_ID || null, leadId: d.LEAD_ID ? String(d.LEAD_ID) : null, currency: d.CURRENCY_ID || null,');
  s=once(s,'const dealSelect = ["ID", "TITLE", "CATEGORY_ID",','const dealSelect = ["ID", "TITLE", "CURRENCY_ID", "CATEGORY_ID",');
  s=once(s,'title: l.TITLE || "",','title: l.TITLE || "", sourceId: l.SOURCE_ID,');
  s=once(s,'budget: Number(l.OPPORTUNITY) || 0,','budget: l.OPPORTUNITY==null||l.OPPORTUNITY===""?null:Number(l.OPPORTUNITY), currency:l.CURRENCY_ID||null, updated:d10(l.DATE_MODIFY), reason:leadReason(l),');
  // Empty custom amounts remain unknown; GG rendering uses its existing display rules.
  s=once(s,'if (UF_PREPAY) console.log(', 'if (!UF_PREPAY) throw Error("CRM prepayment field unavailable");\n  if (UF_PREPAY) console.log(');
  s=once(s,'budget: Number(d.OPPORTUNITY) || 0,','budget: d.OPPORTUNITY == null || d.OPPORTUNITY === "" ? null : Number(d.OPPORTUNITY),');
  s=once(s,'const moneyNum = (v: any): number => { const n = parseFloat(String(v ?? "").split("|")[0]); return isNaN(n) ? 0 : n; };',`const moneyNum = (v: any): number => { if(v==null||v==='')return 0;const parts=String(v).split('|');if(parts.length>2||(parts[1]&&parts[1]!=='RUB'))throw Error('Unsupported prepayment currency');const n=Number(parts[0]);if(!Number.isFinite(n)||n<0)throw Error('Invalid prepayment amount');return n; };`);
  s=once(s,'reason: (String(d[UF.reasonComment] ?? "").trim()) || reasonMap[String(d[UF.reason])] || "не указана",','reason: reasonMap[String(d[UF.reason])] || (String(d[UF.reasonComment] ?? "").trim() ? "Указана в CRM" : "не указана"),');
  s=once(s,'const j = await call("crm.item.productrow.list", { filter: { "=ownerId": r.id, "=ownerType": OWNER_T } });\n      const prs: any[] = (j.result && j.result.productRows) || [];',`const prs: any[] = await strictList('crm.item.productrow.list',{filter:{'=ownerId':r.id,'=ownerType':OWNER_T}},{idField:'id',itemsPath:'productRows'});
      if(prs.some(p=>String(p.ownerId)!==String(r.id)))throw Error('Foreign product row');`);
  s=once(s,'} catch { /* карточка без товарных строк */ }','} catch(e) { throw e; }');
  // Timeline pagination is mandatory: do not silently truncate at the first 50 comments.
  s=once(s,'const r = await call("crm.timeline.comment.list", {','const r = {result: await strictList("crm.timeline.comment.list", {');
  s=once(s,'filter: { ENTITY_ID: dl.id, ENTITY_TYPE: "deal" }, order: { CREATED: "ASC" },\n      });','filter: { ENTITY_ID: dl.id, ENTITY_TYPE: "deal" }, order: { CREATED: "ASC" },\n      })};');
  s=once(s,'} catch { return; }','} catch (e) { throw e; }');
  s=s.replaceAll('mkdirSync("rop/data", { recursive: true });','// Output parent is prepared by the workflow.');
  s=once(s,'writeFileSync(OUT, JSON.stringify(maskDeep(out, MASK_SKIP)));',`out.scope={sourceId:'${SOURCE_ID}',sourceName:'${SOURCE_NAME}',leadIds:SC.leads.map(x=>String(x.ID)),dealIds:SC.deals.map(x=>String(x.ID)),collection:'GG collector with source-scoped pagination'};
  const text=JSON.stringify(maskDeep(out,MASK_SKIP));
  if(process.env.GG_DG_STDOUT==='1')process.stdout.write(text);else writeFileSync(OUT,text);`);
  // Keep stdout machine-readable for the existing secure SSH collection path.
  s='if(process.env.GG_DG_STDOUT==="1") console.log=(...a)=>console.error(...a);\n'+s;
  return stripTypeScriptTypes(s,{mode:'strip'});
}
const SCOPED_LIST=String.raw`
const SC={deals:[],leads:[],prodIds:[]};
async function strictList(method,params,opts={}){
  let rows=[],start=0,total=null;const id=opts.idField||'ID';
  for(let page=0;page<1000;page++){
    const j=await call(method,{...params,order:params.order||{[id]:'ASC'},start});
    const batch=opts.itemsPath?j.result?.[typeof opts.itemsPath==='string'?opts.itemsPath:'items']:j.result;
    if(!Array.isArray(batch))throw Error(method+': invalid list');
    const t=j.total??j.result?.total;if(total===null&&t!=null)total=Number(t);
    if(batch.some(r=>r[id]==null||!/^\d+$/.test(String(r[id]))))throw Error(method+': missing/invalid ID');
    rows.push(...batch);const next=j.next??j.result?.next;
    if(next==null){if(total!==null&&total!==rows.length)throw Error(method+': incomplete pages');if(new Set(rows.map(r=>String(r[id]))).size!==rows.length)throw Error(method+': duplicate IDs');return rows;}
    if(!batch.length||Number(next)<=start)throw Error(method+': broken pagination');start=Number(next);
  }throw Error(method+': page limit');
}
async function scopedChunks(method,params,key,ids,opts={}){
  const unique=[...new Set(ids.filter(x=>x&&String(x)!=='0').map(String))],rows=[];
  for(let i=0;i<unique.length;i+=30){const chunk=unique.slice(i,i+30),part=await strictList(method,{...params,filter:{...params.filter,[key]:chunk}},opts),field=key.slice(1);if(part.some(row=>!chunk.includes(String(row[field]))))throw Error(method+': foreign scoped row');rows.push(...part);}
  return rows;
}
async function listSharded(method,params,opts={}){
  if(method==='crm.stagehistory.list')return scopedChunks(method,params,'@OWNER_ID',Number(params.entityTypeId)===2?SC.deals.map(x=>x.ID):SC.prodIds,opts);
  if(method==='crm.activity.list'){
    if(params.filter?.OWNER_TYPE_ID===2)return scopedChunks(method,params,'@OWNER_ID',SC.deals.map(x=>x.ID),opts);
    // Contact/company activity can also concern other sources; only direct CRM bindings qualify.
    const owners={1:SC.leads.map(x=>x.ID),2:SC.deals.map(x=>x.ID)};
    const rows=[];for(const [t,ids]of Object.entries(owners))rows.push(...await scopedChunks(method,{...params,filter:{...params.filter,OWNER_TYPE_ID:Number(t)}},'@OWNER_ID',ids,opts));return rows;
  }
  if(method==='crm.item.list'){
    const rows=await scopedChunks(method,params,'@parentId2',SC.deals.map(x=>x.ID),opts);SC.prodIds=rows.map(x=>x.id);return rows;
  }
  return strictList(method,params,opts);
}

`;
if(require.main===module){const root=process.argv[2],out=process.argv[3];if(!root||!out)throw Error('Usage: collect-widgets.cjs <GG analytics root> <generated.mjs>');const source=fs.readFileSync(path.join(root,'src/scripts/b24/fetch-rop.ts'),'utf8');const mask=fs.readFileSync(path.join(root,'src/lib/mask-contacts.mjs'),'utf8');fs.writeFileSync(out,adapt(source,mask));}
module.exports={adapt,SOURCE_ID,SOURCE_NAME,SCOPED_LIST,leadReason,DG_REASON_FIELDS,assertLeadReasonFields};
