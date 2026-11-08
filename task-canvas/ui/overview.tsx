import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Minus,Plus,Scan,Hand,ArrowUpRight} from 'lucide-react';
import {LiquidGlassCard} from './vendor/liquid-glass-card';
import {fitMap,zoomMapAt,clampMapZoom,overviewLayout,groupDigest} from '../public/board-camera.mjs';
export function Overview({groups,itemsFor,today,onOpen,onFocus}:any){
 const [compact,setCompact]=useState(false);
 const counts=Object.fromEntries(groups.map(g=>[g.id,itemsFor(g).length])),layout=overviewLayout(groups,counts,compact),stage=useRef<HTMLDivElement>(null),layoutRef=useRef(layout);layoutRef.current=layout;
 const [camera,setCamera]=useState({x:0,y:0,z:.5}),cameraRef=useRef(camera),[hand,setHand]=useState(false),[panning,setPanning]=useState(false),space=useRef(false),gesture=useRef<any>(null),points=useRef(new Map<number,any>()),moved=useRef(false),lastLayout=useRef('');
 const update=(value:any)=>{cameraRef.current=value;setCamera(value)};
 const fit=()=>{const el=stage.current;if(el)update(fitMap(layoutRef.current,el.clientWidth,el.clientHeight,24))};
 const zoom=(factor:number,point?:any)=>{const el=stage.current;if(!el)return;update(zoomMapAt(cameraRef.current,cameraRef.current.z*factor,point||{x:el.clientWidth/2,y:el.clientHeight/2}))};
 useLayoutEffect(()=>{const el=stage.current;if(!el)return;const observer=new ResizeObserver(()=>{setCompact(el.clientWidth<600);fit()});observer.observe(el);fit();return()=>observer.disconnect()},[]);
 useEffect(()=>{const key=layout.w+':'+layout.h;if(lastLayout.current&&lastLayout.current!==key)fit();lastLayout.current=key},[layout.w,layout.h]);
 useEffect(()=>{const el=stage.current;if(!el)return;const wheel=(e:WheelEvent)=>{if(cameraRef.current.z>=.82&&(e.target as Element).closest('.map-task-grid')&&!e.ctrlKey&&!e.metaKey&&!space.current)return;e.preventDefault();const rect=el.getBoundingClientRect();if(e.ctrlKey||e.metaKey)zoom(Math.exp(-e.deltaY*.007),{x:e.clientX-rect.left,y:e.clientY-rect.top});else update({...cameraRef.current,x:cameraRef.current.x-e.deltaX,y:cameraRef.current.y-e.deltaY})};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel)},[]);
 const local=(e:any)=>{const rect=stage.current!.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top}};
 const begin=(e:any)=>{
  if(e.target.closest('.map-controls'))return;
  const point=local(e);points.current.set(e.pointerId,point);
  if(points.current.size===2){const[a,b]=[...points.current.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};gesture.current={pinch:true,distance:Math.hypot(a.x-b.x,a.y-b.y),camera:cameraRef.current,mid};moved.current=true;stage.current?.setPointerCapture(e.pointerId);setPanning(true);return}
  const grid=e.target.closest('.map-task-grid');
  if(e.pointerType==='touch'&&grid&&!hand&&!space.current){gesture.current={point,pointer:e.pointerId,scroll:grid,scrollTop:grid.scrollTop,scrollLeft:grid.scrollLeft};moved.current=false;return}
  if(e.button===1||space.current||hand||!e.target.closest('button')){e.preventDefault();gesture.current={point,camera:cameraRef.current,pointer:e.pointerId};moved.current=false;stage.current?.setPointerCapture(e.pointerId);setPanning(true);stage.current?.focus({preventScroll:true})}
 };
 const move=(e:any)=>{
  if(!points.current.has(e.pointerId))return;const point=local(e);points.current.set(e.pointerId,point);const g=gesture.current;if(!g)return;
  if(g.pinch&&points.current.size===2){const[a,b]=[...points.current.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},z=clampMapZoom(g.camera.z*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,g.distance)),next=zoomMapAt(g.camera,z,g.mid);update({...next,x:next.x+mid.x-g.mid.x,y:next.y+mid.y-g.mid.y});return}
  if(g.pointer!==e.pointerId)return;const dx=point.x-g.point.x,dy=point.y-g.point.y;if(Math.abs(dx)+Math.abs(dy)>5)moved.current=true;if(g.scroll){g.scroll.scrollTop=g.scrollTop-dy;g.scroll.scrollLeft=g.scrollLeft-dx;return}update({...g.camera,x:g.camera.x+dx,y:g.camera.y+dy});
 };
 const end=(e:any)=>{points.current.delete(e.pointerId);if(stage.current?.hasPointerCapture(e.pointerId))stage.current.releasePointerCapture(e.pointerId);gesture.current=null;setPanning(false);setTimeout(()=>{moved.current=false},0)};
 const detailed=camera.z>=.82;
 return <div ref={stage} className={`map-stage ${hand?'hand-tool':''} ${panning?'is-panning':''} ${detailed?'detail-level':'summary-level'}`} role="region" aria-label="Обзор всей доски. Плюс и минус меняют масштаб, F показывает всё, стрелки перемещают обзор." tabIndex={0}
  onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={()=>{gesture.current=null;setPanning(false)}} onBlur={()=>{space.current=false}}
  onClickCapture={e=>{if(!((e.target as Element).closest('.map-controls'))&&(moved.current||hand||space.current)){e.preventDefault();e.stopPropagation();moved.current=false}}}
  onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.code==='Space'){e.preventDefault();space.current=true}if(e.key.toLowerCase()==='f'){e.preventDefault();fit()}if(['+','=','-','0'].includes(e.key)){e.preventDefault();e.key==='0'?update(zoomMapAt(cameraRef.current,1,{x:stage.current!.clientWidth/2,y:stage.current!.clientHeight/2})):zoom(e.key==='-'?1/1.2:1.2)}if(e.key.startsWith('Arrow')){e.preventDefault();const d=e.shiftKey?100:40;update({...cameraRef.current,x:cameraRef.current.x+(e.key==='ArrowLeft'?d:e.key==='ArrowRight'?-d:0),y:cameraRef.current.y+(e.key==='ArrowUp'?d:e.key==='ArrowDown'?-d:0)})}}}
  onKeyUp={e=>{if(e.code==='Space')space.current=false}}>
  <div className="map-world" style={{transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.z})`,width:layout.w,height:layout.h}}>
   {layout.zones.map(g=><div key={g.id} className="map-zone" style={{left:g.x,top:g.y,width:g.w,height:g.h}}>
    {detailed&&<div className="map-task-grid" style={{gridTemplateColumns:`repeat(${g.columns},minmax(0,1fr))`}}>{itemsFor(g).map(t=><button key={t.id} className="map-task" onClick={()=>onOpen(t.id)} aria-label={`Открыть: ${t.title}`}><strong>{t.title}</strong><span>{t.owner||'Не назначен'}{t.due&&' · '+new Intl.DateTimeFormat('ru',{day:'numeric',month:'short'}).format(new Date(t.due+'T12:00:00'))}</span></button>)}</div>}
   </div>)}
  </div>
  <div className="map-labels">{layout.zones.map(g=>{const items=itemsFor(g),digest=groupDigest(items,today);return <section className={`map-zone-label ${g.color}`} key={g.id} aria-label={`Обзор: ${g.title}`} style={{left:camera.x+g.x*camera.z,top:camera.y+g.y*camera.z,width:g.w*camera.z,height:g.h*camera.z}}>
   <button className="map-zone-heading" onClick={()=>onFocus(g.id)} title="Открыть задачи в читаемом масштабе"><span>{g.title}<small>{g.subtitle}</small></span><b>{items.length}</b><ArrowUpRight size={15}/></button>
   {!detailed&&<div className="map-digest"><div className="map-owners">{digest.owners.slice(0,g.id==='inbox'||g.id.startsWith('status:')?1:3).map(([name,count])=><div key={name}><span>{name}</span><b>{count}</b><i style={{width:`${Math.round(Number(count)/Math.max(1,items.length)*100)}%`}}/></div>)}{!items.length&&<span className="map-no-tasks">Нет задач</span>}</div><div className="map-deadlines">{digest.overdue>0?<span className="overdue">Просрочено {digest.overdue}</span>:<span>Со сроком {digest.scheduled}</span>}<span>Без срока {items.length-digest.scheduled}</span></div></div>}
  </section>})}</div>
  <div className="map-caption">{detailed?'Нажмите карточку для подробностей':'Общая нагрузка · нажмите название зоны, чтобы открыть задачи'}</div>
  <LiquidGlassCard className="map-controls" glassSize="sm"><button aria-label="Рука: перемещение обзора" aria-pressed={hand} title="Перемещение мышью или пробелом" onClick={()=>{setHand(!hand);stage.current?.focus()}} className={hand?'active':''}><Hand size={17}/></button><span className="map-control-divider"/><button aria-label="Уменьшить обзор" onClick={()=>zoom(1/1.2)}><Minus size={17}/></button><button className="map-zoom-value" aria-label="Масштаб обзора 100%" title="Вернуть 100%" onClick={()=>{const el=stage.current!;update(zoomMapAt(cameraRef.current,1,{x:el.clientWidth/2,y:el.clientHeight/2}))}}>{Math.round(camera.z*100)}%</button><button aria-label="Увеличить обзор" onClick={()=>zoom(1.2)}><Plus size={17}/></button><span className="map-control-divider"/><button aria-label="Вся доска в обзоре" title="Вписать всю доску (F)" onClick={fit}><Scan size={18}/></button></LiquidGlassCard>
 </div>
}
