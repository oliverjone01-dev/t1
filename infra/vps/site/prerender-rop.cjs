// Build-time rendering only. All data requests stay on the local dashboard API.
process.env.PLAYWRIGHT_BROWSERS_PATH='/opt/gg-previews/browsers';
const {chromium}=require('/opt/gg-previews/node_modules/playwright');
const fs=require('fs'),path=require('path');
(async()=>{
 const site=path.resolve(process.argv[2]),file=path.join(site,'rop/index.html');
 let html=fs.readFileSync(file,'utf8');
 if(html.includes('data-gg-firstpaint-style'))throw Error('First screen already prepared');
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.origin!=='http://127.0.0.1:18765')return route.abort();
   if(u.pathname==='/rop/')return route.fulfill({contentType:'text/html',body:html});
   if(u.pathname.startsWith('/_system/')){const response=await route.fetch({url:'http://127.0.0.1:18765'+u.pathname.slice(8)+u.search});return route.fulfill({response});}
   const local=path.resolve(site,'.'+decodeURIComponent(u.pathname));
   if(!local.startsWith(site+path.sep)||!fs.existsSync(local)||!fs.statSync(local).isFile())return route.abort();
   return route.fulfill({path:local});
  });
  await page.goto('http://127.0.0.1:18765/rop/',{waitUntil:'domcontentloaded'});
  await page.locator('#gg-db-loading').waitFor({state:'detached',timeout:60000});
  if(errors.length)throw Error(errors.join(';'));
  const capture=()=>{
   const root=document.getElementById('root');let html='';
   for(const child of root.children){html+=child.outerHTML;}
   const cells=[...root.querySelectorAll('.kpi-strip .kpi-cell')].slice(0,9).map(n=>n.innerText.replace(/\s+/g,' ').trim());
   const preview=node=>{if(!node)return '';const clone=node.cloneNode(true);clone.querySelectorAll('[id]').forEach(n=>{n.dataset.ggPreviewId=n.id;n.removeAttribute('id');});clone.querySelectorAll('button,input,select,a').forEach(n=>{n.setAttribute('tabindex','-1');});return clone.innerHTML;};
   const ids=new Set([...document.querySelectorAll('.gg-filter-toolbar [id],#gg-freshness [id],#gg-plan-actions [id]')].map(n=>n.id));
   const alias=text=>text.replace(/#([a-zA-Z_][\w-]*)/g,(m,id)=>ids.has(id)?':is(#gg-preview-css-anchor,[data-gg-preview-id="'+id+'"])':m);
   function rules(list){return [...list].map(r=>{if(r.selectorText)return alias(r.selectorText)!==r.selectorText?alias(r.selectorText)+'{'+r.style.cssText+'}':'';if(r.cssRules&&r.conditionText)return r.cssText.slice(0,r.cssText.indexOf('{')+1)+rules(r.cssRules)+'}';return '';}).join('');}
   const previewStyles=[...document.styleSheets].map(s=>{try{return rules(s.cssRules);}catch{return '';}}).join('');
   return {html,cells,previewStyles,fresh:preview(document.getElementById('gg-freshness')),actions:preview(document.getElementById('gg-plan-actions')),toolbar:preview(document.querySelector('.gg-filter-toolbar')),version:new URL(document.querySelector('[data-gg-db-payload]').dataset.ggDbPayload,location.href).searchParams.get('version')};
  };
  const result=await page.evaluate(capture);
  await page.setViewportSize({width:390,height:1000});
  await page.evaluate(async()=>{render();await document.fonts.ready;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
  const mobile=await page.evaluate(capture);
  if(result.cells.length!==9||!result.html.includes('sec1'))throw Error('Incomplete first screen');
  const target=/(<div\b[^>]*\bid="root"[^>]*>)<\/div>/;
  if(!target.test(html))throw Error('Native root marker changed');
  html=html.replace(target,(_,open)=>open.slice(0,-1)+' data-gg-firstpaint="'+result.version+'">'+result.html+'</div>');
  const initial=await page.evaluate(({source,result,mobile})=>{
   const doc=new DOMParser().parseFromString(source,'text/html');
   const template=doc.createElement('template');template.id='gg-firstpaint-mobile';template.innerHTML=mobile.html;doc.getElementById('root').before(template);
   const preview=(host,markup,tag='span')=>{const n=doc.createElement(tag);n.dataset.ggFirstpaintPreview='';n.inert=true;n.setAttribute('aria-hidden','true');n.innerHTML=markup;host.append(n);return n;};
   preview(doc.getElementById('gg-freshness'),result.fresh);
   preview(doc.getElementById('gg-plan-actions'),result.actions);
   const bar=doc.querySelector('.gg-filter-toolbar'),placeholder=doc.createElement('section');placeholder.className='gg-filter-toolbar gg-firstpaint-toolbar';placeholder.inert=true;placeholder.setAttribute('aria-hidden','true');placeholder.dataset.ggFirstpaintPreview='';placeholder.innerHTML=result.toolbar;bar.before(placeholder);bar.dataset.ggHydratedToolbar='';
   return '<!DOCTYPE html>'+doc.documentElement.outerHTML;
  },{source:html,result,mobile});html=initial;
  const css=result.previewStyles+'#gg-freshness>[data-gg-firstpaint-preview],#gg-plan-actions>[data-gg-firstpaint-preview]{display:contents}html{scrollbar-gutter:stable}#root{overflow-anchor:none}html[data-gg-mobile-preview=pending] #root[data-gg-firstpaint]{visibility:hidden!important}html[data-gg-ui=pending] #root[data-gg-firstpaint]{visibility:visible;pointer-events:none}html[data-gg-ui=pending][data-gg-firstpaint-skip] #root[data-gg-firstpaint]{visibility:hidden}html[data-gg-ui=pending] [data-gg-hydrated-toolbar]{display:none!important}.gg-firstpaint-toolbar .gg-toolbar-top{visibility:visible!important}.gg-firstpaint-toolbar [data-gg-preview-id=gg-period-slot]{flex:1;min-width:0}.gg-firstpaint-toolbar [data-gg-preview-id=gg-date-slot]{margin-left:auto;flex:none}.gg-firstpaint-toolbar [data-gg-preview-id=gg-gran-slot]{flex:none}html:has(#root[data-gg-firstpaint]) #gg-db-loading{position:fixed;right:12px;bottom:12px;z-index:999;border-radius:6px;background:var(--bg-card,#171a1f);padding:7px 10px!important;font-size:11px!important}';
  const early='if(innerWidth<=800)document.documentElement.dataset.ggMobilePreview="pending";if(location.search)document.documentElement.dataset.ggFirstpaintSkip="true";new MutationObserver(function(_,observer){if(document.documentElement.dataset.ggUi!=="ready")return;document.querySelectorAll("[data-gg-firstpaint-preview]").forEach(n=>n.remove());observer.disconnect();}).observe(document.documentElement,{attributes:true,attributeFilter:["data-gg-ui"]});';
  html=html.replace('</head>','<style data-gg-firstpaint-style>'+css+'</style><script data-gg-stable-paint>'+early+'</script></head>');
  const selectMobile='<script data-gg-preview-select>(function(){const mobile=document.getElementById("gg-firstpaint-mobile"),root=document.getElementById("root");if(innerWidth<=800&&mobile&&root)root.replaceChildren(mobile.content.cloneNode(true));mobile?.remove();delete document.documentElement.dataset.ggMobilePreview;})();</script>';

  const menuSource=fs.readFileSync(path.join(__dirname,'rop-refinements.js'),'utf8');
  const menuStart=menuSource.indexOf(' const sidebar='),menuEnd=menuSource.indexOf(' const scrollPositions=');
  if(menuStart<0||menuEnd<menuStart)throw Error('Early shell markers changed');
  const menuBoot='(function(){\n'+menuSource.slice(menuStart,menuEnd)+'})();';
  if(!html.includes('data-gg-shell-bootstrap'))html=html.replace(/<script\b[^>]*data-gg-db-loader[^>]*>/,tag=>'<script data-gg-shell-bootstrap>'+menuBoot+'</script>'+tag);
  html=html.replace(/<script\b[^>]*data-gg-shell-bootstrap[^>]*>/,tag=>selectMobile+tag);
  if(!html.includes('<script data-gg-preview-select>'))throw Error('Mobile selection marker missing');
  html=html.replace("status.textContent='Загрузка данных…'","status.textContent='Подключаем фильтры…'");
  fs.writeFileSync(file+'.firstpaint-tmp',html);fs.renameSync(file+'.firstpaint-tmp',file);
  console.log('ROP first screen prepared for snapshot',result.version.slice(0,12),'bytes',Buffer.byteLength(result.html));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});


