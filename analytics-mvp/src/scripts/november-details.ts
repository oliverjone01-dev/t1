import {novemberPeriodAttrs} from './november-visibility.js';
import {novemberCardGoals,advertisingReference,observedLowerBound} from './november-controls.js';
import {renderOrderBreakdown,type OrderModel} from './plan-tab/order-breakdown.js';
import {NOVEMBER_GROWTH} from './november-growth.js';
import {novemberPeriods,unitPlan} from './november-periods.js';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Plan} from './plan-tab.js';
import {median} from './estimator.js';

type Row=Record<string,any>;
type Series=Record<string,Array<number|null>>;
type Card={short:string;main_art:string;main_sku:string;skus:string[];min_skus:string[];click_new?:number};
export interface NovemberInput {
  taxonomy?:Record<string,{model?:string;offer?:string}>; today:string; days:string[]; plan:Plan; cards:Card[]; ser:Series[]; store:Series;
  views:Row[]; orders:Row[]; orderLast:string; orderCovered:Set<string>;
  ads:Row[]; adsSku:Row[]; adsLast:string; adsFull:string; adsCovered?:Set<string>;
  prices:Row[]; gaps:Row[]; partial:unknown;
}
export const NOV_START='2026-11-01',NOV_END='2026-11-30';
const day=(d:string,n:number)=>new Date(Date.parse(d+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
const dates=(a:string,b:string)=>{const r:string[]=[];for(let d=a;d<=b;d=day(d,1))r.push(d);return r;};
const fmt=(v:number|null,d=0)=>v==null?'нет данных':v.toLocaleString('ru-RU',{maximumFractionDigits:d});
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const dm=(d:string)=>d.slice(8)+'.'+d.slice(5,7);
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const CPO='28753239';
const metrics=[['vsearch','Показы в поиске'],['views','Показы всего'],['pdp','Карточка'],['cart','Корзина'],['units','Заказано (Ozon, с отменами)'],['orders','Заказы без отмен'],['pos','Позиция в поиске'],['ctr','В карточку, % показов'],['tocart','В корзину, % карточки'],['toord','В заказ, % корзины'],['per1k','Заказов на 1 000 показов'],['sp','Расход на клики, ₽'],['clk','Клики (оценка по карточке)'],['cpc','CPC, ₽'],['acart','Корзины из рекламы']];
const ratios:Record<string,[string,string,number]>={ctr:['pdp','views',100],tocart:['cart','pdp',100],toord:['units','cart',100],per1k:['units','views',1000],cpc:['sp','clk',1]};
export function observedTotal(values:Array<number|null>){return values.length&&values.every(v=>v!==null)?values.reduce<number>((s,v)=>s+v!,0):null;}
export function novemberWeeks(){return novemberPeriods().map(p=>[p.label,p.from,p.to]);}
export function metricValue(s:Series,key:string,indices:number[]):number|null {
  const r=ratios[key];
  if(r){const a=observedTotal(indices.map(i=>s[r[0]]?.[i]??null)),b=observedTotal(indices.map(i=>s[r[1]]?.[i]??null));return a!=null&&b? a/b*r[2]:null;}
  const vals=indices.map(i=>s[key]?.[i]??null);
  if(key==='pos')return median(vals.filter((v):v is number=>v!==null));
  return observedTotal(vals);
}
export function novemberDetails(input:NovemberInput){
  const I=input;if(I.today<NOV_START)return null;
  const closedEnd=[day(I.today,-1),NOV_END].sort()[0]!;
  // Keep October as an explicitly labelled reference, never as November's actual.
  const days=dates('2026-10-01',NOV_END),nov=days.map((d,i)=>d>=NOV_START&&d<=closedEnd?i:-1).filter(i=>i>=0);
  const srcIndex=new Map(I.days.map((d,i)=>[d,i]));
  const viewByDay=new Map<string,Map<string,Row>>();
  for(const r of I.views){const m=viewByDay.get(r.date)??new Map();m.set(String(r.sku),r);viewByDay.set(r.date,m);}
  const adsDays=new Set(I.ads.map(r=>String(r.d)));
  const fullAds=(d:string)=>I.adsCovered?I.adsCovered.has(d):d<=I.adsFull;
  const copy=(s:Series)=>Object.fromEntries(Object.entries(s).map(([k,v])=>[k,days.map(d=>d>=I.today?null:v[srcIndex.get(d)??-1]??null)])) as Series;
  const sets=I.cards.map((c,i)=>({name:c.short,art:c.main_art,skus:c.skus,s:copy(I.ser[i]!),coverage:days.map(d=>c.skus.filter(s=>viewByDay.get(d)?.has(s)).length)}));
  const store={name:'Магазин',art:'Все товары',skus:[] as string[],s:copy(I.store),coverage:days.map(d=>viewByDay.get(d)?.size??0)};
  const FK=['views','vsearch','pdp','cart','units'];
  for(const set of [...sets,store])for(const [i,d] of days.entries()){
    if(d>=I.today)continue;
    if(d>I.orderLast||!I.orderCovered.has(d))set.s.orders![i]=null;
    if(set!==store)for(const k of FK)if(!set.skus.length||!set.skus.every(s=>valid(viewByDay.get(d)?.get(s)?.[k])))set.s[k]![i]=null;
    for(const k of ['sp','clk','acart'])set.s[k]![i]=null;
  }
  const toMin=new Set(I.plan.to_min.map(r=>String(r.cid)));
  // Exclusive partition: specified campaigns, main SKUs, remaining minimum SKUs, other SKUs.
  const buckets=I.cards.map(c=>({id:'main:'+c.main_art,name:c.short,sub:c.main_art,group:'Клик главного товара',sku:c.main_sku,values:new Map<string,number>()}));
  const minBuckets=I.cards.filter(c=>c.min_skus.length).map(c=>({id:'min:'+c.main_art,name:c.short,sub:c.min_skus.length+' товаров',group:'Остальные товары с минимальным кликом по октябрьской схеме',sku:'',values:new Map<string,number>()}));
  const campaignBuckets=I.plan.to_min.map(r=>({id:'campaign:'+r.cid,name:String(r.cid),sub:r.art,group:'Кампании из октябрьского списка минимального расхода',sku:'',values:new Map<string,number>()}));
  const other={id:'other',name:'Прочие товары и кампании',sub:'Остаток до суммы отчёта по товарам',group:'Прочее',sku:'',values:new Map<string,number>()};
  const allBuckets=[...buckets,...minBuckets,...campaignBuckets,other];
  const add=(m:Map<string,number>,d:string,v:number)=>m.set(d,(m.get(d)??0)+v);
  const campSpend=new Map<string,number>(),campClicks=new Map<string,number>();
  for(const r of I.ads){campClicks.set(r.id+'|'+r.d,Number(r.cl)||0);}
  const seen=new Set<string>();
  for(const r of I.adsSku){if(r.d<'2026-10-01'||r.d>NOV_END||String(r.cid)===CPO)continue;
    const key=r.d+'|'+r.cid+'|'+r.sku;if(seen.has(key))throw Error('Duplicate advertising SKU/day/campaign '+key);seen.add(key);
    if(!valid(r.sp))throw Error('Invalid advertising spend '+key);add(campSpend,r.cid+'|'+r.d,r.sp);
  }
  const skuSp=new Map<string,Map<string,number>>(),skuCa=new Map<string,Map<string,number>>(),skuCl=new Map<string,Map<string,number>>();
  const skuAdd=(m:Map<string,Map<string,number>>,sku:string,d:string,v:number)=>{const x=m.get(sku)??new Map();add(x,d,v);m.set(sku,x);};
  for(const r of I.adsSku){if(r.d<'2026-10-01'||r.d>NOV_END||String(r.cid)===CPO)continue;
    const sku=String(r.sku),cid=String(r.cid),ci=I.cards.findIndex(c=>c.main_sku===sku);
    const bucket=toMin.has(cid)?campaignBuckets.find(b=>b.id==='campaign:'+cid)!:ci>=0?buckets[ci]!:minBuckets.find(b=>I.cards.find(c=>'min:'+c.main_art===b.id)!.min_skus.includes(sku))??other;
    add(bucket.values,r.d,r.sp);skuAdd(skuSp,sku,r.d,r.sp);if(valid(r.ca))skuAdd(skuCa,sku,r.d,r.ca);
    const total=campSpend.get(cid+'|'+r.d)??0;skuAdd(skuCl,sku,r.d,total?(campClicks.get(cid+'|'+r.d)??0)*r.sp/total:0);
  }
  const campaignKeys=new Set<string>();
  for(const r of I.ads){if(r.d<'2026-10-01'||r.d>NOV_END)continue;const key=r.d+'|'+r.id;if(campaignKeys.has(key))throw Error('Duplicate campaign/day '+key);campaignKeys.add(key);}
  const sumSkus=(m:Map<string,Map<string,number>>,skus:string[],d:string)=>skus.reduce((n,s)=>n+(m.get(s)?.get(d)??0),0);
  for(const [i,d] of days.entries()){
    if(d>=I.today||!adsDays.has(d))continue;
    if(fullAds(d))for(const set of sets){set.s.sp![i]=sumSkus(skuSp,set.skus,d);set.s.clk![i]=sumSkus(skuCl,set.skus,d);set.s.acart![i]=sumSkus(skuCa,set.skus,d);}
    if(d<=I.adsLast){const rows=I.ads.filter(r=>r.d===d&&String(r.id)!==CPO);store.s.sp![i]=rows.reduce((n,r)=>n+(Number(r.sp)||0),0);store.s.clk![i]=rows.reduce((n,r)=>n+(Number(r.cl)||0),0);store.s.acart![i]=rows.reduce((n,r)=>n+(Number(r.ca)||0),0);}
  }
  const all:typeof store={name:'Все '+sets.length+' карточек',art:'Без выводимых товаров',skus:sets.flatMap(s=>s.skus),s:{},coverage:days.map((_,i)=>sets.reduce((n,s)=>n+s.coverage[i]!,0))};
  for(const k of Object.keys(store.s))all.s[k]=days.map((_,i)=>k==='pos'?null:observedTotal(sets.map(s=>s.s[k]?.[i]??null)));
  const series=[...sets,all,store];
  const observed=series.map(set=>Object.fromEntries(FK.map(k=>[k,days.map((d,i)=>{
    if(d>=I.today)return null;
    if(set===store)return set.s[k]?.[i]??null;
    return observedLowerBound(set.skus.map(sku=>viewByDay.get(d)?.get(sku)?.[k]??null));
  })])) as Series);
  const gaps=series.map(set=>set===store?[]:days.flatMap(d=>{
    if(d>I.today||d<'2026-10-15'||d>closedEnd)return [];
    const missing=set.skus.filter(sku=>!FK.every(k=>valid(viewByDay.get(d)?.get(sku)?.[k]))).map(sku=>({sku,offer:I.taxonomy?.[sku]?.offer??sku,fields:FK.filter(k=>!valid(viewByDay.get(d)?.get(sku)?.[k]))}));
    return missing.length?[{day:d,missing}]:[];
  }));
  const cardGoals=novemberCardGoals();

  const baseline=days.map((d,i)=>d>='2026-10-15'&&d<='2026-10-28'?i:-1).filter(i=>i>=0);
  const oct=days.map((d,i)=>d>='2026-10-01'&&d<='2026-10-31'?i:-1).filter(i=>i>=0);
  const weekValue=(s:Series,k:string,ids:number[])=>{const v=metricValue(s,k,ids);return v==null?null:ratios[k]||k==='pos'?v:v/ids.length*7;};
  const delta=(a:number|null,b:number|null)=>!a||b==null?'<span class="muted">-</span>':`<span class="${b>=a?'up':'dn'}">${b>=a?'+':''}${fmt((b/a-1)*100)}%</span>`;
  const orderSummary=series.map(s=>({total:metricValue(s.s,'orders',nov),goal:s===store?NOVEMBER_GROWTH.units.nov.mid:s===all?(sets.every(c=>cardGoals.some(g=>g.name===c.name))?sets.reduce((n,c)=>n+cardGoals.find(g=>g.name===c.name)!.goal,0):null):cardGoals.find(g=>g.name===s.name)?.goal??null,base:metricValue(s.s,'orders',baseline),oct:metricValue(s.s,'orders',oct)}));
  const orderTable=series.flatMap((s,si)=>{
    if(s===all)return [];
    const {total,goal,base,oct:previous}=orderSummary[si]!;
    const byModel=new Map<string,OrderModel>();
    for(const r of I.orders){if(r.d<NOV_START||r.d>closedEnd||r.d>I.orderLast||r.status==='cancelled'||!I.orderCovered.has(r.d)||(s!==store&&!s.skus.includes(String(r.sku))))continue;
      const sku=String(r.sku),offer=String(r.offer||I.taxonomy?.[sku]?.offer||sku),model=I.taxonomy?.[sku]?.model?.trim()||'Модель не указана · '+offer;
      const m=byModel.get(model)??{model,units:0,share:0,skus:[]};const u=Number(r.units)||0;m.units+=u;
      const item=m.skus.find(x=>x.sku===sku);if(item)item.units+=u;else m.skus.push({sku,offer,units:u});byModel.set(model,m);
    }
    const models=[...byModel.values()].filter(m=>m.units>0).sort((a,b)=>b.units-a.units||a.model.localeCompare(b.model,'ru'));
    if(total!==null&&Math.abs(models.reduce((n,m)=>n+m.units,0)-total)>0.01)throw Error('November article orders differ '+s.name);
    models.forEach(m=>{m.share=total?m.units/total*100:0;m.skus.sort((a,b)=>b.units-a.units)});
    const status=!nov.length?'период не начался':total==null?'нет данных':goal==null?'порог не задан':total>=unitPlan(goal,1,nov.length)?'идём':'отстаём';
    return [`<tr class="crow nd-order-row${s===store?' total':''}" data-set="${si}"><td><button type="button" class="nd-order-toggle" aria-expanded="false" aria-controls="nd-order-detail-${si}"><span class="tw">▸</span> <b>${esc(s.name)}</b><small>${esc(s.art)}</small></button></td><td class="r">${goal??'<span class="muted">Не задан</span>'}${goal!=null?`<small>к ${nov.length?dm(closedEnd):"01.11"}: ${fmt(unitPlan(goal,1,nov.length),0)}</small>`:""}</td><td class="r">${fmt(total)}</td><td class="r">${goal!=null&&total!=null?fmt(Math.max(0,goal-total)):'-'}</td><td class="r">${fmt(base==null?null:base/14*30,0)}</td><td class="r">${fmt(previous)}</td><td><span class="chip ${status==='идём'?'chip-done':status==='отстаём'?'chip-bad':'chip-off'}">${status}</span></td></tr><tr class="cdet nd-order-detail" id="nd-order-detail-${si}" hidden><td colspan="7"><div class="nd-order-chart" data-set="${si}"></div>${renderOrderBreakdown({total,end:nov.length?closedEnd:'',models},NOV_START,'nd-ob'+si)}${goal!=null?`<div class="tbl-wrap full"><table class="gtbl single nd-card-weeks"><thead><tr><th>Неделя</th><th class="r">Цель недели</th><th class="r">План закрытых дней</th><th class="r">Факт</th><th>Статус</th></tr></thead><tbody>${novemberPeriods().map(w=>{const ids=days.map((d,i)=>d>=w.from&&d<=w.to&&d<=closedEnd?i:-1).filter(i=>i>=0),v=metricValue(s.s,'orders',ids),need=unitPlan(goal,Number(w.from.slice(8)),Number(w.from.slice(8))+ids.length-1);return `<tr ${novemberPeriodAttrs(w.from,I.today)}><td>${w.label}</td><td class="r">${fmt(unitPlan(goal,Number(w.from.slice(8)),Number(w.to.slice(8))),0)}</td><td class="r">${fmt(need,0)}</td><td class="r">${fmt(v)}</td><td>${!ids.length?'—':v==null?'нет данных':v>=need?'идём':'отстаём'}</td></tr>`}).join('')}</tbody></table></div>`:''}</td></tr>`];
  }).join('');
  const funnelCell=(si:number,k:string,ids:number[])=>{
    const v=weekValue(series[si]!.s,k,ids);if(v!=null)return fmt(v);
    const lower=observedLowerBound(ids.map(i=>observed[si]?.[k]?.[i]??null));
    return lower==null?'нет наблюдений':`<span class="nd-incomplete" title="Наблюдалось ${fmt(lower)} за ${ids.length} дней; полный итог неизвестен">≥ ${fmt(lower/ids.length*7)}<small>неполный охват</small></span>`;
  };
  const gapDetails=sets.map((set,si)=>{
    const relevant=gaps[si]!.filter(g=>g.day<='2026-10-28'||g.day>=NOV_START);if(!relevant.length)return '';
    return `<details class="fold nd-coverage"><summary>${esc(set.name)}: пробелы по датам и SKU</summary><table class="gtbl single"><thead><tr><th>Дата</th><th>Охват SKU</th><th>Нет строки или показателя</th></tr></thead><tbody>${relevant.map(g=>`<tr><td>${dm(g.day)}</td><td>${set.skus.length-g.missing.length}/${set.skus.length}</td><td>${g.missing.map(m=>`${esc(m.offer)} · SKU ${esc(m.sku)}`).join('<br>')}</td></tr>`).join('')}</tbody></table></details>`;
  }).join('');
  const funnelTable=series.map((s,si)=>`<tr><td><b>${esc(s.name)}</b></td>${['vsearch','pdp','cart','units'].map(k=>{const b=weekValue(s.s,k,baseline),a=weekValue(s.s,k,nov);return `<td class="r sep">${funnelCell(si,k,baseline)}</td><td class="r">${funnelCell(si,k,nov)}</td><td class="r">${delta(b,a)}</td>`;}).join('')}<td class="r sep">${fmt(metricValue(s.s,'per1k',baseline),2)}</td><td class="r">${fmt(metricValue(s.s,'per1k',nov),2)}</td></tr>`).join('');
  const weeks=novemberWeeks();
  const adIndices=nov.filter(i=>fullAds(days[i]!)&&adsDays.has(days[i]!));
  const adEnd=adIndices.length?days[adIndices[adIndices.length-1]!]!:'';
  const adTotal=adIndices.length?I.adsSku.filter(r=>adIndices.some(i=>days[i]===r.d)&&String(r.cid)!==CPO).reduce((n,r)=>n+r.sp,0):null;
  const bucketSum=adIndices.length?allBuckets.reduce((n,b)=>n+adIndices.reduce((a,i)=>a+(b.values.get(days[i]!)??0),0),0):null;
  if(adTotal!==null&&Math.abs(adTotal-bucketSum!)>0.01)throw Error('Advertising partition does not reconcile');
  const adsRows=allBuckets.map(b=>({weekly:b.id.startsWith('main:')?I.cards.find(c=>'main:'+c.main_art===b.id)?.click_new??null:b.id.startsWith('min:')?(I.cards.find(c=>'min:'+c.main_art===b.id)?.min_skus.length??0)*I.plan.min_budget_sku:b.id.startsWith('campaign:')?I.plan.min_campaign_budget:null,name:b.name,sub:b.sub,group:b.group,values:days.map(d=>d<I.today&&fullAds(d)&&adsDays.has(d)?b.values.get(d)??0:null)}));
  const cpo=nov.length&&nov.every(i=>days[i]!<=I.adsLast&&adsDays.has(days[i]!))?I.ads.filter(r=>nov.some(i=>days[i]===r.d)&&String(r.id)===CPO).reduce((n,r)=>n+(Number(r.sp)||0),0):null;
  const campaignSpend=metricValue(store.s,'sp',adIndices);
  const groups=[...new Set(adsRows.map(r=>r.group))];
  const adsHtml=groups.map(g=>`<h3 class="pg">${esc(g)}</h3><div class="nd-ad-grid" style="--nov-ad-columns:${1+weeks.filter(w=>w[1]!<=I.today).length}"><div class="wk-grid wk-head nd-ad-head"><b>Товар / кампания</b><b>Ноябрь, ₽</b>${weeks.map(w=>`<b ${novemberPeriodAttrs(w[1]!,I.today)}>${w[0]}</b>`).join('')}</div>${adsRows.filter(r=>r.group===g).map(r=>`<div class="wk-grid nd-ad-row"><div><b>${esc(r.name)}</b><small>${esc(r.sub)}</small><small>ориентир ${r.weekly?fmt(r.weekly)+" ₽/нед.":"не задан"}</small></div><b class="wk-col nd-ad-total">${fmt(observedTotal(adIndices.map(i=>r.values[i]!)),2)}</b>${weeks.map(([,a,b])=>{const ix=days.map((d,i)=>d>=a!&&d<=b!&&d<=closedEnd?i:-1).filter(i=>i>=0);const v=observedTotal(ix.map(i=>r.values[i]!));const ref=advertisingReference(v,r.weekly,ix.length);if(!ix.length){const plannedDays=days.filter(d=>d>=a!&&d<=b!).length;return `<div class="wk-col" ${novemberPeriodAttrs(a!,I.today)} data-ad-status="future"><small>—</small><small>${r.weekly?`ориентир ${fmt(r.weekly*plannedDays/7)} ₽ за период`:"ориентир не задан"}</small></div>`;}return `<div class="wk-col" ${novemberPeriodAttrs(a!,I.today)} data-ad-status="${ref.status}"><strong>${fmt(v,2)}</strong><div class="pl-bar"><div class="pl-plan" style="left:66.666%" ${ref.limit==null?'hidden':''}></div>${v==null?'<span class="pl-empty">нет данных</span>':`<div class="pl-fill" style="width:${ref.pct==null?0:Math.min(100,ref.pct/150*100)}%;min-width:0;background:${ref.color}"></div>`}</div><small>${ref.limit!=null?`ориентир ${fmt(ref.limit)} ₽${ref.pct!=null?` · ${fmt(ref.pct,1)}%`:''}`:'нет ориентира'}</small><small>${ix.length?`${ix.filter(i=>r.values[i]!=null).length}/${ix.length} закрытых дней`:'период не начался'}</small></div>`;}).join('')}</div>`).join('')}</div>`).join('');
  const at=(rows:Row[],art:string,limit:string,field:string)=>rows.filter(r=>(r.offer??r.art)===art&&(r.d??r.date)<=limit&&(field==='gap_pct'||valid(r[field]))).sort((a,b)=>String(b.d??b.date).localeCompare(String(a.d??a.date)))[0];
  const priceRows=I.plan.price.map(p=>{const current=at(I.prices,p.art,[I.today,NOV_END].sort()[0]!,'price'),base=at(I.prices,p.art,'2026-10-31','price'),gap=at(I.gaps,p.art,[I.today,NOV_END].sort()[0]!,'gap_pct');
    const history=I.prices.filter(r=>r.offer===p.art&&r.d>=NOV_START&&r.d<=I.today&&r.d<=NOV_END&&valid(r.price)).sort((a,b)=>a.d.localeCompare(b.d));
    let previous=base?.price;const changes=history.filter(r=>{const changed=previous!=null&&previous!==r.price;previous=r.price;return changed;});
    const realizations=I.gaps.filter(r=>r.art===p.art&&r.date>=NOV_START&&r.date<=I.today&&r.date<=NOV_END)
      .map(r=>{
        const value=valid(r.buyer)&&r.buyer>0?r.buyer:null;
        const coinvest=value!==null&&valid(r.cap)&&r.cap>0&&Number.isFinite(r.gap_pct)?r.gap_pct:null;
        return {day:r.date,value,coinvest};
      });
    return {art:p.art,name:p.name,base:base?{day:base.d,value:base.price}:null,current:current?{day:current.d,value:current.price}:null,gap:gap?{day:gap.date,value:gap.gap_pct,buyer:gap.buyer??null,stamp:gap.ts??null}:null,history:history.map(r=>({day:r.d,value:r.price})),realizations,changes:changes.map(r=>({day:r.d,value:r.price}))};
  });
  const priceHtml=priceRows.map((p,pi)=>{const delta=p.base&&p.current&&p.current.day>=NOV_START&&p.base.value?(p.current.value/p.base.value-1)*100:null;const stale=p.current&&p.current.day<NOV_START;
    return `<tr><td><details class="nd-price"><summary><b>${esc(p.art)}</b><span>${esc(p.name)}</span></summary><div class="nd-price-chart" data-price="${pi}"></div></details></td><td>${fmt(p.base?.value??null)}<small>${p.base?dm(p.base.day):''}</small></td><td>${fmt(p.current?.value??null)}<small>${p.current?dm(p.current.day):''}${stale?' · до ноября':''}</small></td><td>${delta==null?'нет данных':fmt(delta,1)+'%'}</td><td>${p.changes.map(r=>`${dm(r.day)}: ${fmt(r.value)} ₽`).join('<br>')||(p.history.length?'Без наблюдаемых смен':'Нет наблюдений ноября')}</td><td>${p.gap?(p.gap.buyer!==null?fmt(p.gap.buyer)+' ₽<br>':'')+fmt(p.gap.value,1)+'%<small>'+dm(p.gap.day)+(p.gap.day<NOV_START?' · старый срез':'')+'</small>':'нет данных'}</td><td>Не задана</td></tr>`;
  }).join('');
  const priceStates=[
    ['Цена ниже базы','#22D3EE',priceRows.filter(p=>p.base&&p.current&&p.current.day>=NOV_START&&p.current.value<p.base.value).length],
    ['Цена без изменения','#8b9eae',priceRows.filter(p=>p.base&&p.current&&p.current.day>=NOV_START&&p.current.value===p.base.value).length],
    ['Цена выше базы','#E5B567',priceRows.filter(p=>p.base&&p.current&&p.current.day>=NOV_START&&p.current.value>p.base.value).length],
    ['Нет свежего сравнения','#3a4654',priceRows.filter(p=>!p.base||!p.current||p.current.day<NOV_START).length],
  ] as const;
  const priceBars=priceStates.map(([label,color,n])=>`<div class="pill-row"><div class="pl-n">${label}</div><div class="pl-bar">${n?`<div class="pl-fill" style="width:${n/Math.max(1,priceRows.length)*100}%;background:${color}"><span>${n}</span></div>`:''}</div><div class="pl-p">${n}/${priceRows.length}</div></div>`).join('');
  const adsTable=`<details class="fold"><summary>Таблица</summary><div class="tbl-wrap full nd-scroll"><table class="gtbl single"><thead><tr><th>Группа / товар / кампания</th>${weeks.map(w=>`<th ${novemberPeriodAttrs(w[1]!,I.today)}>${w[0]}, ₽</th>`).join('')}</tr></thead><tbody>${adsRows.map(r=>`<tr><td>${esc(r.group)} · ${esc(r.name)}<small>${esc(r.sub)}</small></td>${weeks.map(([,a,b])=>{const ix=days.map((d,i)=>d>=a!&&d<=b!&&d<=closedEnd?i:-1).filter(i=>i>=0);return `<td ${novemberPeriodAttrs(a!,I.today)}>${fmt(observedTotal(ix.map(i=>r.values[i]!)),2)}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  const section=(id:string,title:string,content:string)=>`<details class="pt-sec nd-section" id="${id}"><summary class="sec nd-title">${title}</summary>${content}</details>`;
  const html=`<section id="november-details" class="nd"><p class="sub">Те же ${I.cards.length} карточек и ${I.plan.price.length} ценовых артикулов, что в октябрьском плане. Факт за 01-30.11, закрытые дни по ${nov.length?dm(closedEnd):'пока не наступили'}. Состав карточек сохранён на 15.10; выводимые товары исключены. Цели магазина показаны выше, решения ноября - в разделе 7. Цели карточек распределены из 450 товаров по структуре заказов 15–28.10; это расчётный план объёма, не доказательство прибыльности.</p>`
    +section('november-orders',`1. Заказы: ${I.cards.length} карточек и весь магазин`,`<p>Без отмен, по дню заказа в Москве. В строке раскрываются накопительный график и заказы по моделям. «Без эффекта» — темп 15–28.10, пересчитанный на 30 дней; это ориентир, не цель. Цели рассчитаны по октябрьским итогам из анализа 03.11: доля карточки в 228 товарах магазина за 15–28.10 × 450, округление сохраняет общую сумму 450. На прочие карточки приходится ${cardGoals.at(-1)!.goal} товаров. Проверка недельного темпа — внутри строки. Рост убыточных вариантов не является поручением увеличивать рекламу. Текущий день исключён; последние три дня могут уменьшиться после отмен.</p><div class="nd-scroll tbl-wrap full"><table class="gtbl single"><thead><tr><th>Карточка</th><th class="r">Цель ноября</th><th class="r">С 01.11</th><th class="r">Осталось</th><th class="r">Без эффекта</th><th class="r">01–31.10</th><th>Статус</th></tr></thead><tbody>${orderTable}</tbody></table></div>`)
    +section('november-funnel','2. Воронка',`<p>База 15–28.10 и закрытые дни с 01.11, приведённые к неделе для сравнения темпа. «Заказано Ozon» включает отмены; заказы отправлений без отмен показаны отдельно. Знак ≥ показывает наблюдаемую часть, приведённую к неделе: полный итог неизвестен. При неполном охвате конверсия и Δ не рассчитываются; неполные закрытые дни отмечены на графике отдельными жёлтыми точками.</p><div class="nd-scroll tbl-wrap"><table class="gtbl"><thead><tr class="grp"><th></th>${["Показы в поиске","Карточка","Корзина","Заказано (OZON, с отменами)"].map(t=>`<th colspan="3" class="sep">${t}</th>`).join("")}<th colspan="2" class="sep">На 1 000 показов</th></tr><tr><th>Карточка</th>${`<th class="r sep">база</th><th class="r">с 01.11</th><th class="r">Δ</th>`.repeat(4)}<th class="r sep">база</th><th class="r">с 01.11</th></tr></thead><tbody>${funnelTable}</tbody></table></div>${gapDetails}<div class="nd-selectors" id="nd-cards"></div><div class="nd-selectors" id="nd-metrics"></div><div id="nd-funnel-chart"></div><div id="nd-funnel-table"></div><p class="nd-note">Проценты - отношения сумм по одним дням. Позиция - медиана доступных наблюдений главного SKU; охват виден в таблице сравнения. Клики карточки оцениваются пропорционально расходу SKU внутри кампании; клики магазина берутся напрямую из кампаний.</p>`)
    +'<!-- NOVEMBER_STORE -->'
    +section('november-ads','4. Реклама по неделям',`<div class="nd-kpis"><div><span>CPC, отчёт по кампаниям</span><b>${fmt(campaignSpend,2)} ₽</b><small>Закрытых дней в детализации: ${adIndices.length}</small></div><div><span>CPC, отчёт по товарам</span><b>${fmt(adTotal,2)} ₽</b><small>${adEnd?'По '+dm(adEnd):'Ноябрь ещё не собран'}</small></div><div><span>Разница источников</span><b>${adTotal!=null&&campaignSpend!=null?fmt(adTotal-campaignSpend,2)+' ₽':'нет данных'}</b><small>Не добавляется к расходам</small></div><div><span>Оплата за заказ, отдельно</span><b>${fmt(cpo)} ₽</b><small>По кампаниям, за доступный ноябрь</small></div></div><p>Группы ниже взаимоисключающие: кампания из списка минимума, затем главный товар, затем остальные минимальные товары, затем прочие. Итог групп = отчёт CPC по товарам; CPO в него не входит. Группы и недельные ориентиры сохранены из октябрьского плана; фактическая ставка 8 ₽ не подтверждена. Показаны только начавшиеся недели; следующие появятся по дате начала.</p><p class="legend nd-ad-key"><b>Границы CPC:</b> зелёный — до 100% октябрьского ориентира, жёлтый — свыше 100% до 120%, красный — свыше 120%. Белая метка — 100%; ориентир пересчитан на закрытые дни недели. Цвет оценивает расход, а не окупаемость.</p>${adsHtml}${adsTable}<div id="nd-ads-chart"></div><p class="nd-note">Цвета сравнивают CPC с октябрьским планом, пропорционально закрытым дням: зелёный ≤100%, жёлтый >100–120%, красный >120%. Белая метка — 100%. Цвет оценивает только расход, а не окупаемость. Это контрольный ориентир, не изменение бюджета в Ozon. Общий CPC + CPO контролируется в спидометре раздела 1: ДРР не выше 10% фактического оборота магазина за те же закрытые дни. Отдельные кампании без ориентира остаются нейтральными; октябрьские CPC-ориентиры не заменяют общий предел ДРР. Будущие недели скрыты до даты начала. Пропуски отчётов за прошедшие дни отмечаются отдельно.</p>`)
    +section('november-prices','5. Цена '+I.plan.price.length+' артикулов',`<p><a href="katya-data.html#catalog">Цены, остатки и тарифы всего кабинета →</a></p><p>Наша цена по последнему наблюдению, база - последнее наблюдение не позже 31.10. Старая дата видна рядом со значением. Нажмите артикул, чтобы открыть график нашей цены и цены реализации. Подсказка показывает оценку соинвеста по данным того же дня.</p>${priceBars}<details class="fold"><summary>Все ${priceRows.length} артикулов</summary><div class="nd-scroll tbl-wrap full"><table class="gtbl single"><thead><tr><th>Артикул</th><th>До ноября, ₽</th><th>Последняя цена, ₽</th><th>Δ к базе</th><th>Смены в ноябре</th><th>Цена реализации / разрыв к предельной</th><th>Цель ноября</th></tr></thead><tbody>${priceHtml}</tbody></table></div></details><p class="nd-note">Цена реализации и разрыв к предельной цене — отдельный срез, дата указана в каждой строке. Цена реализации может учитывать скидку по карте банка и исключает обработку заказа в ПВЗ. Она не соединяется с историей обычной цены без карты. Оценка соинвеста равна разрыву между предельной ценой и ценой реализации в процентах от предельной. Фактические начисления Ozon учитываются отдельно. График показывает ноябрьские наблюдения. Изменение заказов не доказывает эффект цены; новых решений об откате здесь нет.</p>`)+`</section>`;
  // Same campaign source as marketing; CPC and CPO are disjoint. SKU attribution is not added again.
  const adsTotal=Object.fromEntries(days.filter(d=>d>=NOV_START).map(d=>{
    if(d>=I.today||d>I.adsLast||!adsDays.has(d))return [d,null];
    const rows=I.ads.filter(r=>r.d===d);
    if(rows.some(r=>!valid(r.sp)))throw Error('Invalid total advertising spend '+d);
    return [d,rows.reduce((sum,r)=>sum+r.sp,0)];
  }));
  const data={today:I.today,cardGoals,orderSummary,baseStart:"2026-10-15",baseEnd:"2026-10-28",adsTotal,days,novStart:NOV_START,novEnd:NOV_END,closedEnd,series:series.map(({name,art,s,coverage,skus},i)=>({name,art,s,observed:observed[i],gaps:gaps[i],coverage,skuCount:skus.length})),metrics,ratios,prices:priceRows,partial:I.partial};
  const here=dirname(fileURLToPath(import.meta.url));
  return {html,css:readFileSync(join(here,'november-details.css'),'utf8'),js:`window.ND=${JSON.stringify(data).replace(/</g,'\\u003c')};window.ND_MEDIAN=(${median.toString()});\n`+readFileSync(join(here,'plan-tab/chart.client.js'),'utf8')+readFileSync(join(here,'november-details.client.js'),'utf8'),data};
}
