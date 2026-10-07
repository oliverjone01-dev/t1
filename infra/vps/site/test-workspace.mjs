import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const stage='/srv/gg/cache/rop-workspace-stage',baseline='/srv/gg/www/current';
const browser=await chromium.launch({headless:true});
const errors=[];
async function open(root,width=1440,height=1000,query=''){
 const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='workspace.local')return route.abort();let file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+'/'))return route.abort();try{if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');await route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.txt')?'text/plain':'text/html; charset=utf-8'});}catch{return route.abort();}});
 await page.goto('http://workspace.local/rop/'+query,{waitUntil:'networkidle'});await page.waitForSelector('#root .card');return page;
}
async function signature(page){return await page.evaluate(()=>({text:document.querySelector('#root').innerText,widgets:document.querySelectorAll('#root .card').length,rows:document.querySelectorAll('#root tr').length,charts:document.querySelectorAll('#root svg').length}));}
async function equal(a,b,label){const x=await signature(a),y=await signature(b);if(JSON.stringify(x)!==JSON.stringify(y))throw Error('Dashboard mismatch: '+label);console.log('PASS unchanged widget content/counts: '+label+' ('+x.widgets+' cards, '+x.rows+' rows, '+x.charts+' charts)');}
try{
 const old=await open(baseline),fresh=await open(stage);
 await equal(old,fresh,'default');
 for(const period of ['today','tm','lm','7']){for(const p of [old,fresh])await p.evaluate(v=>{setPeriod(v);render();},period);await equal(old,fresh,'period '+period);}
 const mgr=await fresh.locator('#gg-manager option').nth(1).getAttribute('value');
 await old.evaluate(v=>{S.fMgr=v;render();},mgr);await fresh.selectOption('#gg-manager',mgr);await equal(old,fresh,'manager');
 for(const [id,state] of [['gg-source','fSrc'],['gg-client','fCli']]){const value=await fresh.locator('#'+id+' option').nth(1).getAttribute('value');await old.evaluate(({state,value})=>{S[state]=value;render();},{state,value});await fresh.selectOption('#'+id,value);await equal(old,fresh,state);}
 await fresh.locator('#gg-reset').click();await old.evaluate(()=>{S.fMgr=S.fSrc=S.fCli=S.fDir='';S.dateBasis='outcome';S.revMode='prepay';S.amtMode='budget';S.gran='week';setPeriod('30');render();});await equal(old,fresh,'reset');
 await fresh.locator('#filtToggle').click();await fresh.locator('#revSeg [data-r=won]').click();await old.evaluate(()=>{S.revMode='won';render();});await equal(old,fresh,'revenue basis');await fresh.keyboard.press('Escape');
 await fresh.locator('#gg-reset').click();
 await fresh.screenshot({path:'/tmp/rop-workspace-desktop.png'});
 for(const id of ['sec3','sec5']){await fresh.locator('#'+id).scrollIntoViewIfNeeded();await fresh.screenshot({path:'/tmp/rop-workspace-'+id+'.png'});}await fresh.evaluate(()=>scrollTo(0,0));
 await fresh.locator('#gg-theme').click();if(await fresh.locator('html').getAttribute('data-theme')!=='dark')throw Error('Theme');await fresh.screenshot({path:'/tmp/rop-workspace-dark.png'});
 await fresh.locator('#gg-theme').click();await fresh.locator('#gg-company-button').click();await fresh.keyboard.press('Escape');if(await fresh.locator('#gg-company-button').getAttribute('aria-expanded')!=='false')throw Error('Brand close');
 await fresh.locator('#dateBtn').click();if(!(await fresh.locator('#calPop').isVisible()))throw Error('Calendar');await fresh.keyboard.press('Escape');
 const mobile=await open(stage,390,844);await mobile.screenshot({path:'/tmp/rop-workspace-mobile.png'});
 const overflow=await mobile.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('#root *')].filter(e=>e.getBoundingClientRect().right>innerWidth&&e.getBoundingClientRect().width>0).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,id:e.id,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width}))}));if(overflow.width>overflow.viewport)throw Error('Mobile overflow '+JSON.stringify(overflow));
 await mobile.locator('#gg-menu').click();if(await mobile.locator('#gg-menu').getAttribute('aria-expanded')!=='true')throw Error('Mobile menu');await mobile.keyboard.press('Escape');
 const deepOld=await open(baseline,1440,1000,'?focus=cal'),deepNew=await open(stage,1440,1000,'?focus=cal');await equal(deepOld,deepNew,'Telegram calendar deep link');
 if(errors.length)throw Error('JS errors: '+JSON.stringify(errors));
 console.log('PASS layout, themes, filters, dropdown, calendar, mobile menu and deep link; no API requests allowed');
}finally{await browser.close();}
