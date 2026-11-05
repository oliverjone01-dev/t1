import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {novemberPeriods,periodWindow,periodProgress} from './november-periods.js';
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
 it('renders neutral ad spend and safely receives same-origin finance from the bound frame',()=>{
  const f=novemberForecast(NOVEMBER_GROWTH,input)!,errors:string[]=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e)));
  const dom=new JSDOM(novemberForecastHtml(f,'<!-- NOVEMBER_STORE --><iframe id="november-finance-frame"></iframe>')+'<script>'+source+novemberForecastJs(f,{'2026-11-01':50000,'2026-11-02':68998})+'</script>',{runScripts:'dangerously',url:'https://dashboard.example/katya-tests.html',virtualConsole:vc,beforeParse(w){w.Date.now=()=>Date.parse(input.today+'T09:00:00Z')}});
  const w=dom.window,doc=w.document,frame=doc.querySelector('iframe')!;
  expect(doc.querySelector('#nf-dial-units .gauge')!.getAttribute('data-pct')).toBe(String(17/30*100));
  expect(doc.querySelector('[data-metric=ads]')!.getAttribute('data-fact')).toBe('118998');
  expect(doc.querySelector('#nf-dial-ads .gv')!.textContent).toBe('факт');
  expect(doc.querySelector('#nf-dial-ads .gauge')!.getAttribute('data-st')).toBe('');
  const periods=weeks.map(p=>periodProgress(p,input.today,{'2026-11-01':-50000,'2026-11-02':-24817},500000));
  const msg={type:'ozon-november-weekly-finance',today:input.today,periods};
  const send=(data:unknown,source:unknown=frame.contentWindow,origin='https://dashboard.example')=>w.dispatchEvent(new w.MessageEvent('message',{data,source:source as any,origin}));
  send(msg,w);send(msg,frame.contentWindow,'https://wrong.example');send({...msg,today:'2026-11-02'});
  expect(doc.querySelector('#nf-dial-net .gauge')).toBeNull();
  send({...msg,periods:periods.map(p=>({...p,goal:999}))});expect(doc.querySelector('#nf-dial-net .gauge')).toBeNull();
  send({...msg,periods:periods.map((p,i)=>i===0?{...p,fact:null,ratio:0,missing:[]}:p)});expect(doc.querySelector('#nf-dial-net .gauge')).toBeNull();
  send(msg);expect(doc.querySelector('[data-metric=net]')!.getAttribute('data-fact')).toBe('-74817');
  expect(Number(doc.querySelector('#nf-dial-net .gauge')!.getAttribute('data-pct'))).toBeLessThan(0);
  (doc.querySelector('[data-nov-week="1"]') as HTMLButtonElement).click();
  expect(doc.querySelector('[data-nov-week="1"]')!.hasAttribute('hidden')).toBe(true);
  expect(doc.querySelector('[data-metric=units]')!.getAttribute('data-fact')).toBe('17');
  expect(doc.querySelector('[data-metric=net]')!.getAttribute('data-fact')).toBe('-74817');
  expect(doc.querySelector('#november-week-state')!.textContent).toContain('01-07.11');
  expect(errors).toEqual([]);dom.window.close();
 });
 it('rolls the selected week at Moscow midnight even if the HTML build is older',()=>{
  const f=novemberForecast(NOVEMBER_GROWTH,{...input,today:'2026-11-07',last:'2026-11-06'})!;
  const dom=new JSDOM(novemberForecastHtml(f)+'<script>'+source+novemberForecastJs(f)+'</script>',{runScripts:'dangerously',url:'https://dashboard.example/',beforeParse(w){w.Date.now=()=>Date.parse('2026-11-07T21:00:00Z')}});
  expect(dom.window.document.querySelector('[data-nov-week="1"]')!.getAttribute('aria-pressed')).toBe('true');
  expect(dom.window.document.querySelector('[data-nov-week="1"]')!.hasAttribute('hidden')).toBe(false);
  expect(dom.window.document.querySelector('[data-nov-week="2"]')!.hasAttribute('hidden')).toBe(true);
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
