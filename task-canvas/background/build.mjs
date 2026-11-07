import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('background/dist',{recursive:true});
await build({entryPoints:['background/entry.mjs'],outfile:'background/dist/Code.gs',bundle:true,format:'iife',globalName:'TaskCanvasBackground',target:'es2020',minify:false,plugins:[{name:'google-server-runtime',setup(b){b.onLoad({filter:/public\/team-api\.mjs$/},async args=>{
 let contents=await readFile(args.path,'utf8');const start=contents.indexOf('export async function firebaseSdk()'),end=contents.indexOf('export class TeamApi');
 if(start<0||end<0)throw new Error('Repository shape changed; review worker bundling.');
 contents=contents.slice(0,start)+'export async function firebaseSdk(){throw new Error("Browser Firebase SDK is not used in this worker")}\n'+contents.slice(end);return {contents,loader:'js'};
})}}]});
const path='background/dist/Code.gs';let code=await readFile(path,'utf8');
code+='\nfunction prepareBackgroundSync(){return TaskCanvasBackground.prepare();}\nfunction activateBackgroundSync(){return TaskCanvasBackground.activate();}\nfunction syncTasksInBackground(){return TaskCanvasBackground.run();}\nfunction checkBackgroundSync(){return TaskCanvasBackground.check();}\nfunction stopBackgroundSync(){return TaskCanvasBackground.stop();}\n';
if(/\bimport\s*\(/.test(code)||code.includes('www.gstatic.com'))throw new Error('Browser imports leaked into Apps Script');
await writeFile(path,code);await writeFile('background/dist/appsscript.json',await readFile('background/appsscript.json','utf8'));
