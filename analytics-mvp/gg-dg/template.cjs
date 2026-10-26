'use strict';
function once(s,from,to){if(s.split(from).length!==2)throw Error('GG template contract changed: '+from.slice(0,80));return s.replace(from,to);}
function section(s,name,edit){const a=s.indexOf('function '+name+'('),b=s.indexOf('\nfunction ',a+1);if(a<0||b<0)throw Error('Missing GG function '+name);return s.slice(0,a)+edit(s.slice(a,b))+s.slice(b);}
function adaptTemplate(input,hook){let s=input.replace(/\r\n/g,'\n');
  // The partner dashboard has no plan UI, including the fixed header dock.
  const planDock=s.match(/<!-- Плавающий док плана:[\s\S]*?(?=<div class="foot">)/);
  if(!planDock)throw Error('Missing plan dock contract');
  s=once(s,planDock[0],'');
  s=once(s,'Меняет выручку, средний чек, план и динамику - и по отделу, и в разрезе менеджеров','Меняет выручку, средний чек и денежные показатели ДГ');
  s=once(s,'План в таблице - общий, поэтому % выполнения корректен при «Все направления»','Фильтрует показатели только по выбранному направлению ДГ');
  s=once(s,'<title>GENGLASS · Командный центр РОПа</title>','<title>GG&DG · Домгласс</title><meta name="robots" content="noindex,nofollow"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Ctext x=%221%22 y=%2224%22 font-size=%2220%22 fill=%22%2322d3ee%22%3EDG%3C/text%3E%3C/svg%3E">');
  s=s.replaceAll('GENGLASS · Отдел продаж','GG&DG · Домгласс').replaceAll('Командный центр РОПа · воронка «GG Заказы РФ»','Лиды и сделки · «Заявка с ДГ» · входящие от domglass.ru').replaceAll('© GENGROUP · GENGLASS · дашборд РОПа v3 · живые данные Bitrix24 (тест, 19.03–19.06.2026)','© GENGROUP · GG&DG · только лиды и сделки Домгласс · Битрикс24');
  s=s.replace(/<a\b[^>]*href="[^"#]*dashboards\/"[^>]*>/,'<span class="logo" aria-label="GG&DG">').replace('alt="GG"></a>','alt="GG"></span>');
  s=s.replaceAll('https://glassmemory.bitrix24.ru/crm/deal/details/','');
  s=once(s,'const notForeign=x=>!GM_OWNED.has(x.mgr);','const notForeign=x=>true; // All rows are already source-scoped before publication.');
  s=s.replace(/^const PLAN_MGRS=\[.*?\];$/m,'const PLAN_MGRS=DATA.opUsers||[];');
  s=once(s,'planRev:4000000','planRev:null');
  s=once(s,"amtMode:'budget'","amtMode:'prepay'");
  s=once(s,'<button data-am="budget" class="on">бюджет</button><button data-am="prepay">предоплата</button>','<button data-am="budget">бюджет</button><button data-am="prepay" class="on">предоплата</button>');
  s=once(s,"S.amtMode!=='budget'","S.amtMode!=='prepay'");
  s=once(s,'<div class="kpi-trend flat">— нет базы</div>','<div class="kpi-trend flat" data-tip="Начальное значение 0%: в предыдущем равном периоде пока нет базы для сравнения.">0%</div>');
  s=section(s,'bkey',x=>x.replaceAll('.getDay()', '.getUTCDay()').replaceAll('.getDate()', '.getUTCDate()').replaceAll('.setDate(', '.setUTCDate('));
  s=section(s,'setPeriod',x=>x.replaceAll('.getDate()', '.getUTCDate()').replaceAll('.setDate(', '.setUTCDate(').replace('new Date(ly,lm,0).getUTCDate()','new Date(Date.UTC(ly,lm,0)).getUTCDate()'));
  s=s.replaceAll("'_vchk'","'_ggdg_vchk'");
  s=once(s,'+B_kpi+B_gauges+G(B_dynRev,B_cvFunnel)+B_donuts','+B_kpi+dgPlanGauges(m,cr1)+G(B_dynRev,B_cvFunnel)+B_donuts');
  s=once(s,'+B_leadStrip+B_teamPlan+G(B_dynLeads,B_quality)','+B_leadStrip+dgTeamPlan(_teamMetrics,teamMetric,_fmtFor)+G(B_dynLeads,B_quality)');
  s=once(s,'+B_prodKpi+B_prodChart+B_prodMgr+noCardBlock()','+B_prodKpi+B_prodChart+(B_prodMgr||dgEmpty("Отдел продаж: передачи и потенциал"))+noCardBlock()');
  s=s.replaceAll('кто тянет, а кто отстаёт от плана','План ДГ не задан · сравнение фактических значений');
  s=s.replaceAll('здоровье бизнеса: в плане ли мы и куда движемся','показатели ДГ и сравнение с прошлым периодом');
  s=s.replace('Обновление данных :: Данные обновляются 3 раза в день перед дайджестами - 09:00 / 15:00 / 17:30 МСК (будни) + ночной снимок. Точное время может отличаться на 1-3 ч из-за очереди GitHub. Когда новая сборка приезжает - страница обновляется сама.','Обновление данных :: При каждой публикации сайта собирается новый снимок только по источнику «Заявка с ДГ». Время снимка указано рядом.');
  s=once(s,'const _leadN=m.leads||1,','const _leadN=m.leads,');
  s=once(s,'ltot=L.length||1','ltot=L.length');
  s=s.replaceAll('/ltot','/(ltot||1)');
  s=s.replace(/(const refused=[^;\n]+)\|\|1;/,'$1;');
  s=s.replaceAll('/refused','/(refused||1)');
  s=section(s,'managerDashboardsBlock',x=>{
    x=x.replaceAll('!_MExcl.has(d.mgr)&&d.dir!=="glass-memory"','true');
    x=x.replace('const TCR=(_pmC&&_pmC.cr2>0)?_pmC.cr2:0.15;','const TCR=null;');
    x=x.replace(/const crC=v=>[^\n]+;/,'const crC=v=>"var(--ink-2)";');
    x=x.replace('target=days<=1?Math.max(1,_cap):_cap, pctPlan=target?fact/target:null','target=null, pctPlan=null');
    x=x.replace('href="../rop-${slug}/" target="_blank"','href="?manager=${encodeURIComponent(name)}#sec3" data-dg-manager="${esc(name)}"');
    x=x.replace('`${fmt(target)} / ${fmt(fact)}`','`— / ${fmt(fact)}`');
    x=x.replace("stat('% плана',pctPlan==null?'—':pct(pctPlan),pctC(pctPlan))","stat('% плана','—','var(--ink-3)')");
    x=x.replace('Открыть дашборд →','Показать данные ДГ →');
    x=x.replace("otk>fact*4?'#F8717A':'var(--ink-2)'","'var(--ink-2)'");
    x=x.replace(/info\('Личный дашборд каждого менеджера ОП:[^']*'\)/,"info('Показатели менеджеров только по ДГ за выбранный период. Карточка включает фильтр по менеджеру на этой странице. План ДГ не задан; рейтинг сравнивает фактические показатели по выбранной метрике.')");
    x=x.replace('клик по карточке - личный дашборд','клик по карточке - фильтр ДГ');
    return x;
  });
  // Use only DG manager selection in blocks which originally had department-wide scope.
  s=s.replaceAll("const dirOk=d=>(!S.fDir||d.dir===S.fDir)&&notForeign(d);","const dirOk=d=>(!S.fMgr||d.mgr===S.fMgr)&&(!S.fDir||d.dir===S.fDir)&&notForeign(d);");
  s=section(s,'healthBlock',x=>{
    x=x.replace(/let lensC,lensT;[\s\S]*?(?=  const lensBadge)/,"const lensC='var(--ink-3)',lensT='Выбранное окно: '+pDays+' дн. Последующие закрытия открытых сделок могут изменить конверсию. Статистика длительности цикла ДГ пока не задана.';\n");
    x=x.replace('const SUCPLAN=0.35,','const SUCPLAN=null,');
    x=x.replace(/const qc=[^\n]+;/,'const qc="var(--ink-3)";').replace(/const qt=[^\n]+;/,'const qt="План ДГ не задан";').replace(/const qr=[^\n]+;/,'const qr="Показаны фактический поток и доли исходов. Плановое соотношение успехов и отказов для ДГ не установлено.";');
    x=x.replace(/`<line x1="\$\{planX\}"[^\n]*?`\+\n/,'');
    x=x.replace('<span style="color:var(--ink-4);white-space:nowrap">┊ 35 / 65</span>','');
    x=x.replaceAll('pct(1-sucShare)','pct(vyhod?1-sucShare:0)');
    x=x.replace('const planCr=(_pmH&&_pmH.cr2>0)?_pmH.cr2:0.15;','const planCr=null;');
    x=x.replace('Math.max(planCr*1.4,(allPts.length?Math.max(...allPts):planCr)*1.15)','Math.max(.1,(allPts.length?Math.max(...allPts):0)*1.15)');
    x=x.replace('[0,planCr,planCr*2,planCr*3]','[0,ymax*.25,ymax*.5,ymax*.75,ymax]');
    x=x.replace(/const CVT=planCr;const planLine=[^\n]+;/,"const CVT=null;const planLine='';");
    x=x.replace(/<span style="display:inline-flex;align-items:center;gap:5px"><svg width="22" height="8" style="overflow:visible"><line x1="0" y1="4" x2="22" y2="4" stroke="#E7ECF3"[^<]*\/><\/svg>цель \$\{pct\(planCr\)\}\/мес<\/span>/,'<span style="color:var(--ink-3)">План ДГ не задан</span>');
    x=x.replace('баланс потока · выход 35/65 · конверсия по менеджерам','баланс потока · фактические исходы · конверсия по менеджерам');
    return x;
  });
  s=section(s,'offerCalendarBlock',x=>{
    x=x.replace('if(opts.cup){','if(opts.cup && DATA.plan){');
    x=x.replace('const cupStrip=(()=>{','const cupStrip=(()=>{\n    return ""; // DG has no plan strip.');
    x=x.replace(/^\s*\{id:"(?:kp|dec|long)",[^\n]+\n/gm,'');
    x=x.replace('const COHSRC=[["wip",null],["kp","C49:PREPAYMENT_INVOIC"],["dec","C49:3"],["long","C49:UC_8JTBV2"]];','const COHSRC=[["wip",null]];');
    x=x.replace('const enterStage=(d,code)=>{for(const h of (d.hist||[]))if(h[0]===code&&h[1])return h[1];return null;};','const enterStage=dgFirstStageDate;');
    x=x.replace('const RBY={};ROWS.forEach(r=>RBY[r.id]=r);',`ROWS.push(
      {id:"production",nm:"В производстве",color:"#818CF8",df:d=>enterStage(d,"C49:FINAL_INVOICE"),grp:"после предоплаты"},
      {id:"shipping",nm:"Отгрузка",color:"#60A5FA",df:d=>enterStage(d,"C49:2"),grp:"после предоплаты"},
      {id:"completed",nm:"Завершение",color:"#2E9E74",df:d=>enterStage(d,"C49:WON")||(d.won?d.closed:null),grp:"после предоплаты"}
    );const RBY={};ROWS.forEach(r=>RBY[r.id]=r);`);
    x=x.replace('const money=a=>a.reduce((s,d)=>s+(d.budget||0),0);','const money=a=>a.reduce((s,d)=>s+amt(d),0);');
    x=x.replace(/info\('Тепловой календарь по датам событий\.[\s\S]*?'\)/,"info('Вход и выход - события за период. В работе - остаток на конец интервала. Производство, отгрузка и завершение - первый вход в соответствующий этап по истории сделки. Для успешного завершения при отсутствии истории используется дата закрытия успешной сделки. Строки этапов не складываются между собой: одна сделка может пройти несколько этапов. Клик по ячейке открывает записи. Сумма соответствует выбранному полю: бюджет или предоплата.')");
    return x;
  });
  s=once(s,"if(!IT||!IT.length)return '';","if(!IT)return dgEmpty('Передано без карточки СП','Данные производственных связей недоступны');");
  for(const [name,title,guard]of [['offerReasonsBlock','Причины отказов со стадии предложения','!lost.length'],['offerControlBlock','Со сделанным предложением - под контроль','!open.length'],['offerAnalytics','Пайплайн по сегментам: клиент и изделие','!passed.length'],['offerCalendarBlock','Календарь горячих сделок','!passed.length'],['healthBlock','Здоровье отдела продаж','!passed.length']])s=section(s,name,x=>x.replace(`if(${guard})return "";`,`if(${guard})return dgEmpty('${title}');`));
  s=s.replace("return dgEmpty('Пайплайн по сегментам: клиент и изделие');","return dgEmptySegments();").replace("return dgEmpty('Здоровье отдела продаж');","return dgEmptyHealth();").replace("return dgEmpty('Календарь горячих сделок');","return dgEmptyCalendar();");
  s=s.replaceAll('у всех сделок, переданных в производство в выбранном периоде, карточки СП созданы - цех видит весь объём','Нет передач без карточки СП в выбранном периоде');
  const crossStart=s.indexOf('  const _cvFunnel=(()=>{'),crossEnd=s.indexOf('  const _oi=',crossStart);
  if(crossStart<0||crossEnd<0)throw Error('Missing cross funnel');
  s=s.slice(0,crossStart)+'  const _cvFunnel=dgVerticalConversion(_leadN,_qualN,_wonN,_cv1,_cvQS);\n'+s.slice(crossEnd);
  const wonTile='`<div class="oi-tile"><div class="oi-v" style="color:#10B981">${fmtK(_wonRev)} ₽</div><div class="oi-l">Выиграно</div></div>`+',openTile='`<div class="oi-tile"><div class="oi-v" style="color:#60A5FA">${fmtK(_openRev)} ₽</div><div class="oi-l">В работе</div></div>`+';
  s=once(s,wonTile+'\n    '+openTile,openTile+'\n    '+wonTile);
  // Requested compact layout: keep company KPIs/conversion, sales funnel and offer analytics.
  const assemblyStart=s.indexOf('  h = B_migWarn + divider('),assemblyEnd=s.indexOf("  document.getElementById('root').innerHTML=h;",assemblyStart);
  if(assemblyStart<0||assemblyEnd<0)throw Error('Missing dashboard assembly');
  s=s.slice(0,assemblyStart)+`  h=B_migWarn+divider(1,'Компания','показатели ДГ и сравнение с прошлым периодом')+B_kpi+B_cvFunnel+dgDistributionBlock()
    +divider(2,'Отдел продаж','от входящих лидов до исходов сделок')+B_leadStrip+B_leadFunnelPair+dgLeadDetails()+B_truba+dgCalendarBlock()
    +divider(3,'Со сделанным предложением','пайплайн и исходы офферов')+offerAnalytics()+offerReasonsBlock();
`+s.slice(assemblyEnd);
  s=once(s,"document.getElementById('root').innerHTML=h;","document.getElementById('root').innerHTML=dgSafeMarkup(h);");
  s=s.replace(/wireDyn\(D,L\);wireCv\(L,D\);wireLoad\(\);wireMoneyDyn\([^\n]+?;wirePrepProd\(\);wireDQ\(\);/,'wireCv(L,D);');
  s=s.replace(/<a href="#sec[345]" data-sec="sec[345]">[^<]+<\/a>/g,'').replace('<a href="#sec6" data-sec="sec6">','<a href="#sec3" data-sec="sec3">');
  s=once(s,'<div class="lf-bar"><div class="lf-name">${nm}</div>','<div class="lf-bar dg-click" role="button" tabindex="0" data-dg-lead="${esc(nm)}" aria-controls="dg-lead-details"><div class="lf-name">${nm}</div>');
  s=s.replace('из ${fmt(ltot)} лидов genglass:','из ${fmt(ltot)} лидов ДГ:');
  s=s.replace(/info\('Все лиды периода по исходу:[^']*'\)/,"info('Лиды ДГ, созданные за выбранный период. Сделки здесь означают конвертированные лиды, а не количество отдельных сделок. Нажмите на этап, чтобы открыть список лидов и связанные сделки.')");
  s=s.replace('Внутри «Некачественный лид» причину пишет менеджер: чаще всего игнор, тест, пустой, звонок по заказу. Подпричины «Отказа» в выгрузке пока нет.','Распределение отказов по статусам. Подробные причины и коммуникации доступны в календаре.');
  s=s.replace('</style>',`.dg-click{cursor:pointer}.dg-click:focus-visible,.dg-reason:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.dg-reason{width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;padding:5px 0}.dg-reason:hover{background:var(--bg-elevated)}.dg-detail{scroll-margin-top:150px}.dg-table{max-height:520px;overflow:auto}.dg-table table{width:100%;border-collapse:collapse;min-width:850px}.dg-table th{position:sticky;top:0;background:var(--bg-elevated);text-align:left;white-space:nowrap}.dg-table th,.dg-table td{padding:10px;border-bottom:1px solid var(--border);font-size:12px;vertical-align:top}.dg-table a{color:var(--accent)}.dg-table small{display:block;color:var(--ink-3);margin-top:3px}.dg-tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:10px 0}.dg-tools input{min-width:200px;flex:1;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--ink)}.dg-summary{width:100%;max-width:660px;border-collapse:collapse;margin:12px 0}.dg-summary td,.dg-summary th{padding:7px 9px;text-align:left;border-bottom:1px solid var(--border)}.dg-summary button{background:transparent;border:0;color:var(--accent);font:inherit;cursor:pointer;text-align:left}.dg-dist{margin-top:16px}.dg-dist .card-h{flex-wrap:wrap}.dg-dist-note{color:var(--ink-3);font-size:11px;margin-top:8px}.dg-breakdown button{color:inherit;background:none;border:0;font:inherit;cursor:pointer;text-align:left}.dg-breakdown{margin:12px 0 0;padding:0}.dg-tools button{background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;color:var(--ink-2);padding:8px 10px;cursor:pointer;font:inherit;font-size:11px}.dg-dist [data-dg-field]{cursor:pointer}.dg-breakdown li{display:flex;justify-content:space-between;gap:8px;margin:5px 0;list-style:none}@media(max-width:600px){.dg-detail{scroll-margin-top:280px}.dg-table{max-height:420px}.dg-tools input{min-width:140px}}\n</style>`);
  s=s.replace('</style>',`.dg-dist-controls{display:flex;gap:10px;flex-wrap:wrap;margin-left:auto;align-items:center}.dg-cross-layout{display:grid;grid-template-columns:minmax(0,1fr) 150px;align-items:center;gap:20px}.dg-cross-vertical{width:100%;max-width:420px;margin:12px auto}.dg-cross-stage{display:flex;align-items:center;flex-direction:column;gap:8px;margin:10px 0}.dg-cross-stage>span{font-size:12px;color:var(--ink-2)}.dg-cross-bar{color:#07121a;min-width:70px;min-height:44px;border-radius:4px;display:grid;place-items:center}.dg-cross-bar b{font-size:21px;font-weight:700}.dg-cross-stage>small{color:var(--ink-3);font-size:11px}.dg-cross-total{border-left:1px solid var(--border);padding:16px 0 16px 18px;font-size:12px;color:var(--ink-3)}.dg-cross-total b{display:block;font-size:27px;margin-top:8px;color:var(--ink)}.dg-record-id{font-weight:600;color:var(--ink-2)}@media(max-width:600px){.dg-cross-layout{grid-template-columns:minmax(0,1fr) 100px;gap:10px}.dg-cross-total b{font-size:22px}.dg-dist-controls{width:100%;justify-content:flex-end}}\n</style>`);
  s=s.replace('</style>',fsCalendarStyles()+'\n</style>');
  s=once(s,"setPeriod('30');buildShell();",hook+"\nsetPeriod('30');buildShell();");
  // The partner view exposes only the requested conversion funnel and segment summaries.
  s=once(s,"  const _cvBody = S.cvView==='dyn'\n    ? `<div id=\"cvDyn\"></div>`\n    : `${_cvFunnel}${_churn}${_oi}`;","  const _cvBody = `${_cvFunnel}${_churn}${_oi}`;");
  s=once(s,'<div class="seg" id="cvSeg"></div>','');
  s=section(s,'offerAnalytics',x=>x.replace('${donuts}${segDyn}','${donuts}').replaceAll('data-ocseg=','data-dg-static-segment=').replace('cursor:pointer;padding:2px 4px','padding:2px 4px').replaceAll('клик по сегменту - конверсия в динамике','доли открытых сделок').replace(' · клик по сегменту - конверсия и сделки',''));
  s=s.replaceAll('Компания','Лиды от Домгласс').replaceAll('Отдел продаж','Работа отдела продаж');
  return s;
}
module.exports={adaptTemplate};
function fsCalendarStyles(){return require('node:fs').readFileSync(require('node:path').join(__dirname,'calendar-view.css'),'utf8');}
