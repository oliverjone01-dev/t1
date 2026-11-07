// A small Firebase SDK-compatible adapter. Google Apps Script supplies a
// short-lived owner token; no refresh tokens or service-account keys are stored.
export const STAMP=Object.freeze({__serverTimestamp:true});
export class RestTimestamp {
  constructor(value){this.value=value}
  toMillis(){return Date.parse(this.value)}
  toJSON(){return {__timestamp:this.value}}
}
export function encode(value){
  if(value===null)return {nullValue:null};
  if(value instanceof RestTimestamp || value?.__timestamp)return {timestampValue:value.value||value.__timestamp};
  if(typeof value==='boolean')return {booleanValue:value};
  if(typeof value==='number')return Number.isSafeInteger(value)?{integerValue:String(value)}:{doubleValue:value};
  if(typeof value==='string')return {stringValue:value};
  if(Array.isArray(value))return {arrayValue:{values:value.map(encode)}};
  if(value&&typeof value==='object')return {mapValue:{fields:encodeFields(value)}};
  throw new Error('Unsupported Firestore value');
}
export const encodeFields=value=>Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v)]));
export function decode(v){
  if('nullValue'in v)return null;
  if('stringValue'in v)return v.stringValue;
  if('booleanValue'in v)return v.booleanValue;
  if('integerValue'in v)return Number(v.integerValue);
  if('doubleValue'in v)return Number(v.doubleValue);
  if('timestampValue'in v)return new RestTimestamp(v.timestampValue);
  if('arrayValue'in v)return (v.arrayValue.values||[]).map(decode);
  if('mapValue'in v)return decodeFields(v.mapValue.fields||{});
  throw new Error('Unsupported Firestore response');
}
export const decodeFields=fields=>Object.fromEntries(Object.entries(fields||{}).map(([k,v])=>[k,decode(v)]));
function splitTransforms(value,prefix='',transforms=[]){
  const result={};
  for(const [key,v] of Object.entries(value)){
    if(v===undefined)continue;
    const path=prefix?prefix+'.'+key:key;
    if(v?.__serverTimestamp){transforms.push({fieldPath:path,setToServerValue:'REQUEST_TIME'});continue}
    result[key]=v&&typeof v==='object'&&!Array.isArray(v)&&!(v instanceof RestTimestamp)&&!v.__timestamp?splitTransforms(v,path,transforms):v;
  }
  return result;
}
const snap=(ref,doc)=>({id:ref.id,ref,updateTime:doc?.updateTime,exists:()=>!!doc,data:()=>doc?decodeFields(doc.fields):undefined});
export class FirestoreRest {
  constructor({project,board,request,now=()=>Date.now(),sleep=()=>{},seed=null}){
    Object.assign(this,{project,board,request,now,sleep});
    this.documents=`projects/${project}/databases/(default)/documents`;
    this.base='https://firestore.googleapis.com/v1/'+this.documents;
    this.taskPath=`taskBoards/${board}/tasks`;
    this.tasks=new Map((seed?.tasks||[]).map(d=>[d.name.split('/documents/')[1],d]));
    this.cursor=seed?.cursor||null;this.loaded=!!seed;
  }
  ref(...parts){
    const first=parts[0],path=(first?.path?first.path+'/':'')+parts.slice(first?.path?1:0).filter(p=>typeof p==='string').join('/');
    if(![`taskBoards/${this.board}`,`taskBoardViews/${this.board}`].some(p=>path===p||path.startsWith(p+'/'))||path.split('/').some(p=>p==='..'||p==='.'||p.includes('%')))throw new Error('Unexpected board path');
    return {path,id:path.split('/').at(-1)};
  }
  name(ref){return this.documents+'/'+ref.path}
  async get(ref){
    try{return snap(ref,this.request(this.base+'/'+ref.path))}
    catch(error){if(error.status===404)return snap(ref,null);throw error}
  }
  async refresh(){
    const query={from:[{collectionId:'tasks'}]};
    if(this.cursor)query.where={fieldFilter:{field:{fieldPath:'updatedAt'},op:'GREATER_THAN_OR_EQUAL',value:{timestampValue:this.cursor}}};
    const rows=this.request(this.base+`/taskBoards/${this.board}:runQuery`,{structuredQuery:query});
    if(!Array.isArray(rows))throw new Error('Invalid Firestore query response');
    let watermark=null;
    for(const row of rows){
      if(row.readTime&&(!watermark||row.readTime<watermark))watermark=row.readTime;
      if(row.document)this.tasks.set(row.document.name.split('/documents/')[1],row.document);
    }
    if(!watermark)throw new Error('Firestore query omitted its read timestamp');
    // Keep an overlap. The watermark is server read time, never the worker's clock.
    this.cursor=new Date(Date.parse(watermark)-1).toISOString();this.loaded=true;
  }
  snapshot(){return {cursor:this.cursor,tasks:[...this.tasks.values()]}}
  async docs(ref){
    if(ref.path===this.taskPath&&!ref.constraints?.length){
      if(!this.loaded)await this.refresh();
      return {docs:[...this.tasks].map(([path,doc])=>snap(this.ref(path),doc))};
    }
    const parts=ref.path.split('/'),collectionId=parts.pop(),parent=parts.length?'/'+parts.join('/'):'';
    const query={from:[{collectionId}]},filters=[];
    for(const c of ref.constraints||[]){
      if(c.type==='where')filters.push({fieldFilter:{field:{fieldPath:c.field},op:{'==':'EQUAL','>=':'GREATER_THAN_OR_EQUAL'}[c.op],value:encode(c.value)}});
      if(c.type==='limit')query.limit=c.value;
      if(c.type==='orderBy')query.orderBy=[{field:{fieldPath:c.field},direction:c.direction==='desc'?'DESCENDING':'ASCENDING'}];
    }
    if(filters.length)query.where=filters.length===1?filters[0]:{compositeFilter:{op:'AND',filters}};
    const rows=this.request(this.base+parent+':runQuery',{structuredQuery:query});
    return {docs:rows.filter(r=>r.document).map(r=>snap(this.ref(r.document.name.split('/documents/')[1]),r.document))};
  }
  write(ref,data,kind='set',merge=false){
    if(kind==='delete')return {delete:this.name(ref)};
    const transforms=[],plain=splitTransforms(data,'',transforms);
    const result={update:{name:this.name(ref),fields:encodeFields(plain)}};
    if(kind==='update')result.currentDocument={exists:true};
    if(kind==='update'||merge)result.updateMask={fieldPaths:[...Object.keys(plain),...transforms.map(t=>t.fieldPath)]};
    if(transforms.length)result.updateTransforms=transforms;
    return result;
  }
  async commit(writes,transaction){
    if(!writes.length&&!transaction)return;
    const response=this.request(this.base+':commit',{writes,...(transaction?{transaction}:{})});
    for(let i=0;i<writes.length;i++){
      const w=writes[i],name=w.update?.name||w.delete,path=name?.split('/documents/')[1];
      if(!path?.startsWith(this.taskPath+'/')||path.slice(this.taskPath.length+1).includes('/'))continue;
      if(w.delete){this.tasks.delete(path);continue}
      let fields=w.update.fields;
      if(w.updateMask){fields={...(this.tasks.get(path)?.fields||{}),...fields}}
      for(const t of w.updateTransforms||[])fields[t.fieldPath]={timestampValue:response.commitTime};
      this.tasks.set(path,{name,fields,updateTime:response.writeResults?.[i]?.updateTime||response.commitTime});
    }
    return response;
  }
  async transaction(callback){
    for(let attempt=0;attempt<5;attempt++){
      const {transaction}=this.request(this.base+':beginTransaction',{options:{readWrite:{}}});
      const writes=[];
      try{
        const tx={get:async ref=>{
          const rows=this.request(this.base+':batchGet',{documents:[this.name(ref)],transaction});
          if(!Array.isArray(rows)||rows.length!==1||(!rows[0].found&&!rows[0].missing))throw new Error('Invalid transactional read');
          return snap(ref,rows[0].found||null);
        },set:(ref,data,opts)=>writes.push(this.write(ref,data,'set',!!opts?.merge)),update:(ref,data)=>writes.push(this.write(ref,data,'update')),delete:ref=>writes.push(this.write(ref,null,'delete'))};
        const result=await callback(tx);await this.commit(writes,transaction);return result;
      }catch(error){
        try{this.request(this.base+':rollback',{transaction})}catch{}
        if(error.code!=='aborted'||attempt===4)throw error;
        this.sleep(50*(attempt+1));
      }
    }
  }
  sdk(){
    return {doc:(first,...p)=>this.ref(...(first?.path?[first,...p]:p)),collection:(first,...p)=>this.ref(...(first?.path?[first,...p]:p)),getDoc:ref=>this.get(ref),getDocFromServer:ref=>this.get(ref),getDocs:ref=>this.docs(ref),query:(ref,...constraints)=>({...ref,constraints}),where:(field,op,value)=>({type:'where',field,op,value}),limit:value=>({type:'limit',value}),orderBy:(field,direction)=>({type:'orderBy',field,direction}),serverTimestamp:()=>STAMP,runTransaction:(_,fn)=>this.transaction(fn),writeBatch:()=>{
      const writes=[];return {set:(ref,data,opts)=>writes.push(this.write(ref,data,'set',!!opts?.merge)),update:(ref,data)=>writes.push(this.write(ref,data,'update')),delete:ref=>writes.push(this.write(ref,null,'delete')),commit:()=>this.commit(writes)};
    }};
  }
}
