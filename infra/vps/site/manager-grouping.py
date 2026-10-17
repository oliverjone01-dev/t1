"""Requested grouping of manager presentation; raw CRM records are not mutated."""
import json,re
def apply_manager_grouping(document,names):
 helper='const GG_PUBLISHED_MGRS=new Set('+json.dumps(names,ensure_ascii=False)+');function managerGroup(name){return GG_PUBLISHED_MGRS.has(name)?name:"Другие";}function ggGroupChannels(value){if(!value)return null;const out={};for(const [name,fields] of Object.entries(value)){const key=managerGroup(name),row=out[key]||(out[key]={});for(const [field,num] of Object.entries(fields))if(typeof num==="number")row[field]=(row[field]||0)+num;}return out;}\n'
 # Definitions before the native snapshot/initial render, without changing the snapshot.
 scripts=list(re.finditer(r'<script\b[^>]*>.*?</script>',document,re.S))
 main=next(m for m in scripts if 'let S=' in m[0]);code=main[0]
 functions=list(re.finditer(r'^function ([A-Za-z0-9_]+)\(',code,re.M))
 chunks=[];last=0
 selected={'render','byManager','mgrPF','smartTasksBlock','taskDisciplineBlock','offerControlBlock','mgrHeatmap','mgrScatter','mgrDwellHeat','respSeries','wireMgr','hotCalendarBlock','healthBlock','offerFunnelBlock','drawMgrDyn','offerCalendarBlock','salesHealthBlock','standardBlock','mgmtDecisionsBlock','offerAnalytics'}
 for i,match in enumerate(functions):
  end=functions[i+1].start() if i+1<len(functions) else len(code)
  name=match[1];part=code[match.start():end]
  if name in selected:
   if name=='byManager':
    part=part.replace('].filter(n=>isOP(n));','].filter(n=>isOP(n)).map(managerGroup))];',1).replace('const names=[...new Set(', 'const names=[...new Set(',1)
    # Rebuild the exact names expression rather than deduplicate already computed rows.
    part=part.replace('const names=[...new Set([...D.map(d=>d.mgr),...L.map(l=>l.mgr),...PLAN_MGRS])].filter(n=>isOP(n)).map(managerGroup))];','const names=[...new Set([...D.map(d=>d.mgr),...L.map(l=>l.mgr),...PLAN_MGRS].filter(n=>isOP(n)).map(managerGroup))];')
   if name=='mgrPF':
    part=part.replace('L.filter(l=>isOP(l.mgr)).forEach','L.forEach').replace('D.filter(d=>isOP(d.mgr)).forEach','D.forEach')
    part=part.replace('const E=m=>A[m]=A[m]||','const E=name=>{const m=managerGroup(name);return A[m]=A[m]||').replace('pw:{}};','pw:{}};};',1)
   if name=='smartTasksBlock':part=part.replace('const mk=nm=>M[nm]=M[nm]||','const mk=name=>{const nm=managerGroup(name);return M[nm]=M[nm]||').replace('lostN:0};','lostN:0};};',1)
   if name=='taskDisciplineBlock':
    part=part.replace("if(view==='mgr')return d.mgr;","if(view==='mgr')return managerGroup(d.mgr);")
    part=part.replace('PLAN_MGRS.forEach(nm=>{perM[nm]=','[...new Set(PLAN_MGRS.map(managerGroup))].forEach(nm=>{perM[nm]=')
    part=part.replace('DATA.channelMix||null','ggGroupChannels(DATA.channelMix)')
   if name=='mgrHeatmap':part=part.replace('PLAN_MGRS.forEach(m=>{A[m]=','[...new Set(PLAN_MGRS.map(managerGroup))].forEach(m=>{A[m]=')
   # Group accumulator indexes and name lists; preserve raw records and filtering rules.
   for record in ['d','l','x']:
    part=part.replace('['+record+'.mgr]', '[managerGroup('+record+'.mgr)]')
   for expression in ['D.map(d=>d.mgr)','L.map(l=>l.mgr)','passed.map(d=>d.mgr)','lost.map(d=>d.mgr)','open.map(d=>d.mgr)','set.map(x=>x.mgr)']:
    part=part.replace(expression,expression.replace('=>d.mgr','=>managerGroup(d.mgr)').replace('=>l.mgr','=>managerGroup(l.mgr)').replace('=>x.mgr','=>managerGroup(x.mgr)'))
   part=re.sub(r'\.map\(([dlx])=>\1\.mgr\)',r'.map(\1=>managerGroup(\1.mgr))',part)
   if name!='byManager':part=part.replace('PLAN_MGRS.forEach(m=>{G[m]=[];});','[...new Set(PLAN_MGRS.map(managerGroup))].forEach(m=>{G[m]=[];});')
   part=re.sub(r'(?<![A-Za-z])([dlx])\.mgr===([A-Za-z_$][\w.$]*(?:\[[^\]]+\])?)',r'managerGroup(\1.mgr)===\2',part)
   if name!='byManager':
    part=part.replace('...PLAN_MGRS]', '...PLAN_MGRS.map(managerGroup)]').replace('...PLAN_MGRS,','...PLAN_MGRS.map(managerGroup),').replace('new Set(PLAN_MGRS)', 'new Set(PLAN_MGRS.map(managerGroup))')
    part=part.replace('.concat(PLAN_MGRS)', '.concat(PLAN_MGRS.map(managerGroup))').replace('PLAN_MGRS.includes(m)','PLAN_MGRS.map(managerGroup).includes(m)')
    part=part.replace('PLAN_MGRS.forEach(', '[...new Set(PLAN_MGRS.map(managerGroup))].forEach(')
    part=part.replace('PLAN_MGRS.filter(m=>_crShow.has(m))','PLAN_MGRS.map(managerGroup).filter(m=>_crShow.has(m))')
  # The production table is inside render(). Its accumulator and drill share the grouped key.
  if name=='unassignedAgg':part=part.replace('const a={','return null;const a={',1)
  if name=='byManager':part=part.replace('.filter(n=>isOP(n)).map(managerGroup)', '.map(managerGroup)')
  if name=='mgrMatrix':
   part=part.replace('PLAN_MGRS.filter(m=>!_seen.has(m))','[...new Set(PLAN_MGRS.map(managerGroup))].filter(m=>!_seen.has(m))')
   part=part.replace('map(x=>{const cells=','map(x=>{const factor=x.m==="Другие"&&!isR?PLAN_MGRS.filter(n=>!GG_PUBLISHED_MGRS.has(n)).length:1,rowPlan=planMgr*factor,rowCell=planCell*factor;const cells=')
   part=part.replace('fP(planCell)','fP(rowCell)').replace('const att=planMgr?x.tot/planMgr:0','const att=rowPlan?x.tot/rowPlan:0').replace('fP(planMgr)','fP(rowPlan)')
   part=part.replace('planMgr*arr.length','planMgr*(isR?arr.length:PLAN_MGRS.length)')
  if name=='render':
   part=part.replace('const ent=n=>M[n]=M[n]||','const ent=name=>{const n=managerGroup(name);return M[n]=M[n]||').replace('qN:0,qM:0};','qN:0,qM:0};};',1)
   part=part.replace("const k=d.mgr||'—';(qtBy[k]", "const k=managerGroup(d.mgr||'—');(qtBy[k]")
  chunks.append(code[last:match.start()]+part);last=end
 code=''.join(chunks)+code[last:]
 code=code.replace('(!S.fMgr||x.mgr===S.fMgr)','(!S.fMgr||(S.fMgr==="Другие"?managerGroup(x.mgr)==="Другие":x.mgr===S.fMgr))')
 opening=code.index('>')+1;code=code[:opening]+helper+code[opening:]
 return document[:main.start()]+code+document[main.end():]

