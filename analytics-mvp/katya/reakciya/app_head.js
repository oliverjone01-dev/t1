const $=(s,r)=>(r||document).querySelector(s), el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e};
const fmt=n=>n==null?'-':Math.round(n).toLocaleString('ru-RU').replace(/,/g,' ');
const pc=n=>n==null?'-':(n>0?'+':'')+n.toFixed(1).replace('.',',');
const plu=(n,f)=>{const n1=n%10,n2=n%100;return n+' '+((n1===1&&n2!==11)?f[0]:((n1>=2&&n1<=4&&(n2<10||n2>=20))?f[1]:f[2]))};
const dmy=s=>s?s.slice(8,10)+'.'+s.slice(5,7)+(s.length>10?' '+s.slice(11,16):''):'';
const tip=$('#tip');
function tipOn(e,html){tip.innerHTML=html;tip.style.display='block';tipMove(e)}
function tipMove(e){const r=tip.getBoundingClientRect();let x=e.clientX+14,y=e.clientY+14;if(x+r.width>innerWidth-8)x=e.clientX-r.width-14;if(y+r.height>innerHeight-8)y=e.clientY-r.height-14;tip.style.left=x+'px';tip.style.top=y+'px'}
function tipOff(){tip.style.display='none'}
function bind(node,html){node.addEventListener('mouseenter',e=>tipOn(e,html));node.addEventListener('mousemove',tipMove);node.addEventListener('mouseleave',tipOff)}
const app=$('#app');
const boot=$('#boot'); if(boot) boot.remove();
function card(title,sub,tag){const c=el('div','card');const h=el('div','card-h');h.appendChild(el('div','',`<div class="card-title">${title}${tag||''}</div><div class="card-sub">${sub||''}</div>`));c.appendChild(h);app.appendChild(c);return c}
function foldCard(title,sub,tag,openByDefault){
 const c=el('div','card fold'+(openByDefault?' open':''));
 const h=el('div','fold-h');
 h.innerHTML=`<div><div class="card-title">${title}${tag||''}</div><div class="card-sub">${sub||''}</div></div><div class="fold-x">${openByDefault?'свернуть':'развернуть'}</div>`;
 const body=el('div','fold-b');
 h.onclick=()=>{c.classList.toggle('open');h.querySelector('.fold-x').textContent=c.classList.contains('open')?'свернуть':'развернуть'};
 c.appendChild(h); c.appendChild(body); app.appendChild(c); return body;
}
const TD='<span class="tag data">данные</span>', TH='<span class="tag hypo">гипотеза</span>';

/* ===== период ===== */
const TODAY=D.updated, DUNTIL=D.data_until;
const PERIODS=[[7,'7 дней'],[14,'14 дней'],[30,'30 дней'],[95,'весь период']];
let P=30;
const SUBS=[];
function onPeriod(f){SUBS.push(f)}
function fire(){SUBS.forEach(f=>{try{f()}catch(e){console.error(e)}})}
function shift(dateStr,days){
 var d=new Date(dateStr+'T00:00:00Z');
 if(isNaN(d.getTime())) return dateStr;
 d.setUTCDate(d.getUTCDate()+days);
 return d.toISOString().slice(0,10);
}
function actWindow(){return [shift(TODAY,-P+1),TODAY]}
function metWindow(){return [shift(DUNTIL,-P+1),DUNTIL]}
function prevWindow(){return [shift(DUNTIL,-2*P+1),shift(DUNTIL,-P)]}
function periodLabel(){return PERIODS.find(x=>x[0]===P)[1]}

(function(){
 const box=$('#periodbox');
 PERIODS.forEach(([v,t])=>{const b=el('button','pb'+(v===P?' act':''));b.textContent=t;
  b.onclick=()=>{P=v;[...box.querySelectorAll('.pb')].forEach(x=>x.classList.toggle('act',x.textContent===t));fire()};
  box.appendChild(b)});
})();
{const nh=$('#navhint'); if(nh) nh.textContent='обновлено '+dmy(D.updated)+' · воронка по '+dmy(D.data_until)+' · цены на '+dmy(D.prices_until);
}
{const bs=$('#brandsub'); if(bs) bs.textContent=D.feed.length+' действий с посчитанным эффектом · '+D.totals.camps+' кампаний · '+D.totals.skus+' товаров';}

/* ===== хелперы по данным ===== */
function feedIn(){const [a,b]=actWindow();return D.feed.filter(f=>f.ts.slice(0,10)>=a&&f.ts.slice(0,10)<=b)}
function med(arr){const v=arr.filter(x=>x!=null).sort((a,b)=>a-b);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2}
const DDATES=D.daily._dates||[], DMET=D.daily._met||[];
const EI={}; (D.emet||[]).forEach((m,i)=>EI[m]=i);
const EV=(f,m,h)=>{const i=EI[m];return (i==null||!f.e)?null:f.e[i*3+h]};
function agg(group,metric,from,to){
 const g=D.daily[group]; if(!g) return null;
 const mi=DMET.indexOf(metric); if(mi<0) return null;
 const arr=g[mi]||[]; const out=[];
 for(let i=0;i<DDATES.length;i++){const d=DDATES[i];if(d>=from&&d<=to&&arr[i]!=null)out.push(arr[i])}
 if(!out.length)return null;
 return (metric==='search_position'||metric==='coinv')?med(out):out.reduce((a,b)=>a+b,0);
}
function seriesOf(group,metric,from,to){
 const g=D.daily[group]; const mi=DMET.indexOf(metric);
 if(!g||mi<0) return [];
 const arr=g[mi]||[]; const out=[];
 for(let i=0;i<DDATES.length;i++){const d=DDATES[i];if(d>=from&&d<=to)out.push([d,arr[i]==null?null:arr[i]])}
 return out;
}
function block(name,fn){try{fn()}catch(e){
 console.error(name,e);
 const c=el('div','card');c.style.borderColor='var(--dn)';
 c.innerHTML='<div class="card-title" style="color:var(--dn)">Блок «'+name+'» не отрисовался</div><div class="card-sub" style="margin-top:6px">'+String(e&&e.message||e)+'</div>';
 app.appendChild(c);}}
