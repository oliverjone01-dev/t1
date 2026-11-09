import {Temperature} from './temperature';
import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Minus,Plus,Scan,Hand,Maximize2,GripVertical,Star} from 'lucide-react';
import {useDroppable,useDndContext} from '@dnd-kit/core';
import {SortableContext,useSortable,verticalListSortingStrategy} from '@dnd-kit/sortable';
import {LiquidGlassCard} from './vendor/liquid-glass-card';
import {PrioritySignals,PriorityEmblem} from './priority-signals';
import {fitMap,focusMapZone,zoomMapAt,clampMapZoom,overviewLayout,groupDigest} from '../public/board-camera.mjs';
import {edgeVelocity} from '../public/overview-dnd.mjs';

function MapTask({task,props,selection,drag,drop,overId,hand}:any){
 const chosen=selection.has(task.id);
 const {attributes,listeners,setNodeRef,isDragging}=useSortable({id:task.id,disabled:!props.editable||props.busy||hand,data:{group:task.status==='Готово'?'status:done':task.status==='Отменено'?'status:cancelled':task.priority||'inbox',overview:true}});
 const insert=overId===task.id&&drop&&!drag?.ids.includes(task.id);
 return <article ref={setNodeRef} data-map-task={task.id} className={`map-task ${chosen?'chosen':''} ${isDragging?'dragging':''} ${insert?(drop.after?'insert-after':'insert-before'):''}`}>
   <Temperature task={task} props={props}/><div className="map-task-copy">
    <button className="map-task-title" aria-label={`Открыть: ${task.title}`} title={task.title} onClick={e=>{if(props.editable&&(e.ctrlKey||e.metaKey||e.shiftKey))props.onSelect(task.id,e.shiftKey);else props.onOpen(task.id)}}>{task.title}</button>
    <span className="map-task-meta" title={`${task.owner||'Не назначен'} · ${task.due||'Без срока'}`}><span>{props.avatars[task.owner]&&<img className="map-avatar" src={props.avatars[task.owner]} alt="" loading="lazy"/>}{task.owner||'Не назначен'}</span>{task.due&&<time className={task.due<props.today&&!['Готово','Отменено'].includes(task.status)?'overdue':''}>{new Intl.DateTimeFormat('ru',{day:'numeric',month:'short'}).format(new Date(task.due+'T12:00:00'))}</time>}{props.notices[task.id]&&<i className="map-task-notice" title={props.notices[task.id]==='new'?'Новая задача':'Изменено в таблице'} aria-label={props.notices[task.id]==='new'?'Новая задача':'Изменено в таблице'}/>}</span>
   </div>
   <button className="task-pin-icon map-pin" aria-label={`${props.pins.includes(task.id)?'Убрать из избранного':'В избранное'}: ${task.title}`} aria-pressed={props.pins.includes(task.id)} disabled={!!drag||hand} onClick={()=>props.onPin(task.id)}><Star size={14}/></button>
   {props.editable&&<div className="map-task-actions"><label className="map-task-check"><input type="checkbox" aria-label={`Выбрать: ${task.title}`} checked={chosen} disabled={props.busy||!!drag} onChange={()=>props.onSelect(task.id)}/></label><button className="map-task-grip" aria-label={`Переместить в обзоре: ${task.title}`} title="Тяните для переноса. Пробел и стрелки - с клавиатуры." {...attributes} {...listeners}><GripVertical size={16}/></button></div>}
 </article>;
}
function MapZone({group,items,props,selection,drag,drop,overId,hand,camera,summary,onFocus,onScroll}:any){
 const {setNodeRef}=useDroppable({id:'zone:'+group.id,data:{group:group.id,overviewZone:true,world:group}});
 const active=drop?.group===group.id;
 const digest=groupDigest(items,props.today),width=group.w*camera.z,height=group.h*camera.z;
 return <section ref={setNodeRef} data-priority={group.id} className={`map-zone-label ${summary?'is-summary':'has-tasks'} ${active?'drop-active':''} ${width<220?'small-zone':''}`} aria-label={`Обзор: ${group.title}`} style={{left:camera.x+group.x*camera.z,top:camera.y+group.y*camera.z,width,height,'--map-title-size':`${Math.max(12,Math.min(15,11+camera.z*2))}px`} as React.CSSProperties}>
  <header className="map-zone-head"><button className="map-zone-heading" onClick={onFocus} disabled={!!drag} title="Приблизить квадрат, оставаясь в обзоре"><PriorityEmblem id={group.id}/><span>{group.title}</span><b>{items.length}</b><Maximize2 size={13}/></button><PrioritySignals group={group}/></header>
  {summary?<div className="map-digest"><div className="map-owners">{digest.owners.slice(0,width<220?1:group.id==='inbox'||group.id.startsWith('status:')?1:3).map(([name,count])=><div key={name}><span>{name}</span><b>{count}</b><i style={{width:`${Math.round(Number(count)/Math.max(1,items.length)*100)}%`}}/></div>)}{!items.length&&<span className="map-no-tasks">Нет задач</span>}</div><div className="map-deadlines">{digest.overdue>0?<span className="overdue">Просрочено {digest.overdue}</span>:<span>Со сроком {digest.scheduled}</span>}<span>Без срока {items.length-digest.scheduled}</span></div></div>
  :<div className={`map-task-grid ${overId==='zone:'+group.id?'insert-end':''}`} onScroll={onScroll}>
    <SortableContext id={'overview:'+group.id} items={items.map(t=>t.id)} strategy={verticalListSortingStrategy}>{items.map(task=><MapTask key={task.id} {...{task,props,selection,drag,drop,overId,hand}}/>)}</SortableContext>
    {!items.length&&<div className="map-empty">{props.editable?'Перенесите задачу сюда':'Нет задач'}</div>}
  </div>}
 </section>;
}
export function Overview({groups,itemsFor,props,selection,drag,drop,overId,summary}:any){
 const [compact,setCompact]=useState(false),stage=useRef<HTMLDivElement>(null);
 const layout=overviewLayout(groups,{},compact),layoutRef=useRef(layout);layoutRef.current=layout;
 const {measureDroppableContainers,droppableContainers}=useDndContext();
 const [camera,setCamera]=useState({x:0,y:0,z:.5}),cameraRef=useRef(camera),[hand,setHand]=useState(false),[panning,setPanning]=useState(false);
 const space=useRef(false),gesture=useRef<any>(null),points=useRef(new Map<number,any>()),moved=useRef(false),lastLayout=useRef(''),dragRef=useRef(drag);dragRef.current=drag;
 const update=(value:any)=>{cameraRef.current=value;setCamera(value)};
 const fit=()=>{const el=stage.current;if(el&&!dragRef.current)update(fitMap(layoutRef.current,el.clientWidth,el.clientHeight,24))};
 const zoom=(factor:number,point?:any)=>{const el=stage.current;if(!el||dragRef.current)return;update(zoomMapAt(cameraRef.current,cameraRef.current.z*factor,point||{x:el.clientWidth/2,y:el.clientHeight/2}))};
 const focus=(group:any)=>{const el=stage.current;if(el&&!dragRef.current)update(focusMapZone(group,el.clientWidth,el.clientHeight))};
 useLayoutEffect(()=>{const el=stage.current;if(!el)return;const observer=new ResizeObserver(()=>{setCompact(el.clientWidth<600);fit()});observer.observe(el);fit();return()=>observer.disconnect()},[]);
 useEffect(()=>{const key=layout.w+':'+layout.h;if(lastLayout.current&&lastLayout.current!==key)fit();lastLayout.current=key},[layout.w,layout.h]);
 // A camera move changes viewport-space drop rectangles even without a resize.
 useLayoutEffect(()=>{if(drag)measureDroppableContainers()},[camera.x,camera.y,camera.z,drag?.id]);
 useEffect(()=>{const el=stage.current;if(!el)return;const wheel=(e:WheelEvent)=>{
   if(dragRef.current){e.preventDefault();return}
   if((e.target as Element).closest('.map-task-grid')&&!e.ctrlKey&&!e.metaKey&&!space.current&&!hand)return;
   e.preventDefault();const rect=el.getBoundingClientRect();if(e.ctrlKey||e.metaKey)zoom(Math.exp(-e.deltaY*.007),{x:e.clientX-rect.left,y:e.clientY-rect.top});else update({...cameraRef.current,x:cameraRef.current.x-e.deltaX,y:cameraRef.current.y-e.deltaY});
  };el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel)},[hand]);
 // Scroll a crowded target list; pan only at the outer edge of the canvas.
 useEffect(()=>{if(!drag)return;let frame=0,last=0;
  const tick=(now:number)=>{const el=stage.current,p=dragRef.current?.point;if(el&&p){const rect=el.getBoundingClientRect(),dt=last?Math.min(2,(now-last)/16.67):1;last=now;
    const velocity=edgeVelocity(p,rect),grid=(document.elementFromPoint(p.x,p.y) as Element)?.closest('.map-task-grid');
    if(grid&&rect.left<=p.x&&p.x<=rect.right&&rect.top<=p.y&&p.y<=rect.bottom){const r=grid.getBoundingClientRect(),v=edgeVelocity(p,r,26,7);if(v.y){const before=grid.scrollTop;grid.scrollTop-=v.y*dt;if(before!==grid.scrollTop)measureDroppableContainers()}}
    if(velocity.x||velocity.y)update({...cameraRef.current,x:cameraRef.current.x+velocity.x*dt,y:cameraRef.current.y+velocity.y*dt});
   }frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
 },[drag?.id]);
 // Keep keyboard insertion targets visible, including long, internally scrolled lists.
 useLayoutEffect(()=>{
  if(!drag||drag.point||!overId)return;
  const target=droppableContainers.get(overId),node=target?.node.current,el=stage.current;if(!node||!el)return;
  const grid=node.closest('.map-task-grid');
  if(grid){const r=node.getBoundingClientRect(),g=grid.getBoundingClientRect();if(r.top<g.top)grid.scrollTop-=g.top-r.top;else if(r.bottom>g.bottom)grid.scrollTop+=r.bottom-g.bottom;measureDroppableContainers()}
  const r=(target.data.current?.overviewZone?node.querySelector('.map-zone-head')||node:node).getBoundingClientRect(),s=el.getBoundingClientRect();
  const dx=r.width>s.width-32?s.left+16-r.left:r.left<s.left+16?s.left+16-r.left:r.right>s.right-16?s.right-16-r.right:0;
  const dy=r.top<s.top+16?s.top+16-r.top:r.bottom>s.bottom-16?s.bottom-16-r.bottom:0;
  if(dx||dy)update({...cameraRef.current,x:cameraRef.current.x+dx,y:cameraRef.current.y+dy});
 },[overId,drag?.id]);
 const local=(e:any)=>{const rect=stage.current!.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top}};
 const begin=(e:any)=>{
  if(e.target.closest('.map-controls')||dragRef.current||(!hand&&!space.current&&e.target.closest('.map-task-grip,input,label')))return;
  const point=local(e);points.current.set(e.pointerId,point);
  if(points.current.size===2){const[a,b]=[...points.current.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};gesture.current={pinch:true,distance:Math.hypot(a.x-b.x,a.y-b.y),camera:cameraRef.current,mid};moved.current=true;stage.current?.setPointerCapture(e.pointerId);setPanning(true);return}
  const grid=e.target.closest('.map-task-grid');
  if(e.pointerType==='touch'&&grid&&!hand&&!space.current){gesture.current={point,pointer:e.pointerId,scroll:grid,scrollTop:grid.scrollTop,scrollLeft:grid.scrollLeft};moved.current=false;return}
  if(e.button===1||space.current||hand||!e.target.closest('button,.map-task-grid')){e.preventDefault();gesture.current={point,camera:cameraRef.current,pointer:e.pointerId};moved.current=false;stage.current?.setPointerCapture(e.pointerId);setPanning(true);stage.current?.focus({preventScroll:true})}
 };
 const move=(e:any)=>{
  if(!points.current.has(e.pointerId))return;const point=local(e);points.current.set(e.pointerId,point);const g=gesture.current;if(!g)return;
  if(g.pinch&&points.current.size===2){const[a,b]=[...points.current.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},z=clampMapZoom(g.camera.z*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,g.distance)),next=zoomMapAt(g.camera,z,g.mid);update({...next,x:next.x+mid.x-g.mid.x,y:next.y+mid.y-g.mid.y});return}
  if(g.pointer!==e.pointerId)return;const dx=point.x-g.point.x,dy=point.y-g.point.y;if(Math.abs(dx)+Math.abs(dy)>5)moved.current=true;
  if(g.scroll){g.scroll.scrollTop=g.scrollTop-dy;g.scroll.scrollLeft=g.scrollLeft-dx;return}update({...g.camera,x:g.camera.x+dx,y:g.camera.y+dy});
 };
 const end=(e:any)=>{points.current.delete(e.pointerId);if(stage.current?.hasPointerCapture(e.pointerId))stage.current.releasePointerCapture(e.pointerId);gesture.current=null;setPanning(false);setTimeout(()=>{moved.current=false},0)};
 return <div ref={stage} className={`map-stage ${hand?'hand-tool':''} ${panning?'is-panning':''} ${summary?'summary-level':'detail-level'} ${drag?'map-dragging':''}`} role="region" aria-label="Обзор всей доски. Плюс и минус меняют масштаб, F показывает всё, стрелки перемещают обзор." tabIndex={0}
  onPointerDownCapture={e=>{if((hand||space.current)&&!e.target.closest('.map-controls')){e.stopPropagation();begin(e)}}} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={()=>{gesture.current=null;setPanning(false)}} onBlur={()=>{space.current=false}}
  onClickCapture={e=>{if(!((e.target as Element).closest('.map-controls'))&&(moved.current||hand||space.current)){e.preventDefault();e.stopPropagation();moved.current=false}}}
  onKeyDown={e=>{if(e.target!==e.currentTarget||drag)return;if(e.code==='Space'){e.preventDefault();space.current=true}if(e.key.toLowerCase()==='f'){e.preventDefault();fit()}if(['+','=','-','0'].includes(e.key)){e.preventDefault();e.key==='0'?update(zoomMapAt(cameraRef.current,1,{x:stage.current!.clientWidth/2,y:stage.current!.clientHeight/2})):zoom(e.key==='-'?1/1.2:1.2)}if(e.key.startsWith('Arrow')){e.preventDefault();const d=e.shiftKey?100:40;update({...cameraRef.current,x:cameraRef.current.x+(e.key==='ArrowLeft'?d:e.key==='ArrowRight'?-d:0),y:cameraRef.current.y+(e.key==='ArrowUp'?d:e.key==='ArrowDown'?-d:0)})}}}
  onKeyUp={e=>{if(e.code==='Space')space.current=false}}>
  <div className="map-labels">{layout.zones.map(group=><MapZone key={group.id} {...{group,props,selection,drag,drop,overId,hand,camera,summary}} items={itemsFor(group)} onFocus={()=>focus(group)} onScroll={()=>{if(drag)measureDroppableContainers()}}/>)}</div>
  <div className="map-caption">{drag?`Перенос: ${drop?groups.find(g=>g.id===drop.group)?.title+' · '+(drop.before?'по линии вставки':'в конец списка'):'отпустите вне зоны для отмены'}`:summary?'Нагрузка по людям и срокам · название приближает квадрат':props.editable?'Тяните за ручку · между карточками меняется очередь':'Нажмите задачу для подробностей · название приближает квадрат'}</div>
  <LiquidGlassCard className="map-controls" glassSize="sm"><button disabled={!!drag} aria-label="Рука: перемещение обзора" aria-pressed={hand} title="Перемещение мышью или пробелом" onClick={()=>{setHand(!hand);stage.current?.focus()}} className={hand?'active':''}><Hand size={17}/></button><span className="map-control-divider"/><button disabled={!!drag} aria-label="Уменьшить обзор" onClick={()=>zoom(1/1.2)}><Minus size={17}/></button><button disabled={!!drag} className="map-zoom-value" aria-label="Масштаб обзора 100%" title="Вернуть 100%" onClick={()=>{const el=stage.current!;update(zoomMapAt(cameraRef.current,1,{x:el.clientWidth/2,y:el.clientHeight/2}))}}>{Math.round(camera.z*100)}%</button><button disabled={!!drag} aria-label="Увеличить обзор" onClick={()=>zoom(1.2)}><Plus size={17}/></button><span className="map-control-divider"/><button disabled={!!drag} aria-label="Вся доска в обзоре" title="Вписать всю доску (F)" onClick={fit}><Scan size={18}/></button></LiquidGlassCard>
 </div>;
}
