import {GROWTH_CARDS,NOVEMBER_GROWTH} from './november-growth.js';
// Fixed 03.11 analysis snapshot f5978ab, 15–28.10. Targets must not drift with late cancellations.
export function novemberCardGoals(){
  const weights=[...GROWTH_CARDS.map(c=>({name:c[0] as string,units:c[2] as number})),{name:'Прочие карточки',units:228-GROWTH_CARDS.reduce((n,c)=>n+c[2],0)}];
  const target=NOVEMBER_GROWTH.units.nov.mid;
  const rows=weights.map((r,i)=>({...r,index:i,exact:target*r.units/228,goal:Math.floor(target*r.units/228)}));
  const remainder=target-rows.reduce((n,r)=>n+r.goal,0);
  [...rows].sort((a,b)=>(b.exact-b.goal)-(a.exact-a.goal)||a.index-b.index).slice(0,remainder).forEach(r=>r.goal++);
  return rows.map(({name,units,goal})=>({name,baseUnits:units,goal}));
}
export function advertisingReference(fact:number|null,weekly:number|null,days:number){
  const limit=weekly!=null&&Number.isFinite(weekly)&&weekly>0&&days>0?weekly*days/7:null;
  const pct=fact!=null&&limit?fact/limit*100:null;
  return {limit,pct,status:pct==null?'unknown':pct<=100?'within':pct<=120?'over':'high',color:pct==null?'#8b9eae':pct<=100?'#34D399':pct<=120?'#E5B567':'#FF7A7E'};
}
/** Nonnegative observed subtotal is a lower bound, never a complete total or a conversion. */
export function observedLowerBound(values:Array<number|null>):number|null {
  const known=values.filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0);
  return known.length?known.reduce((n,v)=>n+v,0):null;
}
