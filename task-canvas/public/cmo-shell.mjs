import {icon} from './icons.mjs?rev=20261120-dnd-21';
// Layout only: existing controls move with their handlers into one toolbar row and two context blocks.
// Nothing here owns task data; the triage chips are filled by productivity.mjs. The strip sits outside
// the foldable panel, so a folded phone layout still shows the morning questions.
export function installCmoShell(){
 const toolbar=document.querySelector('.toolbar'),root=document.querySelector('#display-controls'),registry=document.querySelector('.registry-controls'),search=toolbar?.querySelector('.search');
 if(!toolbar||!root||!registry||!search||root.dataset.cmo)return;
 root.dataset.cmo='true';
 const day=root.querySelector('.day-shortcuts'),options=root.querySelector('.display-options'),hint=root.querySelector('.presentation-hint'),registrySelect=registry.querySelector('.registry-select');
 const section=(title,...nodes)=>{const s=document.createElement('section');s.className='ctx-section';const h=document.createElement('h3');h.textContent=title;s.append(h,...nodes.filter(Boolean));return s};
 const block=(id,title,iconName)=>{const wrap=document.createElement('div');wrap.className='ctx';wrap.innerHTML=`<button type="button" class="ctx-trigger" aria-expanded="false" aria-controls="${id}">${icon(iconName)}<span class="ctx-label">${title}</span>${icon('chevron-down')}</button><div class="ctx-panel" id="${id}" role="group" aria-label="${title}" hidden></div>`;return wrap};
 const period=block('ctx-period','Период','calendar'),view=block('ctx-view','Вид','settings'),filters=block('ctx-filters','Фильтры','filter');
 period.lastElementChild.append(section('Период',registry.querySelector('#period-picker')),section('День',day),section('Какие задачи',registrySelect));
 view.lastElementChild.append(section('Отображение',options,hint));
 // Filters leave the sidebar: app.mjs keeps placing #filter-panel into this slot on desktop.
 const slot=document.querySelector('#desktop-filters-slot');if(slot)filters.lastElementChild.append(slot);
 filters.querySelector('.ctx-trigger').insertAdjacentHTML('beforeend','<b class="ctx-count" hidden></b>');
 registry.hidden=true;
 root.prepend(period,view,filters);search.after(root);
 const triage=document.createElement('div');triage.className='triage-strip';triage.innerHTML='<div id="triage-chips" class="triage-chips" role="group" aria-label="Быстрый фокус"></div>';
 const status=document.querySelector('.status-shortcuts');(document.querySelector('#workspace-controls')||toolbar).after(triage);const work=document.querySelector('#work-context');if(work)triage.append(work);if(status)triage.append(status);
 const blocks=[period,view,filters],trigger=b=>b.firstElementChild,panel=b=>b.lastElementChild;
 function close(b,returnFocus=false){if(panel(b).hidden)return;panel(b).hidden=true;trigger(b).setAttribute('aria-expanded','false');if(returnFocus)trigger(b).focus()}
 function open(b){for(const other of blocks)if(other!==b)close(other);panel(b).hidden=false;trigger(b).setAttribute('aria-expanded','true')}
 for(const b of blocks)trigger(b).onclick=()=>panel(b).hidden?open(b):close(b);
 document.addEventListener('pointerdown',e=>{if(e.target.closest('dialog'))return;for(const b of blocks)if(!b.contains(e.target))close(b)});
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;for(const b of blocks)if(!panel(b).hidden&&!e.target.closest('dialog'))close(b,true)});
 // The period trigger names the chosen period, so the main row answers «за какое время я смотрю».
 const label=period.querySelector('.ctx-label'),source=period.querySelector('[data-period-label]');
 const sync=()=>{const text=source?.textContent.trim();label.textContent=text&&text!=='Всё время'?text:'Всё время';trigger(period).classList.toggle('is-set',!!text&&text!=='Всё время')};
 if(source)new MutationObserver(sync).observe(source,{childList:true,characterData:true,subtree:true});sync();
 // Count of active sidebar filters on the trigger; focus has its own strip.
 const count=filters.querySelector('.ctx-count'),fields=['#unit-filter','#department-filter','#owner-filter'];
 const countFilters=()=>{const n=fields.filter(f=>document.querySelector(f)?.value).length+(document.querySelector('#hide-done')?.checked?1:0);count.textContent=n;count.hidden=!n;trigger(filters).classList.toggle('is-set',n>0)};
 document.addEventListener('change',countFilters);document.addEventListener('click',()=>setTimeout(countFilters));
 const chips=document.querySelector('#triage-chips');if(chips)new MutationObserver(countFilters).observe(chips,{subtree:true,childList:true,characterData:true});countFilters();
}
