import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
const dir = process.cwd();
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:794,height:1123} });
await p.goto('file://'+dir+'/slides.html', {waitUntil:'load'});
await p.emulateMedia({media:'print'});
await p.pdf({ path: dir+'/GM_rezka-kamnya_draft.pdf', width:'210mm', height:'297mm', printBackground:true, margin:{top:0,right:0,bottom:0,left:0} });
await p.emulateMedia({media:'screen'});
const pages = await p.$$('.page');
for (let i=0;i<pages.length;i++){
  await pages[i].screenshot({ path: `${dir}/slide-${i+1}.png`, scale:'css' });
}
await b.close();
console.log('pages', pages.length);
