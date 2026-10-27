import {readFileSync} from 'node:fs';
import {KPAGES,navButton} from '../katya-nav.js';
import {competitorSourceSwitch,sourceSwitchCss} from './source-switch.js';

// This is the user-approved historical cabinet snapshot, not a live collector.
// Membership, nulls, periods and signals are transferred from the reviewed prototype.
export function validateCabinetSnapshot(d:any):any {
 const fail=(m:string):never=>{throw new Error('cabinet competitors: '+m)};
 if(d?.meta?.updateDate!=='2026-10-26'||!d.meta.sameUpdateOn26And27)fail('snapshot date');
 if(!Array.isArray(d.categories)||d.categories.length!==7||new Set(d.categories).size!==7)fail('categories');
 if(d.market?.category!=='Стол обеденный')fail('market scope');
 if(d.catalog?.length!==1000||new Set(d.catalog.map((r:any)=>r.sku)).size!==1000)fail('category rows');
 if(d.catalog.some((r:any)=>r.category3!=='Стол обеденный'))fail('category population');
 if(d.pairs?.length!==29||new Set(d.pairs.map((p:any)=>p.ownSku+':'+p.competitorSku)).size!==29)fail('pairs');
 for(const p of d.pairs)if(!d.ownIndex[p.ownSku]||!d.watch[p.competitorSku]||d.ownIndex[p.competitorSku])fail('mapping roles');
 for(const [sku,r] of Object.entries(d.ownIndex) as [string,any][]){
  if(r.sku!==sku||!d.categories.includes(d.categoryMap[sku]))fail('own category');
 }
 for(const period of ['28','7']) {
  const rows=d.snapshots?.[period];if(!rows||Object.keys(rows).length!==133)fail('coverage');
  for(const [sku,r] of Object.entries(rows) as [string,any][]){
   if(r.sku!==sku||!d.watch[sku])fail('sku');
   if(r.state==='no_orders'&&(r.soldCount!==0||r.soldSum!==0||r.avgPrice!==null))fail('zero vs missing');
   if(r.state==='not_found'&&(r.soldCount!==null||r.soldSum!==null))fail('unknown orders');
  }
 }
 const walk=(v:any,k='')=>{
  if(typeof v==='number'&&!Number.isFinite(v))fail('nonfinite');
  if(typeof v==='string'&&(/\/(?:Users|home)\//.test(v)||/\b(?:Bearer |ghp_|sk-proj-)/.test(v)))fail('private payload');
  if(k==='link'&&v!=null&&v!==''&&!/^https:\/\/(?:www\.)?ozon\.ru\/product\/\d+\/?$/.test(v))fail('unsafe product link');
  if(v&&typeof v==='object')for(const [key,x]of Object.entries(v))walk(x,key);
 };walk(d);
 return d;
}
export function cabinetCompetitorPage(snapshot:any):string{
 const d=validateCabinetSnapshot(snapshot);
 const template=readFileSync('katya/competitors/cabinet/template.html','utf8');
 if(template.split('__DATA__').length!==2)throw new Error('cabinet competitors: data placeholder');
 const nav=KPAGES.map(([h,l,k])=>navButton(h,l,k==='competitors')).join(' ');
 return template.replace('__DATA__',()=>JSON.stringify(d).replace(/</g,'\\u003c'))
  .replace('</head>',`<style>${sourceSwitchCss}</style></head>`)
  .replace('<body>',`<body><div class="competitor-dashboard-nav">${nav}</div>${competitorSourceSwitch('cabinet')}`);
}
