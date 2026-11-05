// Клиентская часть блока «План с 15.10» (plan-tab.ts кладёт данные в window.PD): спидометры, графики, плашки.
(function(){
var D=window.PD, DAYS=D.days;
var C={s1:'#F59E0B',cy:'#22D3EE',grey:'#8b9eae',soft:'#232B36',ok:'#34D399',mid:'#E5B567',bad:'#FF7A7E',none:'#3a4654'};
function dm(s){return s.slice(8,10)+'.'+s.slice(5,7)}
function fmt(x,nd){if(x==null||!isFinite(x))return '-';return x.toFixed(nd||0).replace(/\B(?=(\d{3})+(?!\d))/g,' ').replace('.',',')}
function idx(d){return DAYS.indexOf(d)}
function $(id){return document.getElementById(id)}
var tip=document.createElement('div');tip.className='pt-tip';document.body.appendChild(tip);
function showTip(e,h){tip.innerHTML=h;tip.style.display='block';var x=e.clientX+14,y=e.clientY+14;if(x+tip.offsetWidth>innerWidth-8)x=e.clientX-tip.offsetWidth-14;tip.style.left=x+'px';tip.style.top=y+'px'}
function hideTip(){tip.style.display='none'}
var gauge=window.planGauge,stOf=window.planGaugeStatus;
function sumWin(ser,a,b){var t=0,n=0;for(var j=idx(a);j<=idx(b);j++)if(ser[j]!=null){t+=ser[j];n++}return n?t:null}
function goalPath(g,d,sc){return g.lo/31*d+(g[sc]-g.lo)*Math.max(0,Math.min(15,d-16))/15}
// спидометры (Иван 15.10): период с 15.10 по конец месяца. Стрелка - факт за период к плану всего периода,
// белая метка - сколько плана должно быть набрано к последнему дню данных, цвет - факт к этой метке. 01-14.10 - справочно внизу.
var G=D.gauges,CW=D.cards_win,cwEarly=CW.n_in>0&&CW.n_in<3,cwOn=CW.n_in?CW.fact.filter(function(x,i){return x>=CW.need[i]}).length:null;
function pg(title,g,unit,nd,div,hiBad){div=div||1;
  var has=g.fact!=null,td=has&&g.plan_td?g.fact/g.plan_td*100:null;
  return gauge({title:title,val:has?g.fact:null,plan:g.plan,mark:g.plan?g.plan_td/g.plan*100:null,stPct:td,hiBad:hiBad,
    l1:has?fmt(g.fact/div,nd)+' из '+fmt(g.plan/div,nd)+unit:'план '+fmt(g.plan/div,nd)+unit+', факта за '+dm(g.from)+' ещё нет',
    l2:dm(g.from)+'-'+dm(g.to)+(has?' · план на '+dm(g.last)+' '+fmt(g.plan_td/div,nd):''),
    l3:g.ref?'справочно '+dm(g.ref.from)+'-'+dm(g.ref.to)+': '+fmt(g.ref.fact/div,nd)+unit:''})}
$('pt-gauges').innerHTML=[
  pg('Заказы 10 карточек',G.cards,'',0),
  gauge({title:'Карточки на пути',early:cwEarly,val:CW.n_in&&!cwEarly?cwOn:null,plan:5,l1:cwEarly?'рано: '+CW.n_in+' дн. окна':CW.n_in?cwOn+' из 10':'факта за '+dm(D.start)+' ещё нет',l2:'окно решения '+dm(D.start)+'-'+dm(D.w1)+', нужно 5'}),
  pg('Заказы магазина',G.store,'',0),
  pg('Оборот магазина',G.turn,' млн',1),
  pg('Реклама, все клики',G.ads,' тыс. ₽',0,1e3,true)
].join('');

var chart=window.planChart;

// ---------- мини-графики карточек: накопительно 15-28.10 к порогу (как было)
var prev0=idx('2026-10-01'),i0=idx(D.start),K=idx(D.w1)-i0+1,mxs=[];for(var k=0;k<K;k++)mxs.push(dm(DAYS[i0+k]));
var mpale=Math.max(0,idx(D.od_last)-2-i0);
D.cards.forEach(function(c,ci){
  var o=D.ser[ci].orders,cum=[],pv=[],a=0,b=0,thr=[],thp=[],path=[];
  for(var k=0;k<K;k++){var v=o[i0+k];if(v==null)cum.push(null);else{a+=v;cum.push(a)}b+=o[prev0+k]||0;pv.push(b);thr.push(c.thr);thp.push(c.thrp);path.push(c.thr*(k+1)/K)}
  var nd=cum.findIndex(function(x){return x==null});
  var ser=[{v:pv,color:C.grey,w:1.4,name:'01-14.10'},{v:path,color:C.cy,dash:'2 4',w:1.4,name:'нужный темп'},{v:thr,color:C.cy,w:1.6,name:'порог'}];
  if(c.thrp)ser.push({v:thp,color:C.cy,dash:'5 4',w:1.2,name:'порог с ценой'});
  ser.push({v:cum,color:C.s1,w:2.6,area:true,name:'с 15.10',pale:mpale});
  chart($('pt-mc'+ci),{title:'<div class="mc-h">'+c.short+' <span>'+(cum[0]==null?'-':cum.filter(function(x){return x!=null}).pop())+' / '+c.thr+'</span></div>',xs:mxs,series:ser,w:900,h:200,nodata:nd<0?null:nd,step:2});
});

(function(c){var o=D.store.orders,cum=[],pv=[],a=0,b=0,thr=[],path=[],base=[];
  for(var k=0;k<K;k++){var v=o[i0+k];if(v==null)cum.push(null);else{a+=v;cum.push(a)}b+=o[prev0+k]||0;pv.push(b);thr.push(c.thr);path.push(c.path[k]);base.push(c.base2*(k+1)/K)}   // путь цели магазина не прямой (ФЕНИКС G3)
  var nd=cum.findIndex(function(x){return x==null});
  chart($('pt-mcS'),{title:'<div class="mc-h">Весь магазин <span>'+(cum[0]==null?'-':cum.filter(function(x){return x!=null}).pop())+' / '+c.thr+'</span></div>',xs:mxs,
    series:[{v:pv,color:C.grey,w:1.4,name:'01-14.10'},{v:base,color:C.grey,dash:'5 4',w:1.2,name:'без эффекта'},{v:path,color:C.cy,dash:'2 4',w:1.4,name:'нужный темп'},{v:thr,color:C.cy,w:1.6,name:'цель 15-28.10'},{v:cum,color:C.s1,w:2.6,area:true,name:'с 15.10',pale:mpale}],
    w:900,h:200,nodata:nd<0?null:nd,step:2});
})(D.store_card);
[].forEach.call(document.querySelectorAll('#pt-plan .crow'),function(tr){tr.onclick=function(){var d=$('pt-cdet'+tr.dataset.i);d.hidden=!d.hidden;tr.classList.toggle('open',!d.hidden)}});

// ---------- воронка: выбор карточки и показателя
var SETS=D.cards.map(function(c,i){return {n:c.short,s:D.ser[i]}});
var all={};['views','vsearch','pdp','cart','units','orders','sp','clk','acart'].forEach(function(k){all[k]=DAYS.map(function(_,j){var any=false,t=0;D.ser.forEach(function(s){if(s[k][j]!=null){any=true;t+=s[k][j]}});return any?t:null})});
all.pos=DAYS.map(function(){return null});
SETS.push({n:'Все 10',s:all});SETS.push({n:'Магазин',s:D.store});
var M=[['vsearch','Показы в поиске','sum'],['views','Показы всего','sum'],['pdp','Карточка','sum'],['cart','Корзина','sum'],['units','Заказано (OZON)','sum'],
  ['orders','Заказы без отмен','sum'],['pos','Позиция в поиске','med'],['ctr','В карточку, % показов','r','pdp','views',100],['tocart','В корзину, % карточки','r','cart','pdp',100],
  ['toord','В заказ, % корзины','r','units','cart',100],['per1k','Заказов на 1 000 показов','r','units','views',1000],['sp','Расход на клики, ₽','sum'],['clk','Клики','sum'],
  ['cpc','CPC, ₽','r','sp','clk',1],['acart','Корзины из рекламы','sum']];
var cur={c:0,m:0};
function serOf(s,m){if(m[2]!=='r')return s[m[0]];return DAYS.map(function(_,j){var a=s[m[3]][j],b=s[m[4]][j];return a==null||b==null||!b?null:a/b*m[5]})}
function win(s,m,a,b){var ia=idx(a),ib=idx(b),vals=[],na=0,nb=0,n=0;
  for(var j=ia;j<=ib;j++){if(m[2]==='r'){if(s[m[3]][j]!=null&&s[m[4]][j]!=null){na+=s[m[3]][j];nb+=s[m[4]][j];n++}}else if(s[m[0]][j]!=null){vals.push(s[m[0]][j])}}
  if(m[2]==='r')return n&&nb?na/nb*m[5]:null;if(!vals.length)return null;
  if(m[2]==='med'){vals.sort(function(x,y){return x-y});return vals[Math.floor(vals.length/2)]}
  return vals.reduce(function(x,y){return x+y},0)/vals.length*7}
function btns(id,list,key,cb){$(id).innerHTML=list.map(function(x,i){return '<button class="mb'+(cur[key]===i?' on':'')+'" data-i="'+i+'">'+x+'</button>'}).join('');
  [].forEach.call(document.querySelectorAll('#'+id+' .mb'),function(b){b.onclick=function(){cur[key]=+b.dataset.i;cb()}})}
function drawFunnel(){
  btns('pt-cardsel',SETS.map(function(x){return x.n}),'c',drawFunnel);btns('pt-metsel',M.map(function(x){return x[1]}),'m',drawFunnel);
  var st=SETS[cur.c],m=M[cur.m];
  var last=m[0]==='orders'?D.od_last:(['sp','clk','acart','cpc'].indexOf(m[0])>=0?(st.s===D.store?D.ad_camp_last:D.ad_last):D.sv_last);
  var ps=D.partial&&(cur.c<D.cards.length?D.partial.cards[cur.c]:cur.c===D.cards.length?D.partial.all:D.partial.store);
  var nativeKeys=['views','vsearch','pdp','cart','units','pos'];
  var canPartial=ps&&(nativeKeys.indexOf(m[0])>=0||(m[2]==='r'&&nativeKeys.indexOf(m[3])>=0&&nativeKeys.indexOf(m[4])>=0));
  var pv=canPartial?(m[2]==='r'?(ps[m[3]]==null||!ps[m[4]]?null:ps[m[3]]/ps[m[4]]*m[5]):ps[m[0]]):null;
  var end=canPartial&&D.partial.day>last?D.partial.day:last,j1=idx(end),xs=DAYS.slice(0,j1+1).map(dm),v=serOf(st.s,m).slice(0,j1+1);
  var point=xs.map(function(){return null});if(canPartial)point[idx(D.partial.day)]=pv;
  var ma=v.map(function(_,j){var t=0,c=0;for(var q=Math.max(0,j-6);q<=j;q++)if(v[q]!=null){t+=v[q];c++}return v[j]==null||c<4?null:t/c});
  var nd=m[2]==='r'&&m[5]!==1?2:0,f=function(x){return fmt(x,nd)};
  var partialNote=canPartial?' · '+dm(D.partial.day)+' — неполный день, '+new Date(D.partial.loaded_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'})+' МСК; '+(pv==null?'нет данных':f(pv))+' · наблюдались '+ps.have+(ps.want!=null?' из '+ps.want:'')+' SKU. В среднее и сравнения не входит.':'';
  chart($('pt-dynchart'),{title:'<div class="ch-h">'+st.n+' · '+m[1]+' <span class="muted">день и среднее 7 дней'+partialNote+'</span></div>',
    xs:xs,series:[{v:v,color:C.grey,w:1,name:'за день',dash:'2 3'},{v:ma,color:C.s1,w:2.4,area:true,name:'среднее 7 дней'},{v:point,color:C.cy,w:2,dots:true,name:'неполный день',partial:canPartial?D.partial.day:null}],vline:idx(D.start),nodata:canPartial?null:idx(last)+1,inv:m[0]==='pos',fmtv:f});
  var W=[['База 14.09-11.10',D.base_win[0],D.base_win[1]],['07-13.10','2026-10-07','2026-10-13'],['С 15.10',D.start,D.w1]];
  var unit={sum:', в неделю',med:', медиана',r:''};
  var rows=M.map(function(mm){var b=win(st.s,mm,W[0][1],W[0][2]),l=win(st.s,mm,W[1][1],W[1][2]),a=win(st.s,mm,W[2][1],W[2][2]);
    var nd=mm[2]==='r'&&mm[5]!==1?2:0,dd=b&&a!=null?(a/b-1)*100:null,good=mm[0]==='pos'?dd!=null&&dd<=0:dd!=null&&dd>=0;
    var pk=ps?(mm[2]==='r'?(ps[mm[3]]==null||!ps[mm[4]]?null:ps[mm[3]]/ps[mm[4]]*mm[5]):ps[mm[0]]):null;
    return '<tr'+(mm===m?' class="sel"':'')+'><td>'+mm[1]+'<span class="muted">'+unit[mm[2]]+'</span></td><td class="r">'+fmt(b,nd)+'</td><td class="r">'+fmt(l,nd)+'</td><td class="r">'+fmt(a,nd)+'</td><td class="r">'+(dd==null?'<span class="muted">-</span>':'<span class="'+(good?'up':'dn')+'">'+(good?'▲ ':'▼ ')+(dd>=0?'+':'')+dd.toFixed(0)+'%</span>')+'</td>'+(D.partial?'<td class="r">'+(pk==null?'нет данных':fmt(pk,nd))+'</td>':'')+'</tr>'});
  $('pt-dyntbl').innerHTML='<div class="tbl-wrap"><table class="gtbl single"><thead><tr><th>'+st.n+'</th>'+W.map(function(w){return '<th class="r">'+w[0]+'</th>'}).join('')+'<th class="r">С 15.10 к базе</th>'+(D.partial?'<th class="r">'+dm(D.partial.day)+' · неполный день<br>за день, без пересчёта в неделю</th>':'')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
}
drawFunnel();

// ---------- магазин: накопительно с 01.10 против цели месяца
function storeChart(id,ser,g,title,div){
  var o0=idx('2026-10-01'),xs=[],cum=[],a=0,mid=[],lo=[],hi=[];
  for(var d=1;d<=31;d++){var j=o0+d-1;xs.push(dm(DAYS[j]));var v=ser[j];if(v==null)cum.push(null);else{a+=v/div;cum.push(a)}
    mid.push(goalPath(g,d,'mid'));lo.push(goalPath(g,d,'lo'));hi.push(goalPath(g,d,'hi'))}
  var last=cum.findIndex(function(x){return x==null}),nd=div>1?1:0,f=function(x){return fmt(x,nd)};
  chart($(id),{title:'<div class="ch-h">'+title+' <span class="muted">цель '+f(g.mid)+'</span></div>',
    xs:xs,series:[{v:mid,color:C.cy,dash:'5 4',w:1.6,name:'цель «средне»'},{v:cum,color:C.s1,w:2.6,area:true,name:'факт',pale:Math.max(0,(last<0?31:last)-3)}],
    band:{lo:lo,hi:hi},w:460,h:220,vline:idx(D.start)-o0,nodata:last<0?null:last,fmtv:f});
}
storeChart('pt-stU',D.store.orders,D.goal.units.oct,'Заказы, шт',1);
storeChart('pt-stT',D.store_rev,D.goal.turn_mln.oct,'Оборот, млн ₽',1e6);

// ---------- плашки расхода по неделям
function drawPills(){
  var NW=D.weeks.length,h='<div class="wk-grid wk-head"><div></div>'+D.weeks.map(function(w,i){return '<div class="wk-col">'+w+'</div>'}).join('')+'</div>';
  D.spend.forEach(function(g){
    h+='<div class="pg">'+g.g+(g.note?'<div class="pg-n">'+g.note+'</div>':'')+'</div>';
    g.rows.forEach(function(r){
      h+='<div class="wk-grid"><div class="pl-n">'+r.n+' <span class="muted">'+r.sub+'</span><div class="muted s">план '+fmt(r.plan)+' ₽</div></div>';
      for(var w=0;w<NW;w++){var v=r.w[w],pre=D.week_start[w]<D.start,pct=v?v[0]/(r.plan*v[1]/7)*100:null,st=stOf(pct,true);
        if(pre&&pct!=null)st={c:C.grey,t:'',i:''};
        var wd=pct==null?0:Math.min(100,pct/150*100),t=(r.n+' · '+D.weeks[w]+'<br>план '+fmt(r.plan)+' ₽/нед'+(v?'<br>факт '+fmt(v[0])+' ₽ за '+v[1]+' дн · '+fmt(pct)+'%':'<br>ещё нет данных')).replace(/"/g,'&quot;');
        h+='<div class="wk-col" data-t="'+t+'"><div class="pl-bar"><div class="pl-plan" style="left:66.6%"></div>'+(v?(v[0]>0?'<div class="pl-fill" style="width:'+Math.max(wd,3)+'%;background:'+st.c+'"></div>':''):'<span class="pl-empty">нет данных</span>')+'</div>'
          +(v?'<div class="wk-v">'+fmt(v[0])+(v[1]<7?' <span class="muted">за '+v[1]+' дн</span>':'')+' <span style="color:'+(pre?'var(--ink3)':st.c)+'">'+fmt(pct)+'%</span></div>':'')+'</div>'}
      h+='</div>'});
  });
  $('pt-pills').innerHTML='<div class="legend">Белая метка - план с поправкой на число дней. Клик и минимальный клик - '+(D.ad_last?'по '+dm(D.ad_last)+' (дальше отчёт по товарам досчитывается)':'отчёт по товарам не собран')+', 11 кампаний - по '+dm(D.ad_camp_last)+'. Первая неделя - до плана, для сравнения. Меньше плана - зелёный, до 120% - жёлтый, больше - красный.</div>'+h;
  [].forEach.call(document.querySelectorAll('.wk-col[data-t]'),function(el){el.onmousemove=function(e){showTip(e,el.dataset.t)};el.onmouseleave=hideTip});
}
drawPills();

// ---------- цена: сводные плашки
var ps=D.price_st,PS=[['снижена','Снижена',C.ok,'✓'],['частично','Снижена частично',C.mid,'!'],['по плану','Срок сегодня или позже',C.none,'○'],['не снижена','Не снижена',C.bad,'✕'],['eb','Выпали из бустинга',C.bad,'▲']];
$('pt-pricepills').innerHTML=PS.map(function(p){var n=ps[p[0]]||0,wd=n/D.price_n*100;
  return '<div class="pill-row"><div class="pl-n">'+p[3]+' '+p[1]+'</div><div class="pl-bar">'+(n?'<div class="pl-fill" style="width:'+Math.max(wd,4)+'%;background:'+p[2]+'"><span>'+n+'</span></div>':'<span class="pl-empty">0</span>')+'</div><div class="pl-p">'+fmt(wd)+'%</div></div>'}).join('')
  +'<div class="legend">'+D.price_when.map(function(w){return w[1]+' с '+w[0]}).join(' · ')+'</div>';
// Детали модели: одна раскрытая плашка на группу, повторное нажатие сворачивает.
[].forEach.call(document.querySelectorAll('#pt-plan .ob-pill'),function(button){
  button.addEventListener('click',function(){
    var section=button.closest('.order-breakdown'),open=button.getAttribute('aria-expanded')!=='true';
    [].forEach.call(section.querySelectorAll('.ob-pill'),function(b){
      var active=b===button&&open;
      b.setAttribute('aria-expanded',String(active));
      document.getElementById(b.getAttribute('aria-controls')).hidden=!active;
    });
  });
});
})();
