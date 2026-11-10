import {localDate,shiftDate} from './model.mjs?rev=20261110-controls-7';
import {weekStart,monthStart,shiftMonth} from './calendar-model.mjs?rev=20261110-controls-7';
import {validDay} from './task-dates.mjs?rev=20261110-controls-7';
export function periodRange(kind,date=localDate()){
 if(kind==='all')return {from:'',to:''};
 if(kind==='today')return {from:date,to:date};
 if(kind==='month')return {from:monthStart(date),to:shiftDate(shiftMonth(date,1),-1)};
 const start=shiftDate(weekStart(date),kind==='next'?7:kind==='previous'?-7:0);return {from:start,to:shiftDate(start,6)};
}
export function shiftRange(range,unit,amount,today=localDate()){
 const base=range.from&&range.to?range:periodRange(unit==='month'?'month':'week',today);
 if(unit==='week')return {from:shiftDate(base.from,7*amount),to:shiftDate(base.to,7*amount)};
 // Preserve whole-month selection; clamp individual dates at the month boundary.
 if(base.from===monthStart(base.from)&&base.to===shiftDate(shiftMonth(base.from,1),-1))return {from:shiftMonth(base.from,amount),to:shiftDate(shiftMonth(base.to,amount+1),-1)};
 const move=date=>{const first=shiftMonth(date,amount),last=shiftDate(shiftMonth(first,1),-1);return first.slice(0,8)+String(Math.min(+date.slice(8),+last.slice(8))).padStart(2,'0')};
 return {from:move(base.from),to:move(base.to)};
}
export function parseRangeDate(value){
 if(validDay(value))return value;
 const m=String(value).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);const date=m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';return validDay(date)?date:'';
}
export const displayRangeDate=value=>value?value.split('-').reverse().join('.'):'';
