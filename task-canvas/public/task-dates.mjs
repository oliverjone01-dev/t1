// Source timestamps keep their precision. Date-only values stay dates, in Moscow.
export const MOSCOW = 'Europe/Moscow';
export function validDay(value) {
 return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
}
export function parseCreatedAt(raw, cell) {
 if(['DATE','DATE_TIME'].includes(cell?.userEnteredFormat?.numberFormat?.type)&&typeof cell.effectiveValue?.numberValue==='number'){
  const serial=cell.effectiveValue.numberValue, date=new Date(Date.UTC(1899,11,30)+Math.floor(serial)*86400000).toISOString().slice(0,10);
  return validDay(date)?date:'';
 }
 const value=String(raw||'').trim();
 if(validDay(value))return value;
 if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&validDay(value.slice(0,10))&&Number.isFinite(Date.parse(value)))return new Date(value).toISOString();
 // Several source messages may be recorded; the earliest explicit one sets the task.
 const values=[...value.matchAll(/(?:^|[\s;,])(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/g)].map(m=>{
  const date=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if(!validDay(date))return '';
  if(!m[4])return date;
  if(+m[4]>23||+m[5]>59||+(m[6]||0)>59)return '';
  return new Date(`${date}T${m[4].padStart(2,'0')}:${m[5]}:${m[6]||'00'}+03:00`).toISOString();
 }).filter(Boolean).sort();
 return values[0]||'';
}
export function createdDay(value) {
 if(validDay(value))return value;
 if(!value||!Number.isFinite(Date.parse(value)))return '';
 return new Intl.DateTimeFormat('sv-SE',{timeZone:MOSCOW,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
}
export function workingRange(task) {
 const a=validDay(task.start)?task.start:'',b=validDay(task.due)?task.due:'';
 return a||b?{from:a||b,to:b||a}:null;
}
export function overlapsRange(task, from='', to='') {
 if(!from&&!to)return true;
 const range=workingRange(task);return !!range&&(!to||range.from<=to)&&(!from||range.to>=from);
}
