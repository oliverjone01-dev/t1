// Undo that respects other people's edits. A record holds the board before and after one step. Reverting writes
// back a field only where the board still shows what this step wrote; a field someone changed since stays theirs
// and is counted as skipped. The same function redoes a step: pass the record with before and after swapped.
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
export const LINKED=[['due','start','dueNote'],['status','progress','closedAt','archiveKind','workStarted'],['owner','ownerNote']];
export const invert=record=>({before:record.after,after:record.before});
export function revertRecord(state,record){
 const tasks=structuredClone(state.tasks),before=new Map(record.before.tasks.map(t=>[t.id,t])),after=new Map(record.after.tasks.map(t=>[t.id,t]));
 let skipped=0,applied=0;
 for(const id of new Set([...before.keys(),...after.keys()])){
  const b=before.get(id),a=after.get(id),index=tasks.findIndex(t=>t.id===id);
  if(!b&&a){if(index<0)continue;if(same(tasks[index],a)){tasks.splice(index,1);applied++}else skipped++;continue}
  if(b&&!a){if(index<0){tasks.push(structuredClone(b));applied++}continue}
  if(index<0){skipped++;continue}
  const current=tasks[index],changed=[...new Set([...Object.keys(b),...Object.keys(a)])].filter(k=>!same(b[k],a[k]));
  // Linked fields move as one unit: a date range, a status with its progress and closing date, an owner with its note.
  const done=new Set();
  for(const group of LINKED){
   if(!group.some(k=>changed.includes(k)))continue;
   group.forEach(k=>done.add(k));
   if(!group.every(k=>same(current[k],a[k]))){skipped++;continue}
   for(const k of group){if(b[k]===undefined)delete current[k];else current[k]=structuredClone(b[k])}applied++;
  }
  for(const key of changed){
   if(done.has(key))continue;
   if(key==='positions'){
    const bp=b.positions||{},ap=a.positions||{};current.positions={...(current.positions||{})};
    for(const view of new Set([...Object.keys(bp),...Object.keys(ap)])){
     if(same(bp[view],ap[view]))continue;
     if(!same(current.positions[view],ap[view])){skipped++;continue}
     if(bp[view]===undefined)delete current.positions[view];else current.positions[view]=structuredClone(bp[view]);applied++;
    }
    continue;
   }
   if(!same(current[key],a[key])){skipped++;continue}
   if(b[key]===undefined)delete current[key];else current[key]=structuredClone(b[key]);applied++;
  }
 }
 const owners=[...new Set([...state.owners.filter(name=>!record.after.owners.includes(name)||record.before.owners.includes(name)),...record.before.owners.filter(name=>!record.after.owners.includes(name))])];
 return {tasks,owners,skipped,applied};
}
