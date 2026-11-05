// Operational store-wide ratio: existing campaign spend / existing non-cancelled order turnover.
export function novemberDrr(spend:number|null,revenue:number|null,limitPercent:number){
  if(!Number.isFinite(limitPercent)||limitPercent<=0)throw Error('Invalid DRR limit');
  if((spend!==null&&(!Number.isFinite(spend)||spend<0))||(revenue!==null&&(!Number.isFinite(revenue)||revenue<0)))throw Error('Invalid DRR inputs');
  if(spend===null||revenue===null)return {drr:null,limit:null,remaining:null,status:'unknown'};
  const limit=revenue*limitPercent/100,remaining=limit-spend;
  return {drr:revenue>0?spend/revenue*100:null,limit,remaining,status:spend>limit?'exceeded':'within'};
}
