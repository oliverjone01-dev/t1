import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {novemberPeriods,novemberGaugePeriods,periodWindow,periodProgress} from './november-periods.js';
import {novemberForecast,novemberForecastHtml,novemberForecastJs,novemberWeeklyData} from './november-forecast.js';
import {NOVEMBER_GROWTH,novemberGrowthHtml} from './november-growth.js';
import {novemberFinancePage} from './november-finance.js';
const weeks=novemberPeriods();
const days=Array.from({length:30},(_,i)=>'2026-11-'+String(i+1).padStart(2,'0'));
const input={today:'2026-11-03',last:'2026-11-02',covered:new Set(days),units:new Map([['2026-11-01',4],['2026-11-02',13]]),revenue:new Map([['2026-11-01',242964],['2026-11-02',1054457]])};
const source=readFileSync(new URL('./plan-tab/gauge.client.js',import.meta.url),'utf8');
describe('weekly plan',()=>{
 it('partitions exactly30 dates once and preserves monthly goals',()=>{
  const windows=weeks.flatMap(w=>periodWindow(w,'2026-12-01').days);
  expect(windows).toEqual(days);expect(new Set(windows).size).toBe(30);
  for(const goal of [450,30600000,500000])expect(weeks.reduce((sum,w)=>sum+goal*w.days/30,0)).toBeCloseTo(goal,6);
  expect(weeks.map(w=>w.days)).toEqual([7,7,7,7,2]);
 });
 it('uses17/30=56.7% for two closed days, not17/450 or17/105',()=>{
  const D=novemberWeeklyData(novemberForecast(NOVEMBER_GROWTH,input)!);
  expect(D.selected).toBe(0);expect(D.periods[0]!.units).toMatchObject({fact:17,goal:105,planToDate:30,elapsed:2});
  expect(D.periods[0]!.units.ratio).toBeCloseTo(56.6666667);
  expect(D.periods[0]!.revenue.ratio).toBeCloseTo(1297421/2040000*100);
 });
 it('has no score on the first day, includes exactly7 dates after closure, and caps December',()=>{
  const values=Object.fromEntries(days.map(d=>[d,15]));
  expect(periodProgress(weeks[1]!,'2026-11-08',values,450)).toMatchObject({elapsed:0,fact:null,ratio:null});
  expect(periodProgress(weeks[0]!,'2026-11-08',values,450)).toMatchObject({elapsed:7,fact:105,ratio:100});
  expect(periodProgress(weeks[4]!,'2026-12-10',values,450)).toMatchObject({elapsed:2,fact:30,goal:30,ratio:100});
 });
 it('treats missing or stale closed dates as unknown, while a genuine zero is zero',()=>{
  expect(periodProgress(weeks[0]!,'2026-11-03',{'2026-11-01':15},450)).toMatchObject({fact:null,ratio:null,missing:['2026-11-02']});
  expect(periodProgress(weeks[0]!,'2026-11-03',{'2026-11-01':0,'2026-11-02':0},450)).toMatchObject({fact:0,ratio:0});
  const f=novemberForecast(NOVEMBER_GROWTH,{...input,today:'2026-11-09',last:'2026-11-08',covered:new Set(['2026-11-08']),units:new Map([['2026-11-08',15]])})!;
  expect(f.units).toBeNull();expect(novemberWeeklyData(f).periods[1]!.units).toMatchObject({fact:15,ratio:100});
 });
 it('allows losses and overachievement without converting either into zero',()=>{
  expect(periodProgress(weeks[0]!,'2026-11-03',{'2026-11-01':-50000,'2026-11-02':-24817},500000).ratio).toBeLessThan(0);
  expect(periodProgress(weeks[0]!,'2026-11-03',{'2026-11-01':60,'2026-11-02':0},450).ratio).toBe(200);
 });
 it('renders capped ad spend and safely receives same-origin finance from the bound frame',()=>{
  const f=novemberForecast(NOVEMBER_GROWTH,input)!,errors:string[]=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e)));
  const dom=new JSDOM(novemberForecastHtml(f,'<!-- NOVEMBER_STORE --><iframe id="november-finance-frame"></iframe>')+'<script>'+source+novemberForecastJs(f,{'2026-11-01':50000,'2026-11-02':68998})+'</script>',{runScripts:'dangerously',url:'https://dashboard.example/katya-tests.html',virtualConsole:vc,beforeParse(w){w.Date.now=()=>Date.parse(input.today+'T09:00:00Z')}});
  const w=dom.window,doc=w.document,frame=doc.querySelector('iframe')!;
  expect(doc.querySelector('#nf-dial-units .gauge')!.getAttribute('data-pct')).toBe(String(17/30*100));
  expect(doc.querySelector('[data-metric=ads]')!.getAttribute('data-fact')).toBe('118998');
  expect(doc.querySelector('#nf-dial-ads .gv')!.textContent).toContain('9,17% ДРР');
  expect(doc.querySelector('#nf-dial-ads .gauge')!.getAttribute('data-st')).toBe('#34D399');
  const periods=novemberGaugePeriods().map(p=>periodProgress(p,input.today,{'2026-11-01':-50000,'2026-11-02':-24817},500000));
  const msg={type:'ozon-november-weekly-finance',today:input.today,periods};
  const send=(data:unknown,source:unknown=frame.contentWindow,origin='https://dashboard.example')=>w.dispatchEvent(new w.MessageEvent('message',{data,source:source as any,origin}));
  send(msg,w);send(msg,frame.contentWindow,'https://wrong.example');send({...msg,today:'2026-11-02'});
  expect(doc.querySelector('#nf-dial-net .gauge')).toBeNull();
  send({...msg,periods:periods.map(p=>({...p,goal:999}))});expect(doc.querySelector('#nf-dial-net .gauge')).toBeNull();
  send({...msg,periods:periods.map((p,i)=>i===0?{...p,fact:null,ratio:0,missing:[]}:p)});expect(doc.querySelector('#nf-dial-net .gauge')).toBeNull();
  send(msg);expect(doc.querySelector('[data-metric=net]')!.getAttribute('data-fact')).toBe('-74817');
  expect(Number(doc.querySelector('#nf-dial-net .gauge')!.getAttribute('data-pct'))).toBeLessThan(0);
  (doc.querySelector('[data-nov-week="1"]') as HTMLButtonElement).click();
  expect(doc.querySelector('[data-nov-week="1"]')!.hasAttribute('hidden')).toBe(false);
  expect(doc.querySelector('[data-metric=units]')!.getAttribute('data-fact')).toBe('');
  expect(doc.querySelector('[data-metric=net]')!.getAttribute('data-fact')).toBe('');
  expect(doc.querySelector('#november-week-state')!.textContent).toContain('08-14.11');
  (doc.querySelector('[data-nov-week="5"]') as HTMLButtonElement).click();
  expect(doc.querySelector('[data-metric=net]')!.getAttribute('data-fact')).toBe('-74817');
  expect(doc.querySelector('[data-metric=units]')!.getAttribute('data-fact')).toBe('17');
  expect(doc.querySelector('#nf-dial-units')!.textContent).toContain('Цель всего месяца: 450');
  expect(Number(doc.querySelector('#nf-dial-units .gauge')!.getAttribute('data-pct'))).toBeCloseTo(17/450*100);
  expect(errors).toEqual([]);dom.window.close();
 });
 it('rolls the selected week at Moscow midnight even if the HTML build is older',()=>{
  const f=novemberForecast(NOVEMBER_GROWTH,{...input,today:'2026-11-07',last:'2026-11-06'})!;
  const dom=new JSDOM(novemberForecastHtml(f)+'<script>'+source+novemberForecastJs(f)+'</script>',{runScripts:'dangerously',url:'https://dashboard.example/',beforeParse(w){w.Date.now=()=>Date.parse('2026-11-07T21:00:00Z')}});
  expect(dom.window.document.querySelector('[data-nov-week="1"]')!.getAttribute('aria-pressed')).toBe('true');
  expect(dom.window.document.querySelector('[data-nov-week="1"]')!.hasAttribute('hidden')).toBe(false);
  expect(dom.window.document.querySelector('[data-nov-week="2"]')!.hasAttribute('hidden')).toBe(false);
  expect(dom.window.document.querySelector('[data-metric=units]')!.hasAttribute('hidden')).toBe(true);
  expect(dom.window.document.querySelector('[data-metric=units]')!.getAttribute('data-fact')).toBe('');
  expect(dom.window.document.querySelector('#nf-note-units')!.textContent).toContain('Закрытых дней');dom.window.close();
 });
 it('computes each finance window directly and does not subtract monthly cumulative profit',()=>{
  const core=`const AN_MAXD='2026-11-30',AN_RD_FROM='2026-11-01',AN_RD_TO='2026-11-30',AN_RD_MISS=['2026-11-01'],AN_VED_MAXD='2026-11-30';window.calls=[];function skuAnalyticsData(p){window.calls.push(p);return {grand:{amt:100,tbEst:0,start:p.from},miss:[]}}function anDerive(g){return {net:g.start==='2026-11-08'?-1234:999,rent:null}}`;
  const dom=new JSDOM(novemberFinancePage(core,'2026-11-30',days,'test'),{runScripts:'dangerously'});
  (dom.window as any).renderNovemberFinance(Date.parse('2026-11-10T00:00:00Z'));
  const payload=(dom.window as any).NOVEMBER_FINANCE_WEEKLY;
  expect(payload.periods[0].fact).toBeNull();expect(payload.periods[1].fact).toBe(-1234);
  expect((dom.window as any).calls).toContainEqual({from:'2026-11-08',to:'2026-11-09'});
  expect(payload.periods[1].elapsed).toBe(2);expect(payload.periods[2].fact).toBeNull();dom.window.close();
 });
});

it('keeps a missing past-day warning when empty gauges are hidden, but displays genuine zeros',()=>{
 const f=novemberForecast(NOVEMBER_GROWTH,{...input,today:'2026-11-03',covered:new Set(['2026-11-01']),units:new Map([['2026-11-01',0]])})!;
 const dom=new JSDOM(novemberForecastHtml(f)+'<script>'+source+novemberForecastJs(f,{'2026-11-01':0,'2026-11-02':0})+'</script>',{runScripts:'dangerously'}),doc=dom.window.document;
 expect(doc.querySelector('[data-metric=units]')!.hasAttribute('hidden')).toBe(true);
 expect(doc.querySelector('#november-week-issues')!.textContent).toContain('02.11');
 expect(doc.querySelector('[data-metric=ads]')!.hasAttribute('hidden')).toBe(false);
 expect(doc.querySelector('[data-metric=ads]')!.getAttribute('data-fact')).toBe('0');dom.window.close();
});

it('keeps source-gap and finance-failure warnings independent through timeout and week selection',()=>{
 const f=novemberForecast(NOVEMBER_GROWTH,{...input,covered:new Set(['2026-11-01'])})!;let timeout:()=>void=()=>{};
 const dom=new JSDOM(novemberForecastHtml(f,'<!-- NOVEMBER_STORE --><iframe id="november-finance-frame"></iframe>')+'<script>'+source+novemberForecastJs(f)+'</script>',{runScripts:'dangerously',url:'https://dashboard.example/',beforeParse(w){w.Date.now=()=>Date.parse('2026-11-03T09:00:00Z');w.setTimeout=((fn:any)=>{timeout=fn;return 1}) as any;}}),doc=dom.window.document;
 timeout();expect(doc.querySelector('#november-week-issues')!.textContent).toContain('02.11');expect(doc.querySelector('#november-finance-issue')!.textContent).toContain('не загрузился');
 (doc.querySelector('[data-nov-week="0"]') as HTMLButtonElement).click();
 expect(doc.querySelector('#november-week-issues')!.textContent).toContain('02.11');expect(doc.querySelector('#november-finance-issue')!.textContent).toContain('не загрузился');
 doc.querySelector('iframe')!.dispatchEvent(new dom.window.Event('error'));expect(doc.querySelector('#november-week-issues')!.textContent).toContain('02.11');expect(doc.querySelector('#november-finance-issue')!.textContent).toContain('недоступен');dom.window.close();
});

it('updates stage calendar labels when opening an older build on a later Moscow date',()=>{
 const f=novemberForecast(NOVEMBER_GROWTH,{...input,today:'2026-11-05'})!;
 for(const [now,visible] of [['2026-11-07',4],['2026-12-01',7]] as const){
  const errors:string[]=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e)));
  const dom=new JSDOM(novemberForecastHtml(f,'<!-- NOVEMBER_STORE -->'+novemberGrowthHtml('2026-11-05',null))+'<script>'+source+novemberForecastJs(f)+'</script>',{runScripts:'dangerously',url:'https://dashboard.example/',beforeParse(w){w.Date.now=()=>Date.parse(now+'T09:00:00Z')},virtualConsole:vc}),doc=dom.window.document;
  expect(doc.querySelectorAll('[data-nov-stage-end]:not([hidden])')).toHaveLength(visible);
  expect(doc.querySelector('[data-nov-stage-end="2026-11-05"] .nov-stage-date')!.textContent).toBe('Срок прошёл');
  expect(doc.querySelector('[data-nov-stage-end="2026-11-19"] .nov-stage-date')!.textContent).toBe(now==='2026-12-01'?'Срок прошёл':'Окно по плану');
  expect(doc.querySelector('#november-stages')!.textContent).toContain('Выполнение не подтверждено');expect(errors).toEqual([]);dom.window.close();
 }
});

it('integer unit windows sum to the month including short final week',async()=>{
 const {unitPlan}=await import('./november-periods.js');
 for(const goal of [1,17,25,31,57,450]){
  const parts=novemberPeriods().map(w=>unitPlan(goal,Number(w.from.slice(8)),Number(w.to.slice(8))));
  expect(parts.every(Number.isInteger)).toBe(true);expect(parts.reduce((a,b)=>a+b,0)).toBe(goal);
  expect(unitPlan(goal,1,4)).toBe(Math.round(goal*4/30));expect(unitPlan(goal,8,7)).toBe(0);
 }
});

it('weekly unit progress uses integer targets and aligned verdicts',()=>{
 const p=novemberPeriods()[0]!,values={'2026-11-01':1};
 const x=periodProgress(p,'2026-11-02',values,25,true);
 expect(x.planToDate).toBe(1);expect(x.ratio).toBe(100);expect(x.goal).toBe(6);
 expect(novemberPeriods().map(p=>periodProgress(p,'2026-12-01',{},25,true).goal!).reduce((a,b)=>a+b,0)).toBe(25);
});

it('month mode aggregates all closed November days without double counting weeks',()=>{
 const dates=days.slice(0,9),f=novemberForecast(NOVEMBER_GROWTH,{today:'2026-11-10',last:'2026-11-09',covered:new Set(dates),units:new Map(dates.map(d=>[d,15])),revenue:new Map(dates.map(d=>[d,1020000]))})!;
 const ads=Object.fromEntries(dates.map(d=>[d,100])),data=novemberWeeklyData(f,ads);
 expect(data.periods).toHaveLength(6);expect(data.periods[5]!.units).toMatchObject({fact:135,goal:450,planToDate:135,ratio:100});expect(data.periods[5]!.ads.fact).toBe(900);
 const dom=new JSDOM(novemberForecastHtml(f)+'<script>'+source+novemberForecastJs(f,ads)+'</script>',{runScripts:'dangerously'}),d=dom.window.document;
 expect(d.querySelectorAll('[data-nov-week]:not([hidden])')).toHaveLength(6);
 (d.querySelector('[data-nov-week="0"]') as HTMLElement).click();expect(d.querySelector('[data-metric=units]')!.getAttribute('data-fact')).toBe('105');
 (d.querySelector('[data-nov-week="1"]') as HTMLElement).click();expect(d.querySelector('[data-metric=units]')!.getAttribute('data-fact')).toBe('30');
 (d.querySelector('[data-nov-week="5"]') as HTMLElement).click();expect(d.querySelector('[data-metric=units]')!.getAttribute('data-fact')).toBe('135');expect(d.querySelector('#nf-dial-units')!.textContent).toContain('Цель всего месяца: 450');expect(d.querySelector('#november-week-state')!.textContent).toContain('Весь ноябрь');expect(Number(d.querySelector('#nf-dial-units .gauge')!.getAttribute('data-pct'))).toBe(30);expect(d.querySelector('#nf-dial-units .gauge')!.getAttribute('data-st')).toBe('#34D399');dom.window.close();
});
it('month profit is computed directly for the whole window and missing days stay unknown',()=>{
 const core=`const AN_MAXD='2026-11-30',AN_RD_FROM='2026-11-01',AN_RD_TO='2026-11-30',AN_RD_MISS=[],AN_VED_MAXD='2026-11-30';function skuAnalyticsData(p){return {grand:{amt:100,tbEst:0,n:Number(p.to.slice(8))-Number(p.from.slice(8))+1},miss:[]}}function anDerive(g){return {net:g.n*g.n,rent:null}}`;
 const dom=new JSDOM(novemberFinancePage(core,'2026-11-30',days,'test'),{runScripts:'dangerously'}),w=dom.window as any;
 w.renderNovemberFinance(Date.parse('2026-11-10T00:00:00Z'));const p=w.NOVEMBER_FINANCE_WEEKLY.periods;
 expect(p).toHaveLength(6);expect(p[0].fact).toBe(49);expect(p[1].fact).toBe(4);expect(p[5]).toMatchObject({fact:81,goal:500000,planToDate:150000});expect(p[5].fact).not.toBe(p[0].fact+p[1].fact);dom.window.close();
 const missing=new JSDOM(novemberFinancePage(core,'2026-11-30',days.filter(d=>d!=='2026-11-01'),'test'),{runScripts:'dangerously'}),m=missing.window as any;m.renderNovemberFinance(Date.parse('2026-11-10T00:00:00Z'));expect(m.NOVEMBER_FINANCE_WEEKLY.periods[5].fact).toBeNull();expect(m.NOVEMBER_FINANCE_WEEKLY.periods[1].fact).toBe(4);missing.window.close();
});

it('DRR cap follows actual same-period turnover, including month, zero and missing revenue',()=>{
 for(const [revenue,spend,status] of [[100000,10000,'within'],[100000,10000.01,'exceeded'],[0,100,'exceeded'],[0,0,'within'],[null,100,'unknown']] as const){
  const f=novemberForecast(NOVEMBER_GROWTH,{...input,today:'2026-11-02',last:'2026-11-01',covered:new Set(['2026-11-01']),revenue:new Map(revenue===null?[]:[['2026-11-01',revenue]])})!;
  // A missing order day must stay missing, not become zero.
  if(revenue===null)f.points[0]!.dailyRevenue=null;
  const dom=new JSDOM(novemberForecastHtml(f)+'<script>'+source+novemberForecastJs(f,{'2026-11-01':spend})+'</script>',{runScripts:'dangerously'}),d=dom.window.document;
  for(const mode of ['0','5']){
   (d.querySelector('[data-nov-week="'+mode+'"]') as HTMLElement).click();
   const card=d.querySelector('[data-metric=ads]')!;
   expect(card.getAttribute('data-status')).toBe(status);expect(card.hasAttribute('hidden')).toBe(false);
   expect(card.getAttribute('data-target')).toBe(revenue===null?'':String(revenue/10));
   const gauge=d.querySelector('#nf-dial-ads .gauge')!;
   expect(gauge.getAttribute('data-st')).toBe(status==='unknown'?'':status==='exceeded'?'#FF7A7E':'#34D399');
   if(revenue===100000){expect(gauge.getAttribute('data-zone')).toBe(status==='exceeded'?'#FF7A7E':'#34D399');}
   if(revenue===null||revenue===0)expect(d.querySelector('#nf-dial-ads .gv')!.textContent).toBe('ДРР —');
  }
  (d.querySelector('[data-nov-week="1"]') as HTMLElement).click();expect(d.querySelector('[data-metric=ads]')!.hasAttribute('hidden')).toBe(true);
  dom.window.close();
 }
});
