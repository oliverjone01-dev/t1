// Runs only in GitHub Actions. Secrets never reach JSON, image paths or logs.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {departmentScope,publicPerson,safePhotoURL,CONFIRMED_OWNER_ALIASES} from './directory-source.mjs';
const output=resolve(process.argv[2]||'task-canvas/public'),base=process.env.B24_WEBHOOK_URL?.trim();
async function request(method,params={}){
 let response;try{response=await fetch(base.replace(/\/?$/,'/')+method+'.json',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params),signal:AbortSignal.timeout(20000)})}catch{throw new Error('Bitrix request unavailable: '+method)}
 if(!response.ok)throw new Error('Bitrix HTTP '+response.status+': '+method);
 let data;try{data=await response.json()}catch{throw new Error('Invalid Bitrix response: '+method)}if(data.error)throw new Error('Bitrix API refused '+method+' ('+String(data.error).replace(/[^A-Z_0-9]/gi,'').slice(0,60)+')');return data;
}
async function all(method,params={}){let result=[],start=0;for(let i=0;i<40;i++){const page=await request(method,{...params,start,START:start});if(!Array.isArray(page.result))throw new Error('Invalid Bitrix list');result.push(...page.result);if(page.next===undefined)return result;if(!Number.isFinite(+page.next)||+page.next<=start)throw new Error('Invalid Bitrix pagination');start=+page.next}throw new Error('Bitrix pagination limit')}
async function photo(value,id){
 let url=safePhotoURL(value);if(!url)return '';
 try{let response;for(let i=0;i<4;i++){response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(15000)});if(response.status>=300&&response.status<400){url=safePhotoURL(new URL(response.headers.get('location'),url).href);if(!url)return '';continue}break}
 if(!response.ok)return '';const type=response.headers.get('content-type')?.split(';')[0],ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type];if(!ext||+(response.headers.get('content-length')||0)>2000000)return '';
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>2000000||bytes.length<12)return '';const magic=ext==='jpg'?bytes[0]===255&&bytes[1]===216:ext==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!magic)return '';
 const path='avatars/'+id+'.'+ext;await writeFile(resolve(output,path),bytes);return path;
 }catch{return ''}
}
try{
 if(!base||!/^https:\/\/[\w.-]+\/rest\/\d+\/[\w-]+\/?$/.test(base))throw new Error('Bitrix webhook secret missing or malformed');
 const departments=await all('department.get'),{ids,roots}=departmentScope(departments);
 const users=await all('user.get',{FILTER:{ACTIVE:true,USER_TYPE:'employee',UF_DEPARTMENT:[...ids]},select:['ID','NAME','LAST_NAME','ACTIVE','UF_DEPARTMENT','PERSONAL_PHOTO'],IMAGE_RESIZE:'small'});
 await mkdir(resolve(output,'avatars'),{recursive:true});const people=[];
 for(const user of users){const person=publicPerson(user,departments,ids);if(!person||people.some(p=>p.id===person.id))continue;person.avatar=await photo(user.PERSONAL_PHOTO,person.id);people.push(person)}
 if(!people.length)throw new Error('No active employees with complete names in requested departments');
 people.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 await writeFile(resolve(output,'directory.json'),JSON.stringify({version:1,updatedAt:new Date().toISOString(),departments:roots.map(d=>({id:String(d.ID),name:d.NAME})),ownerAliases:CONFIRMED_OWNER_ALIASES,people},null,2)+'\n');
 console.log(`Task directory: ${roots.length} departments, ${people.length} employees, ${people.filter(p=>p.avatar).length} photos`);
}catch(error){console.error('Task directory: '+error.message);process.exitCode=1}
