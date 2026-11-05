import {describe,it,expect} from 'vitest';
import {novemberDetails,novemberWeeks,observedTotal,metricValue,type NovemberInput} from './november-details.js';
import {JSDOM,VirtualConsole} from 'jsdom';

function fixture():NovemberInput {
  const days=['2026-10-31','2026-11-01','2026-11-02','2026-12-01'];
  const series=(orders:number[])=>Object.fromEntries(['views','vsearch','pdp','cart','units','orders','pos','sp','clk','acart'].map(k=>[k,k==='orders'?orders:k==='pos'?[8,7,6,5]:[10,10,10,10]]));
  const card={short:'<Альфа>',main_art:'A',main_sku:'1',skus:['1','2'],min_skus:['2']};
  const plan={cards:[card],to_min:[{cid:'77',art:'A'}],price:[{art:'A',name:'<test>'}]} as any;
  return {today:'2026-11-02',days,plan,cards:[card],ser:[series([9,2,99,999])],store:series([10,3,100,1000]),orderLast:'2026-11-02',orderCovered:new Set(days),
    orders:[{d:'2026-10-31',sku:'1',offer:'A',units:9},{d:'2026-11-01',sku:'1',offer:'A',units:2},{d:'2026-11-01',sku:'9',offer:'Z',units:1},{d:'2026-11-01',sku:'1',offer:'A',units:90,status:'cancelled'},{d:'2026-11-02',sku:'1',units:99}],
    views:days.flatMap(date=>['1','2','9'].map(sku=>({date,sku,views:10,vsearch:10,pdp:10,cart:10,units:10}))),
    adsLast:'2026-11-02',adsFull:'2026-11-02',ads:[{d:'2026-11-01',id:'77',sp:20,cl:4,ca:1},{d:'2026-11-01',id:'88',sp:30,cl:6,ca:2},{d:'2026-11-01',id:'28753239',sp:100,cl:0}],
    adsSku:[{d:'2026-11-01',cid:'77',sku:'1',sp:8,ca:1},{d:'2026-11-01',cid:'77',sku:'2',sp:12,ca:0},{d:'2026-11-01',cid:'88',sku:'1',sp:10,ca:1},{d:'2026-11-01',cid:'88',sku:'2',sp:15,ca:1},{d:'2026-11-01',cid:'88',sku:'9',sp:5,ca:0},{d:'2026-11-01',cid:'28753239',sku:'1',sp:100}],
    prices:[{d:'2026-10-31',offer:'A',price:100},{d:'2026-11-01',offer:'A',price:90},{d:'2026-11-02',offer:'A',price:80},{d:'2026-12-01',offer:'A',price:10}],gaps:[{date:'2026-10-28',art:'A',gap_pct:40}],partial:null};
}
const point=(r:NonNullable<ReturnType<typeof novemberDetails>>,d:string)=>r.data.days.indexOf(d);
describe('November detailed blocks',()=>{
  it('has orders, selectable funnel, weekly ads, prices and a link to the store goal',()=>{
    const r=novemberDetails(fixture())!;
    for(const id of ['november-orders','november-funnel','november-ads','november-prices'])expect(r.html).toContain('id="'+id+'"');
    expect(r.html).toContain('<!-- NOVEMBER_STORE -->');expect(r.html).toContain('&lt;Альфа&gt;');expect(r.html).not.toContain('<test>');
    expect(r.html).toContain('Порог ноября');expect(r.html).toContain('Не задан');expect(r.html).not.toContain('20000');
    expect(r.js).not.toContain('</script');
  });
  it('keeps October, today and December out of November orders',()=>{
    const r=novemberDetails(fixture())!,i=point(r,'2026-11-01');
    expect(r.data.series[0]!.s.orders![i]).toBe(2);expect(r.data.series.at(-1)!.s.orders![i]).toBe(3);
    expect(r.data.series[0]!.s.orders![point(r,'2026-11-02')]).toBeNull();expect(r.data.days).not.toContain('2026-12-01');
    expect(r.html).toContain('2 шт.');expect(r.html).not.toContain('90 шт.');
  });
  it('uses mutually exclusive ad groups and separates CPO',()=>{
    const r=novemberDetails(fixture())!,i=point(r,'2026-11-01');
    expect(r.data.series[0]!.s.sp![i]).toBe(45);expect(r.data.series.at(-1)!.s.sp![i]).toBe(50);
    // Cardinal click estimate: 20/20*4 + 25/30*6 = 9; store directly has10.
    expect(r.data.series[0]!.s.clk![i]).toBe(9);expect(r.data.series.at(-1)!.s.clk![i]).toBe(10);
    expect(r.data.adsTotal['2026-11-01']).toBe(150);expect(r.data.adsTotal['2026-11-02']).toBeNull();expect(r.html).toContain('100 ₽');expect(r.html).toContain('Группы ниже взаимоисключающие');
    // Unique partition main10 + minimum15 + specified campaign20 + other5 =50.
    expect(r.html).toContain('Остаток до суммы отчёта по товарам');
  });
  it('visible money rows preserve cents and sum to the SKU CPC report',()=>{
    const f=fixture();f.adsSku[0]!.sp=8.49;f.adsSku[2]!.sp=10.32;const r=novemberDetails(f)!;
    const dom=new JSDOM(r.html),sum=[...dom.window.document.querySelectorAll('.nd-ad-total')].reduce((n,e)=>n+Number(e.textContent!.replace(/\s/g,'').replace(',','.')),0);
    expect(sum).toBeCloseTo(50.81,2);expect(r.html).toContain('10,32');dom.window.close();
  });
  it('leaves incomplete ad reports null while campaign totals stay available',()=>{
    const f=fixture();f.adsFull='2026-10-31';const r=novemberDetails(f)!,i=point(r,'2026-11-01');
    expect(r.data.series[0]!.s.sp![i]).toBeNull();expect(r.data.series.at(-1)!.s.sp![i]).toBe(50);expect(r.html).toContain('Ноябрь ещё не собран');
  });
  it('checks individual accepted ad days rather than using a November cutoff for October',()=>{
    const f=fixture();f.adsCovered=new Set(['2026-11-01']);f.ads.push({d:'2026-10-31',id:'88',sp:50,cl:5});
    f.adsSku.push({d:'2026-10-31',cid:'88',sku:'1',sp:1,ca:0});const r=novemberDetails(f)!;
    expect(r.data.series[0]!.s.sp![point(r,'2026-10-31')]).toBeNull();expect(r.data.series[0]!.s.sp![point(r,'2026-11-01')]).toBe(45);
  });
  it('never turns missing daily coverage or missing card SKU into zero',()=>{
    const f=fixture();f.orderCovered.delete('2026-11-01');f.views=f.views.filter(r=>!(r.date==='2026-11-01'&&r.sku==='2'));
    const r=novemberDetails(f)!,i=point(r,'2026-11-01');expect(r.data.series[0]!.s.orders![i]).toBeNull();expect(r.data.series[0]!.s.pdp![i]).toBeNull();expect(r.data.series[0]!.coverage[i]).toBe(1);
    const zero=fixture();zero.orders=[];zero.ser[0]!.orders=[0,0,0,0];zero.store.orders=[0,0,0,0];
    expect(novemberDetails(zero)!.data.series[0]!.s.orders![i]).toBe(0);
  });
  it('shows current prices, November changes and stale October discount with its date',()=>{
    const r=novemberDetails(fixture())!,p=r.data.prices[0]!;expect(p.current).toEqual({day:'2026-11-02',value:80});expect(p.base?.value).toBe(100);
    expect(p.changes.map(r=>r.value)).toEqual([90,80]);expect(p.gap?.day).toBe('2026-10-28');expect(r.html).toContain('старый срез');expect(r.html).toContain('Цель ноября');
  });
  it('rejects duplicate spend keys and mismatched order totals',()=>{
    const f=fixture();f.adsSku.push({...f.adsSku[0]});expect(()=>novemberDetails(f)).toThrow('Duplicate advertising');
    const g=fixture();g.ads.push({...g.ads[0]});expect(()=>novemberDetails(g)).toThrow('Duplicate campaign');
    const h=fixture();h.ser[0]!.orders![1]=4;expect(()=>novemberDetails(h)).toThrow('article orders differ');
  });
  it('keeps closed November in December and is inactive in October',()=>{
    expect(novemberDetails({...fixture(),today:'2026-10-31'})).toBeNull();const f=fixture();f.today='2026-12-02';
    f.orderCovered.delete('2026-11-02');const r=novemberDetails(f)!;expect(r.data.closedEnd).toBe('2026-11-30');expect(r.data.prices[0]!.current?.value).toBe(80);
  });
  it('clips Thursday-Wednesday weeks to November, exactly30 distinct dates',()=>{
    const w=novemberWeeks();expect(w[0]).toEqual(['01-07.11','2026-11-01','2026-11-07']);expect(w.at(-1)).toEqual(['29-30.11','2026-11-29','2026-11-30']);
    expect(w.reduce((n,[,a,b])=>n+(Date.parse(b!)-Date.parse(a!))/864e5+1,0)).toBe(30);
  });
  it('ratios use sums of the same observed days; no zero denominators or gap substitution',()=>{
    expect(metricValue({pdp:[5,3],views:[10,30]},'ctr',[0,1])).toBe(20);expect(metricValue({pdp:[5,null],views:[10,30]},'ctr',[0,1])).toBeNull();
    expect(metricValue({pdp:[0],views:[0]},'ctr',[0])).toBeNull();expect(observedTotal([])).toBeNull();expect(observedTotal([0,0])).toBe(0);
  });
  it('uses the shared ordinary median, including two central values, in server and browser',()=>{
    expect(metricValue({pos:[10,30]},'pos',[0,1])).toBe(20);
    const f=fixture();f.today='2026-11-03';f.store.orders![2]=99;const r=novemberDetails(f)!;
    const dom=new JSDOM('<html><body>'+r.html+'<script>'+r.js+'</script></body></html>',{runScripts:'dangerously'});
    const rows=[...dom.window.document.querySelectorAll('#nd-funnel-table tbody tr')];
    expect(rows.find(r=>r.firstElementChild?.textContent==='Позиция в поиске')!.children[2]!.textContent).toBe('6,5');dom.window.close();
  });
  it('executes every funnel selector, lazy order/price charts and the separate partial point',()=>{
    const f=fixture();f.partial={day:'2026-11-02',cards:[{views:20,vsearch:10,pdp:5,cart:1,units:1,pos:4,have:1,want:2}],all:{views:20,have:1,want:2},store:{views:20,have:1}};
    const r=novemberDetails(f)!,errors:string[]=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
    const dom=new JSDOM('<html><body>'+r.html+'<script>'+r.js+'</script></body></html>',{runScripts:'dangerously',virtualConsole:vc});
    const doc=dom.window.document;
    expect(doc.querySelector('#nd-funnel-chart')!.textContent).toContain('Неполный 02.11 · 1/2 SKU, вне итогов');
    expect(doc.querySelectorAll('#nd-funnel-chart circle[data-partial-day]')).toHaveLength(1);
    for(const id of ['nd-cards','nd-metrics'])for(let i=0;i<doc.querySelectorAll('#'+id+' button').length;i++)(doc.querySelectorAll('#'+id+' button')[i] as any).click();
    (doc.querySelector('#nd-metrics button') as any).click();expect(doc.querySelector('#nd-funnel-chart h3')!.textContent).toContain('Магазин');
    const order=doc.querySelector('.nd-order-toggle') as any;order.click();expect(order.getAttribute('aria-expanded')).toBe('true');expect((doc.querySelector('.nd-order-detail') as any).hidden).toBe(false);expect(doc.querySelector('.nd-order-detail svg')).not.toBeNull();order.click();expect((doc.querySelector('.nd-order-detail') as any).hidden).toBe(true);
    for(const cls of ['nd-price']){const el=doc.querySelector('.'+cls) as any;el.open=true;el.dispatchEvent(new dom.window.Event('toggle'));expect(el.querySelector('svg')).not.toBeNull();}
    expect(doc.querySelectorAll('.nd-order-chart circle')).toHaveLength(1);expect(doc.querySelectorAll('.nd-price-chart circle')).toHaveLength(2);
    expect(errors).toEqual([]);dom.window.close();
  });
});

describe('October design reused for November',()=>{
  it('groups November models, keeps month thresholds unset and opens SKU details',()=>{
    const f=fixture();f.taxonomy={'1':{model:'TRUBIS Wood Oval 160'}};
    const r=novemberDetails(f)!;const dom=new JSDOM('<body>'+r.html+'<script>'+r.js+'</script>',{runScripts:'dangerously'}),doc=dom.window.document;
    expect(doc.querySelectorAll('#november-orders thead th')).toHaveLength(7);
    expect(doc.querySelectorAll('#november-funnel .grp th[colspan="3"]')).toHaveLength(4);
    expect(doc.querySelector('#nd-ob0-button-0')!.textContent).toContain('TRUBIS Wood Oval 160');
    (doc.querySelector('#nd-ob0-button-0') as any).click();expect(doc.querySelector('#nd-ob0-sku-0')!.hasAttribute('hidden')).toBe(false);
    expect(r.data.orderSummary[0]!.goal).toBeNull();expect(r.data.orderSummary.at(-1)!.goal).toBe(450);
    (doc.querySelector('.nd-order-toggle') as any).click();
    expect(doc.querySelector('.nd-order-chart svg')!.getAttribute('viewBox')).toBe('0 0 900 200');
    expect(doc.querySelector('.nd-order-chart svg')!.outerHTML).not.toContain('NaN');dom.window.close();
  });
  it('does not resume a cumulative November line after a missing day',()=>{
    const f=fixture();f.today='2026-11-04';f.orderCovered.delete('2026-11-01');
    const r=novemberDetails(f)!;const dom=new JSDOM('<body>'+r.html+'<script>'+r.js+'</script>',{runScripts:'dangerously'}),doc=dom.window.document;
    (doc.querySelector('.nd-order-toggle') as any).click();
    expect(doc.querySelector('.nd-order-chart path[stroke="#F59E0B"]')).toBeNull();
    expect(doc.querySelector('.nd-order-chart')!.textContent).toContain('нет данных');dom.window.close();
  });
});

it('keeps closed dates on the funnel when the native partial snapshot is stale',()=>{
  const f=fixture();f.today='2026-11-05';f.store.orders![2]=99;
  f.partial={day:'2026-11-02',cards:[{views:999,vsearch:999,have:2,want:2}],all:{},store:{}};
  const r=novemberDetails(f)!;const dom=new JSDOM('<body>'+r.html+'<script>'+r.js+'</script>',{runScripts:'dangerously'}),doc=dom.window.document;
  const chart=doc.querySelector('#nd-funnel-chart')!;
  expect(chart.querySelectorAll('text')[chart.querySelectorAll('text').length-2]!.textContent).toBe('04.11');
  expect(chart.querySelector('[data-partial-day]')).toBeNull();expect(chart.textContent).not.toContain('Неполный');dom.window.close();
});
