import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {MotionConfig,motion,AnimatePresence} from 'motion/react';
import {DndContext,PointerSensor,KeyboardSensor,useSensors,useSensor,useDroppable,DragOverlay,closestCorners,closestCenter,pointerWithin} from '@dnd-kit/core';
import {SortableContext,useSortable,rectSortingStrategy,sortableKeyboardCoordinates} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {GripVertical,Maximize2,ArrowLeft,Check,X,ArrowUp,ArrowDown,Layers,Inbox,CheckCheck,Scan,LayoutGrid,SlidersHorizontal} from 'lucide-react';
import SmoothTab from './vendor/smooth-tab';
import {Overview} from './overview';
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
 return <article ref={setNodeRef} style={{transform:CSS.Transform.toString(transform),transition}} className={`matrix-card ${chosen?'chosen':''} ${isDragging?'dragging':''} ${insert===true?'insert-before':insert==='after'?'insert-after':''} ${props.notices[task.id]?'has-update':''}`} data-matrix-task={task.id}>
  <div className="matrix-card-top"><span className="matrix-unit">{task.unit||'Задача'}{task.sourceId&&` · ${task.sourceId}`}</span>{props.notices[task.id]&&<span className="matrix-update" title={props.notices[task.id]==='new'?'Новая карточка из таблицы':'Изменено в таблице'} aria-label={props.notices[task.id]==='new'?'Новая карточка':'Обновлённая карточка'}><i/>{props.notices[task.id]==='new'?'Новое':'Правки'}</span>}<span className={`matrix-state ${group?.id==='status:done'?'is-done':group?.id==='status:cancelled'?'is-cancelled':''}`}>{task.status==='Не указан'?'Без статуса':task.status}</span>
   {props.editable&&<><label className="matrix-check"><input type="checkbox" aria-label={`Выбрать: ${task.title}`} checked={chosen} onChange={()=>{}} onClick={e=>{e.stopPropagation();props.onSelect(task.id,e.shiftKey)}}/></label><button className="matrix-grip" aria-label={`Переместить: ${task.title}`} {...attributes} {...listeners}><GripVertical size={16}/></button></>}
  </div>
  <button className="matrix-title" onClick={e=>{if(props.editable&&(e.metaKey||e.ctrlKey||e.shiftKey))props.onSelect(task.id,e.shiftKey);else props.onOpen(task.id)}}><span>{task.title}</span></button>
  <div className="matrix-card-bottom"><span className="matrix-person" title={task.owner||task.ownerNote||'Без ответственного'}><b aria-hidden="true">{(task.owner||'?').slice(0,1)}</b>{task.owner||'Не назначен'}</span><time className={task.due&&task.due<props.today?'overdue':''}>{task.due?new Intl.DateTimeFormat('ru',{day:'numeric',month:'short'}).format(new Date(task.due+'T12:00:00')):'Без срока'}</time></div>
 </article>
}
function Panel({group,items,props,selection,focus,setFocus,overId,drag}:any){
 const {setNodeRef,isOver}=useDroppable({id:'zone:'+group.id,data:{group:group.id}});
 const all=items.length>0&&items.every(t=>selection.has(t.id));
 return <section className={`matrix-panel ${group.color} ${isOver?'drop-active':''}`} aria-label={group.title}>
  <header className="matrix-panel-head"><div><h3>{group.title}<span>{items.length}</span></h3><p>{group.subtitle}</p></div><div className="matrix-head-actions">{props.editable&&items.length>0&&<button className="matrix-icon" aria-label={`${all?'Снять выделение':'Выбрать все'}: ${group.title}`} title="Выбрать все в квадрате" onClick={()=>props.onSelectGroup(items.map(t=>t.id),!all)}><CheckCheck size={17}/></button>}<button className="matrix-icon" title={focus?'Вернуться к квадратам':'Развернуть квадрат'} aria-label={focus?'Все квадраты':`Развернуть: ${group.title}`} onClick={()=>setFocus(focus?'overview':group.id)}>{focus?<ArrowLeft size={17}/>:<Maximize2 size={17}/>}</button></div></header>
  <div ref={setNodeRef} className={`matrix-scroll ${overId==='zone:'+group.id?'insert-end':''}`}>
   <SortableContext items={items.map(t=>t.id)} strategy={rectSortingStrategy}><div className="matrix-card-grid">{items.map(task=><TaskCard key={task.id} task={task} props={props} chosen={selection.has(task.id)} insert={overId===task.id&&!drag?.ids.includes(task.id)?(placement(overId,drag,props)?.after?'after':true):false}/>)}</div></SortableContext>
   {!items.length&&<div className="matrix-empty"><Layers size={24}/><p>{props.editable?'Перенесите сюда задачи':'Здесь пока нет задач'}</p></div>}
  </div>
 </section>
}
function Board(props:any){
 const [focus,setFocus]=useState('overview'),[surface,setSurface]=useState('work'),[cardScale,setCardScale]=useState(()=>{try{return Math.max(80,Math.min(120,Number(localStorage.getItem('gengroup.task-canvas.card-size.v1'))||100))}catch{return 100}}),[drag,setDrag]=useState<any>(null),[overId,setOverId]=useState<any>(null);
 const selection=new Set(props.selection), sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:7}}),useSensor(KeyboardSensor,{coordinateGetter:keyboardCoordinates}));
 const currentFocus=focus,displayRef=useRef<HTMLDetailsElement>(null);
 React.useEffect(()=>{const close=(e:PointerEvent)=>{if(displayRef.current&&!displayRef.current.contains(e.target as Node))displayRef.current.open=false};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[]);
 React.useEffect(()=>{if(props.focus?.id){setSurface('work');setFocus(props.focus.id)}},[props.focus?.stamp]);
 React.useEffect(()=>{try{localStorage.setItem('gengroup.task-canvas.card-size.v1',String(cardScale))}catch{}},[cardScale]);
 const groupItems=(g)=>ordered(props.tasks.filter(t=>groupFor(t,'priority',props.today)===g.id),'priority',props.today);
 const zones=currentFocus==='overview'?QUADRANTS:GROUPS.filter(g=>g.id===currentFocus);
 const move=(group,before=null)=>props.onMove([...selection],group,before);
 return <MotionConfig reducedMotion="user"><div className="board-ui" onKeyDown={e=>{if(props.editable&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'&&!e.target.closest('input,select,textarea')){e.preventDefault();props.onSelectGroup(props.tasks.map(t=>t.id),true)}if(e.key==='Escape'){if(displayRef.current?.open){displayRef.current.open=false;displayRef.current.querySelector('summary')?.focus()}else selection.size?props.onClear():setFocus('overview')}}}>
 {props.active&&<DndContext sensors={sensors} collisionDetection={collisions} onDragStart={e=>{const ids=selection.has(e.active.id)?[...selection]:[e.active.id];props.onDragStart(ids);setDrag({id:e.active.id,ids});}} onDragOver={e=>setOverId(e.over?.id||null)} onDragCancel={()=>{props.onDragCancel();setDrag(null);setOverId(null)}} onDragEnd={e=>{if(e.over&&drag){const id=String(e.over.id),drop=placement(id,drag,props);if(drop&&!drag.ids.includes(id)){props.onMove(drag.ids,drop.group,drop.before)}else props.onDragCancel()}if(!e.over)props.onDragCancel();setDrag(null);setOverId(null)}} accessibility={{screenReaderInstructions:{draggable:'Для перемещения нажмите пробел на ручке карточки, используйте стрелки, затем пробел. Escape отменяет перенос.'},announcements:{onDragStart:()=> 'Перемещение начато.',onDragOver:()=> 'Выберите место вставки стрелками.',onDragEnd:()=> 'Перемещение завершено.',onDragCancel:()=> 'Перемещение отменено.'}}}>
  <div className={`matrix-shell ${currentFocus!=='overview'?'focus-mode':''} ${surface==='map'?'map-mode':''}`} style={{'--card-min':`${Math.round(224*cardScale/100)}px`,'--card-height':`${Math.round(152*cardScale/100)}px`,'--card-font':`${Math.max(12,14*cardScale/100)}px`} as React.CSSProperties}>
   <div className="matrix-navigation">
    {surface==='work'?<SmoothTab className="matrix-tabs" value={['inbox','status:done','status:cancelled'].includes(currentFocus)?currentFocus:'overview'} onChange={setFocus} label="Область доски" items={[{id:'overview',title:'Квадраты'},{id:'inbox',title:`Входящие · ${groupItems(GROUPS[0]).length}`},{id:'status:done',title:`Готово · ${groupItems(STATUS_LANES[0]).length}`},{id:'status:cancelled',title:`Отменено · ${groupItems(STATUS_LANES[1]).length}`}]}/>:<span className="map-navigation-title">Вся доска <small>{props.tasks.length} задач</small></span>}
    <div className="matrix-view-tools">
     {surface==='work'&&<details ref={displayRef} className="matrix-display"><summary aria-label="Размер карточек" title="Размер карточек"><SlidersHorizontal size={17}/></summary><LiquidGlassCard className="matrix-size-menu" glassSize="sm"><label htmlFor="matrix-card-size">Размер карточек <b>{cardScale}%</b></label><input id="matrix-card-size" aria-label="Размер карточек" type="range" min="80" max="120" step="10" value={cardScale} disabled={!!drag} onChange={e=>setCardScale(Number(e.target.value))}/><div><span>Компактно</span><button onClick={()=>setCardScale(100)}>Обычно</button></div></LiquidGlassCard></details>}
     <SmoothTab className="matrix-tabs matrix-surface-tabs" value={surface} onChange={next=>{props.onClear();setSurface(next)}} label="Представление приоритетов" items={[{id:'work',title:'Карточки',icon:LayoutGrid},{id:'map',title:'Обзор',icon:Scan}]}/>
    </div>
   </div>
   {surface==='map'?<Overview groups={GROUPS} itemsFor={groupItems} today={props.today} onOpen={props.onOpen} onFocus={id=>{setSurface('work');setFocus(id)}}/>:<>
    {drag&&<div className="matrix-drop-tray">{GROUPS.map(g=><DropChip key={g.id} group={g}/>)}</div>}
    <div className={`matrix-panels ${currentFocus==='overview'?'':'focused'}`}>{zones.map(group=><Panel key={group.id} group={group} items={groupItems(group)} props={props} selection={selection} focus={currentFocus!=='overview'} setFocus={setFocus} overId={overId} drag={drag}/>)}</div>
   </>}
  </div>
  <DragOverlay dropAnimation={{duration:170,easing:'cubic-bezier(.2,.8,.2,1)'}}>{drag&&<div className="matrix-drag-preview"><GripVertical size={20}/><strong>{drag.ids.length>1?`${drag.ids.length} задач`:props.tasks.find(t=>t.id===drag.id)?.title}</strong><span>Выберите место вставки</span></div>}</DragOverlay>
 </DndContext>}
 <AnimatePresence>{surface==='work'&&props.editable&&selection.size>0&&<motion.div className="matrix-bulk" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}} transition={{duration:.18}}><LiquidGlassCard className="matrix-bulk-glass" glassSize="sm"><div className="matrix-bulk-content"><strong>Выбрано: {selection.size}</strong><div className="matrix-bulk-order"><button disabled={props.busy} title="В начало квадрата" aria-label="Переместить выбранные в начало" onClick={()=>props.onEdge('start')}><ArrowUp size={18}/></button><button disabled={props.busy} title="В конец квадрата" aria-label="Переместить выбранные в конец" onClick={()=>props.onEdge('end')}><ArrowDown size={18}/></button></div><select disabled={props.busy} aria-label="Перенести выбранные в квадрат" value="" onChange={e=>{if(e.target.value)move(e.target.value)}}><option value="">В квадрат…</option>{GROUPS.slice(0,5).map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select><button disabled={props.busy} className="bulk-done" onClick={()=>move('status:done')}><Check size={17}/>Готово</button><button disabled={props.busy} className="bulk-cancel" onClick={()=>move('status:cancelled')}><X size={17}/>Отменено</button><button className="matrix-icon" aria-label="Снять выделение" onClick={props.onClear}><X size={18}/></button></div></LiquidGlassCard></motion.div>}</AnimatePresence>
 </div></MotionConfig>
}
function DropChip({group}:any){const {setNodeRef,isOver}=useDroppable({id:'tray:'+group.id,data:{group:group.id}});return <div ref={setNodeRef} className={`matrix-drop-chip ${isOver?'drop-active':''}`}>{group.title}</div>}
let root;
export function renderBoard(node,props){root??=createRoot(node);root.render(<Board {...props}/>)}
