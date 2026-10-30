import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {KPAGES,navButton} from '../katya-nav.js';
import {validateProblems,type ProblemData} from './model.js';
export function problemsPage(data:ProblemData){
 validateProblems(data);
 const model=ts.transpileModule(readFileSync(new URL('./model.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/^export /gm,'');
 const insights=ts.transpileModule(readFileSync(new URL('./insights.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/^export /gm,'');
 const client=readFileSync(new URL('./client.js',import.meta.url),'utf8');
 return readFileSync('katya/problems/template.html','utf8')
  .replace('__NAV__',KPAGES.map(([h,l,k])=>navButton(h,l,k==='problems')).join(' '))
  .replace('__DATA__',()=>JSON.stringify(data).replace(/</g,'\\u003c'))
  .replace('__SCRIPT__',()=>readFileSync(new URL('../dashboard-period.js',import.meta.url),'utf8')+'\n'+model+'\n'+insights+'\n'+client);
}
