import {dockTargets,applyDock,dockSummary,reopens} from './dock-model.mjs?rev=20261120-dnd-21';
import {validateBoard} from './model.mjs?rev=20261120-dnd-21';
// «Куда перенести»: a floating dock shown while any card is dragged. Each drag engine calls start() when a drag
// begins and release(ids) when it ends; release applies the dock target under the pointer, if any, as one change.
// The dock reads the pointer itself (capture phase), so engines never need to know its layout.
export function installDropDock(host){
 const el=document.createElement('div');el.className='drop-dock';el.hidden=true;el.setAttribute('role','region');el.setAttribute('aria-label','Куда перенести');
 document.body.append(el);
 // One drag session: the board version at drag start (for conflict checks) and whether a pointer is down.
 // A keyboard drag never shows the dock: its targets are reachable only by pointer.
 let active=false,hover=null,released=null,basis=null,pointerDown=false;
 document.addEventListener('pointerdown',()=>{pointerDown=true},{capture:true});
 for(const type of ['pointerup','pointercancel'])document.addEventListener(type,()=>{setTimeout(()=>{pointerDown=false})},{capture:true});
 window.addEventListener('blur',()=>{pointerDown=false;end()});
 const live=document.createElement('p');live.className='visually-hidden';live.setAttribute('aria-live','polite');el.after(live);
 function draw(){el.innerHTML=`<div class="drop-dock-groups">${dockTargets(host.today()).map((g,i)=>`<div class="drop-dock-group${i===0?' is-open':''}" data-dock-group="${g.id}" role="group" aria-label="${g.title}"><span class="drop-dock-label">${g.title}</span><div class="drop-dock-targets">${g.targets.map(t=>`<div class="drop-dock-target" data-dock-field="${t.field}" data-dock-value="${t.value}" data-dock-label="${t.label}"${t.field==='status'?` data-dock-status="${t.value}"`:''}><b>${t.label}</b>${t.field==='due'&&t.value?`<small>${new Intl.DateTimeFormat('ru',{weekday:'short',day:'numeric',month:'short'}).format(new Date(t.value+'T12:00:00'))}</small>`:''}</div>`).join('')}</div></div>`).join('')}</div>`}
 const targetAt=(x,y)=>{const node=document.elementFromPoint(x,y)?.closest?.('[data-dock-field]');return node&&el.contains(node)?node:null};
 // One group is open at a time; bringing the card to a closed group opens it, so the dock stays one row high.
 function openGroup(group){if(!group||group.classList.contains('is-open'))return;for(const g of el.querySelectorAll('.drop-dock-group'))g.classList.toggle('is-open',g===group)}
 // Only a group label opens its group, after a short dwell: a finger trembling on the edge never flips groups back and forth.
 let pending=null,timer=0;
 function requestGroup(group){if(!group||group.classList.contains('is-open')){clearTimeout(timer);pending=null;return}if(pending===group)return;pending=group;clearTimeout(timer);timer=setTimeout(()=>{if(active&&pending===group)openGroup(group);pending=null},180)}
 function setHover(node){if(hover===node)return;hover?.classList.remove('is-hover');hover=node;hover?.classList.add('is-hover');if(node)live.textContent=`Отпустите: ${node.dataset.dockLabel}`}
 document.addEventListener('pointermove',e=>{if(!active)return;const under=document.elementFromPoint(e.clientX,e.clientY);requestGroup(under?.closest?.('.drop-dock-label')?.closest('.drop-dock-group'));setHover(targetAt(e.clientX,e.clientY))},{capture:true,passive:true});
 // The release is recorded before any engine sees pointerup, so a drop over the dock never lands under it.
 document.addEventListener('pointerup',e=>{if(!active)return;const node=targetAt(e.clientX,e.clientY);released=node?{field:node.dataset.dockField,value:node.dataset.dockValue,label:node.dataset.dockLabel,at:performance.now()}:null},{capture:true});
 function start(){if(active||!host.canEdit()||!pointerDown)return;active=true;released=null;basis=host.capture?.()??null;draw();el.hidden=false;document.documentElement.dataset.dragging='true'}
 function end(){if(!active)return;active=false;clearTimeout(timer);pending=null;setHover(null);el.hidden=true;delete document.documentElement.dataset.dragging}
 function take(){const r=released;released=null;return r&&performance.now()-r.at<1500?r:null}
 async function apply(ids,target){const list=[...new Set(ids)].filter(Boolean);if(!list.length)return false;
  const current=host.tasks?.()||[],closed=list.filter(id=>{const t=current.find(x=>x.id===id);return t&&reopens(t,{...target,reopen:true})}).length,session=basis;basis=null;
  // A drop that changes nothing records no step, so it must not promise Cmd+Z.
  try{const before=validateBoard(current),after=applyDock(current,list,target);if(list.every(id=>JSON.stringify(before.find(t=>t.id===id))===JSON.stringify(after.find(t=>t.id===id)))){host.toast('Без изменений: задача уже там.');return true}}catch(e){host.toast(e.message||String(e));return true}
  // Reveal closed tasks before the change renders, otherwise the row vanishes on a «Готово» drop.
  if(target.field==='status'&&['Готово','Отменено'].includes(target.value))host.revealClosed?.();
  try{const ok=await host.commit(tasks=>applyDock(tasks,list,target),session);if(ok!==false){host.toast(`${dockSummary(target,list.length)}${closed?`. Снова в работе: ${closed}`:''}. Cmd+Z: отменить`)}return true}
  catch(e){host.toast(e.message||String(e));return true}}
 // Returns true when the drop belonged to the dock; the engine then skips its own drop.
 function release(ids){end();const target=take();if(!target)return false;apply(ids,target);return true}
 return {start,end,release,isActive:()=>active};
}
