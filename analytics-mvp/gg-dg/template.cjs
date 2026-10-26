'use strict';
function once(s,from,to){if(s.split(from).length!==2)throw Error('GG template contract changed: '+from.slice(0,80));return s.replace(from,to);}
function section(s,name,edit){const a=s.indexOf('function '+name+'('),b=s.indexOf('\nfunction ',a+1);if(a<0||b<0)throw Error('Missing GG function '+name);return s.slice(0,a)+edit(s.slice(a,b))+s.slice(b);}
function adaptTemplate(input,hook){let s=input.replace(/\r\n/g,'\n');
  s=once(s,'<title>GENGLASS · Командный центр РОПа</title>','<title>GG&DG · Домгласс · Командный центр</title><meta name="robots" content="noindex,nofollow">');
  s=s.replaceAll('GENGLASS · Отдел продаж','GG&DG · Домгласс').replaceAll('Командный центр РОПа · воронка «GG Заказы РФ»','Все виджеты ГГ · источник «Заявка с ДГ»').replaceAll('© GENGROUP · GENGLASS · дашборд РОПа v3 · живые данные Bitrix24 (тест, 19.03–19.06.2026)','© GENGROUP · GG&DG · только лиды и сделки Домгласс · Битрикс24');
  s=once(s,'const notForeign=x=>!GM_OWNED.has(x.mgr);','const notForeign=x=>true; // All rows are already source-scoped before publication.');
  s=s.replace(/^const PLAN_MGRS=\[.*?\];$/m,'const PLAN_MGRS=DATA.opUsers||[];');
  s=once(s,'planRev:4000000','planRev:null');
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
    x=x.replace('const cupStrip=(()=>{','const cupStrip=(()=>{\n    if(!DATA.plan)return dgCalendarPlan(keys,scope,enterExec,inR,g,unit);');
    return x;
  });
  s=once(s,"if(!IT||!IT.length)return '';","if(!IT)return dgEmpty('Передано без карточки СП','Данные производственных связей недоступны');");
  for(const [name,title,guard]of [['offerReasonsBlock','Причины отказов со стадии предложения','!lost.length'],['offerControlBlock','Со сделанным предложением - под контроль','!open.length'],['offerAnalytics','Пайплайн по сегментам: клиент и изделие','!passed.length'],['offerCalendarBlock','Календарь горячих сделок','!passed.length'],['healthBlock','Здоровье отдела продаж','!passed.length']])s=section(s,name,x=>x.replace(`if(${guard})return "";`,`if(${guard})return dgEmpty('${title}');`));
  s=s.replace("return dgEmpty('Пайплайн по сегментам: клиент и изделие');","return dgEmptySegments();").replace("return dgEmpty('Здоровье отдела продаж');","return dgEmptyHealth();").replace("return dgEmpty('Календарь горячих сделок');","return dgEmptyCalendar();");
  s=s.replaceAll('у всех сделок, переданных в производство в выбранном периоде, карточки СП созданы - цех видит весь объём','Нет передач без карточки СП в выбранном периоде');
  s=once(s,"setPeriod('30');buildShell();",hook+"\nsetPeriod('30');buildShell();");
  return s;
}
module.exports={adaptTemplate};
