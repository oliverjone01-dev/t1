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
  const result=await page.evaluate(()=>{
   const root=document.getElementById('root');let html='';
   for(const child of root.children){if(child.id==='sec2')break;html+=child.outerHTML;}
   const cells=[...root.querySelectorAll('.kpi-strip .kpi-cell')].slice(0,9).map(n=>n.innerText.replace(/\s+/g,' ').trim());
   return {html,cells,version:new URL(document.querySelector('[data-gg-db-payload]').dataset.ggDbPayload,location.href).searchParams.get('version')};
  });
  if(result.cells.length!==9||!result.html.includes('sec1'))throw Error('Incomplete first screen');
  const target=/(<div\b[^>]*\bid="root"[^>]*>)<\/div>/;
  if(!target.test(html))throw Error('Native root marker changed');
  html=html.replace(target,(_,open)=>open.slice(0,-1)+' data-gg-firstpaint="'+result.version+'">'+result.html+'</div>');
  html=html.replace('</head>','<script>if(location.search||location.hash)document.documentElement.dataset.ggFirstpaintSkip="true";</script><style data-gg-firstpaint-style>html[data-gg-ui=pending] #root[data-gg-firstpaint]{visibility:visible;pointer-events:none}html[data-gg-ui=pending][data-gg-firstpaint-skip] #root[data-gg-firstpaint]{visibility:hidden}html:has(#root[data-gg-firstpaint]) #gg-db-loading{position:fixed;right:12px;bottom:12px;z-index:999;border-radius:6px;background:var(--bg-card,#171a1f);padding:7px 10px!important;font-size:11px!important}</style></head>');
  fs.writeFileSync(file+'.firstpaint-tmp',html);fs.renameSync(file+'.firstpaint-tmp',file);
  console.log('ROP first screen prepared for snapshot',result.version.slice(0,12),'bytes',Buffer.byteLength(result.html));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
