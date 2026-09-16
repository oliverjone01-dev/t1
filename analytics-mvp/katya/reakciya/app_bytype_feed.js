/* ===== 3. лента действий: свод по типам + все строки ===== */
block('Лента действий',function(){
const c=card('Лента действий','Каждая правка в кабинете и что из неё вышло. Один и тот же набор действий показан двумя способами: <b style="color:var(--accent)">свод по типам</b> отвечает на вопрос «какой рычаг вообще сильнее», <b style="color:var(--accent)">все строки</b> отвечают на вопрос «что я сделала и что из этого вышло». Фильтры, период и горизонт общие для обоих видов. В своде строка раскрывается в список случаев, из которых сложилась медиана.',TD);
let view='свод по типам', hz=2, fScope='все', fFam='все', fCat='все', fEff='все', lim=25;
const open={}, clim={};
const bar=el('div','fbar'), bar2=el('div','fbar');
const mk=(arr,get,set)=>{const ch=el('div','chips');arr.forEach(v=>{const b=el('button','chip'+(get()===v?' act':''));b.textContent=v;b.onclick=()=>{set(v);draw()};ch.appendChild(b)});return ch};
const wrap=el('div','tw'); const tb=el('table','t');
const cnt=el('div','card-sub'); cnt.style.marginBottom='8px';
const more=el('button','chip'); more.style.cssText='margin-top:10px;display:none;border:1px solid var(--border);background:var(--bg-elevated);width:100%;text-align:center';
more.onclick=()=>{lim+=25;draw()};

/* шкалы: узкие для строк, широкие для медиан */
const M =[['coinv','Соинвест','pt','up',6],['search_views','Показы','%','up',40],['search_position','Позиция','pt','down',25],['pdp_views','Карточка','%','up',40],['ordered_units','Заказы','%','up',60]];
const MD=[['coinv','Соинвест','pt','up',12],['search_views','Показы в поиске','%','up',300],['search_position','Позиция','pt','down',80],['pdp_views','Карточка','%','up',150],['ordered_units','Заказы','%','up',150]];

function ec(v,unit,dir,thr){
 if(v==null) return '<span class="ec na">ждём</span>';
 const good=(dir==='up')?v>0:v<0, a=Math.abs(v);
 const small=a<(unit==='pt'?1:5);
 return `<span class="ec ${small?'z':(good?(a>=thr?'g2':'g1'):(a>=thr?'r2':'r1'))}">${pc(v)}</span>`;
}
function dv(v,n,unit,dir,scale){
 if(v==null) return '<div class="dv"><u></u><span style="color:var(--ink-4);font-weight:400;left:50%;transform:translateX(-50%)">'+(n?('мало данных · '+n):'нет')+'</span></div>';
 const good=(dir==='up')?v>0:v<0;
 const w=Math.min(48,Math.abs(v)/scale*48);
 const col=good?'var(--up)':'var(--dn)', neg=v<0;
 const lab=`${pc(v)}${unit==='pt'?'':'%'}`, inside=w>=33;
 const pos=inside?(neg?'right:calc(50% + 6px)':'left:calc(50% + 6px)'):(neg?`right:calc(50% + ${w}% + 5px)`:`left:calc(50% + ${w}% + 5px)`);
 return `<div class="dv"><u></u><i style="${neg?'right:50%':'left:50%'};width:${w}%;background:${col};opacity:${inside?'.95':'.75'}"></i><span style="color:${inside?'#0B0F15':col};${pos}">${lab}</span></div>`;
}
function spark(arr){
 if(!arr||!arr.length) return '';
 const vals=arr, ok=vals.filter(x=>x!=null);
 if(ok.length<3) return '<span class="eff na" style="font-size:10px">нет ряда</span>';
 const mx=Math.max(...ok), mn=Math.min(...ok), rng=(mx-mn)||1;
 const W=118,H=26,n=vals.length,step=W/(n-1);
 let dpath='',prev=null;
 vals.forEach((v,i)=>{const x=i*step; if(v==null){prev=null;return;} const y=H-2-((v-mn)/rng)*(H-6);
  dpath+=(prev===null?'M':'L')+x.toFixed(1)+','+y.toFixed(1)+' '; prev=v});
 const xm=7*step;
 return `<svg class="spk" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <line x1="${xm.toFixed(1)}" y1="0" x2="${xm.toFixed(1)}" y2="${H}" stroke="var(--warn)" stroke-width="1" stroke-dasharray="2 2" opacity=".7"/>
  <path d="${dpath}" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function objOf(f){return f.scope==='магазин'?'весь магазин':(f.art||f.campname||'кампания')+((f.nsku||1)>1?' · '+f.nsku+' SKU':'')}
function detOf(f){const d=String(f.detail);return d===f.fam?'-':(d.indexOf(f.fam+' ')===0?d.slice(f.fam.length+1):d)}

function cases(g){
 const rs=g.rows.slice().sort((a,b)=>{
  const ea=EV(a,'search_views',hz)!=null?0:1, eb=EV(b,'search_views',hz)!=null?0:1;
  if(ea!==eb) return ea-eb;
  return a.ts<b.ts?1:-1;
 });
 const done=rs.filter(r=>EV(r,'search_views',hz)!=null).length;
 const lm=clim[g.fam]||15, shown=rs.slice(0,lm);
 let h='<div style="padding:8px 10px 12px 10px;border-left:2px solid var(--accent);margin:2px 0 2px 6px">';
 h+='<div class="card-sub" style="margin-bottom:7px">Случаи этого типа в текущих фильтрах: '+plu(rs.length,['штука','штуки','штук'])+
    ', эффект посчитан у '+done+'. Медиана в строке выше собрана именно из них. Сначала те, у кого эффект посчитан, дальше по дате.'+
    (rs.length>lm?' Показано '+lm+'.':'')+'</div>';
 h+='<table class="t" style="width:100%"><thead><tr><th class="l">Когда</th><th class="l">Объект</th><th class="l">Что именно</th>'+
    M.map(m=>`<th>${m[1]}</th>`).join('')+'<th class="l">Показы, неделя до и после</th></tr></thead><tbody>';
 h+=shown.map(f=>`<tr><td class="l mono" style="white-space:nowrap">${dmy(f.ts)}</td>`+
   `<td class="l" style="max-width:170px;overflow:hidden;text-overflow:ellipsis">${objOf(f)}<div style="color:var(--ink-4);font-size:10px">${f.cat||f.scope}</div></td>`+
   `<td class="l" style="max-width:250px;overflow:hidden;text-overflow:ellipsis;color:var(--ink-3);font-size:11px" title="${String(f.detail).replace(/"/g,'')}">${detOf(f)}${f.nc?' <span class="pill wait" style="font-size:9px;padding:1px 4px">без контроля</span>':''}</td>`+
   M.map(m=>`<td style="text-align:center${f.weak?';opacity:.45':''}"${f.weak?' title="мало показов до действия ('+(f.base==null?'нет данных':f.base+' за неделю')+'), проценты ненадёжны"':''}>${ec(EV(f,m[0],hz),m[2],m[3],m[4])}</td>`).join('')+
   `<td class="l">${spark(f.sp)}</td></tr>`).join('');
 h+='</tbody></table>';
 if(rs.length>lm) h+='<button class="chip" data-more="'+g.fam+'" style="margin-top:9px;width:100%;text-align:center;border:1px solid var(--border);background:var(--bg-card)">Показать ещё '+Math.min(25,rs.length-lm)+' из '+(rs.length-lm)+'</button>';
 h+='</div>';
 return h;
}

function draw(){
 const base=feedIn();
 const day=window.__feedDay;
 const all=base.filter(f=>(fScope==='все'||f.scope===fScope)&&(fFam==='все'||f.fam===fFam)&&(fCat==='все'||f.cat===fCat)
   &&(fEff==='все'||EV(f,'search_views',hz)!=null)&&(!day||f.ts.slice(0,10)===day));

 bar.innerHTML=''; bar2.innerHTML='';
 bar.appendChild(el('span','card-sub','Вид'));
 bar.appendChild(mk(['свод по типам','все строки'],()=>view,v=>{view=v;lim=25}));
 bar.appendChild(el('span','card-sub','Горизонт'));
 bar.appendChild(mk(['+1 день','+3 дня','+7 дней'],()=>['+1 день','+3 дня','+7 дней'][hz],v=>{hz=['+1 день','+3 дня','+7 дней'].indexOf(v)}));
 bar2.appendChild(el('span','card-sub','Срез'));
 bar2.appendChild(mk(['все','товар','кампания','магазин'],()=>fScope,v=>{fScope=v;lim=25}));
 bar2.appendChild(el('span','card-sub','Группа'));
 bar2.appendChild(mk(['все','Мебель','Зеркала'],()=>fCat,v=>{fCat=v;lim=25}));
 bar2.appendChild(el('span','card-sub','Эффект'));
 bar2.appendChild(mk(['все','посчитан'],()=>fEff,v=>{fEff=v;lim=25}));
 if(view==='все строки'){
  const fams=['все'].concat([...new Set(base.map(f=>f.fam))]);
  bar2.appendChild(el('span','card-sub','Тип'));
  bar2.appendChild(mk(fams,()=>fFam,v=>{fFam=v;lim=25}));
 } else if(fFam!=='все'){ fFam='все'; }

 const withE=all.filter(x=>EV(x,'search_views',hz)!=null).length;
 let info=plu(all.length,['действие','действия','действий'])+' в выборке · с посчитанным эффектом '+withE;
 if(withE<all.length) info+=' · у остальных горизонт ещё не закрыт, воронка приходит по '+dmy(D.data_until);

 if(view==='свод по типам'){
  tb.className='bt'; more.style.display='none';
  const groups={};
  all.forEach(x=>{const g=groups[x.fam]=groups[x.fam]||{fam:x.fam,n:0,rows:[]};g.n++;g.rows.push(x)});
  const rows=Object.values(groups).sort((a,b)=>b.n-a.n);
  tb.innerHTML='<thead><tr><th class="l">Тип действия</th><th>Случаев</th>'+MD.map(m=>`<th>${m[1]}</th>`).join('')+'</tr></thead><tbody>'+
  (rows.length?rows.map(g=>{
   const weak=g.n<5, op=!!open[g.fam];
   return `<tr data-fam="${g.fam}" style="cursor:pointer${weak?';opacity:.5':''}" title="нажмите, чтобы раскрыть все случаи"><td class="l" style="font-weight:600"><span style="color:var(--accent);display:inline-block;width:12px">${op?'▾':'▸'}</span>${g.fam}</td><td style="text-align:center" class="mono">${g.n}</td>`+
   MD.map(m=>{const vs=g.rows.map(r=>EV(r,m[0],hz)).filter(v=>v!=null);
    return `<td title="наблюдений с посчитанным эффектом: ${vs.length} из ${g.n}">${dv(vs.length>=3?med(vs):null,vs.length,m[2],m[3],m[4])}</td>`}).join('')+'</tr>'+
   (op?`<tr class="expr"><td colspan="7" style="padding:0;background:var(--bg-elevated)">${cases(g)}</td></tr>`:'');
  }).join(''):'<tr><td colspan="7" class="l" style="color:var(--ink-3)">В этом периоде и фильтрах действий нет</td></tr>')+'</tbody>';
  [...tb.querySelectorAll('tr[data-fam]')].forEach(tr=>{tr.onclick=()=>{const k=tr.getAttribute('data-fam');open[k]=!open[k];if(!open[k])clim[k]=15;draw()}});
  [...tb.querySelectorAll('button[data-more]')].forEach(b=>{b.onclick=e=>{e.stopPropagation();const k=b.getAttribute('data-more');clim[k]=(clim[k]||15)+25;draw()}});
  info+=' · свёрнуто в '+plu(rows.length,['тип','типа','типов'])+', в ячейке медиана по случаям';
  if(withE<9) info+=' <b style="color:var(--warn)">На этом окне выводов делать нельзя: возьмите 30 или 90 дней</b>';
 } else {
  tb.className='t feedt';
  const rows=all.slice(0,lim);
  tb.innerHTML='<thead><tr><th class="l">Когда</th><th class="l">Что сделали</th><th class="l">Объект</th>'+
    M.map(m=>`<th>${m[1]}</th>`).join('')+'<th class="l">Показы, неделя до и после</th></tr></thead><tbody>'+
  (rows.length?rows.map(f=>`<tr><td class="l mono" style="white-space:nowrap">${dmy(f.ts)}<div style="color:var(--ink-4);font-size:10px;font-family:Inter">${f.user}</div></td>
   <td class="l" style="max-width:330px;overflow:hidden;text-overflow:ellipsis" title="${String(f.detail).replace(/"/g,'')}"><b style="font-weight:600">${f.fam}</b>${detOf(f)!=='-'?' <span style="color:var(--ink-3);font-size:11px">'+detOf(f)+'</span>':''}${f.nc?' <span class="pill wait" style="font-size:9.5px;padding:1px 5px">без контроля</span>':''}</td>
   <td class="l" style="max-width:190px;overflow:hidden;text-overflow:ellipsis">${objOf(f)}<div style="color:var(--ink-4);font-size:10px">${f.cat||f.scope}</div></td>`+
   M.map(m=>`<td style="text-align:center${f.weak?';opacity:.45':''}"${f.weak?' title="мало показов до действия ('+(f.base==null?'нет данных':f.base+' за неделю')+'), проценты ненадёжны"':''}>${ec(EV(f,m[0],hz),m[2],m[3],m[4])}</td>`).join('')+
   `<td class="l">${spark(f.sp)}</td></tr>`).join(''):'<tr><td colspan="9" class="l" style="color:var(--ink-3)">В этом периоде и фильтрах действий нет</td></tr>')+'</tbody>';
  info+=' · показано '+rows.length;
  more.style.display=(all.length>rows.length)?'block':'none';
  more.textContent='Показать ещё '+Math.min(25,all.length-rows.length);
 }
 if(day) info+=' · <b style="color:var(--accent)">только за '+dmy(day)+'</b> <button class="chip" id="clrday" style="padding:1px 7px;font-size:10.5px">снять</button>';
 cnt.innerHTML=info;
 const cb=$('#clrday'); if(cb) cb.onclick=()=>{window.__feedDay=null;draw()};
}
window.__drawFeed=()=>{view='все строки';lim=25;draw()};
onPeriod(()=>{lim=25;draw()});
c.appendChild(bar); c.appendChild(bar2); c.appendChild(cnt); wrap.appendChild(tb); c.appendChild(wrap); c.appendChild(more);
c.appendChild(el('div','note','<b>Что означает цифра.</b> И в своде, и в строках это сдвиг <u>одного товара</u> сверх общего движения магазина за те же дни: «после этой правки карточка добавила столько-то по сравнению с тем, как в эти дни жил весь магазин». Это не изменение магазина. Исключение - действия по оплате за заказ «все товары»: они двигают весь магазин сразу, сравнивать не с чем, у таких строк стоит пометка «без контроля» и цифра сырая.<br><br><b>Горизонт.</b> Окно измерения после действия, всегда против семи дней до неё. Соинвест отзывается в тот же час, бонус к скидке от кампании за клик приходит через 43-57 часов, позиция и заказы копятся дольше. Поэтому +1 показывает мгновенную реакцию цены, а +7 показывает, чем всё кончилось.'));
draw();
});

/* ===== 4. как читать ленту (сворачиваемый) ===== */
block('Как читать ленту',function(){
const body=foldCard('Как читать ленту действий','Легенда цветов и три оговорки, без которых по ленте легко сделать неверный вывод.','',false);
const g=el('div','howto');
[['Пять ячеек эффекта','Соинвест и позиция в пунктах, показы, карточка и заказы в процентах. Бледная ячейка значит в пределах шума, яркая заливка значит сильное движение. Для позиции «лучше» это минус.'],
 ['Полоска справа','Показы в поиске за семь дней до и семь дней после действия, пунктир это день действия. Нужна, чтобы видеть форму, а не только итоговое число.'],
 ['Приглушённые строки','До действия у товара было меньше 50 показов в неделю. Проценты считаются от почти нуля и легко дают плюс триста. Наведите курсор чтобы увидеть базу.'],
 ['Заказы по одному товару','Редкое событие: у половины карточек ноль или один заказ в неделю. Колонка скачет, судить по ней об отдельном действии нельзя. Смотрите показы, позицию и соинвест.']].forEach(([t,b])=>{
  const d=el('div','hw');d.innerHTML=`<div class="hw-t">${t}</div><div class="hw-b">${b}</div>`;g.appendChild(d)});
body.appendChild(g);
const lg=el('div','lgnd'); lg.style.marginTop='12px';
lg.innerHTML='<span class="lg">Шкала:</span><span class="lg"><span class="ec g2">+58</span> сильно лучше</span><span class="lg"><span class="ec g1">+7</span> лучше</span>'+
 '<span class="lg"><span class="ec z">+1</span> шум</span><span class="lg"><span class="ec r1">-9</span> хуже</span><span class="lg"><span class="ec r2">-64</span> сильно хуже</span>'+
 '<span class="lg"><span class="ec na">ждём</span> горизонт не закрыт</span>';
body.appendChild(lg);
});

