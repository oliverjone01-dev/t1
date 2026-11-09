// Reuse the existing editor and its draft/conflict/save pipeline beside the matrix.
export function installPriorityEditor({dialog,area,mode,save,taskId,onToggle}){
 const wide=matchMedia('(min-width:1440px)');
 let docked=false;
 function layout(){if(!docked||!dialog.open)return;const r=area.getBoundingClientRect();dialog.style.setProperty('--priority-editor-top',Math.max(64,r.top)+'px')}
 function mark(value){docked=value;dialog.classList.toggle('priority-editor',value);document.body.classList.toggle('priority-editor-open',value);onToggle?.()}
 function open(){const next=mode()==='priority'&&wide.matches;if(dialog.open){sync();onToggle?.();return}mark(next);next?dialog.show():dialog.showModal();layout();onToggle?.()}
 function sync(){if(!dialog.open)return;const next=mode()==='priority'&&wide.matches;if(next!==docked){const focus=document.activeElement,scroll=dialog.scrollTop;dialog.close();mark(next);next?dialog.show():dialog.showModal();dialog.scrollTop=scroll;if(dialog.contains(focus))focus.focus({preventScroll:true});onToggle?.()}layout()}
 dialog.addEventListener('close',()=>{if(dialog.open)return;mark(false);const id=taskId();const row=id&&document.querySelector(`[data-matrix-task="${CSS.escape(id)}"] .matrix-title`);row?.focus({preventScroll:true})});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.defaultPrevented&&docked&&dialog.open&&!document.querySelector('dialog:modal')){e.preventDefault();save();dialog.close()}});
 wide.addEventListener('change',sync);window.addEventListener('resize',layout);new ResizeObserver(layout).observe(area);
 return {open,sync};
}
