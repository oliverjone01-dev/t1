import test from 'node:test';
import assert from 'node:assert/strict';
import {installPriorityEditor} from '../public/priority-editor.mjs';

function browser(){
 const classes=()=>({values:new Set(),toggle(k,v){v?this.values.add(k):this.values.delete(k)}});
 const doc=new EventTarget();doc.body={classList:classes()};doc.activeElement=null;
 let extraModal=false,restored=0,saves=0,toggles=0,lastToggleOpen=null;
 const wide=new EventTarget();wide.matches=true;
 class Dialog extends EventTarget{open=false;modal=false;scrollTop=91;value='Незавершённый текст';classList=classes();style={setProperty(){}};show(){this.open=true;this.modal=false}showModal(){this.open=true;this.modal=true}close(){this.open=false;this.modal=false;queueMicrotask(()=>this.dispatchEvent(new Event('close')))}contains(el){return el===doc.activeElement&&!!el}}
 const dialog=new Dialog();doc.querySelector=s=>s==='dialog:modal'?(extraModal||dialog.modal?{}:null):{focus(){restored++}};
 const originals=Object.fromEntries(['document','window','matchMedia','ResizeObserver','CSS'].map(k=>[k,globalThis[k]]));
 Object.assign(globalThis,{document:doc,window:new EventTarget(),matchMedia:()=>wide,ResizeObserver:class{observe(){}},CSS:{escape:s=>s}});
 const editor=installPriorityEditor({dialog,area:{getBoundingClientRect:()=>({top:120})},mode:()=> 'priority',save:()=>saves++,taskId:()=> 'a',onToggle:()=>{toggles++;lastToggleOpen=dialog.open}});
 return {doc,dialog,wide,editor,get saves(){return saves},get restored(){return restored},get toggles(){return toggles},get lastToggleOpen(){return lastToggleOpen},set extraModal(v){extraModal=v},cleanup(){Object.assign(globalThis,originals)}};
}

test('resizing an open matrix editor changes modality without losing text, scroll or the new panel',async()=>{
 const b=browser();try{
  b.editor.open();assert.equal(b.dialog.modal,false);assert.ok(b.doc.body.classList.values.has('priority-editor-open'));
  b.wide.matches=false;b.wide.dispatchEvent(new Event('change'));await Promise.resolve();
  assert.equal(b.dialog.open,true);assert.equal(b.dialog.modal,true);assert.equal(b.dialog.value,'Незавершённый текст');assert.equal(b.dialog.scrollTop,91);
  assert.equal(b.doc.body.classList.values.has('priority-editor-open'),false);
  b.wide.matches=true;b.wide.dispatchEvent(new Event('change'));await Promise.resolve();
  assert.ok(b.doc.body.classList.values.has('priority-editor-open'));assert.equal(b.dialog.open,true);assert.equal(b.lastToggleOpen,true,'the open-row marker must survive a responsive editor transition');
  const before=b.toggles;b.editor.open();assert.ok(b.toggles>before,'opening another task must refresh the visible row marker');
 }finally{b.cleanup()}
});
test('Escape respects a nested modal, otherwise saves the draft and returns focus to the task',async()=>{
 const b=browser();try{
  b.editor.open();const key=()=>{const e=new Event('keydown',{cancelable:true});e.key='Escape';b.doc.dispatchEvent(e);return e};
  b.extraModal=true;assert.equal(key().defaultPrevented,false);assert.equal(b.dialog.open,true);assert.equal(b.saves,0);
  b.extraModal=false;assert.equal(key().defaultPrevented,true);await Promise.resolve();
  assert.equal(b.saves,1);assert.equal(b.dialog.open,false);assert.equal(b.restored,1);assert.equal(b.doc.body.classList.values.has('priority-editor-open'),false);
 }finally{b.cleanup()}
});
