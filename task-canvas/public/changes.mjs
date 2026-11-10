import {FIELD_NAMES, equal} from './sync-model.mjs?rev=20261111-status-8';

export const CHANGE_FIELDS = {...FIELD_NAMES, sourceId:'ID', ownerNote:'Формулировка ответственного', dueNote:'Формулировка срока', dependency:'Зависимости', requester:'Постановщик', link:'Ссылка'};
const fields = Object.keys(CHANGE_FIELDS).filter(key=>key!=='task');
const value = (task,key) => key==='workStarted'?!!task?.workStarted:key==='progress'?Number(task?.progress??(task?.status==='Готово'?100:0)):key==='importance'?Number(task?.importance||0):key==='positions' ? task?.positions || {} : task?.[key] ?? '';

// Compare shared snapshots, excluding this device's own writes and their delayed acknowledgements.
export function remoteChanges(base, remote, local) {
  if(!base)return [];
  const before=new Map(base.tasks.map(t=>[t.id,t])), after=new Map(remote.tasks.map(t=>[t.id,t]));
  const here=new Map(local.tasks.map(t=>[t.id,t])), changes=[];
  for(const [id,task] of after) {
    const old=before.get(id), own=here.get(id);
    if(!old) {if(!own)changes.push({id,title:task.title,kind:'new',fields:[]});continue;}
    const changed=fields.filter(key=>!equal(value(old,key),value(task,key)) && (!own || !equal(value(own,key),value(task,key))));
    if(changed.length)changes.push({id,title:task.title,kind:'updated',fields:changed.filter(key=>!(key==='ownerNote' && changed.includes('owner')) && !(key==='dueNote' && changed.includes('due')))});
  }
  for(const [id,task] of before)if(!after.has(id) && here.has(id))changes.push({id,title:task.title,kind:'removed',fields:[]});
  return changes;
}

export class ChangeInbox {
  constructor(saved=[]) {
    this.items=new Map();
    if(Array.isArray(saved)) for(const item of saved.slice(-4000)) {
      if(!item || typeof item.id!=='string' || !item.id || typeof item.title!=='string' || !['new','updated','removed'].includes(item.kind))continue;
      this.items.set(item.id,{id:item.id,title:item.title,kind:item.kind,fields:Array.isArray(item.fields)?item.fields.filter(f=>fields.includes(f)):[],at:Number.isFinite(item.at)?item.at:0});
    }
  }
  get entries() {return [...this.items.values()].sort((a,b)=>b.at-a.at);}
  get size() {return this.items.size;}
  get(id) {return this.items.get(id);}
  receive(changes,now=Date.now()) {
    for(const change of changes) {
      const old=this.items.get(change.id);
      const kind=old?.kind==='new' && change.kind==='updated' ? 'new' : old?.kind==='removed' && change.kind==='new' ? 'updated' : change.kind;
      this.items.set(change.id,{...change,kind,fields:[...new Set([...(old?.fields || []),...change.fields])],at:now});
    }
    if(this.size>4000)this.items=new Map(this.entries.slice(0,4000).map(item=>[item.id,item]));
  }
  acknowledge(id) {this.items.delete(id);}
  clear() {this.items.clear();}
  snapshot() {return this.entries;}
}
