import {groupFor} from './model.mjs?rev=20261109-gantt-1';
import {ordered} from './order.mjs?rev=20261109-gantt-1';

// Drop slots use task identities, never screen coordinates as stored order.
// The list lives in screen space, so the same midpoint applies at any camera zoom.
export function overviewPlacement({targetId,ids,tasks,today,pointerY=null,rect=null,activeId=ids?.[0]}) {
  if (!targetId || !ids?.length) return null;
  const target=String(targetId);
  if (target.startsWith('zone:')) return {group:target.slice(5),before:null,after:false};
  if (ids.includes(target)) return null;
  const task=tasks.find(t=>t.id===target),active=tasks.find(t=>t.id===activeId);
  if (!task || !active) return null;
  const group=groupFor(task,'priority',today);
  const items=ordered(tasks.filter(t=>groupFor(t,'priority',today)===group),'priority',today);
  const after=Number.isFinite(pointerY)&&rect
    ? pointerY>=rect.top+rect.height/2
    : groupFor(active,'priority',today)===group&&items.findIndex(t=>t.id===active.id)<items.findIndex(t=>t.id===target);
  const rest=items.filter(t=>!ids.includes(t.id)),index=rest.findIndex(t=>t.id===target);
  return {group,before:after?rest[index+1]?.id||null:target,after};
}

export function neighboringZone(zones,id,key) {
  const from=zones.find(z=>z.id===id);if(!from)return null;
  const horizontal=key==='ArrowLeft'||key==='ArrowRight',sign=key==='ArrowLeft'||key==='ArrowUp'?-1:1;
  const center=z=>({x:z.x+z.w/2,y:z.y+z.h/2}),origin=center(from);
  return zones.filter(z=>z.id!==id).map(z=>{
    const p=center(z),along=(horizontal?p.x-origin.x:p.y-origin.y)*sign,cross=Math.abs(horizontal?p.y-origin.y:p.x-origin.x);
    return {id:z.id,along,score:along+cross*2};
  }).filter(z=>z.along>1).sort((a,b)=>a.score-b.score)[0]?.id||null;
}

export function edgeVelocity(point,rect,margin=30,max=10) {
  if(!point||point.x<rect.left||point.x>rect.right||point.y<rect.top||point.y>rect.bottom)return {x:0,y:0};
  const axis=(p,lo,hi)=>p<lo+margin?max*Math.min(1,(lo+margin-p)/margin):p>hi-margin?-max*Math.min(1,(p-hi+margin)/margin):0;
  return {x:axis(point.x,rect.left,rect.right),y:axis(point.y,rect.top,rect.bottom)};
}
