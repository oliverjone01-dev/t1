import {icon} from './icons.mjs?rev=20261120-canon-20';
// One zoom for every content view: a pill with −, slider, % and +, trackpad pinch (ctrl+wheel),
// Safari gestures and a two-finger pinch on touch. Each view keeps its own scale on this device.
// Canvas views (lanes on the zoomable map) keep their camera zoom; this pill hides there.
export const ZOOM_KEY='gengroup.task-canvas.zoom.v1',ZOOM_MIN=.5,ZOOM_MAX=1.5;
export const TARGETS=['#board-ui','#grouped-board','#task-list','#calendar-view','#gantt-view'];
export const clampZoom=z=>Math.round(Math.min(ZOOM_MAX,Math.max(ZOOM_MIN,Number(z)||1))*100)/100;
export function readZoom(storage){try{const raw=JSON.parse(storage.getItem(ZOOM_KEY)||'{}');return Object.fromEntries(TARGETS.map(t=>[t,clampZoom(raw?.[t]??1)]))}catch{return Object.fromEntries(TARGETS.map(t=>[t,1]))}}
export function installBoardZoom({storage=localStorage,toast=()=>{}}={}){
 const area=document.querySelector('.board-area');if(!area||document.querySelector('.board-zoom'))return;
 let zoom=readZoom(storage),saveTimer=0;
 const pill=document.createElement('div');pill.className='board-zoom';pill.setAttribute('role','group');pill.setAttribute('aria-label','Масштаб карточек');
 pill.innerHTML=`<button type="button" data-zoom-step="-1" aria-label="Мельче, больше карточек на экране">${icon('minus')}</button><input type="range" min="${ZOOM_MIN*100}" max="${ZOOM_MAX*100}" step="5" aria-label="Масштаб карточек"><button type="button" class="board-zoom-value" title="Вернуть 100%">100%</button><button type="button" data-zoom-step="1" aria-label="Крупнее">${icon('plus')}</button>`;
 area.after(pill);
 const slider=pill.querySelector('input'),value=pill.querySelector('.board-zoom-value');
 const visible=el=>!!el&&!el.hidden&&el.getClientRects().length>0;
 const active=()=>TARGETS.find(t=>visible(document.querySelector(t)));
 function paint(){const t=active();pill.hidden=!t;document.documentElement.dataset.contentZoom=t?'true':'false';if(!t)return;const z=zoom[t];slider.value=String(Math.round(z*100));value.textContent=Math.round(z*100)+'%';slider.style.setProperty('--fill',((z-ZOOM_MIN)/(ZOOM_MAX-ZOOM_MIN)*100)+'%')}
 function apply(){for(const t of TARGETS){const el=document.querySelector(t);if(!el)continue;el.style.zoom=zoom[t]===1?'':String(zoom[t]);el.style.setProperty('--board-zoom',String(zoom[t]))}paint()}
 let relayout=0;
 function set(z,{save=true}={}){const t=active();if(!t)return;const next=clampZoom(z);if(next===zoom[t])return;zoom={...zoom,[t]:next};apply();cancelAnimationFrame(relayout);relayout=requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));if(save){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{storage.setItem(ZOOM_KEY,JSON.stringify(zoom))}catch{toast('Масштаб изменён, но не сохранился на устройстве.')}},250)}}
 const current=()=>zoom[active()]??1;
 pill.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b===value)set(1);else set(current()+Number(b.dataset.zoomStep)*.1)});
 slider.addEventListener('input',()=>set(Number(slider.value)/100));
 // Trackpad pinch arrives as ctrl+wheel in Chrome, Edge and Firefox.
 area.addEventListener('wheel',e=>{if(!e.ctrlKey||!active())return;e.preventDefault();set(current()*Math.exp(-e.deltaY*.01))},{passive:false});
 // Safari reports trackpad pinch as gesture events.
 let gestureStart=1;area.addEventListener('gesturestart',e=>{if(!active())return;e.preventDefault();gestureStart=current()});area.addEventListener('gesturechange',e=>{if(!active())return;e.preventDefault();set(gestureStart*e.scale)});
 // Two-finger pinch on touch screens; one finger keeps scrolling and dragging.
 const touches=new Map();let pinch=null;const distance=()=>{const [a,b]=[...touches.values()];return Math.hypot(a.x-b.x,a.y-b.y)};
 area.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||!active())return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2)pinch={d:distance(),z:current()}});
 area.addEventListener('pointermove',e=>{if(!touches.has(e.pointerId))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&touches.size===2)set(pinch.z*distance()/pinch.d)});
 const end=e=>{touches.delete(e.pointerId);if(touches.size<2)pinch=null};area.addEventListener('pointerup',end);area.addEventListener('pointercancel',end);
 window.addEventListener('storage',e=>{if(e.key===ZOOM_KEY){zoom=readZoom(storage);apply()}});
 const observer=new MutationObserver(paint);for(const t of [...TARGETS,'#viewport']){const el=document.querySelector(t);if(el)observer.observe(el,{attributes:true,attributeFilter:['hidden','style','class']})}
 document.body&&observer.observe(document.body,{attributes:true,attributeFilter:['data-board-mode']});
 apply();return {set,current,paint};
}
