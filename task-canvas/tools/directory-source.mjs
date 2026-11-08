export function departmentScope(departments){
 const roots=departments.filter(d=>/маркетинг|marketing|(?:^|[^а-я])пто(?:$|[^а-я])|производственно[ -]?техническ/i.test(d.NAME||''));
 if(!roots.length)throw new Error('Requested departments were not found');
 const ids=new Set(roots.map(d=>String(d.ID)));let changed=true;
 while(changed){changed=false;for(const d of departments)if(ids.has(String(d.PARENT))&&!ids.has(String(d.ID))){ids.add(String(d.ID));changed=true}}
 return {ids,roots};
}
export function publicPerson(user,departments,ids){
 const memberships=(Array.isArray(user.UF_DEPARTMENT)?user.UF_DEPARTMENT:[]).map(String).filter(id=>ids.has(id));
 if(!memberships.length||![true,'Y','1',1].includes(user.ACTIVE)||!/^\d+$/.test(String(user.ID))||!user.NAME?.trim()||!user.LAST_NAME?.trim())return null;
 return {id:String(user.ID),first:user.NAME.trim(),last:user.LAST_NAME.trim(),name:[user.NAME.trim(),user.LAST_NAME.trim()].join(' '),department:departments.filter(d=>memberships.includes(String(d.ID))).map(d=>d.NAME).join(' · '),avatar:''};
}
export function safePhotoURL(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.pathname.includes('/rest/')&&/(^|\.)(bitrix24\.(ru|com)|bitrix\.info|1c-bitrix-cdn\.ru)$/.test(url.hostname)?url:null}catch{return null}}
