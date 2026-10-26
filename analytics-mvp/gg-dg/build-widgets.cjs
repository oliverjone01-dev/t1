'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{stripTypeScriptTypes}=require('node:module');
const {adaptTemplate}=require('./template.cjs');
const SOURCE_ID='UC_NQ3QUI';
function validateRaw(r,now=Date.now()){
  if(r.scope?.sourceId!==SOURCE_ID||!Array.isArray(r.leads)||!Array.isArray(r.deals))throw Error('Invalid DG source scope');
  const age=now-Date.parse(r.generated_at);if(!Number.isFinite(age)||age>864e5||age< -300000)throw Error('Stale or future CRM snapshot');
  const leads=new Set(r.scope.leadIds),deals=new Set(r.scope.dealIds);
  for(const[k,ids]of [['leads',leads],['deals',deals]]){if(r[k].length!==ids.size||r.counts[k]!==ids.size||new Set(r[k].map(x=>String(x.id))).size!==ids.size)throw Error('CRM identity/count mismatch '+k);for(const x of r[k]){if(!ids.has(String(x.id)))throw Error('Foreign '+k+' row');if(k==='leads'&&x.sourceId!==SOURCE_ID)throw Error('Foreign lead');if(k==='deals'&&x.sourceId!==SOURCE_ID&&!leads.has(x.leadId))throw Error('Foreign deal');if(!/^\d{4}-\d{2}-\d{2}$/.test(x.created||''))throw Error('Invalid date');}}
  for(const d of r.deals){if(Number(d.category)!==49)throw Error('GG widget stage contract only supports category 49');if(d.currency!=='RUB')throw Error('GG monetary widgets require RUB');if(d.budget!=null&&(!Number.isFinite(d.budget)||d.budget<0))throw Error('Invalid budget');if(!Number.isFinite(d.prepayAmt)||d.prepayAmt<0)throw Error('Invalid prepayment');if(d.hist.some(h=>!h[0]||!/^\d{4}-\d{2}-\d{2}$/.test(h[1])))throw Error('Invalid stage history');}
  for(const p of r.prodItems||[])if(!deals.has(String(p.dealId)))throw Error('Foreign production item');
  const names=new Set([...r.deals,...r.leads].map(x=>x.mgr));for(const name of Object.keys(r.channelMix||{}))if(!names.has(name))throw Error('Foreign communication manager');
  return true;
}
function build(raw,template,builder,hook,now=Date.now()){
  validateRaw(raw,now);
  const r=structuredClone(raw),names=new Set([...r.deals,...r.leads].map(x=>x.mgr));
  // The upstream builder publishes no customer titles; also keep task text inside CRM.
  r.deals.forEach(d=>{delete d.title;d.taskSubj=d.taskSubj?'Запланированное дело':null;});r.leads.forEach(l=>delete l.title);
  r.managerPhotos=Object.fromEntries(Object.entries(r.managerPhotos||{}).filter(([n])=>names.has(n)));
  r.firedManagers=(r.firedManagers||[]).filter(n=>names.has(n));
  const tpl=adaptTemplate(template,hook);
  let code=builder.replace(/\r\n/g,'\n').replace(/^import .*;\n/gm,'');
  code=code.replace('const keepRec = (r: any) => !EXCLUDE_MGR.has(r.mgr) && r.dir !== "glass-memory";','const keepRec = (r: any) => true;');
  code=code.replace('const dd = deals.map((d: any) => d.created).filter(Boolean).sort();','const dd = [...deals,...leads].map((d: any) => d.created).filter(Boolean).sort();');
  code=code.replace(/planUrl: `[^`]+`,/,'planUrl: "",').replace(/planCsv: `[^`]+`,/,'planCsv: "",');
  code=code.replace('JSON.stringify(DATA)','JSON.stringify(DATA).replace(/</g,"\\\\u003c")');
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(raw.generated_at));let html;
  vm.runInNewContext(stripTypeScriptTypes(code,{mode:'strip'}),{process:{env:{ROP_TODAY:day}},console:{log(){}},maskDeep:x=>x,readFileSync:p=>{if(p==='rop/data/rop.json')return JSON.stringify(r);if(p==='rop/rop-command.template.html')return tpl;throw Error('DG has no plan');},writeFileSync:(p,v)=>html=v},{timeout:10000});
  if(!html||html.includes('"placeholder":true')||html.includes('docs.google.com/spreadsheets/d/14jm7'))throw Error('Invalid GG&DG bundle');
  const marker='const DATA=',a=html.indexOf(marker)+marker.length,b=html.indexOf(';\n',a),data=JSON.parse(html.slice(a,b));
  if(data.leads.length!==raw.leads.length||data.deals.length!==raw.deals.length||data.plan!==null||data.planCsv||data.planUrl)throw Error('GG builder altered source scope/plan');
  return {html,data,manifest:{templateSha256:crypto.createHash('sha256').update(template).digest('hex'),generatedAt:data.generatedAt,leads:data.leads.length,deals:data.deals.length,scope:SOURCE_ID,plan:null}};
}
if(require.main===module){const [rawPath,ggRoot,out]=process.argv.slice(2);if(!out)throw Error('Usage: build-widgets.cjs <snapshot.json> <GG analytics root> <output>');const raw=JSON.parse(fs.readFileSync(rawPath,'utf8')),template=fs.readFileSync(path.join(ggRoot,'rop/rop-command.template.html'),'utf8'),builder=fs.readFileSync(path.join(ggRoot,'src/scripts/b24/build-rop.ts'),'utf8'),hook=fs.readFileSync(path.join(__dirname,'no-plan.js'),'utf8');const result=build(raw,template,builder,hook);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'index.html'),result.html);fs.writeFileSync(path.join(out,'v.txt'),result.data.bakedAt);fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(result.manifest));console.log(JSON.stringify(result.manifest));}
module.exports={build,validateRaw};
