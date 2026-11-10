import test from 'node:test';import assert from 'node:assert/strict';
import {cleanDirectory,resolvePerson,Directory} from '../public/directory.mjs';
import {departmentScope,publicPerson,safePhotoURL,CONFIRMED_OWNER_ALIASES} from '../tools/directory-source.mjs';
const people=[{id:'1',name:'Екатерина Иванова',first:'Екатерина',last:'Иванова',avatar:'avatars/1.jpg'},{id:'2',name:'Иван Петров',first:'Иван',last:'Петров'}];
test('employee matching is exact or unique; ambiguous names never guess',()=>{assert.equal(resolvePerson('Катя',people)?.id,'1');assert.equal(resolvePerson('Иванова Екатерина',people)?.id,'1');assert.equal(resolvePerson('Катя',[...people,{id:'3',first:'Екатерина',last:'Другая',name:'Екатерина Другая'}]),null);assert.equal(resolvePerson('Катя дизайнер',people),null);assert.equal(resolvePerson('',people),null)});
test('nickname plus exact surname resolves uniquely in either name order',()=>{
 const staff=[...people,{id:'3',first:'Александр',last:'Петров',name:'Александр Петров'},{id:'4',first:'Александр',last:'Сидоров',name:'Александр Сидоров'}];
 assert.equal(resolvePerson('Саша Петров',staff)?.id,'3');assert.equal(resolvePerson('Петров Саша',staff)?.id,'3');assert.equal(resolvePerson('Катя Иванова',staff)?.id,'1');
 assert.equal(resolvePerson('Саша Петров дизайнер',staff),null);assert.equal(resolvePerson('Саша Петр',staff),null);
 assert.equal(resolvePerson('Саша Петров',[...staff,{id:'5',first:'Александр',last:'Петров',name:'Александр Петров'}]),null);
});
test('directory whitelist strips personal contacts and remote avatar URLs',()=>{const result=cleanDirectory({version:1,people:[{...people[0],email:'private',phone:'private',avatar:'https://external.example/photo.jpg'}]});assert.equal(result[0].email,undefined);assert.equal(result[0].avatar,'');assert.equal(cleanDirectory({version:2,people}).length,0)});
test('department scope limits to marketing and PTO and their descendants',()=>{const depts=[{ID:'1',NAME:'Компания'},{ID:'2',NAME:'Отдел маркетинга',PARENT:'1'},{ID:'3',NAME:'ПТО',PARENT:'1'},{ID:'4',NAME:'Дизайн',PARENT:'2'},{ID:'5',NAME:'Продажи',PARENT:'1'}];const scope=departmentScope(depts);assert.deepEqual([...scope.ids],['2','3','4']);const p=publicPerson({ID:7,ACTIVE:'Y',NAME:'Иван',LAST_NAME:'Петров',EMAIL:'private',UF_DEPARTMENT:[2]},depts,scope.ids);assert.equal(p.name,'Иван Петров');assert.equal(p.EMAIL,undefined);assert.equal(publicPerson({ID:7,ACTIVE:'N',NAME:'Иван',LAST_NAME:'Петров',UF_DEPARTMENT:[2]},depts,scope.ids),null);assert.equal(publicPerson({ID:7,ACTIVE:'Y',NAME:'Иван',LAST_NAME:'Петров',UF_DEPARTMENT:[5]},depts,scope.ids),null)});
test('avatar download only permits approved HTTPS photo hosts, no REST/auth paths',()=>{assert(safePhotoURL('https://cdn-ru.bitrix24.ru/a.jpg'));assert.equal(safePhotoURL('https://evil.example/a.jpg'),null);assert.equal(safePhotoURL('https://bitrix24.ru.evil.example/a.jpg'),null);assert.equal(safePhotoURL('https://glassmemory.bitrix24.ru/rest/1/secret/a'),null);assert.equal(safePhotoURL('http://cdn-ru.bitrix24.ru/a.jpg'),null)});
test('directory network failure preserves task names and never blocks board',async()=>{const d=new Directory({fetcher:async()=>{throw new Error('offline')}});await d.load();assert.equal(d.status,'unavailable');assert.equal(d.name('Катя'),'Катя');assert.equal(d.avatar('Катя'),'')});
test('directory reports actual department coverage rather than claiming missing PTO',async()=>{const d=new Directory({fetcher:async()=>({ok:true,json:async()=>({version:1,people,departments:[{id:'73',name:' Отдел Маркетинга '},null,{name:7}]})})});await d.load();assert.equal(d.status,'ready');assert.deepEqual(d.departments,['Отдел Маркетинга']);assert.equal(d.name('Катя'),'Екатерина Иванова')});
test('default fetch retains the browser global receiver',async(t)=>{t.mock.method(globalThis,'fetch',async function(){assert.equal(this,globalThis);return {ok:true,json:async()=>({version:1,people})}});const d=await new Directory().load();assert.equal(d.status,'ready');assert.equal(d.people.length,2)});
test('confirmed Katya stays Mashkova and never switches to a namesake if she leaves the directory',async()=>{
 const staff=[{id:'6491',first:'Екатерина',last:'Машкова',name:'Екатерина Машкова',avatar:'avatars/6491.jpg'},{id:'5221',first:'Екатерина',last:'Кужлева',name:'Екатерина Кужлева'}];
 const payload={version:1,people:staff,ownerAliases:CONFIRMED_OWNER_ALIASES};
 const d=await new Directory({fetcher:async()=>({ok:true,json:async()=>payload})}).load();
 assert.equal(d.name(' Катя '),'Екатерина Машкова');assert.equal(d.avatar('Катя'),'avatars/6491.jpg');assert.equal(d.resolve('Екатерина Кужлева')?.id,'5221');
 payload.people=staff.slice(1);await d.load();assert.equal(d.resolve('Катя'),null);assert.equal(d.name('Катя'),'Катя');
});
test('confirmed PTO department includes its staff and descendants without other production departments',()=>{
 const departments=[{ID:'73',NAME:'Отдел Маркетинга',PARENT:'1'},{ID:189,NAME:'Конструкторский отдел ',PARENT:'1'},{ID:'191',NAME:'Расчёты',PARENT:189},{ID:'61',NAME:'Производство',PARENT:'1'},{ID:'173',NAME:'Оптовый отдел ',PARENT:'155'}];
 const {ids,roots}=departmentScope(departments);
 assert.deepEqual(roots.map(d=>String(d.ID)),['73','189']);assert.deepEqual([...ids],['73','189','191']);
 const employee={ID:'8',NAME:'Виктория',LAST_NAME:'Иванова',ACTIVE:'Y',UF_DEPARTMENT:[189]};
 assert.equal(publicPerson(employee,departments,ids)?.name,'Виктория Иванова');
 assert(publicPerson({...employee,UF_DEPARTMENT:[191]},departments,ids));
 assert.equal(publicPerson({...employee,UF_DEPARTMENT:[61]},departments,ids),null);
});
test('department filters use trimmed names and descendant staff also belongs to the selected root',()=>{
 const depts=[{ID:'189',NAME:'Конструкторский отдел ',PARENT:'1'},{ID:'191',NAME:' Расчёты ',PARENT:'189'}];
 const person=publicPerson({ID:'8',ACTIVE:'Y',NAME:'Виктория',LAST_NAME:'Иванова',UF_DEPARTMENT:[191]},depts,new Set(['189','191']));
 assert.equal(person.department,'Конструкторский отдел · Расчёты');
 assert.equal(cleanDirectory({version:1,people:[{...person,department:'Конструкторский отдел '} ]})[0].department,'Конструкторский отдел');
});
