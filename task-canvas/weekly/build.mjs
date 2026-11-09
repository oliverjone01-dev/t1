import {build} from 'esbuild';import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('weekly/dist',{recursive:true});
const result=await build({entryPoints:['weekly/runtime.mjs'],bundle:true,write:false,format:'iife',globalName:'WeeklySignalsRuntime',target:'es2020'});
let code="if(typeof globalThis.URLSearchParams==='undefined')globalThis.URLSearchParams=class{constructor(values){this.values=values}toString(){return Object.entries(this.values).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&')}};\nif(typeof globalThis.structuredClone==='undefined')globalThis.structuredClone=v=>JSON.parse(JSON.stringify(v));\n"+result.outputFiles[0].text;
for(const [name,method] of Object.entries({startTaskSignalsReports:'start',pollTaskSignalsReports:'poll',checkTaskSignalsReports:'check'}))code+=`\nasync function ${name}(){const result=await WeeklySignalsRuntime.${method}();console.log(JSON.stringify(result));return result;}\n`;
await writeFile('weekly/dist/Code.gs',code);
