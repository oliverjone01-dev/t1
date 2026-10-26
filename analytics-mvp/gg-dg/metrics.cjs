(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DGMetrics=factory();})(typeof globalThis==='undefined'?this:globalThis,function(){
  const SOURCE_ID='UC_NQ3QUI';
  function dateKey(value){if(!value)return null;const d=new Date(value);if(!Number.isFinite(d.getTime()))return null;return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
  function validate(data){
    if(data.schemaVersion!==1||data.source?.id!==SOURCE_ID||data.source?.name!=='Заявка с ДГ')throw Error('Unexpected source');
    if(!Number.isFinite(Date.parse(data.generatedAt)))throw Error('Missing snapshot timestamp');
    const allowed={leads:new Set(['id','sourceId','managerId','createdAt','statusCode','status','semantic']),deals:new Set(['id','sourceId','attribution','leadId','managerId','createdAt','categoryId','stageCode','stage','stageOrder','semantic','amount','currency'])};
    const ids=new Set(data.leads.map(l=>l.id));
    for(const [type,rows]of [['leads',data.leads],['deals',data.deals]]){
      if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Duplicate '+type);
      for(const r of rows){
        if(Object.keys(r).some(k=>!allowed[type].has(k)))throw Error('Unapproved '+type+' field');
        if(!/^\d+$/.test(r.id)||!dateKey(r.createdAt)||!['P','S','F'].includes(r.semantic))throw Error('Invalid '+type+' record');
        if(type==='leads'&&r.sourceId!==SOURCE_ID)throw Error('Foreign lead');
        if(type==='deals'&&r.sourceId!==SOURCE_ID&&!ids.has(r.leadId))throw Error('Foreign deal');
        if(type==='deals'&&r.amount!==null&&(!Number.isFinite(r.amount)||r.amount<0))throw Error('Invalid amount');
      }
    }
    if(data.verification.leadTotal!==data.leads.length||data.verification.directDealTotal+data.verification.linkedOnlyDealTotal!==data.deals.length)throw Error('Count mismatch');
    return true;
  }
  function filter(data,{from='',to='',manager=''}={}){const keep=r=>{const d=dateKey(r.createdAt);return (!from||d>=from)&&(!to||d<=to)&&(!manager||r.managerId===manager)};return {leads:data.leads.filter(keep),deals:data.deals.filter(keep)};}
  function amount(rows){const totals={};let missing=0;for(const d of rows){if(d.amount===null||!d.currency){missing++;continue;}totals[d.currency]=(totals[d.currency]??0)+d.amount;}for(const k of Object.keys(totals))totals[k]=Math.round(totals[k]*100)/100;return {totals,missing};}
  function summary(view){const converted=view.leads.filter(l=>l.semantic==='S').length,rejected=view.leads.filter(l=>l.semantic==='F').length,open=view.deals.filter(d=>d.semantic==='P'),won=view.deals.filter(d=>d.semantic==='S'),lost=view.deals.filter(d=>d.semantic==='F');return {leads:view.leads.length,converted,rejected,pending:view.leads.length-converted-rejected,conversion:view.leads.length?converted/view.leads.length:null,deals:view.deals.length,open:open.length,won:won.length,lost:lost.length,pipeline:amount(open),wonAmount:amount(won)};}
  function days(from,to){const result=[];if(!from||!to||from>to)return result;for(let d=new Date(from+'T12:00:00Z');d.toISOString().slice(0,10)<=to;d.setUTCDate(d.getUTCDate()+1)){result.push(d.toISOString().slice(0,10));if(result.length>36600)throw Error('Date range too large');}return result;}
  function shift(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
  return {SOURCE_ID,dateKey,validate,filter,amount,summary,days,shift};
});
