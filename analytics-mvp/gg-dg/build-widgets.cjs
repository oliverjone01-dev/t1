'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{stripTypeScriptTypes}=require('node:module');
const {adaptTemplate}=require('./template.cjs');
const SOURCE_ID='UC_NQ3QUI';
const {dgRealCommunication,dgCleanEvent,dgSafeText}=require('./communications.cjs');
function prepareCommunications(raw){
 const events=(raw.communications?.events||[]).map(e=>dgCleanEvent({...e,src:e.id},e.entities)),allowed=new Set([...raw.leads.map(l=>'L'+l.id),...raw.deals.map(d=>'D'+d.id)]),ids=new Set(),files={},index={};
 for(const kind of ['lead','deal'])for(const e of raw.calendar?.[kind]||[]){const names=kind==='lead'?raw.refs?.leadStatuses:raw.refs?.dealStages;events.push({id:'stage#'+e.key+':'+e.id,ts:e.at,dt:new Date(e.at).toISOString(),entities:[e.key],type:'Стадия',dir:'-',who:'CRM',title:'',body:dgSafeText(names?.[e.code]||e.code),status:e.semantic==='F'?'Отказ':e.semantic==='S'?'Успешно':'В работе',due:null});}
 for(const key of allowed)if(!/^[LD]\d+$/.test(key))throw Error('Invalid communication entity key');
 for(const e of events){if(ids.has(e.id)||!e.entities?.length||e.entities.some(k=>!allowed.has(k))||!Number.isFinite(e.ts))throw Error('Foreign/duplicate communication');ids.add(e.id);}
 for(const key of allowed){
  const keys=new Set([key]);if(key[0]==='D'){const deal=raw.deals.find(d=>'D'+d.id===key);if(deal?.leadId&&allowed.has('L'+deal.leadId))keys.add('L'+deal.leadId);}
  const rows=events.filter(e=>e.entities.some(k=>keys.has(k))).sort((a,b)=>a.ts-b.ts||a.id.localeCompare(b.id)),comm=rows.filter(e=>dgRealCommunication(e.type));
  files[key]={key,generatedAt:raw.communications?.generatedAt||raw.generated_at,events:rows};
  index[key]={ids:rows.map(e=>e.id),commIds:comm.map(e=>e.id),types:Object.fromEntries([...new Set(rows.map(e=>e.type))].map(t=>[t,rows.filter(e=>e.type===t).length])),lastAt:comm.length?Math.max(...comm.map(e=>e.ts)):null,openTasks:rows.filter(e=>e.type==='Дело'&&['просрочено','запланировано'].includes(e.status)).length};
 }
 return {files,index,coverage:{generatedAt:raw.communications?.generatedAt||null,cache:raw.communications?.cache||{status:'unavailable',generatedAt:null},events:events.length}};
}
function validateRaw(r,now=Date.now()){
  if(r.scope?.sourceId!==SOURCE_ID||!Array.isArray(r.leads)||!Array.isArray(r.deals))throw Error('Invalid DG source scope');
  const age=now-Date.parse(r.generated_at);if(!Number.isFinite(age)||age>864e5||age< -300000)throw Error('Stale or future CRM snapshot');
  const leads=new Set(r.scope.leadIds),deals=new Set(r.scope.dealIds);
  for(const[k,ids]of [['leads',leads],['deals',deals]]){if(r[k].length!==ids.size||r.counts[k]!==ids.size||new Set(r[k].map(x=>String(x.id))).size!==ids.size)throw Error('CRM identity/count mismatch '+k);for(const x of r[k]){if(!ids.has(String(x.id)))throw Error('Foreign '+k+' row');if(k==='leads'&&x.sourceId!==SOURCE_ID)throw Error('Foreign lead');if(k==='deals'&&x.sourceId!==SOURCE_ID&&!leads.has(x.leadId))throw Error('Foreign deal');if(!/^\d{4}-\d{2}-\d{2}$/.test(x.created||''))throw Error('Invalid date');}}
  for(const d of r.deals){if(Number(d.category)!==49)throw Error('GG widget stage contract only supports category 49');if(d.currency!=='RUB')throw Error('GG monetary widgets require RUB');if(d.budget!=null&&(!Number.isFinite(d.budget)||d.budget<0))throw Error('Invalid budget');if(!Number.isFinite(d.prepayAmt)||d.prepayAmt<0)throw Error('Invalid prepayment');if(d.hist.some(h=>!h[0]||!/^\d{4}-\d{2}-\d{2}$/.test(h[1])))throw Error('Invalid stage history');}
  for(const l of r.leads)if(l.budget!=null&&(!Number.isFinite(l.budget)||l.budget<0))throw Error('Invalid lead budget');
  if(r.communications&&(!Number.isFinite(Date.parse(r.communications.generatedAt||''))||(r.communications.cache?.status==='available'&&!Number.isFinite(Date.parse(r.communications.cache.generatedAt||'')))))throw Error('Invalid communication freshness');
  for(const p of r.prodItems||[])if(!deals.has(String(p.dealId)))throw Error('Foreign production item');
  if(r.calendar){for(const [kind,ids,prefix]of [['lead',leads,'L'],['deal',deals,'D']]){if(!Array.isArray(r.calendar[kind]))throw Error('Calendar history unavailable');const seen=new Set();for(const e of r.calendar[kind]){if(!ids.has(e.key?.slice(1))||e.key?.[0]!==prefix||!Number.isFinite(e.at)||!['P','S','F'].includes(e.semantic)||seen.has(e.id))throw Error('Invalid/foreign calendar history');seen.add(e.id);}}}
  const names=new Set([...r.deals,...r.leads].map(x=>x.mgr));for(const name of Object.keys(r.channelMix||{}))if(!names.has(name))throw Error('Foreign communication manager');
  return true;
}
function build(raw,template,builder,hook,now=Date.now()){
  validateRaw(raw,now);
  const r=structuredClone(raw),names=new Set([...r.deals,...r.leads].map(x=>x.mgr));
  // The upstream builder publishes no customer titles; also keep task text inside CRM.
  r.deals.forEach(d=>{delete d.title;d.taskSubj=d.taskSubj?'Запланированное дело':null;});r.leads.forEach(l=>delete l.title);
  r.managerPhotos={};
  r.firedManagers=(r.firedManagers||[]).filter(n=>names.has(n));
  const tpl=adaptTemplate(template,hook+'\n'+fs.readFileSync(path.join(__dirname,'sales-explorer.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'partner-view.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'calendar-view.js'),'utf8'));
  let code=builder.replace(/\r\n/g,'\n').replace(/^import .*;\n/gm,'');
  code=code.replace('const keepRec = (r: any) => !EXCLUDE_MGR.has(r.mgr) && r.dir !== "glass-memory";','const keepRec = (r: any) => true;');
  code=code.replace('const dd = deals.map((d: any) => d.created).filter(Boolean).sort();','const dd = [...deals,...leads].map((d: any) => d.created).filter(Boolean).sort();');
  code=code.replace('id: d.id, mgr: d.mgr, stage: d.stage,','id: d.id, leadId: d.leadId || null, currency:d.currency, mgr: d.mgr, stage: d.stage,');
  code=code.replace('id: l.id, mgr: l.mgr, status: l.status,','id: l.id, reason:l.reason??null, budget:l.budget??null, currency:l.currency??null, updated:l.updated??null, statusCode:l.statusCode, mgr: l.mgr, status: l.status,');
  code=code.replace(/planUrl: `[^`]+`,/,'planUrl: "",').replace(/planCsv: `[^`]+`,/,'planCsv: "",');
  code=code.replace(/b24Portal: [^\n]+,/,'b24Portal: "",');
  code=code.replace('JSON.stringify(DATA)','JSON.stringify(DATA).replace(/</g,"\\\\u003c")');
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(raw.generated_at));let html;
  vm.runInNewContext(stripTypeScriptTypes(code,{mode:'strip'}),{process:{env:{ROP_TODAY:day}},console:{log(){}},maskDeep:x=>x,readFileSync:p=>{if(p==='rop/data/rop.json')return JSON.stringify(r);if(p==='rop/rop-command.template.html')return tpl;throw Error('DG has no plan');},writeFileSync:(p,v)=>html=v},{timeout:10000});
  if(!html||html.includes('"placeholder":true')||html.includes('docs.google.com/spreadsheets/d/14jm7'))throw Error('Invalid GG&DG bundle');
  const marker='const DATA=',a=html.indexOf(marker)+marker.length,b=html.indexOf(';\n',a),data=JSON.parse(html.slice(a,b));
  const communications=prepareCommunications(raw);
  data.calendar=raw.calendar||null;data.communicationIndex=communications.index;data.communicationCoverage=communications.coverage;
  html=html.slice(0,a)+JSON.stringify(data).replace(/</g,'\\u003c')+html.slice(b);
  if(data.leads.length!==raw.leads.length||data.deals.length!==raw.deals.length||data.plan!==null||data.planCsv||data.planUrl)throw Error('GG builder altered source scope/plan');
  if(data.b24Portal||Object.keys(data.managerPhotos||{}).length||/https?:\/\/[^\s"'<>]*bitrix24\./i.test(html)||/B24_WEBHOOK_URL|api\.telegram\.org|OPENAI_API_KEY|\/rest\/\d+\/[a-z0-9]+/i.test(html))throw Error('Private endpoint in partner bundle');
  for(const v of Object.values(communications.files))if(/https?:\/\/|B24_WEBHOOK_URL|OPENAI_API_KEY|api\.telegram\.org|\/rest\/\d+\//i.test(JSON.stringify(v)))throw Error('Private URL in communications');
  return {html,data,communications:communications.files,manifest:{templateSha256:crypto.createHash('sha256').update(template).digest('hex'),generatedAt:data.generatedAt,leads:data.leads.length,deals:data.deals.length,communications:raw.communications?.events?.length||0,scope:SOURCE_ID,plan:null}};
}
if(require.main===module){const [rawPath,ggRoot,out]=process.argv.slice(2);if(!out)throw Error('Usage: build-widgets.cjs <snapshot.json> <GG analytics root> <output>');const raw=JSON.parse(fs.readFileSync(rawPath,'utf8'));if(raw.calendar?.version!==1||raw.communications?.version!==1)throw Error('DG communication/calendar schema unavailable');const template=fs.readFileSync(path.join(ggRoot,'rop/rop-command.template.html'),'utf8'),builder=fs.readFileSync(path.join(ggRoot,'src/scripts/b24/build-rop.ts'),'utf8'),hook=fs.readFileSync(path.join(__dirname,'no-plan.js'),'utf8');const result=build(raw,template,builder,hook);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'index.html'),result.html);fs.mkdirSync(path.join(out,'communications'),{recursive:true});for(const [key,value]of Object.entries(result.communications))fs.writeFileSync(path.join(out,'communications',key+'.json'),JSON.stringify(value));fs.writeFileSync(path.join(out,'v.txt'),result.data.bakedAt);fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(result.manifest));console.log(JSON.stringify(result.manifest));}
module.exports={build,validateRaw};
