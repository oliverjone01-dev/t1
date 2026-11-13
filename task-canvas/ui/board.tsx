import {Temperature,StatusBadge,WorkProgress} from './temperature';
import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {MotionConfig,motion,AnimatePresence,useReducedMotion} from 'motion/react';
import {DndContext,PointerSensor,KeyboardSensor,useSensors,useSensor,useDroppable,DragOverlay,closestCorners,closestCenter,pointerWithin} from '@dnd-kit/core';
import {SortableContext,useSortable,rectSortingStrategy,verticalListSortingStrategy,sortableKeyboardCoordinates} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {GripVertical,Maximize2,ArrowLeft,Check,X,ArrowUp,ArrowDown,Layers,Inbox,CheckCheck,Scan,LayoutGrid,SlidersHorizontal,Star} from 'lucide-react';
import SmoothTab from './vendor/smooth-tab';
import {Overview} from './overview';
import {PrioritySignals,PriorityEmblem} from './priority-signals';
import {overviewPlacement,neighboringZone} from '../public/overview-dnd.mjs';
import {LiquidGlassCard} from './vendor/liquid-glass-card';
import {QUADRANTS,STATUS_LANES,groupFor} from '../public/model.mjs';
import {ordered} from '../public/order.mjs';
const GROUPS=[{id:'inbox',title:'Входящие',subtitle:'Приоритет ещё не назначен',color:'slate'},...QUADRANTS,...STATUS_LANES];
function keyboardCoordinates(event,args){
 const containers=args.context.droppableContainers,group=args.context.active?.data.current?.group;
 return sortableKeyboardCoordinates(event,{...args,context:{...args.context,droppableContainers:{get:id=>containers.get(id),getEnabled:()=>containers.getEnabled().filter(c=>!String(c.id).startsWith('zone:')&&!String(c.id).startsWith('tray:')&&c.data.current?.group===group)}}});
}
function collisions(args){
 if(!args.pointerCoordinates)return closestCenter({...args,droppableContainers:args.droppableContainers.filter(c=>!String(c.id).startsWith('zone:')&&!String(c.id).startsWith('tray:'))});
 const hits=pointerWithin(args),tray=hits.filter(c=>String(c.id).startsWith('tray:'));
 if(tray.length)return tray;
 const zones=hits.filter(c=>String(c.id).startsWith('zone:'));
 if(!zones.length)return [];
 const group=String(zones[0].id).slice(5);
 const cards=hits.filter(c=>!String(c.id).startsWith('zone:')&&args.droppableContainers.find(d=>d.id===c.id)?.data.current?.group===group);
 return cards.length?cards:zones;
}
function placement(id,drag,props){
 if(/^(zone:|tray:)/.test(id))return {group:id.slice(5),before:null,after:false};
 const target=props.tasks.find(t=>t.id===id),active=props.tasks.find(t=>t.id===drag?.id);
 if(!target||!active)return null;
 const group=groupFor(target,'priority',props.today),items=ordered(props.tasks.filter(t=>groupFor(t,'priority',props.today)===group),'priority',props.today);
 const after=groupFor(active,'priority',props.today)===group&&items.findIndex(t=>t.id===active.id)<items.findIndex(t=>t.id===id);
 const rest=items.filter(t=>!drag.ids.includes(t.id)),index=rest.findIndex(t=>t.id===id);
 return {group,before:after?rest[index+1]?.id||null:id,after};
}
function TaskCard({task,props,chosen,insert,overlay=false}:any){
 const {attributes,listeners,setNodeRef,transform,transition,isDragging}=useSortable({id:task.id,disabled:!props.editable||overlay,data:{group:groupFor(task,'priority',props.today)}});
 const group=GROUPS.find(g=>g.id===groupFor(task,'priority',props.today));
 return <article ref={setNodeRef} style={{transform:CSS.Transform.toString(transform),transition}} className={`matrix-card ${props.openId===task.id?'is-open':''} ${chosen?'chosen':''} ${isDragging?'dragging':''} ${insert===true?'insert-before':insert==='after'?'insert-after':''} ${props.notices[task.id]?'has-update':''}`} data-task-status={task.status} data-matrix-task={task.id}>
  {props.editable&&<div className="matrix-row-handle"><button className="matrix-grip" aria-label={`Переместить: ${task.title}`} title="Тяните для переноса; пробел и стрелки — с клавиатуры" {...attributes} {...listeners}><GripVertical size={16}/></button><label className="matrix-check"><input type="checkbox" aria-label={`Выбрать: ${task.title}`} checked={chosen} onChange={()=>{}} onClick={e=>{e.stopPropagation();props.onSelect(task.id,e.shiftKey)}}/></label></div>}
  <div className="matrix-row-body"><button className="matrix-title" title={task.title} aria-expanded={props.openId===task.id} onClick={e=>{if(props.editable&&(e.metaKey||e.ctrlKey||e.shiftKey))props.onSelect(task.id,e.shiftKey);else props.onOpen(task.id)}}><span>{task.title}</span></button>
  <div className="matrix-row-meta"><span className="matrix-person" title={task.owner||task.ownerNote||'Без ответственного'}><b aria-hidden="true">{props.avatars[task.owner]?<img src={props.avatars[task.owner]} alt="" loading="lazy"/>:(task.owner||'?').slice(0,1)}</b>{task.owner||'Не назначен'}</span><time className={task.due&&task.due<props.today&&!['Готово','Отменено'].includes(task.status)?'overdue':''}>{task.due?new Intl.DateTimeFormat('ru',{day:'numeric',month:'short'}).format(new Date(task.due+'T12:00:00')):'Без срока'}</time><span className="matrix-unit">{task.unit}{task.sourceId&&` · #${task.sourceId}`}</span></div>
  <div className="matrix-signal-row"><WorkProgress task={task} props={props}/><Temperature task={task} props={props}/><StatusBadge task={task} props={props}/>{props.notices[task.id]&&<span className="matrix-update" title="Изменения из таблицы"><i/>{props.notices[task.id]==='new'?'Новое':'Правки'}</span>}</div></div>
  <button className="task-pin-icon matrix-row-pin" aria-label={`${props.pins.includes(task.id)?'Убрать из избранного':'В избранное'}: ${task.title}`} aria-pressed={props.pins.includes(task.id)} onClick={()=>props.onPin(task.id)}><Star size={15}/></button>
 </article>
}
function Panel({group,items,props,selection,focus,setFocus,overId,drag}:any){
 const {setNodeRef,isOver}=useDroppable({id:'zone:'+group.id,data:{group:group.id}});
 const all=items.length>0&&items.every(t=>selection.has(t.id));
 return <section className={`matrix-panel ${group.color} ${isOver?'drop-active':''}`} aria-label={group.title} data-priority={group.id}>
  <header className="matrix-panel-head"><div><h3><PriorityEmblem id={group.id}/>{group.title}<span>{items.length}</span></h3><PrioritySignals group={group}/></div><div className="matrix-head-actions">{props.editable&&items.length>0&&<button className="matrix-icon" aria-label={`${all?'Снять выделение':'Выбрать все'}: ${group.title}`} title="Выбрать все в квадрате" onClick={()=>props.onSelectGroup(items.map(t=>t.id),!all)}><CheckCheck size={17}/></button>}<button className="matrix-icon" title={focus?'Вернуться к квадратам':'Развернуть квадрат'} aria-label={focus?'Все квадраты':`Развернуть: ${group.title}`} onClick={()=>setFocus(focus?'overview':group.id)}>{focus?<ArrowLeft size={17}/>:<Maximize2 size={17}/>}</button></div></header>
  <div ref={setNodeRef} className={`matrix-scroll ${overId==='zone:'+group.id?'insert-end':''}`}>
   <SortableContext items={items.map(t=>t.id)} strategy={verticalListSortingStrategy}><div className="matrix-card-grid">{items.map(task=><TaskCard key={task.id} task={task} props={props} chosen={selection.has(task.id)} insert={overId===task.id&&!drag?.ids.includes(task.id)?(placement(overId,drag,props)?.after?'after':true):false}/>)}</div></SortableContext>
   {!items.length&&<div className="matrix-empty"><Layers size={24}/><p>{props.editable?'Перенесите сюда задачи':'Здесь пока нет задач'}</p></div>}
  </div>
 </section>
}
function Board(props:any){
 const reduceMotion=useReducedMotion();
 const [focus,setFocus]=useState('overview'),[surface,setSurface]=useState('work'),[cardScale,setCardScale]=useState(()=>{try{return Math.max(80,Math.min(120,Number(localStorage.getItem('gengroup.task-canvas.card-size.v1'))||100))}catch{return 100}}),[drag,setDrag]=useState<any>(null),[overId,setOverId]=useState<any>(null),[drop,setDrop]=useState<any>(null),[summary,setSummary]=useState(false);
 const pointer=useRef<any>(null),keyboardTarget=useRef<any>(null);
 const selection=new Set(props.selection);
 const mapCoordinates=(event,args)=>{
  if(!event.key.startsWith('Arrow'))return;
  const {active,over,droppableContainers:containers,droppableRects:rects,collisionRect}=args.context;
  if(!active||!collisionRect)return;
  event.preventDefault();
  const current=containers.get(keyboardTarget.current||over?.id||active.id)||containers.get(active.id),group=current?.data.current?.group;
  let target;
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'||event.altKey){
   const zones=containers.getEnabled().filter(c=>c.data.current?.overviewZone).map(c=>c.data.current.world);
   const next=neighboringZone(zones,group,event.key);if(next)target='zone:'+next;
  }else{
   const zone=containers.getEnabled().find(c=>c.data.current?.group===group&&c.data.current?.sortable);
   const ids=zone?.data.current.sortable.items||[],offset=event.key==='ArrowUp'?-1:1;
   let index=ids.indexOf(current.id);index=index<0?(offset<0?ids.length-1:0):index+offset;
   while(index>=0&&index<ids.length&&drag?.ids.includes(ids[index]))index+=offset;
   target=ids[index];
  }
  const rect=target&&rects.get(target);if(!rect)return;
  keyboardTarget.current=target;
  // Only the explicit identity participates in keyboard collision detection.
  return {x:rect.left+(rect.width-collisionRect.width)/2,y:rect.top+(rect.height-collisionRect.height)/2};
 };
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:7}}),useSensor(KeyboardSensor,{coordinateGetter:(event,args)=>surface==='map'?mapCoordinates(event,args):keyboardCoordinates(event,args)}));
 const detect=(args)=>{
  pointer.current=args.pointerCoordinates;
  if(surface==='map'&&!args.pointerCoordinates&&keyboardTarget.current)return closestCenter({...args,droppableContainers:args.droppableContainers.filter(c=>c.id===keyboardTarget.current)});
  if(surface==='map'&&args.pointerCoordinates&&document.elementFromPoint(args.pointerCoordinates.x,args.pointerCoordinates.y)?.closest('.map-controls'))return [];
  return collisions(args);
 };
 const mapDrop=(event)=>overviewPlacement({targetId:event.over?.id,activeId:drag?.id,ids:drag?.ids||[],tasks:props.tasks,today:props.today,pointerY:pointer.current?.y,rect:event.over?.rect});
 const clearDrag=()=>{setDrag(null);setOverId(null);setDrop(null);pointer.current=null;keyboardTarget.current=null};
 const track=(event)=>{setOverId(event.over?.id||null);if(surface==='map'){setDrop(mapDrop(event));setDrag(prior=>prior?{...prior,point:pointer.current}:null)}};
 const currentFocus=focus,displayRef=useRef<HTMLDetailsElement>(null);
 React.useEffect(()=>{const close=(e:PointerEvent)=>{if(displayRef.current&&!displayRef.current.contains(e.target as Node))displayRef.current.open=false};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[]);
 React.useEffect(()=>{if(props.focus?.id){setSurface('work');setFocus(props.focus.id)}},[props.focus?.stamp]);
 React.useEffect(()=>{try{localStorage.setItem('gengroup.task-canvas.card-size.v1',String(cardScale))}catch{}},[cardScale]);
 const groupItems=(g)=>ordered(props.tasks.filter(t=>groupFor(t,'priority',props.today)===g.id),'priority',props.today);
 const zones=currentFocus==='overview'?QUADRANTS:GROUPS.filter(g=>g.id===currentFocus);
 const move=(group,before=null)=>props.onMove([...selection],group,before);
 return <MotionConfig reducedMotion="user"><div className={`board-ui ${surface==='map'?'overview-active':''}`} onKeyDown={e=>{if(drag||e.defaultPrevented)return;if(props.editable&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'&&!e.target.closest('input,select,textarea')){e.preventDefault();props.onSelectGroup(props.tasks.map(t=>t.id),true)}if(e.key==='Escape'){if(displayRef.current?.open){displayRef.current.open=false;displayRef.current.querySelector('summary')?.focus()}else selection.size?props.onClear():setFocus('overview')}}}>
 {props.active&&<DndContext sensors={sensors} autoScroll={surface!=='map'} collisionDetection={detect} onDragStart={e=>{if(!props.editable||props.busy)return;const ids=selection.has(e.active.id)?[...selection]:[e.active.id];props.onDragStart(ids);keyboardTarget.current=null;setDrag({id:e.active.id,ids,point:null});}} onDragMove={track} onDragOver={track} onDragCancel={()=>{props.onDragCancel();clearDrag()}} onDragEnd={e=>{const id=String(e.over?.id||''),target=surface==='map'?mapDrop(e):e.over&&placement(id,drag,props);if(target&&drag&&!drag.ids.includes(id))props.onMove(drag.ids,target.group,target.before);else props.onDragCancel();clearDrag()}} accessibility={{screenReaderInstructions:{draggable:surface==='map'?'Пробел поднимает карточку. Вверх и вниз меняют очередь. Влево и вправо, либо Alt и вверх или вниз выбирают другой квадрат. Пробел подтверждает, Escape отменяет.':'Для перемещения нажмите пробел на ручке карточки, используйте стрелки, затем пробел. Escape отменяет перенос.'},announcements:{onDragStart:()=> 'Перемещение начато.',onDragOver:e=>{const g=e.over?.data.current?.group;return 'Место переноса: '+(GROUPS.find(x=>x.id===g)?.title||'вне доски')+'. Пробел подтверждает.'},onDragEnd:()=> 'Перемещение завершено.',onDragCancel:()=> 'Перемещение отменено.'}}}>
  <div className={`matrix-shell ${currentFocus!=='overview'?'focus-mode':''} ${surface==='map'?'map-mode':''}`} style={{'--card-min':`${Math.round(224*cardScale/100)}px`,'--card-height':`${Math.round(152*cardScale/100)}px`,'--card-font':`${Math.max(12,16*cardScale/100)}px`} as React.CSSProperties}>
   <div className="matrix-navigation">
    {surface==='work'?<SmoothTab className="matrix-tabs" value={['inbox','status:done','status:cancelled'].includes(currentFocus)?currentFocus:'overview'} onChange={setFocus} label="Область доски" items={[{id:'overview',title:'Квадраты'},{id:'inbox',title:`Входящие · ${groupItems(GROUPS[0]).length}`},{id:'status:done',title:`Готово · ${groupItems(STATUS_LANES[0]).length}`},{id:'status:cancelled',title:`Отменено · ${groupItems(STATUS_LANES[1]).length}`}]}/>:<SmoothTab className="matrix-tabs map-content-tabs" value={summary?'summary':'tasks'} onChange={value=>{if(!drag)setSummary(value==='summary')}} label="Содержание обзора" items={[{id:'tasks',title:'Задачи'},{id:'summary',title:'Сводка'}]}/>}
    <div className="matrix-view-tools">
     {surface==='work'&&<details ref={displayRef} className="matrix-display"><summary aria-label="Размер текста" title="Размер текста"><SlidersHorizontal size={17}/></summary><LiquidGlassCard className="matrix-size-menu" glassSize="sm"><label htmlFor="matrix-card-size">Размер текста <b>{cardScale}%</b></label><input id="matrix-card-size" aria-label="Размер текста" type="range" min="80" max="120" step="10" value={cardScale} disabled={!!drag} onChange={e=>setCardScale(Number(e.target.value))}/><div><span>Компактно</span><button onClick={()=>setCardScale(100)}>Обычно</button></div></LiquidGlassCard></details>}
     <SmoothTab className="matrix-tabs matrix-surface-tabs" value={surface} onChange={next=>{if(!drag){props.onClear();setSurface(next)}}} label="Представление приоритетов" items={[{id:'work',title:'Матрица',icon:LayoutGrid},{id:'map',title:'Обзор',icon:Scan}]}/>
    </div>
   </div>
   {surface==='map'?<Overview groups={GROUPS} itemsFor={groupItems} {...{props,selection,drag,drop,overId,summary}}/>:<>
    {drag&&<div className="matrix-drop-tray">{GROUPS.map(g=><DropChip key={g.id} group={g}/>)}</div>}
    <div className={`matrix-panels ${currentFocus==='overview'?'':'focused'}`}>{zones.map(group=><Panel key={group.id} group={group} items={groupItems(group)} props={props} selection={selection} focus={currentFocus!=='overview'} setFocus={setFocus} overId={overId} drag={drag}/>)}</div>
   </>}
  </div>
  <DragOverlay dropAnimation={reduceMotion?null:{duration:170,easing:'cubic-bezier(.2,.8,.2,1)'}}>{drag&&(surface!=='map'||drag.point)&&<div className="matrix-drag-preview"><GripVertical size={20}/><strong>{drag.ids.length>1?`${drag.ids.length} задач`:props.tasks.find(t=>t.id===drag.id)?.title}</strong><span>Выберите место вставки</span></div>}</DragOverlay>
 </DndContext>}
 <AnimatePresence>{props.active&&props.editable&&!drag&&selection.size>0&&<motion.div className="matrix-bulk" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}} transition={{duration:.18}}><LiquidGlassCard className="matrix-bulk-glass" glassSize="sm"><div className="matrix-bulk-content"><strong>Выбрано: {selection.size}</strong><button disabled={props.busy} onClick={props.onBulkEdit}>Изменить</button><div className="matrix-bulk-order"><button disabled={props.busy} title="В начало квадрата" aria-label="Переместить выбранные в начало" onClick={()=>props.onEdge('start')}><ArrowUp size={18}/></button><button disabled={props.busy} title="В конец квадрата" aria-label="Переместить выбранные в конец" onClick={()=>props.onEdge('end')}><ArrowDown size={18}/></button></div><select disabled={props.busy} aria-label="Перенести выбранные в квадрат" value="" onChange={e=>{if(e.target.value)move(e.target.value)}}><option value="">В квадрат…</option>{GROUPS.slice(0,5).map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select><button disabled={props.busy} className="bulk-done" onClick={()=>move('status:done')}><Check size={17}/>Готово</button><button disabled={props.busy} className="bulk-cancel" onClick={()=>move('status:cancelled')}><X size={17}/>Отменено</button><button className="matrix-icon" aria-label="Снять выделение" onClick={props.onClear}><X size={18}/></button></div></LiquidGlassCard></motion.div>}</AnimatePresence>
 </div></MotionConfig>
}
function DropChip({group}:any){const {setNodeRef,isOver}=useDroppable({id:'tray:'+group.id,data:{group:group.id}});return <div ref={setNodeRef} className={`matrix-drop-chip ${isOver?'drop-active':''}`}>{group.title}</div>}
let root;
export function renderBoard(node,props){root??=createRoot(node);root.render(<Board {...props}/>)}
