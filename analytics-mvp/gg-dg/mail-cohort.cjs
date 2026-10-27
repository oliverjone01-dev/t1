'use strict';
function dgMailDomains(value){
 const text=String(value||'');if(/[\r\n]/.test(text))return [];
 const parts=[];let part='',quoted=false,escape=false,comments=0,angle=0;
 for(const char of text){
  if(escape){if(!comments)part+=char;escape=false;continue;}
  if(char==='\\'&&(quoted||comments)){if(!comments)part+=char;escape=true;continue;}
  if(comments){if(char==='(')comments++;if(char===')')comments--;continue;}
  if(char==='"'){quoted=!quoted;part+=char;continue;}
  if(!quoted&&char==='('){comments=1;part+=' ';continue;}
  if(!quoted&&char==='<'){if(angle)return [];angle=1;}
  if(!quoted&&char==='>'){if(!angle)return [];angle=0;}
  if(!quoted&&!angle&&(char===','||char===';')){parts.push(part);part='';}else part+=char;
 }
 if(quoted||escape||comments||angle)return [];parts.push(part);
 const domains=[];
 for(let mailbox of parts){
  mailbox=mailbox.trim();if(!mailbox)return [];
  let begin=-1,end=-1;quoted=false;escape=false;
  for(let i=0;i<mailbox.length;i++){const char=mailbox[i];if(escape){escape=false;continue;}if(char==='\\'&&quoted){escape=true;continue;}if(char==='"'){quoted=!quoted;continue;}if(!quoted&&char==='<'){if(begin!==-1)return [];begin=i;}if(!quoted&&char==='>')end=i;}
  if(begin!==-1){if(end<=begin||mailbox.slice(end+1).trim())return [];mailbox=mailbox.slice(begin+1,end).trim();}
  // Validate the complete addr-spec. Display names never provide sender evidence.
  const match=mailbox.match(/^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x20-\x21\x23-\x5b\x5d-\x7e]|\\[\x20-\x7e])+")@([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/i);
  if(!match)return [];domains.push(match[1].toLowerCase());
 }
 return [...new Set(domains)];
}
async function dgLeadCandidates(sourceLeads,directDeals,fetchParents){
 const source='UC_NQ3QUI',positive=id=>/^[1-9]\d*$/.test(String(id||''));
 if(sourceLeads.some(l=>!positive(l.ID)||l.SOURCE_ID!==source)||new Set(sourceLeads.map(l=>String(l.ID))).size!==sourceLeads.length)throw Error('Invalid DG source leads');
 if(directDeals.some(d=>!positive(d.ID)||d.SOURCE_ID!==source||Number(d.CATEGORY_ID)!==49))throw Error('Invalid direct DG deal');
 const known=new Set(sourceLeads.map(l=>String(l.ID))),parents=new Map();
 for(const d of directDeals){if(d.LEAD_ID==null||String(d.LEAD_ID)==='0'||d.LEAD_ID==='')continue;if(!positive(d.LEAD_ID))throw Error('Invalid DG parent lead');const id=String(d.LEAD_ID);if(!parents.has(id))parents.set(id,[]);parents.get(id).push(String(d.ID));}
 const missing=[...parents.keys()].filter(id=>!known.has(id)),extra=missing.length?await fetchParents(missing):[];
 if(!Array.isArray(extra)||extra.length!==missing.length||new Set(extra.map(l=>String(l.ID))).size!==missing.length||extra.some(l=>!missing.includes(String(l.ID))))throw Error('Missing/foreign DG parent lead');
 return {leads:[...sourceLeads,...extra],parentDeals:Object.fromEntries(parents)};
}
async function dgMailCohort(leads,call,{throttleMs=550}={}){
 const keep=new Set(),known=new Set(leads.map(l=>String(l.ID))),bindings=new Map();let last=0;
 const rpc=async(method,params)=>{const delay=last+throttleMs-Date.now();if(delay>0)await new Promise(r=>setTimeout(r,delay));last=Date.now();const out=await call(method,params);if(out.error)throw Error('DG mail cohort request failed');return out;};
 const all=[...known];
 for(let i=0;i<all.length;i+=25){const chunk=all.slice(i,i+25),seen=new Set();let start=0,total=null;
  for(let page=0;page<10000;page++){
   const r=await rpc('crm.activity.list',{filter:{BINDINGS:chunk.map(id=>({OWNER_TYPE_ID:1,OWNER_ID:id})),TYPE_ID:4,DIRECTION:1},select:['ID','OWNER_TYPE_ID','OWNER_ID','TYPE_ID','DIRECTION','SETTINGS'],order:{ID:'ASC'},start});
   if(!Array.isArray(r.result))throw Error('Invalid mail cohort page');if(total===null&&r.total!=null)total=Number(r.total);
   for(const a of r.result){
    if(!/^[1-9]\d*$/.test(String(a.ID||''))||seen.has(String(a.ID))||String(a.TYPE_ID)!=='4'||String(a.DIRECTION)!=='1')throw Error('Invalid/duplicate incoming email');seen.add(String(a.ID));
    let owners;
    if(String(a.OWNER_TYPE_ID)==='1'&&chunk.includes(String(a.OWNER_ID)))owners=[String(a.OWNER_ID)];
    else{const b=await rpc('crm.activity.binding.list',{activityId:a.ID});if(!Array.isArray(b.result))throw Error('Missing mail bindings');owners=b.result.filter(x=>Number(x.entityTypeId)===1&&chunk.includes(String(x.entityId))).map(x=>String(x.entityId));}
    if(!owners.length)throw Error('Foreign email in DG cohort');
    let meta=a.SETTINGS?.EMAIL_META;if(!meta){const one=await rpc('crm.activity.get',{id:a.ID}),row=one.result;if(String(row?.ID)!==String(a.ID)||String(row?.TYPE_ID)!=='4'||String(row?.DIRECTION)!=='1')throw Error('Incoming email metadata identity mismatch');meta=row.SETTINGS?.EMAIL_META;}
    const domains=dgMailDomains(meta?.from??meta?.FROM);if(!domains.length)throw Error('Incoming email sender unavailable');
    if(domains.length===1&&domains[0]==='domglass.ru'){let bound=bindings.get(String(a.ID));if(!bound){const b=await rpc('crm.activity.binding.list',{activityId:a.ID});if(!Array.isArray(b.result))throw Error('Missing confirmed email bindings');bound=b.result;bindings.set(String(a.ID),bound);}const leadOwners=bound.filter(x=>Number(x.entityTypeId)===1&&known.has(String(x.entityId))).map(x=>String(x.entityId));if(!leadOwners.some(id=>chunk.includes(id)))throw Error('Foreign confirmed email');for(const id of leadOwners)keep.add(id);}
   }
   if(r.next==null){if(total!==null&&seen.size!==total)throw Error('Incomplete mail cohort');break;}
   if(!r.result.length||Number(r.next)<=start||page===9999)throw Error('Broken mail cohort pagination');start=Number(r.next);
  }
 }
 return {leads:leads.filter(l=>keep.has(String(l.ID))),excluded:[...known].filter(id=>!keep.has(id)),before:known.size};
}
module.exports={dgMailCohort,dgMailDomains,dgLeadCandidates};
