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
