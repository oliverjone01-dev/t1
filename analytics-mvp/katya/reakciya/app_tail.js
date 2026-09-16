/* ===== 6. три уровня ===== */
block('Три уровня',function(){
const c=card('Три уровня: товар, группа, магазин','Выбранный период против такого же предыдущего. Позиция в поиске и соинвест считаются медианой, остальное суммой. Колонка «соинвест сейчас» всегда берётся из последнего снимка цен и от периода не зависит.<br>Деление простое: «Зеркала» это всё, где в названии есть слово зеркало, 86 товаров. «Мебель» это все остальные 428: столы и столики, консоли, ширмы и перегородки, а также подстолья и столешницы. Комплектующие считаются вместе с мебелью.',TD);
const wrap=el('div','tw'); const tb=el('table','t lvl-tbl');
const hint=el('div','card-sub'); hint.style.marginBottom='8px';
const rows=['Магазин','Мебель','Зеркала','С рекламой','Без рекламы'];
const M=[['search_position','Позиция в поиске','med'],['search_views','Показы в поиске','sum'],['pdp_views','Посещения карточек','sum'],['ordered_units','Заказы','sum']];
function draw(){
 const [mf,mt]=metWindow(), [pf,pt]=prevWindow();
 hint.innerHTML='Период: <b style="color:var(--accent)">'+dmy(mf)+' - '+dmy(mt)+'</b> против <b>'+dmy(pf)+' - '+dmy(pt)+'</b>';
 tb.innerHTML='<thead><tr><th class="l">Уровень</th><th>Товаров</th>'+M.map(m=>`<th>${m[1]}</th>`).join('')+'<th>Соинвест сейчас</th></tr></thead><tbody>'+
 rows.map(k=>`<tr><td class="l" style="font-weight:600">${k}</td><td class="mono" style="color:var(--ink-3)">${D.levels_n[k]||0}</td>`+
  M.map(m=>{const cur=agg(k,m[0],mf,mt), prev=agg(k,m[0],pf,pt);
   if(cur==null) return '<td class="eff na">-</td>';
   const dlt=(prev==null||prev===0)?null:((m[2]==='med')?(cur-prev):((cur/prev-1)*100));
   const good=(m[0]==='search_position')?(dlt<0):(dlt>0);
   const col=dlt==null?'var(--ink-3)':(Math.abs(dlt)<3?'var(--ink-3)':(good?'var(--up)':'var(--dn)'));
   return `<td><span class="mono">${fmt(cur)}</span><div class="eff" style="color:${col}">${dlt==null?'':pc(dlt)+(m[2]==='med'?'':' %')}</div></td>`}).join('')+
  `<td><span class="mono" style="font-weight:600">${((D.coinv[k]||[null])[0]===null?'-':(D.coinv[k]||[null])[0])} %</span><div class="g">${(D.coinv[k]||[0,0])[1]} товаров</div></td></tr>`).join('')+'</tbody>';
}
draw(); onPeriod(draw);
c.appendChild(hint); wrap.appendChild(tb); c.appendChild(wrap);
const diff=(D.coinv['С рекламой'][0]-D.coinv['Без рекламы'][0]).toFixed(1).replace('.',',');
c.appendChild(el('div','note ok','<b>Главная строка.</b> Разница по соинвесту между товарами с активной кампанией и остальными сейчас '+diff+' пункта на '+D.coinv['С рекламой'][1]+' товарах. Это закон 2, замеренный на сегодняшнем снимке цен. Пока разница держится, копеечные кампании работают.'));
});

/* ===== 10. что делать сегодня (сворачиваемый) ===== */
block('Что делать сегодня',function(){
const n=D.alerts.filter(a=>a.sev!=='ok').length;
const body=foldCard('Что делать сегодня','Список собирается из правил автоматически: сверху то, что уже нарушено и не стоит денег исправить, снизу плановые шаги.','<span class="tag data">'+plu(n,['пункт','пункта','пунктов'])+'</span>',false);
const pr={high:1,mid:2,low:3,ok:9};
const items=D.alerts.filter(a=>a.sev!=='ok').sort((a,b)=>pr[a.sev]-pr[b.sev]).map(a=>({p:pr[a.sev],t:a.rule+': '+a.what,d:a.action,w:a.n?plu(a.n,['товар','товара','товаров']):'кабинет',ww:'сейчас'}));
items.push({p:3,t:'Снять кабинет и пересобрать вкладку',d:'Раз в два дня: логи действий, цены, воронка. Лента и алерты пересчитываются сами',w:'раз в 2 дня',ww:'регламент'});
items.push({p:3,t:'Запустить тест бюджетов',d:'4 кампании ужать до 1 750 ₽ в неделю, 4 оставить как есть, замер через 2 недели',w:'2 недели',ww:'тест'});
const w=el('div','todo');
items.slice(0,9).forEach((x,i)=>{w.innerHTML+=`<div class="td p${x.p}"><div class="td-n">${i+1}</div>
 <div><div class="td-t">${x.t}</div><div class="td-d">${x.d}</div></div><div class="td-w"><b>${x.w}</b>${x.ww}</div></div>`});
body.appendChild(w);
});

/* ===== 11. правила (сворачиваемый) ===== */
block('Правила',function(){
const bad=D.alerts.filter(a=>a.sev!=='ok').length;
const body=foldCard('Правила и нарушения','Семь правил проверяются на каждом обновлении. Зелёное значит правило выполняется, красное значит нарушено прямо сейчас.','<span class="tag hypo">нарушено '+bad+' из '+D.alerts.length+'</span>',false);
const g=el('div','alerts');
const lbl={high:'срочно',mid:'важно',low:'к сведению',ok:'в норме'};
D.alerts.forEach(a=>{const d=el('div','al '+a.sev);
 d.innerHTML=`<div class="al-h"><div class="al-r">${a.rule}</div><div class="al-n">${lbl[a.sev]}${a.n?' · '+a.n:''}</div></div>
 <div class="al-w">${a.what}</div><div class="al-d">${a.detail}</div><div class="al-a"><b>Что делать.</b> ${a.action}</div>`;
 g.appendChild(d)});
body.appendChild(g);
});

/* ===== 12. регламент ===== */
app.insertAdjacentHTML('beforeend','<div class="card" style="border-style:dashed"><div class="card-title">Как эта вкладка обновляется</div><div class="card-sub" style="max-width:none;line-height:1.7;margin-top:8px">Раз в два дня при включённом компьютере и открытом Chrome снимаются: лог действий по каждой кампании и по обоим инструментам оплаты за заказ, текущие цены и акции по всем товарам, воронка по товарам. Всё, что отдаёт API, берётся через API; страницы, которые API не отдаёт, читаются из живой вкладки.<br><br>Эффект считается сравнением метрик затронутых товаров до и после, за вычетом такого же изменения по магазину за те же дни. Это защищает от того, чтобы приписать рекламе общий подъём площадки, но не заменяет честный тест с контрольной группой.<br><br>Чего вкладка пока не умеет: воронка по товарам приходит на несколько дней позже цен, поэтому у самых свежих действий эффект показывается как «ждём». Состав товаров в кампании известен только по тем, у кого менялась ставка. Расход и ДРР по дням в ленту не подтянуты, они в разделе «Маркетинг».</div></div>');
