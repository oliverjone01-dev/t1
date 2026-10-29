// Display-only observation. The historical matrix and closed-day statistics stay untouched.
import {line, type Est, type Matrix} from './estimator.js';
export function partialChartPoint(history:Matrix,current:Array<number|null>,base:number[],
  mode:'index'|'raw',est:Est,groups?:string[]) {
  const have=current.filter(v=>v!==null).length;
  const observed=current.flatMap((v,i)=>v===null?[]:[i]);
  const raw=have ? (mode==='index'?observed.reduce((n,i)=>n+current[i]!,0):observed.reduce((n,i)=>n+current[i]!,0)/have) : null;
  if(mode==='raw')return {value:raw,raw,have,want:current.length};
  // Both numerator and its base use exactly the observed article population.
  const matrix=observed.map(i=>[...history[i]!,current[i]!]);
  const v=line(matrix,base,est,groups?observed.map(i=>groups[i]!):undefined)[history[0]?.length??0]??null;
  return {value:v,raw,have,want:current.length};
}
