'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {SCOPED_LIST,adapt,leadReason,DG_REASON_FIELDS,assertLeadReasonFields}=require('./collect-widgets.cjs'),{build,validateRaw}=require('./build-widgets.cjs');
const root=process.env.GG_REFERENCE_ROOT||'/tmp/rop/analytics-mvp';
const template=fs.readFileSync(path.join(root,'rop/rop-command.template.html'),'utf8'),builder=fs.readFileSync(path.join(root,'src/scripts/b24/build-rop.ts'),'utf8'),collector=fs.readFileSync(path.join(root,'src/scripts/b24/fetch-rop.ts'),'utf8'),mask=fs.readFileSync(path.join(root,'src/lib/mask-contacts.mjs'),'utf8'),hook=fs.readFileSync(path.join(__dirname,'no-plan.js'),'utf8');
const helpers=call=>vm.runInNewContext(SCOPED_LIST+';({strictList,scopedChunks,listSharded,SC})',{call});
test('weekly buckets use Moscow date labels independently of browser timezone',()=>{const html=build(fixture(),template,builder,hook).html,code=html.match(/function bkey[^\n]+/)[0];for(const TZ of ['Europe/Moscow','America/Los_Angeles']){const out=require('node:child_process').execFileSync(process.execPath,['-e',code+";console.log(bkey('2026-10-26','week')+' '+bkey('2026-10-25','week'))"],{encoding:'utf8',env:{...process.env,TZ}}).trim();assert.equal(out,'2026-10-26 2026-10-19');}});
test('product rows read every page and API failure stops enrichment',async()=>{let n=0;const h=helpers(async()=>++n===1?{result:{productRows:[{id:1}]},total:2,next:1}:{result:{productRows:[{id:2}]},total:2});assert.equal((await h.strictList('crm.item.productrow.list',{}, {idField:'id',itemsPath:'productRows'})).length,2);assert.equal(n,2);await assert.rejects(helpers(async()=>{throw Error('API unavailable');}).strictList('crm.item.productrow.list',{}),/API unavailable/);});
test('embedded prepayment currencies and invalid amounts cannot masquerade as RUB',()=>{const compiled=adapt(collector,mask),code=compiled.match(/const moneyNum = [\s\S]*?;\n/)[0],money=vm.runInNewContext(code+';moneyNum');assert.equal(money('100|RUB'),100);assert.equal(money(''),0);for(const v of ['100|USD','-100|RUB','invalid|RUB','Infinity|RUB'])assert.throws(()=>money(v));const r=fixture();r.deals[0].currency=null;assert.throws(()=>validateRaw(r));r.deals[0].currency='RUB';r.deals[0].prepayAmt=-1;assert.throws(()=>validateRaw(r));});
function fixture(){return {generated_at:new Date().toISOString(),counts:{leads:1,deals:1},scope:{sourceId:'UC_NQ3QUI',leadIds:['10'],dealIds:['20']},leads:[{id:'10',sourceId:'UC_NQ3QUI',title:'PRIVATE CLIENT',mgr:'Виктория Преснякова',source:'Заявка с ДГ',statusCode:'CONVERTED',status:'Качественный лид',created:'2026-10-01',closed:'2026-10-02',dir:'glass-memory'}],deals:[{id:'20',sourceId:'OTHER',leadId:'10',currency:'RUB',category:49,title:'PRIVATE CLIENT',taskSubj:'PRIVATE TASK',mgr:'Виктория Преснякова',budget:218500,prepayAmt:0,created:'2026-10-02',source:'Другой',dir:'glass-memory',stageCode:'C49:PREPAYMENT_INVOIC',stage:'КП отправлено',hist:[['C49:NEW','2026-10-02'],['C49:PREPAYMENT_INVOIC','2026-10-03']],won:false,lost:false}],prodItems:[],channelMix:{},firedManagers:[],managerPhotos:{'Foreign manager':'private-photo'}};}
test('refusal graph and table share first-refusal scope and keep lead/deal records distinct',()=>{
 const f=fixture();Object.assign(f.leads[0],{statusCode:'JUNK',status:'Некачественный лид',reason:'Дорого'});Object.assign(f.deals[0],{lost:true,closed:'2026-10-12',reason:'дорого',stageCode:'C49:LOSE'});
 f.calendar={version:1,lead:[{id:'1',key:'L10',at:Date.parse('2026-10-10T12:00:00+03:00'),code:'JUNK',semantic:'F'},{id:'2',key:'L10',at:Date.parse('2026-10-20T12:00:00+03:00'),code:'JUNK',semantic:'F'}],deal:[{id:'3',key:'D20',at:Date.parse('2026-10-12T12:00:00+03:00'),code:'C49:LOSE',semantic:'F'}]};
 const d=dashboard(f);d.run("S.start='2026-10-09';S.end='2026-10-15'");assert.equal(d.run('dgRefusalRows().length'),2);assert.equal(d.run('dgRefusalGroups(dgRefusalRows())[0].count'),2);
 d.run("S.dgLossKind='lead'");assert.equal(d.run('dgRefusalRows()[0].key'),'L10');d.run("S.dgLossKind='deal'");assert.equal(d.run('dgRefusalRows()[0].key'),'D20');
 d.run("S.dgLossKind='all';S.start='2026-10-16';S.end='2026-10-31'");assert.equal(d.run('dgRefusalRows().length'),0);
});
test('refusal scrolling retains all records and column filters/sorts agree with reason bars',()=>{
 const f=fixture();f.leads=Array.from({length:45},(_,i)=>({...f.leads[0],id:String(100+i),statusCode:'JUNK',status:'Некачественный лид',reason:'Причина '+i}));f.counts.leads=45;f.scope.leadIds=f.leads.map(l=>l.id);f.deals[0].leadId='100';f.calendar={version:1,deal:[],lead:f.leads.map((l,i)=>({id:String(i+1),key:'L'+l.id,at:Date.parse('2026-10-10T12:00:00+03:00'),code:'JUNK',semantic:'F'}))};
 const d=dashboard(f);d.run("S.start='2026-10-01';S.end='2026-10-31'");
 assert.equal((d.run('dgRefusalBlock()').match(/<tbody>([\s\S]*?)<\/tbody>/)[1].match(/<tr>/g)||[]).length,45);
 for(const [top,n]of [[10,10],[30,30],[50,45]]){d.run('S.dgLossTop='+top);assert.equal((d.run('dgRefusalBlock()').match(/class="dg-loss-bar"/g)||[]).length,n);assert.equal(d.run('dgRefusalView().length'),45);}
 d.run("S.dgLossFilters.reason='Причина 1'");assert.equal(d.run('dgRefusalView().length'),11);assert.equal(d.run('dgRefusalGroups(dgRefusalView()).reduce((a,g)=>a+g.count,0)'),11);
 d.run("S.dgLossFilters={};S.dgLossSort='record';S.dgLossAsc=true");assert.equal(d.run('dgRefusalView()[0].record.id'),'100');d.run('S.dgLossAsc=false');assert.equal(d.run('dgRefusalView()[0].record.id'),'144');

});
test('refusal activity uses Moscow midnight and blank details retain the known reason',()=>{
 const f=fixture();Object.assign(f.leads[0],{statusCode:'JUNK',status:'Некачественный лид',reason:'Дорого'});f.calendar={version:1,leadReasonDetails:{L10:'   '},lead:[{id:'1',key:'L10',at:Date.parse('2026-10-10T12:00:00+03:00'),code:'JUNK',semantic:'F'}],deal:[]};f.communications={version:1,generatedAt:f.generated_at,cache:{status:'available',generatedAt:f.generated_at},events:[{id:'act#1',ts:Date.parse('2026-10-10T22:30:00Z'),entities:['L10'],type:'Письмо',dir:'входящее',who:'Клиент',body:'Request'}]};
 const d=dashboard(f);d.run("S.start='2026-10-01';S.end='2026-10-31'");assert.equal(d.run('dgRefusalRows()[0].reason'),'Дорого');assert.equal(d.run('dgRefusalView()[0].cells.activity'),'11.10.2026');
 assert.ok(!d.run('dgCalendarRecordTable(dgCalendarRows(DG_CAL_ROWS[0]),DG_CAL_ROWS[0])').includes('Последняя коммуникация'));
 f.leads[0].reason='   ';assert.equal(dashboard(f).run('dgRefusalRows()[0].reason'),'Не заполнена');
});
test('missing duplicate-origin hint belongs only to a duplicate lead, not its related deal',()=>{
 const f=fixture();Object.assign(f.leads[0],{statusCode:'JUNK',status:'Некачественный лид',reason:'Дубль'});Object.assign(f.deals[0],{lost:true,closed:'2026-10-12',reason:'Дубль',stageCode:'C49:LOSE'});f.calendar={version:1,lead:[{id:'1',key:'L10',at:Date.parse('2026-10-10T12:00:00+03:00'),code:'JUNK',semantic:'F'}],deal:[{id:'2',key:'D20',at:Date.parse('2026-10-12T12:00:00+03:00'),code:'C49:LOSE',semantic:'F'}]};const d=dashboard(f);d.run("S.start='2026-10-01';S.end='2026-10-31'");
 assert.match(d.run("dgRefusalView().find(x=>x.key==='L10').cells.reason"),/Ссылка на дубль не загружена/);assert.equal(d.run("dgRefusalView().find(x=>x.key==='D20').cells.reason"),'Дубль');assert.equal(d.run("dgRefusalView().find(x=>x.key==='D20').cells.lead"),'Лид 10');
});
test('mini-chart tooltips distinguish missing, partial and genuine zero money',()=>{
 const d=dashboard();d.run("S.calUnit='money';S.start='2026-10-01';S.end='2026-10-31';S.gran='day'");
 const missing=d.run("dgCalendarSparkline([0],'#22D3EE','Лиды',['2026-10-10'],[1],[1])");assert.match(missing,/Не указана/);assert.match(missing,/Записей без суммы/);assert.ok(!missing.includes('0 ₽'));
 const partial=d.run("dgCalendarSparkline([500],'#22D3EE','Лиды',['2026-10-10'],[2],[1])");assert.match(partial,/Известная сумма/);assert.match(partial,/500 ₽/);assert.match(partial,/1 из 2/);
 const zero=d.run("dgCalendarSparkline([0],'#22D3EE','Лиды',['2026-10-10'],[1],[0])");assert.match(zero,/0 ₽/);assert.ok(!zero.includes('без суммы'));
});
test('KPI comparisons partition the selected and previous equal windows using native cash/cohort semantics',()=>{
 const f=fixture();f.leads.push({...f.leads[0],id:'11',created:'2026-09-23',statusCode:'JUNK',status:'Некачественный лид'});f.scope.leadIds.push('11');f.counts.leads=2;
 Object.assign(f.deals[0],{prepayAmt:400,closed:'2026-10-04',stageCode:'C49:EXECUTING',hist:[['C49:NEW','2026-10-02'],['C49:EXECUTING','2026-10-08']]});f.deals.push({...f.deals[0],id:'21',leadId:'11',created:'2026-09-23',closed:'2026-09-24',won:true,stageCode:'C49:WON',budget:1000,prepayAmt:300,hist:[['C49:NEW','2026-09-23'],['C49:EXECUTING','2026-09-23'],['C49:WON','2026-09-24']]});f.scope.dealIds.push('21');f.counts.deals=2;
 const d=dashboard(f);d.run("S.start='2026-10-01';S.end='2026-10-10';S.gran='week';S.revMode='prepay';S.amtMode='prepay';S.dateBasis='outcome'");
 assert.equal(d.run('dgKpiSeries().intervals.length'),2);assert.equal(d.run('dgKpiSeries().intervals[0].previousFrom'),'2026-09-21');assert.equal(d.run('dgKpiSeries().intervals[1].previousTo'),'2026-09-30');
 assert.equal(d.run('dgKpiSeries().intervals.reduce((a,x)=>a+x.current.rev,0)'),400);assert.equal(d.run('dgKpiSeries().intervals.reduce((a,x)=>a+x.previous.rev,0)'),300);
 assert.equal(d.run('dgKpiSeries().intervals[0].current.won'),0);assert.equal(d.run('dgKpiSeries().intervals[0].current.cr2'),1);assert.equal(d.run('dgKpiSeries().intervals[1].current.cr1'),0);assert.equal(d.run('dgKpiSeries().intervals[0].current.check'),null);
 assert.equal(d.run("dgOpenBudgetAt('2026-10-05')"),218500);assert.equal(d.run("dgOpenBudgetAt('2026-09-25')"),0);
 d.run("S.amtMode='budget'");assert.equal(d.run('dgKpiSeries().intervals.reduce((a,x)=>a+x.current.rev,0)'),218500);
 d.run("S.amtMode='prepay';S.dateBasis='created'");assert.equal(d.run('dgKpiSeries().intervals[0].current.won'),1);assert.equal(d.run('dgKpiSeries().intervals[1].current.won'),0);
 d.run("S.revMode='won'");assert.equal(d.run('dgKpiSeries().intervals.reduce((a,x)=>a+x.current.won,0)'),0);assert.equal(d.run('dgKpiSeries().intervals.reduce((a,x)=>a+x.previous.won,0)'),1);
});
test('conversion mini charts connect empty observed intervals at zero in both comparison windows',()=>{
 const d=dashboard();d.run("S.start='2026-10-01';S.end='2026-10-10';S.gran='day'");
 assert.equal(d.run("dgKpiWindow('2026-10-05','2026-10-05').cr1"),0);
 assert.equal(d.run("dgKpiWindow('2026-10-05','2026-10-05').cr2"),0);
 assert.equal(d.run("dgKpiWindow('2026-10-01','2026-10-01').cr1"),1);
 for(const k of ['CR1 · в сделку','CR2 · в продажу']){
  const html=d.run('dgKpiGraphFor({k:'+JSON.stringify(k)+',ac:"accent"})');
  const traces=[...html.matchAll(/<polyline points="([^"]+)"[^>]*>/g)];
  assert.equal(traces.length,2);for(const trace of traces)assert.equal(trace[1].split(' ').length,10);
  assert.ok(!html.includes('Нет базы'));assert.match(html,/0,0%/);
 }
 assert.equal(d.run("dgKpiWindow('2099-01-01','2099-01-01')"),null);
 assert.equal(d.run("dgKpiWindow('2026-10-05','2026-10-05').check"),null);
});
test('all pages, nested item lists, totals and unique IDs are checked',async()=>{let starts=[];const h=helpers(async(m,p)=>{starts.push(p.start);return p.start===0?{result:{items:[{id:1}]},next:1,total:2}:{result:{items:[{id:2}]},total:2};});assert.equal((await h.strictList('x',{}, {itemsPath:true,idField:'id'})).length,2);assert.deepEqual(starts,[0,1]);await assert.rejects(helpers(async()=>({result:[{ID:1}],total:2})).strictList('x',{}),/incomplete/);await assert.rejects(helpers(async()=>({result:[{ID:1},{ID:1}],total:2})).strictList('x',{}),/duplicate/);});
test('empty scopes never become global queries, and foreign rows are rejected',async()=>{let calls=0;const h=helpers(async()=>{calls++;return {result:[{ID:1,OWNER_ID:999}]};});assert.equal((await h.scopedChunks('x',{},'@OWNER_ID',[])).length,0);assert.equal(calls,0);await assert.rejects(h.scopedChunks('x',{},'@OWNER_ID',[20]),/foreign scoped row/);});
test('communication includes only directly bound DG leads/deals',async()=>{let queries=[];const h=helpers(async(m,p)=>{queries.push(p);return {result:[],total:0};});h.SC.leads=[{ID:'10'}];h.SC.deals=[{ID:'20',CONTACT_ID:'30',COMPANY_ID:'40'}];await h.listSharded('crm.activity.list',{filter:{'>CREATED':'2026-01-01'}});assert.deepEqual(queries.map(q=>q.filter.OWNER_TYPE_ID),[1,2]);assert.deepEqual(queries.map(q=>Array.from(q.filter['@OWNER_ID'])),[['10'],['20']]);assert.ok(queries.every(q=>q.filter['>CREATED']==='2026-01-01'));});
test('production and history queries preserve separate entity scopes',async()=>{let qs=[];const h=helpers(async(m,p)=>{qs.push([m,p]);return m==='crm.item.list'?{result:{items:[{id:'30',parentId2:'20'}]},total:1}:{result:{items:[]},total:0};});h.SC.deals=[{ID:'20'}];await h.listSharded('crm.item.list',{entityTypeId:1086},{itemsPath:true,idField:'id'});await h.listSharded('crm.stagehistory.list',{entityTypeId:1086},{itemsPath:true});assert.deepEqual(Array.from(qs[0][1].filter['@parentId2']),['20']);assert.deepEqual(Array.from(qs[1][1].filter['@OWNER_ID']),['30']);});
test('scope validation rejects stale, foreign, duplicate, unsupported money and production rows',()=>{for(const mutate of [r=>r.generated_at='2020-01-01',r=>r.leads[0].sourceId='OTHER',r=>r.deals[0].leadId='999',r=>r.deals.push(r.deals[0]),r=>r.deals[0].currency='USD',r=>r.deals[0].category=99,r=>r.prodItems.push({dealId:'999'}),r=>r.channelMix.Foreign={}]){const r=fixture();mutate(r);assert.throws(()=>validateRaw(r));}});
test('GG builder retains linked-only DG and GM assignees, excludes private text, never imports GG plan',()=>{const r=build(fixture(),template,builder,hook);assert.equal(r.data.leads.length,1);assert.equal(r.data.deals.length,1);assert.equal(r.data.deals[0].budget,218500);assert.equal(r.data.from,'2026-10-01');assert.equal(r.data.plan,null);assert.equal(r.data.planUrl,'');assert.equal(r.data.planCsv,'');assert.deepEqual(r.data.managerPhotos,{});assert.ok(!r.html.includes('PRIVATE CLIENT'));assert.ok(!r.html.includes('PRIVATE TASK'));assert.ok(!r.html.includes('<div id="planDock"'));new vm.Script(r.html.match(/<script>([\s\S]*)<\/script>/)[1]);});
test('empty DG dataset builds all section definitions with no fake source records',()=>{const f=fixture();f.leads=[];f.deals=[];f.counts={leads:0,deals:0};f.scope.leadIds=[];f.scope.dealIds=[];const r=build(f,template,builder,hook);assert.equal(r.data.leads.length,0);assert.equal(r.data.deals.length,0);for(const title of ['Лиды от Домгласс','Работа отдела продаж','Менеджеры','Передано без карточки СП','Причины отказов со стадии предложения'])assert.ok(r.html.includes(title));assert.ok(r.html.includes('const ltot=L.length;'));assert.ok(!r.html.includes('const refused=refCats.reduce((s,x)=>s+x[1],0)||1;'));});
test('CRM content cannot terminate the baked data script',()=>{const f=fixture();f.deals[0].client='</script><script>alert(1)</script>';const r=build(f,template,builder,hook);assert.ok(!r.html.includes('</script><script>alert'));assert.equal(r.data.deals[0].client,f.deals[0].client);});
test('reference collector compiles with scope adapter and fails on source contract drift',()=>{const source=adapt(collector,mask);assert.ok(source.includes('foreign scoped row'));assert.ok(source.includes('reason: dgSafeText'));assert.throws(()=>adapt(collector.replace('const OUT = "rop/data/rop.json";','const OUT="other";'),mask),/contract changed/);});

// Exercise generated page functions with synthetic records; no network or credentials.
function dashboard(raw=fixture()){
 const result=build(raw,template,builder,hook);let code=result.html.match(/<script>([\s\S]*)<\/script>/)[1];code=code.slice(0,code.lastIndexOf("setPeriod('30');buildShell();"));let captured='';
 const el=()=>({style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll(){return[];},querySelector(){return null;},setAttribute(){},getAttribute(){return null;},textContent:'',value:'',innerHTML:''});
 const rootEl=el();Object.defineProperty(rootEl,'innerHTML',{set(v){captured=v;throw Error('CAPTURE');}});const els={root:rootEl};
 const document={getElementById:id=>els[id]||(els[id]=el()),querySelectorAll:()=>[],querySelector:()=>el(),addEventListener(){},documentElement:el(),body:el()};
 const ctx={document,console,URLSearchParams,location:{search:'',protocol:'file:'},setTimeout(){},setInterval(){},clearTimeout(){},getComputedStyle:()=>({getPropertyValue:()=>''}),requestAnimationFrame(){},localStorage:{getItem(){return null;},setItem(){}}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);
 const run=code=>vm.runInContext(code,ctx);run("S.start='2026-10-01';S.end='2026-10-31';");
 return {data:result.data,run,render(){try{run('render()');}catch(e){if(e.message!=='CAPTURE')throw e;}return captured;}};
}
function sync(raw){raw.counts={leads:raw.leads.length,deals:raw.deals.length};raw.scope.leadIds=raw.leads.map(x=>x.id);raw.scope.dealIds=raw.deals.map(x=>x.id);return raw;}
test('lead reasons retain known operational labels and never publish arbitrary comments',()=>{
 const [junk,comment,reason]=DG_REASON_FIELDS;
 assert.equal(leadReason({STATUS_ID:'JUNK',[junk]:'  ТЕСТ  '}),'Тест');
 assert.equal(leadReason({STATUS_ID:'3',[reason]:'не сделаем',[comment]:'private customer text'}),'Не сделаем');
 assert.equal(leadReason({STATUS_ID:'JUNK',[junk]:'call John at +79991234567'}),'Другая причина (см. CRM)');
 for(const value of ['__proto__','constructor','toString'])assert.equal(leadReason({STATUS_ID:'JUNK',[junk]:value}),'Другая причина (см. CRM)');
 assert.equal(leadReason({STATUS_ID:'3'}),'Не заполнена');assert.equal(leadReason({STATUS_ID:'1'}),'СПАМ');assert.equal(leadReason({STATUS_ID:'NEW',[reason]:'test'}),null);
 const fields=Object.fromEntries(DG_REASON_FIELDS.map(f=>[f,{type:'string'}]));assert.doesNotThrow(()=>assertLeadReasonFields(fields));assert.throws(()=>assertLeadReasonFields({}),/unavailable/);fields[reason].type='enumeration';assert.throws(()=>assertLeadReasonFields(fields),/changed/);
});
test('requested sections are absent from rendered DOM',()=>{
 const h=dashboard().render();for(const title of ['Команда - план-факт','Выполнение плана','Динамика отдела','Динамика заявок','Качество разметки','Дисциплина данных','Сделки для исправления по отделу','Передача в производство','Отдел продаж: передачи и потенциал','Со сделанным предложением - под контроль','Здоровье отдела продаж','План предоплат','План ДГ не задан'])assert.ok(!h.includes(title),title);
 assert.ok(!h.includes('<h2>Менеджеры</h2>'));assert.ok(!h.includes('Скорость по этапам'));assert.ok(!h.includes('Причины отказов в сделках'));assert.equal((h.match(/<h2>/g)||[]).length,3);
});
test('distribution defaults to all creation-cohort deals, preserves every category, and separates count/amount',()=>{
 const f=fixture(),seed=f.deals[0];f.deals=Array.from({length:12},(_,i)=>({...seed,id:String(20+i),assort:'Category '+i,budget:i===0?null:100}));const d=dashboard(sync(f));
 assert.equal(d.run('dgDistributionRows().length'),12);assert.equal(d.run("dgDistributionGroups(dgDistributionRows(),'assort').length"),12);assert.equal(d.run("dgDistributionGroups(dgDistributionRows(),'assort').reduce((s,g)=>s+g.value,0)"),12);
 d.run("S.dgDistUnit='money'");assert.equal(d.run("dgDistributionGroups(dgDistributionRows(),'assort').reduce((s,g)=>s+g.value,0)"),1100);assert.equal(d.run("dgDistributionGroups(dgDistributionRows(),'assort').reduce((s,g)=>s+g.missing,0)"),1);
 d.run("S.dgDistMode='sales'");const h=d.run('dgDistributionBlock()');assert.equal(d.run('dgDistributionRows().length'),0);assert.equal((h.match(/dg-empty-ring/g)||[]).length,2);assert.ok(!h.includes('<path '));assert.ok(h.includes('Нет продаж за выбранный период'));
});
test('sales distributions preserve GG prepayment event, amount and date-basis filters',()=>{
 const f=fixture();Object.assign(f.deals[0],{created:'2026-09-01',stageCode:'C49:EXECUTING',stage:'Предоплата',prepayAmt:400,hist:[['C49:EXECUTING','2026-10-08']]});const d=dashboard(f);d.run("S.dgDistMode='sales';S.dgDistUnit='money';S.amtMode='prepay'");assert.equal(d.run('dgDistributionRows().length'),1);assert.equal(d.run('dgDistributionValue(dgDistributionRows()[0])'),400);d.run("S.dateBasis='created'");assert.equal(d.run('dgDistributionRows().length'),0);
});
test('lead selection and reason drilldown reconcile with related deals across dates',()=>{
 const f=fixture();Object.assign(f.leads[0],{budget:750,currency:'RUB',updated:'2026-10-25',reason:null});f.leads.push({...f.leads[0],id:'11',statusCode:'JUNK',status:'Некачественный лид',reason:'Тест'});f.leads.push({...f.leads[1],id:'12',reason:'Некачественный лид'});f.deals[0].created='2026-09-20';const d=dashboard(sync(f));
 assert.equal(d.data.deals[0].leadId,'10');assert.equal(d.data.leads[0].currency,'RUB');assert.equal(d.data.leads[0].updated,'2026-10-25');
 d.run("S.dgDetail={kind:'leads',stage:'Сделки'}");assert.equal(d.run('dgLeadRows().length'),1);assert.ok(d.run('dgLeadDetails()').includes('dg-record-id'));assert.ok(!d.run('dgLeadDetails()').includes('/crm/'));
 d.run("S.dgDetail={kind:'leads',stage:'Отказ'}");assert.equal(d.run('dgLeadRows().length'),2);d.run("S.dgReason='Тест'");const h=d.run('dgLeadDetails()');assert.ok(h.includes('data-dg-lead-row="11"'));assert.ok(!h.includes('data-dg-lead-row="12"'));assert.ok(h.includes('50,0%'));
 d.run("S.dgReason='';S.dgSearch='12'");assert.ok(d.run('dgLeadDetails()').includes('data-dg-lead-row="12"'));assert.ok(!d.run('dgLeadDetails()').includes('data-dg-lead-row="11"'));
});

test('partner view defaults, vertical funnel and outcome order preserve facts without outgoing links',()=>{
 assert.ok(build(fixture(),template,builder,hook).html.includes('<button data-am="prepay" class="on">предоплата</button>'));
 const d=dashboard();assert.equal(d.run('S.amtMode'),'prepay');const h=d.render();
 assert.equal((h.match(/data-cross-count=/g)||[]).length,3);assert.ok(h.includes('data-cross-count="1"'));assert.ok(h.indexOf('>В работе</div></div>')<h.indexOf('>Выиграно</div></div>'));
 assert.ok(h.includes('dg-dist-controls'));assert.ok(!/<a\b/i.test(h));assert.equal(d.data.b24Portal,'');
 const safe=d.run(`dgSafeMarkup('<a href="https://example.com" data-tip="<b>hint</b>">ID ↗</a><a href="#sec1">Local</a>')`);assert.equal(safe,'<span data-tip="<b>hint</b>">ID</span><a href="#sec1">Local</a>');
});
test('zero comparison is a labelled placeholder; previous windows match selected duration',()=>{
 const d=dashboard();assert.match(d.run('trendChip(10,0)'),/data-tip=.*0%/);assert.match(d.run('trendChip(10,5)'),/100,0%/);
 for(const [start,end,prevStart,prevEnd] of [['2026-10-20','2026-10-26','2026-10-13','2026-10-19'],['2026-09-27','2026-10-26','2026-08-28','2026-09-26'],['2026-10-10','2026-10-12','2026-10-07','2026-10-09']]){d.run(`S.start='${start}';S.end='${end}'`);assert.equal(JSON.stringify(d.run('prevWin()')),JSON.stringify([prevStart,prevEnd]));}
});
test('calendar counts first production/shipping/completion events and keeps WIP separate',()=>{
 const f=fixture();Object.assign(f.deals[0],{won:true,stageCode:'C49:WON',stage:'Сделка успешна',closed:'2026-10-08',prepayAmt:500,hist:[['C49:PREPAYMENT_INVOIC','2026-09-20'],['C49:EXECUTING','2026-10-03'],['C49:FINAL_INVOICE','2026-10-11'],['C49:FINAL_INVOICE','2026-10-04'],['C49:2','2026-10-06'],['C49:WON','2026-10-08']]});const d=dashboard(f);d.run("S.gran='day';S.calUnit='count';S.dgCalGroup='wip';S.dgCalDealsOpen=true");const h=d.render();
 for(const [row,day] of [['production','04'],['shipping','06'],['completed','08']])assert.equal(d.run(`dgCalendarRows(DG_CAL_ROWS.find(r=>r.id==='${row}'))[0].at`),'2026-10-'+day);
 assert.ok(h.includes('КП отправлено'));assert.ok(h.includes('Формирование ТЗ'));assert.ok(!h.includes('<small>на конец</small>'));assert.ok(!h.includes('data-dg-leadstatus='));
 d.run("S.start='2026-10-09';S.end='2026-10-31'");assert.equal(d.run("dgCalendarRows(DG_CAL_ROWS.find(r=>r.id==='completed')).length"),0);
});

test('calendar stock is the stage at bucket end and is never added across buckets',()=>{
 const f=fixture();f.deals[0].hist=[['C49:NEW','2026-10-02'],['C49:PREPARATION','2026-10-03'],['C49:PREPAYMENT_INVOIC','2026-10-15']];const d=dashboard(f);
 d.run("S.gran='day';S.start='2026-10-10';S.end='2026-10-20'");
 assert.equal(d.run("dgCalendarRows(DG_CAL_ROWS.find(r=>r.id==='wip'),'2026-10-14').length"),1);
 assert.equal(d.run("dgCalendarRows(DG_CAL_ROWS.find(r=>r.id==='wip'),'2026-10-15').length"),0);
 assert.equal(d.run("dgCalendarRows(DG_CAL_ROWS.find(r=>r.id==='wip')).length"),0);
 const empty=d.run("dgCalendarRecordTable([],DG_CAL_ROWS.find(r=>r.id==='wip'),{row:'wip',bucket:null})");assert.ok(empty.includes('На эту дату открытых сделок на этапе нет'));assert.ok(empty.includes('colspan="7"'));
 const past=d.run("(()=>{const row=DG_CAL_ROWS.find(r=>r.id==='wip');return dgCalendarRecordTable(dgCalendarRows(row,'2026-10-14'),row,{row:'wip',bucket:'2026-10-14'});})()");assert.ok(past.includes('Открытый остаток на 14.10.2026'));assert.ok(!past.includes('На эту дату открытых сделок на этапе нет'));
 f.deals[0].hist=[['C49:PREPARATION','2026-10-03']];const cap=dashboard(f);cap.run("S.end='2099-12-31'");const capped=cap.run("(()=>{const row=DG_CAL_ROWS.find(r=>r.id==='wip');return dgCalendarRecordTable(dgCalendarRows(row),row,{row:'wip',bucket:null});})()");const date=cap.run('dgDate(dgMSKDay(Date.parse(DATA.generatedAt)))');assert.ok(capped.includes('Открытый остаток на '+date));assert.ok(capped.includes('<td>'+date+'</td>'));assert.ok(!capped.includes('<td>31.12.2099</td>'));
});

test('calendar dates use Moscow midnight and reject foreign event owners',()=>{
 const f=fixture();f.calendar={version:1,lead:[{id:'1',key:'L10',at:Date.parse('2026-10-04T21:30:00Z'),code:'JUNK',semantic:'F'}],deal:[]};const d=dashboard(f);d.run("S.gran='day'");
 assert.equal(d.run("dgCalendarRows(DG_CAL_ROWS.find(r=>r.id==='leadLost'))[0].at"),'2026-10-05');
 f.calendar.lead[0].key='L999';assert.throws(()=>validateRaw(f),/calendar history/);
});

test('communication snapshot and files stay scoped and deduplicate the source lead inside a deal',()=>{
 const f=fixture();f.communications={version:1,generatedAt:f.generated_at,cache:{status:'available',generatedAt:f.generated_at},events:[{id:'act#1',ts:Date.now(),entities:['L10','D20'],type:'Письмо',dir:'входящее',who:'Клиент',body:'full message'}]};
 const r=build(f,template,builder,hook);assert.equal(r.communications.D20.events.length,1);assert.equal(r.communications.L10.events.length,1);assert.equal(r.data.communicationIndex.D20.commIds.length,1);assert.ok(r.html.includes('full message'));assert.equal(r.data.communicationEvents.length,1);
 f.communications.events[0].entities.push('D999');assert.throws(()=>build(f,template,builder,hook),/Foreign/);
});

test('Dialog cache paginates all rows and ignores other-source entities',async()=>{
 const {dgDialogCache}=require('./communications.cjs');const all=Array.from({length:101},(_,i)=>({src:'act#'+i,ts:Date.now(),leadId:'10',stage:'lead',type:'Письмо',body:'body'}));let pages=0;
 const fetcher=async url=>({ok:true,json:async()=>url.endsWith('/api/status')?{generatedAt:'2026-10-26',imported:'2026-10-26T05:47:00Z'}:(pages++,{total:101,items:all.slice(Number(new URL(url).searchParams.get('page'))*100,Number(new URL(url).searchParams.get('page'))*100+100)})});
 const c=await dgDialogCache(new Set(['L10']),fetcher);assert.equal(c.events.length,101);assert.equal(pages,2);
 all[0].leadId='999';assert.equal((await dgDialogCache(new Set(['L10']),fetcher)).events.length,100);
});

test('fresh communications retain full text, enforce actual bindings and stop on incomplete pages',async()=>{
 const {dgEnrich}=require('./communications.cjs');const now=Date.now(),body='text '.repeat(1500)+' prefixhttps://example.com/rest/1/private/';const activity={ID:'1',OWNER_TYPE_ID:'2',OWNER_ID:'20',TYPE_ID:'4',DIRECTION:'1',CREATED:new Date(now).toISOString(),SUBJECT:'Mail',DESCRIPTION:body,COMPLETED:'Y'};
 const source=async(method,p)=>method==='crm.stagehistory.list'?{result:{items:[]},total:0}:method==='crm.activity.binding.list'?{result:[{entityTypeId:1,entityId:10},{entityTypeId:2,entityId:20}]}:method==='crm.activity.list'?{result:[activity],total:1}:{result:[],total:0};
 const options={leads:[{ID:'10'}],deals:[{ID:'20'}],call:source,now,throttleMs:0,fetcher:async()=>{throw Error('cache down');}};
 const out=await dgEnrich(options);assert.equal(out.communications.events.length,1);assert.deepEqual(out.communications.events[0].entities,['L10','D20']);assert.ok(out.communications.events[0].body.length>4000);assert.ok(!out.communications.events[0].body.includes('https://'));assert.equal(out.communications.cache.status,'unavailable');
 await assert.rejects(dgEnrich({...options,call:async(method,p)=>method==='crm.activity.list'?{result:[activity],total:2}:source(method,p)}),/Incomplete/);
 await assert.rejects(dgEnrich({...options,call:async(method,p)=>method==='crm.activity.binding.list'?{result:[{entityTypeId:2,entityId:999}]}:source(method,p)}),/Foreign bound/);
});


test('calendar drilldown removes the summary and reason toolbar without hiding records',()=>{const f=fixture();f.leads[0].qual='неквал';f.leads[0].reason='Тест';f.calendar={version:1,lead:[{id:'1',key:'L10',at:Date.parse('2026-10-04T12:00:00+03:00'),code:'JUNK',semantic:'F'}],deal:[]};const d=dashboard(f);d.run("S.dgCalPick={row:'leadLost',bucket:null,reason:''}");const h=d.run("dgCalendarDetail(DG_CAL_ROWS.find(r=>r.id==='leadLost'))");assert.ok(!h.includes('dg-cal-facts'));assert.ok(!h.includes('dg-reasons'));assert.ok(h.includes('Виктория Преснякова'));});

test('ambiguous archive entity stage and invalid cache dates never become available DG history',async()=>{
 const {dgDialogCache}=require('./communications.cjs');const item={src:'act#1',ts:Date.now(),leadId:'999',dealId:'20',type:'Письмо',body:'foreign'};
 const source=async url=>({ok:true,json:async()=>url.endsWith('/api/status')?{generatedAt:'2026-10-26',imported:'2026-10-26T05:47:00Z'}:{total:1,items:[item]}});
 const out=await dgDialogCache(new Set(['D20']),source);assert.equal(out.events.length,0);assert.equal(out.skippedUnattributed,1);
 await assert.rejects(dgDialogCache(new Set(['D20']),async()=>({ok:true,json:async()=>({generatedAt:'not-a-date',imported:'2026-10-26T05:47:00Z'})})),/cache version/);
 const f=fixture();f.communications={generatedAt:'not-a-date',cache:{status:'unavailable'},events:[]};assert.throws(()=>validateRaw(f),/freshness/);
});

test('timeline ID collisions do not cross lead/deal types',async()=>{
 const {dgEnrich}=require('./communications.cjs');await assert.rejects(dgEnrich({leads:[{ID:'10'}],deals:[],throttleMs:0,fetcher:async()=>{throw Error();},call:async(method)=>method==='crm.stagehistory.list'?{result:{items:[]},total:0}:method==='crm.activity.list'?{result:[],total:0}:{result:[{ID:'1',ENTITY_ID:'10',ENTITY_TYPE:'deal',CREATED:new Date().toISOString(),COMMENT:'foreign'}],total:1}}),/Foreign timeline/);
});

test('transcript uncertainty survives serialization and appears next to speaker roles',()=>{
 const {dgCleanEvent}=require('./communications.cjs'),event=dgCleanEvent({src:'cmt#1',ts:Date.now(),type:'Транскрипт звонка',body:'dialog',roleGuess:true,undiar:true,due:'<img src=x>',speakers:[{role:'Менеджер',text:'hello'}]},['D20']);assert.equal(event.undiar,true);assert.equal(event.due,null);
 const d=dashboard();d.run('dgCommCache.set("D20",'+JSON.stringify({events:[event]})+')');const html=d.run('dgCommunicationTable("D20")');assert.match(html,/Роли определены по тексту/);assert.match(html,/Надёжного разделения говорящих нет/);
 d.run("S.dgCalPick={row:'lost',reason:''}");assert.match(d.run("dgCalendarRecordTable([],DG_CAL_ROWS.find(r=>r.id==='lost'))"),/Причина отказа/);
});

test('DG sender cohort uses incoming envelope address, exact domain and all verified lead bindings',async()=>{
 const {dgMailCohort,dgMailDomains}=require('./mail-cohort.cjs');assert.deepEqual(dgMailDomains('"sales@domglass.ru" <bank@tochka.com>'),['tochka.com']);assert.deepEqual(dgMailDomains('Manager <sales@DOMGLASS.RU>'),['domglass.ru']);
 const leads=[{ID:'10'},{ID:'11'},{ID:'12'}],good={ID:'1',OWNER_TYPE_ID:'1',OWNER_ID:'10',TYPE_ID:'4',DIRECTION:'1',SETTINGS:{EMAIL_META:{from:'Manager <sales@domglass.ru>'}}},bad={...good,ID:'2',OWNER_ID:'11',SETTINGS:{EMAIL_META:{from:'info@tochka.com'}}};
 const source=async(method,p)=>method==='crm.activity.list'?{result:[good,bad],total:2}:{result:[{entityTypeId:1,entityId:10},{entityTypeId:1,entityId:12}]};
 const out=await dgMailCohort(leads,source,{throttleMs:0});assert.deepEqual(out.leads.map(l=>l.ID),['10','12']);assert.deepEqual(out.excluded,['11']);
 await assert.rejects(dgMailCohort(leads,async(method,p)=>method==='crm.activity.list'?{result:[{...good,DIRECTION:'2'}],total:1}:source(method,p),{throttleMs:0}),/incoming email/);
 await assert.rejects(dgMailCohort(leads,async(method,p)=>method==='crm.activity.list'?{result:[good],total:2}:source(method,p),{throttleMs:0}),/Incomplete/);
});

test('mail cohort fails on missing sender metadata instead of dropping valid DG leads silently',async()=>{
 const {dgMailCohort}=require('./mail-cohort.cjs');await assert.rejects(dgMailCohort([{ID:'10'}],async method=>method==='crm.activity.list'?{result:[{ID:'1',OWNER_TYPE_ID:'1',OWNER_ID:'10',TYPE_ID:'4',DIRECTION:'1'}],total:1}:{result:{ID:'1',TYPE_ID:'4',DIRECTION:'1'}},{throttleMs:0}),/sender unavailable/);
});

test('GG calendar uses heat cells and inline manager rows while keeping the event table compact',()=>{
 const d=dashboard();d.run("S.dgCalGroup='deals';S.dgCalExpanded.add('deals')");const h=d.run('dgCalendarBlock()');assert.match(h,/dg-heat-row/);assert.match(h,/dg-heat-manager/);assert.match(h,/data-dg-calmanager=/);assert.ok(!h.includes('dg-cal-table'));
 d.run('dgCommCache.set("D20",'+JSON.stringify({events:[{ts:Date.now(),entities:['D20'],type:'Письмо',who:'Client',body:'body'}]})+')');const feed=d.run('dgCommunicationTable("D20")');assert.ok(!feed.includes('dg-comm-title'));assert.ok(!feed.includes('dg-comm-filters'));assert.ok(!feed.includes('data-dg-commsort'));
 const {dgSafeText}=require('./communications.cjs');assert.equal(dgSafeText('ООО &laquo;ДомГласс&raquo;'),'ООО «ДомГласс»');assert.equal(dgSafeText('&amp;laquo;test&amp;raquo;'),'«test»');assert.ok(!dgSafeText('https&#58;&#47;&#47;example.com/rest/1/test/').includes('https'));
});

test('complete sender mailboxes reject domain prefixes and ignore quoted fake angle addresses',()=>{
 const {dgMailDomains}=require('./mail-cohort.cjs');
 for(const from of ['sales@domglass.ru123','sales@domglass.ru-evil','sales@domglass.ruа','message @domglass.ru','sales@domglass.ru.example.org'])assert.ok(!dgMailDomains(from).includes('domglass.ru'),from);
 assert.deepEqual(dgMailDomains('"<display@elsewhere.test>" <actual@domglass.ru>'),['domglass.ru']);
 assert.deepEqual(dgMailDomains('"<actual@domglass.ru>" <bank@elsewhere.test>'),['elsewhere.test']);
 assert.deepEqual(dgMailDomains('Manager (display@elsewhere.test) <actual@DOMGLASS.RU>'),['domglass.ru']);
 assert.deepEqual(dgMailDomains('one@domglass.ru, two@elsewhere.test'),['domglass.ru','elsewhere.test']);
});

test('fallback email metadata must belong to the same incoming email activity',async()=>{
 const {dgMailCohort}=require('./mail-cohort.cjs'),row={ID:'1',TYPE_ID:'4',DIRECTION:'1',OWNER_TYPE_ID:'1',OWNER_ID:'10'},meta={from:'actual@domglass.ru'};
 const source=details=>async method=>method==='crm.activity.list'?{result:[row],total:1}:method==='crm.activity.get'?{result:{...row,SETTINGS:{EMAIL_META:meta},...details}}:{result:[{entityTypeId:1,entityId:10}]};
 for(const details of [{ID:'999'},{TYPE_ID:'2'},{DIRECTION:'2'}])await assert.rejects(dgMailCohort([{ID:'10'}],source(details),{throttleMs:0}),/identity mismatch/);
 assert.equal((await dgMailCohort([{ID:'10'}],source({}),{throttleMs:0})).leads.length,1);
});

test('missing or malformed email activity IDs abort before requesting bindings',async()=>{
 const {dgMailCohort}=require('./mail-cohort.cjs');
 for(const ID of [undefined,'',0,'-1','1x'])await assert.rejects(dgMailCohort([{ID:'10'}],async method=>{assert.equal(method,'crm.activity.list');return {result:[{ID,TYPE_ID:4,DIRECTION:1,OWNER_TYPE_ID:1,OWNER_ID:10,SETTINGS:{EMAIL_META:{from:'actual@domglass.ru'}}}],total:1};},{throttleMs:0}),/incoming email/);
});

test('final decoding masks nested encoded contacts at the published communication boundary',()=>{
 const {dgSafeText}=require('./communications.cjs'),phone='+79990001122';let encoded=Array.from(phone,c=>'&#'+c.codePointAt(0)+';').join('');for(let i=0;i<6;i++)encoded=encoded.replace(/&/g,'&amp;');
 const safe=dgSafeText(encoded);assert.equal(safe,'+7999****22');assert.equal(dgSafeText(safe),safe);
 const f=fixture();f.communications={generatedAt:f.generated_at,events:[{id:'act#777',ts:Date.now(),entities:['L10'],type:'Письмо',body:encoded}]};const published=build(f,template,builder,hook).communications.D20;
 assert.ok(!JSON.stringify(published).includes(phone));assert.equal(published.events[0].body,safe);
 let excessive='&laquo;';for(let i=0;i<70;i++)excessive=excessive.replace(/&/g,'&amp;');assert.throws(()=>dgSafeText(excessive),/nesting limit/);
});

test('an open snapshot reads its own communication history after the server refreshes',async()=>{
 const f=fixture();f.communications={version:1,generatedAt:f.generated_at,events:[{id:'act#888',ts:Date.now(),entities:['L10'],type:'Письмо',body:'same snapshot </script><script>alert(1)</script>'}]};
 const built=build(f,template,builder,hook);assert.ok(!built.html.includes('</script><script>alert(1)'));const d=dashboard(f);
 d.run("fetch=()=>{throw Error('different server snapshot');}");await d.run("dgLoadCommunication('D20')");
 assert.equal(d.run("dgCommCache.get('D20').generatedAt"),f.generated_at);assert.equal(d.run("dgCommCache.get('D20').events.filter(e=>e.id==='act#888').length"),1);assert.ok(!d.run("dgCommCache.has('D999')"));
 assert.ok(d.run("dgCommunicationTable('D20')").includes('same snapshot &lt;/script&gt;'));
});

test('calendar amount stays budget-based independently of global prepayment or stale state',()=>{
 const f=fixture();f.deals[0].prepayAmt=500;const d=dashboard(f);d.run("S.calUnit='money';S.amtMode='prepay'");assert.equal(d.run('S.dgCalView'),'managers');
 const expression="dgCalendarLine(DG_CAL_ROWS.find(r=>r.id==='deals'),dgCalendarKeys())";
 assert.ok(d.run(expression+".includes(fmtK(218500))"));d.run("S.dgCalAmount='prepay'");assert.ok(d.run(expression+".includes(fmtK(218500))"));assert.ok(!d.run('dgCalendarBlock()').includes('data-dg-calamount'));assert.equal(d.run('S.amtMode'),'prepay');
});

test('Outlook styles are removed without dropping the customer request in fresh or archived email',()=>{
 const normal=require('./dialog-normalize.cjs')({},Date.now()),{dgCleanEvent}=require('./communications.cjs');
 const css=['v\\:* {behavior:url(#default#VML);}','o\\:* {behavior:url(#default#VML);}','w\\:* {behavior:url(#default#VML);}','.shape {behavior:url(#default#VML);}'].join('\n');
 const request='Просьба рассчитать стеклянную перегородку. Размер 1200 × 2000. Срок 15 дней.';
 const archived=dgCleanEvent({src:'act#901',ts:Date.now(),type:'Письмо',body:css+'\n\n'+request},['L10']);assert.equal(archived.body,request);
 const fresh=normal.activity({ID:'902',TYPE_ID:'4',DIRECTION:'1',SUBJECT:'Запрос',CREATED:new Date().toISOString(),DESCRIPTION:'<style>'+css+' p.MsoNormal {color:red}</style><script>not email text</script><p>'+request+'</p>'},'Менеджер');
 assert.ok(fresh.body.includes(request));assert.ok(!fresh.body.includes('VML'));assert.ok(!fresh.body.includes('MsoNormal'));assert.ok(!fresh.body.includes('not email text'));
 const ordinary=dgCleanEvent({src:'act#903',ts:Date.now(),type:'Письмо',body:'Описание .shape и пример {размер:1200} — часть запроса.'},['L10']);assert.ok(ordinary.body.includes('.shape'));assert.ok(ordinary.body.includes('{размер:1200}'));
});

test('related lead candidates come only from direct DG deals and still require incoming Domglass mail',async()=>{
 const {dgLeadCandidates,dgMailCohort}=require('./mail-cohort.cjs'),source=[{ID:'10',SOURCE_ID:'UC_NQ3QUI'}],direct=[{ID:'20',SOURCE_ID:'UC_NQ3QUI',CATEGORY_ID:49,LEAD_ID:'11'},{ID:'21',SOURCE_ID:'UC_NQ3QUI',CATEGORY_ID:49,LEAD_ID:'12'}];
 const candidates=await dgLeadCandidates(source,direct,async ids=>{assert.deepEqual(ids,['11','12']);return ids.map(ID=>({ID,SOURCE_ID:'OTHER'}));});
 assert.deepEqual(candidates.leads.map(l=>l.ID),['10','11','12']);assert.deepEqual(candidates.parentDeals['11'],['20']);
 const activities=candidates.leads.map((l,i)=>({ID:String(i+1),OWNER_TYPE_ID:1,OWNER_ID:l.ID,TYPE_ID:4,DIRECTION:1,SETTINGS:{EMAIL_META:{from:l.ID==='12'?'notice@elsewhere.test':'person@domglass.ru'}}}));
 const result=await dgMailCohort(candidates.leads,async(method,p)=>method==='crm.activity.list'?{result:activities,total:3}:{result:[{entityTypeId:1,entityId:activities.find(a=>a.ID===String(p.activityId)).OWNER_ID}]},{throttleMs:0});assert.deepEqual(result.leads.map(l=>l.ID),['10','11']);assert.deepEqual(result.excluded,['12']);
 await assert.rejects(dgLeadCandidates(source,direct,async()=>[{ID:'11',SOURCE_ID:'OTHER'},{ID:'99',SOURCE_ID:'OTHER'}]),/Missing\/foreign/);
 await assert.rejects(dgLeadCandidates(source,[{...direct[0],SOURCE_ID:'OTHER'}],async()=>[]),/direct DG/);
 await assert.rejects(dgLeadCandidates(source,[{...direct[0],CATEGORY_ID:21}],async()=>[]),/direct DG/);
 assert.equal((await dgLeadCandidates(source,[],async()=>{throw Error('global query');})).leads.length,1);
});

test('a non-DG-source lead requires admitted direct-deal and exact sender proofs',()=>{
 const f=fixture();f.leads.push({...f.leads[0],id:'11',sourceId:'OTHER'});f.deals[0].leadId='11';f.deals[0].sourceId='UC_NQ3QUI';sync(f);f.scope.linkedLeadProof=[{leadId:'11',dealIds:['20']}];f.scope.mailPolicy={domain:'domglass.ru',direction:'incoming',confirmedLeadIds:['10','11']};assert.equal(validateRaw(f),true);assert.equal(build(f,template,builder,hook).data.leads.length,2);
 for(const mutate of [r=>r.scope.linkedLeadProof=[],r=>r.deals[0].sourceId='OTHER',r=>r.deals[0].leadId='10',r=>r.scope.linkedLeadProof[0].dealIds=['999'],r=>r.scope.mailPolicy.confirmedLeadIds=['10'],r=>r.scope.mailPolicy.domain='elsewhere.test',r=>r.scope.linkedLeadProof.push(r.scope.linkedLeadProof[0])]){const bad=structuredClone(f);mutate(bad);assert.throws(()=>validateRaw(bad));}
});

test('communication ordering preserves exact seconds and resolves identical timestamps by lifecycle',()=>{
 const d=dashboard();d.run("globalThis.p={events:[{id:'a',ts:54,type:'Дело',entities:['D20']},{id:'d',ts:54,type:'Стадия',entities:['D20']},{id:'l',ts:55,type:'Стадия',entities:['L10']},{id:'m',ts:56,type:'Письмо',entities:['L10','D20']}]}");
 assert.equal(d.run("dgCommunicationEvents(p,'D20').map(e=>e.id).join(',')"),'d,a,l,m');
 d.run("p.events[2].ts=54");assert.equal(d.run("dgCommunicationEvents(p,'D20').map(e=>e.id).join(',')"),'l,d,a,m');
 d.run("S.dgCommAsc=false");assert.equal(d.run("dgCommunicationEvents(p,'D20').map(e=>e.id).join(',')"),'l,d,a,m');
 d.run("S.dgCommEntities={D20:'L10'}");assert.equal(d.run("dgCommunicationEvents(p,'D20').map(e=>e.id).join(',')"),'l,d,a,m');
 assert.equal(d.run("p.events.length"),4);assert.equal(d.run("p.events[0].ts"),54);
});
test('communication reader separates typed bindings and only compresses display whitespace',()=>{
 const d=dashboard(),body='  Запрос   КП\r\n \n\n\n  Душевые\tперегородки  ';
 assert.equal(d.run('dgCommunicationText('+JSON.stringify(body)+')'),'Запрос КП\n\nДушевые перегородки');
 const event={id:'shared',ts:Date.parse('2026-10-20T08:33:54Z'),type:'Письмо',entities:['L10','D20'],title:'<Запрос>',body,who:'Клиент',dir:'входящее',origin:'crm'};
 d.run('dgCommCache.set("D20",'+JSON.stringify({events:[event]})+')');const h=d.run("dgCommunicationTable('D20')");
 assert.ok(h.includes('<th>Сущность</th>'));assert.ok(h.includes('<span>Лид 10</span><span>Сделка 20</span>'));assert.ok(h.includes('11:33:54'));assert.ok(h.includes('&lt;Запрос&gt;'));assert.ok(!h.includes('Вся цепочка'));assert.ok(!h.includes('data-dg-commentity'));assert.ok(!h.includes('Читать полностью'));
 assert.equal(d.run("dgCommCache.get('D20').events[0].body"),body);assert.ok(!/<a\b/i.test(h));
});
test('stock tooltip never labels an observed value with a future snapshot date',()=>{
 const d=dashboard();d.run("DATA.to='2026-10-27'");
 const tip=(from,to)=>d.run('dgKpiTooltip({k:"В работе сейчас"},"openM","money",'+JSON.stringify({from,to,previousFrom:'2026-09-26',previousTo:'2026-10-02'})+',"100 ₽","0 ₽","#22D3EE")');
 assert.ok(tip('2026-10-26','2026-11-01').includes('27.10.2026'));assert.ok(!tip('2026-10-26','2026-11-01').includes('01.11.2026'));
 assert.ok(tip('2026-11-02','2026-11-08').includes('Нет наблюдений'));assert.ok(tip('2026-10-12','2026-10-18').includes('18.10.2026'));
});

test('faceted exact multi-select filters agree with rows, counts and reason chart',()=>{
 const f=fixture();f.leads=Array.from({length:3},(_,i)=>({...f.leads[0],id:String(100+i),statusCode:'JUNK',status:'Некачественный лид',reason:i===2?'Нет услуги':'Дорого',mgr:i===1?'Второй':'Первый'}));f.deals[0].leadId='100';sync(f);f.calendar={version:1,deal:[],lead:f.leads.map((l,i)=>({id:String(i),key:'L'+l.id,at:Date.parse('2026-10-10T12:00:00+03:00'),code:'JUNK',semantic:'F'}))};const d=dashboard(f);
 d.run("S.dgLossFilters={reason:{values:['Дорого']},manager:{values:['Первый']}}");assert.equal(d.run('dgRefusalView().length'),1);assert.equal(d.run("dgLossOptions('reason').map(x=>x.join(':')).join('|')"),'Дорого:1|Нет услуги:1');assert.equal(d.run('dgRefusalGroups(dgRefusalView())[0].count'),1);
 d.run("S.dgLossFilters.reason={values:[]}");assert.equal(d.run('dgRefusalView().length'),0);d.run('S.dgLossFilters={}');assert.equal(d.run('dgRefusalView().length'),3);
 const h=d.run('dgRefusalBlock()'),body=h.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];assert.ok(!/<(?:a|button)\b/i.test(body));assert.ok(h.includes('data-dg-loss-filter="stage"'));
});
test('column date bounds are inclusive, reject missing dates, and calendars handle leap/year boundaries',()=>{
 const d=dashboard();assert.equal(d.run("dgLossMatches({raw:{created:'2026-10-14'},cells:{}},'created',{from:'2026-10-14',to:'2026-10-16'})"),true);assert.equal(d.run("dgLossMatches({raw:{created:'2026-10-16'},cells:{}},'created',{from:'2026-10-14',to:'2026-10-16'})"),true);assert.equal(d.run("dgLossMatches({raw:{created:'2026-10-17'},cells:{}},'created',{from:'2026-10-14',to:'2026-10-16'})"),false);assert.equal(d.run("dgLossMatches({raw:{},cells:{}},'created',{from:'2026-10-14',to:'2026-10-16'})"),false);
 assert.equal(d.run("dgLossShiftMonth('2026-12',1)"),'2027-01');assert.equal(d.run("dgLossShiftMonth('2026-01',-1)"),'2025-12');assert.equal((d.run("dgLossMonth('2028-02')").match(/data-dg-loss-day=/g)||[]).length,29);assert.equal((d.run("dgLossMonth('2026-02')").match(/data-dg-loss-day=/g)||[]).length,28);
});
test('inline communication retains the final text and escapes markup without changing the event',()=>{
 const d=dashboard(),event={id:'long',ts:Date.parse('2026-10-20T08:00:00Z'),title:'<Запрос>',body:'Начало\n\n'+('Подробности '.repeat(500))+'\n\nКОНЕЦ <script>bad()</script>',entities:['L10'],type:'Письмо'};d.run('globalThis.readerEvent='+JSON.stringify(event));d.run("dgCommCache.set('L10',{events:[readerEvent]})");const h=d.run("dgCommunicationTable('L10')");assert.ok(h.includes('КОНЕЦ &lt;script&gt;bad()&lt;/script&gt;'));assert.ok(h.includes('&lt;Запрос&gt;'));assert.ok(!h.includes('<script>'));assert.equal(d.run('readerEvent.body'),event.body);
});

test('incoming customer identity is only a role in all published payloads',()=>{
 const {dgCleanEvent}=require('./communications.cjs');for(const type of ['Письмо','Звонок','SMS','Мессенджер ОЛ','Сообщение WhatsApp']){const e={src:'a',ts:Date.parse('2026-10-20T08:00:00Z'),type,dir:'входящее',who:'PRIVATE CONTACT',body:'Запрос'};assert.equal(dgCleanEvent(e,['L10']).who,'Клиент');assert.equal(e.who,'PRIVATE CONTACT');assert.equal(dgCleanEvent({...e,dir:'исходящее',who:'Сотрудник'},['L10']).who,'Сотрудник');assert.equal(dgCleanEvent({...e,type:'Стадия',who:'CRM'},['L10']).who,'CRM');}
 const f=fixture();f.communications={version:1,generatedAt:f.generated_at,cache:{status:'available',generatedAt:f.generated_at},events:[{id:'act#role',ts:Date.parse('2026-10-20T08:00:00Z'),entities:['L10'],type:'Сообщение WhatsApp',dir:'входящее',who:'PRIVATE CONTACT',body:'Запрос'}]};const d=dashboard(f);assert.ok(d.data.communicationEvents.every(e=>e.who!=='PRIVATE CONTACT'));assert.ok(d.run("dgCommunicationTable('L10')").includes('Клиент'));
});

test('calendar switches between manager and direct record levels without changing populations',()=>{
 const d=dashboard();d.run("S.dgCalDealsOpen=true;S.dgCalExpanded.add('kp')");const before=d.run("dgCalendarRows(DG_CAL_ROWS.find(r=>r.id==='kp')).map(x=>x.key).join(',')");const managers=d.run('dgCalendarBlock()');assert.ok(managers.includes('dg-heat-manager'));assert.ok(managers.includes('data-dg-calview="deals"'));assert.ok(!managers.includes('data-dg-calamount'));
 d.run("S.dgCalView='deals'");const direct=d.run('dgCalendarBlock()');assert.ok(!direct.includes('dg-heat-manager'));assert.ok(!direct.includes('data-dg-calrecord='));assert.ok(direct.includes('<th>Ответственный</th>'));assert.ok(!direct.includes('Таблица ответственных'));assert.ok(!direct.includes('dg-comm-host'));assert.equal(d.run("dgCalendarRows(DG_CAL_ROWS.find(r=>r.id==='kp')).map(x=>x.key).join(',')"),before);
 d.run("S.dgCalRecords.add('D20')");const open=d.run('dgCalendarBlock()');assert.ok(!open.includes('dg-comm-host'));assert.ok(!open.includes('<th>Лента</th>'));assert.ok(!open.includes('data-dg-calrecord='));d.run("S.dgCalView='managers';S.dgCalRecords.clear()");assert.ok(d.run('dgCalendarBlock()').includes('dg-heat-manager'));
});

test('duplicate reference field distinguishes lead/deal targets without exposing CRM URLs',()=>{
 const {DG_DUPLICATE_FIELD:F,leadDuplicate,assertLeadDuplicateField}=require('./collect-widgets.cjs');assertLeadDuplicateField({[F]:{type:'string'}});assert.throws(()=>assertLeadDuplicateField({}));
 for(const [value,kind,id]of [['https://glassmemory.bitrix24.ru/crm/deal/details/900/','deal','900'],['/crm/lead/show/901/?x=1','lead','901'],['L_902','lead','902'],['D_903','deal','903']]){const r=leadDuplicate({[F]:value});assert.deepEqual(r,{duplicateRef:{kind,id},duplicateLinkState:'valid'});assert.ok(!JSON.stringify(r).includes('http'));}
 for(const value of ['https://evil.test/crm/deal/details/900/','https://glassmemory.bitrix24.ru.evil.test/crm/lead/details/900/','javascript:alert(1)','900',['/crm/lead/details/901/']])assert.equal(leadDuplicate({[F]:value}).duplicateLinkState,'unrecognized');assert.equal(leadDuplicate({[F]:''}).duplicateLinkState,'empty');assert.equal(leadDuplicate({}).duplicateLinkState,'unknown');
 const f=fixture();Object.assign(f.leads[0],{statusCode:'2',status:'Дубль',reason:'Дубль',...leadDuplicate({[F]:'/crm/deal/details/900/'})});f.calendar={version:1,lead:[{id:'1',key:'L10',at:Date.parse('2026-10-10T12:00:00+03:00'),code:'2',semantic:'F'}],deal:[]};const d=dashboard(f),r=d.run('dgRefusalView()[0]');assert.equal(r.cells.lead,'Сделка 900');assert.equal(r.cells.reason,'Дубль');assert.ok(!d.run('dgRefusalBlock()').includes('/crm/'));assert.equal(d.data.leads[0].duplicateRef.id,'900');
});

test('client-type sections and KPI snapshot footnote are absent from partner presentation',()=>{
 const f=fixture();f.deals[0].client='PRIVATE CLIENT TYPE';const d=dashboard(f),h=d.render();assert.ok(!h.includes('PRIVATE CLIENT TYPE'));assert.ok(!/[Тт]ип[ау]? клиента|по клиенту и изделию/.test(h));assert.ok(!d.run('dgDistributionBlock()').includes('data-dg-distribution="client"'));assert.ok(!d.run('dgRefusalBlock()').includes('data-dg-loss-filter="client"'));assert.equal(d.run('DG_LOSS_COLUMNS.length'),9);assert.ok(!d.run('dgKpiGraphFor({k:"В работе сейчас"})').includes('Оценка снимков; число выше'));assert.ok(d.run('dgKpiGraphFor({k:"В работе сейчас"})').includes('Остаток на указанную дату'));
});

test('empty refusal table spans all retained columns',()=>{const f=fixture();f.leads=[];f.deals=[];const d=dashboard(sync(f));const h=d.run('dgRefusalBlock()');assert.ok(h.includes('colspan="9"'));assert.ok(!h.includes('$'+'{DG_LOSS_COLUMNS.length}'));});

test('hidden communications cannot expand or initiate history loading',async()=>{const d=dashboard();d.run("S.dgCalRecords.add('L10');dgCommCache.clear()");const h=d.run('dgCalendarRecordTable(dgCalendarRows(DG_CAL_ROWS[0]),DG_CAL_ROWS[0])');assert.ok(!/data-dg-calrecord|dg-comm-host|Последняя коммуникация|<th>Лента/.test(h));await d.run("dgLoadCommunication('L10')");assert.equal(d.run('dgCommCache.size'),0);assert.ok(!d.run('dgCalendarBlock()').includes('→ коммуникации'));});

test('stage overview retains departed and repeated visits while date cells remain stock',()=>{const f=fixture();f.deals[0].hist=[['C49:NEW','2026-10-02'],['C49:PREPARATION','2026-10-03'],['C49:PREPAYMENT_INVOIC','2026-10-05'],['C49:PREPARATION','2026-10-12'],['C49:PREPAYMENT_INVOIC','2026-10-13']];const d=dashboard(f);d.run("S.start='2026-10-04';S.end='2026-10-14';S.gran='day';S.dgCalView='deals'");assert.equal(d.run("dgCalendarRows(DG_CAL_ROWS.find(r=>r.id==='wip')).length"),0);assert.equal(d.run("dgStockPeriodRows(DG_CAL_ROWS.find(r=>r.id==='wip')).length"),1);assert.equal(d.run("dgStockPeriodRows(DG_CAL_ROWS.find(r=>r.id==='wip'))[0].stockVisits.length"),2);assert.equal(d.run("dgStockPeriodRows(DG_CAL_ROWS.find(r=>r.id==='wip'))[0].stockActive"),false);const h=d.run("dgCalendarDetail(DG_CAL_ROWS.find(r=>r.id==='wip'),{row:'wip',bucket:null,stockView:'period'})");assert.ok(h.includes('dg-record-ghost'));assert.ok(h.includes('03.10.2026 — 05.10.2026'));assert.ok(h.includes('12.10.2026 — 13.10.2026'));assert.ok(h.includes('Были в периоде: 1'));assert.ok(!h.includes('dg-comm-host'));const point=d.run("dgCalendarDetail(DG_CAL_ROWS.find(r=>r.id==='wip'),{row:'wip',bucket:null,stockView:'point'})");assert.ok(point.includes('На эту дату открытых сделок на этапе нет'));assert.ok(!point.includes('dg-record-ghost'));d.run("S.start='2026-10-15';S.end='2026-10-16'");assert.equal(d.run("dgStockPeriodRows(DG_CAL_ROWS.find(r=>r.id==='wip')).length"),0);});
