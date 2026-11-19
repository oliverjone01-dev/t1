// Layout of the full task view. Nodes move once; field names, ids and every handler stay as they were.
// Head: id, review arrows, tools, close. Then the title as a heading, the properties as label/value rows,
// the long texts as sections and the sticky actions.
export function installEditorLayout(){
 const dialog=document.querySelector('#editor'),form=dialog?.querySelector('#task-form');if(!form||form.dataset.layout)return;form.dataset.layout='true';
 const $=s=>form.querySelector(s),row=name=>form.querySelector(`[name=${name}]`)?.closest('label');
 const top=$('.dialog-top'),close=top?.querySelector('[data-close=editor]');
 const tools=document.createElement('div');tools.className='ed-tools';
 for(const node of [$('.review-nav'),$('.task-tools')])if(node)tools.append(node);
 if(top&&close)top.insertBefore(tools,close);
 const titleRow=row('title');titleRow?.classList.add('ed-title');
 const heading=$('#editor-title');if(heading){heading.classList.add('visually-hidden')}
 const props=document.createElement('div');props.className='ed-props';props.setAttribute('role','group');props.setAttribute('aria-label','Свойства задачи');
 const order=[row('status'),row('priority'),$('#editor-work'),row('progress'),row('importance'),row('owner'),$('#assignee-hint'),$('#owner-note'),$('#owner-profile'),row('unit'),row('due'),$('#due-presets'),$('#due-note'),row('start'),row('createdAt'),$('#created-note')];
 const notices=['#editor-update','#draft-state','#editor-error','#editor-conflicts'].map(s=>$(s)).filter(Boolean);
 titleRow?.after(...notices,props);
 for(const node of order)if(node)props.append(node);
 for(const r of form.querySelectorAll('.form-row'))if(!r.children.length)r.remove();
 const texts=document.createElement('div');texts.className='ed-texts';
 for(const node of [row('description'),row('comment'),form.querySelector('details')])if(node)texts.append(node);
 props.after(texts);
 for(const r of props.querySelectorAll(':scope>label'))r.classList.add('ed-prop');
}
