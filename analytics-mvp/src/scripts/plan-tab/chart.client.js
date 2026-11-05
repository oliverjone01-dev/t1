(function(){
if(window.planChart)return;
var C={s1:'#F59E0B',cy:'#22D3EE',grey:'#8b9eae',soft:'#232B36',ok:'#34D399',mid:'#E5B567',bad:'#FF7A7E',none:'#3a4654'};
function dm(s){return s.slice(8,10)+'.'+s.slice(5,7)}
function fmt(x,nd){if(x==null||!isFinite(x))return '-';return x.toFixed(nd||0).replace(/\B(?=(\d{3})+(?!\d))/g,' ').replace('.',',')}
function $(id){return document.getElementById(id)}
var tip=document.createElement('div');tip.className='pt-tip';document.body.appendChild(tip);
function showTip(e,h){tip.innerHTML=h;tip.style.display='block';var x=e.clientX+14,y=e.clientY+14;if(x+tip.offsetWidth>innerWidth-8)x=e.clientX-tip.offsetWidth-14;tip.style.left=x+'px';tip.style.top=y+'px'}
function hideTip(){tip.style.display='none'}
// ---------- гладкий график с заливкой, точками и подсказкой
function smooth(pts){if(pts.length<3)return pts.map(function(p,i){return (i?'L':'M')+p[0]+' '+p[1]}).join('');
  var d='M'+pts[0][0]+' '+pts[0][1];for(var i=0;i<pts.length-1;i++){var p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
    d+=' C'+(p1[0]+(p2[0]-p0[0])/6)+' '+(p1[1]+(p2[1]-p0[1])/6)+' '+(p2[0]-(p3[0]-p1[0])/6)+' '+(p2[1]-(p3[1]-p1[1])/6)+' '+p2[0]+' '+p2[1]}return d}
var gid=0;
function chart(el,o){ // series [{v,color,name,area,dash,w,pale,dots}], band, vline, nodata, labels, fmtv
  var W=o.w||900,H=o.h||220,L=o.small?28:46,R=o.small?6:12,T=14,B=24,n=o.xs.length,g=++gid;
  var all=[];o.series.forEach(function(s){s.v.forEach(function(x){if(x!=null)all.push(x)})});if(o.band)o.band.hi.forEach(function(x){all.push(x)});
  var mn=o.inv?Math.min.apply(null,all.length?all:[0]):0,mx=Math.max.apply(null,all.concat([1]));if(o.inv){var t=mx;mx=mn;mn=t}
  var span=(mx-mn)||1;mx+=span*.08*(o.inv?-1:1);
  var X=function(i){return L+(W-L-R)*i/Math.max(1,n-1)},Y=function(v){return H-B-(H-T-B)*(v-mn)/(mx-mn)};
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%"><defs>';
  o.series.forEach(function(sr,k){if(sr.area)s+='<linearGradient id="g'+g+'_'+k+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+sr.color+'" stop-opacity=".35"/><stop offset="1" stop-color="'+sr.color+'" stop-opacity="0"/></linearGradient>'});
  s+='</defs>';
  for(var q=0;q<=(o.small?2:4);q++){var v=mn+(mx-mn)*q/(o.small?2:4),y=Y(v);s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'" stroke="'+C.soft+'" stroke-width="1"/><text x="'+(L-6)+'" y="'+(y+3)+'" text-anchor="end" class="gt">'+fmt(v,o.integer?0:Math.abs(mx-mn)<10?1:0)+'</text>'}
  var step=o.step||Math.max(1,Math.round(n/8));for(var i=0;i<n;i++)if(i%step===0||i===n-1)s+='<text x="'+X(i)+'" y="'+(H-6)+'" text-anchor="middle" class="gt">'+o.xs[i]+'</text>';
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
      if(sr.dots)pts.forEach(function(p){s+='<circle'+(sr.partial?' data-partial-day="'+sr.partial+'" data-value="'+sr.v[p[2]]+'"':'')+' cx="'+p[0]+'" cy="'+p[1]+'" r="3.5" fill="'+sr.color+'" stroke="#12161f" stroke-width="2"'+(sr.pale!=null&&p[2]>sr.pale?' opacity=".4"':'')+'/>'});
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

window.planChart=chart;
})();
