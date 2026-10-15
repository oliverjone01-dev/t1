(function(){
var D=window.PD, DAYS=D.days, NS='http://www.w3.org/2000/svg';
var C={s1:'#F59E0B',cy:'#22D3EE',grey:'#6b7f8e',soft:'#232B36',ink3:'#5d7484'};
function dm(s){return s.slice(8,10)+'.'+s.slice(5,7)}
function fmt(x,nd){if(x==null||!isFinite(x))return '-';return x.toFixed(nd||0).replace(/\B(?=(\d{3})+(?!\d))/g,' ').replace('.',',')}
function idx(d){return DAYS.indexOf(d)}
// --- общий SVG-график: xs - подписи, series [{v,color,dash,w,op,pale}], band {lo,hi}, vline, nodata (индекс начала пустых дней)
function chart(o){
  var W=o.w||320,H=o.h||150,L=o.l||36,R=6,T=8,B=18,n=o.xs.length;
  var all=[];o.series.forEach(function(s){s.v.forEach(function(x){if(x!=null)all.push(x)})});
  if(o.band){o.band.lo.concat(o.band.hi).forEach(function(x){if(x!=null)all.push(x)})}
  var mn=o.min!=null?o.min:Math.min.apply(null,all.concat([0])),mx=Math.max.apply(null,all.concat([1]));if(mx===mn)mx=mn+1;mx*=1.06;
  var X=function(i){return L+(W-L-R)*(n<2?0:i/(n-1))},Y=function(v){return o.inv?T+(H-T-B)*(v-mn)/(mx-mn):H-B-(H-T-B)*(v-mn)/(mx-mn)};
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" preserveAspectRatio="none" style="display:block">';
  if(o.nodata!=null&&o.nodata<n){var x0=X(Math.max(0,o.nodata-0.5));s+='<rect x="'+x0+'" y="'+T+'" width="'+(W-R-x0)+'" height="'+(H-T-B)+'" fill="rgba(93,116,132,.10)"/><text x="'+(x0+4)+'" y="'+(T+11)+'">ещё нет данных</text>'}
  for(var g=0;g<=2;g++){var v=mn+(mx-mn)*g/2,y=Y(v);s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'" stroke="'+C.soft+'"/><text x="'+(L-4)+'" y="'+(y+3)+'" text-anchor="end">'+fmt(v,mx<10?1:0)+'</text>'}
  var step=o.xstep||Math.max(1,Math.ceil(n/7));for(var i=0;i<n;i+=step)s+='<text x="'+X(i)+'" y="'+(H-5)+'" text-anchor="middle">'+o.xs[i]+'</text>';
  if(o.band){var p='',q='';o.band.lo.forEach(function(v,i){if(v!=null)p+=(p?'L':'M')+X(i)+' '+Y(v)});for(var i=n-1;i>=0;i--)if(o.band.hi[i]!=null)q+='L'+X(i)+' '+Y(o.band.hi[i]);s+='<path d="'+p+q+'Z" fill="rgba(107,127,142,.18)"/>'}
  if(o.vline!=null&&o.vline>=0)s+='<line x1="'+X(o.vline)+'" x2="'+X(o.vline)+'" y1="'+T+'" y2="'+(H-B)+'" stroke="'+C.cy+'" stroke-dasharray="2 3" opacity=".6"/>';
  o.series.forEach(function(sr){
    var d='',dp='',pen=false;
    sr.v.forEach(function(v,i){if(v==null){pen=false;return}var pt=X(i)+' '+Y(v);
      if(sr.pale!=null&&i>=sr.pale){if(!dp&&i>0&&sr.v[i-1]!=null)dp='M'+X(i-1)+' '+Y(sr.v[i-1]);dp+=(dp?'L':'M')+pt}
      else{d+=(pen?'L':'M')+pt;pen=true}});
    var a=' fill="none" stroke="'+sr.color+'" stroke-width="'+(sr.w||1.6)+'"'+(sr.dash?' stroke-dasharray="'+sr.dash+'"':'');
    if(d)s+='<path d="'+d+'"'+a+' opacity="'+(sr.op||1)+'"/>';
    if(dp)s+='<path d="'+dp+'"'+a+' opacity=".35"/>';
  });
  return s+'</svg>';
}
// --- 1. мини-графики карточек: накопительно 15-28.10 против порога
var i0=idx(D.start),i1=idx(D.w1),K=i1-i0+1,xs=[];for(var k=0;k<K;k++)xs.push(dm(DAYS[i0+k]));
var pale=Math.max(0,idx(D.od_last)-2-i0);
var prev0=idx('2026-10-01');
var mult='';
D.cards.forEach(function(c,ci){
  var o=D.ser[ci].orders,cum=[],pv=[],a=0,b=0,thr=[],thp=[],path=[],base=[];
  for(var k=0;k<K;k++){var v=o[i0+k];if(v==null){cum.push(null)}else{a+=v;cum.push(a)}
    var w=o[prev0+k];b+=w||0;pv.push(b);thr.push(c.thr);thp.push(c.thrp);path.push(c.thr*(k+1)/K);base.push(c.base2*(k+1)/K)}
  var nd=cum.findIndex(function(x){return x==null});
  var ser=[{v:pv,color:C.grey,w:1.3},{v:base,color:C.grey,dash:'4 3',w:1.2},{v:path,color:C.cy,dash:'1 3',w:1.3},{v:thr,color:C.cy,w:1.4}];
  if(c.thrp)ser.push({v:thp,color:C.cy,dash:'4 3',op:.45});
  ser.push({v:cum,color:C.s1,w:2.2,pale:pale});
  mult+='<div class="mc"><div class="mc-h">'+c.short+' <span>порог '+c.thr+(c.thrp?' / '+c.thrp:'')+'</span></div>'+chart({xs:xs,series:ser,w:200,h:110,l:24,xstep:4,nodata:nd<0?null:nd})+'</div>';
});
document.getElementById('mult').innerHTML=mult;

// --- 2. воронка: выбор карточки и показателя
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
  if(m[2]==='r')return n&&nb?na/nb*m[5]:null;
  if(!vals.length)return null;
  if(m[2]==='med'){vals.sort(function(x,y){return x-y});return vals[Math.floor(vals.length/2)]}
  return vals.reduce(function(x,y){return x+y},0)/vals.length*7}
function btns(id,list,key){document.getElementById(id).innerHTML=list.map(function(x,i){return '<button class="mb'+(cur[key]===i?' on':'')+'" data-i="'+i+'">'+x+'</button>'}).join('');
  [].forEach.call(document.querySelectorAll('#'+id+' .mb'),function(b){b.onclick=function(){cur[key]=+b.dataset.i;draw()}})}
function draw(){
  btns('cardsel',SETS.map(function(x){return x.n}),'c');btns('metsel',M.map(function(x){return x[1]}),'m');
  var st=SETS[cur.c],m=M[cur.m],j1=idx(D.w1),xs=DAYS.slice(0,j1+1).map(dm),v=serOf(st.s,m).slice(0,j1+1);
  var ma=v.map(function(_,j){var t=0,c=0;for(var q=Math.max(0,j-6);q<=j;q++)if(v[q]!=null){t+=v[q];c++}return v[j]==null||c<4?null:t/c});
  var last=m[0]==='orders'?D.od_last:(['sp','clk','acart','cpc'].indexOf(m[0])>=0?D.ad_last:D.sv_last);
  var h='<div class="ch-h">'+st.n+' · '+m[1]+' <span class="muted">по дням, жирная - среднее 7 дней; пунктир - старт 15.10</span></div>';
  h+=chart({xs:xs,series:[{v:v,color:C.grey,w:1},{v:ma,color:C.s1,w:2.2}],w:900,h:200,l:44,vline:idx(D.start),nodata:idx(last)+1,inv:m[0]==='pos'});
  document.getElementById('dynchart').innerHTML=h;
  var W=[['База 14.09-11.10',D.base_win[0],D.base_win[1]],['07-13.10','2026-10-07','2026-10-13'],['С 15.10',D.start,D.w1]];
  var unit={sum:', в неделю',med:', медиана',r:''};
  var rows=M.map(function(mm){var b=win(st.s,mm,W[0][1],W[0][2]),l=win(st.s,mm,W[1][1],W[1][2]),a=win(st.s,mm,W[2][1],W[2][2]);
    var nd=mm[2]==='r'?(mm[5]===1?0:2):(mm[2]==='med'?0:0),dd=b&&a!=null?(a/b-1)*100:null;
    var good=mm[0]==='pos'?dd!=null&&dd<=0:dd!=null&&dd>=0;
    return '<tr'+(mm===m?' style="background:rgba(34,211,238,.06)"':'')+'><td>'+mm[1]+'<span class="muted">'+unit[mm[2]]+'</span></td><td class="r">'+fmt(b,nd)+'</td><td class="r">'+fmt(l,nd)+'</td><td class="r">'+fmt(a,nd)+'</td><td class="r">'+(dd==null?'<span class="muted">-</span>':'<span class="'+(good?'up':'dn')+'">'+(dd>=0?'+':'')+dd.toFixed(0)+'%</span>')+'</td></tr>'});
  document.getElementById('dyntbl').innerHTML='<div class="tbl-wrap"><table class="gtbl single"><thead><tr><th>'+st.n+'</th>'+W.map(function(w){return '<th class="r">'+w[0]+'</th>'}).join('')+'<th class="r">С 15.10 к базе</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
}
draw();

// --- 3. магазин: накопительно с 01.10 против цели месяца
function goalPath(g,d,sc){return g.lo/31*d+(g[sc]-g.lo)*Math.max(0,Math.min(15,d-16))/15}
function storeChart(id,ser,g,title,div,nd){
  var o0=idx('2026-10-01'),xs=[],cum=[],a=0,mid=[],lo=[],hi=[];
  for(var d=1;d<=31;d++){var j=o0+d-1;xs.push(dm(DAYS[j]));var v=ser[j];if(v==null)cum.push(null);else{a+=v/div;cum.push(a)}
    mid.push(goalPath(g,d,'mid'));lo.push(goalPath(g,d,'lo'));hi.push(goalPath(g,d,'hi'))}
  var last=cum.findIndex(function(x){return x==null});
  document.getElementById(id).innerHTML='<div class="ch-h">'+title+' <span class="muted">цель месяца '+fmt(g.mid,div>1?1:0)+' ('+fmt(g.lo,div>1?1:0)+'...'+fmt(g.hi,div>1?1:0)+')</span></div>'
    +chart({xs:xs,series:[{v:mid,color:C.cy,dash:'4 3',w:1.4},{v:cum,color:C.s1,w:2.2,pale:Math.max(0,(last<0?31:last)-3)}],band:{lo:lo,hi:hi},w:440,h:180,l:40,vline:idx(D.start)-o0,nodata:last<0?null:last});
}
storeChart('stU',D.store.orders,D.goal.units.oct,'Заказы, шт, октябрь',1);
storeChart('stT',D.store_rev,D.goal.turn_mln.oct,'Оборот, млн ₽, октябрь',1e6);
})();
