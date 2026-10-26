// Shared compact navigation must be usable before any dashboard payload arrives.
const fs=require('fs'),path=require('path');
const site=path.resolve(process.argv[2]);
const source=fs.readFileSync(path.join(__dirname,'workspace-pages.js'),'utf8');
const start=source.indexOf(' const sidebar='),end=source.indexOf('\n function close()');
if(start<0||end<start||!source.includes('!sidebar.dataset.ggShellReady'))throw Error('Shared shell bootstrap markers changed');
const boot='<script data-gg-shell-bootstrap>(function(){\n'+source.slice(start,end)+'})();</script>';
let count=0;
for(const dir of fs.readdirSync(site,{withFileTypes:true})){
 if(!dir.isDirectory())continue;const file=path.join(site,dir.name,'index.html');if(!fs.existsSync(file))continue;
 let html=fs.readFileSync(file,'utf8');
 if(!html.includes('id="gg-sidebar"')||!html.includes('data-gg-db-payload')||html.includes('data-gg-shell-bootstrap'))continue;
 if(!html.includes('<script data-gg-db-loader>'))throw Error('Missing payload loader: '+dir.name);
 html=html.replace('<script data-gg-db-loader>',boot+'<script data-gg-db-loader>');
 fs.writeFileSync(file+'.shell-tmp',html);fs.renameSync(file+'.shell-tmp',file);count++;
}
console.log('Early shared navigation prepared:',count,'dashboards');

// Official GENGLASS identity; keep other brands and dashboard data unchanged.
const brandDir=path.join(site,'brand');fs.mkdirSync(brandDir,{recursive:true});
for(const name of ['genglass-logo.svg','genglass-mark.svg','genglass-favicon.svg'])fs.copyFileSync(path.join(__dirname,'brand',name),path.join(brandDir,name));
const brandStyle='<style data-gg-brand-style>.gg-brand.gg-brand-genglass{gap:0;min-height:42px}.gg-brand-genglass .gg-monogram{background:none;border-radius:0;width:36px;height:36px}.gg-brand-genglass img{display:block;object-fit:contain}.gg-brand-genglass .gg-brand-wordmark{width:174px;height:33px;max-width:100%;object-position:left center}.gg-brand-genglass .gg-brand-copy{display:block;margin-left:10px}.gg-brand-genglass .gg-brand-copy small{font-size:10px;margin-top:5px}html:not([data-theme=light]) .gg-brand-genglass img{filter:invert(1)}html[data-theme=light] .gg-brand-genglass img{filter:none}@media(min-width:801px){html[data-sidebar-mode=compact]:has(.gg-brand-genglass):has(.gg-sidebar:is(:hover,:focus-within)) #gg-menu.gg-menu-floating{left:276px!important}html[data-sidebar-mode=compact] .gg-sidebar:not(:hover):not(:focus-within) .gg-brand-copy{display:none}html[data-sidebar-mode=compact] .gg-sidebar:is(:hover,:focus-within) .gg-brand-genglass .gg-monogram,html[data-sidebar-mode=pinned] .gg-brand-genglass .gg-monogram{display:none}}@media(max-width:800px){.gg-brand-genglass .gg-monogram{display:none}.gg-sidebar .gg-brand-genglass{margin-top:48px!important}}</style>';
let branded=0;
for(const dir of fs.readdirSync(site,{withFileTypes:true})){
 if(!dir.isDirectory()||!(['rop','rop2','office','dialog'].includes(dir.name)||dir.name.startsWith('rop-')&&dir.name!=='rop-gm'))continue;
 const file=path.join(site,dir.name,'index.html');if(!fs.existsSync(file))continue;
 let html=fs.readFileSync(file,'utf8');if(!html.includes('id="gg-sidebar"'))continue;
 html=html.replace(/<a class="gg-brand" href="\/">[\s\S]*?<\/a>/,'<a class="gg-brand gg-brand-genglass" href="/" aria-label="GENGLASS · рабочее пространство GENGROUP"><span class="gg-monogram"><img src="/brand/genglass-mark.svg" width="36" height="36" alt=""></span><span class="gg-brand-copy"><img class="gg-brand-wordmark" src="/brand/genglass-logo.svg" width="174" height="33" alt="GENGLASS"><small>Рабочее пространство · GENGROUP</small></span></a>');
 html=html.replace(/<link\b(?=[^>]*\brel=["'](?:shortcut )?icon["'])[^>]*>/gi,'');
 html=html.replace('</head>','<link rel="icon" type="image/svg+xml" href="/brand/genglass-favicon.svg?v=1">'+brandStyle+'</head>');
 fs.writeFileSync(file+'.brand-tmp',html);fs.renameSync(file+'.brand-tmp',file);branded++;
}
console.log('Official GENGLASS identity prepared:',branded,'dashboards');
