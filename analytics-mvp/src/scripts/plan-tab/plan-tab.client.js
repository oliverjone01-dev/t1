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
// статус к плану: идём / отстаём до 30% / отстаём сильнее
// hiBad - расход: чем меньше, тем зеленее
function stOf(pct,hiBad){if(pct==null)return {c:C.none,t:'нет данных',i:'○'};
  if(hiBad)return pct>120?{c:C.bad,t:'перерасход',i:'▲'}:pct>100?{c:C.mid,t:'выше плана',i:'!'}:{c:C.ok,t:'в плане',i:'✓'};
  if(pct>=100)return {c:C.ok,t:hiBad?'в плане':'идём',i:'✓'};if(pct>=70)return {c:C.mid,t:'отстаём',i:'!'};return {c:C.bad,t:hiBad?'недобор':'сильно отстаём',i:'✕'}}

// ---------- спидометр
function gauge(o){ // o: title, val, plan, l1, l2, hiBad, pre
  var W=240,H=150,cx=120,cy=112,r=82,pct=o.val==null||!o.plan?null:o.val/o.plan*100,MAX=150;
  function pt(p,rr){var a=Math.PI*(1-Math.min(MAX,Math.max(0,p))/MAX);return [cx+rr*Math.cos(a),cy-rr*Math.sin(a)]}
  function arc(p0,p1,col){var a=pt(p0,r),b=pt(p1,r);return '<path d="M'+a[0]+' '+a[1]+' A'+r+' '+r+' 0 0 1 '+b[0]+' '+b[1]+'" stroke="'+col+'" stroke-width="16" fill="none"/>'}
  var zones=o.hiBad?[[0,100,C.ok],[100,120,C.mid],[120,150,C.bad]]:[[0,70,C.bad],[70,100,C.mid],[100,150,C.ok]];
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%">';
  zones.forEach(function(z){s+=arc(z[0]+.7,z[1]-.7,z[2])});
  [[0,'0'],[100,'100%'],[150,'150%']].forEach(function(t){var a=pt(t[0],r+20);s+='<text x="'+a[0]+'" y="'+(a[1]+(t[0]===100?0:16))+'" text-anchor="middle" class="gl">'+t[1]+'</text>'});
  var m=pt(100,r-11),m2=pt(100,r+11);s+='<line x1="'+m[0]+'" y1="'+m[1]+'" x2="'+m2[0]+'" y2="'+m2[1]+'" stroke="#e8eef2" stroke-width="2.5"/>';
  if(pct!=null){var n=pt(pct,r-24);s+='<line x1="'+cx+'" y1="'+cy+'" x2="'+n[0]+'" y2="'+n[1]+'" stroke="#e8eef2" stroke-width="3.5" stroke-linecap="round"/>'}
  s+='<circle cx="'+cx+'" cy="'+cy+'" r="7" fill="#e8eef2"/>';
  s+='<text x="'+cx+'" y="'+(cy+32)+'" text-anchor="middle" class="gv">'+(o.early?'рано':pct==null?'нет данных':fmt(pct)+'%')+'</text></svg>';
  var st=o.pre?{c:C.grey,t:'до плана',i:'○'}:stOf(pct,o.hiBad);
  return '<div class="gauge"><div class="g-t">'+o.title+'</div>'+s+'<div class="g-l1">'+o.l1+'</div><div class="g-l2">'+o.l2+(pct==null?'':' · <span style="color:'+st.c+'">'+st.i+' '+st.t+'</span>')+'</div></div>';
}
function sumWin(ser,a,b){var t=0,n=0;for(var j=idx(a);j<=idx(b);j++)if(ser[j]!=null){t+=ser[j];n++}return n?t:null}
function goalPath(g,d,sc){return g.lo/31*d+(g[sc]-g.lo)*Math.max(0,Math.min(15,d-16))/15}
// месяц берём из последнего дня заказов: октябрь - путь цели октября, ноябрь - цель ноября ровно по дням (ФЕНИКС G2)
var MG=D.mgoal||{month:'oct',from:'2026-10-01',units:null,turn:null,unitsMonth:D.goal.units.oct.mid,turnMonth:D.goal.turn_mln.oct.mid},nov=MG.month==='nov';
var oU=sumWin(D.store.orders,MG.from,D.od_last),oT=sumWin(D.store_rev,MG.from,D.od_last),gU=MG.units,gT=MG.turn;
// все спидометры - за месяц (Иван 15.10). Карточки: факт с 1-го числа, план - база до 15.10 и порог/14 с 15.10.
// Реклама: все клики без «Оплаты за заказ» против плана 15.10 + прочих кампаний по темпу 01-13.10.
var MN=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
function mlab(w){return w?MN[+w.to.slice(5,7)-1]+', '+dm(w.from)+'-'+dm(w.to):'нет данных'}
var AM=D.ads_month,CM=D.cards_month;
var cmF=CM?CM.fact.reduce(function(a,x){return a+x},0):null,cmP=CM?CM.plan.reduce(function(a,x){return a+x},0):0,cmM=CM?CM.month.reduce(function(a,x){return a+x},0):0;
var cmOn=CM?CM.fact.filter(function(x,i){return x>=CM.plan[i]}).length:null;
$('pt-gauges').innerHTML=[
  gauge({title:'Заказы 10 карточек',val:cmF,plan:cmP,l1:CM?fmt(cmF)+' из '+fmt(cmP):'-',l2:mlab(CM)+', месяц '+fmt(cmM)}),
  gauge({title:'Карточки на пути',val:cmOn,plan:5,l1:CM?cmOn+' из 10':'-',l2:mlab(CM)+', нужно 5'}),
  gauge({title:'Заказы магазина',val:oU,plan:gU,l1:fmt(oU)+' из '+fmt(gU),l2:(nov?'ноябрь ':'октябрь ')+fmt(MG.unitsMonth)}),
  gauge({title:'Оборот магазина',val:oT/1e6,plan:gT,l1:fmt(oT/1e6,1)+' из '+fmt(gT,1)+' млн',l2:(nov?'ноябрь ':'октябрь ')+fmt(MG.turnMonth,1)+' млн'}),
  gauge({title:'Реклама, все клики',val:AM?AM.fact:null,plan:AM?AM.plan:0,hiBad:true,pre:AM&&AM.pre,l1:AM?fmt(AM.fact/1e3)+' из '+fmt(AM.plan/1e3)+' тыс. ₽':'-',l2:mlab(AM)+(AM?', месяц '+fmt(AM.month/1e3)+' тыс.':'')})
].join('');

// ---------- гладкий график с заливкой, точками и подсказкой
function smooth(pts){if(pts.length<3)return pts.map(function(p,i){return (i?'L':'M')+p[0]+' '+p[1]}).join('');
  var d='M'+pts[0][0]+' '+pts[0][1];for(var i=0;i<pts.length-1;i++){var p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
    d+=' C'+(p1[0]+(p2[0]-p0[0])/6)+' '+(p1[1]+(p2[1]-p0[1])/6)+' '+(p2[0]-(p3[0]-p1[0])/6)+' '+(p2[1]-(p3[1]-p1[1])/6)+' '+p2[0]+' '+p2[1]}return d}
var gid=0;
function chart(el,o){ // series [{v,color,name,area,dash,w,pale,dots}], band, vline, nodata, labels, fmtv
  var W=o.w||900,H=o.h||220,L=o.small?28:46,R=o.small?6:12,T=14,B=24,n=o.xs.length,g=++gid;
  var all=[];o.series.forEach(function(s){s.v.forEach(function(x){if(x!=null)all.push(x)})});if(o.band)o.band.hi.forEach(function(x){all.push(x)});
  var mn=o.inv?Math.min.apply(null,all):0,mx=Math.max.apply(null,all.concat([1]));if(o.inv){var t=mx;mx=mn;mn=t}
  var span=(mx-mn)||1;mx+=span*.08*(o.inv?-1:1);
  var X=function(i){return L+(W-L-R)*i/(n-1)},Y=function(v){return H-B-(H-T-B)*(v-mn)/(mx-mn)};
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%"><defs>';
  o.series.forEach(function(sr,k){if(sr.area)s+='<linearGradient id="g'+g+'_'+k+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+sr.color+'" stop-opacity=".35"/><stop offset="1" stop-color="'+sr.color+'" stop-opacity="0"/></linearGradient>'});
  s+='</defs>';
  for(var q=0;q<=(o.small?2:4);q++){var v=mn+(mx-mn)*q/(o.small?2:4),y=Y(v);s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'" stroke="'+C.soft+'" stroke-width="1"/><text x="'+(L-6)+'" y="'+(y+3)+'" text-anchor="end" class="gt">'+fmt(v,Math.abs(mx-mn)<10?1:0)+'</text>'}
  var step=o.step||Math.max(1,Math.round(n/8));for(var i=0;i<n;i+=step)s+='<text x="'+X(i)+'" y="'+(H-6)+'" text-anchor="middle" class="gt">'+o.xs[i]+'</text>';
  if(o.nodata!=null&&o.nodata<n){var x0=X(Math.max(0,o.nodata-.5));s+='<rect x="'+x0+'" y="'+T+'" width="'+(W-R-x0)+'" height="'+(H-T-B)+'" fill="rgba(93,116,132,.08)"/>'+(o.small?'':'<text x="'+(x0+6)+'" y="'+(T+12)+'" class="gt">ещё нет данных</text>')}
  if(o.band){var bp=o.band.lo.map(function(v,i){return [X(i),Y(v)]}),bq=o.band.hi.map(function(v,i){return [X(i),Y(v)]}).reverse();s+='<path d="'+smooth(bp)+' L'+bq.map(function(p){return p[0]+' '+p[1]}).join(' L')+'Z" fill="rgba(139,158,174,.14)"/>'}
  if(o.vline!=null){var xv=X(o.vline);s+='<line x1="'+xv+'" x2="'+xv+'" y1="'+T+'" y2="'+(H-B)+'" stroke="'+C.cy+'" stroke-dasharray="3 4" opacity=".7"/><text x="'+(xv+4)+'" y="'+(H-B-6)+'" class="gt" style="fill:'+C.cy+'">'+(o.small?'':'старт')+'</text>'}
  o.series.forEach(function(sr,k){
    var seg=[],segs=[];sr.v.forEach(function(v,i){if(v==null){if(seg.length)segs.push(seg);seg=[]}else seg.push([X(i),Y(v),i])});if(seg.length)segs.push(seg);
    segs.forEach(function(pts){
      var main=sr.pale!=null?pts.filter(function(p){return p[2]<=sr.pale}):pts,pal=sr.pale!=null?pts.filter(function(p){return p[2]>=sr.pale}):[];
      if(sr.area&&pts.length>1)s+='<path d="'+smooth(pts)+' L'+pts[pts.length-1][0]+' '+(H-B)+' L'+pts[0][0]+' '+(H-B)+'Z" fill="url(#g'+g+'_'+k+')"/>';
      var a=' fill="none" stroke="'+sr.color+'" stroke-width="'+(sr.w||2)+'" stroke-linecap="round"'+(sr.dash?' stroke-dasharray="'+sr.dash+'"':'');
      if(main.length>1)s+='<path d="'+smooth(main)+'"'+a+'/>';
      if(pal.length>1)s+='<path d="'+smooth(pal)+'"'+a+' opacity=".35" stroke-dasharray="4 3"/>';
      if(sr.dots)pts.forEach(function(p){s+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="3.5" fill="'+sr.color+'" stroke="#12161f" stroke-width="2"'+(sr.pale!=null&&p[2]>sr.pale?' opacity=".4"':'')+'/>'});
    });
  });
  s+='<line class="xh" x1="0" x2="0" y1="'+T+'" y2="'+(H-B)+'" stroke="#e8eef2" opacity="0"/><rect class="hit" x="'+L+'" y="'+T+'" width="'+(W-L-R)+'" height="'+(H-T-B)+'" fill="transparent"/></svg>';
  el.innerHTML=(o.title||'')+s;
  var svg=el.querySelector('svg'),xh=svg.querySelector('.xh');
  svg.querySelector('.hit').onmousemove=function(e){var b=svg.getBoundingClientRect(),px=(e.clientX-b.left)/b.width*W,i=Math.round((px-L)/(W-L-R)*(n-1));i=Math.max(0,Math.min(n-1,i));
    xh.setAttribute('x1',X(i));xh.setAttribute('x2',X(i));xh.setAttribute('opacity','.3');
    showTip(e,'<b>'+o.xs[i]+'</b>'+o.series.filter(function(s){return s.name}).map(function(s){return '<br><span class="sw" style="background:'+s.color+'"></span>'+s.name+': '+(s.v[i]==null?'нет данных':(o.fmtv||fmt)(s.v[i]))}).join('')+(o.band?'<br><span class="muted">коридор '+(o.fmtv||fmt)(o.band.lo[i])+'...'+(o.fmtv||fmt)(o.band.hi[i])+'</span>':''))};
  svg.querySelector('.hit').onmouseleave=function(){xh.setAttribute('opacity','0');hideTip()};
}

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
  var st=SETS[cur.c],m=M[cur.m],j1=idx(D.w1),xs=DAYS.slice(0,j1+1).map(dm),v=serOf(st.s,m).slice(0,j1+1);
  var ma=v.map(function(_,j){var t=0,c=0;for(var q=Math.max(0,j-6);q<=j;q++)if(v[q]!=null){t+=v[q];c++}return v[j]==null||c<4?null:t/c});
  var last=m[0]==='orders'?D.od_last:(['sp','clk','acart','cpc'].indexOf(m[0])>=0?(st.s===D.store?D.ad_camp_last:D.ad_last):D.sv_last);   // магазин - по дням кампаний (ФЕНИКС N6)
  var nd=m[2]==='r'&&m[5]!==1?2:0,f=function(x){return fmt(x,nd)};
  chart($('pt-dynchart'),{title:'<div class="ch-h">'+st.n+' · '+m[1]+' <span class="muted">день и среднее 7 дней</span></div>',
    xs:xs,series:[{v:v,color:C.grey,w:1,name:'за день',dash:'2 3'},{v:ma,color:C.s1,w:2.4,area:true,name:'среднее 7 дней'}],vline:idx(D.start),nodata:idx(last)+1,inv:m[0]==='pos',fmtv:f});
  var W=[['База 14.09-11.10',D.base_win[0],D.base_win[1]],['07-13.10','2026-10-07','2026-10-13'],['С 15.10',D.start,D.w1]];
  var unit={sum:', в неделю',med:', медиана',r:''};
  var rows=M.map(function(mm){var b=win(st.s,mm,W[0][1],W[0][2]),l=win(st.s,mm,W[1][1],W[1][2]),a=win(st.s,mm,W[2][1],W[2][2]);
    var nd=mm[2]==='r'&&mm[5]!==1?2:0,dd=b&&a!=null?(a/b-1)*100:null,good=mm[0]==='pos'?dd!=null&&dd<=0:dd!=null&&dd>=0;
    return '<tr'+(mm===m?' class="sel"':'')+'><td>'+mm[1]+'<span class="muted">'+unit[mm[2]]+'</span></td><td class="r">'+fmt(b,nd)+'</td><td class="r">'+fmt(l,nd)+'</td><td class="r">'+fmt(a,nd)+'</td><td class="r">'+(dd==null?'<span class="muted">-</span>':'<span class="'+(good?'up':'dn')+'">'+(good?'▲ ':'▼ ')+(dd>=0?'+':'')+dd.toFixed(0)+'%</span>')+'</td></tr>'});
  $('pt-dyntbl').innerHTML='<div class="tbl-wrap"><table class="gtbl single"><thead><tr><th>'+st.n+'</th>'+W.map(function(w){return '<th class="r">'+w[0]+'</th>'}).join('')+'<th class="r">С 15.10 к базе</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
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
  +'<div class="legend">'+D.price_first+' с 15.10 · '+(D.price_n-D.price_first)+' с 22.10</div>';
})();
