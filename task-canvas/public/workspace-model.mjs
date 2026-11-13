export const SHELL_KEY='gengroup.task-canvas.workspace.v1';
export function cleanShell(value){return {sidebar:value?.sidebar===true,top:value?.top===true}}
export function readShell(storage){try{return cleanShell(JSON.parse(storage.getItem(SHELL_KEY)||'{}'))}catch{return cleanShell(null)}}
// Use more columns before reducing readable card space. Overflow never removes tasks.
export function dayBoardLayout({width,height,count,view='detailed',narrow=width<600}){
 const n=Math.max(0,Math.floor(Number(count)||0)),w=Math.max(1,Number(width)||1),h=Math.max(0,Number(height)||0),gap=16,minWidth=w<600?260:300,minHeight=narrow?190:view==='rows'?164:view==='compact'?166:172;
 const maxColumns=Math.max(1,Math.min(narrow?1:6,n||1,Math.floor((w+gap)/(minWidth+gap))));
 const candidates=Array.from({length:maxColumns},(_,i)=>{const columns=i+1,rows=Math.ceil(n/columns),needed=rows*minHeight+Math.max(0,rows-1)*gap;return {columns,rows,needed}});
 const best=candidates.find(c=>c.needed<=h)||candidates.at(-1),fits=best.needed<=h;
 return {columns:best.columns,rows:best.rows,cardHeight:fits&&n?Math.min(220,Math.max(minHeight,Math.floor((h-Math.max(0,best.rows-1)*gap)/best.rows))):minHeight,fits};
}

// Compare group arrangements without changing item order, labels or the task set.
export function groupedBoardLayout({width,height,counts,view='detailed',narrow=width<600}){
 const groups=counts.filter(n=>n>0),base=dayBoardLayout({width,height,count:groups.reduce((a,b)=>a+b,0),view,narrow}),min=dayBoardLayout({width,height:0,count:1,view,narrow}).cardHeight,gap=16,header=24,max=Math.max(1,Math.min(6,Math.floor((width+gap)/310))),choices=[];
 for(let columns=1;columns<=(narrow?1:max);columns++)for(let lanes=1;lanes<=Math.min(groups.length||1,columns);lanes++){
  const inner=Math.max(1,Math.floor(columns/lanes));let cardRows=0,staticHeight=0;
  for(let i=0;i<groups.length;i+=lanes){const rows=Math.max(...groups.slice(i,i+lanes).map(n=>Math.ceil(n/inner)));cardRows+=rows;staticHeight+=header+Math.max(0,rows-1)*gap+(i?gap:0)}
  choices.push({columns,lanes,innerColumns:inner,cardRows,staticHeight,needed:cardRows*min+staticHeight});
 }
 const sorted=choices.sort((a,b)=>a.needed-b.needed||a.columns-b.columns||a.lanes-b.lanes),best=sorted[0],fits=best.needed<=height;
 return {...base,...best,cardHeight:fits&&best.cardRows?Math.min(220,Math.max(min,Math.floor((height-best.staticHeight)/best.cardRows))):min,fits};
}
