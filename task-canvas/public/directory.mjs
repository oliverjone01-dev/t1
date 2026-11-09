const normalize=value=>String(value||'').toLocaleLowerCase('ru').replace(/ё/g,'е').trim().replace(/\s+/g,' ');
const givenNames={катя:['екатерина'],дима:['дмитрий'],вика:['виктория'],софа:['софья','софия'],костя:['константин'],женя:['евгений','евгения'],саша:['александр','александра'],настя:['анастасия'],оля:['ольга'],лена:['елена'],маша:['мария'],миша:['михаил'],сережа:['сергей'],паша:['павел'],леша:['алексей']};
export function cleanDirectory(data){
 return (data?.version===1&&Array.isArray(data.people)?data.people:[]).filter(p=>/^\d+$/.test(p.id)&&typeof p.name==='string'&&p.name.trim()&&typeof p.first==='string').map(p=>({id:p.id,name:p.name.trim(),first:p.first.trim(),last:String(p.last||'').trim(),department:String(p.department||''),avatar:/^avatars\/\d+\.(jpg|png|webp)$/.test(p.avatar||'')?p.avatar:''}));
}
export function resolvePerson(owner,people){
 const value=normalize(owner);if(!value)return null;
 const exact=people.filter(p=>[normalize(p.name),normalize(p.last+' '+p.first)].includes(value));if(exact.length===1)return exact[0];if(exact.length>1)return null;
 if(value.includes(' ')){
  const matches=people.filter(p=>{const first=normalize(p.first),last=normalize(p.last);if(!last)return false;return Object.entries(givenNames).some(([alias,names])=>names.includes(first)&&[alias+' '+last,last+' '+alias].includes(value))});
  return matches.length===1?matches[0]:null;
 }
 const names=new Set([value,...(givenNames[value]||[])]),matches=people.filter(p=>names.has(normalize(p.first))||normalize(p.last)===value);
 return matches.length===1?matches[0]:null;
}
export class Directory {
 people=[];departments=[];status='loading';updatedAt='';
 constructor({fetcher=globalThis.fetch.bind(globalThis)}={}){this.fetcher=fetcher}
 async load(){try{const response=await this.fetcher('./directory.json',{credentials:'omit',cache:'no-cache'});if(!response.ok)throw new Error();const data=await response.json();this.people=cleanDirectory(data);this.departments=(Array.isArray(data.departments)?data.departments:[]).filter(d=>d&&typeof d.name==='string').map(d=>d.name.trim()).filter(Boolean);this.updatedAt=data.updatedAt||'';this.status=this.people.length?'ready':'empty'}catch{this.status='unavailable'}return this}
 resolve(owner){return resolvePerson(owner,this.people)}
 name(owner){return this.resolve(owner)?.name||owner||''}
 avatar(owner){return this.resolve(owner)?.avatar||''}
 names(){return this.people.map(p=>p.name)}
}
