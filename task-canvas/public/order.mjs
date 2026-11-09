import {generateNKeysBetween} from './vendor/fractional-indexing.mjs?rev=20261109-directory-2';
import {groupFor, moveTask} from './model.mjs?rev=20261109-directory-2';

// Legacy coordinates are stable implicit ranks. Reading a board never migrates
// or rewrites somebody else's task merely to establish an initial order.
export function orderKey(task, mode, today) {
  const p = task.positions?.[mode];
  // A calendar queue must survive the day moving from today to overdue.
  // Explicit date edits already clear/reassign positions.time.
  if ((mode === 'time' || p?.group === groupFor(task, mode, today)) && typeof p?.order === 'string') return p.order;
  const y = Math.round(p?.y || 96), x = Math.round(p?.x || 24);
  const suffix = [...new TextEncoder().encode(task.id)].map(v=>v.toString(16).padStart(2,'0')).join('');
  return 'b00' + String(y * 100001 + x).padStart(11,'0') + suffix + 'V';
}
export function ordered(tasks, mode, today) {
  return [...tasks].sort((a,b) => {
    const x=orderKey(a,mode,today), y=orderKey(b,mode,today);
    return x<y ? -1 : x>y ? 1 : a.id<b.id ? -1 : a.id>b.id ? 1 : 0;
  });
}
export function reorderTasks(tasks, ids, group, beforeId, today, mode='priority') {
  const selected=new Set(ids);
  const moved=ordered(tasks.filter(t=>selected.has(t.id)),mode,today);
  if (!moved.length) throw new Error('Выбранные задачи уже убраны с доски.');
  const rest=ordered(tasks.filter(t=>!selected.has(t.id) && groupFor(t,mode,today)===group.id),mode,today);
  const index=beforeId==null ? rest.length : rest.findIndex(t=>t.id===beforeId);
  if(index<0) throw new Error('Место вставки изменилось. Повторите перенос.');
  const lo=index ? orderKey(rest[index-1],mode,today) : null;
  const hi=index<rest.length ? orderKey(rest[index],mode,today) : null;
  // Concurrent inserts may share a rank. An explicit reorder repairs just this
  // interval with a key after the previous tie; all tasks remain visible.
  if(lo && hi && lo===hi) throw new Error('Порядок здесь одновременно изменился. Перенесите перед соседней карточкой.');
  const ranks=generateNKeysBetween(lo,hi,moved.length);
  if(ranks.some(rank=>rank.length>512))throw new Error("Слишком плотный порядок. Выберите соседнее место вставки.");
  const updates=new Map(moved.map((t,i)=>{
    const next=moveTask(t,mode,{x:0,y:0,w:648,...group},24,96,today);
    // Keep original coordinates so unranked legacy neighbours retain their key.
    next.positions[mode]={...next.positions[mode],order:ranks[i]};
    return [t.id,next];
  }));
  return tasks.map(t=>updates.get(t.id)||t);
}
