// Approved plan quantities and shared plan/fact presentation. Source facts stay intact.
(function(){
 const sourcePlan=planModel;
 planModel=function(...args){const p=sourcePlan(...args);for(const key of ['leads','deals']){const raw=p.targets[key+'Raw'];if(Number.isFinite(raw))p.targets[key]=Math.round(raw);}p.cohort=null;return p;};
 const format=(key,value)=>key==='conv'?pct(value):key==='rev'||key==='check'?fmtK(value)+' ₽':fmt(value);
 function pair(key,fact,plan,label){
  const available=Number.isFinite(plan)&&plan>0,max=Math.max(fact,available?plan:0,1),att=available?fact/plan:null;
  const bar=(name,value,kind)=>'<div class="gg-pair-line"><span>'+name+'</span><div class="gg-pair-track"><i class="'+kind+'" style="width:'+(100*Math.max(0,value)/max).toFixed(3)+'%"></i></div><b>'+ (name==='План'&&!available?'не задан':esc(format(key,value)))+'</b></div>';
  const difference=Math.abs(fact-plan),gapValue=key==='conv'?(difference*100).toLocaleString('ru',{maximumFractionDigits:1})+' п.п.':format(key,difference);
  const gap=available?(att>=1?'Сверх плана '+gapValue:'До плана '+gapValue):'';
  return '<div class="gg-pair-row" data-pair-key="'+esc(key)+'" data-fact="'+fact+'" data-plan="'+(available?plan:'')+'"><div class="gg-pair-name">'+esc(label)+'</div><div class="gg-pair-bars">'+bar('План',available?plan:0,'gg-pair-plan')+bar('Факт',fact,available?(att>=1?'gg-pair-good':'gg-pair-short'):'gg-pair-neutral')+'</div><div class="gg-pair-result '+(available?(att>=1?'gg-pair-good-text':'gg-pair-short-text'):'')+'"><strong>'+ (available?pct(att):'—')+'</strong><small>'+esc(gap)+'</small></div></div>';
 }
 mgrPlanFactBars=function(arr,planMgr,metric,attain,extra){const rows=(extra&&metric!=='conv'&&metric!=='check')?arr.concat([extra]):arr;return '<div class="gg-manager-pairs">'+rows.map(x=>pair(metric,x.tot,x.unassigned?null:planMgr,x.m)).join('')+'</div>';};
 function sync(){
  const D=FD(),L=FL(),m=mtr(D,L,soldSet(),lostSet()),p=planModel(D,L,m),keys=buckets(S.gran);
  document.querySelectorAll('#root .card').forEach(card=>{
   if(!card.querySelector('.card-title')?.textContent.trim().startsWith('Команда - план-факт'))return;
   const metrics=[['leads','Лиды'],['deals','Сделки'],['won','Продажи'],['prod','В пр-во'],['rev','Выручка'],['conv','Конверсия'],['check','Ср. чек']];
   const table=document.createElement('div');table.className='gg-team-pairs';
   table.innerHTML=metrics.map(([key,label])=>{const ds=['won','rev','check'].includes(key)?soldSet():key==='prod'?prodSet():D,arr=mgrPF(L,ds,key,keys),un=unassignedAgg(L,ds,key,keys);
    const fact=key==='conv'?m.conv:key==='check'?m.check:arr.reduce((sum,x)=>sum+x.tot,0)+(un?un.tot:0);
    const plan=key==='conv'?p.conv:key==='check'?p.check:['won','prod'].includes(key)?Math.round(p.winT):p.targets[key];
    return pair(key,fact,plan,label);
   }).join('');
   const header=card.querySelector('.card-h'),note=document.createElement('p');note.className='gg-pair-note';note.textContent='План и факт показаны отдельно в общей шкале каждой метрики. План лидов и сделок — полное количество за выбранный период, без коэффициента цикла.';
   card.replaceChildren(header,table,note);
  });
  document.querySelectorAll('#root .hm-pf').forEach(matrix=>{const count=+matrix.style.getPropertyValue('--wk');matrix.querySelectorAll('.hm-row').forEach(row=>{if(row.classList.contains('hm-head')){const sum=[...row.children].find(x=>x.textContent.trim()==='Σ');if(sum)while(sum.nextElementSibling)sum.nextElementSibling.remove();}else row.querySelectorAll('.hm-plan,.hm-pct').forEach(x=>x.remove());row.style.gridTemplateColumns='minmax(110px,150px) repeat('+count+',minmax(42px,1fr)) 55px';});});
 }
 const previous=render;render=function(){previous();sync();};render();
})();