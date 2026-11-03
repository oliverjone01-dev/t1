// Month-anchored seven-day windows; the final window contains the two remaining dates.
export function novemberPeriods(){
  return [1,8,15,22,29].map((start,i)=>{
    const end=Math.min(30,start+6),from=`2026-11-${String(start).padStart(2,'0')}`,to=`2026-11-${String(end).padStart(2,'0')}`;
    return {id:i,from,to,label:`${String(start).padStart(2,'0')}-${String(end).padStart(2,'0')}.11`,days:end-start+1};
  });
}
export type NovemberPeriod=ReturnType<typeof novemberPeriods>[number];
export function periodWindow(period:NovemberPeriod,today:string){
  const days=Array.from({length:period.days},(_,i)=>`2026-11-${String(Number(period.from.slice(8))+i).padStart(2,'0')}`);
  const closed=days.filter(d=>d<today);
  return {days,closed,elapsed:closed.length,through:closed.at(-1)??'',finished:today>period.to};
}
export function periodProgress(period:NovemberPeriod,today:string,values:Record<string,number|null>,monthGoal:number|null){
  const window=periodWindow(period,today),missing=window.closed.filter(d=>values[d]==null);
  const complete=window.elapsed>0&&missing.length===0;
  const fact=complete?window.closed.reduce((sum,d)=>sum+values[d]!,0):null;
  if(fact!==null&&!Number.isFinite(fact))throw Error('Invalid weekly fact');
  if(monthGoal!==null&&(!Number.isFinite(monthGoal)||monthGoal<=0))throw Error('Invalid weekly goal');
  const goal=monthGoal===null?null:monthGoal*period.days/30,planToDate=monthGoal===null?null:monthGoal*window.elapsed/30;
  return {...window,missing,complete,fact,goal,planToDate,ratio:fact!==null&&planToDate?fact/planToDate*100:null};
}
