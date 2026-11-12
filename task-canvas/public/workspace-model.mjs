export const SHELL_KEY='gengroup.task-canvas.workspace.v1';
export function cleanShell(value){return {sidebar:value?.sidebar===true,top:value?.top===true}}
export function readShell(storage){try{return cleanShell(JSON.parse(storage.getItem(SHELL_KEY)||'{}'))}catch{return cleanShell(null)}}
// Use more columns before reducing readable card space. Overflow never removes tasks.
export function dayBoardLayout({width,height,count,view='detailed',narrow=width<600}){
 const n=Math.max(0,Math.floor(Number(count)||0)),w=Math.max(1,Number(width)||1),h=Math.max(0,Number(height)||0),gap=10,minWidth=w<600?260:300,minHeight=narrow?190:view==='rows'?164:view==='compact'?166:172;
 const maxColumns=Math.max(1,Math.min(narrow?1:6,n||1,Math.floor((w+gap)/(minWidth+gap))));
 const candidates=Array.from({length:maxColumns},(_,i)=>{const columns=i+1,rows=Math.ceil(n/columns),needed=rows*minHeight+Math.max(0,rows-1)*gap;return {columns,rows,needed}});
 const best=candidates.find(c=>c.needed<=h)||candidates.at(-1),fits=best.needed<=h;
 return {columns:best.columns,rows:best.rows,cardHeight:fits&&n?Math.min(220,Math.max(minHeight,Math.floor((h-Math.max(0,best.rows-1)*gap)/best.rows))):minHeight,fits};
}
