/* ===== 1. KPI ===== */
block('Плитки',function(){
const strip=el('div','kpi-strip'); app.appendChild(strip);
function draw(){
 const f=feedIn(), [mf,mt]=metWindow(), [pf,pt]=prevWindow();
 const sv=agg('Магазин','search_views',mf,mt), svp=agg('Магазин','search_views',pf,pt);
 const od=agg('Магазин','ordered_units',mf,mt), odp=agg('Магазин','ordered_units',pf,pt);
 const d=(a,b)=>(a==null||b==null||b===0)?null:((a/b-1)*100);
 const cells=[
  ['c1','Действий за период',String(f.length),'шт','правок в кабинете за '+periodLabel()],
  ['c2','Активных кампаний',String(D.totals.active),'из '+D.totals.camps,'бюджет '+fmt(D.totals.wbudget/1000)+' тыс. ₽ в неделю'],
  ['c3','Показы в поиске',fmt(sv/1000),'тыс.',(d(sv,svp)==null?'':pc(d(sv,svp))+'% к прошлому периоду')],
  ['c4','Заказы магазина',fmt(od),'шт',(d(od,odp)==null?'':pc(d(od,odp))+'% к прошлому периоду')],
  ['c5','Соинвест: реклама и без',String(D.coinv['С рекламой'][0]).replace('.',',')+' / '+String(D.coinv['Без рекламы'][0]).replace('.',','),'%','разница '+pc(D.coinv['С рекламой'][0]-D.coinv['Без рекламы'][0])+' пункта'],
  ['c6','Открытых алертов',String(D.alerts.filter(a=>a.sev!=='ok').length),'шт','срочных '+D.alerts.filter(a=>a.sev==='high').length+' · блок внизу']];
 strip.innerHTML='';
 cells.forEach(([c,k,v,u,s])=>{const cell=el('div','kpi-cell '+c);
  cell.innerHTML=`<div class="kpi-k">${k}</div><div class="kpi-v num">${v}<span class="u">${u}</span></div><div class="kpi-sub">${s}</div>`;
  strip.appendChild(cell)});
}
draw(); onPeriod(draw);
});

/* ===== 2. таймлайн ===== */
block('Таймлайн',function(){
const c=card('Таймлайн: что делали и что происходило',
 'Три этажа. Сверху сплошная линия это выбранная метрика по выбранному срезу товаров, пунктирная это соинвест, то есть доля скидки от предельной цены, со своей шкалой справа. В середине столбики: день, в который что-то правили в кабинете, высота это число правок, цвет это преобладающий тип. Снизу ступенька ставки оплаты за заказ: видно не только когда её трогали, но и какой она была всё это время. Красная заливка на ступеньке это дни, когда инструмент был выключен совсем.',TD);
let metric='search_views', scope='Магазин';
const MNAME={search_views:'показы в поиске',ordered_units:'заказы',pdp_views:'посещения карточек',search_position:'позиция в поиске'};
const bar=el('div','fbar');
const chips=el('div','chips');
[['показы в поиске','search_views'],['заказы','ordered_units'],['посещения карточек','pdp_views'],['позиция в поиске','search_position']].forEach(([t,v])=>{
 const b=el('button','chip'+(metric===v?' act':''));b.textContent=t;b.onclick=()=>{metric=v;[...chips.querySelectorAll('.chip')].forEach(x=>x.classList.toggle('act',x.textContent===t));draw()};chips.appendChild(b)});
bar.appendChild(el('span','card-sub','Метрика'));bar.appendChild(chips);
const schips=el('div','chips');
['Магазин','Мебель','Зеркала','С рекламой','Без рекламы'].forEach(v=>{
 const b=el('button','chip'+(scope===v?' act':''));b.textContent=v;
 b.onclick=()=>{scope=v;[...schips.querySelectorAll('.chip')].forEach(x=>x.classList.toggle('act',x.textContent===v));draw()};
 schips.appendChild(b)});
bar.appendChild(el('span','card-sub','Срез'));bar.appendChild(schips);
const host=el('div'); host.style.cssText='overflow-x:auto';
c.appendChild(bar); c.appendChild(host);
const legend=el('div','lgnd');
legend.innerHTML='';
 '<span class="lg"><i style="width:10px;height:10px;background:var(--up);border-radius:2px;display:inline-block"></i> включали кампании</span>'+
 '<span class="lg"><i style="width:10px;height:10px;background:var(--dn);border-radius:2px;display:inline-block"></i> выключали</span>'+
 '<span class="lg"><i style="width:10px;height:10px;background:var(--ink-3);border-radius:2px;display:inline-block"></i> ставки и бюджеты</span>'+
 '<span class="lg"><i style="width:2px;height:12px;background:var(--warn);display:inline-block"></i> оплата за заказ</span>';
c.appendChild(legend);
const note=el('div','note'); c.appendChild(note);
function draw(){
 const [mf,mt]=metWindow(); const [af,at]=actWindow();
 const from=(af<mf?af:mf), to=(at>mt?at:mt);
 const ser=seriesOf(scope,metric,from,to), co=seriesOf(scope,'coinv',from,to);
 const days=[]; let cur=from, guard=0;
 while(cur<=to && guard++<400){ days.push(cur); const nx=shift(cur,1); if(nx===cur) break; cur=nx; }
 const byDay={}; feedIn().forEach(f=>{const d=f.ts.slice(0,10);const o=byDay[d]=byDay[d]||{n:0,on:0,off:0,cpo:0,rows:[],fams:{}};o.n++;o.fams[f.fam]=(o.fams[f.fam]||0)+1;
   if(f.fam==='Включение кампании')o.on++; else if(f.fam.indexOf('Выключение')===0||f.fam.indexOf('Архивация')===0)o.off++;
   if(f.scope==='магазин')o.cpo++; o.rows.push(f)});
 const W=Math.max(880,days.length*13), H=300, PADL=58, PADR=52, PADT=12, CH=120, BH=42, RB=62;
 const x=i=>PADL+(days.length<2?0:i*(W-PADL-PADR)/(days.length-1));
 const vals=ser.map(s=>s[1]).filter(v=>v!=null);
 const inv=(metric==='search_position');
 let mn=Math.min(...vals), mx=Math.max(...vals); if(!isFinite(mn)){mn=0;mx=1} if(mx===mn)mx=mn+1;
 const y=v=>PADT+CH-((v-mn)/(mx-mn))*CH*(inv?-1:1)-(inv?CH:0);
 const cvals=co.map(s=>s[1]).filter(v=>v!=null);
 let cmn=cvals.length?Math.min(...cvals):0, cmx=cvals.length?Math.max(...cvals):1; if(cmx===cmn)cmx=cmn+1;
 const cy=v=>PADT+CH-((v-cmn)/(cmx-cmn))*CH;
 const idx={}; days.forEach((d,i)=>idx[d]=i);
 const path=(pairs,fy)=>{let p='',prev=null;pairs.forEach(([d,v])=>{const i=idx[d];if(i==null)return;if(v==null){prev=null;return;}
   p+=(prev===null?'M':'L')+x(i).toFixed(1)+','+fy(v).toFixed(1)+' ';prev=v});return p};
 const maxN=Math.max(1,...Object.values(byDay).map(o=>o.n));
 // ступенчатая линия ставки оплаты за заказ
 const steps=(D.cpo.steps||[]).slice().sort((a,b)=>a.d<b.d?-1:1);
 const rateAt={}; let rcur=null;
 steps.forEach(st=>{ if(st.d<days[0]) rcur=(st.kind==='off'?null:st.v); });
 days.forEach(dd=>{ steps.forEach(st=>{ if(st.d===dd) rcur=(st.kind==='off'?null:st.v); }); rateAt[dd]=rcur; });
 const RY0=PADT+CH+16+BH+30, RH=RB-20;
 const RMIN=4, RMAX=10;
 const ry=v=>RY0+RH-((v-RMIN)/(RMAX-RMIN))*RH;
 let rpath='', rprev=null;
 days.forEach((dd,i)=>{ const v=rateAt[dd]; const x1=x(i), x2=(i<days.length-1?x(i+1):x(i)+ (W-PADL-PADR)/Math.max(1,days.length-1));
  if(v==null){ rprev=null; return; }
  if(rprev===null){ rpath+='M'+x1.toFixed(1)+','+ry(v).toFixed(1)+' '; } else if(rprev!==v){ rpath+='L'+x1.toFixed(1)+','+ry(rprev).toFixed(1)+' L'+x1.toFixed(1)+','+ry(v).toFixed(1)+' '; }
  rpath+='L'+Math.min(x2,W-PADR).toFixed(1)+','+ry(v).toFixed(1)+' '; rprev=v; });
 let rgrid='';
 [5,7,9].forEach(v=>{ rgrid+=`<line x1="${PADL}" y1="${ry(v).toFixed(1)}" x2="${W-PADR}" y2="${ry(v).toFixed(1)}" stroke="var(--border-soft)" stroke-width="1" stroke-dasharray="1 4"/>`+
   `<text x="${PADL-7}" y="${(ry(v)+3.5).toFixed(1)}" fill="var(--ink-4)" font-size="9.5" text-anchor="end">${v}%</text>`; });
 let roff='';
 days.forEach((dd,i)=>{ if(rateAt[dd]==null){ const x1=x(i), x2=(i<days.length-1?x(i+1):x(i)+6);
   roff+=`<rect x="${x1.toFixed(1)}" y="${RY0.toFixed(1)}" width="${Math.max(2,x2-x1).toFixed(1)}" height="${RH}" fill="var(--dn)" opacity=".16"/>`; } });
 let rmarks='';
 steps.forEach(st=>{ const i=idx[st.d]; if(i==null) return;
  const sym=st.kind==='up'?'▲':(st.kind==='down'?'▼':(st.kind==='off'?'■':'●'));
  const col=st.kind==='off'?'var(--dn)':(st.kind==='on'?'var(--up)':'var(--warn)');
  rmarks+=`<text class="rmark" data-i="${steps.indexOf(st)}" x="${x(i).toFixed(1)}" y="${(RY0-4).toFixed(1)}" fill="${col}" font-size="9" text-anchor="middle" style="cursor:pointer">${sym}</text>`; });
 let bars='',cpoLines='';
 days.forEach((d,i)=>{const o=byDay[d]; if(!o)return;
  const h=6+((o.n/maxN)*(BH-8));
  const col=o.on>o.off?'var(--up)':(o.off>o.on?'var(--dn)':'var(--ink-3)');
  bars+=`<rect class="tlbar" data-d="${d}" x="${(x(i)-4).toFixed(1)}" y="${(PADT+CH+16+BH-h).toFixed(1)}" width="8" height="${h.toFixed(1)}" rx="2" fill="${col}" opacity=".85"/>`;
  if(o.cpo) cpoLines+=`<line x1="${x(i).toFixed(1)}" y1="${PADT}" x2="${x(i).toFixed(1)}" y2="${(PADT+CH+16+BH).toFixed(1)}" stroke="var(--warn)" stroke-width="1.5" stroke-dasharray="3 3" opacity=".8"/>`;
 });
 let ticks='';
 days.forEach((d,i)=>{ if(d.slice(8,10)==='01'||i===0||i===days.length-1){
   ticks+=`<text x="${x(i).toFixed(1)}" y="${(H-4).toFixed(1)}" fill="var(--ink-4)" font-size="9.5" text-anchor="middle">${d.slice(8,10)}.${d.slice(5,7)}</text>`}});
 const iEnd=idx[DUNTIL];
 const nodata=(iEnd!=null&&iEnd<days.length-1)?`<rect x="${x(iEnd).toFixed(1)}" y="${PADT}" width="${(x(days.length-1)-x(iEnd)).toFixed(1)}" height="${CH}" fill="var(--bg-soft)" opacity=".45"/><text x="${((x(iEnd)+x(days.length-1))/2).toFixed(1)}" y="${(PADT+14)}" fill="var(--ink-4)" font-size="9.5" text-anchor="middle">воронки ещё нет</text>`:'';
 host.innerHTML=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block">
  ${nodata}
  <line x1="${PADL}" y1="${PADT+CH}" x2="${W-PADR}" y2="${PADT+CH}" stroke="var(--border)" stroke-width="1"/>
  ${cpoLines}
  <path d="${path(co,cy)}" fill="none" stroke="var(--d4)" stroke-width="1.4" stroke-dasharray="4 3" opacity=".85"/>
  <path d="${path(ser,y)}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
  <text x="4" y="${PADT+8}" fill="var(--accent)" font-size="9.5">${fmt(inv?mn:mx)}</text>
  <text x="4" y="${PADT+CH}" fill="var(--accent)" font-size="9.5">${fmt(inv?mx:mn)}</text>
  <text x="${W-PADR+6}" y="${PADT+8}" fill="var(--d4)" font-size="9.5">${cmx.toFixed(0)}%</text>
  <text x="${W-PADR+6}" y="${PADT+CH}" fill="var(--d4)" font-size="9.5">${cmn.toFixed(0)}%</text>
  ${bars}${ticks}
  <text x="2" y="${(RY0-12).toFixed(1)}" fill="var(--warn)" font-size="9.5" font-weight="600">ставка оплаты за заказ</text>
  ${rgrid}${roff}
  <path d="${rpath}" fill="none" stroke="var(--warn)" stroke-width="1.8" stroke-linejoin="round"/>
  ${rmarks}</svg>`;
 host.querySelectorAll('.rmark').forEach(m=>{const st=steps[+m.dataset.i]; if(!st) return;
  const nm=st.kind==='up'?'ставку подняли':(st.kind==='down'?'ставку опустили':(st.kind==='off'?'инструмент выключили':'инструмент включили'));
  bind(m,`${dmy(st.d)} ${st.t}<br><b>${nm}</b><br>${st.txt}<br>сделал: ${st.user}<br><span style="color:#6A7484">выше ставка = больше скидка от Ozon = выше соинвест</span>`);});
 host.querySelectorAll('.tlbar').forEach(r=>{const d=r.dataset.d,o=byDay[d];
  bind(r,`${dmy(d)}<br>правок: ${o.n}${o.on?'<br>включений: '+o.on:''}${o.off?'<br>выключений: '+o.off:''}${o.cpo?'<br>оплата за заказ: '+o.cpo:''}<br><span style="color:#6A7484">клик чтобы отфильтровать ленту</span>`);
  r.style.cursor='pointer';
  r.onclick=()=>{window.__feedDay=(window.__feedDay===d)?null:d; if(window.__drawFeed)window.__drawFeed();
   host.querySelectorAll('.tlbar').forEach(z=>z.setAttribute('stroke',z.dataset.d===window.__feedDay?'var(--ink)':'none'));
   host.querySelectorAll('.tlbar').forEach(z=>z.setAttribute('stroke-width',z.dataset.d===window.__feedDay?'1.5':'0'));};
 });
 legend.innerHTML='<span class="lg"><i style="width:14px;height:2px;background:var(--accent);display:inline-block"></i> <b style="color:var(--ink-2)">'+MNAME[metric]+'</b>, срез «'+scope+'», '+(D.levels_n[scope]||0)+' товаров</span>'+
  '<span class="lg"><i style="width:14px;height:2px;background:var(--d4);display:inline-block"></i> соинвест, медиана по тем же товарам, шкала справа</span>'+
  '<span class="lg"><i style="width:10px;height:10px;background:var(--up);border-radius:2px;display:inline-block"></i> включали кампании</span>'+
  '<span class="lg"><i style="width:10px;height:10px;background:var(--dn);border-radius:2px;display:inline-block"></i> выключали</span>'+
  '<span class="lg"><i style="width:10px;height:10px;background:var(--ink-3);border-radius:2px;display:inline-block"></i> серый: правили ставки за клик, бюджеты, состав кампаний</span>'+
  '<span class="lg"><i style="width:14px;height:2px;background:var(--warn);display:inline-block"></i> ставка оплаты за заказ, нижняя полоса: ▲ подняли, ▼ опустили, ■ выключили, ● включили</span>';
 const nd=Object.keys(byDay).length, tot=Object.values(byDay).reduce((s,o)=>s+o.n,0);
 const cpod=Object.values(byDay).filter(o=>o.cpo).length;
 const coCur=agg(scope,'coinv',metWindow()[0],metWindow()[1]);
 note.innerHTML='<b>Что на графике сейчас.</b> Слева по синей шкале '+MNAME[metric]+' по срезу «'+scope+'» ('+(D.levels_n[scope]||0)+' товаров), справа по фиолетовой шкале соинвест медианой по тем же товарам, сейчас '+(coCur==null?'нет данных':coCur.toFixed(1).replace('.',',')+'%')+'. Соинвест это доля скидки от предельной цены, ровно та величина, ради которой мы держим копеечные кампании.<br><br><b>Зачем этот блок.</b> Он отвечает на вопрос «мы что-то делали, и что после этого поехало». За '+periodLabel()+
  ' было '+plu(tot,['правка','правки','правок'])+' в '+plu(nd,['день','дня','дней'])+
  (cpod?', из них в '+plu(cpod,['день','дня','дней'])+' трогали оплату за заказ':'')+
  '. Ищите глазами связку: столбик снизу и перелом линии сверху через день-два. Если перелом есть, а столбика нет, значит сработало не наше действие, а площадка.';
}
draw(); onPeriod(draw);
});
