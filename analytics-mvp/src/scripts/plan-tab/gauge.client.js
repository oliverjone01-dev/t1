// Shared October/November gauge renderer. Presentation only.
(function(){
var C={s1:'#F59E0B',cy:'#22D3EE',grey:'#8b9eae',soft:'#232B36',ok:'#34D399',mid:'#E5B567',bad:'#FF7A7E',none:'#3a4654'};
function dm(s){return s.slice(8,10)+'.'+s.slice(5,7)}
function fmt(x,nd){if(x==null||!isFinite(x))return '-';return x.toFixed(nd||0).replace(/\B(?=(\d{3})+(?!\d))/g,' ').replace('.',',')}
// статус к плану: идём / отстаём до 30% / отстаём сильнее
// hiBad - расход: чем меньше, тем зеленее
function stOf(pct,hiBad){if(pct==null)return {c:C.none,t:'нет данных',i:'○'};
  if(hiBad)return pct>120?{c:C.bad,t:'перерасход',i:'▲'}:pct>100?{c:C.mid,t:'выше плана',i:'!'}:{c:C.ok,t:'в плане',i:'✓'};
  if(pct>=100)return {c:C.ok,t:hiBad?'в плане':'идём',i:'✓'};if(pct>=70)return {c:C.mid,t:'отстаём',i:'!'};return {c:C.bad,t:hiBad?'недобор':'сильно отстаём',i:'✕'}}

// ---------- спидометр
function gauge(o){ // o: title, val, plan, l1, l2, l3, hiBad, pre, early; mark - метка «план на дату» в % от плана, stPct - % к плану на дату (цвет)
  var W=240,H=150,cx=120,cy=112,r=82,pct=o.val==null||!o.plan?null:o.val/o.plan*100,MAX=150;
  function pt(p,rr){var a=Math.PI*(1-Math.min(MAX,Math.max(0,p))/MAX);return [cx+rr*Math.cos(a),cy-rr*Math.sin(a)]}
  function arc(p0,p1,col,z){var a=pt(p0,r),b=pt(p1,r);return '<path d="M'+a[0]+' '+a[1]+' A'+r+' '+r+' 0 0 1 '+b[0]+' '+b[1]+'" stroke="'+col+'" stroke-width="16" fill="none"'+(z?' data-z0="'+z[0]+'" data-z1="'+z[1]+'"':'')+'/>'}
  // цветные зоны строятся от метки «план на дату» (Иван 15.10, ФЕНИКС G1): цвет под стрелкой = статус к плану на дату
  var mk=o.mark!=null?o.mark:100,k=mk>0?mk/100:1,Z=function(x){return Math.min(MAX,x*k)};
  var zones=(o.neutral?[[0,1e9,C.none]]:o.hiBad?[[0,100,C.ok],[100,120,C.mid],[120,1e9,C.bad]]:[[0,70,C.bad],[70,100,C.mid],[100,1e9,C.ok]])
    .map(function(z){return [Z(z[0]),Z(z[1]),z[2]]}).filter(function(z){return z[1]>z[0]});
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%">';
  // зазор между дугами не больше четверти зоны: в первые дни периода жёлтая уже 1,4 п. и иначе пропадала (Codex P2 #482, ФЕНИКС G3)
  zones.forEach(function(z){var g=Math.min(.7,(z[1]-z[0])/4);s+=arc(z[0]+g,z[1]-g,z[2],z)});
  (o.neutral?[]:[[0,'0'],[100,'100%'],[150,'150%']]).forEach(function(t){var a=pt(t[0],r+20);s+='<text x="'+a[0]+'" y="'+(a[1]+(t[0]===100?0:16))+'" text-anchor="middle" class="gl">'+t[1]+'</text>'});
  var m=pt(mk,r-11),m2=pt(mk,r+11);if(!o.neutral)s+='<line x1="'+m[0]+'" y1="'+m[1]+'" x2="'+m2[0]+'" y2="'+m2[1]+'" stroke="#e8eef2" stroke-width="2.5"/>';
  if(pct!=null&&!o.neutral){var n=pt(pct,r-24);s+='<line x1="'+cx+'" y1="'+cy+'" x2="'+n[0]+'" y2="'+n[1]+'" stroke="#e8eef2" stroke-width="3.5" stroke-linecap="round"/>'}
  s+='<circle cx="'+cx+'" cy="'+cy+'" r="7" fill="#e8eef2"/>';
  s+='<text x="'+cx+'" y="'+(cy+32)+'" text-anchor="middle" class="gv">'+(o.neutral?(o.neutralLabel||'факт'):o.early?'рано':pct==null?'нет данных':fmt(pct)+'%')+'</text></svg>';
  var sp=o.stPct!==undefined?o.stPct:pct,st=o.pre?{c:C.grey,t:'до плана',i:'○'}:stOf(sp,o.hiBad);
  var zc='';if(pct!=null){var pc=Math.min(MAX,pct);zones.forEach(function(z){var top=z[1]>=MAX;   // границы как в stOf: расход - «больше 100», заказы - «не меньше 100»
    if(o.hiBad?((pc>z[0]||z[0]===0)&&(pc<=z[1]||top)):(pc>=z[0]&&(pc<z[1]||top)))zc=z[2]})}
  return '<div class="gauge" data-zone="'+zc+'" data-pct="'+(pct==null?'':pct)+'" data-st="'+(sp==null||o.early?'':st.c)+'"><div class="g-t">'+o.title+'</div>'+s+'<div class="g-l1">'+o.l1+'</div><div class="g-l2">'+o.l2+(sp==null||o.early?'':' · <span style="color:'+st.c+'">'+st.i+' '+st.t+'</span>')+'</div>'+(o.l3?'<div class="g-l2 muted">'+o.l3+'</div>':'')+'</div>';
}
window.planGauge=gauge;
window.planGaugeStatus=stOf;
})();
